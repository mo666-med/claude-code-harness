import { Hono } from 'hono'
import { parsePlans, getProjectRoot } from '../services/analyzer.ts'
import { validateProjectPath, readFileContent } from '../services/file-reader.ts'
import { join } from 'node:path'
import type { WorkflowMode } from '../services/plans-parser.ts'

const app = new Hono()

/**
 * Actor role in 2-agent workflow
 */
type ActorRole = 'pm' | 'impl' | 'user'

/**
 * Request body for updating a task marker
 */
interface UpdateTaskRequest {
  /** Line number to update (1-based) */
  lineNumber: number
  /** Expected original line content for conflict detection */
  expectedLine: string
  /** Old marker to replace (e.g., 'cc:WIP') */
  oldMarker: string
  /** New marker to set (e.g., 'cc:完了') */
  newMarker: string
  /** Workflow mode for state transition validation */
  workflowMode?: WorkflowMode
  /** Actor role making the change (for 2-agent validation) */
  actorRole?: ActorRole
}

/**
 * Valid state transitions for 2-agent workflow
 * PM: pm:依頼中 → ... → pm:確認済
 * Impl: cc:WIP → cc:完了
 */
const VALID_2AGENT_TRANSITIONS: Record<string, { next: string[]; actor: ActorRole[] }> = {
  'pm:依頼中': { next: ['cc:WIP'], actor: ['impl'] },
  'cc:WIP': { next: ['cc:完了', 'cc:blocked'], actor: ['impl'] },
  'cc:完了': { next: ['pm:確認済', 'pm:要修正'], actor: ['pm'] },
  'cc:blocked': { next: ['cc:WIP', 'pm:キャンセル'], actor: ['impl', 'pm'] },
  'pm:要修正': { next: ['cc:WIP'], actor: ['impl'] },
  'pm:確認済': { next: [], actor: [] }, // Terminal state
  'pm:キャンセル': { next: [], actor: [] }, // Terminal state
}

/**
 * Validate state transition for 2-agent workflow
 */
function validateStateTransition(
  oldMarker: string,
  newMarker: string,
  actorRole: ActorRole | undefined,
  workflowMode: WorkflowMode
): { valid: boolean; error?: string } {
  // Solo mode: no strict validation (more flexible)
  if (workflowMode === 'solo') {
    return { valid: true }
  }

  // 2-agent mode: strict state machine validation
  const transition = VALID_2AGENT_TRANSITIONS[oldMarker]
  if (!transition) {
    // Unknown old marker - allow (might be a custom marker)
    return { valid: true }
  }

  // Check if new marker is a valid next state
  if (!transition.next.includes(newMarker)) {
    return {
      valid: false,
      error: `無効な状態遷移です: ${oldMarker} → ${newMarker}。有効な遷移先: ${transition.next.join(', ') || '(なし - 終端状態)'}`
    }
  }

  // Check if actor has permission for this transition
  if (actorRole && transition.actor.length > 0 && !transition.actor.includes(actorRole)) {
    return {
      valid: false,
      error: `${actorRole} はこの遷移を実行できません: ${oldMarker} → ${newMarker}。許可された役割: ${transition.actor.join(', ')}`
    }
  }

  return { valid: true }
}

app.get('/', async (c) => {
  try {
    const userProject = c.req.query('project')
    const defaultRoot = getProjectRoot()

    // Validate project path to prevent path traversal attacks
    const projectRoot = userProject
      ? validateProjectPath(userProject, defaultRoot) ?? defaultRoot
      : defaultRoot

    // Get workflow mode (default: solo for single-agent operation)
    const modeParam = c.req.query('mode')
    const mode: WorkflowMode = modeParam === '2agent' ? '2agent' : 'solo'

    const plans = await parsePlans(projectRoot, mode)
    return c.json({ ...plans, mode })
  } catch (error) {
    console.error('Plans parsing failed:', error)
    return c.json(
      {
        plan: [],
        work: [],
        review: [],
        done: [],
        mode: 'solo',
        error: 'Plans.md の読み取りに失敗しました'
      },
      500
    )
  }
})

