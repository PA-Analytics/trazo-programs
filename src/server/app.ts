import * as fs from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import * as path from 'node:path'
import { CompanionService } from './companion/companionService.ts'
import { GeminiNextActionProposer } from './companion/geminiProposer.ts'
import { EvidenceEvaluatorService } from './evaluator/evaluatorService.ts'
import { GeminiEvidenceInterpreter } from './evaluator/geminiInterpreter.ts'
import { ImplementationService } from './service.ts'
import type {
  NextActionRequestDTO,
  StartMissionDTO,
  SubmitEvidenceDTO,
} from './types.ts'

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json',
}

function serveStatic(res: ServerResponse, pathname: string, distDir: string): boolean {
  if (!fs.existsSync(distDir)) {
    return false
  }

  const safePath = path.normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '')
  let filePath = path.join(distDir, safePath === '/' ? 'index.html' : safePath)

  if (!filePath.startsWith(distDir)) {
    return false
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(distDir, 'index.html')
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase()
    const contentType = MIME_TYPES[ext] || 'application/octet-stream'
    const content = fs.readFileSync(filePath)
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': content.length,
      ...(ext === '.html'
        ? { 'Cache-Control': 'no-cache' }
        : { 'Cache-Control': 'public, max-age=31536000, immutable' }),
    })
    res.end(content)
    return true
  }

  return false
}

export interface ServerOptions {
  enableDevRoutes?: boolean
  evaluatorService?: EvidenceEvaluatorService
  companionService?: CompanionService
  distDir?: string
}

function sendJSON(res: ServerResponse, statusCode: number, data: unknown) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  })
  res.end(JSON.stringify(data))
}

async function parseBody<T>(req: IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (chunk) => {
      raw += chunk
    })
    req.on('end', () => {
      try {
        if (!raw.trim()) {
          resolve({} as T)
        } else {
          resolve(JSON.parse(raw) as T)
        }
      } catch {
        reject(new Error('Invalid JSON payload'))
      }
    })
    req.on('error', reject)
  })
}

