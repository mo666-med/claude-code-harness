/**
 * Policy Settings Component
 *
 * UI for configuring policy presets and custom rules
 * - Preset selection (strict/balanced/fast)
 * - Category-specific toggles
 * - Locked rules display (non-editable)
 */

import { useState, useEffect } from 'react'
import type {
  PolicyPreset,
  PolicyConfig,
  PolicyRule,
  PathCategory,
  OperationKind,
  PolicyBehavior,
} from '../../shared/types.ts'

interface PolicySettingsProps {
  config: PolicyConfig
  onConfigChange: (config: Partial<PolicyConfig>) => void
}

export function PolicySettings({ config, onConfigChange }: PolicySettingsProps) {
  const [localPreset, setLocalPreset] = useState<PolicyPreset>(config.preset)
  const [localRules, setLocalRules] = useState<PolicyRule[]>(config.rules)

  useEffect(() => {
    setLocalPreset(config.preset)
    setLocalRules(config.rules)
  }, [config])

  // Handle preset change
  const handlePresetChange = (preset: PolicyPreset) => {
    setLocalPreset(preset)
    onConfigChange({ preset, rules: [] }) // Reset custom rules when preset changes
  }

  // Handle rule toggle
  const handleRuleToggle = (category: PathCategory, operation: OperationKind, behavior: PolicyBehavior) => {
    const existingRuleIndex = localRules.findIndex(
      (r) => r.category === category && r.operation === operation
    )

    let newRules: PolicyRule[]
    if (existingRuleIndex >= 0) {
      // Update existing rule
      newRules = [...localRules]
      const existingRule = newRules[existingRuleIndex]
      if (existingRule) {
        newRules[existingRuleIndex] = {
          ...existingRule,
          behavior,
        }
      }
    } else {
      // Add new rule
      newRules = [
        ...localRules,
        {
          category,
          operation,
          behavior,
          locked: false,
        },
      ]
    }

    setLocalRules(newRules)
    onConfigChange({ rules: newRules })
  }

  // Get rule behavior for category/operation
  const getRuleBehavior = (category: PathCategory, operation: OperationKind): PolicyBehavior => {
    // Check custom rules first
    const customRule = localRules.find((r) => r.category === category && r.operation === operation)
    if (customRule && !customRule.locked) {
      return customRule.behavior
    }

    // Return default based on preset (simplified - in real implementation, load from preset)
    if (localPreset === 'strict') {
      return 'ask'
    }
    if (localPreset === 'balanced') {
      if (category === 'protected' || category === 'config') return 'ask'
      if (operation === 'tool_bash' || operation === 'git_push' || operation === 'git_pr') return 'ask'
      return 'allow'
    }
    // fast
    if (category === 'protected' || category === 'config') return 'ask'
    return 'allow'
  }

  // Check if rule is locked
  const isRuleLocked = (category: PathCategory, operation: OperationKind): boolean => {
    const rule = localRules.find((r) => r.category === category && r.operation === operation)
    return rule?.locked ?? false
  }

  // Get locked reason
  const getLockedReason = (category: PathCategory, operation: OperationKind): string | undefined => {
    const rule = localRules.find((r) => r.category === category && r.operation === operation)
    return rule?.lockedReason
  }

  // Operation labels
  const operationLabels: Record<OperationKind, string> = {
    tool_read: 'Read',
    tool_write: 'Write',
    tool_edit: 'Edit',
    tool_bash: 'Bash',
    git_commit: 'Commit',
    git_push: 'Push',
    git_pr: 'PR',
    git_release: 'Release',
  }

  // Category labels
  const categoryLabels: Record<PathCategory, string> = {
    protected: '保護',
    config: '設定',
    code: 'コード',
    test: 'テスト',
    docs: 'ドキュメント',
    other: 'その他',
  }

  // Behavior labels
  const behaviorLabels: Record<PolicyBehavior, string> = {
    allow: '自動承認',
    ask: '承認要求',
    deny: '拒否',
  }

  return (
    <div className="policy-settings">
      <div className="policy-settings-header">
        <h3>ポリシー設定</h3>
      </div>

      {/* Preset selection */}
      <div className="policy-preset-section">
        <label>プリセット</label>
        <div className="policy-preset-buttons">
          <button
            className={localPreset === 'strict' ? 'active' : ''}
            onClick={() => handlePresetChange('strict')}
          >
            Strict（厳格）
          </button>
          <button
            className={localPreset === 'balanced' ? 'active' : ''}
            onClick={() => handlePresetChange('balanced')}
          >
            Balanced（バランス）
          </button>
          <button
            className={localPreset === 'fast' ? 'active' : ''}
            onClick={() => handlePresetChange('fast')}
          >
            Fast（高速）
          </button>
        </div>
        <div className="policy-preset-description">
          {localPreset === 'strict' && 'ほとんどの操作に承認が必要です'}
          {localPreset === 'balanced' && '重要な操作に承認が必要です'}
          {localPreset === 'fast' && 'ほとんどの操作が自動承認されます（保護パスは除く）'}
        </div>
      </div>

      {/* Category-specific rules */}
      <div className="policy-rules-section">
        <h4>カテゴリ別設定</h4>
        {(['code', 'test', 'docs', 'config', 'other'] as PathCategory[]).map((category) => (
          <div key={category} className="policy-category-group">
            <h5>{categoryLabels[category]}</h5>
            {(['tool_write', 'tool_edit', 'tool_bash'] as OperationKind[]).map((operation) => {
              const locked = isRuleLocked(category, operation)
              const behavior = getRuleBehavior(category, operation)
              const lockedReason = getLockedReason(category, operation)

              return (
                <div key={operation} className="policy-rule-row">
                  <span className="policy-rule-label">
                    {operationLabels[operation]}
                    {locked && <span className="policy-locked-badge">🔒 ロック</span>}
                  </span>
                  {locked ? (
                    <div className="policy-locked-info">
                      <span className="policy-locked-behavior">{behaviorLabels[behavior]}</span>
                      {lockedReason && (
                        <span className="policy-locked-reason" title={lockedReason}>
                          {lockedReason}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="policy-rule-buttons">
                      {(['allow', 'ask', 'deny'] as PolicyBehavior[]).map((b) => (
                        <button
                          key={b}
                          className={behavior === b ? 'active' : ''}
                          onClick={() => handleRuleToggle(category, operation, b)}
                        >
                          {behaviorLabels[b]}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ))}

        {/* Protected category (always locked) */}
        <div className="policy-category-group">
          <h5>{categoryLabels.protected}</h5>
          <div className="policy-locked-notice">
            保護パス（Plans.md, .claude/memory/**）は常に承認が必要です（変更不可）
          </div>
        </div>
      </div>

      {/* Git operations */}
      <div className="policy-git-section">
        <h4>Git操作</h4>
        {(['git_commit', 'git_push', 'git_pr'] as OperationKind[]).map((operation) => {
          const locked = isRuleLocked('other', operation)
          const behavior = getRuleBehavior('other', operation)
          const lockedReason = getLockedReason('other', operation)

          return (
            <div key={operation} className="policy-rule-row">
              <span className="policy-rule-label">
                {operationLabels[operation]}
                {locked && <span className="policy-locked-badge">🔒 ロック</span>}
              </span>
              {locked ? (
                <div className="policy-locked-info">
                  <span className="policy-locked-behavior">{behaviorLabels[behavior]}</span>
                  {lockedReason && (
                    <span className="policy-locked-reason" title={lockedReason}>
                      {lockedReason}
                    </span>
                  )}
                </div>
              ) : (
                <div className="policy-rule-buttons">
                  {(['allow', 'ask', 'deny'] as PolicyBehavior[]).map((b) => (
                    <button
                      key={b}
                      className={behavior === b ? 'active' : ''}
                      onClick={() => handleRuleToggle('other', operation, b)}
                    >
                      {behaviorLabels[b]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
