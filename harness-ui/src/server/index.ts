import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'

// Import routes
import healthRoutes from './routes/health.ts'
import plansRoutes from './routes/plans.ts'
import skillsRoutes from './routes/skills.ts'
import commandsRoutes from './routes/commands.ts'
import memoryRoutes from './routes/memory.ts'
import rulesRoutes from './routes/rules.ts'
import hooksRoutes from './routes/hooks.ts'
import claudeMemRoutes from './routes/claude-mem.ts'
import insightsRoutes from './routes/insights.ts'
import usageRoutes from './routes/usage.ts'
import projectsRoutes from './routes/projects.ts'
import agentRoutes from './routes/agent.ts'
import ssotRoutes from './routes/ssot.ts'
import deliverRoutes from './routes/deliver.ts'
import { initializeSession } from './services/projects.ts'
import {
  registerWsConnection,
  unregisterWsConnection,
  submitToolApproval,
} from './services/agent-executor.ts'

// Import HTML for Bun's HTML imports feature
import indexHtml from '../../public/index.html'

const app = new Hono()

// Middleware for API routes
app.use('*', logger())
app.use('*', cors({
  origin: ['http://localhost:37778', 'http://127.0.0.1:37778'],
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type']
}))

// API Routes - mounted at /api prefix
app.route('/api/health', healthRoutes)
app.route('/api/plans', plansRoutes)
app.route('/api/skills', skillsRoutes)
app.route('/api/commands', commandsRoutes)
app.route('/api/memory', memoryRoutes)
app.route('/api/rules', rulesRoutes)
app.route('/api/hooks', hooksRoutes)
app.route('/api/claude-mem', claudeMemRoutes)
app.route('/api/insights', insightsRoutes)
app.route('/api/usage', usageRoutes)
app.route('/api/projects', projectsRoutes)
app.route('/api/agent', agentRoutes)
app.route('/api/ssot', ssotRoutes)
app.route('/api/deliver', deliverRoutes)

// API status endpoint
app.get('/api/status', (c) => {
  return c.json({
    status: 'ok',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  })
})

// Start server
const port = parseInt(process.env['PORT'] ?? '37778', 10)

// Auto-register current project on startup (like claude-mem)
const currentProject = initializeSession()
if (currentProject) {
  console.log(`[harness-ui] Auto-registered project: ${currentProject.name} (${currentProject.path})`)
}

console.log(`
╔═══════════════════════════════════════════════╗
║         Harness UI Server v1.0.0              ║
╠═══════════════════════════════════════════════╣
║  Local:  http://localhost:${port}                ║
║  API:    http://localhost:${port}/api            ║
╚═══════════════════════════════════════════════╝
`)

// Track WebSocket connections by session ID
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const wsSessionMap = new Map<any, string>()

// Use Bun.serve with routes for HTML (Bun handles bundling)
// WebSocket upgrade handled via explicit route
const server = Bun.serve({
  port,
  // Routes for static files and API
  routes: {
    // Frontend (Bun bundles HTML imports automatically)
    '/': indexHtml,

    // WebSocket endpoint - upgrade to WebSocket
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    '/ws': (req: Request, server: any) => {
      console.log('[WebSocket] Route handler - upgrade request')
      const upgraded = server.upgrade(req)
      if (upgraded) {
        console.log('[WebSocket] Upgrade successful via route')
        return undefined
      }
      console.log('[WebSocket] Upgrade failed via route')
      return new Response('WebSocket upgrade failed', { status: 500 })
    },

    // API Routes - delegate to Hono for middleware (logger, cors)
    '/api/*': {
      GET: (req: Request) => app.fetch(req),
      POST: (req: Request) => app.fetch(req),
      PUT: (req: Request) => app.fetch(req),
      PATCH: (req: Request) => app.fetch(req),
      DELETE: (req: Request) => app.fetch(req),
      OPTIONS: (req: Request) => app.fetch(req),
    },
  },
  // Fallback fetch handler for WebSocket and SPA routes
  fetch(req, server) {
    const url = new URL(req.url)
    console.log(`[fetch] ${req.method} ${url.pathname}`)

    // WebSocket upgrade for /ws path
    if (url.pathname === '/ws') {
      console.log('[WebSocket] Upgrade request received')
      const success = server.upgrade(req)
      if (success) {
        console.log('[WebSocket] Upgrade successful')
        return undefined // Upgrade successful
      }
      console.log('[WebSocket] Upgrade failed')
      return new Response('WebSocket upgrade failed', { status: 500 })
    }

    // SPA catch-all - serve the same HTML for client-side routing
    return new Response(Bun.file('./public/index.html'), {
      headers: { 'Content-Type': 'text/html' },
    })
  },
  // WebSocket support for tool approval UI
  websocket: {
    open(ws) {
      console.log('[WebSocket] Client connected')
    },
    message(ws, message) {
      try {
        const data = JSON.parse(message.toString())

        // Handle session registration
        if (data.type === 'register_session') {
          const sessionId = data.sessionId
          wsSessionMap.set(ws, sessionId)
          registerWsConnection(sessionId, (msg) => {
            ws.send(JSON.stringify(msg))
          })
          ws.send(JSON.stringify({ type: 'registered', sessionId }))
          console.log(`[WebSocket] Session registered: ${sessionId}`)
        }

        // Handle tool approval response
        if (data.type === 'tool_approval_response') {
          const sessionId = wsSessionMap.get(ws)
          const success = submitToolApproval({
            sessionId: sessionId || data.sessionId,
            toolUseId: data.toolUseId,
            decision: data.decision,
            reason: data.reason,
            modifiedInput: data.modifiedInput,
          })
          console.log(`[WebSocket] Tool approval submitted: ${data.toolUseId} -> ${data.decision} (success: ${success})`)
        }
      } catch (error) {
        console.error('[WebSocket] Message parse error:', error)
      }
    },
    close(ws) {
      const sessionId = wsSessionMap.get(ws)
      if (sessionId) {
        unregisterWsConnection(sessionId)
        wsSessionMap.delete(ws)
        console.log(`[WebSocket] Session unregistered: ${sessionId}`)
      }
      console.log('[WebSocket] Client disconnected')
    },
  },
  development: {
    hmr: true,
    console: true,
  }
})

console.log(`Server running at ${server.url}`)

// Export for testing (don't export fetch directly to avoid Bun auto-serve)
export { app, port }
export const apiRouter = app
