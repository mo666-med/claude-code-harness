/**
 * Policy Engine Service
 *
 * Evaluates tool and git operations against policy rules
 * - Locked rules (protected paths, dangerous git) always take precedence
 * - Policy presets (strict/balanced/fast) provide default behaviors
 * - Custom rules can override preset defaults (except locked rules)
 */

import type {
  PolicyPreset,
  PolicyConfig,
  PolicyRule,
  PolicyBehavior,
  PathCategory,
  OperationKind,
  LedgerEventStatus,
} from '../../shared/types.ts'

/**
 * Default policy rules (locked - cannot be changed)
 */
const LOCKED_RULES: PolicyRule[] = [
  // Protected paths always require approval
  {
    category: 'protected',
    operation: 'tool_write',
    behavior: 'ask',
    locked: true,
    lockedReason: '保護対象パス（Plans.md, .claude/memory/**）への変更は常に承認が必要です',
  },
  {
    category: 'protected',
    operation: 'tool_edit',
    behavior: 'ask',
    locked: true,
    lockedReason: '保護対象パス（Plans.md, .claude/memory/**）への変更は常に承認が必要です',
  },
  // Force push is permanently banned
  {
    category: 'other',
    operation: 'git_push',
    behavior: 'deny',
    locked: true,
    lockedReason: 'force push は永久に禁止されています',
  },
]

/**
 * Preset configurations
 */
const PRESET_RULES: Record<PolicyPreset, PolicyRule[]> = {
  strict: [
    // Most operations require approval
    { category: 'code', operation: 'tool_write', behavior: 'ask', locked: false },
    { category: 'code', operation: 'tool_edit', behavior: 'ask', locked: false },
    { category: 'config', operation: 'tool_write', behavior: 'ask', locked: false },
    { category: 'config', operation: 'tool_edit', behavior: 'ask', locked: false },
    { category: 'test', operation: 'tool_write', behavior: 'ask', locked: false },
    { category: 'test', operation: 'tool_edit', behavior: 'ask', locked: false },
    { category: 'other', operation: 'tool_write', behavior: 'ask', locked: false },
    { category: 'other', operation: 'tool_edit', behavior: 'ask', locked: false },
    { category: 'other', operation: 'tool_bash', behavior: 'ask', locked: false },
    { category: 'other', operation: 'git_commit', behavior: 'ask', locked: false },
    { category: 'other', operation: 'git_push', behavior: 'ask', locked: false },
    { category: 'other', operation: 'git_pr', behavior: 'ask', locked: false },
  ],
  balanced: [
    // Sensitive operations require approval
    { category: 'config', operation: 'tool_write', behavior: 'ask', locked: false },
    { category: 'config', operation: 'tool_edit', behavior: 'ask', locked: false },
    { category: 'code', operation: 'tool_write', behavior: 'ask', locked: false },
    { category: 'code', operation: 'tool_edit', behavior: 'ask', locked: false },
    { category: 'other', operation: 'tool_bash', behavior: 'ask', locked: false },
    { category: 'other', operation: 'git_push', behavior: 'ask', locked: false },
    { category: 'other', operation: 'git_pr', behavior: 'ask', locked: false },
    // Test/docs are auto-approved
    { category: 'test', operation: 'tool_write', behavior: 'allow', locked: false },
    { category: 'test', operation: 'tool_edit', behavior: 'allow', locked: false },
    { category: 'docs', operation: 'tool_write', behavior: 'allow', locked: false },
    { category: 'docs', operation: 'tool_edit', behavior: 'allow', locked: false },
  ],
  fast: [
    // Most operations auto-approved (except locked rules)
    { category: 'code', operation: 'tool_write', behavior: 'allow', locked: false },
    { category: 'code', operation: 'tool_edit', behavior: 'allow', locked: false },
    { category: 'test', operation: 'tool_write', behavior: 'allow', locked: false },
    { category: 'test', operation: 'tool_edit', behavior: 'allow', locked: false },
    { category: 'docs', operation: 'tool_write', behavior: 'allow', locked: false },
    { category: 'docs', operation: 'tool_edit', behavior: 'allow', locked: false },
    // Config still requires approval
    { category: 'config', operation: 'tool_write', behavior: 'ask', locked: false },
    { category: 'config', operation: 'tool_edit', behavior: 'ask', locked: false },
  ],
}