export function createRequestListener(
  service: ImplementationService,
  options: ServerOptions = {},
) {
  const isDevRoutesEnabled =
    options.enableDevRoutes !== undefined
      ? options.enableDevRoutes
      : process.env.NODE_ENV !== 'production' && process.env.ENABLE_DEV_ROUTES === 'true'

  let evaluator = options.evaluatorService
  if (!evaluator && process.env.GEMINI_API_KEY) {
    try {
      evaluator = new EvidenceEvaluatorService(new GeminiEvidenceInterpreter())
    } catch {
      // Lazy initialization
    }
  }

  let companion = options.companionService
  if (!companion && process.env.GEMINI_API_KEY) {
    try {
      companion = new CompanionService(new GeminiNextActionProposer())
    } catch {
      // Lazy initialization
    }
  }

  return async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
    const pathname = url.pathname
    const method = req.method?.toUpperCase()

    // Handle CORS preflight
    if (method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      })
      res.end()
      return
    }

    try {
      // Health check
      if (method === 'GET' && pathname === '/api/v1/health') {
        sendJSON(res, 200, { status: 'ok', timestamp: new Date().toISOString() })
        return
      }

      // POST /api/v1/implementations/:id/next-action - Implementation Companion Next Action (TASK-006)
      const nextActionMatch = pathname.match(/^\/api\/v1\/implementations\/([^/]+)\/next-action$/)
      if (method === 'POST' && nextActionMatch) {
        if (!companion) {
          if (process.env.GEMINI_API_KEY) {
            companion = new CompanionService(new GeminiNextActionProposer())
          } else {
            sendJSON(res, 503, {
              error: 'Companion service is unavailable: GEMINI_API_KEY is not configured on the server',
            })
            return
          }
        }

        const implementationId = nextActionMatch[1]
        const state = await service.getImplementation(implementationId)
        if (!state) {
          sendJSON(res, 404, { error: `Implementation '${implementationId}' not found` })
          return
        }

        const body = await parseBody<NextActionRequestDTO>(req)
        try {
          const proposal = await companion.proposeNextAction(state, body.clarification)
          sendJSON(res, 200, proposal)
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Companion recommendation error'
          const status = message.includes('Invalid recommendation') || message.includes('locked') ? 400 : 500
          sendJSON(res, status, { error: message })
        }
        return
      }

      // POST /api/v1/implementations/:id/start-mission - Set active mission (TASK-006)
      const startMissionMatch = pathname.match(/^\/api\/v1\/implementations\/([^/]+)\/start-mission$/)
      if (method === 'POST' && startMissionMatch) {
        const implementationId = startMissionMatch[1]
        const body = await parseBody<StartMissionDTO>(req)
        try {
          const updated = await service.startMission(implementationId, body)
          sendJSON(res, 200, updated)
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Error starting mission'
          const status = message.includes('not found')
            ? 404
            : message.includes('locked') || message.includes('required') || message.includes('invalid')
              ? 400
              : 500
          sendJSON(res, status, { error: message })
        }
        return
      }

      // POST /api/v1/implementations/:id/submissions - Real Verified Action Submission Pipeline (TASK-004)
      const submissionMatch = pathname.match(/^\/api\/v1\/implementations\/([^/]+)\/submissions$/)
      if (method === 'POST' && submissionMatch) {
        if (!evaluator) {
          if (process.env.GEMINI_API_KEY) {
            evaluator = new EvidenceEvaluatorService(new GeminiEvidenceInterpreter())
          } else {
            sendJSON(res, 503, {
              error: 'Evidence evaluation is unavailable: GEMINI_API_KEY is not configured on the server',
            })
            return
          }
        }

        const implementationId = submissionMatch[1]
        const body = await parseBody<SubmitEvidenceDTO>(req)

        try {
          const result = await service.submitEvidence(implementationId, body, evaluator)
          sendJSON(res, 200, result)
        } catch (err: unknown) {
          console.error('[API Error: submissions]', err)
          const message = err instanceof Error ? err.message : 'Submission error'
          const status = message.includes('not found')
            ? 404
            : message.includes('EvaluationValidationError') ||
                message.includes('locked') ||
                message.includes('required') ||
                message.includes('invalid') ||
                message.includes('must be')
              ? 400
              : 500
          sendJSON(res, status, { error: message })
        }
        return
      }

      // POST /api/v1/evaluations/evidence - Preview/Evaluation only (TASK-003)
      if (method === 'POST' && pathname === '/api/v1/evaluations/evidence') {
        if (!evaluator) {
          if (process.env.GEMINI_API_KEY) {
            evaluator = new EvidenceEvaluatorService(new GeminiEvidenceInterpreter())
          } else {
            sendJSON(res, 503, {
              error: 'Evidence evaluation is unavailable: GEMINI_API_KEY is not configured on the server',
            })
            return
          }
        }

        const body = await parseBody<{ missionId: string; evidence: string }>(req)
        try {
          const result = await evaluator.evaluateEvidence(body)
          sendJSON(res, 200, result)
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Evaluation error'
          const status = message.includes('not found') ? 404 : 400
          sendJSON(res, status, { error: message })
        }
        return
      }

      // POST /api/v1/implementations - Create new implementation
      if (method === 'POST' && pathname === '/api/v1/implementations') {
        const body = await parseBody<{ id?: string; courseId: string; courseVersion?: string }>(req)
        if (!body.courseId) {
          sendJSON(res, 400, { error: 'courseId is required' })
          return
        }
        const created = await service.createImplementation(body)
        sendJSON(res, 201, created)
        return
      }

      // Route: /api/v1/implementations/:id/dev-complete-mission (@deprecated - test opt-in only)
      const devCompleteMatch = pathname.match(/^\/api\/v1\/implementations\/([^/]+)\/dev-complete-mission$/)
      if (method === 'POST' && devCompleteMatch) {
        if (!isDevRoutesEnabled) {
          sendJSON(res, 403, {
            error: 'Dev completion endpoint is disabled in this environment',
          })
          return
        }

        const implementationId = devCompleteMatch[1]
        const body = await parseBody<{ missionId: string }>(req)
        try {
          const updated = await service.devCompleteMission(implementationId, body)
          sendJSON(res, 200, updated)
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Unknown error'
          const status = message.startsWith('Implementation ') && message.includes('not found')
            ? 404
            : 400
          sendJSON(res, status, { error: message })
        }
        return
      }

      // Route: /api/v1/implementations/:id (Strictly read-only)
      const getImplMatch = pathname.match(/^\/api\/v1\/implementations\/([^/]+)$/)
      if (method === 'GET' && getImplMatch) {
        const implementationId = getImplMatch[1]
        const state = await service.getImplementation(implementationId)
        if (!state) {
          sendJSON(res, 404, { error: `Implementation '${implementationId}' not found` })
          return
        }
        sendJSON(res, 200, state)
        return
      }

      // Static assets / SPA fallback for non-API routes
      if (method === 'GET' && !pathname.startsWith('/api/')) {
        const distDir = options.distDir || path.resolve(process.cwd(), 'dist')
        if (serveStatic(res, pathname, distDir)) {
          return
        }
      }

      sendJSON(res, 404, { error: 'Not Found' })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Internal Server Error'
      sendJSON(res, 500, { error: message })
    }
  }
}
