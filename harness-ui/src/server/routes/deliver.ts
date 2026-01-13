/**
 * Deliver Routes
 *
 * API routes for deliver workflow (commit/push/PR/release)
 */

import { Hono } from 'hono'
import {
  getPreflight,
  executeCommit,
  executePush,
  createPR,
  getReleaseTemplates,
  loadReleaseTemplate,
} from '../services/git-service.ts'
import { getDefaultPolicyEngine } from '../services/policy-engine.ts'
import type {
  DeliverCommitRequest,
  DeliverPushRequest,
  DeliverPRRequest,
} from '../../shared/types.ts'

const deliverRoutes = new Hono()

/**
 * GET /api/deliver/preflight
 * Get preflight information for deliver workflow
 */
deliverRoutes.get('/preflight', async (c) => {
  const projectPath = c.req.query('projectPath')
  const suggestedCommitMessage = c.req.query('suggestedCommitMessage')

  if (!projectPath) {
    return c.json({ error: 'projectPath is required' }, 400)
  }

  try {
    const preflight = getPreflight(projectPath, suggestedCommitMessage)
    return c.json(preflight)
  } catch (error) {
    const err = error as { message?: string }
    return c.json({ error: err.message ?? 'Preflight check failed' }, 500)
  }
})

/**
 * POST /api/deliver/commit
 * Execute git commit
 */
deliverRoutes.post('/commit', async (c) => {
  const projectPath = c.req.query('projectPath')

  if (!projectPath) {
    return c.json({ error: 'projectPath is required' }, 400)
  }

  try {
    const body = await c.req.json<DeliverCommitRequest>()

    // Evaluate policy for git_commit operation
    const policyEngine = getDefaultPolicyEngine()
    const evaluation = policyEngine.evaluateGit('git_commit')

    if (evaluation.behavior === 'deny') {
      return c.json(
        {
          success: false,
          error: evaluation.reason ?? 'コミットはポリシーにより拒否されました',
        },
        403
      )
    }

    // If policy requires ask, we assume UI has already approved (this is called from UI)
    // In a real implementation, you might want to track pending approvals here

    const result = executeCommit(projectPath, body)
    return c.json(result)
  } catch (error) {
    const err = error as { message?: string }
    return c.json({ success: false, error: err.message ?? 'Commit failed' }, 500)
  }
})

/**
 * POST /api/deliver/push
 * Execute git push
 */
deliverRoutes.post('/push', async (c) => {
  const projectPath = c.req.query('projectPath')

  if (!projectPath) {
    return c.json({ error: 'projectPath is required' }, 400)
  }

  try {
    const body = await c.req.json<DeliverPushRequest>()

    // Get preflight to check if this is main branch
    const preflight = getPreflight(projectPath)
    const isMainBranch = preflight.isMainBranch || body.branch === 'main' || body.branch === 'master'

    // Evaluate policy for git_push operation
    const policyEngine = getDefaultPolicyEngine()
    const evaluation = policyEngine.evaluateGit('git_push', body.branch, isMainBranch)

    if (evaluation.behavior === 'deny') {
      return c.json(
        {
          success: false,
          error: evaluation.reason ?? 'プッシュはポリシーにより拒否されました',
        },
        403
      )
    }

    // Special check for main/master push
    if (isMainBranch && !body.force) {
      return c.json(
        {
          success: false,
          error: 'main/master ブランチへの push は原則禁止です。force フラグが必要です（手動実行を推奨）',
        },
        403
      )
    }

    // If policy requires ask, we assume UI has already approved

    const result = executePush(projectPath, body)
    return c.json(result)
  } catch (error) {
    const err = error as { message?: string }
    return c.json({ success: false, error: err.message ?? 'Push failed' }, 500)
  }
})

/**
 * POST /api/deliver/pr
 * Create GitHub PR using gh CLI
 */
deliverRoutes.post('/pr', async (c) => {
  const projectPath = c.req.query('projectPath')

  if (!projectPath) {
    return c.json({ error: 'projectPath is required' }, 400)
  }

  try {
    const body = await c.req.json<DeliverPRRequest>()

    // Evaluate policy for git_pr operation
    const policyEngine = getDefaultPolicyEngine()
    const evaluation = policyEngine.evaluateGit('git_pr')

    if (evaluation.behavior === 'deny') {
      return c.json(
        {
          success: false,
          error: evaluation.reason ?? 'PR作成はポリシーにより拒否されました',
        },
        403
      )
    }

    // If policy requires ask, we assume UI has already approved

    const result = createPR(projectPath, body)
    return c.json(result)
  } catch (error) {
    const err = error as { message?: string }
    return c.json({ success: false, error: err.message ?? 'PR creation failed' }, 500)
  }
})

/**
 * GET /api/deliver/release/templates
 * Get available release templates
 */
deliverRoutes.get('/release/templates', async (c) => {
  const projectPath = c.req.query('projectPath')

  if (!projectPath) {
    return c.json({ error: 'projectPath is required' }, 400)
  }

  try {
    const templates = getReleaseTemplates(projectPath)
    return c.json({ templates })
  } catch (error) {
    const err = error as { message?: string }
    return c.json({ error: err.message ?? 'Failed to load release templates' }, 500)
  }
})

/**
 * GET /api/deliver/release/template/:name
 * Get specific release template
 */
deliverRoutes.get('/release/template/:name', async (c) => {
  const projectPath = c.req.query('projectPath')
  const templateName = c.req.param('name')

  if (!projectPath) {
    return c.json({ error: 'projectPath is required' }, 400)
  }

  try {
    const template = loadReleaseTemplate(projectPath, templateName)
    if (!template) {
      return c.json({ error: `Template "${templateName}" not found` }, 404)
    }
    return c.json(template)
  } catch (error) {
    const err = error as { message?: string }
    return c.json({ error: err.message ?? 'Failed to load release template' }, 500)
  }
})

export default deliverRoutes