/**
 * Infer path category from file path
 */
export function inferPathCategory(filePath: string | undefined): PathCategory {
  if (!filePath) return 'other'

  // Protected paths (always ask)
  if (
    filePath.includes('Plans.md') ||
    filePath.includes('.claude/memory/') ||
    filePath.endsWith('.claude/memory/decisions.md') ||
    filePath.endsWith('.claude/memory/patterns.md')
  ) {
    return 'protected'
  }

  // Test files (check before code files)
  if (
    filePath.match(/\.(test|spec)\.(ts|tsx|js|jsx)$/i) ||
    filePath.includes('/test/') ||
    filePath.includes('/tests/') ||
    filePath.includes('/__tests__/')
  ) {
    return 'test'
  }

  // Config files
  if (
    filePath.match(/\.(json|yaml|yml|toml|ini|env|config)$/i) ||
    filePath.includes('/config/') ||
    filePath.includes('/.env')
  ) {
    return 'config'
  }

  // Documentation files (exclude .txt for generic files)
  if (
    filePath.match(/\.(md|rst|adoc)$/i) ||
    filePath.includes('/docs/') ||
    filePath.includes('/documentation/')
  ) {
    return 'docs'
  }

  // Source code files
  if (
    filePath.match(/\.(ts|tsx|js|jsx|py|rb|go|rs|java|kt|swift|cpp|c|h)$/i) ||
    filePath.includes('/src/') ||
    filePath.includes('/lib/') ||
    filePath.includes('/components/')
  ) {
    return 'code'
  }

  return 'other'
}

/**
 * Infer operation kind from tool name
 */
export function inferOperationKind(toolName: string): OperationKind {
  // Tool operations
  if (toolName === 'Read' || toolName === 'Glob' || toolName === 'Grep' || toolName === 'LSP') {
    return 'tool_read'
  }
  if (toolName === 'Write') {
    return 'tool_write'
  }
  if (toolName === 'Edit') {
    return 'tool_edit'
  }
  if (toolName === 'Bash' || toolName === 'Shell') {
    return 'tool_bash'
  }

  // Git operations (for future use)
  if (toolName === 'git_commit') {
    return 'git_commit'
  }
  if (toolName === 'git_push') {
    return 'git_push'
  }
  if (toolName === 'git_pr') {
    return 'git_pr'
  }

  // Default: treat as read operation (safe)
  return 'tool_read'
}

/**
 * Policy evaluation result
 */
export interface PolicyEvaluationResult {
  /** Behavior decision */
  behavior: PolicyBehavior
  /** Whether this is a locked rule */
  locked: boolean
  /** Reason for decision (if locked or denied) */
  reason?: string
  /** Matching rule */
  matchedRule?: PolicyRule
}

/**
 * Policy Engine class
 */
export class PolicyEngine {
  private config: PolicyConfig

  constructor(config?: Partial<PolicyConfig>) {
    this.config = {
      preset: config?.preset ?? 'balanced',
      rules: config?.rules ?? [],
      updatedAt: config?.updatedAt ?? new Date().toISOString(),
    }
  }

