/**
 * Agent Executor Service
 *
 * Claude Agent SDK を使用して Claude Code をプログラマティックに実行するサービス
 * マルチターン対話サポート: resume オプションでセッション継続
 */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { spawn } from 'node:child_process'
import { query, type SDKMessage } from '@anthropic-ai/claude-agent-sdk'
import type {
  AgentSession,
  AgentSessionStatus,
  AgentMessage,
  AgentExecuteRequest,
  AgentToolApprovalResponse,
} from '../../shared/types.ts'
import { getDefaultPolicyEngine, inferPathCategory, inferOperationKind } from './policy-engine.ts'

/**
 * Session history for multi-turn conversation support
 */
interface SessionHistory {
  sessionId: string
  conversationId?: string
  turnCount: number
  lastPrompt: string
  createdAt: string
  updatedAt: string
}

// Active sessions storage (in-memory for now)
const activeSessions = new Map<string, AgentSessionState>()

// Session history for resume (stores conversation context)
const sessionHistory = new Map<string, SessionHistory>()

// Pending tool approvals (waiting for user decision)
const pendingApprovals = new Map<string, PendingApproval>()

interface AgentSessionState {
  session: AgentSession
  abortController: AbortController
  queryInstance: AsyncGenerator<SDKMessage> | null
}

interface PendingApproval {
  sessionId: string
  toolUseId: string
  toolName: string
  toolInput: unknown
  resolve: (response: AgentToolApprovalResponse) => void
  reject: (error: Error) => void
  timeoutId: ReturnType<typeof setTimeout>
}

// WebSocket connections for tool approval UI
const wsConnections = new Map<string, (data: unknown) => void>()

// Type aliases for SDK hooks
type SDKHookCallback = (
  input: unknown,
  toolUseId: string | undefined,
  options: { signal: AbortSignal }
) => Promise<unknown>

type SDKHookEntry = {
  matcher?: string
  hooks: SDKHookCallback[]
  timeout?: number
}

type SDKHooks = Record<string, SDKHookEntry[]>

/**
 * Register WebSocket connection for tool approval
 */
export function registerWsConnection(
  sessionId: string,
  sendMessage: (data: unknown) => void
): void {
  wsConnections.set(sessionId, sendMessage)
}

/**
 * Unregister WebSocket connection
 */
export function unregisterWsConnection(sessionId: string): void {
  wsConnections.delete(sessionId)
}

/**
 * Load MCP server configuration from user settings
 */
function loadMcpServers(): Record<string, { command: string; args?: string[]; env?: Record<string, string> }> {
  const mcpServers: Record<string, { command: string; args?: string[]; env?: Record<string, string> }> = {}

  // Try to load from ~/.claude.json or ~/.claude/settings.json
  const configPaths = [
    join(homedir(), '.claude.json'),
    join(homedir(), '.claude', 'settings.json'),
    join(homedir(), '.claude', 'settings.local.json'),
  ]

  for (const configPath of configPaths) {
    if (existsSync(configPath)) {
      try {
        const config = JSON.parse(readFileSync(configPath, 'utf-8'))
        if (config.mcpServers) {
          Object.assign(mcpServers, config.mcpServers)
        }
      } catch {
        // Ignore parse errors
      }
    }
  }

  return mcpServers
}

/**
 * Load hooks from project hooks.json and convert to SDK format
 */
