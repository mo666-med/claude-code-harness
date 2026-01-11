/**
 * Agent Console Component
 *
 * Claude Agent SDK を使用したエージェント実行の UI コンソール
 * - コマンドビルダー: スラッシュコマンドのインタラクティブ選択
 * - 実行状況表示: リアルタイムのメッセージストリーム
 * - ツール承認: 実行前の確認ダイアログ
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useProject } from '../App.tsx'
import { usePlans } from '../hooks/usePlans.ts'
import { useHealth } from '../hooks/useHealth.ts'
import { updateTaskMarker, fetchSSOT, type TaskConflictError } from '../lib/api.ts'
import { convertSlashCommand } from '../lib/command-utils.ts'
import type {
  AgentSession,
  AgentMessage,
  AgentExecuteRequest,
  Command,
  Task,
  WorkflowMode,
  SSOTResponse,
  GuardrailEvent,
  AgentRole,
  HandoffStatus,
} from '../../shared/types.ts'

// API base URL
const API_BASE = '/api'

// WebSocket URL for tool approval
const WS_URL = `ws://${window.location.host}/ws`

interface ToolApprovalRequest {
  type: 'tool_approval_request'
  sessionId: string
  toolUseId: string
  toolName: string
  toolInput: unknown
}

interface AgentMessageEvent {
  type: 'agent_message'
  sessionId: string
  message: AgentMessage
}

interface AskUserQuestionOption {
  label: string
  description?: string
}

interface AskUserQuestionItem {
  question: string
  header: string
  options: AskUserQuestionOption[]
  multiSelect?: boolean
}

interface AskUserQuestionRequest {
  type: 'ask_user_question'
  sessionId: string
  toolUseId: string
  questions: AskUserQuestionItem[]
}

interface AgentConsoleProps {
  onSessionChange?: (session: AgentSession | null) => void
}

type TabType = 'execute' | 'history'
type SidebarTabType = 'plans' | 'ssot' | 'health' | 'guardrail'

export function AgentConsole({ onSessionChange }: AgentConsoleProps) {
  const { activeProject } = useProject()
  const [activeTab, setActiveTab] = useState<TabType>('execute')

  // Plans integration state
  const [workflowMode, setWorkflowMode] = useState<WorkflowMode>('solo')
  const { plans, loading: plansLoading, refresh: refreshPlans } = usePlans(workflowMode, activeProject?.path)
  const [showPlansPanel, setShowPlansPanel] = useState(true)
  const [completionTask, setCompletionTask] = useState<Task | null>(null)
  const [showCompletionDialog, setShowCompletionDialog] = useState(false)
  const [isUpdatingTask, setIsUpdatingTask] = useState(false)
  const [taskUpdateError, setTaskUpdateError] = useState<string | null>(null)

  // Right sidebar state (Task 8.4-8.6)
  const [showRightSidebar, setShowRightSidebar] = useState(true)
  const [sidebarTab, setSidebarTab] = useState<SidebarTabType>('plans')

  // SSOT state (Task 8.4)
  const [ssot, setSsot] = useState<SSOTResponse | null>(null)
  const [ssotLoading, setSsotLoading] = useState(false)
  const [ssotKeywords, setSsotKeywords] = useState('')

  // Health state (Task 8.6)
  const { health, loading: healthLoading, refresh: refreshHealth } = useHealth(activeProject?.path)

  // Guardrail events history (Task 8.5)
  const [guardrailEvents, setGuardrailEvents] = useState<GuardrailEvent[]>([])

  // 2-Agent Role state (Task 9.1)
  const [agentRole, setAgentRole] = useState<AgentRole>('impl')

  // Calculate handoff status from plans (Task 9.2)
  const handoffStatus = useMemo<HandoffStatus>(() => {
    if (!plans || workflowMode !== '2agent') {
      return { state: 'idle', pmWaitingCount: 0, implWaitingCount: 0, inProgressCount: 0 }
    }

    // Count tasks in each state
    // pm:依頼中 tasks are in plan column (waiting for impl to start)
    const implWaitingCount = plans.plan.filter(t =>
      t.source?.marker?.includes('依頼中')
    ).length

    // cc:完了 tasks in review column are waiting for PM
    const pmWaitingCount = plans.review.length

    // cc:WIP tasks are in progress
    const inProgressCount = plans.work.length

    // Determine overall handoff state
    let state: HandoffStatus['state'] = 'idle'
    if (pmWaitingCount > 0) {
      state = 'pm_waiting' // PM needs to review
    } else if (implWaitingCount > 0) {
      state = 'impl_waiting' // Impl needs to start/continue work
    }

    return { state, pmWaitingCount, implWaitingCount, inProgressCount }
  }, [plans, workflowMode])

  // Skill suggestion state (Task 8.3)
  const [skillSuggestions, setSkillSuggestions] = useState<Array<{ name: string; description: string }>>([])
  const suggestionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Command builder state
  const [prompt, setPrompt] = useState('')
  const [selectedCommand, setSelectedCommand] = useState<Command | null>(null)
  const [commands, setCommands] = useState<Command[]>([])
  const [commandFilter, setCommandFilter] = useState('')
  const [showCommandPicker, setShowCommandPicker] = useState(false)

  // Execution state
  const [isExecuting, setIsExecuting] = useState(false)
  const [currentSession, setCurrentSession] = useState<AgentSession | null>(null)
  const [messages, setMessages] = useState<AgentMessage[]>([])
  const [sdkAvailable, setSdkAvailable] = useState<boolean | null>(null)

  // Tool approval state
  const [pendingApproval, setPendingApproval] = useState<ToolApprovalRequest | null>(null)
  const [pendingQuestion, setPendingQuestion] = useState<AskUserQuestionRequest | null>(null)
  const [questionAnswers, setQuestionAnswers] = useState<Record<string, string>>({})
  const wsRef = useRef<WebSocket | null>(null)

  // History state
  const [sessions, setSessions] = useState<AgentSession[]>([])

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const promptInputRef = useRef<HTMLTextAreaElement>(null)

  // Note: WebSocket connection is now handled by connectAndRegister in handleExecute

  // Handle tool approval decision (Task 8.5: track guardrail events)
  const handleApprovalDecision = useCallback((decision: 'allow' | 'deny', reason?: string) => {
    if (!pendingApproval || !wsRef.current) return

    // Track guardrail event (Task 8.5)
    const event: GuardrailEvent = {
      id: `guardrail-${Date.now()}`,
      type: decision === 'allow' ? 'approved' : 'denied',
      toolName: pendingApproval.toolName,
      toolInput: pendingApproval.toolInput,
      timestamp: new Date().toISOString(),
      reason,
    }
    setGuardrailEvents((prev) => [event, ...prev].slice(0, 50)) // Keep last 50 events

    wsRef.current.send(JSON.stringify({
      type: 'tool_approval_response',
      sessionId: pendingApproval.sessionId,
      toolUseId: pendingApproval.toolUseId,
      decision,
      reason,
    }))

    setPendingApproval(null)
  }, [pendingApproval])

  // Fetch SSOT data when tab is active (Task 8.4)
  const loadSSOT = useCallback(async () => {
    setSsotLoading(true)
    try {
      const keywords = ssotKeywords.trim() ? ssotKeywords.split(/[,\s]+/).filter(k => k) : []
      const data = await fetchSSOT(activeProject?.path, keywords)
      setSsot(data)
    } catch (error) {
      console.error('SSOT fetch failed:', error)
      setSsot({ available: false, decisions: { found: false, content: null, path: null }, patterns: { found: false, content: null, path: null }, error: 'SSOT の読み取りに失敗しました' })
    } finally {
      setSsotLoading(false)
    }
  }, [activeProject?.path, ssotKeywords])

  // Load SSOT when tab becomes active
  useEffect(() => {
    if (sidebarTab === 'ssot' && !ssot && !ssotLoading) {
      loadSSOT()
    }
  }, [sidebarTab, ssot, ssotLoading, loadSSOT])

  // Track approval request as guardrail event (Task 8.5)
  useEffect(() => {
    if (pendingApproval) {
      const event: GuardrailEvent = {
        id: `guardrail-req-${Date.now()}`,
        type: 'approval_request',
        toolName: pendingApproval.toolName,
        toolInput: pendingApproval.toolInput,
        timestamp: new Date().toISOString(),
      }
      setGuardrailEvents((prev) => {
        // Avoid duplicates
        if (prev.some(e => e.toolName === event.toolName && e.type === 'approval_request' && Date.now() - new Date(e.timestamp).getTime() < 1000)) {
          return prev
        }
        return [event, ...prev].slice(0, 50)
      })
    }
  }, [pendingApproval])

  // Handle question answer submission
  const handleQuestionSubmit = useCallback(() => {
    if (!pendingQuestion || !wsRef.current) return

    wsRef.current.send(JSON.stringify({
      type: 'tool_approval_response',
      sessionId: pendingQuestion.sessionId,
      toolUseId: pendingQuestion.toolUseId,
      decision: 'allow',
      modifiedInput: { answers: questionAnswers },
    }))

    setPendingQuestion(null)
    setQuestionAnswers({})
  }, [pendingQuestion, questionAnswers])

  // Handle question option selection
  const handleOptionSelect = useCallback((questionIndex: number, optionLabel: string) => {
    if (!pendingQuestion) return
    const header = pendingQuestion.questions[questionIndex]?.header ?? `q${questionIndex}`
    setQuestionAnswers((prev) => ({
      ...prev,
      [header]: optionLabel,
    }))
  }, [pendingQuestion])

  // Handle task selection - generate prompt template with guardrails
  const handleTaskSelect = useCallback((task: Task) => {
    // Safe execution template that prevents runaway behavior and aligns with harness philosophy:
    // 1. Scope limitation: Only this specific task
    // 2. Plans.md protection: State updates via UI API only
    // 3. Confirmation before changes: Propose changes before applying
    // 4. Clear acceptance criteria and verification
    // 5. Evidence requirements for completion
    const template = `【タスク実行リクエスト】

■ タスク: ${task.title}

■ 禁止事項:
- Plans.md は直接編集しない（状態更新はUIのマーカー更新で行う）
- 指定タスク以外のファイル変更は事前確認なしに行わない

■ 実行手順:
1. 変更対象ファイル・理由・差分方針を先に提示し、承認を取る
2. 承認後、変更を実施
3. 検証コマンド（例: bun test, bun run typecheck）を実行
4. 完了報告を出す

■ 受入条件:
- typecheck が通ること
- 既存テストが壊れないこと
- 新規機能にはテストを追加すること（可能な場合）

■ 完了時の証跡（必須）:
- 変更点サマリ（どのファイルを何のために変更したか）
- 実行したコマンドと結果
- 未解決の課題があれば明記

上記のタスクを実行してください。`
    setPrompt(template)
    promptInputRef.current?.focus()
  }, [])

  // Handle task completion - update marker with state transition validation
  const handleTaskCompletion = useCallback(async (task: Task, newMarker: string) => {
    if (!task.source || isUpdatingTask) return

    setIsUpdatingTask(true)
    setTaskUpdateError(null)

    try {
      // Pass workflowMode and actorRole for state transition validation
      // In 2-agent mode, these are required for proper validation
      await updateTaskMarker(
        task.source.lineNumber,
        task.source.originalLine,
        task.source.marker ?? 'cc:WIP',
        newMarker,
        activeProject?.path,
        workflowMode,
        agentRole
      )

      // Refresh plans data after successful update
      await refreshPlans()
      setCompletionTask(null)
    } catch (error) {
      if ((error as Error & { conflict?: TaskConflictError }).conflict) {
        const conflictError = (error as Error & { conflict: TaskConflictError }).conflict
        setTaskUpdateError(`${conflictError.error}\n${conflictError.suggestion}`)
      } else if ((error as Error & { invalidTransition?: boolean }).invalidTransition) {
        // Handle 422 invalid state transition error
        setTaskUpdateError(`状態遷移エラー: ${(error as Error).message}`)
      } else {
        setTaskUpdateError(error instanceof Error ? error.message : '更新に失敗しました')
      }
    } finally {
      setIsUpdatingTask(false)
    }
  }, [activeProject?.path, isUpdatingTask, refreshPlans, workflowMode, agentRole])

  // Show completion dialog when execution completes (Task 8.1 修正: 先頭固定→ユーザー選択)
  useEffect(() => {
    if (currentSession?.status === 'completed' && plans?.work && plans.work.length > 0) {
      // Show dialog for user to select which task to mark as complete
      // Do NOT auto-select - let user choose explicitly
      setShowCompletionDialog(true)
      setCompletionTask(null) // Reset selection
    }
  }, [currentSession?.status, plans?.work])

  // Skill suggestion keywords mapping (Task 8.3)
  const skillKeywords = useMemo(() => [
    { name: '/work', keywords: ['実装', '作業', 'タスク', '開始', 'work', 'task'], description: 'タスクを実行' },
    { name: '/harness-review', keywords: ['レビュー', 'チェック', '確認', 'review'], description: 'コードレビュー' },
    { name: '/plan-with-agent', keywords: ['計画', 'プラン', '設計', 'plan'], description: '実装計画を作成' },
    { name: '/sync-status', keywords: ['状態', 'ステータス', '同期', 'status', 'sync'], description: '状態を同期' },
    { name: '/harness-init', keywords: ['初期化', 'セットアップ', 'init', 'setup'], description: 'プロジェクト初期化' },
    { name: '/handoff-to-cursor', keywords: ['報告', 'ハンドオフ', 'cursor', 'handoff'], description: 'PM報告生成' },
  ], [])

  // Calculate suggestions based on prompt and phase (Task 8.3)
  const calculateSuggestions = useCallback((input: string) => {
    if (!input.trim() || input.startsWith('/')) {
      setSkillSuggestions([])
      return
    }

    const lowerInput = input.toLowerCase()
    const matches: Array<{ name: string; description: string; score: number }> = []

    for (const skill of skillKeywords) {
      let score = 0
      for (const keyword of skill.keywords) {
        if (lowerInput.includes(keyword.toLowerCase())) {
          score += 1
        }
      }
      if (score > 0) {
        matches.push({ name: skill.name, description: skill.description, score })
      }
    }

    // Add phase-based suggestions
    if (plans) {
      if (plans.work.length > 0 && !matches.some((m) => m.name === '/work')) {
        matches.push({ name: '/work', description: 'WIPタスクを続行', score: 0.5 })
      }
      if (plans.plan.length > 0 && plans.work.length === 0 && !matches.some((m) => m.name === '/work')) {
        matches.push({ name: '/work', description: 'Planからタスクを開始', score: 0.5 })
      }
      if (workflowMode === '2agent' && plans.review.length > 0 && !matches.some((m) => m.name === '/harness-review')) {
        matches.push({ name: '/harness-review', description: 'レビュー待ちを処理', score: 0.5 })
      }
    }

    // Sort by score and take top 3
    matches.sort((a, b) => b.score - a.score)
    setSkillSuggestions(matches.slice(0, 3).map(({ name, description }) => ({ name, description })))
  }, [skillKeywords, plans, workflowMode])

  // Debounced skill suggestion (300ms) - Task 8.3
  useEffect(() => {
    if (suggestionTimeoutRef.current) {
      clearTimeout(suggestionTimeoutRef.current)
    }

    suggestionTimeoutRef.current = setTimeout(() => {
      calculateSuggestions(prompt)
    }, 300)

    return () => {
      if (suggestionTimeoutRef.current) {
        clearTimeout(suggestionTimeoutRef.current)
      }
    }
  }, [prompt, calculateSuggestions])

  // Insert skill into prompt
  const handleSkillSuggestionClick = useCallback((skillName: string) => {
    setPrompt(skillName + ' ')
    setSkillSuggestions([])
    promptInputRef.current?.focus()
  }, [])

  // Check SDK availability on mount
  useEffect(() => {
    checkSdkStatus()
    loadCommands()

    // Cleanup WebSocket on unmount
    return () => {
      wsRef.current?.close()
    }
  }, [])

  // Load sessions when history tab is active
  useEffect(() => {
    if (activeTab === 'history') {
      loadSessions()
    }
  }, [activeTab])

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Notify parent of session changes
  useEffect(() => {
    onSessionChange?.(currentSession)
  }, [currentSession, onSessionChange])

  async function checkSdkStatus() {
    try {
      const res = await fetch(`${API_BASE}/agent/status`)
      const data = await res.json()
      setSdkAvailable(data.available)
    } catch {
      setSdkAvailable(false)
    }
  }

  async function loadCommands() {
    try {
      const res = await fetch(`${API_BASE}/commands`)
      const data = await res.json()
      setCommands(data.commands || [])
    } catch (error) {
      console.error('Failed to load commands:', error)
    }
  }

  async function loadSessions() {
    try {
      const res = await fetch(`${API_BASE}/agent/sessions`)
      const data = await res.json()
      setSessions(data.sessions || [])
    } catch (error) {
      console.error('Failed to load sessions:', error)
    }
  }

  function handleCommandSelect(command: Command) {
    setSelectedCommand(command)
    // Insert command into prompt
    const commandText = `/${command.name}`
    setPrompt((prev) => {
      if (prev.startsWith('/')) {
        // Replace existing command
        return commandText + ' ' + prev.replace(/^\/\S*\s*/, '')
      }
      return commandText + ' ' + prev
    })
    setShowCommandPicker(false)
    promptInputRef.current?.focus()
  }

  // Known command names for slash conversion (Task 7.2)
  const knownCommandNames = useMemo(() => commands.map(cmd => cmd.name), [commands])

  // Generate session ID on client side for proper WebSocket registration timing
  function generateSessionId(): string {
    return `agent-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
  }

  // Pending registration callbacks (to handle already-connected case)
  const pendingRegistrations = useRef<Map<string, { resolve: () => void; reject: (e: Error) => void }>>(new Map())

  // Connect WebSocket and wait for registration confirmation
  function connectAndRegister(sessionId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        pendingRegistrations.current.delete(sessionId)
        reject(new Error('WebSocket registration timeout'))
      }, 5000)

      // Store the pending registration callback
      pendingRegistrations.current.set(sessionId, {
        resolve: () => {
          clearTimeout(timeout)
          pendingRegistrations.current.delete(sessionId)
          resolve()
        },
        reject: (e: Error) => {
          clearTimeout(timeout)
          pendingRegistrations.current.delete(sessionId)
          reject(e)
        }
      })

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        // Already connected - send register and wait for registered response
        console.log('[WS] Already connected, registering session:', sessionId)
        wsRef.current.send(JSON.stringify({ type: 'register_session', sessionId }))
        // Don't resolve here - wait for 'registered' message in onmessage handler
        return
      }

      const ws = new WebSocket(WS_URL)
      wsRef.current = ws

      ws.onopen = () => {
        console.log('[WS] Connected')
        ws.send(JSON.stringify({ type: 'register_session', sessionId }))
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          // Wait for registration confirmation before resolving
          if (data.type === 'registered') {
            const pending = pendingRegistrations.current.get(data.sessionId)
            if (pending) {
              console.log('[WS] Registration confirmed for session:', data.sessionId)
              pending.resolve()
            }
          }
          if (data.type === 'tool_approval_request') {
            setPendingApproval(data as ToolApprovalRequest)
          }
          if (data.type === 'ask_user_question') {
            setPendingQuestion(data as AskUserQuestionRequest)
            setQuestionAnswers({})
          }
          if (data.type === 'agent_message') {
            const msgEvent = data as AgentMessageEvent
            setMessages((prev) => {
              if (prev.some((m) => m.id === msgEvent.message.id)) {
                return prev
              }
              return [...prev, msgEvent.message]
            })
          }
        } catch (e) {
          console.error('[WS] Parse error:', e)
        }
      }

      ws.onclose = () => {
        console.log('[WS] Disconnected')
        wsRef.current = null
        // Reject any pending registrations
        for (const [, pending] of pendingRegistrations.current) {
          pending.reject(new Error('WebSocket disconnected'))
        }
        pendingRegistrations.current.clear()
      }

      ws.onerror = (e) => {
        console.error('[WS] Error:', e)
        // Reject any pending registrations
        for (const [, pending] of pendingRegistrations.current) {
          pending.reject(new Error('WebSocket connection failed'))
        }
        pendingRegistrations.current.clear()
      }
    })
  }

  async function handleExecute() {
    if (!prompt.trim() || isExecuting) return

    setIsExecuting(true)
    setMessages([])

    // Generate sessionId on client side
    const sessionId = generateSessionId()

    // Convert slash commands to natural language
    const convertedPrompt = convertSlashCommand(prompt, knownCommandNames)

    try {
      // Step 1: Connect WebSocket and wait for registration FIRST
      await connectAndRegister(sessionId)
      console.log('[Execute] WebSocket registered, starting execution')

      // Step 2: Set current session for UI state
      setCurrentSession({
        id: sessionId,
        status: 'running',
        startedAt: new Date().toISOString(),
        prompt: prompt.trim(),
        workingDirectory: activeProject?.path,
        messages: [],
      })

      // Step 3: Now call execute with the pre-registered sessionId
      const request: AgentExecuteRequest = {
        prompt: convertedPrompt,
        workingDirectory: activeProject?.path,
        sessionId, // Pass the pre-generated sessionId
        // Use acceptEdits to auto-approve file operations (Write, Edit)
        // Our canUseTool callback handles AskUserQuestion and other tool approvals
        permissionMode: 'acceptEdits',
      }

      const res = await fetch(`${API_BASE}/agent/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      })

      const data = await res.json()

      if (res.ok) {
        // Watch for session completion
        watchSessionCompletion(sessionId)
      } else {
        addMessage('error', data.error || 'Execution failed')
        setIsExecuting(false)
      }
    } catch (error) {
      addMessage('error', error instanceof Error ? error.message : 'Network error')
      setIsExecuting(false)
    }
  }

  // Watch for session completion (status only, messages come via WebSocket)
  async function watchSessionCompletion(sessionId: string) {
    const maxAttempts = 300 // 5 minutes max
    let attempts = 0

    while (attempts < maxAttempts) {
      try {
        const res = await fetch(`${API_BASE}/agent/session/${sessionId}`)
        const data = await res.json()

        if (data.session) {
          // Only update status, not messages (messages come via WebSocket)
          setCurrentSession((prev) => ({
            ...prev,
            ...data.session,
            messages: prev?.messages ?? data.session.messages,
          }))

          if (data.session.status !== 'running') {
            setIsExecuting(false)
            break
          }
        }
      } catch (error) {
        console.error('Watch error:', error)
      }

      await new Promise((resolve) => setTimeout(resolve, 1000))
      attempts++
    }

    if (attempts >= maxAttempts) {
      setIsExecuting(false)
    }
  }

  async function pollSession(sessionId: string) {
    const maxAttempts = 60
    let attempts = 0

    while (attempts < maxAttempts) {
      try {
        const res = await fetch(`${API_BASE}/agent/session/${sessionId}`)
        const data = await res.json()

        if (data.session) {
          setCurrentSession(data.session)
          setMessages(data.session.messages || [])

          if (data.session.status !== 'running') {
            break
          }
        }
      } catch (error) {
        console.error('Poll error:', error)
      }

      await new Promise((resolve) => setTimeout(resolve, 1000))
      attempts++
    }
  }

  async function handleInterrupt() {
    if (!currentSession) return

    try {
      await fetch(`${API_BASE}/agent/interrupt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: currentSession.id }),
      })
    } catch (error) {
      console.error('Interrupt failed:', error)
    }
  }

  /**
   * Continue an existing session with a new prompt (multi-turn conversation)
   */
  async function handleContinue() {
    if (!prompt.trim() || isExecuting || !currentSession) return

    setIsExecuting(true)

    // Convert slash commands to natural language
    const convertedPrompt = convertSlashCommand(prompt, knownCommandNames)

    try {
      const res = await fetch(`${API_BASE}/agent/continue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: currentSession.id,
          prompt: convertedPrompt,
        }),
      })

      const data = await res.json()

      if (res.ok && data.sessionId) {
        // Poll for session updates
        await pollSession(data.sessionId)
        setPrompt('') // Clear prompt after successful continuation
      } else {
        addMessage('error', data.error || 'Continuation failed')
      }
    } catch (error) {
      addMessage('error', error instanceof Error ? error.message : 'Network error')
    } finally {
      setIsExecuting(false)
    }
  }

  /**
   * Clear current session to start fresh
   */
  function handleNewConversation() {
    setCurrentSession(null)
    setMessages([])
    setPrompt('')
    setSelectedCommand(null)
  }

  function addMessage(type: AgentMessage['type'], content: string) {
    const message: AgentMessage = {
      id: `msg-${Date.now()}`,
      type,
      content,
      timestamp: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, message])
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    // Cmd/Ctrl + Enter to execute or continue
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      // If there's an active completed/error session, continue it
      if (currentSession && currentSession.status !== 'running') {
        handleContinue()
      } else {
        handleExecute()
      }
    }
    // "/" to open command picker
    if (e.key === '/' && prompt === '') {
      setShowCommandPicker(true)
    }
    // Escape to clear session
    if (e.key === 'Escape' && currentSession) {
      handleNewConversation()
    }
  }

  // Filter commands based on search
  const filteredCommands = commands.filter(
    (cmd) =>
      cmd.name.toLowerCase().includes(commandFilter.toLowerCase()) ||
      cmd.description.toLowerCase().includes(commandFilter.toLowerCase())
  )

  // Group commands by category
  const groupedCommands = filteredCommands.reduce(
    (acc, cmd) => {
      const category = cmd.category || 'other'
      if (!acc[category]) acc[category] = []
      acc[category].push(cmd)
      return acc
    },
    {} as Record<string, Command[]>
  )

  if (sdkAvailable === false) {
    return (
      <div className="agent-console">
        <div className="agent-unavailable">
          <span className="agent-unavailable-icon">⚠️</span>
          <h3>Agent SDK Unavailable</h3>
          <p>Claude Agent SDK is not properly configured.</p>
          <p className="text-muted-foreground">
            Make sure <code>ANTHROPIC_API_KEY</code> is set in your environment.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="agent-console">
      {/* Tabs */}
      <div className="agent-tabs">
        <button
          className={`agent-tab ${activeTab === 'execute' ? 'active' : ''}`}
          onClick={() => setActiveTab('execute')}
        >
          <span>🚀</span>
          <span>Execute</span>
        </button>
        <button
          className={`agent-tab ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          <span>📜</span>
          <span>History</span>
          {sessions.length > 0 && (
            <span className="agent-tab-badge">{sessions.length}</span>
          )}
        </button>
      </div>

      {activeTab === 'execute' ? (
        <div className="agent-execute-layout">
          {/* Main Content Area */}
          <div className="agent-execute">
          {/* Plans Panel - Compact WIP/Phase Display */}
          {showPlansPanel && !plansLoading && plans && (
            <div className="agent-plans-panel">
              {/* Step Indicator - Task 8.2 */}
              <div className="agent-step-indicator">
                <div className="step-progress">
                  <div className={`step-item ${plans.plan.length > 0 && plans.work.length === 0 ? 'step-current' : plans.plan.length > 0 ? 'step-done' : ''}`}>
                    <div className="step-circle">1</div>
                    <div className="step-label">Plan</div>
                    <div className="step-count">{plans.plan.length}</div>
                  </div>
                  <div className="step-connector" />
                  <div className={`step-item ${plans.work.length > 0 ? 'step-current' : ''}`}>
                    <div className="step-circle">2</div>
                    <div className="step-label">Work</div>
                    <div className="step-count">{plans.work.length}</div>
                  </div>
                  <div className="step-connector" />
                  {workflowMode === '2agent' ? (
                    <>
                      <div className={`step-item ${plans.review.length > 0 && plans.work.length === 0 ? 'step-current' : ''}`}>
                        <div className="step-circle">3</div>
                        <div className="step-label">Review</div>
                        <div className="step-count">{plans.review.length}</div>
                      </div>
                      <div className="step-connector" />
                      <div className="step-item">
                        <div className="step-circle">✓</div>
                        <div className="step-label">Done</div>
                        <div className="step-count">{plans.done.length}</div>
                      </div>
                    </>
                  ) : (
                    <div className="step-item">
                      <div className="step-circle">✓</div>
                      <div className="step-label">Done</div>
                      <div className="step-count">{plans.done.length}</div>
                    </div>
                  )}
                </div>
                {/* Recommended Action */}
                <div className="step-action">
                  <span className="step-action-icon">💡</span>
                  <span className="step-action-text">
                    {plans.work.length > 0
                      ? '作業を続けましょう'
                      : workflowMode === '2agent' && plans.review.length > 0
                        ? 'レビューを実行しましょう'
                        : plans.plan.length > 0
                          ? 'タスクを開始しましょう'
                          : 'すべてのタスクが完了しています'}
                  </span>
                </div>
              </div>

              <div className="agent-plans-header">
                <div className="agent-plans-title">
                  <span className="agent-plans-icon">📋</span>
                  <span>タスク一覧</span>
                </div>
                <button
                  className="agent-plans-toggle"
                  onClick={() => setShowPlansPanel(false)}
                  title="パネルを閉じる"
                >
                  ✕
                </button>
              </div>

              {/* WIP Tasks List */}
              {plans.work.length > 0 && (
                <div className="agent-wip-tasks">
                  <div className="agent-wip-label">🔥 作業中</div>
                  {plans.work.slice(0, 3).map((task) => (
                    <button
                      key={task.id}
                      className="agent-wip-task"
                      onClick={() => handleTaskSelect(task)}
                      title="クリックでプロンプトに挿入"
                    >
                      <span className="agent-wip-task-title">{task.title}</span>
                      {task.priority === 'high' && <span className="agent-wip-priority">🔴</span>}
                    </button>
                  ))}
                  {plans.work.length > 3 && (
                    <div className="agent-wip-more">+{plans.work.length - 3} more</div>
                  )}
                </div>
              )}

              {/* Plan Tasks (if no WIP) */}
              {plans.work.length === 0 && plans.plan.length > 0 && (
                <div className="agent-plan-tasks">
                  <div className="agent-plan-label">📝 次のタスク</div>
                  {plans.plan.slice(0, 2).map((task) => (
                    <button
                      key={task.id}
                      className="agent-plan-task"
                      onClick={() => handleTaskSelect(task)}
                      title="クリックでプロンプトに挿入"
                    >
                      <span className="agent-plan-task-title">{task.title}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Mode Switch */}
              <div className="agent-mode-switch">
                <button
                  className={`agent-mode-btn ${workflowMode === 'solo' ? 'active' : ''}`}
                  onClick={() => setWorkflowMode('solo')}
                >
                  Solo
                </button>
                <button
                  className={`agent-mode-btn ${workflowMode === '2agent' ? 'active' : ''}`}
                  onClick={() => setWorkflowMode('2agent')}
                >
                  2-Agent
                </button>
              </div>
            </div>
          )}

          {/* Collapsed Plans Toggle */}
          {!showPlansPanel && !plansLoading && plans && (
            <button
              className="agent-plans-collapsed"
              onClick={() => setShowPlansPanel(true)}
              title="Plans パネルを開く"
            >
              <span>📋</span>
              <span>Work: {plans.work.length}</span>
              <span>Plan: {plans.plan.length}</span>
            </button>
          )}

          {/* Command Builder */}
          <div className="agent-command-builder">
            <div className="agent-input-container">
              <div className="agent-input-header">
                <span className="agent-input-label">Prompt</span>
                {selectedCommand && (
                  <span className="agent-selected-command">
                    /{selectedCommand.name}
                  </span>
                )}
              </div>

              <div className="agent-input-wrapper">
                <button
                  className="agent-command-trigger"
                  onClick={() => setShowCommandPicker(!showCommandPicker)}
                  title="Select command (or press /)"
                >
                  <span>/</span>
                </button>
                <textarea
                  ref={promptInputRef}
                  className="agent-prompt-input"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your prompt or press / to select a command..."
                  rows={3}
                  disabled={isExecuting}
                />
              </div>

              {/* Skill Suggestions - Task 8.3 */}
              {skillSuggestions.length > 0 && (
                <div className="agent-skill-suggestions">
                  <span className="skill-suggestions-label">💡 推奨:</span>
                  {skillSuggestions.map((skill) => (
                    <button
                      key={skill.name}
                      className="skill-suggestion-btn"
                      onClick={() => handleSkillSuggestionClick(skill.name)}
                      title={skill.description}
                    >
                      <span className="skill-suggestion-name">{skill.name}</span>
                      <span className="skill-suggestion-desc">{skill.description}</span>
                    </button>
                  ))}
                </div>
              )}

              <div className="agent-input-actions">
                <span className="agent-input-hint">
                  <kbd>⌘</kbd> + <kbd>Enter</kbd> to {currentSession ? 'continue' : 'execute'}
                  {currentSession && <> | <kbd>Esc</kbd> to clear</>}
                </span>
                <div className="agent-action-buttons">
                  {currentSession && currentSession.status !== 'running' && (
                    <button
                      className="agent-new-btn"
                      onClick={handleNewConversation}
                      disabled={isExecuting}
                      title="Start new conversation"
                    >
                      <span>✨</span>
                      <span>New</span>
                    </button>
                  )}
                  <button
                    className="agent-execute-btn"
                    onClick={currentSession && currentSession.status !== 'running' ? handleContinue : handleExecute}
                    disabled={!prompt.trim() || isExecuting}
                  >
                    {isExecuting ? (
                      <>
                        <span className="agent-spinner" />
                        <span>Executing...</span>
                      </>
                    ) : currentSession && currentSession.status !== 'running' ? (
                      <>
                        <span>💬</span>
                        <span>Continue</span>
                      </>
                    ) : (
                      <>
                        <span>▶</span>
                        <span>Execute</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Command Picker */}
            {showCommandPicker && (
              <div className="agent-command-picker">
                <input
                  type="text"
                  className="agent-command-search"
                  placeholder="Search commands..."
                  value={commandFilter}
                  onChange={(e) => setCommandFilter(e.target.value)}
                  autoFocus
                />
                <div className="agent-command-list">
                  {Object.entries(groupedCommands).map(([category, cmds]) => (
                    <div key={category} className="agent-command-group">
                      <div className="agent-command-category">{category}</div>
                      {cmds.map((cmd) => (
                        <button
                          key={cmd.name}
                          className="agent-command-item"
                          onClick={() => handleCommandSelect(cmd)}
                        >
                          <span className="agent-command-name">/{cmd.name}</span>
                          <span className="agent-command-desc">
                            {cmd.description}
                          </span>
                        </button>
                      ))}
                    </div>
                  ))}
                  {filteredCommands.length === 0 && (
                    <div className="agent-command-empty">
                      No commands found
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Execution Status */}
          <div className="agent-execution">
            <div className="agent-execution-header">
              <span className="agent-execution-title">Execution Output</span>
              {isExecuting && (
                <button
                  className="agent-interrupt-btn"
                  onClick={handleInterrupt}
                >
                  <span>⏹</span>
                  <span>Stop</span>
                </button>
              )}
            </div>

            <div className="agent-messages">
              {isExecuting && (
                <div className="agent-streaming-indicator">
                  <span className="agent-streaming-dot"></span>
                  <span className="agent-streaming-dot"></span>
                  <span className="agent-streaming-dot"></span>
                  <span>Processing...</span>
                </div>
              )}
              {messages.length === 0 && !isExecuting ? (
                <div className="agent-messages-empty">
                  <span>💬</span>
                  <p>No messages yet. Execute a prompt to see output here.</p>
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`agent-message agent-message-${msg.type}`}
                  >
                    <div className="agent-message-header">
                      <span className="agent-message-type">
                        {getMessageIcon(msg.type)}
                      </span>
                      <span className="agent-message-type-label">
                        {getMessageTypeLabel(msg.type)}
                      </span>
                      <span className="agent-message-time">
                        {new Date(msg.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="agent-message-content">
                      {msg.type === 'tool_use' && msg.toolName && (
                        <div className="agent-tool-info">
                          <span className="agent-tool-name">{msg.toolName}</span>
                          {msg.toolInput !== undefined && msg.toolInput !== null && (
                            <details className="agent-tool-details">
                              <summary>Input</summary>
                              <pre>{typeof msg.toolInput === 'string' ? msg.toolInput : JSON.stringify(msg.toolInput, null, 2)}</pre>
                            </details>
                          )}
                        </div>
                      )}
                      {msg.type === 'tool_result' && msg.toolName && (
                        <div className="agent-tool-info">
                          <span className="agent-tool-result-name">{msg.toolName}</span>
                        </div>
                      )}
                      {msg.content && (
                        <details className="agent-message-details" open={msg.content.length < 500}>
                          <summary>{msg.content.length > 500 ? `${msg.content.length} characters (click to expand)` : ''}</summary>
                          <pre>{msg.content}</pre>
                        </details>
                      )}
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>
        </div>
          {/* Right Sidebar - Task 8.4-8.6 */}
          {showRightSidebar && (
            <div className="agent-right-sidebar">
              {/* Sidebar Tabs */}
              <div className="sidebar-tabs">
                <button
                  className={`sidebar-tab ${sidebarTab === 'plans' ? 'active' : ''}`}
                  onClick={() => setSidebarTab('plans')}
                  title="タスク一覧"
                >
                  📋
                </button>
                <button
                  className={`sidebar-tab ${sidebarTab === 'ssot' ? 'active' : ''}`}
                  onClick={() => setSidebarTab('ssot')}
                  title="SSOT (decisions/patterns)"
                >
                  📚
                </button>
                <button
                  className={`sidebar-tab ${sidebarTab === 'health' ? 'active' : ''}`}
                  onClick={() => setSidebarTab('health')}
                  title="Health Score"
                >
                  💊
                </button>
                <button
                  className={`sidebar-tab ${sidebarTab === 'guardrail' ? 'active' : ''}`}
                  onClick={() => setSidebarTab('guardrail')}
                  title="ガードレール履歴"
                >
                  🛡️
                  {guardrailEvents.length > 0 && (
                    <span className="sidebar-tab-badge">{guardrailEvents.length}</span>
                  )}
                </button>
              </div>

              {/* Sidebar Content */}
              <div className="sidebar-content">
                {/* Plans Tab */}
                {sidebarTab === 'plans' && (
                  <div className="sidebar-plans">
                    <div className="sidebar-section-header">
                      <span>📋 タスク一覧</span>
                      <button onClick={refreshPlans} className="sidebar-refresh-btn" title="更新">🔄</button>
                    </div>

                    {/* Workflow Mode Switch */}
                    <div className="sidebar-mode-switch">
                      <button className={`sidebar-mode-btn ${workflowMode === 'solo' ? 'active' : ''}`} onClick={() => setWorkflowMode('solo')}>Solo</button>
                      <button className={`sidebar-mode-btn ${workflowMode === '2agent' ? 'active' : ''}`} onClick={() => setWorkflowMode('2agent')}>2-Agent</button>
                    </div>

                    {/* 2-Agent Role Toggle - Task 9.1 */}
                    {workflowMode === '2agent' && (
                      <div className="agent-role-toggle">
                        <div className="role-toggle-label">あなたの役割:</div>
                        <div className="role-toggle-buttons">
                          <button
                            className={`role-btn ${agentRole === 'pm' ? 'active role-pm' : ''}`}
                            onClick={() => setAgentRole('pm')}
                          >
                            🎯 PM
                          </button>
                          <button
                            className={`role-btn ${agentRole === 'impl' ? 'active role-impl' : ''}`}
                            onClick={() => setAgentRole('impl')}
                          >
                            💻 Impl
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Handoff Status Indicator - Task 9.2 */}
                    {workflowMode === '2agent' && (
                      <div className={`handoff-status handoff-${handoffStatus.state}`}>
                        <div className="handoff-status-header">
                          <span className="handoff-status-icon">
                            {handoffStatus.state === 'pm_waiting' ? '👀' :
                             handoffStatus.state === 'impl_waiting' ? '💻' : '✅'}
                          </span>
                          <span className="handoff-status-text">
                            {handoffStatus.state === 'pm_waiting' ? 'PM待ち' :
                             handoffStatus.state === 'impl_waiting' ? 'Impl待ち' : 'すべて完了'}
                          </span>
                        </div>
                        <div className="handoff-status-counts">
                          {handoffStatus.pmWaitingCount > 0 && (
                            <span className="handoff-count pm-count" title="PM確認待ち">👀 {handoffStatus.pmWaitingCount}</span>
                          )}
                          {handoffStatus.implWaitingCount > 0 && (
                            <span className="handoff-count impl-count" title="実装依頼">💻 {handoffStatus.implWaitingCount}</span>
                          )}
                          {handoffStatus.inProgressCount > 0 && (
                            <span className="handoff-count wip-count" title="作業中">🔥 {handoffStatus.inProgressCount}</span>
                          )}
                        </div>
                        {/* Role-specific recommended action */}
                        <div className="handoff-action">
                          {agentRole === 'pm' && handoffStatus.state === 'pm_waiting' && (
                            <span className="handoff-action-text">💡 レビュータスクを確認してください</span>
                          )}
                          {agentRole === 'pm' && handoffStatus.state === 'impl_waiting' && (
                            <span className="handoff-action-text">⏳ 実装の完了を待っています</span>
                          )}
                          {agentRole === 'impl' && handoffStatus.state === 'impl_waiting' && (
                            <span className="handoff-action-text">💡 依頼されたタスクを開始してください</span>
                          )}
                          {agentRole === 'impl' && handoffStatus.state === 'pm_waiting' && (
                            <span className="handoff-action-text">⏳ PMのレビューを待っています</span>
                          )}
                          {handoffStatus.state === 'idle' && (
                            <span className="handoff-action-text">✨ 待機中のタスクはありません</span>
                          )}
                        </div>
                      </div>
                    )}

                    {plansLoading ? (
                      <div className="sidebar-loading">読み込み中...</div>
                    ) : plans ? (
                      <>
                        {/* Show tasks based on role in 2-agent mode */}
                        {workflowMode === '2agent' && agentRole === 'pm' && plans.review.length > 0 && (
                          <div className="sidebar-task-group role-highlight">
                            <div className="sidebar-task-label">👀 レビュー待ち ({plans.review.length})</div>
                            {plans.review.map((task) => (
                              <div key={task.id} className="sidebar-task-with-action">
                                <button className="sidebar-task-item" onClick={() => handleTaskSelect(task)}>
                                  <span className="sidebar-task-title">{task.title}</span>
                                </button>
                                {task.source && (
                                  <button
                                    className="handoff-btn approve-btn"
                                    onClick={() => handleTaskCompletion(task, 'pm:確認済')}
                                    disabled={isUpdatingTask}
                                    title="承認して完了"
                                  >
                                    ✓
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {workflowMode === '2agent' && agentRole === 'impl' && plans.plan.filter(t => t.source?.marker?.includes('依頼中')).length > 0 && (
                          <div className="sidebar-task-group role-highlight">
                            <div className="sidebar-task-label">📥 依頼タスク</div>
                            {plans.plan.filter(t => t.source?.marker?.includes('依頼中')).map((task) => (
                              <div key={task.id} className="sidebar-task-with-action">
                                <button className="sidebar-task-item" onClick={() => handleTaskSelect(task)}>
                                  <span className="sidebar-task-title">{task.title}</span>
                                </button>
                                {task.source && (
                                  <button
                                    className="handoff-btn start-btn"
                                    onClick={() => handleTaskCompletion(task, 'cc:WIP')}
                                    disabled={isUpdatingTask}
                                    title="作業開始"
                                  >
                                    ▶
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {plans.work.length > 0 && (
                          <div className="sidebar-task-group">
                            <div className="sidebar-task-label">🔥 Work ({plans.work.length})</div>
                            {plans.work.map((task) => (
                              <div key={task.id} className="sidebar-task-with-action">
                                <button className="sidebar-task-item" onClick={() => handleTaskSelect(task)}>
                                  <span className="sidebar-task-title">{task.title}</span>
                                </button>
                                {workflowMode === '2agent' && agentRole === 'impl' && task.source && (
                                  <button
                                    className="handoff-btn complete-btn"
                                    onClick={() => handleTaskCompletion(task, 'cc:完了')}
                                    disabled={isUpdatingTask}
                                    title="完了してPMに報告"
                                  >
                                    ✓
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Show non-依頼中 plan tasks */}
                        {plans.plan.filter(t => !t.source?.marker?.includes('依頼中')).length > 0 && (
                          <div className="sidebar-task-group">
                            <div className="sidebar-task-label">📝 Plan ({plans.plan.filter(t => !t.source?.marker?.includes('依頼中')).length})</div>
                            {plans.plan.filter(t => !t.source?.marker?.includes('依頼中')).slice(0, 5).map((task) => (
                              <button key={task.id} className="sidebar-task-item" onClick={() => handleTaskSelect(task)}>
                                <span className="sidebar-task-title">{task.title}</span>
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Solo mode shows all tasks without role filtering */}
                        {workflowMode === 'solo' && plans.plan.length > 0 && (
                          <div className="sidebar-task-group">
                            <div className="sidebar-task-label">📝 Plan ({plans.plan.length})</div>
                            {plans.plan.slice(0, 5).map((task) => (
                              <button key={task.id} className="sidebar-task-item" onClick={() => handleTaskSelect(task)}>
                                <span className="sidebar-task-title">{task.title}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="sidebar-empty">Plans.md が見つかりません</div>
                    )}
                  </div>
                )}

                {/* SSOT Tab - Task 8.4 */}
                {sidebarTab === 'ssot' && (
                  <div className="sidebar-ssot">
                    <div className="sidebar-section-header">
                      <span>📚 SSOT</span>
                      <button onClick={() => { setSsot(null); loadSSOT() }} className="sidebar-refresh-btn" title="更新">🔄</button>
                    </div>
                    <div className="ssot-search">
                      <input
                        type="text"
                        placeholder="キーワード (カンマ区切り)"
                        value={ssotKeywords}
                        onChange={(e) => setSsotKeywords(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && loadSSOT()}
                        className="ssot-search-input"
                      />
                      <button onClick={loadSSOT} className="ssot-search-btn" disabled={ssotLoading}>検索</button>
                    </div>
                    {ssotLoading ? (
                      <div className="sidebar-loading">読み込み中...</div>
                    ) : ssot ? (
                      <div className="ssot-content">
                        {ssot.error && <div className="ssot-error">{ssot.error}</div>}
                        {ssot.decisions.found ? (
                          <div className="ssot-file">
                            <div className="ssot-file-header">📖 decisions.md</div>
                            <pre className="ssot-file-content">{ssot.decisions.content}</pre>
                          </div>
                        ) : (
                          <div className="ssot-not-found">
                            <span>📖 decisions.md が見つかりません</span>
                            <span className="ssot-hint">.claude/memory/decisions.md を作成してください</span>
                          </div>
                        )}
                        {ssot.patterns.found ? (
                          <div className="ssot-file">
                            <div className="ssot-file-header">📐 patterns.md</div>
                            <pre className="ssot-file-content">{ssot.patterns.content}</pre>
                          </div>
                        ) : (
                          <div className="ssot-not-found">
                            <span>📐 patterns.md が見つかりません</span>
                            <span className="ssot-hint">.claude/memory/patterns.md を作成してください</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="sidebar-empty">SSOT を読み込むには上の検索ボタンをクリック</div>
                    )}
                  </div>
                )}

                {/* Health Tab - Task 8.6 */}
                {sidebarTab === 'health' && (
                  <div className="sidebar-health">
                    <div className="sidebar-section-header">
                      <span>💊 Health Score</span>
                      <button onClick={refreshHealth} className="sidebar-refresh-btn" title="更新">🔄</button>
                    </div>
                    {healthLoading ? (
                      <div className="sidebar-loading">読み込み中...</div>
                    ) : health ? (
                      <div className="health-mini">
                        <div className="health-mini-score">
                          <div className={`health-mini-circle health-${health.status}`}>
                            <span className="health-mini-value">{health.score}</span>
                          </div>
                          <span className="health-mini-label">{health.status}</span>
                        </div>
                        <div className="health-mini-breakdown">
                          <div className="health-mini-item">
                            <span>Skills</span>
                            <span className={`health-${health.breakdown.skills.status}`}>{health.breakdown.skills.count}</span>
                          </div>
                          <div className="health-mini-item">
                            <span>Rules</span>
                            <span className={`health-${health.breakdown.rules.status}`}>{health.breakdown.rules.count}</span>
                          </div>
                          <div className="health-mini-item">
                            <span>Hooks</span>
                            <span className={`health-${health.breakdown.hooks.status}`}>{health.breakdown.hooks.count}</span>
                          </div>
                          <div className="health-mini-item">
                            <span>初期トークン</span>
                            <span>{health.totalInitialLoadTokens.toLocaleString()}</span>
                          </div>
                        </div>
                        {health.suggestions.length > 0 && (
                          <div className="health-mini-suggestions">
                            <div className="health-mini-suggestions-title">💡 提案</div>
                            <ul>
                              {health.suggestions.slice(0, 3).map((s, i) => (
                                <li key={i}>{s}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="sidebar-empty">Health データがありません</div>
                    )}
                  </div>
                )}

                {/* Guardrail Tab - Task 8.5 */}
                {sidebarTab === 'guardrail' && (
                  <div className="sidebar-guardrail">
                    <div className="sidebar-section-header">
                      <span>🛡️ ガードレール</span>
                      <button onClick={() => setGuardrailEvents([])} className="sidebar-refresh-btn" title="クリア">🗑️</button>
                    </div>
                    {guardrailEvents.length === 0 ? (
                      <div className="sidebar-empty">
                        <span>ツール承認イベントがありません</span>
                        <span className="sidebar-hint">ツール実行時に承認要求があるとここに表示されます</span>
                      </div>
                    ) : (
                      <div className="guardrail-events">
                        {guardrailEvents.map((event) => (
                          <div key={event.id} className={`guardrail-event guardrail-${event.type}`}>
                            <div className="guardrail-event-header">
                              <span className="guardrail-event-icon">
                                {event.type === 'approval_request' ? '🔒' : event.type === 'approved' ? '✅' : '❌'}
                              </span>
                              <span className="guardrail-event-tool">{event.toolName}</span>
                              <span className="guardrail-event-time">
                                {new Date(event.timestamp).toLocaleTimeString()}
                              </span>
                            </div>
                            {event.reason && (
                              <div className="guardrail-event-reason">{event.reason}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Collapse Button */}
              <button
                className="sidebar-collapse-btn"
                onClick={() => setShowRightSidebar(false)}
                title="サイドバーを閉じる"
              >
                ›
              </button>
            </div>
          )}

          {/* Collapsed Sidebar Toggle */}
          {!showRightSidebar && (
            <button
              className="sidebar-expand-btn"
              onClick={() => setShowRightSidebar(true)}
              title="サイドバーを開く"
            >
              ‹
            </button>
          )}
        </div>
      ) : (
        /* History Tab */
        <div className="agent-history">
          {sessions.length === 0 ? (
            <div className="agent-history-empty">
              <span>📭</span>
              <p>No session history yet.</p>
            </div>
          ) : (
            <div className="agent-session-list">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className={`agent-session-item agent-session-${session.status}`}
                  onClick={() => {
                    setCurrentSession(session)
                    setMessages(session.messages)
                    setActiveTab('execute')
                  }}
                >
                  <div className="agent-session-header">
                    <span className="agent-session-status">
                      {getStatusIcon(session.status)}
                    </span>
                    <span className="agent-session-id">{session.id}</span>
                  </div>
                  <div className="agent-session-prompt">{session.prompt}</div>
                  <div className="agent-session-meta">
                    <span>{new Date(session.startedAt).toLocaleString()}</span>
                    <span>{session.messages.length} messages</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tool Approval Dialog */}
      {pendingApproval && (
        <div className="tool-approval-overlay">
          <div className="tool-approval-dialog">
            <div className="tool-approval-header">
              <span className="tool-approval-icon">🔒</span>
              <h3>ツール承認リクエスト</h3>
            </div>
            <div className="tool-approval-content">
              <div className="tool-approval-info">
                <span className="tool-approval-label">ツール名:</span>
                <span className="tool-approval-value">{pendingApproval.toolName}</span>
              </div>
              <div className="tool-approval-input">
                <span className="tool-approval-label">入力:</span>
                <pre className="tool-approval-code">
                  {JSON.stringify(pendingApproval.toolInput, null, 2)}
                </pre>
              </div>
            </div>
            <div className="tool-approval-actions">
              <button
                className="tool-approval-btn tool-approval-deny"
                onClick={() => handleApprovalDecision('deny', 'User denied')}
              >
                <span>✕</span>
                <span>拒否</span>
              </button>
              <button
                className="tool-approval-btn tool-approval-allow"
                onClick={() => handleApprovalDecision('allow')}
              >
                <span>✓</span>
                <span>許可</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Question Dialog */}
      {pendingQuestion && (
        <div className="tool-approval-overlay">
          <div className="question-dialog">
            <div className="question-dialog-header">
              <span className="question-dialog-icon">❓</span>
              <h3>質問に回答してください</h3>
            </div>
            <div className="question-dialog-content">
              {pendingQuestion.questions.map((q, qIndex) => (
                <div key={qIndex} className="question-item">
                  <div className="question-header">{q.header}</div>
                  <div className="question-text">{q.question}</div>
                  <div className="question-options">
                    {q.options.map((opt, optIndex) => (
                      <button
                        key={optIndex}
                        className={`question-option ${questionAnswers[q.header] === opt.label ? 'selected' : ''}`}
                        onClick={() => handleOptionSelect(qIndex, opt.label)}
                      >
                        <span className="option-label">{opt.label}</span>
                        {opt.description && (
                          <span className="option-description">{opt.description}</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="question-dialog-actions">
              <button
                className="question-submit-btn"
                onClick={handleQuestionSubmit}
                disabled={Object.keys(questionAnswers).length === 0}
              >
                <span>✓</span>
                <span>回答を送信</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task Completion Dialog - ユーザーがタスクを選択して完了マーク */}
      {showCompletionDialog && plans?.work && plans.work.length > 0 && (
        <div className="tool-approval-overlay">
          <div className="task-completion-dialog">
            <div className="task-completion-header">
              <span className="task-completion-icon">✅</span>
              <h3>完了するタスクを選択してください</h3>
            </div>
            <div className="task-completion-content">
              {/* Task Selection List */}
              <div className="task-selection-list">
                {plans.work.map((task) => (
                  <button
                    key={task.id}
                    className={`task-selection-item ${completionTask?.id === task.id ? 'selected' : ''}`}
                    onClick={() => setCompletionTask(task)}
                    disabled={isUpdatingTask}
                  >
                    <span className="task-selection-radio">
                      {completionTask?.id === task.id ? '●' : '○'}
                    </span>
                    <span className="task-selection-title">{task.title}</span>
                    {task.source?.marker && (
                      <span className="task-completion-marker">{task.source.marker}</span>
                    )}
                  </button>
                ))}
              </div>
              {taskUpdateError && (
                <div className="task-completion-error">
                  <span>⚠️</span>
                  <span>{taskUpdateError}</span>
                </div>
              )}
            </div>
            <div className="task-completion-actions">
              <button
                className="task-completion-btn task-completion-skip"
                onClick={() => {
                  setShowCompletionDialog(false)
                  setCompletionTask(null)
                  setTaskUpdateError(null)
                }}
                disabled={isUpdatingTask}
              >
                <span>スキップ</span>
              </button>
              {taskUpdateError && (
                <button
                  className="task-completion-btn task-completion-refresh"
                  onClick={() => {
                    refreshPlans()
                    setCompletionTask(null)
                    setTaskUpdateError(null)
                  }}
                >
                  <span>再読み込み</span>
                </button>
              )}
              {!taskUpdateError && completionTask && completionTask.source && (
                <button
                  className="task-completion-btn task-completion-done"
                  onClick={async () => {
                    await handleTaskCompletion(completionTask, workflowMode === 'solo' ? 'cc:完了' : 'cc:完了')
                    setShowCompletionDialog(false)
                  }}
                  disabled={isUpdatingTask}
                >
                  {isUpdatingTask ? (
                    <>
                      <span className="agent-spinner" />
                      <span>更新中...</span>
                    </>
                  ) : (
                    <>
                      <span>✓</span>
                      <span>完了マーク</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function getMessageIcon(type: AgentMessage['type']): string {
  switch (type) {
    case 'user':
      return '👤'
    case 'assistant':
      return '🤖'
    case 'tool_use':
      return '🔧'
    case 'tool_result':
      return '📋'
    case 'system':
      return 'ℹ️'
    case 'error':
      return '❌'
    default:
      return '💬'
  }
}

function getMessageTypeLabel(type: AgentMessage['type']): string {
  switch (type) {
    case 'user':
      return 'User'
    case 'assistant':
      return 'Assistant'
    case 'tool_use':
      return 'Tool Call'
    case 'tool_result':
      return 'Tool Result'
    case 'system':
      return 'System'
    case 'error':
      return 'Error'
    default:
      return 'Message'
  }
}

function getStatusIcon(status: AgentSession['status']): string {
  switch (status) {
    case 'running':
      return '🔄'
    case 'completed':
      return '✅'
    case 'error':
      return '❌'
    case 'interrupted':
      return '⏹️'
    default:
      return '⏸️'
  }
}
