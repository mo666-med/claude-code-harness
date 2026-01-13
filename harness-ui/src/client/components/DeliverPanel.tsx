/**
 * Deliver Panel Component
 *
 * UI for deliver workflow (commit/push/PR/release)
 * - Preflight checks
 * - Commit with auto-generated message
 * - Push with branch protection
 * - PR creation via gh CLI
 * - Release template visualization
 */

import { useState, useEffect } from 'react'
import {
  getPreflight,
  executeCommit,
  executePush,
  createPR,
  getReleaseTemplates,
} from '../lib/deliver-api.ts'
import type {
  DeliverPreflight,
  DeliverCommitRequest,
  DeliverPushRequest,
  DeliverPRRequest,
  ReleaseTemplate,
} from '../../shared/types.ts'

interface DeliverPanelProps {
  projectPath: string
  suggestedCommitMessage?: string
  taskTitle?: string
  reviewSummary?: string
}

export function DeliverPanel({
  projectPath,
  suggestedCommitMessage,
  taskTitle,
  reviewSummary,
}: DeliverPanelProps) {
  const [preflight, setPreflight] = useState<DeliverPreflight | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [commitMessage, setCommitMessage] = useState('')
  const [prTitle, setPrTitle] = useState('')
  const [prBody, setPrBody] = useState('')
  const [releaseTemplates, setReleaseTemplates] = useState<ReleaseTemplate[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)

  // Load preflight on mount
  useEffect(() => {
    loadPreflight()
    loadReleaseTemplates()
  }, [projectPath, suggestedCommitMessage])

  // Auto-generate commit message from task/review
  useEffect(() => {
    if (taskTitle || reviewSummary) {
      const parts: string[] = []
      if (taskTitle) {
        parts.push(`feat: ${taskTitle}`)
      }
      if (reviewSummary) {
        parts.push(`\n\n${reviewSummary}`)
      }
      setCommitMessage(parts.join(''))
    } else if (suggestedCommitMessage) {
      setCommitMessage(suggestedCommitMessage)
    }
  }, [taskTitle, reviewSummary, suggestedCommitMessage])

  // Auto-generate PR title/body
  useEffect(() => {
    if (taskTitle) {
      setPrTitle(taskTitle)
      const bodyParts: string[] = []
      if (reviewSummary) {
        bodyParts.push('## 変更内容\n\n' + reviewSummary)
      }
      if (preflight?.branch) {
        bodyParts.push(`\n## ブランチ\n\n${preflight.branch}`)
      }
      setPrBody(bodyParts.join('\n'))
    }
  }, [taskTitle, reviewSummary, preflight?.branch])

  const loadPreflight = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await getPreflight(projectPath, suggestedCommitMessage)
      setPreflight(data)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const loadReleaseTemplates = async () => {
    try {
      const templates = await getReleaseTemplates(projectPath)
      setReleaseTemplates(templates)
      if (templates.length > 0 && templates[0]) {
        setSelectedTemplate(templates[0].name)
      }
    } catch (err) {
      console.error('Failed to load release templates:', err)
    }
  }

  const handleCommit = async () => {
    if (!commitMessage.trim()) {
      setError('コミットメッセージを入力してください')
      return
    }

    try {
      setLoading(true)
      setError(null)
      const result = await executeCommit(projectPath, {
        message: commitMessage,
      })

      if (result.success) {
        // Reload preflight to update state
        await loadPreflight()
        alert(`コミット成功: ${result.commitHash}`)
      } else {
        setError(result.error ?? 'コミットに失敗しました')
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handlePush = async () => {
    if (!preflight) return

    // Check for main/master push
    if (preflight.isMainBranch) {
      const confirmed = confirm(
        'main/master ブランチへの push は原則禁止です。続行しますか？'
      )
      if (!confirmed) return
    }

    try {
      setLoading(true)
      setError(null)
      const result = await executePush(projectPath, {
        branch: preflight.branch,
        force: false,
      })

      if (result.success) {
        await loadPreflight()
        alert('プッシュ成功')
      } else {
        setError(result.error ?? 'プッシュに失敗しました')
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handleCreatePR = async () => {
    if (!prTitle.trim()) {
      setError('PRタイトルを入力してください')
      return
    }

    try {
      setLoading(true)
      setError(null)
      const result = await createPR(projectPath, {
        title: prTitle,
        body: prBody,
        base: 'main',
      })

      if (result.success && result.prUrl) {
        alert(`PR作成成功: ${result.prUrl}`)
        window.open(result.prUrl, '_blank')
      } else if (!result.ghAvailable) {
        setError(result.error ?? 'GitHub CLI (gh) がインストールされていません')
      } else {
        setError(result.error ?? 'PR作成に失敗しました')
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  if (loading && !preflight) {
    return <div className="deliver-panel-loading">読み込み中...</div>
  }

  if (error && !preflight) {
    return (
      <div className="deliver-panel-error">
        <div>エラー: {error}</div>
        <button onClick={loadPreflight}>再読み込み</button>
      </div>
    )
  }

  if (!preflight) {
    return null
  }

  return (
    <div className="deliver-panel">
      <div className="deliver-panel-header">
        <h3>Deliver ワークフロー</h3>
        <button onClick={loadPreflight}>更新</button>
      </div>

      {/* Preflight status */}
      <div className="deliver-preflight">
        <h4>現在の状態</h4>
        <div className="deliver-preflight-info">
          <div>
            <strong>ブランチ:</strong> {preflight.branch}
            {preflight.isMainBranch && <span className="deliver-warning">⚠ main/master</span>}
          </div>
          <div>
            <strong>変更:</strong>{' '}
            {preflight.dirty
              ? `${preflight.stagedCount} staged, ${preflight.unstagedCount} unstaged`
              : 'なし'}
          </div>
          {preflight.remoteBranch && (
            <div>
              <strong>リモート:</strong> {preflight.remoteBranch} (
              {preflight.ahead > 0 && `+${preflight.ahead} `}
              {preflight.behind > 0 && `-${preflight.behind}`}
              {preflight.ahead === 0 && preflight.behind === 0 && '同期済み'})
            </div>
          )}
          {preflight.requiresForcePush && (
            <div className="deliver-warning">
              ⚠ リモートと分岐しています（force pushが必要）
            </div>
          )}
        </div>
      </div>

      {/* Commit */}
      <div className="deliver-section">
        <h4>1. コミット</h4>
        <textarea
          className="deliver-commit-message"
          value={commitMessage}
          onChange={(e) => setCommitMessage(e.target.value)}
          placeholder="コミットメッセージを入力..."
          rows={4}
        />
        <button
          className="deliver-commit-btn"
          onClick={handleCommit}
          disabled={loading || !preflight.dirty || !commitMessage.trim()}
        >
          コミット
        </button>
      </div>

      {/* Push */}
      <div className="deliver-section">
        <h4>2. プッシュ</h4>
        {preflight.isMainBranch ? (
          <div className="deliver-warning">
            main/master ブランチへの push は原則禁止です
          </div>
        ) : (
          <button
            className="deliver-push-btn"
            onClick={handlePush}
            disabled={loading || preflight.ahead === 0}
          >
            プッシュ ({preflight.ahead} commits)
          </button>
        )}
      </div>

      {/* PR */}
      <div className="deliver-section">
        <h4>3. PR作成</h4>
        <input
          type="text"
          className="deliver-pr-title"
          value={prTitle}
          onChange={(e) => setPrTitle(e.target.value)}
          placeholder="PRタイトル"
        />
        <textarea
          className="deliver-pr-body"
          value={prBody}
          onChange={(e) => setPrBody(e.target.value)}
          placeholder="PR本文"
          rows={6}
        />
        <button
          className="deliver-pr-btn"
          onClick={handleCreatePR}
          disabled={loading || !prTitle.trim() || preflight.isMainBranch}
        >
          PR作成（gh CLI）
        </button>
      </div>

      {/* Release templates */}
      {releaseTemplates.length > 0 && (
        <div className="deliver-section">
          <h4>4. リリース</h4>
          <select
            value={selectedTemplate ?? ''}
            onChange={(e) => setSelectedTemplate(e.target.value)}
          >
            {releaseTemplates.map((t) => (
              <option key={t.name} value={t.name}>
                {t.name} - {t.description}
              </option>
            ))}
          </select>
          {selectedTemplate && (
            <div className="deliver-release-steps">
              {releaseTemplates
                .find((t) => t.name === selectedTemplate)
                ?.steps.map((step) => (
                  <div key={step.id} className="deliver-release-step">
                    <input
                      type="checkbox"
                      checked={step.completed}
                      disabled
                      readOnly
                    />
                    <div>
                      <strong>{step.title}</strong>
                      {step.required && <span className="deliver-required">必須</span>}
                      <div>{step.description}</div>
                      {step.command && (
                        <code className="deliver-command">{step.command}</code>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {error && <div className="deliver-error">エラー: {error}</div>}
    </div>
  )
}