function loadProjectHooks(projectPath: string | undefined): SDKHooks {
  if (!projectPath) return {}

  const hooksPath = join(projectPath, 'hooks', 'hooks.json')
  const pluginHooksPath = join(projectPath, '.claude-plugin', 'hooks.json')

  const hookFilePath = existsSync(hooksPath) ? hooksPath : existsSync(pluginHooksPath) ? pluginHooksPath : null

  if (!hookFilePath) return {}

  try {
    const hooksConfig = JSON.parse(readFileSync(hookFilePath, 'utf-8'))
    const sdkHooks: SDKHooks = {}

    if (hooksConfig.hooks) {
      for (const [eventType, matchers] of Object.entries(hooksConfig.hooks)) {
        if (!Array.isArray(matchers)) continue

        sdkHooks[eventType] = matchers.map((matcherConfig: { matcher?: string; hooks?: Array<{ type: string; command?: string; timeout?: number }> }) => ({
          matcher: matcherConfig.matcher,
          timeout: matcherConfig.hooks?.[0]?.timeout,
          hooks: (matcherConfig.hooks || [])
            .filter((h: { type: string }) => h.type === 'command')
            .map((hookDef: { command?: string; timeout?: number }) => {
              return async (input: unknown, _toolUseId: string | undefined, options: { signal: AbortSignal }) => {
                if (!hookDef.command) return { continue: true }

                // Replace ${CLAUDE_PLUGIN_ROOT} with actual path
                const command = hookDef.command.replace(/\$\{CLAUDE_PLUGIN_ROOT\}/g, projectPath)

                return new Promise((resolve) => {
                  const proc = spawn('sh', ['-c', command], {
                    cwd: projectPath,
                    env: {
                      ...process.env,
                      CLAUDE_PLUGIN_ROOT: projectPath,
                      HOOK_INPUT: JSON.stringify(input),
                    },
                    signal: options.signal,
                  })

                  let stdout = ''
                  let stderr = ''

                  proc.stdout?.on('data', (data) => { stdout += data.toString() })
                  proc.stderr?.on('data', (data) => { stderr += data.toString() })

                  proc.on('close', (code) => {
                    if (code === 0) {
                      try {
                        resolve(JSON.parse(stdout))
                      } catch {
                        resolve({ continue: true })
                      }
                    } else {
                      console.error(`Hook failed: ${stderr}`)
                      resolve({ continue: true })
                    }
                  })

                  proc.on('error', (error) => {
                    console.error(`[Hook] Spawn error: ${error.message}`)
                    resolve({ continue: true })
                  })
                })
              }
            })
        }))
      }
    }

    return sdkHooks
  } catch {
    return {}
  }
}

/**
 * Generate a unique session ID
 */
