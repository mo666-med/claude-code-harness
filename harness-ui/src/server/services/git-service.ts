/**
 * Git Service
 *
 * Provides git operations for deliver workflow
 * - Preflight checks (branch, dirty, staged, ahead/behind)
 * - Commit, push, PR creation (via gh CLI)
 * - Release template loading
 */

import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type {
  DeliverPreflight,
  DeliverCommitRequest,
  DeliverCommitResponse,
  DeliverPushRequest,
  DeliverPushResponse,
  DeliverPRRequest,
  DeliverPRResponse,
  ReleaseTemplate,
} from '../../shared/types.ts'

/**
 * Execute git command and return output
 */
function execGit(command: string, cwd: string): string {
  try {
    return execSync(`git ${command}`, { cwd, encoding: 'utf-8', stdio: 'pipe' }).trim()
  } catch (error) {
    const err = error as { stderr?: string; message?: string }
    throw new Error(`Git command failed: ${command}\n${err.stderr ?? err.message ?? 'Unknown error'}`)
  }
}

/**
 * Check if gh CLI is available
 */
export function isGhCliAvailable(): boolean {
  try {
    execSync('gh --version', { stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

/**
 * Get preflight information for deliver workflow
 */
export function getPreflight(projectPath: string, suggestedCommitMessage?: string): DeliverPreflight {
  const cwd = projectPath

  // Get current branch
  const branch = execGit('rev-parse --abbrev-ref HEAD', cwd)

  // Check if working directory is dirty
  const statusOutput = execGit('status --porcelain', cwd)
  const dirty = statusOutput.length > 0

  // Count staged and unstaged files
  const stagedFiles = execGit('diff --cached --name-only', cwd).split('\n').filter(Boolean)
  const unstagedFiles = execGit('diff --name-only', cwd).split('\n').filter(Boolean)
  const stagedCount = stagedFiles.length
  const unstagedCount = unstagedFiles.length

  // Check ahead/behind remote
  let ahead = 0
  let behind = 0
  let remoteBranch: string | undefined
  let requiresForcePush = false

  try {
    // Get remote tracking branch
    const remoteTracking = execGit('rev-parse --abbrev-ref --symbolic-full-name @{u}', cwd).trim()
    if (remoteTracking && remoteTracking !== '@{u}') {
      remoteBranch = remoteTracking.replace(/^[^/]+\//, '') // Remove remote name

      // Get ahead/behind counts
      const aheadBehind = execGit(`rev-list --left-right --count ${remoteTracking}...HEAD`, cwd).trim()
      const [behindCount, aheadCount] = aheadBehind.split('\t').map(Number)
      ahead = aheadCount || 0
      behind = behindCount || 0

      // Check if force push would be required (local has diverged)
      if (behind > 0) {
        requiresForcePush = true
      }
    }
  } catch {
    // No remote tracking branch
  }

  // Check if this is main/master branch
  const isMainBranch = branch === 'main' || branch === 'master'

  return {
    branch,
    dirty,
    stagedCount,
    unstagedCount,
    ahead,
    behind,
    remoteBranch,
    requiresForcePush,
    isMainBranch,
    suggestedCommitMessage,
  }
}

/**
 * Execute git commit
 */
export function executeCommit(
  projectPath: string,
  request: DeliverCommitRequest
): DeliverCommitResponse {
  const cwd = projectPath

  try {
    // Check if there are staged changes
    const stagedFiles = execGit('diff --cached --name-only', cwd).split('\n').filter(Boolean)
    if (stagedFiles.length === 0) {
      return {
        success: false,
        error: 'コミットする変更がありません（ステージングされていないファイルがあります）',
      }
    }

    // Execute commit
    const commitArgs = request.skipHooks ? ['--no-verify'] : []
    const commitHash = execGit(`commit -m "${request.message.replace(/"/g, '\\"')}" ${commitArgs.join(' ')}`, cwd)

    // Extract commit hash from output (git commit returns hash on success)
    const hashMatch = commitHash.match(/^[a-f0-9]{7,}/i)
    const hash = hashMatch ? hashMatch[0] : execGit('rev-parse HEAD', cwd)

    return {
      success: true,
      commitHash: hash,
    }
  } catch (error) {
    const err = error as { message?: string }
    return {
      success: false,
      error: err.message ?? 'コミットに失敗しました',
    }
  }
}

/**
 * Execute git push
 */
export function executePush(
  projectPath: string,
  request: DeliverPushRequest
): DeliverPushResponse {
  const cwd = projectPath
  const remote = request.remote ?? 'origin'

  try {
    // Build push command
    const pushArgs: string[] = []
    if (request.force) {
      pushArgs.push('--force')
    }
    pushArgs.push(remote)
    pushArgs.push(request.branch)

    execGit(`push ${pushArgs.join(' ')}`, cwd)

    return {
      success: true,
    }
  } catch (error) {
    const err = error as { message?: string }
    return {
      success: false,
      error: err.message ?? 'プッシュに失敗しました',
    }
  }
}

/**
 * Create GitHub PR using gh CLI
 */
export function createPR(
  projectPath: string,
  request: DeliverPRRequest
): DeliverPRResponse {
  const cwd = projectPath

  // Check if gh CLI is available
  if (!isGhCliAvailable()) {
    return {
      success: false,
      error: 'GitHub CLI (gh) がインストールされていません。インストール方法: https://cli.github.com/',
      ghAvailable: false,
    }
  }

  try {
    const base = request.base ?? 'main'
    const head = request.head ?? execGit('rev-parse --abbrev-ref HEAD', cwd)

    // Build gh pr create command
    const args: string[] = [
      'pr',
      'create',
      '--title',
      request.title,
      '--body',
      request.body,
      '--base',
      base,
      '--head',
      head,
    ]

    if (request.draft) {
      args.push('--draft')
    }

    const output = execSync(`gh ${args.join(' ')}`, { cwd, encoding: 'utf-8', stdio: 'pipe' }).trim()

    // Extract PR URL and number from output
    // Example: "https://github.com/owner/repo/pull/123"
    const urlMatch = output.match(/https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/(\d+)/)
    const prNumber = urlMatch && urlMatch[1] ? parseInt(urlMatch[1], 10) : undefined
    const prUrl = urlMatch ? urlMatch[0] : output

    return {
      success: true,
      prUrl,
      prNumber,
      ghAvailable: true,
    }
  } catch (error) {
    const err = error as { stderr?: string; message?: string }
    return {
      success: false,
      error: err.stderr ?? err.message ?? 'PR作成に失敗しました',
      ghAvailable: true,
    }
  }
}

/**
 * Load release template from project
 */
export function loadReleaseTemplate(projectPath: string, templateName?: string): ReleaseTemplate | null {
  // Try to load from .harness-ui/release-template.json
  const templatePath = join(projectPath, '.harness-ui', 'release-template.json')
  if (existsSync(templatePath)) {
    try {
      const content = readFileSync(templatePath, 'utf-8')
      const template = JSON.parse(content) as ReleaseTemplate
      if (!templateName || template.name === templateName) {
        return template
      }
    } catch {
      // Invalid JSON or file read error
    }
  }

  // Return default template if none found
  return null
}

/**
 * Get available release templates
 */
export function getReleaseTemplates(projectPath: string): ReleaseTemplate[] {
  const templates: ReleaseTemplate[] = []

  // Load from .harness-ui/release-template.json
  const templatePath = join(projectPath, '.harness-ui', 'release-template.json')
  if (existsSync(templatePath)) {
    try {
      const content = readFileSync(templatePath, 'utf-8')
      const template = JSON.parse(content) as ReleaseTemplate
      templates.push(template)
    } catch {
      // Invalid JSON or file read error
    }
  }

  // Add default template if none found
  if (templates.length === 0) {
    templates.push({
      name: 'default',
      description: 'デフォルトリリーステンプレート',
      steps: [
        {
          id: 'version-bump',
          title: 'バージョン番号の更新',
          description: 'CHANGELOG.md と package.json のバージョンを更新',
          required: true,
          completed: false,
        },
        {
          id: 'changelog',
          title: 'CHANGELOG.md の更新',
          description: '変更内容を CHANGELOG.md に追加',
          required: true,
          completed: false,
        },
        {
          id: 'tests',
          title: 'テストの実行',
          description: 'すべてのテストがパスすることを確認',
          required: true,
          completed: false,
          command: 'bun test',
        },
        {
          id: 'build',
          title: 'ビルドの実行',
          description: 'プロジェクトをビルドしてエラーがないことを確認',
          required: true,
          completed: false,
          command: 'bun run build',
        },
      ],
    })
  }

  return templates
}
