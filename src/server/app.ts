import * as fs from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import * as path from 'node:path'
import type { NextActionTurn } from '../domain/course.ts'
import type { UserRole } from '../domain/identity.ts'
import { CompanionService } from './companion/companionService.ts'
import { GeminiNextActionProposer } from './companion/geminiProposer.ts'
import { CalibrationService } from './calibrationService.ts'
import { EvidenceEvaluatorService } from './evaluator/evaluatorService.ts'
import { GeminiEvidenceInterpreter } from './evaluator/geminiInterpreter.ts'
import { createCanonicalGeminiRuntime, type CanonicalGeminiRuntime } from './ai/runtime.ts'
import type { IdentityService } from './identityService.ts'
import { ImplementationService } from './service.ts'
import type {
  NextActionRequestDTO,
  AddCalibrationExampleDTO,
  ConfirmCalibrationDTO,
  CreateCalibrationDTO,
  JudgeCalibrationExampleDTO,
  LearnerSetupDTO,
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

const CREATOR_MODE_HEADER = 'x-trazo-mode'
const USER_ID_HEADER = 'x-trazo-user-id'

async function requireRole(
  req: IncomingMessage,
  res: ServerResponse,
  identity: IdentityService | undefined,
  role: UserRole,
) {
  if (!identity) return req.headers[CREATOR_MODE_HEADER] === 'creator'
  const userId = req.headers[USER_ID_HEADER]
  if (typeof userId !== 'string' || !userId) {
    sendJSON(res, 403, { code: 'PROFILE_REQUIRED', error: 'Esta superficie requiere un perfil activo.' })
    return false
  }

  try {
    await identity.requireRole(userId, role)
    return true
  } catch {
    sendJSON(res, 403, {
      code: role === 'coach' ? 'COACH_ROLE_REQUIRED' : 'LEARNER_ROLE_REQUIRED',
      error: role === 'coach' ? 'Esta superficie requiere el modo coach.' : 'Esta superficie requiere el modo learner.',
    })
    return false
  }
}

async function requireLearnerImplementation(
  req: IncomingMessage,
  res: ServerResponse,
  identity: IdentityService | undefined,
  implementationId: string,
) {
  if (!identity) return true
  const userId = req.headers[USER_ID_HEADER]
  if (typeof userId !== 'string' || !userId) {
    sendJSON(res, 403, { code: 'PROFILE_REQUIRED', error: 'Esta superficie requiere un perfil activo.' })
    return false
  }

  try {
    const profile = await identity.requireRole(userId, 'learner')
    if (profile.learnerImplementationId !== implementationId) throw new Error('implementation mismatch')
    return true
  } catch {
    sendJSON(res, 403, {
      code: 'IMPLEMENTATION_ACCESS_DENIED',
      error: 'Este estado no pertenece al perfil activo.',
    })
    return false
  }
}

function requireLegacyCreatorHeader(req: IncomingMessage, res: ServerResponse) {
  if (req.headers[CREATOR_MODE_HEADER] === 'creator') return true

  sendJSON(res, 403, {
    code: 'CREATOR_MODE_REQUIRED',
    error: 'Esta superficie requiere el modo creador/demo.',
  })
  return false
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
  calibrationService?: CalibrationService
  identityService?: IdentityService
  aiRuntime?: CanonicalGeminiRuntime
}

function sendJSON(
  res: ServerResponse,
  statusCode: number,
  data: unknown,
  headers: Record<string, string | number> = {},
) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PATCH, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Trazo-User-Id, X-Trazo-Mode',
    ...headers,
  })
  res.end(JSON.stringify(data))
}

function normalizeRecentDecisionTurns(value: unknown): NextActionTurn[] {
  if (!Array.isArray(value)) return []

  return value
    .filter(
      (turn): turn is NextActionTurn =>
        typeof turn === 'object' &&
        turn !== null &&
        ((turn as { role?: unknown }).role === 'learner' ||
          (turn as { role?: unknown }).role === 'companion') &&
        typeof (turn as { content?: unknown }).content === 'string',
    )
    .map((turn) => ({ role: turn.role, content: turn.content.trim().slice(0, 800) }))
    .filter((turn) => turn.content.length > 0)
    .slice(-6)
}

function formatServerTiming(values: Record<string, number | undefined>) {
  return Object.entries(values)
    .filter((entry): entry is [string, number] => typeof entry[1] === 'number')
    .map(([name, duration]) => `${name};dur=${duration.toFixed(1)}`)
    .join(', ')
}