function generateSessionId(): string {
  return `agent-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

/**
 * Create a new agent message
 */
function createMessage(
  type: AgentMessage['type'],
  content: string,
  extra?: Partial<AgentMessage>
): AgentMessage {
  return {
    id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    type,
    content,
    timestamp: new Date().toISOString(),
    ...extra,
  }
}

/**
 * Get session by ID
 */
export function getSession(sessionId: string): AgentSession | null {
  const state = activeSessions.get(sessionId)
  return state?.session ?? null
}

/**
 * Get all active sessions
 */
export function getActiveSessions(): AgentSession[] {
  return Array.from(activeSessions.values()).map((state) => state.session)
}

/**
 * Get session status
 */
export function getSessionStatus(sessionId: string): AgentSessionStatus {
  const state = activeSessions.get(sessionId)
  return state?.session.status ?? 'idle'
}

/**
 * Start a new agent execution
 */
export async function* executeAgent(
  request: AgentExecuteRequest,
  onToolApproval?: (
    toolName: string,
    toolInput: unknown,
    toolUseId: string
  ) => Promise<AgentToolApprovalResponse>
): AsyncGenerator<AgentMessage, void, unknown> {
  const sessionId = request.sessionId ?? generateSessionId()
  const abortController = new AbortController()

  // Initialize session
  const session: AgentSession = {
    id: sessionId,
    status: 'running',
    startedAt: new Date().toISOString(),
    prompt: request.prompt,
    workingDirectory: request.workingDirectory,
    messages: [],
  }

  // Store session state
  activeSessions.set(sessionId, {
    session,
    abortController,
    queryInstance: null,
  })

  // Add user message
  const userMessage = createMessage('user', request.prompt)
  session.messages.push(userMessage)
  yield userMessage

  try {
    // Check if project has a plugin directory
    const pluginDir = request.workingDirectory
      ? join(request.workingDirectory, '.claude-plugin')
      : null
    const hasPlugin = pluginDir && existsSync(pluginDir)

    // Load MCP servers from user config
    const mcpServers = loadMcpServers()

    // Load project hooks
    const projectHooks = loadProjectHooks(request.workingDirectory)

    // Execute query using Agent SDK
    const queryOptions: Parameters<typeof query>[0] = {
      prompt: request.prompt,
      options: {
        cwd: request.workingDirectory,
        permissionMode: request.permissionMode ?? 'default',
        abortController,
        systemPrompt: 'ユーザーの言語に合わせて回答してください。日本語で質問された場合は日本語で、英語で質問された場合は英語で回答してください。',
        // Load settings from all sources (required for custom slash commands)
        settingSources: ['local', 'project', 'user'],
        // Load project plugin if available
        ...(hasPlugin && request.workingDirectory
          ? { plugins: [{ type: 'local' as const, path: request.workingDirectory }] }
          : {}),
        // Load MCP servers if configured
        ...(Object.keys(mcpServers).length > 0 ? { mcpServers } : {}),
        // Load project hooks if available
        ...(Object.keys(projectHooks).length > 0 ? { hooks: projectHooks } : {}),
      },
    }

    // Get policy engine instance
    const policyEngine = getDefaultPolicyEngine()

    // Always set up canUseTool callback - this ensures guardrails work even if WebSocket
    // connects after execution starts. We fetch wsHandler fresh each time it's needed.
    queryOptions.options = {
      ...queryOptions.options,
      canUseTool: async (toolName: string, input: Record<string, unknown>) => {
        const toolUseId = `tool-${Date.now()}`
        console.log(`[canUseTool] Tool requested: ${toolName}, toolUseId=${toolUseId}`)

        // Fetch wsHandler fresh each time (not captured at start)
        const wsHandler = wsConnections.get(sessionId)

        // Extract file path from input
        const filePath = (input as { file_path?: string; filePath?: string }).file_path ||
                        (input as { file_path?: string; filePath?: string }).filePath

        // Evaluate policy using PolicyEngine
        const evaluation = policyEngine.evaluate(toolName, input, filePath)

        // Special handling for AskUserQuestion - always allow (handled separately)
        if (toolName === 'AskUserQuestion' && wsHandler) {
          console.log(`[canUseTool] AskUserQuestion detected! sessionId=${sessionId}, toolUseId=${toolUseId}`)
          console.log(`[canUseTool] AskUserQuestion input:`, JSON.stringify(input, null, 2))
          const questions = (input as { questions?: unknown[] }).questions
          if (questions && Array.isArray(questions)) {
            console.log(`[canUseTool] Sending ask_user_question to UI, questions count: ${questions.length}`)
            // Send question request to UI
            wsHandler({
              type: 'ask_user_question',
              sessionId,
              toolUseId,
              questions,
            })
            console.log(`[canUseTool] ask_user_question message sent to WebSocket`)

            // Wait for user response
            try {
              const response = await requestToolApproval(sessionId, toolUseId, toolName, input, 120000)
              // Return the answers as modified input
              return {
                behavior: 'allow' as const,
                updatedInput: response.modifiedInput as Record<string, unknown> ?? input,
              }
            } catch {
              // Timeout - return empty answers
              return {
                behavior: 'allow' as const,
                updatedInput: { ...input, answers: {} },
              }
            }
          }
        }

        // Handle policy evaluation result
        if (evaluation.behavior === 'allow') {
          console.log(`[canUseTool] Policy allows: ${toolName}${filePath ? ` (${filePath})` : ''}`)
          return { behavior: 'allow' as const, updatedInput: input }
        }

        if (evaluation.behavior === 'deny') {
          console.log(`[canUseTool] Policy denies: ${toolName}${filePath ? ` (${filePath})` : ''}, reason: ${evaluation.reason}`)
          return {
            behavior: 'deny' as const,
            message: evaluation.reason ?? `${toolName} の実行はポリシーにより拒否されました`,
          }
        }

        // evaluation.behavior === 'ask' - require UI approval
        console.log(`[canUseTool] Policy requires approval: ${toolName}${filePath ? ` (${filePath})` : ''}`)

        if (wsHandler) {
          // Send tool approval request to UI (with policy context)
          wsHandler({
            type: 'tool_approval_request',
            sessionId,
            toolUseId,
            toolName,
            toolInput: input,
            isProtected: evaluation.locked,
            protectedReason: evaluation.reason,
            policyCategory: inferPathCategory(filePath),
            policyOperation: inferOperationKind(toolName),
          })

          // Wait for approval response
          try {
            const response = await requestToolApproval(sessionId, toolUseId, toolName, input, 60000)
            if (response.decision === 'allow') {
              return {
                behavior: 'allow' as const,
                updatedInput: (response.modifiedInput ?? input) as Record<string, unknown>,
              }
            } else {
              return {
                behavior: 'deny' as const,
                message: response.reason ?? 'User denied tool execution',
              }
            }
          } catch {
            // Timeout or error - deny by default
            return {
              behavior: 'deny' as const,
              message: evaluation.reason ?? 'Tool approval timed out',
            }
          }
        }

        // Use provided handler if available
        if (onToolApproval) {
          const response = await onToolApproval(toolName, input, toolUseId)
          if (response.decision === 'allow') {
            return {
              behavior: 'allow' as const,
              updatedInput: (response.modifiedInput ?? input) as Record<string, unknown>,
            }
          } else {
            return {
              behavior: 'deny' as const,
              message: response.reason ?? 'User denied tool execution',
            }
          }
        }

        // No WebSocket and no handler - deny if policy requires ask
        console.log(`[canUseTool] No WebSocket handler, denying ask-required tool: ${toolName}`)
        return {
          behavior: 'deny' as const,
          message: evaluation.reason ?? `${toolName} の実行にはUI承認が必要です（WebSocket未接続）`,
        }
      },
    }

    // Start the query
    const queryGen = query(queryOptions)
    const state = activeSessions.get(sessionId)
    if (state) {
      state.queryInstance = queryGen
    }

    // Debug: log WebSocket registration status at execution start
    const wsHandlerAtStart = wsConnections.get(sessionId)
    console.log(`[executeAgent] Starting execution for sessionId=${sessionId}, wsHandler=${wsHandlerAtStart ? 'REGISTERED' : 'NOT REGISTERED'}`)
    console.log(`[executeAgent] All registered sessions: ${Array.from(wsConnections.keys()).join(', ') || 'none'}`)

    // Process SDK messages
    let messageCount = 0
    for await (const sdkMessage of queryGen) {
      messageCount++
      // Check if aborted
      if (abortController.signal.aborted) {
        break
      }

      // Debug: log SDK message structure with message count
      const messageType = (sdkMessage as { type?: string }).type || 'unknown'
      console.log(`[SDK Message #${messageCount}] type=${messageType}`, JSON.stringify(sdkMessage, null, 2).slice(0, 500))

      // Convert SDK message to our format
      const agentMessage = convertSdkMessage(sdkMessage)
      if (agentMessage) {
        session.messages.push(agentMessage)

        // Send message via WebSocket for real-time streaming
        const wsHandler = wsConnections.get(sessionId)
        console.log(`[WS Send] sessionId=${sessionId}, wsHandler=${wsHandler ? 'found' : 'not found'}, type=${agentMessage.type}`)
        if (wsHandler) {
          wsHandler({
            type: 'agent_message',
            sessionId,
            message: agentMessage,
          })
          console.log(`[WS Send] Message sent: ${agentMessage.type} - ${agentMessage.content.substring(0, 50)}...`)
        }

        yield agentMessage
      }
    }

    // Debug: log total message count
    console.log(`[executeAgent] Finished processing ${messageCount} SDK messages for sessionId=${sessionId}`)

    // Mark session as completed
    session.status = 'completed'
    session.completedAt = new Date().toISOString()

    // Add completion message
    const completionMessage = createMessage('system', 'Execution completed')
    session.messages.push(completionMessage)
    yield completionMessage
  } catch (error) {
    // Handle errors
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred'

    if (abortController.signal.aborted) {
      session.status = 'interrupted'
      const interruptMessage = createMessage('system', 'Execution interrupted by user')
      session.messages.push(interruptMessage)
      yield interruptMessage
    } else {
      session.status = 'error'
      session.error = errorMessage
      const errorMsg = createMessage('error', errorMessage)
      session.messages.push(errorMsg)
      yield errorMsg
    }
  } finally {
    // Update session state
    if (session.status === 'running') {
      session.status = 'completed'
    }
    session.completedAt = new Date().toISOString()
  }
}