  /**
   * Evaluate a tool operation against policy rules
   */
  evaluate(
    toolName: string,
    input: Record<string, unknown>,
    filePath?: string
  ): PolicyEvaluationResult {
    const operation = inferOperationKind(toolName)
    const category = inferPathCategory(filePath)

    // First, check locked rules (highest priority)
    const lockedRule = this.findMatchingRule(category, operation, LOCKED_RULES)
    if (lockedRule) {
      return {
        behavior: lockedRule.behavior,
        locked: true,
        reason: lockedRule.lockedReason,
        matchedRule: lockedRule,
      }
    }

    // Then, check custom rules (override preset)
    const customRule = this.findMatchingRule(category, operation, this.config.rules)
    if (customRule) {
      return {
        behavior: customRule.behavior,
        locked: customRule.locked,
        reason: customRule.lockedReason,
        matchedRule: customRule,
      }
    }

    // Finally, check preset rules
    const presetRules = PRESET_RULES[this.config.preset]
    const presetRule = this.findMatchingRule(category, operation, presetRules)
    if (presetRule) {
      return {
        behavior: presetRule.behavior,
        locked: presetRule.locked,
        matchedRule: presetRule,
      }
    }

    // Default: allow (safe fallback)
    return {
      behavior: 'allow',
      locked: false,
    }
  }

  /**
   * Evaluate a git operation against policy rules
   */
  evaluateGit(
    operation: 'git_commit' | 'git_push' | 'git_pr' | 'git_release',
    branch?: string,
    isMainBranch?: boolean
  ): PolicyEvaluationResult {
    const category = 'other' // Git operations are not file-path-based

    // Special handling for main/master push (check before locked rules)
    if (operation === 'git_push' && isMainBranch) {
      return {
        behavior: 'ask',
        locked: true,
        reason: 'main/master ブランチへの push は原則禁止です（手動実行が必要）',
      }
    }

    // Check locked rules (force push denial is handled at route level)
    const lockedRule = this.findMatchingRule(category, operation, LOCKED_RULES)
    if (lockedRule) {
      return {
        behavior: lockedRule.behavior,
        locked: true,
        reason: lockedRule.lockedReason,
        matchedRule: lockedRule,
      }
    }

    // Check custom rules
    const customRule = this.findMatchingRule(category, operation, this.config.rules)
    if (customRule) {
      return {
        behavior: customRule.behavior,
        locked: customRule.locked,
        reason: customRule.lockedReason,
        matchedRule: customRule,
      }
    }

    // Check preset rules
    const presetRules = PRESET_RULES[this.config.preset]
    const presetRule = this.findMatchingRule(category, operation, presetRules)
    if (presetRule) {
      return {
        behavior: presetRule.behavior,
        locked: presetRule.locked,
        matchedRule: presetRule,
      }
    }

    // Default: ask (git operations are sensitive)
    return {
      behavior: 'ask',
      locked: false,
    }
  }

  /**
   * Find matching rule from a rule set
   */
  private findMatchingRule(
    category: PathCategory,
    operation: OperationKind,
    rules: PolicyRule[]
  ): PolicyRule | undefined {
    return rules.find((rule) => rule.category === category && rule.operation === operation)
  }

  /**
   * Get current policy configuration
   */
  getConfig(): PolicyConfig {
    return { ...this.config }
  }

  /**
   * Update policy configuration
   */
  updateConfig(config: Partial<PolicyConfig>): void {
    this.config = {
      ...this.config,
      ...config,
      updatedAt: new Date().toISOString(),
    }
  }

  /**
   * Get all rules (locked + preset + custom)
   */
  getAllRules(): PolicyRule[] {
    const presetRules = PRESET_RULES[this.config.preset]
    return [...LOCKED_RULES, ...presetRules, ...this.config.rules]
  }
}

/**
 * Default policy engine instance (singleton)
 */
let defaultPolicyEngine: PolicyEngine | null = null

/**
 * Get default policy engine instance
 */
export function getDefaultPolicyEngine(): PolicyEngine {
  if (!defaultPolicyEngine) {
    defaultPolicyEngine = new PolicyEngine({ preset: 'balanced' })
  }
  return defaultPolicyEngine
}

/**
 * Set default policy engine configuration
 */
export function setDefaultPolicyConfig(config: Partial<PolicyConfig>): void {
  const engine = getDefaultPolicyEngine()
  engine.updateConfig(config)
}