interface SubmissionFailureResponse {
  status: number
  code:
    | 'IMPLEMENTATION_NOT_FOUND'
    | 'SUBMISSION_INVALID'
    | 'EVALUATION_RESPONSE_INVALID'
    | 'VERTEX_AUTHENTICATION_FAILED'
    | 'MODEL_UNAVAILABLE'
    | 'EVALUATION_FAILED'
  error: string
}

function getSubmissionFailure(error: unknown): SubmissionFailureResponse {
  const message = error instanceof Error ? error.message : ''
  const normalized = message.toLowerCase()

  if (normalized.includes('not found')) {
    return {
      status: 404,
      code: 'IMPLEMENTATION_NOT_FOUND',
      error: 'No se encontró el estado de esta misión.',
    }
  }

  if (
    normalized.includes('invalid_grant') ||
    normalized.includes('invalid_rapt') ||
    normalized.includes('reauth') ||
    normalized.includes('oauth') ||
    normalized.includes('credential')
  ) {
    return {
      status: 503,
      code: 'VERTEX_AUTHENTICATION_FAILED',
      error: 'La evaluación no está disponible en este momento.',
    }
  }

  if (normalized.includes('evaluationvalidationerror')) {
    return {
      status: 502,
      code: 'EVALUATION_RESPONSE_INVALID',
      error: 'La evaluación no se pudo completar.',
    }
  }

  if (
    normalized.includes('503') ||
    normalized.includes('unavailable') ||
    normalized.includes('429') ||
    normalized.includes('resource_exhausted') ||
    normalized.includes('quota')
  ) {
    return {
      status: 503,
      code: 'MODEL_UNAVAILABLE',
      error: 'La evaluación no está disponible en este momento.',
    }
  }

  if (
    normalized.includes('locked') ||
    normalized.includes('required') ||
    normalized.includes('invalid') ||
    normalized.includes('empty') ||
    normalized.includes('whitespace') ||
    normalized.includes('must be')
  ) {
    return {
      status: 400,
      code: 'SUBMISSION_INVALID',
      error: 'No se pudo enviar esta evidencia.',
    }
  }

  return {
    status: 500,
    code: 'EVALUATION_FAILED',
    error: 'La evaluación no se pudo completar.',
  }
}

function getRequestFailure(error: unknown) {
  const message = error instanceof Error ? error.message : ''
  const normalized = message.toLowerCase()

  if (error instanceof Error && error.name === 'RequestBodyTooLargeError') {
    return {
      status: 413,
      code: 'REQUEST_TOO_LARGE',
      error: 'La solicitud es demasiado grande.',
    }
  }

  if (normalized.includes('invalid json') || normalized.includes('syntaxerror')) {
    return {
      status: 400,
      code: 'REQUEST_INVALID',
      error: 'La solicitud no se pudo procesar.',
    }
  }

  if (
    normalized.includes('invalid_grant') ||
    normalized.includes('invalid_rapt') ||
    normalized.includes('reauth') ||
    normalized.includes('oauth') ||
    normalized.includes('credential')
  ) {
    return {
      status: 503,
      code: 'BACKEND_AUTHENTICATION_FAILED',
      error: 'El servicio no está disponible en este momento.',
    }
  }

  return {
    status: 500,
    code: 'SERVER_ERROR',
    error: 'El servicio no pudo completar la solicitud.',
  }
}

