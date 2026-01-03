/**
 * Projects API Routes
 *
 * プロジェクト管理の REST API エンドポイント
 */

import { Hono } from 'hono'
import { existsSync } from 'node:fs'
import {
  getProjects,
  getActiveProject,
  addProject,
  removeProject,
  setActiveProject,
  updateProject,
  getProjectById,
  getConfigPath,
} from '../services/projects.ts'

const app = new Hono()

/**
 * GET /api/projects
 * プロジェクト一覧を取得
 */
app.get('/', (c) => {
  try {
    const projects = getProjects()
    const activeProject = getActiveProject()

    return c.json({
      projects,
      activeProjectId: activeProject?.id ?? null,
      configPath: getConfigPath(),
    })
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      500
    )
  }
})

/**
 * GET /api/projects/active
 * アクティブプロジェクトを取得
 */
app.get('/active', (c) => {
  try {
    const project = getActiveProject()

    if (!project) {
      return c.json({ project: null, message: 'No active project' })
    }

    return c.json({ project })
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      500
    )
  }
})

/**
 * POST /api/projects
 * プロジェクトを追加
 */
app.post('/', async (c) => {
  try {
    const body = await c.req.json<{ name: string; path: string }>()

    if (!body.name || !body.path) {
      return c.json({ error: 'name and path are required' }, 400)
    }

    // パスの存在チェック
    if (!existsSync(body.path)) {
      return c.json({ error: `Path does not exist: ${body.path}` }, 400)
    }

    const project = addProject(body.name, body.path)
    return c.json({ project }, 201)
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      400
    )
  }
})

/**
 * GET /api/projects/:id
 * プロジェクトを ID で取得
 */
app.get('/:id', (c) => {
  try {
    const id = c.req.param('id')
    const project = getProjectById(id)

    if (!project) {
      return c.json({ error: 'Project not found' }, 404)
    }

    return c.json({ project })
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      500
    )
  }
})

/**
 * PUT /api/projects/:id
 * プロジェクト情報を更新
 */
app.put('/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const body = await c.req.json<{ name?: string; path?: string }>()

    // パスが指定された場合は存在チェック
    if (body.path && !existsSync(body.path)) {
      return c.json({ error: `Path does not exist: ${body.path}` }, 400)
    }

    const project = updateProject(id, body)

    if (!project) {
      return c.json({ error: 'Project not found' }, 404)
    }

    return c.json({ project })
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      400
    )
  }
})

/**
 * DELETE /api/projects/:id
 * プロジェクトを削除
 */
app.delete('/:id', (c) => {
  try {
    const id = c.req.param('id')
    const success = removeProject(id)

    if (!success) {
      return c.json({ error: 'Project not found' }, 404)
    }

    return c.json({ success: true })
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      500
    )
  }
})

/**
 * PUT /api/projects/:id/activate
 * アクティブプロジェクトを変更
 */
app.put('/:id/activate', (c) => {
  try {
    const id = c.req.param('id')
    const project = setActiveProject(id)

    if (!project) {
      return c.json({ error: 'Project not found' }, 404)
    }

    return c.json({ project, message: 'Project activated' })
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      500
    )
  }
})

export default app
