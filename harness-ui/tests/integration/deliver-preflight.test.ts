/**
 * Deliver Preflight Integration Tests
 *
 * Tests for deliver preflight API endpoint
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { app } from '../../src/server/index.ts'
import { execSync } from 'node:child_process'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

describe('Deliver Preflight API', () => {
  let testProjectPath: string

  beforeAll(() => {
    // Create a temporary git repository for testing
    testProjectPath = join(tmpdir(), `harness-ui-test-${Date.now()}`)
    mkdirSync(testProjectPath, { recursive: true })

    // Initialize git repo
    execSync('git init', { cwd: testProjectPath })
    execSync('git config user.name "Test User"', { cwd: testProjectPath })
    execSync('git config user.email "test@example.com"', { cwd: testProjectPath })

    // Create initial commit
    writeFileSync(join(testProjectPath, 'README.md'), '# Test Project\n')
    execSync('git add README.md', { cwd: testProjectPath })
    execSync('git commit -m "Initial commit"', { cwd: testProjectPath })
  })

  afterAll(() => {
    // Cleanup
    rmSync(testProjectPath, { recursive: true, force: true })
  })

  it('should return preflight information', async () => {
    const response = await app.request(
      `/api/deliver/preflight?projectPath=${encodeURIComponent(testProjectPath)}`
    )

    expect(response.status).toBe(200)
    const data = await response.json()

    expect(data).toHaveProperty('branch')
    expect(data).toHaveProperty('dirty')
    expect(data).toHaveProperty('stagedCount')
    expect(data).toHaveProperty('unstagedCount')
    expect(data).toHaveProperty('ahead')
    expect(data).toHaveProperty('behind')
    expect(data).toHaveProperty('isMainBranch')
    expect(data).toHaveProperty('requiresForcePush')

    expect(typeof data.branch).toBe('string')
    expect(typeof data.dirty).toBe('boolean')
    expect(typeof data.stagedCount).toBe('number')
    expect(typeof data.unstagedCount).toBe('number')
    expect(typeof data.ahead).toBe('number')
    expect(typeof data.behind).toBe('number')
    expect(typeof data.isMainBranch).toBe('boolean')
    expect(typeof data.requiresForcePush).toBe('boolean')
  })

  it('should return 400 if projectPath is missing', async () => {
    const response = await app.request('/api/deliver/preflight')

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toContain('projectPath')
  })

  it('should detect dirty working directory', async () => {
    // Create a new file
    writeFileSync(join(testProjectPath, 'new-file.txt'), 'test content')

    const response = await app.request(
      `/api/deliver/preflight?projectPath=${encodeURIComponent(testProjectPath)}`
    )

    expect(response.status).toBe(200)
    const data = await response.json()

    expect(data.dirty).toBe(true)
    expect(data.unstagedCount).toBeGreaterThan(0)

    // Cleanup
    execSync('git checkout -- new-file.txt', { cwd: testProjectPath })
  })

  it('should accept suggested commit message', async () => {
    const suggestedMessage = 'feat: test feature'
    const response = await app.request(
      `/api/deliver/preflight?projectPath=${encodeURIComponent(testProjectPath)}&suggestedCommitMessage=${encodeURIComponent(suggestedMessage)}`
    )

    expect(response.status).toBe(200)
    const data = await response.json()

    expect(data.suggestedCommitMessage).toBe(suggestedMessage)
  })
})