/**
 * Convert SDK message to AgentMessage format
 */
function convertSdkMessage(sdkMessage: SDKMessage): AgentMessage | null {
  // Handle different message types based on SDK message structure
  // The SDK message format varies by type
  const messageType = (sdkMessage as { type?: string }).type

  switch (messageType) {
    case 'assistant': {
      const content = extractContent(sdkMessage)
      if (content) {
        return createMessage('assistant', content)
      }
      return null // Skip empty assistant messages
    }

    case 'result': {
      // Skip result message - the content is already sent via assistant messages
      // The result message is a final summary that would duplicate the last assistant response
      return null
    }

    case 'tool_use': {
      const toolName = (sdkMessage as { name?: string }).name || 'unknown'
      const toolInput = (sdkMessage as { input?: unknown }).input
      // Create a brief summary of the tool invocation
      let summary = `🔧 ${toolName}`
      if (toolInput && typeof toolInput === 'object') {
        const inputKeys = Object.keys(toolInput as Record<string, unknown>)
        const firstKey = inputKeys[0]
        if (firstKey) {
          const firstValue = (toolInput as Record<string, unknown>)[firstKey]
          const valueStr = typeof firstValue === 'string'
            ? firstValue.slice(0, 50) + (firstValue.length > 50 ? '...' : '')
            : JSON.stringify(firstValue).slice(0, 50)
          summary += `: ${firstKey}=${valueStr}`
        }
      }
      return createMessage('tool_use', summary, {
        toolName,
        toolInput,
      })
    }

    case 'tool_result': {
      const toolResult = (sdkMessage as { content?: unknown }).content
      // Create a brief summary of the result
      let summary = '✅ Tool completed'
      if (toolResult) {
        if (typeof toolResult === 'string') {
          summary = toolResult.slice(0, 200) + (toolResult.length > 200 ? '...' : '')
        } else if (Array.isArray(toolResult)) {
          const textContent = toolResult
            .map((item: unknown) => {
              if (typeof item === 'string') return item
              if (typeof item === 'object' && item !== null && 'text' in item) {
                return (item as { text: string }).text
              }
              return ''
            })
            .filter(Boolean)
            .join('\n')
          summary = textContent.slice(0, 200) + (textContent.length > 200 ? '...' : '')
        }
      }
      return createMessage('tool_result', summary, {
        toolResult,
      })
    }

    case 'system': {
      // Skip init messages (they have subtype: 'init')
      const subtype = (sdkMessage as { subtype?: string }).subtype
      if (subtype === 'init') {
        return null // Don't show init message to user
      }
      const content = extractContent(sdkMessage)
      if (content) {
        return createMessage('system', content)
      }
      return null
    }

    default:
      // For unknown types, try to extract content
      const content = extractContent(sdkMessage)
      if (content) {
        return createMessage('assistant', content)
      }
      return null
  }
}

