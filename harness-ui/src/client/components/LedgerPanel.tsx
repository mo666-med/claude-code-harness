/**
 * Ledger Panel Component
 *
 * Displays all tool and git operations in a ledger format
 * - Shows pending/approved/denied/auto status
 * - Allows scoped approvals (e.g., "allow all code edits for this task")
 * - Provides audit trail for all operations
 */

import { useState, useMemo } from 'react'
import type { LedgerEvent, PolicyScope, PathCategory, OperationKind } from '../../shared/types.ts'

interface LedgerPanelProps {
  events: LedgerEvent[]
  onApprove: (eventId: string) => void
  onDeny: (eventId: string, reason?: string) => void
  onScopeApprove: (category: PathCategory, operation: OperationKind, scope: PolicyScope) => void
}

export function LedgerPanel({
  events,
  onApprove,
  onDeny,
  onScopeApprove,
}: LedgerPanelProps) {
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'denied' | 'auto'>('all')
  const [filterCategory, setFilterCategory] = useState<PathCategory | 'all'>('all')
  const [filterOperation, setFilterOperation] = useState<OperationKind | 'all'>('all')

  // Filter events
  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      if (filterStatus !== 'all' && event.status !== filterStatus) return false
      if (filterCategory !== 'all' && event.category !== filterCategory) return false
      if (filterOperation !== 'all' && event.operation !== filterOperation) return false
      return true
    })
  }, [events, filterStatus, filterCategory, filterOperation])

  // Group events by status for summary
  const statusCounts = useMemo(() => {
    const counts = { pending: 0, approved: 0, denied: 0, auto: 0 }
    events.forEach((event) => {
      counts[event.status]++
    })
    return counts
  }, [events])

  // Get status badge color
  const getStatusColor = (status: LedgerEvent['status']) => {
    switch (status) {
      case 'pending':
        return '#f59e0b' // amber
      case 'approved':
        return '#10b981' // green
      case 'denied':
        return '#ef4444' // red
      case 'auto':
        return '#3b82f6' // blue
      default:
        return '#6b7280' // gray
    }
  }

  // Get operation label
  const getOperationLabel = (operation: OperationKind) => {
    const labels: Record<OperationKind, string> = {
      tool_read: 'Read',
      tool_write: 'Write',
      tool_edit: 'Edit',
      tool_bash: 'Bash',
      git_commit: 'Commit',
      git_push: 'Push',
      git_pr: 'PR',
      git_release: 'Release',
    }
    return labels[operation] ?? operation
  }

  // Get category label
  const getCategoryLabel = (category: PathCategory) => {
    const labels: Record<PathCategory, string> = {
      protected: '保護',
      config: '設定',
      code: 'コード',
      test: 'テスト',
      docs: 'ドキュメント',
      other: 'その他',
    }
    return labels[category] ?? category
  }

  return (
    <div className="ledger-panel">
      <div className="ledger-panel-header">
        <h3>操作台帳</h3>
        <div className="ledger-status-summary">
          <span style={{ color: getStatusColor('pending') }}>待機: {statusCounts.pending}</span>
          <span style={{ color: getStatusColor('approved') }}>承認: {statusCounts.approved}</span>
          <span style={{ color: getStatusColor('denied') }}>拒否: {statusCounts.denied}</span>
          <span style={{ color: getStatusColor('auto') }}>自動: {statusCounts.auto}</span>
        </div>
      </div>

      {/* Filters */}
      <div className="ledger-filters">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
        >
          <option value="all">すべて</option>
          <option value="pending">待機中</option>
          <option value="approved">承認済</option>
          <option value="denied">拒否済</option>
          <option value="auto">自動承認</option>
        </select>

        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value as typeof filterCategory)}
        >
          <option value="all">すべてのカテゴリ</option>
          <option value="protected">保護</option>
          <option value="config">設定</option>
          <option value="code">コード</option>
          <option value="test">テスト</option>
          <option value="docs">ドキュメント</option>
          <option value="other">その他</option>
        </select>

        <select
          value={filterOperation}
          onChange={(e) => setFilterOperation(e.target.value as typeof filterOperation)}
        >
          <option value="all">すべての操作</option>
          <option value="tool_read">Read</option>
          <option value="tool_write">Write</option>
          <option value="tool_edit">Edit</option>
          <option value="tool_bash">Bash</option>
          <option value="git_commit">Commit</option>
          <option value="git_push">Push</option>
          <option value="git_pr">PR</option>
          <option value="git_release">Release</option>
        </select>
      </div>

      {/* Events list */}
      <div className="ledger-events">
        {filteredEvents.length === 0 ? (
          <div className="ledger-empty">イベントがありません</div>
        ) : (
          filteredEvents.map((event) => (
            <div key={event.id} className="ledger-event">
              <div className="ledger-event-header">
                <span
                  className="ledger-event-status"
                  style={{ backgroundColor: getStatusColor(event.status) }}
                >
                  {event.status === 'pending' && '待機'}
                  {event.status === 'approved' && '承認'}
                  {event.status === 'denied' && '拒否'}
                  {event.status === 'auto' && '自動'}
                </span>
                <span className="ledger-event-operation">
                  {getOperationLabel(event.operation)}
                </span>
                <span className="ledger-event-category">
                  {getCategoryLabel(event.category)}
                </span>
                <span className="ledger-event-time">
                  {new Date(event.timestamp).toLocaleTimeString()}
                </span>
              </div>

              <div className="ledger-event-details">
                {event.toolName && (
                  <div className="ledger-event-tool">ツール: {event.toolName}</div>
                )}
                {event.filePath && (
                  <div className="ledger-event-path">パス: {event.filePath}</div>
                )}
                {event.gitBranch && (
                  <div className="ledger-event-branch">ブランチ: {event.gitBranch}</div>
                )}
                {event.reason && (
                  <div className="ledger-event-reason">理由: {event.reason}</div>
                )}
              </div>

              {/* Actions for pending events */}
              {event.status === 'pending' && (
                <div className="ledger-event-actions">
                  <button
                    className="ledger-approve-btn"
                    onClick={() => onApprove(event.id)}
                  >
                    承認
                  </button>
                  <button
                    className="ledger-deny-btn"
                    onClick={() => onDeny(event.id)}
                  >
                    拒否
                  </button>
                  <button
                    className="ledger-scope-approve-btn"
                    onClick={() => {
                      // Scope approval: allow all operations of this category/operation for current task
                      onScopeApprove(event.category, event.operation, 'task')
                    }}
                  >
                    このタスク中は自動承認
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Scope approval quick actions */}
      {statusCounts.pending > 0 && (
        <div className="ledger-scope-actions">
          <h4>まとめて承認</h4>
          <div className="ledger-scope-buttons">
            <button
              onClick={() => {
                // Approve all pending code edits for current task
                onScopeApprove('code', 'tool_edit', 'task')
              }}
            >
              コード編集をこのタスク中は自動承認
            </button>
            <button
              onClick={() => {
                // Approve all pending test edits for current task
                onScopeApprove('test', 'tool_edit', 'task')
              }}
            >
              テスト編集をこのタスク中は自動承認
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