async function parseBody<T>(req: IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    const maxBodyBytes = 64 * 1024
    let raw = ''
    let bodyBytes = 0
    let rejected = false
    req.on('data', (chunk) => {
      if (rejected) return
      bodyBytes += Buffer.byteLength(chunk)
      if (bodyBytes > maxBodyBytes) {
        rejected = true
        const error = new Error('Request body too large')
        error.name = 'RequestBodyTooLargeError'
        reject(error)
        return
      }
      raw += chunk
    })
    req.on('end', () => {
      if (rejected) return
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
  let companion = options.companionService
  const calibration = options.calibrationService
  const identity = options.identityService
  let runtime = options.aiRuntime

  function getRuntime() {
    runtime ??= createCanonicalGeminiRuntime()
    return runtime
  }

  return async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
    const pathname = url.pathname
    const method = req.method?.toUpperCase()

    // Handle CORS preflight
    if (method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, PATCH, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Trazo-Mode',
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

      if (method === 'POST' && pathname === '/api/v1/profiles') {
        if (!identity) {
          sendJSON(res, 503, { code: 'IDENTITY_UNAVAILABLE', error: 'La identidad no está disponible.' })
          return
        }
        const body = await parseBody<{ userId?: string; displayName: string }>(req)
        try {
          sendJSON(res, 201, await identity.createProfile(body))
        } catch (err: unknown) {
          sendJSON(res, 400, { error: err instanceof Error ? err.message : 'Profile creation failed' })
        }
        return
      }

      if (identity && method === 'GET' && pathname === '/api/v1/profiles') {
        sendJSON(res, 200, await identity.listProfiles())
        return
      }

      const profileMatch = pathname.match(/^\/api\/v1\/profiles\/([^/]+)$/)
      if (identity && method === 'GET' && profileMatch) {
        const profile = await identity.getProfile(profileMatch[1])
        if (!profile) {
          sendJSON(res, 404, { error: 'Profile not found' })
          return
        }
        sendJSON(res, 200, profile)
        return
      }

      const roleMatch = pathname.match(/^\/api\/v1\/profiles\/([^/]+)\/role$/)
      if (identity && method === 'PATCH' && roleMatch) {
        const body = await parseBody<{ role: UserRole }>(req)
        try {
          sendJSON(res, 200, await identity.setRole(roleMatch[1], body.role))
        } catch (err: unknown) {
          sendJSON(res, 400, { error: err instanceof Error ? err.message : 'Role selection failed' })
        }
        return
      }

      const coachSetupMatch = pathname.match(/^\/api\/v1\/profiles\/([^/]+)\/coach-setup$/)
      if (identity && method === 'PATCH' && coachSetupMatch) {
        const body = await parseBody<Parameters<IdentityService['saveCoachSetup']>[1]>(req)
        try {
          sendJSON(res, 200, await identity.saveCoachSetup(coachSetupMatch[1], body))
        } catch (err: unknown) {
          sendJSON(res, 400, { error: err instanceof Error ? err.message : 'Coach setup failed' })
        }
        return
      }

      const learnerSetupMatch = pathname.match(/^\/api\/v1\/implementations\/([^/]+)\/learner-setup$/)
      if (method === 'PATCH' && learnerSetupMatch) {
        if (!(await requireLearnerImplementation(req, res, identity, learnerSetupMatch[1]))) return
        const body = await parseBody<LearnerSetupDTO>(req)
        try {
          const updated = await service.updateLearnerSetup(learnerSetupMatch[1], body)
          sendJSON(res, 200, updated)
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Learner setup failed'
          sendJSON(res, message.includes('not found') ? 404 : 400, { error: message })
        }
        return
      }

      const calibrationMatch = pathname.match(/^\/api\/v1\/calibrations\/([^/]+)$/)
      if (calibration && method === 'GET' && calibrationMatch) {
        if (!(await requireRole(req, res, identity, 'coach')) && identity) return
        if (!identity && !requireLegacyCreatorHeader(req, res)) return
        const data = await calibration.get(calibrationMatch[1], typeof req.headers[USER_ID_HEADER] === 'string' ? req.headers[USER_ID_HEADER] : undefined)
        sendJSON(res, 200, data)
        return
      }

      if (calibration && method === 'POST' && calibrationMatch) {
        if (!(await requireRole(req, res, identity, 'coach')) && identity) return
        if (!identity && !requireLegacyCreatorHeader(req, res)) return
        const body = await parseBody<CreateCalibrationDTO>(req)
        try {
          sendJSON(res, 200, await calibration.create(calibrationMatch[1], body, typeof req.headers[USER_ID_HEADER] === 'string' ? req.headers[USER_ID_HEADER] : undefined))
        } catch (err: unknown) {
          sendJSON(res, 400, { error: err instanceof Error ? err.message : 'Calibration failed' })
        }
        return
      }

      const calibrationExamplesMatch = pathname.match(/^\/api\/v1\/calibrations\/([^/]+)\/examples$/)
      if (calibration && method === 'POST' && calibrationExamplesMatch) {
        if (!(await requireRole(req, res, identity, 'coach')) && identity) return
        if (!identity && !requireLegacyCreatorHeader(req, res)) return
        const body = await parseBody<AddCalibrationExampleDTO>(req)
        try {
          sendJSON(res, 200, await calibration.addExample(calibrationExamplesMatch[1], body, typeof req.headers[USER_ID_HEADER] === 'string' ? req.headers[USER_ID_HEADER] : undefined))
        } catch (err: unknown) {
          sendJSON(res, 400, { error: err instanceof Error ? err.message : 'Example failed' })
        }
        return
      }

      const generateExamplesMatch = pathname.match(/^\/api\/v1\/calibrations\/([^/]+)\/generate-examples$/)
      if (calibration && method === 'POST' && generateExamplesMatch) {
        if (!(await requireRole(req, res, identity, 'coach')) && identity) return
        if (!identity && !requireLegacyCreatorHeader(req, res)) return
        try {
          sendJSON(res, 200, await calibration.generateExamples(generateExamplesMatch[1], typeof req.headers[USER_ID_HEADER] === 'string' ? req.headers[USER_ID_HEADER] : undefined))
        } catch (err: unknown) {
          sendJSON(res, 400, { error: err instanceof Error ? err.message : 'Generation failed' })
        }
        return
      }

      const judgeExampleMatch = pathname.match(/^\/api\/v1\/calibrations\/([^/]+)\/examples\/([^/]+)$/)
      if (calibration && method === 'PATCH' && judgeExampleMatch) {
        if (!(await requireRole(req, res, identity, 'coach')) && identity) return
        if (!identity && !requireLegacyCreatorHeader(req, res)) return
        const body = await parseBody<JudgeCalibrationExampleDTO>(req)
        try {
          sendJSON(res, 200, await calibration.judgeExample(judgeExampleMatch[1], judgeExampleMatch[2], body, typeof req.headers[USER_ID_HEADER] === 'string' ? req.headers[USER_ID_HEADER] : undefined))
        } catch (err: unknown) {
          sendJSON(res, 400, { error: err instanceof Error ? err.message : 'Judgement failed' })
        }
        return
      }

      const proposeCalibrationMatch = pathname.match(/^\/api\/v1\/calibrations\/([^/]+)\/propose$/)
      if (calibration && method === 'POST' && proposeCalibrationMatch) {
        if (!(await requireRole(req, res, identity, 'coach')) && identity) return
        if (!identity && !requireLegacyCreatorHeader(req, res)) return
        try {
          sendJSON(res, 200, await calibration.propose(proposeCalibrationMatch[1], typeof req.headers[USER_ID_HEADER] === 'string' ? req.headers[USER_ID_HEADER] : undefined))
        } catch (err: unknown) {
          sendJSON(res, 400, { error: err instanceof Error ? err.message : 'Proposal failed' })
        }
        return
      }

      const confirmCalibrationMatch = pathname.match(/^\/api\/v1\/calibrations\/([^/]+)\/confirm$/)
      if (calibration && method === 'POST' && confirmCalibrationMatch) {
        if (!(await requireRole(req, res, identity, 'coach')) && identity) return
        if (!identity && !requireLegacyCreatorHeader(req, res)) return
        const body = await parseBody<ConfirmCalibrationDTO>(req)
        try {
          sendJSON(res, 200, await calibration.confirm(confirmCalibrationMatch[1], body, typeof req.headers[USER_ID_HEADER] === 'string' ? req.headers[USER_ID_HEADER] : undefined))
        } catch (err: unknown) {
          sendJSON(res, 400, { error: err instanceof Error ? err.message : 'Confirmation failed' })
        }
        return
      }

      // POST /api/v1/implementations/:id/next-action - Implementation Companion Next Action (TASK-006)
      const nextActionMatch = pathname.match(/^\/api\/v1\/implementations\/([^/]+)\/next-action$/)
      if (method === 'POST' && nextActionMatch) {
        if (!(await requireLearnerImplementation(req, res, identity, nextActionMatch[1]))) return
        const requestStartedAt = performance.now()
        const receivedAt = new Date().toISOString()
        if (!companion) {
          try {
            companion = new CompanionService(new GeminiNextActionProposer(getRuntime()))
          } catch (err: unknown) {
            sendJSON(res, 503, {
              error: `Companion service is unavailable: ${err instanceof Error ? err.message : String(err)}`,
            })
            return
          }
        }

        const implementationId = nextActionMatch[1]
        const activeUserId = req.headers[USER_ID_HEADER]
        const activeProfile = identity && typeof activeUserId === 'string'
          ? await identity.getProfile(activeUserId)
          : null
        const state = await service.getImplementation(implementationId)
        if (!state) {
          sendJSON(res, 404, { error: `Implementation '${implementationId}' not found` })
          return
        }

        const body = await parseBody<NextActionRequestDTO>(req)
        const parsedAt = performance.now()
        let latencyTrace: {
          attempts: number
          promptBuildMs: number
          vertexMs: number
          validationMs: number
          promptCharacters: number
          outputCharacters: number
          promptTokens?: number
          outputTokens?: number
          thoughtsTokens?: number
          totalTokens?: number
        } | undefined
        try {
          const proposal = await companion.proposeNextAction(
            state,
            body.clarification,
            normalizeRecentDecisionTurns(body.recentDecisionTurns),
            (trace) => {
              latencyTrace = trace
            },
            activeProfile
              ? { displayName: activeProfile.displayName, role: activeProfile.role ?? 'learner' }
              : undefined,
          )
          const responseStartedAt = performance.now()
          const serverTiming = formatServerTiming({
            parse: parsedAt - requestStartedAt,
            prompt: latencyTrace?.promptBuildMs,
            vertex: latencyTrace?.vertexMs,
            validation: latencyTrace?.validationMs,
            server: responseStartedAt - requestStartedAt,
          })
          if (latencyTrace) {
            console.info('[TRAZO] next-action timing', {
              receivedAt,
              implementationId,
              attempts: latencyTrace.attempts,
              promptBuildMs: latencyTrace.promptBuildMs,
              vertexMs: latencyTrace.vertexMs,
              validationMs: latencyTrace.validationMs,
              serverMs: Number((responseStartedAt - requestStartedAt).toFixed(1)),
              promptTokens: latencyTrace.promptTokens,
              outputTokens: latencyTrace.outputTokens,
              thoughtsTokens: latencyTrace.thoughtsTokens,
            })
          }
          sendJSON(res, 200, proposal, {
            'Server-Timing': serverTiming,
            'Timing-Allow-Origin': '*',
            'X-Trazo-Request-Received': receivedAt,
            'X-Trazo-Model-Calls': String(latencyTrace?.attempts ?? 0),
          })
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Companion recommendation error'
          const status = message.includes('Invalid recommendation') || message.includes('locked') ? 400 : 500
          sendJSON(res, status, {
            error:
              status === 400
                ? message
                : 'No pude revisar las rutas en este momento. Intenta de nuevo.',
          })
        }
        return
      }

      // POST /api/v1/implementations/:id/start-mission - Set active mission (TASK-006)
      const startMissionMatch = pathname.match(/^\/api\/v1\/implementations\/([^/]+)\/start-mission$/)
      if (method === 'POST' && startMissionMatch) {
        const implementationId = startMissionMatch[1]
        if (!(await requireLearnerImplementation(req, res, identity, implementationId))) return
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

      // POST /api/v1/implementations/:id/submissions - Submit evidence for a mission (TASK-005)
      const submissionMatch = pathname.match(/^\/api\/v1\/implementations\/([^/]+)\/submissions$/)
      if (method === 'POST' && submissionMatch) {
        if (!(await requireLearnerImplementation(req, res, identity, submissionMatch[1]))) return
        if (!evaluator) {
          try {
            evaluator = new EvidenceEvaluatorService(new GeminiEvidenceInterpreter(getRuntime()))
          } catch {
            sendJSON(res, 503, {
              code: 'MODEL_UNAVAILABLE',
              error: 'La evaluación no está disponible en este momento.',
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
          const failure = getSubmissionFailure(err)
          console.error('[TRAZO] submission failure', {
            code: failure.code,
            status: failure.status,
          })
          sendJSON(res, failure.status, {
            code: failure.code,
            error: failure.error,
          })
        }
        return
      }

      // POST /api/v1/evaluations/evidence - Preview/Evaluation only (TASK-003)
      if (method === 'POST' && pathname === '/api/v1/evaluations/evidence') {
        if (!evaluator) {
          try {
            evaluator = new EvidenceEvaluatorService(new GeminiEvidenceInterpreter(getRuntime()))
          } catch (err: unknown) {
            sendJSON(res, 503, {
              error: `Evidence evaluation is unavailable: ${err instanceof Error ? err.message : String(err)}`,
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
        if (identity && !(await requireLearnerImplementation(req, res, identity, implementationId))) return
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
      const failure = getRequestFailure(err)
      console.error('[TRAZO] request failure', {
        code: failure.code,
        status: failure.status,
      })
      sendJSON(res, failure.status, {
        code: failure.code,
        error: failure.error,
      })
    }
  }
}
