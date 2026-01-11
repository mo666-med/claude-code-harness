/**
 * Command Utils Unit Tests
 *
 * Task 7.2: スラッシュコマンド変換方式のテスト
 */

import { describe, it, expect } from 'bun:test'
import {
  looksLikePathOrUrl,
  extractCommandName,
  isKnownCommand,
  convertSlashCommand
} from '../../src/client/lib/command-utils.ts'

describe('command-utils', () => {
  describe('looksLikePathOrUrl', () => {
    it('should detect absolute paths', () => {
      expect(looksLikePathOrUrl('/Users/tachibanashuuta/file.txt')).toBe(true)
      expect(looksLikePathOrUrl('/home/user/project')).toBe(true)
      expect(looksLikePathOrUrl('/etc/passwd')).toBe(true)
      expect(looksLikePathOrUrl('/var/log/syslog')).toBe(true)
    })

    it('should detect URLs', () => {
      expect(looksLikePathOrUrl('http://example.com')).toBe(true)
      expect(looksLikePathOrUrl('https://api.example.com/path')).toBe(true)
      expect(looksLikePathOrUrl('file:///path/to/file')).toBe(true)
    })

    it('should not detect slash commands', () => {
      expect(looksLikePathOrUrl('/work')).toBe(false)
      expect(looksLikePathOrUrl('/harness-init')).toBe(false)
      expect(looksLikePathOrUrl('/plan-with-agent')).toBe(false)
    })

    it('should not detect regular text', () => {
      expect(looksLikePathOrUrl('hello world')).toBe(false)
      expect(looksLikePathOrUrl('some text')).toBe(false)
    })
  })

  describe('extractCommandName', () => {
    it('should extract command name from single command', () => {
      expect(extractCommandName('/work')).toBe('work')
      expect(extractCommandName('/harness-init')).toBe('harness-init')
      expect(extractCommandName('/plan-with-agent')).toBe('plan-with-agent')
    })

    it('should extract command name from command with args', () => {
      expect(extractCommandName('/work --force')).toBe('work')
      expect(extractCommandName('/help something')).toBe('help')
      expect(extractCommandName('/search query text here')).toBe('search')
    })

    it('should handle whitespace', () => {
      expect(extractCommandName('  /work  ')).toBe('work')
      expect(extractCommandName('/work   arg1  arg2')).toBe('work')
    })

    it('should return null for non-slash inputs', () => {
      expect(extractCommandName('hello')).toBe(null)
      expect(extractCommandName('')).toBe(null)
      expect(extractCommandName('   ')).toBe(null)
    })

    it('should return null for just slash', () => {
      expect(extractCommandName('/')).toBe(null)
    })
  })

  describe('isKnownCommand', () => {
    const knownCommands = ['work', 'harness-init', 'help', 'plan-with-agent']

    it('should return true for known commands', () => {
      expect(isKnownCommand('work', knownCommands)).toBe(true)
      expect(isKnownCommand('harness-init', knownCommands)).toBe(true)
      expect(isKnownCommand('plan-with-agent', knownCommands)).toBe(true)
    })

    it('should return false for unknown commands', () => {
      expect(isKnownCommand('unknown', knownCommands)).toBe(false)
      expect(isKnownCommand('Users', knownCommands)).toBe(false)
      expect(isKnownCommand('etc', knownCommands)).toBe(false)
    })
  })

  describe('convertSlashCommand', () => {
    const knownCommands = ['work', 'harness-init', 'help', 'plan-with-agent', 'harness-review']

    describe('should convert known commands', () => {
      it('single command without args', () => {
        expect(convertSlashCommand('/work', knownCommands)).toBe('work を実行して')
        expect(convertSlashCommand('/harness-init', knownCommands)).toBe('harness-init を実行して')
      })

      it('command with arguments', () => {
        expect(convertSlashCommand('/work --force', knownCommands)).toBe('work を実行して --force')
        expect(convertSlashCommand('/help something', knownCommands)).toBe('help を実行して something')
        expect(convertSlashCommand('/harness-review file.ts', knownCommands)).toBe('harness-review を実行して file.ts')
      })
    })

    describe('should NOT convert unknown commands', () => {
      it('unknown command names', () => {
        expect(convertSlashCommand('/unknown', knownCommands)).toBe('/unknown')
        expect(convertSlashCommand('/foo bar', knownCommands)).toBe('/foo bar')
      })
    })

    describe('should NOT convert paths', () => {
      it('absolute paths', () => {
        expect(convertSlashCommand('/Users/tachibanashuuta/file.txt', knownCommands))
          .toBe('/Users/tachibanashuuta/file.txt')
        expect(convertSlashCommand('/home/user/project', knownCommands))
          .toBe('/home/user/project')
        expect(convertSlashCommand('/etc/passwd', knownCommands))
          .toBe('/etc/passwd')
      })
    })

    describe('should NOT convert URLs', () => {
      it('http/https URLs', () => {
        // URLs don't start with / so they pass through unchanged
        expect(convertSlashCommand('https://example.com', knownCommands))
          .toBe('https://example.com')
      })
    })

    describe('should pass through regular text', () => {
      it('non-slash inputs', () => {
        expect(convertSlashCommand('hello world', knownCommands)).toBe('hello world')
        expect(convertSlashCommand('implement this feature', knownCommands)).toBe('implement this feature')
      })

      it('handles whitespace', () => {
        expect(convertSlashCommand('  /work  ', knownCommands)).toBe('work を実行して')
        expect(convertSlashCommand('  hello  ', knownCommands)).toBe('hello')
      })
    })
  })
})
