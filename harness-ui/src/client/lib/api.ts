import type {
  HealthResponse,
  KanbanResponse,
  SkillsResponse,
  CommandsResponse,
  MemoryResponse,
  RulesResponse,
  HooksResponse,
  ClaudeMemResponse,
  UsageResponse,
  WorkflowMode,
  SSOTResponse
} from '../../shared/types.ts'

const API_BASE = '/api'

async function fetchAPI<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`)
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`)
  }
  return response.json() as Promise<T>
}

/**
 * プロジェクトパスを含むクエリパラメータを構築
 */
function buildProjectQuery(projectPath?: string, additionalParams?: Record<string, string>): string {
  const params = new URLSearchParams()
  if (projectPath) params.set('project', projectPath)
  if (additionalParams) {
    for (const [key, value] of Object.entries(additionalParams)) {
      params.set(key, value)
    }
  }
  const query = params.toString()
  return query ? `?${query}` : ''
}

export async function fetchHealth(projectPath?: string): Promise<HealthResponse> {
  return fetchAPI<HealthResponse>(`/health${buildProjectQuery(projectPath)}`)
}

export async function fetchPlans(mode: WorkflowMode = 'solo', projectPath?: string): Promise<KanbanResponse> {
  return fetchAPI<KanbanResponse>(`/plans${buildProjectQuery(projectPath, { mode })}`)
}

/**
 * Update task marker response
 */
export interface UpdateTaskResponse {
  success: boolean
  lineNumber: number
  oldLine: string
  newLine: string
  message: string
}

/**
 * Conflict error response
 */
export interface TaskConflictError {
  error: string
  conflict: true
  expectedLine: string
  currentLine: string
  suggestion: string
}

/**
 * Update a task marker in Plans.md
 *
 * @param lineNumber - Line number to update (1-based)
 * @param expectedLine - Expected original line content for conflict detection
 * @param oldMarker - Old marker to replace (e.g., 'cc:WIP')
 * @param newMarker - New marker to set (e.g., 'cc:完了')
 * @param projectPath - Optional project path
 * @returns Update result or throws on conflict (409)
 */
export async function updateTaskMarker(
  lineNumber: number,
  expectedLine: string,
  oldMarker: string,
  newMarker: string,
  projectPath?: string
): Promise<UpdateTaskResponse> {
  const response = await fetch(`${API_BASE}/plans/task${buildProjectQuery(projectPath)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lineNumber, expectedLine, oldMarker, newMarker }),
  })

  const data = await response.json()

  if (response.status === 409) {
    // Conflict detected
    const error = new Error(data.error || 'Conflict detected') as Error & { conflict: TaskConflictError }
    error.conflict = data as TaskConflictError
    throw error
  }

  if (!response.ok) {
    throw new Error(data.error || `API error: ${response.status}`)
  }

  return data as UpdateTaskResponse
}

export async function fetchSkills(projectPath?: string): Promise<SkillsResponse> {
  return fetchAPI<SkillsResponse>(`/skills${buildProjectQuery(projectPath)}`)
}

export async function fetchCommands(): Promise<CommandsResponse> {
  return fetchAPI<CommandsResponse>('/commands')
}

export async function fetchMemory(projectPath?: string): Promise<MemoryResponse> {
  return fetchAPI<MemoryResponse>(`/memory${buildProjectQuery(projectPath)}`)
}

export async function fetchRules(projectPath?: string): Promise<RulesResponse> {
  return fetchAPI<RulesResponse>(`/rules${buildProjectQuery(projectPath)}`)
}

export async function fetchHooks(projectPath?: string): Promise<HooksResponse> {
  return fetchAPI<HooksResponse>(`/hooks${buildProjectQuery(projectPath)}`)
}

export async function fetchClaudeMemStatus(): Promise<{ available: boolean }> {
  return fetchAPI<{ available: boolean }>('/claude-mem/status')
}

export async function fetchObservations(options?: {
  limit?: number
  type?: string
}): Promise<ClaudeMemResponse> {
  const params = new URLSearchParams()
  if (options?.limit) params.set('limit', String(options.limit))
  if (options?.type) params.set('type', options.type)

  const query = params.toString()
  return fetchAPI<ClaudeMemResponse>(`/claude-mem/observations${query ? `?${query}` : ''}`)
}

export async function searchObservations(query: string): Promise<ClaudeMemResponse> {
  return fetchAPI<ClaudeMemResponse>(`/claude-mem/search?q=${encodeURIComponent(query)}`)
}

export async function fetchUsage(projectPath?: string): Promise<UsageResponse> {
  return fetchAPI<UsageResponse>(`/usage${buildProjectQuery(projectPath)}`)
}

/**
 * Fetch SSOT files (decisions.md and patterns.md)
 *
 * @param projectPath - Optional project path
 * @param keywords - Optional keywords for filtering relevant sections
 */
export async function fetchSSOT(projectPath?: string, keywords?: string[]): Promise<SSOTResponse> {
  const params = new URLSearchParams()
  if (projectPath) params.set('project', projectPath)
  if (keywords && keywords.length > 0) params.set('keywords', keywords.join(','))

  const query = params.toString()
  return fetchAPI<SSOTResponse>(`/ssot${query ? `?${query}` : ''}`)
}

// ========== Projects API ==========

export interface Project {
  id: string
  name: string
  path: string
  addedAt: string
  lastAccessedAt?: string
}

export interface ProjectsResponse {
  projects: Project[]
  activeProjectId: string | null
  configPath: string
}

export async function fetchProjects(): Promise<ProjectsResponse> {
  return fetchAPI<ProjectsResponse>('/projects')
}

export async function fetchActiveProject(): Promise<{ project: Project | null }> {
  return fetchAPI<{ project: Project | null }>('/projects/active')
}

export async function addProject(name: string, path: string): Promise<{ project: Project }> {
  const response = await fetch(`${API_BASE}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, path }),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || `API error: ${response.status}`)
  }
  return response.json()
}

export async function removeProject(id: string): Promise<{ success: boolean }> {
  const response = await fetch(`${API_BASE}/projects/${id}`, {
    method: 'DELETE',
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || `API error: ${response.status}`)
  }
  return response.json()
}

export async function activateProject(id: string): Promise<{ project: Project }> {
  const response = await fetch(`${API_BASE}/projects/${id}/activate`, {
    method: 'PUT',
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || `API error: ${response.status}`)
  }
  return response.json()
}
