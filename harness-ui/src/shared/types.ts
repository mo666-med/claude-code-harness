// Health Score Types
export interface HealthMetrics {
  skills: {
    count: number
    /** Description tokens only (loaded initially) */
    totalTokens: number
    unusedCount: number
  }
  memory: {
    /** Storage tokens (NOT loaded initially) */
    storageTokens: number
    duplicateCount: number
  }
  rules: {
    count: number
    /** Active + Cursor rules tokens (loaded initially) */
    initialLoadTokens: number
    conflictCount: number
  }
  hooks: {
    count: number
  }
  /** Total tokens loaded at session start */
  totalInitialLoadTokens: number
}

export type HealthStatus = 'good' | 'warning' | 'error'

export interface HealthResponse {
  score: number
  status: HealthStatus
  /** Total tokens loaded at session start (Skills + Rules) */
  totalInitialLoadTokens: number
  breakdown: {
    skills: { count: number; totalTokens: number; status: HealthStatus }
    memory: { storageTokens: number; duplicateCount: number; status: HealthStatus }
    rules: { count: number; initialLoadTokens: number; conflictCount: number; status: HealthStatus }
    hooks: { count: number; status: HealthStatus }
  }
  suggestions: string[]
}

// Kanban Types
export interface TaskSource {
  /** Line number in Plans.md (1-based) */
  lineNumber: number
  /** Original line content for conflict detection */
  originalLine: string
  /** Detected marker (e.g., 'cc:WIP', 'cc:TODO') */
  marker?: string
  /** File path (for multi-file support) */
  filePath?: string
}

export interface Task {
  id: string
  title: string
  description?: string
  status: 'plan' | 'work' | 'review' | 'done'
  priority?: 'high' | 'medium' | 'low'
  createdAt?: string
  /** Source information for safe updates */
  source?: TaskSource
}

export type WorkflowMode = 'solo' | '2agent'

export interface KanbanResponse {
  plan: Task[]
  work: Task[]
  review: Task[]
  done: Task[]
  mode?: WorkflowMode
  error?: string
}

// Skills Types
export interface Skill {
  name: string
  path: string
  description: string
  descriptionEn?: string
  tokenCount: number
  lastUsed?: string
  usageCount?: number
}

export interface SkillsResponse {
  skills: Skill[]
  totalTokens: number
  unusedSkills: string[]
  /** Whether usage tracking is available (requires claude-mem) */
  usageTrackingAvailable: boolean
  /** Message about usage tracking status */
  usageTrackingMessage?: string
}

// Command Types
export interface Command {
  name: string
  path: string
  description: string
  descriptionEn?: string
  category: 'core' | 'optional'
}

export interface CommandsResponse {
  commands: Command[]
}

// Memory Types
export interface MemoryFile {
  name: string
  path: string
  /** Storage size in tokens (NOT loaded initially) */
  tokenCount: number
  lastModified: string
}

export interface MemoryResponse {
  files: MemoryFile[]
  /** Total storage tokens (NOT loaded initially - memory is on-demand) */
  totalTokens: number
  /** Memory files are loaded on-demand, not at session start */
  initialLoadTokens: 0
  duplicates: string[]
}

// Rules Types
export interface Rule {
  name: string
  path: string
  content: string
  tokenCount: number
  category?: 'active' | 'cursor' | 'template'
}

export interface RulesResponse {
  rules: Rule[]
  totalTokens: number
  /** Tokens loaded into Claude's initial context (active + cursor only) */
  initialLoadTokens: number
  conflicts: string[]
}

// Hooks Types
export interface Hook {
  name: string
  type: 'PreToolUse' | 'PostToolUse' | 'Notification' | 'Stop' | 'SessionStart' | 'UserPromptSubmit' | 'PermissionRequest' | string
  matcher?: string
  command: string
}

export interface HooksResponse {
  hooks: Hook[]
  count: number
}

// claude-mem Types
export interface Observation {
  id: number
  content: string
  timestamp: string
  type: string
}

export interface ClaudeMemResponse {
  available: boolean
  data: Observation[]
  message?: string
}

// Usage Tracking Types
export interface UsageEntry {
  count: number
  lastUsed: string | null
}

export interface HookUsageEntry {
  triggered: number
  blocked: number
  lastTriggered: string | null
}

export interface UsageData {
  version: string
  updatedAt: string
  skills: Record<string, UsageEntry>
  commands: Record<string, UsageEntry>
  agents: Record<string, UsageEntry>
  hooks: Record<string, HookUsageEntry>
}

export interface CleanupSuggestions {
  unusedSkills: Array<{ name: string } & UsageEntry>
  unusedCommands: Array<{ name: string } & UsageEntry>
  unusedAgents: Array<{ name: string } & UsageEntry>
  inactiveHooks: Array<{ name: string } & HookUsageEntry>
  summary: {
    totalSkills: number
    totalCommands: number
    totalAgents: number
    totalHooks: number
    unusedSkillsCount: number
    unusedCommandsCount: number
    unusedAgentsCount: number
    inactiveHooksCount: number
  }
}

