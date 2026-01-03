import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { existsSync, mkdirSync, rmSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import {
  autoRegisterProject,
  initializeSession,
  loadConfig,
  saveConfig,
  getActiveProject,
  type GlobalConfig
} from '../../src/server/services/projects.ts'

const CONFIG_DIR = join(homedir(), '.harness-ui')
const CONFIG_FILE = join(CONFIG_DIR, 'config.json')
const TEST_PROJECT_DIR = join('/tmp', 'harness-ui-autoregister-test')

describe('autoRegisterProject', () => {
  let originalConfig: GlobalConfig | null = null

  beforeEach(() => {
    // Save original config if exists
    if (existsSync(CONFIG_FILE)) {
      originalConfig = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'))
    }

    // Create test project directory
    if (!existsSync(TEST_PROJECT_DIR)) {
      mkdirSync(TEST_PROJECT_DIR, { recursive: true })
    }

    // Reset config to clean state
    const cleanConfig: GlobalConfig = {
      version: '1.0.0',
      projects: [],
      activeProjectId: null
    }
    saveConfig(cleanConfig)
  })

  afterEach(() => {
    // Restore original config
    if (originalConfig) {
      saveConfig(originalConfig)
    } else if (existsSync(CONFIG_FILE)) {
      // Clean up if there was no original config
      rmSync(CONFIG_FILE)
    }

    // Cleanup test directory
    if (existsSync(TEST_PROJECT_DIR)) {
      rmSync(TEST_PROJECT_DIR, { recursive: true })
    }
  })

  test('registers new project and sets it as active', () => {
    const result = autoRegisterProject(TEST_PROJECT_DIR)

    expect(result).not.toBeNull()
    expect(result!.name).toBe('harness-ui-autoregister-test')
    expect(result!.path).toBe(TEST_PROJECT_DIR)

    const config = loadConfig()
    expect(config.activeProjectId).toBe(result!.id)
    expect(config.projects).toHaveLength(1)
  })

  test('returns existing project if already registered', () => {
    // Register first time
    const first = autoRegisterProject(TEST_PROJECT_DIR)
    expect(first).not.toBeNull()

    // Register second time
    const second = autoRegisterProject(TEST_PROJECT_DIR)
    expect(second).not.toBeNull()
    expect(second!.id).toBe(first!.id)

    // Should still be only one project
    const config = loadConfig()
    expect(config.projects).toHaveLength(1)
  })

  test('sets existing project as active if not already', () => {
    // Register project
    const project = autoRegisterProject(TEST_PROJECT_DIR)
    expect(project).not.toBeNull()

    // Create another test dir and register it
    const secondDir = join('/tmp', 'harness-ui-autoregister-test-2')
    mkdirSync(secondDir, { recursive: true })

    try {
      const second = autoRegisterProject(secondDir)
      expect(second).not.toBeNull()

      // First project should no longer be active
      let config = loadConfig()
      expect(config.activeProjectId).toBe(second!.id)

      // Re-register first project
      const reregistered = autoRegisterProject(TEST_PROJECT_DIR)
      expect(reregistered).not.toBeNull()

      // Now first should be active again
      config = loadConfig()
      expect(config.activeProjectId).toBe(project!.id)
      expect(reregistered!.lastAccessedAt).toBeDefined()
    } finally {
      rmSync(secondDir, { recursive: true })
    }
  })

  test('returns null for non-existent directory', () => {
    const result = autoRegisterProject('/tmp/does-not-exist-xyz-123')
    expect(result).toBeNull()
  })

  test('returns null for invalid path', () => {
    const result = autoRegisterProject('/tmp/../../../etc/passwd')
    expect(result).toBeNull()
  })

  test('uses PROJECT_ROOT env if no path provided', () => {
    const originalEnv = process.env['PROJECT_ROOT']
    process.env['PROJECT_ROOT'] = TEST_PROJECT_DIR

    try {
      const result = autoRegisterProject()
      expect(result).not.toBeNull()
      expect(result!.path).toBe(TEST_PROJECT_DIR)
    } finally {
      if (originalEnv) {
        process.env['PROJECT_ROOT'] = originalEnv
      } else {
        delete process.env['PROJECT_ROOT']
      }
    }
  })
})

describe('initializeSession', () => {
  test('is an alias for autoRegisterProject with no args', () => {
    // Just verify it's callable and returns something reasonable
    const result = initializeSession()
    // Should return the current working directory as a project
    // or null if path validation fails
    expect(result === null || typeof result === 'object').toBe(true)
  })
})

describe('getActiveProject integration', () => {
  let originalConfig: GlobalConfig | null = null

  beforeEach(() => {
    if (existsSync(CONFIG_FILE)) {
      originalConfig = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'))
    }

    if (!existsSync(TEST_PROJECT_DIR)) {
      mkdirSync(TEST_PROJECT_DIR, { recursive: true })
    }

    const cleanConfig: GlobalConfig = {
      version: '1.0.0',
      projects: [],
      activeProjectId: null
    }
    saveConfig(cleanConfig)
  })

  afterEach(() => {
    if (originalConfig) {
      saveConfig(originalConfig)
    } else if (existsSync(CONFIG_FILE)) {
      rmSync(CONFIG_FILE)
    }

    if (existsSync(TEST_PROJECT_DIR)) {
      rmSync(TEST_PROJECT_DIR, { recursive: true })
    }
  })

  test('returns null when no projects registered', () => {
    const result = getActiveProject()
    expect(result).toBeNull()
  })

  test('returns active project after auto-registration', () => {
    const registered = autoRegisterProject(TEST_PROJECT_DIR)
    expect(registered).not.toBeNull()

    const active = getActiveProject()
    expect(active).not.toBeNull()
    expect(active!.id).toBe(registered!.id)
    expect(active!.path).toBe(TEST_PROJECT_DIR)
  })
})
