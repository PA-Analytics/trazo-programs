import test from 'node:test'
import assert from 'node:assert/strict'
import * as http from 'node:http'
import type { Rubric, StructuredEvidenceEvaluation } from '../src/domain/course.ts'
import type { IEvidenceInterpreter } from '../src/server/evaluator/types.ts'
import { EvidenceEvaluatorService } from '../src/server/evaluator/evaluatorService.ts'
import {
  MemoryImplementationRepository,
  MemoryProfileRepository,
} from '../src/server/repository.ts'
import { ImplementationService } from '../src/server/service.ts'
import { IdentityService } from '../src/server/identityService.ts'
import { createRequestListener } from '../src/server/app.ts'

const COURSE_ID = 'primer-sistema-de-contenido'

function passEvaluation(rubric?: Rubric): StructuredEvidenceEvaluation {
  return {
    interactionType: 'EVIDENCE_SUBMISSION',
    message: 'verificado',
    coachingFeedback: 'verificado',
    criteria: (rubric?.criteria ?? []).map((criterion) => ({
      criterionId: criterion.id,
      status: 'PASS' as const,
      rationale: 'cumple',
    })),
  }
}

const stubPassEvaluator = new EvidenceEvaluatorService({
  async interpret(params: Parameters<IEvidenceInterpreter['interpret']>[0]) {
    return passEvaluation(params.rubric ?? params.mission.rubric)
  },
})

interface TestServer {
  server: http.Server
  repository: MemoryImplementationRepository
  identity: IdentityService
}

function startIdentityServer(): Promise<TestServer> {
  const repository = new MemoryImplementationRepository()
  const service = new ImplementationService(repository)
  const identity = new IdentityService(new MemoryProfileRepository(), service)
  const listener = createRequestListener(service, {
    enableDevRoutes: true,
    identityService: identity,
    evaluatorService: stubPassEvaluator,
  })
  const server = http.createServer(listener)
  return new Promise((resolve) => {
    server.listen(0, () => resolve({ server, repository, identity }))
  })
}

async function request(
  port: number,
  pathname: string,
  options: { method?: string; body?: unknown; userId?: string; creatorHeader?: boolean } = {},
): Promise<{ status: number; data: unknown }> {
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (options.userId) headers['x-trazo-user-id'] = options.userId
    if (options.creatorHeader) headers['x-trazo-mode'] = 'creator'
    const req = http.request(
      `http://localhost:${port}${pathname}`,
      { method: options.method ?? 'GET', headers },
      (res) => {
        let raw = ''
        res.on('data', (chunk) => (raw += chunk))
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode ?? 500, data: raw ? JSON.parse(raw) : null })
          } catch {
            resolve({ status: res.statusCode ?? 500, data: raw })
          }
        })
      },
    )
    req.on('error', reject)
    if (options.body) req.write(JSON.stringify(options.body))
    req.end()
  })
}

test('F2: with identity wired, dev-complete enforces ownership (anonymous and cross-user denied)', async () => {
  const { server, identity } = await startIdentityServer()
  const port = (server.address() as { port: number }).port

  try {
    await identity.createProfile({ userId: 'owner-user-01', displayName: 'Owner' })
    await identity.setRole('owner-user-01', 'learner')
    await identity.createProfile({ userId: 'other-user-02', displayName: 'Other' })
    await identity.setRole('other-user-02', 'learner')

    // Owner progresses legally through artifact-producing missions first.
    const submit1 = await request(port, '/api/v1/implementations/learner-owner-user-01/submissions', {
      method: 'POST',
      body: { missionId: 'N01', evidence: { type: 'text', text: 'premise del dueno' } },
      userId: 'owner-user-01',
    })
    assert.equal(submit1.status, 200)

    const submit2 = await request(port, '/api/v1/implementations/learner-owner-user-01/submissions', {
      method: 'POST',
      body: { missionId: 'N02', evidence: { type: 'text', text: 'apertura desarrollo cierre' } },
      userId: 'owner-user-01',
    })
    assert.equal(submit2.status, 200)

    const devPath = '/api/v1/implementations/learner-owner-user-01/dev-complete-mission'

    // Anonymous caller denied.
    const anonymous = await request(port, devPath, { method: 'POST', body: { missionId: 'N05' } })
    assert.equal(anonymous.status, 403)

    // Cross-user caller denied.
    const foreign = await request(port, devPath, {
      method: 'POST',
      body: { missionId: 'N05' },
      userId: 'other-user-02',
    })
    assert.equal(foreign.status, 403)

    // Owner allowed.
    const owner = await request(port, devPath, {
      method: 'POST',
      body: { missionId: 'N05' },
      userId: 'owner-user-01',
    })
    assert.equal(owner.status, 200)
    const state = owner.data as { completedMissionIds: string[] }
    assert.ok(state.completedMissionIds.includes('N05'))
  } finally {
    server.close()
  }
})

test('F2: legacy no-identity mode requires the explicit creator header', async () => {
  const repository = new MemoryImplementationRepository()
  const service = new ImplementationService(repository)
  const listener = createRequestListener(service, { enableDevRoutes: true })
  const server = http.createServer(listener)
  await new Promise<void>((resolve) => server.listen(0, resolve))
  const port = (server.address() as { port: number }).port

  try {
    const nowIso = '2026-08-23T00:00:00.000Z'
    await repository.save({
      id: 'impl-legacy',
      courseId: COURSE_ID,
      courseVersion: '1.0.0',
      completedMissionIds: ['N01', 'N02'],
      artifacts: {
        premise: {
          key: 'premise',
          sourceMissionId: 'N01',
          value: {},
          createdAt: nowIso,
          updatedAt: nowIso,
        },
        direct_structure: {
          key: 'direct_structure',
          sourceMissionId: 'N02',
          value: {},
          createdAt: nowIso,
          updatedAt: nowIso,
        },
      },
      createdAt: nowIso,
      updatedAt: nowIso,
    })

    const path = '/api/v1/implementations/impl-legacy/dev-complete-mission'

    const withoutHeader = await request(port, path, { method: 'POST', body: { missionId: 'N05' } })
    assert.equal(withoutHeader.status, 403)

    const withCreatorHeader = await request(port, path, {
      method: 'POST',
      body: { missionId: 'N05' },
      creatorHeader: true,
    })
    assert.equal(withCreatorHeader.status, 200)
  } finally {
    server.close()
  }
})

test('F2: production NODE_ENV keeps dev-complete disabled even when ENABLE_DEV_ROUTES=true', async () => {
  const previousNodeEnv = process.env.NODE_ENV
  const previousFlag = process.env.ENABLE_DEV_ROUTES
  process.env.NODE_ENV = 'production'
  process.env.ENABLE_DEV_ROUTES = 'true'

  try {
    const service = new ImplementationService(new MemoryImplementationRepository())
    const listener = createRequestListener(service, {})
    const server = http.createServer(listener)
    await new Promise<void>((resolve) => server.listen(0, resolve))
    const port = (server.address() as { port: number }).port

    try {
      const response = await request(port, '/api/v1/implementations/any/dev-complete-mission', {
        method: 'POST',
        body: { missionId: 'N01' },
        creatorHeader: true,
      })
      assert.equal(response.status, 403)
      assert.match((response.data as { error: string }).error, /disabled in this environment/)
    } finally {
      server.close()
    }
  } finally {
    process.env.NODE_ENV = previousNodeEnv
    process.env.ENABLE_DEV_ROUTES = previousFlag
  }
})
