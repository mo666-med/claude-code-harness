/**
 * Agent API Routes
 *
 * Claude Agent SDK を使用したエージェント実行のエンドポイント
 */

import { Hono } from 'hono'
import { z } from 'zod'
import {
  executeAgent,
  continueSession,
  getSession,
  getActiveSessions,
  getSessionHistory,
  getAllSessionHistories,
  clearSessionHistory,
  interruptSession,
  submitToolApproval,
  getPendingApproval,
  checkAgentSdkAvailable,
} from '../services/agent-executor.ts'
import type {
  AgentExecuteRequest,
  AgentExecuteResponse,
  AgentInterruptResponse,
  AgentSessionResponse,
  AgentToolApprovalResponse,
} from '../../shared/types.ts'

const app = new Hono()

// Request validation schemas
const executeRequestSchema = z.object({
  prompt: z.string().min(1),
  workingDirectory: z.string().optional(),
  sessionId: z.string().optional(),
  permissionMode: z.enum(['default', 'acceptEdits', 'bypassPermissions', 'plan']).optional(),
})

const interruptRequestSchema = z.object({
  sessionId: z.string().min(1),
})

const toolApprovalRequestSchema = z.object({
  sessionId: z.string().min(1),
  toolUseId: z.string().min(1),
  decision: z.enum(['allow', 'deny', 'modify']),
  modifiedInput: z.unknown().optional(),
  reason: z.string().optional(),
})

const continueRequestSchema = z.object({
  sessionId: z.string().min(1),
  prompt: z.string().min(1),
})

/**
 * GET /api/agent/status
 * Check Agent SDK availability
 */
app.get('/status', async (c) => {
  const status = await checkAgentSdkAvailable()
  return c.json(status)
})

/**
 * GET /api/agent/sessions
 * List all active sessions
 */
app.get('/sessions', (c) => {
  const sessions = getActiveSessions()
  return c.json({
    sessions,
    count: sessions.length,
  })
})

/**
 * GET /api/agent/session/:id
 * Get a specific session
 */
app.get('/session/:id', (c) => {
  const sessionId = c.req.param('id')
  const session = getSession(sessionId)

  if (!session) {
    return c.json<AgentSessionResponse>(
      { session: null, error: 'Session not found' },
      404
    )
  }

  return c.json<AgentSessionResponse>({ session })
})

/**
 * POST /api/agent/execute
 * Start a new agent execution (streaming via WebSocket)
 *
 * Returns sessionId immediately, messages streamed via WebSocket
 */
app.post('/execute', async (c) => {
  try {
    const body = await c.req.json()
    const parsed = executeRequestSchema.safeParse(body)

    if (!parsed.success) {
      return c.json(
        { error: 'Invalid request', details: parsed.error.issues },
        400
      )
    }

    const request: AgentExecuteRequest = parsed.data

    // Use provided sessionId or generate a new one
    // Client should pre-register WebSocket with sessionId before calling execute
    const sessionId = request.sessionId ?? `agent-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`

    // Start execution in background (don't await)
    // Messages will be streamed via WebSocket
    ;(async () => {
      try {
        for await (const _message of executeAgent({ ...request, sessionId })) {
          // Messages are sent via WebSocket in executeAgent
        }
      } catch (error) {
        console.error('[agent/execute] Background error:', error)
      }
    })()

    // Return sessionId immediately for WebSocket connection
    return c.json<AgentExecuteResponse>({
      sessionId,
      status: 'running',
      message: 'Execution started, connect WebSocket for streaming',
    })
  } catch (error) {
    console.error('[agent/execute] Error:', error)
    return c.json(
      { error: error instanceof Error ? error.message : 'Execution failed' },
      500
    )
  }
})

/**
 * POST /api/agent/interrupt
 * Interrupt an active session
 */