export interface UsageResponse {
  available: boolean
  data: UsageData | null
  cleanup: CleanupSuggestions | null
  topSkills: Array<[string, UsageEntry]>
  topCommands: Array<[string, UsageEntry]>
  topAgents: Array<[string, UsageEntry]>
  topHooks: Array<[string, HookUsageEntry]>
  message?: string
}

// AI Insights Types
export interface Insight {
  type: 'optimization' | 'warning' | 'suggestion'
  title: string
  description: string
  impact: 'high' | 'medium' | 'low'
  effort: 'high' | 'medium' | 'low'
  cliCommand: string
}

export interface InsightsResponse {
  insights: Insight[]
  generatedAt: string
}

// Agent SDK Types
export type AgentSessionStatus = 'idle' | 'running' | 'paused' | 'completed' | 'error' | 'interrupted'

export interface AgentSession {
  id: string
  status: AgentSessionStatus
  startedAt: string
  completedAt?: string
  prompt: string
  workingDirectory?: string
  messages: AgentMessage[]
  error?: string
}

export interface AgentMessage {
  id: string
  type: 'user' | 'assistant' | 'tool_use' | 'tool_result' | 'system' | 'error'
  content: string
  timestamp: string
  toolName?: string
  toolInput?: unknown
  toolResult?: unknown
}

export interface AgentExecuteRequest {
  prompt: string
  workingDirectory?: string
  sessionId?: string // For resuming sessions
  permissionMode?: 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan'
}

export interface AgentExecuteResponse {
  sessionId: string
  status: AgentSessionStatus
  message?: string
}

export interface AgentInterruptRequest {
  sessionId: string
}

export interface AgentInterruptResponse {
  success: boolean
  message: string
}

export interface AgentSessionResponse {
  session: AgentSession | null
  error?: string
}

export interface AgentToolApprovalRequest {
  sessionId: string
  toolUseId: string
  toolName: string
  toolInput: unknown
}

export interface AgentToolApprovalResponse {
  sessionId: string
  toolUseId: string
  decision: 'allow' | 'deny' | 'modify'
  modifiedInput?: unknown
  reason?: string
}

// AskUserQuestion Types
export interface AskUserQuestionOption {
  label: string
  description?: string
}

export interface AskUserQuestionItem {
  question: string
  header: string
  options: AskUserQuestionOption[]
  multiSelect?: boolean
}

export interface AskUserQuestionRequest {
  type: 'ask_user_question'
  sessionId: string
  toolUseId: string
  questions: AskUserQuestionItem[]
}

export interface AskUserQuestionResponse {
  sessionId: string
  toolUseId: string
  answers: Record<string, string>
}

// SSOT Types
export interface SSOTFile {
  found: boolean
  content: string | null
  path: string | null
  message?: string
}

export interface SSOTResponse {
  available: boolean
  decisions: SSOTFile
  patterns: SSOTFile
  error?: string
}

// Guardrail Event Types (for visualization)
export interface GuardrailEvent {
  id: string
  type: 'approval_request' | 'approved' | 'denied'
  toolName: string
  toolInput: unknown
  timestamp: string
  reason?: string
}

// 2-Agent Role Types (Task 9.1)
export type AgentRole = 'pm' | 'impl'

// Handoff State Types (Task 9.2)
export type HandoffState = 'pm_waiting' | 'impl_waiting' | 'idle'

export interface HandoffStatus {
  state: HandoffState
  /** Tasks waiting for PM review (cc:完了 in 2agent mode) */
  pmWaitingCount: number
  /** Tasks waiting for implementation (pm:依頼中) */
  implWaitingCount: number
  /** Tasks currently being worked on (cc:WIP) */
  inProgressCount: number
}

// Session State Types (Task 10.1)
/**
 * UI workflow state for enforcing Plan→Work→Review cycle
 * - idle: No task selected
 * - planned: Task selected, ready to start work
 * - working: Execution in progress
 * - needsReview: Execution completed, Review required before completion
 * - readyToComplete: Review completed, can mark as done
 * - completed: Task marked as done
 */
export type SessionState = 'idle' | 'planned' | 'working' | 'needsReview' | 'readyToComplete' | 'completed'

// Review Report Types (Task 10.3)
export interface ReviewChecklist {
  /** 変更概要（必須） */
  summary: string
  /** 確認手順（必須） */
  verificationSteps: string
  /** 実行したコマンド */
  executedCommands?: string
  /** 未解決の課題 */
  unresolvedIssues?: string
}

export interface ReviewReport {
  /** Task being reviewed */
  taskId: string
  taskTitle: string
  /** Checklist completion status */
  checklist: ReviewChecklist
  /** Auto-generated execution log summary */
  executionLogSummary: string
  /** Tool approval history summary */
  approvalHistory: string[]
  /** Timestamp */
  createdAt: string
  /** Whether all required fields are filled */
  isComplete: boolean
}
