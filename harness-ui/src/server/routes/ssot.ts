import { Hono } from 'hono'
import { getProjectRoot } from '../services/analyzer.ts'
import { validateProjectPath, readFileContent } from '../services/file-reader.ts'
import { join } from 'node:path'

const app = new Hono()

/**
 * SSOT (Single Source of Truth) API
 *
 * decisions.md と patterns.md を安全に読み取るエンドポイント
 */

interface SSOTResponse {
  available: boolean
  decisions: {
    found: boolean
    content: string | null
    path: string | null
  }
  patterns: {
    found: boolean
    content: string | null
    path: string | null
  }
  error?: string
}

/**
 * Extract relevant sections from SSOT file based on keywords
 * Returns sections containing any of the keywords
 */
function extractRelevantSections(content: string, keywords: string[]): string {
  if (keywords.length === 0) return content

  // Split by markdown headers (## or ###)
  const sections = content.split(/(?=^##\s)/m)

  const relevantSections: string[] = []
  const lowerKeywords = keywords.map(k => k.toLowerCase())

  for (const section of sections) {
    const lowerSection = section.toLowerCase()
    const hasKeyword = lowerKeywords.some(keyword => lowerSection.includes(keyword))

    if (hasKeyword) {
      relevantSections.push(section.trim())
    }
  }

  if (relevantSections.length === 0) {
    return '関連するセクションが見つかりませんでした。'
  }

  // Limit output to prevent overflow (max 3000 chars)
  const joined = relevantSections.join('\n\n---\n\n')
  if (joined.length > 3000) {
    return joined.substring(0, 3000) + '\n\n...(省略)'
  }
  return joined
}

/**
 * GET /api/ssot
 *
 * Query params:
 * - project: Optional project path
 * - keywords: Optional comma-separated keywords for filtering
 */
app.get('/', async (c) => {
  try {
    const userProject = c.req.query('project')
    const keywordsParam = c.req.query('keywords')
    const defaultRoot = getProjectRoot()

    // Validate project path
    const projectRoot = userProject
      ? validateProjectPath(userProject, defaultRoot) ?? defaultRoot
      : defaultRoot

    const keywords = keywordsParam
      ? keywordsParam.split(',').map(k => k.trim()).filter(k => k.length > 0)
      : []

    // Search for SSOT files in possible locations
    const ssotPaths = [
      join(projectRoot, '.claude', 'memory'),
      join(projectRoot, '.harness', 'memory'),
      join(projectRoot, 'docs'),
    ]

    const response: SSOTResponse = {
      available: false,
      decisions: { found: false, content: null, path: null },
      patterns: { found: false, content: null, path: null },
    }

    // Find decisions.md
    for (const basePath of ssotPaths) {
      const decisionsPath = join(basePath, 'decisions.md')
      const content = await readFileContent(decisionsPath)
      if (content) {
        response.decisions = {
          found: true,
          content: keywords.length > 0 ? extractRelevantSections(content, keywords) : content,
          path: decisionsPath,
        }
        response.available = true
        break
      }
    }

    // Find patterns.md
    for (const basePath of ssotPaths) {
      const patternsPath = join(basePath, 'patterns.md')
      const content = await readFileContent(patternsPath)
      if (content) {
        response.patterns = {
          found: true,
          content: keywords.length > 0 ? extractRelevantSections(content, keywords) : content,
          path: patternsPath,
        }
        response.available = true
        break
      }
    }

    return c.json(response)
  } catch (error) {
    console.error('SSOT read failed:', error)
    return c.json(
      {
        available: false,
        decisions: { found: false, content: null, path: null },
        patterns: { found: false, content: null, path: null },
        error: 'SSOT ファイルの読み取りに失敗しました',
      } satisfies SSOTResponse,
      500
    )
  }
})

/**
 * GET /api/ssot/decisions
 *
 * Fetch only decisions.md content
 */
app.get('/decisions', async (c) => {
  try {
    const userProject = c.req.query('project')
    const keywordsParam = c.req.query('keywords')
    const defaultRoot = getProjectRoot()

    const projectRoot = userProject
      ? validateProjectPath(userProject, defaultRoot) ?? defaultRoot
      : defaultRoot

    const keywords = keywordsParam
      ? keywordsParam.split(',').map(k => k.trim()).filter(k => k.length > 0)
      : []

    const ssotPaths = [
      join(projectRoot, '.claude', 'memory'),
      join(projectRoot, '.harness', 'memory'),
      join(projectRoot, 'docs'),
    ]

    for (const basePath of ssotPaths) {
      const path = join(basePath, 'decisions.md')
      const content = await readFileContent(path)
      if (content) {
        return c.json({
          found: true,
          content: keywords.length > 0 ? extractRelevantSections(content, keywords) : content,
          path,
        })
      }
    }

    return c.json({
      found: false,
      content: null,
      path: null,
      message: 'decisions.md が見つかりません。.claude/memory/decisions.md を作成してください。',
    })
  } catch (error) {
    console.error('Decisions read failed:', error)
    return c.json({ found: false, content: null, path: null, error: '読み取りエラー' }, 500)
  }
})

/**
 * GET /api/ssot/patterns
 *
 * Fetch only patterns.md content
 */
app.get('/patterns', async (c) => {
  try {
    const userProject = c.req.query('project')
    const keywordsParam = c.req.query('keywords')
    const defaultRoot = getProjectRoot()

    const projectRoot = userProject
      ? validateProjectPath(userProject, defaultRoot) ?? defaultRoot
      : defaultRoot

    const keywords = keywordsParam
      ? keywordsParam.split(',').map(k => k.trim()).filter(k => k.length > 0)
      : []

    const ssotPaths = [
      join(projectRoot, '.claude', 'memory'),
      join(projectRoot, '.harness', 'memory'),
      join(projectRoot, 'docs'),
    ]

    for (const basePath of ssotPaths) {
      const path = join(basePath, 'patterns.md')
      const content = await readFileContent(path)
      if (content) {
        return c.json({
          found: true,
          content: keywords.length > 0 ? extractRelevantSections(content, keywords) : content,
          path,
        })
      }
    }

    return c.json({
      found: false,
      content: null,
      path: null,
      message: 'patterns.md が見つかりません。.claude/memory/patterns.md を作成してください。',
    })
  } catch (error) {
    console.error('Patterns read failed:', error)
    return c.json({ found: false, content: null, path: null, error: '読み取りエラー' }, 500)
  }
})

export default app