app.post('/interrupt', async (c) => {
  try {
    const body = await c.req.json()
    const parsed = interruptRequestSchema.safeParse(body)

    if (!parsed.success) {
      return c.json(
        { error: 'Invalid request', details: parsed.error.issues },
        400
      )
    }

    const { sessionId } = parsed.data
    const success = interruptSession(sessionId)

    return c.json<AgentInterruptResponse>({
      success,
      message: success ? 'Session interrupted' : 'Session not found or already completed',
    })
  } catch (error) {
    console.error('[agent/interrupt] Error:', error)
    return c.json(
      { error: error instanceof Error ? error.message : 'Interrupt failed' },
      500
    )
  }
})

/**
 * GET /api/agent/session/:id/pending-approval
 * Get pending tool approval for a session
 */
app.get('/session/:id/pending-approval', (c) => {
  const sessionId = c.req.param('id')
  const pending = getPendingApproval(sessionId)

  if (!pending) {
    return c.json({ pending: null })
  }

  return c.json({
    pending: {
      sessionId: pending.sessionId,
      toolUseId: pending.toolUseId,
      toolName: pending.toolName,
      toolInput: pending.toolInput,
    },
  })
})

/**
 * POST /api/agent/tool-approval
 * Submit tool approval decision
 */
app.post('/tool-approval', async (c) => {
  try {
    const body = await c.req.json()
    const parsed = toolApprovalRequestSchema.safeParse(body)

    if (!parsed.success) {
      return c.json(
        { error: 'Invalid request', details: parsed.error.issues },
        400
      )
    }

    const response: AgentToolApprovalResponse = {
      sessionId: parsed.data.sessionId,
      toolUseId: parsed.data.toolUseId,
      decision: parsed.data.decision,
      modifiedInput: parsed.data.modifiedInput,
      reason: parsed.data.reason,
    }

    const success = submitToolApproval(response)

    return c.json({
      success,
      message: success ? 'Approval submitted' : 'No pending approval found',
    })
  } catch (error) {
    console.error('[agent/tool-approval] Error:', error)
    return c.json(
      { error: error instanceof Error ? error.message : 'Approval failed' },
      500
    )
  }
})

/**
 * POST /api/agent/continue
 * Continue an existing session with a new prompt (multi-turn conversation)
 */
app.post('/continue', async (c) => {
  try {
    const body = await c.req.json()
    const parsed = continueRequestSchema.safeParse(body)

    if (!parsed.success) {
      return c.json(
        { error: 'Invalid request', details: parsed.error.issues },
        400
      )
    }

    const { sessionId, prompt } = parsed.data

    // Continue the session
    const messages = []
    for await (const message of continueSession(sessionId, prompt)) {
      messages.push(message)
    }

    const session = getSession(sessionId)

    return c.json<AgentExecuteResponse>({
      sessionId,
      status: session?.status ?? 'completed',
      message: `Continued with ${messages.length} messages (multi-turn)`,
    })
  } catch (error) {
    console.error('[agent/continue] Error:', error)
    return c.json(
      { error: error instanceof Error ? error.message : 'Continue failed' },
      500
    )
  }
})

/**
 * GET /api/agent/session/:id/history
 * Get session conversation history
 */
app.get('/session/:id/history', (c) => {
  const sessionId = c.req.param('id')
  const history = getSessionHistory(sessionId)

  if (!history) {
    return c.json({ history: null, error: 'History not found' }, 404)
  }

  return c.json({ history })
})

/**
 * GET /api/agent/histories
 * Get all session histories
 */
app.get('/histories', (c) => {
  const histories = getAllSessionHistories()
  return c.json({
    histories,
    count: histories.length,
  })
})

/**
 * DELETE /api/agent/session/:id/history
 * Clear session history
 */
app.delete('/session/:id/history', (c) => {
  const sessionId = c.req.param('id')
  const success = clearSessionHistory(sessionId)

  return c.json({
    success,
    message: success ? 'History cleared' : 'History not found',
  })
})

export default app
