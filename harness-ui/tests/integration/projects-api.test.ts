/**
 * Projects API Integration Tests
 *
 * プロジェクト管理 REST API の網羅テスト
 */

import { describe, test, expect, beforeAll, afterAll, afterEach } from 'bun:test'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import projectsRoutes from '../../src/server/routes/projects.ts'

// テスト用ポート
const TEST_PORT = 37780
const API_BASE = `http://localhost:${TEST_PORT}`

// テスト用一時ディレクトリ
const TEST_DIR = join(tmpdir(), 'harness-ui-test-projects')

// テスト用プロジェクトディレクトリ
const TEST_PROJECT_DIR_1 = join(TEST_DIR, 'test-project-1')
const TEST_PROJECT_DIR_2 = join(TEST_DIR, 'test-project-2')

/**
 * テスト用アプリ作成
 */
function createTestApp() {
  const app = new Hono()

  app.use('*', cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type']
  }))

  app.route('/api/projects', projectsRoutes)

  return app
}

/**
 * テスト用プロジェクトディレクトリを作成
 */
function setupTestDirectories() {
  // テストディレクトリをクリーンアップ
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true })
  }

  // ディレクトリ作成
  mkdirSync(TEST_DIR, { recursive: true })
  mkdirSync(TEST_PROJECT_DIR_1, { recursive: true })
  mkdirSync(TEST_PROJECT_DIR_2, { recursive: true })
}

/**
 * テスト用設定ファイルを直接操作するヘルパー
 * (projectsサービスは実際の~/.harness-ui/config.jsonを使用するため、
 *  このテストではAPIを通じた操作をテストする)
 */