/**
 * Update a task marker in Plans.md with conflict detection
 *
 * Safety mechanism:
 * - Uses line number + expected content matching
 * - Returns 409 Conflict if the line has changed
 */
app.patch('/task', async (c) => {
  try {
    const userProject = c.req.query('project')
    const queryMode = c.req.query('mode')  // Fallback: check query param
    const defaultRoot = getProjectRoot()

    // Validate project path
    const projectRoot = userProject
      ? validateProjectPath(userProject, defaultRoot) ?? defaultRoot
      : defaultRoot

    // Parse request body
    const body = await c.req.json<UpdateTaskRequest>()
    const { lineNumber, expectedLine, oldMarker, newMarker, workflowMode, actorRole } = body

    // Validate required fields
    if (!lineNumber || !expectedLine || !oldMarker || !newMarker) {
      return c.json({ error: '必須パラメータが不足しています' }, 400)
    }

    // Determine workflow mode: body > query > default
    const mode: WorkflowMode = workflowMode ?? (queryMode === '2agent' ? '2agent' : 'solo')

    // In 2-agent mode, actorRole is required for state transition validation
    if (mode === '2agent' && !actorRole) {
      return c.json(
        {
          error: '2-agent モードでは actorRole（pm/impl）が必須です',
          missingField: 'actorRole',
          workflowMode: mode
        },
        400
      )
    }

    // Validate state transition (for 2-agent workflow)
    const transitionResult = validateStateTransition(oldMarker, newMarker, actorRole, mode)
    if (!transitionResult.valid) {
      return c.json(
        {
          error: transitionResult.error,
          invalidTransition: true,
          oldMarker,
          newMarker,
          actorRole,
          workflowMode: mode
        },
        422  // Unprocessable Entity
      )
    }

    // Find Plans.md
    const possiblePaths = [
      join(projectRoot, 'Plans.md'),
      join(projectRoot, '.claude', 'Plans.md'),
      join(projectRoot, '.claude', 'plans.md')
    ]

    let plansPath: string | null = null
    let content: string | null = null

    for (const path of possiblePaths) {
      content = await readFileContent(path)
      if (content) {
        plansPath = path
        break
      }
    }

    if (!plansPath || !content) {
      return c.json({ error: 'Plans.md が見つかりません' }, 404)
    }

    // Split into lines and check for conflict
    const lines = content.split('\n')
    const lineIndex = lineNumber - 1 // Convert to 0-based

    if (lineIndex < 0 || lineIndex >= lines.length) {
      return c.json({ error: `行番号 ${lineNumber} が範囲外です` }, 400)
    }

    const currentLine = lines[lineIndex]

    // Conflict detection: check if the line has changed
    if (currentLine !== expectedLine) {
      return c.json(
        {
          error: '競合が検出されました。Plans.md が外部で変更されています。',
          conflict: true,
          expectedLine,
          currentLine,
          suggestion: 'Plans.md を再読み込みして、最新の状態を確認してください。'
        },
        409
      )
    }

    // Perform the marker replacement
    const updatedLine = currentLine?.replace(`\`${oldMarker}\``, `\`${newMarker}\``)

    // Verify the replacement actually happened
    if (updatedLine === currentLine) {
      return c.json(
        {
          error: `マーカー \`${oldMarker}\` が見つかりませんでした`,
          currentLine
        },
        400
      )
    }

    // Update the line
    lines[lineIndex] = updatedLine

    // Write back to file
    await Bun.write(plansPath, lines.join('\n'))

    return c.json({
      success: true,
      lineNumber,
      oldLine: currentLine,
      newLine: updatedLine,
      message: `マーカーを ${oldMarker} から ${newMarker} に更新しました`
    })
  } catch (error) {
    console.error('Plans update failed:', error)
    return c.json(
      { error: 'Plans.md の更新に失敗しました' },
      500
    )
  }
})

export default app
