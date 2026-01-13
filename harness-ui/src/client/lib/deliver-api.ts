/**
 * Deliver API Client
 *
 * Client-side functions for deliver workflow API
 */

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

const API_BASE = '/api'

/**
 * Get preflight information
 */
export async function getPreflight(
  projectPath: string,
  suggestedCommitMessage?: string
): Promise<DeliverPreflight> {
  const params = new URLSearchParams({ projectPath })
  if (suggestedCommitMessage) {
    params.append('suggestedCommitMessage', suggestedCommitMessage)
  }

  const response = await fetch(`${API_BASE}/deliver/preflight?${params}`)
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error ?? 'Preflight check failed')
  }
  return response.json()
}

/**
 * Execute git commit
 */
export async function executeCommit(
  projectPath: string,
  request: DeliverCommitRequest
): Promise<DeliverCommitResponse> {
  const params = new URLSearchParams({ projectPath })
  const response = await fetch(`${API_BASE}/deliver/commit?${params}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })
  return response.json()
}

/**
 * Execute git push
 */
export async function executePush(
  projectPath: string,
  request: DeliverPushRequest
): Promise<DeliverPushResponse> {
  const params = new URLSearchParams({ projectPath })
  const response = await fetch(`${API_BASE}/deliver/push?${params}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })
  return response.json()
}

/**
 * Create GitHub PR
 */
export async function createPR(
  projectPath: string,
  request: DeliverPRRequest
): Promise<DeliverPRResponse> {
  const params = new URLSearchParams({ projectPath })
  const response = await fetch(`${API_BASE}/deliver/pr?${params}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })
  return response.json()
}

/**
 * Get available release templates
 */
export async function getReleaseTemplates(projectPath: string): Promise<ReleaseTemplate[]> {
  const params = new URLSearchParams({ projectPath })
  const response = await fetch(`${API_BASE}/deliver/release/templates?${params}`)
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error ?? 'Failed to load release templates')
  }
  const data = await response.json()
  return data.templates ?? []
}

/**
 * Get specific release template
 */
export async function getReleaseTemplate(
  projectPath: string,
  templateName: string
): Promise<ReleaseTemplate> {
  const params = new URLSearchParams({ projectPath })
  const response = await fetch(`${API_BASE}/deliver/release/template/${templateName}?${params}`)
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error ?? `Template "${templateName}" not found`)
  }
  return response.json()
}