describe('Projects API Integration Tests', () => {
  let server: { stop: () => void } | null = null
  let app: Hono
  const createdProjectIds: string[] = []

  beforeAll(async () => {
    setupTestDirectories()

    app = createTestApp()
    server = Bun.serve({
      port: TEST_PORT,
      fetch: app.fetch
    })

    // サーバー起動待ち
    await new Promise(resolve => setTimeout(resolve, 100))

    // 既存のテストプロジェクトをクリーンアップ
    const listResponse = await fetch(`${API_BASE}/api/projects`)
    const listData = await listResponse.json()
    for (const project of listData.projects) {
      if (project.path.includes('harness-ui-test-projects')) {
        await fetch(`${API_BASE}/api/projects/${project.id}`, { method: 'DELETE' })
      }
    }
  })

  afterEach(async () => {
    // 作成したプロジェクトを削除
    for (const id of createdProjectIds) {
      try {
        await fetch(`${API_BASE}/api/projects/${id}`, { method: 'DELETE' })
      } catch {
        // ignore cleanup errors
      }
    }
    createdProjectIds.length = 0
  })

  afterAll(() => {
    server?.stop()

    // クリーンアップ
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true })
    }
  })

  // ============================================
  // GET /api/projects - プロジェクト一覧取得
  // ============================================
  describe('GET /api/projects', () => {
    test('正常系: プロジェクト一覧を取得できる', async () => {
      const response = await fetch(`${API_BASE}/api/projects`)

      expect(response.ok).toBe(true)
      expect(response.status).toBe(200)

      const data = await response.json()
      expect(Array.isArray(data.projects)).toBe(true)
      expect(data.configPath).toBeDefined()
      expect(typeof data.configPath).toBe('string')
    })

    test('正常系: レスポンスに必要なフィールドが含まれる', async () => {
      const response = await fetch(`${API_BASE}/api/projects`)
      const data = await response.json()

      expect(data).toHaveProperty('projects')
      expect(data).toHaveProperty('activeProjectId')
      expect(data).toHaveProperty('configPath')
    })
  })

  // ============================================
  // GET /api/projects/active - アクティブプロジェクト取得
  // ============================================
  describe('GET /api/projects/active', () => {
    test('正常系: アクティブプロジェクトを取得できる（プロジェクトなしの場合）', async () => {
      const response = await fetch(`${API_BASE}/api/projects/active`)

      expect(response.ok).toBe(true)
      expect(response.status).toBe(200)

      const data = await response.json()
      // プロジェクトがない場合はnullが返る
      expect(data).toHaveProperty('project')
    })
  })

  // ============================================
  // POST /api/projects - プロジェクト追加
  // ============================================
  describe('POST /api/projects', () => {
    test('正常系: 新規プロジェクトを追加できる', async () => {
      const response = await fetch(`${API_BASE}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test Project 1',
          path: TEST_PROJECT_DIR_1
        })
      })

      expect(response.status).toBe(201)

      const data = await response.json()
      expect(data.project).toBeDefined()
      expect(data.project.name).toBe('Test Project 1')
      expect(data.project.path).toBe(TEST_PROJECT_DIR_1)
      expect(data.project.id).toBeDefined()
      expect(data.project.addedAt).toBeDefined()

      // クリーンアップ用に追跡
      createdProjectIds.push(data.project.id)
    })

    test('異常系: 名前が空の場合は400エラー', async () => {
      const response = await fetch(`${API_BASE}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: '',
          path: TEST_PROJECT_DIR_2
        })
      })

      expect(response.status).toBe(400)

      const data = await response.json()
      expect(data.error).toBeDefined()
    })

    test('異常系: パスが空の場合は400エラー', async () => {
      const response = await fetch(`${API_BASE}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test Project',
          path: ''
        })
      })

      expect(response.status).toBe(400)
    })

    test('異常系: 存在しないパスの場合は400エラー', async () => {
      const response = await fetch(`${API_BASE}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Non-existent Project',
          path: '/non/existent/path/12345'
        })
      })

      expect(response.status).toBe(400)

      const data = await response.json()
      expect(data.error).toContain('does not exist')
    })

    test('異常系: 重複パスの場合は400エラー', async () => {
      // 最初のプロジェクトを追加
      const firstResponse = await fetch(`${API_BASE}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Original Project',
          path: TEST_PROJECT_DIR_2
        })
      })
      const firstData = await firstResponse.json()
      if (firstData.project?.id) {
        createdProjectIds.push(firstData.project.id)
      }

      // 同じパスで再度追加を試みる
      const response = await fetch(`${API_BASE}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Duplicate Project',
          path: TEST_PROJECT_DIR_2
        })
      })

      expect(response.status).toBe(400)

      const data = await response.json()
      expect(data.error).toContain('already exists')
    })

    test('異常系: リクエストボディがない場合はエラー', async () => {
      const response = await fetch(`${API_BASE}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}'
      })

      expect(response.status).toBe(400)
    })
  })

  // ============================================
  // GET /api/projects/:id - ID指定でプロジェクト取得
  // ============================================
  describe('GET /api/projects/:id', () => {
    test('正常系: IDでプロジェクトを取得できる', async () => {
      // まずプロジェクト一覧を取得
      const listResponse = await fetch(`${API_BASE}/api/projects`)
      const listData = await listResponse.json()

      if (listData.projects.length > 0) {
        const projectId = listData.projects[0].id

        const response = await fetch(`${API_BASE}/api/projects/${projectId}`)
        expect(response.ok).toBe(true)

        const data = await response.json()
        expect(data.project).toBeDefined()
        expect(data.project.id).toBe(projectId)
      }
    })

    test('異常系: 存在しないIDの場合は404エラー', async () => {
      const response = await fetch(`${API_BASE}/api/projects/non_existent_id_12345`)

      expect(response.status).toBe(404)

      const data = await response.json()
      expect(data.error).toBe('Project not found')
    })
  })

  // ============================================
  // PUT /api/projects/:id - プロジェクト更新
  // ============================================
  describe('PUT /api/projects/:id', () => {
    test('正常系: プロジェクト名を更新できる', async () => {
      // プロジェクト一覧を取得
      const listResponse = await fetch(`${API_BASE}/api/projects`)
      const listData = await listResponse.json()

      if (listData.projects.length > 0) {
        const projectId = listData.projects[0].id

        const response = await fetch(`${API_BASE}/api/projects/${projectId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Updated Project Name'
          })
        })

        expect(response.ok).toBe(true)

        const data = await response.json()
        expect(data.project.name).toBe('Updated Project Name')
      }
    })

    test('異常系: 存在しないIDの更新は404エラー', async () => {
      const response = await fetch(`${API_BASE}/api/projects/non_existent_id_12345`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Updated Name'
        })
      })

      expect(response.status).toBe(404)
    })

    test('異常系: 存在しないパスへの更新は400エラー', async () => {
      const listResponse = await fetch(`${API_BASE}/api/projects`)
      const listData = await listResponse.json()

      if (listData.projects.length > 0) {
        const projectId = listData.projects[0].id

        const response = await fetch(`${API_BASE}/api/projects/${projectId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path: '/non/existent/path/12345'
          })
        })

        expect(response.status).toBe(400)
      }
    })
  })

  // ============================================
  // PUT /api/projects/:id/activate - アクティブ化
  // ============================================
  describe('PUT /api/projects/:id/activate', () => {
    test('正常系: プロジェクトをアクティブにできる', async () => {
      const listResponse = await fetch(`${API_BASE}/api/projects`)
      const listData = await listResponse.json()

      if (listData.projects.length > 0) {
        const projectId = listData.projects[0].id

        const response = await fetch(`${API_BASE}/api/projects/${projectId}/activate`, {
          method: 'PUT'
        })

        expect(response.ok).toBe(true)

        const data = await response.json()
        expect(data.project).toBeDefined()
        expect(data.message).toBe('Project activated')
      }
    })

    test('異常系: 存在しないIDのアクティブ化は404エラー', async () => {
      const response = await fetch(`${API_BASE}/api/projects/non_existent_id_12345/activate`, {
        method: 'PUT'
      })

      expect(response.status).toBe(404)
    })
  })

  // ============================================
  // DELETE /api/projects/:id - プロジェクト削除
  // ============================================
  describe('DELETE /api/projects/:id', () => {
    test('正常系: プロジェクトを削除できる', async () => {
      // 削除用のテストディレクトリを作成
      const deleteTestDir = join(TEST_DIR, 'delete-test-project')
      mkdirSync(deleteTestDir, { recursive: true })

      // プロジェクトを追加
      const addResponse = await fetch(`${API_BASE}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Project To Delete',
          path: deleteTestDir
        })
      })

      const addData = await addResponse.json()
      const projectId = addData.project.id

      // 削除
      const response = await fetch(`${API_BASE}/api/projects/${projectId}`, {
        method: 'DELETE'
      })

      expect(response.ok).toBe(true)

      const data = await response.json()
      expect(data.success).toBe(true)

      // 削除後に取得しても404
      const getResponse = await fetch(`${API_BASE}/api/projects/${projectId}`)
      expect(getResponse.status).toBe(404)
    })

    test('異常系: 存在しないIDの削除は404エラー', async () => {
      const response = await fetch(`${API_BASE}/api/projects/non_existent_id_12345`, {
        method: 'DELETE'
      })

      expect(response.status).toBe(404)
    })
  })

  // ============================================
  // 統合シナリオテスト
  // ============================================
  describe('統合シナリオ', () => {
    test('CRUD操作の完全なフロー', async () => {
      // 1. テスト用ディレクトリ作成
      const scenarioDir = join(TEST_DIR, 'scenario-test-project')
      mkdirSync(scenarioDir, { recursive: true })

      // 2. プロジェクト追加 (Create)
      const createResponse = await fetch(`${API_BASE}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Scenario Test Project',
          path: scenarioDir
        })
      })
      expect(createResponse.status).toBe(201)
      const createData = await createResponse.json()
      const projectId = createData.project.id

      // 3. プロジェクト取得 (Read)
      const readResponse = await fetch(`${API_BASE}/api/projects/${projectId}`)
      expect(readResponse.ok).toBe(true)
      const readData = await readResponse.json()
      expect(readData.project.name).toBe('Scenario Test Project')

      // 4. プロジェクト更新 (Update)
      const updateResponse = await fetch(`${API_BASE}/api/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Updated Scenario Project'
        })
      })
      expect(updateResponse.ok).toBe(true)
      const updateData = await updateResponse.json()
      expect(updateData.project.name).toBe('Updated Scenario Project')

      // 5. アクティブ化
      const activateResponse = await fetch(`${API_BASE}/api/projects/${projectId}/activate`, {
        method: 'PUT'
      })
      expect(activateResponse.ok).toBe(true)

      // 6. アクティブプロジェクト確認
      const activeResponse = await fetch(`${API_BASE}/api/projects/active`)
      expect(activeResponse.ok).toBe(true)
      const activeData = await activeResponse.json()
      expect(activeData.project?.id).toBe(projectId)

      // 7. プロジェクト削除 (Delete)
      const deleteResponse = await fetch(`${API_BASE}/api/projects/${projectId}`, {
        method: 'DELETE'
      })
      expect(deleteResponse.ok).toBe(true)

      // 8. 削除確認
      const verifyResponse = await fetch(`${API_BASE}/api/projects/${projectId}`)
      expect(verifyResponse.status).toBe(404)
    })
  })

  // ============================================
  // CORS テスト
  // ============================================
  describe('CORS', () => {
    test('OPTIONSリクエストが正しく処理される', async () => {
      const response = await fetch(`${API_BASE}/api/projects`, {
        method: 'OPTIONS'
      })

      expect(response.headers.get('access-control-allow-origin')).toBeDefined()
      expect(response.headers.get('access-control-allow-methods')).toContain('PUT')
      expect(response.headers.get('access-control-allow-methods')).toContain('DELETE')
    })
  })

  // ============================================
  // セキュリティテスト
  // ============================================
  describe('セキュリティ', () => {
    test('パストラバーサル攻撃を防ぐ', async () => {
      const response = await fetch(`${API_BASE}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Malicious Project',
          path: '/tmp/../../../etc/passwd'
        })
      })

      // パストラバーサルは検証で弾かれる or パスが存在しないとしてエラー
      expect(response.status).toBe(400)
    })
  })
})