/**
 * Extract text content from SDK message
 */
function extractContent(message: SDKMessage): string | null {
  const msg = message as {
    content?: unknown
    text?: string
    result?: string
    message?: { content?: unknown[] }
  }

  // Handle 'result' type messages
  if (typeof msg.result === 'string') {
    return msg.result
  }

  // Handle 'assistant' type messages with nested message.content
  if (msg.message?.content && Array.isArray(msg.message.content)) {
    return msg.message.content
      .map((block: unknown) => {
        if (typeof block === 'string') return block
        if (typeof block === 'object' && block !== null && 'text' in block) {
          return (block as { text: string }).text
        }
        return ''
      })
      .filter(Boolean)
      .join('\n')
  }

  if (typeof msg.content === 'string') {
    return msg.content
  }

  if (typeof msg.text === 'string') {
    return msg.text
  }

  if (Array.isArray(msg.content)) {
    return msg.content
      .map((block: unknown) => {
        if (typeof block === 'string') return block
        if (typeof block === 'object' && block !== null && 'text' in block) {
          return (block as { text: string }).text
        }
        return ''
      })
      .filter(Boolean)
      .join('\n')
  }

  return null
}

/**
 * Interrupt an active session
 */
export function interruptSession(sessionId: string): boolean {
  const state = activeSessions.get(sessionId)
  if (!state) {
    return false
  }

  // Abort the query
  state.abortController.abort()
  state.session.status = 'interrupted'
  state.session.completedAt = new Date().toISOString()

  return true
}

/**
 * Request tool approval from user (via WebSocket)
 */
export function requestToolApproval(
  sessionId: string,
  toolUseId: string,
  toolName: string,
  toolInput: unknown,
  timeoutMs: number = 30000
): Promise<AgentToolApprovalResponse> {
  return new Promise((resolve, reject) => {
    // Set timeout
    const timeoutId = setTimeout(() => {
      pendingApprovals.delete(toolUseId)
      reject(new Error('Tool approval timed out'))
    }, timeoutMs)

    // Store pending approval
    pendingApprovals.set(toolUseId, {
      sessionId,
      toolUseId,
      toolName,
      toolInput,
      resolve,
      reject,
      timeoutId,
    })
  })
}

/**
 * Submit tool approval decision
 */
