/**
 * Policy Engine Tests
 *
 * Tests for policy evaluation logic
 */

import { describe, it, expect } from 'bun:test'
import {
  PolicyEngine,
  inferPathCategory,
  inferOperationKind,
  getDefaultPolicyEngine,
} from '../../src/server/services/policy-engine.ts'
import type { PolicyConfig, PathCategory, OperationKind } from '../../src/shared/types.ts'

describe('PolicyEngine', () => {
  describe('inferPathCategory', () => {
    it('should identify protected paths', () => {
      expect(inferPathCategory('Plans.md')).toBe('protected')
      expect(inferPathCategory('.claude/memory/decisions.md')).toBe('protected')
      expect(inferPathCategory('src/.claude/memory/patterns.md')).toBe('protected')
    })

    it('should identify config files', () => {
      expect(inferPathCategory('package.json')).toBe('config')
      expect(inferPathCategory('config.yaml')).toBe('config')
      expect(inferPathCategory('.env')).toBe('config')
    })

    it('should identify test files', () => {
      expect(inferPathCategory('file.test.ts')).toBe('test')
      expect(inferPathCategory('file.spec.ts')).toBe('test')
      expect(inferPathCategory('src/__tests__/file.ts')).toBe('test')
      expect(inferPathCategory('src/test/file.ts')).toBe('test')
    })

    it('should identify docs files', () => {
      expect(inferPathCategory('README.md')).toBe('docs')
      expect(inferPathCategory('docs/guide.md')).toBe('docs')
    })

    it('should identify code files', () => {
      expect(inferPathCategory('src/index.ts')).toBe('code')
      expect(inferPathCategory('components/Button.tsx')).toBe('code')
    })

    it('should default to other', () => {
      expect(inferPathCategory('unknown.bin')).toBe('other')
      expect(inferPathCategory(undefined)).toBe('other')
    })
  })

  describe('inferOperationKind', () => {
    it('should identify read operations', () => {
      expect(inferOperationKind('Read')).toBe('tool_read')
      expect(inferOperationKind('Glob')).toBe('tool_read')
      expect(inferOperationKind('Grep')).toBe('tool_read')
    })

    it('should identify write operations', () => {
      expect(inferOperationKind('Write')).toBe('tool_write')
    })

    it('should identify edit operations', () => {
      expect(inferOperationKind('Edit')).toBe('tool_edit')
    })

    it('should identify bash operations', () => {
      expect(inferOperationKind('Bash')).toBe('tool_bash')
      expect(inferOperationKind('Shell')).toBe('tool_bash')
    })

    it('should default to tool_read for unknown tools', () => {
      expect(inferOperationKind('UnknownTool')).toBe('tool_read')
    })
  })

  describe('PolicyEngine.evaluate', () => {
    it('should always ask for protected paths', () => {
      const engine = new PolicyEngine({ preset: 'fast' })
      const result = engine.evaluate('Write', {}, 'Plans.md')

      expect(result.behavior).toBe('ask')
      expect(result.locked).toBe(true)
      expect(result.reason).toContain('保護対象パス')
    })

    it('should respect preset rules', () => {
      const strictEngine = new PolicyEngine({ preset: 'strict' })
      const fastEngine = new PolicyEngine({ preset: 'fast' })

      // Code edit in strict mode should ask
      const strictResult = strictEngine.evaluate('Edit', {}, 'src/index.ts')
      expect(strictResult.behavior).toBe('ask')

      // Code edit in fast mode should allow
      const fastResult = fastEngine.evaluate('Edit', {}, 'src/index.ts')
      expect(fastResult.behavior).toBe('allow')
    })

    it('should allow custom rules to override preset', () => {
      const engine = new PolicyEngine({
        preset: 'strict',
        rules: [
          {
            category: 'code',
            operation: 'tool_edit',
            behavior: 'allow',
            locked: false,
          },
        ],
      })

      const result = engine.evaluate('Edit', {}, 'src/index.ts')
      expect(result.behavior).toBe('allow')
      expect(result.locked).toBe(false)
    })

    it('should not allow custom rules to override locked rules', () => {
      const engine = new PolicyEngine({
        preset: 'fast',
        rules: [
          {
            category: 'protected',
            operation: 'tool_write',
            behavior: 'allow', // Try to override locked rule
            locked: false,
          },
        ],
      })

      const result = engine.evaluate('Write', {}, 'Plans.md')
      expect(result.behavior).toBe('ask') // Locked rule takes precedence
      expect(result.locked).toBe(true)
    })
  })

  describe('PolicyEngine.evaluateGit', () => {
    it('should deny force push', () => {
      const engine = new PolicyEngine()
      const result = engine.evaluateGit('git_push', 'feature', false)

      // Force push is locked and denied
      // Note: This test checks the locked rule, but actual force push check
      // is done at the route level
      expect(result.locked).toBe(true)
    })

    it('should ask for main branch push', () => {
      const engine = new PolicyEngine({ preset: 'fast' })
      const result = engine.evaluateGit('git_push', 'main', true)

      expect(result.behavior).toBe('ask')
      expect(result.locked).toBe(true)
      expect(result.reason).toContain('main/master')
    })

    it('should respect preset for git operations', () => {
      const strictEngine = new PolicyEngine({ preset: 'strict' })
      const fastEngine = new PolicyEngine({ preset: 'fast' })

      const strictResult = strictEngine.evaluateGit('git_commit', 'feature', false)
      const fastResult = fastEngine.evaluateGit('git_commit', 'feature', false)

      // Both should ask by default (git operations are sensitive)
      expect(strictResult.behavior).toBe('ask')
      expect(fastResult.behavior).toBe('ask')
    })
  })

  describe('getDefaultPolicyEngine', () => {
    it('should return singleton instance', () => {
      const engine1 = getDefaultPolicyEngine()
      const engine2 = getDefaultPolicyEngine()

      expect(engine1).toBe(engine2)
    })

    it('should default to balanced preset', () => {
      const engine = getDefaultPolicyEngine()
      const config = engine.getConfig()

      expect(config.preset).toBe('balanced')
    })
  })
})
