/**
 * ProjectSelector - プロジェクト切り替えコンポーネント
 *
 * claude-mem のような右上のプロジェクトセレクター
 */

import React, { useState, useEffect, useRef } from 'react'
import {
  fetchProjects,
  addProject,
  removeProject,
  activateProject,
  type Project,
} from '../lib/api'

interface ProjectSelectorProps {
  onProjectChange?: (project: Project | null) => void
}

export function ProjectSelector({ onProjectChange }: ProjectSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [projects, setProjects] = useState<Project[]>([])
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // プロジェクト一覧を取得
  const loadProjects = async () => {
    try {
      setLoading(true)
      const data = await fetchProjects()
      setProjects(data.projects)
      setActiveProjectId(data.activeProjectId)
      setError(null)

      // コールバック通知
      if (onProjectChange) {
        const activeProject = data.projects.find((p) => p.id === data.activeProjectId) ?? null
        onProjectChange(activeProject)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load projects')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProjects()
  }, [])

  // クリック外で閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // プロジェクト選択
  const handleSelect = async (project: Project) => {
    try {
      await activateProject(project.id)
      setActiveProjectId(project.id)
      setIsOpen(false)
      if (onProjectChange) {
        onProjectChange(project)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to activate project')
    }
  }

  // プロジェクト削除
  const handleRemove = async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation()
    if (!confirm('このプロジェクトを削除しますか？')) return

    try {
      await removeProject(projectId)
      await loadProjects()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove project')
    }
  }

  const activeProject = projects.find((p) => p.id === activeProjectId)

  return (
    <div className="project-selector" ref={dropdownRef}>
      {/* セレクターボタン */}
      <button
        className="project-selector-button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={loading}
      >
        <span className="project-name">
          {loading ? 'Loading...' : activeProject?.name ?? 'All Projects'}
        </span>
        <svg
          className={`chevron ${isOpen ? 'open' : ''}`}
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="currentColor"
        >
          <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
        </svg>
      </button>

      {/* ドロップダウン */}
      {isOpen && (
        <div className="project-dropdown">
          {error && <div className="project-error">{error}</div>}

          {/* All Projects オプション */}
          <button
            className={`project-item ${!activeProjectId ? 'active' : ''}`}
            onClick={() => {
              setActiveProjectId(null)
              setIsOpen(false)
              if (onProjectChange) onProjectChange(null)
            }}
          >
            <span className="project-item-icon">✓</span>
            <span className="project-item-name">All Projects</span>
          </button>

          <div className="project-divider" />

          {/* プロジェクト一覧 */}
          {projects.length === 0 ? (
            <div className="project-empty">プロジェクトがありません</div>
          ) : (
            projects.map((project) => (
              <button
                key={project.id}
                className={`project-item ${project.id === activeProjectId ? 'active' : ''}`}
                onClick={() => handleSelect(project)}
              >
                <span className="project-item-icon">
                  {project.id === activeProjectId ? '✓' : ''}
                </span>
                <span className="project-item-name">{project.name}</span>
                <button
                  className="project-item-remove"
                  onClick={(e) => handleRemove(e, project.id)}
                  title="削除"
                >
                  ×
                </button>
              </button>
            ))
          )}

          <div className="project-divider" />

          {/* プロジェクト追加ボタン */}
          <button className="project-add-button" onClick={() => setIsAddModalOpen(true)}>
            + プロジェクトを追加
          </button>
        </div>
      )}

      {/* プロジェクト追加モーダル */}
      {isAddModalOpen && (
        <AddProjectModal
          onClose={() => setIsAddModalOpen(false)}
          onAdd={async (name, path) => {
            try {
              await addProject(name, path)
              await loadProjects()
              setIsAddModalOpen(false)
            } catch (err) {
              throw err
            }
          }}
        />
      )}
    </div>
  )
}

// プロジェクト追加モーダル
interface AddProjectModalProps {
  onClose: () => void
  onAdd: (name: string, path: string) => Promise<void>
}

function AddProjectModal({ onClose, onAdd }: AddProjectModalProps) {
  const [name, setName] = useState('')
  const [path, setPath] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !path.trim()) {
      setError('名前とパスを入力してください')
      return
    }

    try {
      setSubmitting(true)
      setError(null)
      await onAdd(name.trim(), path.trim())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add project')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>プロジェクトを追加</h3>
        <form onSubmit={handleSubmit}>
          {error && <div className="modal-error">{error}</div>}
          <div className="form-group">
            <label htmlFor="project-name">プロジェクト名</label>
            <input
              id="project-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: JARVIS"
              autoFocus
            />
          </div>
          <div className="form-group">
            <label htmlFor="project-path">プロジェクトパス</label>
            <input
              id="project-path"
              type="text"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="例: /Users/you/projects/jarvis"
            />
          </div>
          <div className="modal-actions">
            <button type="button" onClick={onClose} disabled={submitting}>
              キャンセル
            </button>
            <button type="submit" className="primary" disabled={submitting}>
              {submitting ? '追加中...' : '追加'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default ProjectSelector