export function submitToolApproval(response: AgentToolApprovalResponse): boolean {
  const pending = pendingApprovals.get(response.toolUseId)
  if (!pending) {
    return false
  }

  // Clear timeout and resolve
  clearTimeout(pending.timeoutId)
  pendingApprovals.delete(response.toolUseId)
  pending.resolve(response)

  return true
}

/**
 * Get pending approval for a session
 */
export function getPendingApproval(sessionId: string): PendingApproval | null {
  for (const approval of pendingApprovals.values()) {
    if (approval.sessionId === sessionId) {
      return approval
    }
  }
  return null
}

/**
 * Clean up old sessions (call periodically)
 */
export function cleanupSessions(maxAgeMs: number = 3600000): number {
  const now = Date.now()
  let cleaned = 0

  for (const [sessionId, state] of activeSessions.entries()) {
    const session = state.session
    if (
      session.status !== 'running' &&
      session.completedAt &&
      now - new Date(session.completedAt).getTime() > maxAgeMs
    ) {
      activeSessions.delete(sessionId)
      cleaned++
    }
  }

  return cleaned
}

/**
 * Check if Agent SDK is available
 */
export async function checkAgentSdkAvailable(): Promise<{
  available: boolean
  version?: string
  error?: string
}> {
  try {
    // Try to import and check SDK
    await import('@anthropic-ai/claude-agent-sdk')
    return {
      available: true,
      version: '0.2.2', // From package.json
    }
  } catch (error) {
    return {
      available: false,
      error: error instanceof Error ? error.message : 'Failed to load Agent SDK',
    }
  }
}

/**
 * Continue an existing session with a new prompt (multi-turn conversation)
 * Uses the session history to maintain conversation context
 */
export async function* continueSession(
  sessionId: string,
  newPrompt: string,
  onToolApproval?: (
    toolName: string,
    toolInput: unknown,
    toolUseId: string
  ) => Promise<AgentToolApprovalResponse>
): AsyncGenerator<AgentMessage, void, unknown> {
  const existingState = activeSessions.get(sessionId)
  const history = sessionHistory.get(sessionId)

  if (!existingState && !history) {
    yield createMessage('error', `Session ${sessionId} not found`)
    return
  }

  // Get working directory from previous session
  const workingDirectory = existingState?.session.workingDirectory ?? undefined
  const previousMessages = existingState?.session.messages ?? []

  // Update session history
  const now = new Date().toISOString()
  const turnCount = (history?.turnCount ?? 0) + 1

  sessionHistory.set(sessionId, {
    sessionId,
    turnCount,
    lastPrompt: newPrompt,
    createdAt: history?.createdAt ?? now,
    updatedAt: now,
  })

  // Create continuation request with resume option
  const request: AgentExecuteRequest = {
    prompt: newPrompt,
    workingDirectory,
    sessionId, // Use same session ID for continuity
  }

  // Execute with resume context
  // Note: The SDK's resume option will be used when available
  // For now, we include previous context in the prompt
  const contextualPrompt = previousMessages.length > 0
    ? `[Continuing conversation, turn ${turnCount}]\n\nPrevious context summary:\n${summarizePreviousMessages(previousMessages)}\n\nNew request: ${newPrompt}`
    : newPrompt

  const modifiedRequest = { ...request, prompt: contextualPrompt }

  // Use the main executeAgent with the continuation context
  for await (const message of executeAgent(modifiedRequest, onToolApproval)) {
    yield message
  }
}

/**
 * Summarize previous messages for context
 */
function summarizePreviousMessages(messages: AgentMessage[]): string {
  const relevantMessages = messages
    .filter((m) => m.type === 'user' || m.type === 'assistant')
    .slice(-10) // Keep last 10 relevant messages

  return relevantMessages
    .map((m) => {
      const role = m.type === 'user' ? 'User' : 'Assistant'
      const content = m.content.length > 200
        ? m.content.substring(0, 200) + '...'
        : m.content
      return `${role}: ${content}`
    })
    .join('\n')
}

/**
 * Get session history
 */
export function getSessionHistory(sessionId: string): SessionHistory | null {
  return sessionHistory.get(sessionId) ?? null
}

/**
 * Get all session histories
 */
export function getAllSessionHistories(): SessionHistory[] {
  return Array.from(sessionHistory.values())
}

/**
 * Clear session history
 */
export function clearSessionHistory(sessionId: string): boolean {
  return sessionHistory.delete(sessionId)
}
