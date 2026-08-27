import test from 'node:test'
import assert from 'node:assert/strict'
import * as http from 'node:http'
import { createRequestListener } from '../src/server/app.ts'
import {
  MemoryImplementationRepository,
  createImplementationRepository,
} from '../src/server/repository.ts'
import { ImplementationService } from '../src/server/service.ts'
import { course } from '../src/data/course.ts'
import { deriveMissionProgress } from '../src/domain/progression.ts'
import type { ImplementationState, Rubric, StructuredEvidenceEvaluation } from '../src/domain/course.ts'
import type { IEvidenceInterpreter } from '../src/server/evaluator/types.ts'
import { EvidenceEvaluatorService } from '../src/server/evaluator/evaluatorService.ts'

function stubPassEvaluation(rubric?: Rubric): StructuredEvidenceEvaluation {
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
    return stubPassEvaluation(params.rubric ?? params.mission.rubric)
  },
})

function createTestServer(options: { enableDevRoutes?: boolean } = { enableDevRoutes: true }) {
  const repository = new MemoryImplementationRepository()
  const service = new ImplementationService(repository)
  const requestListener = createRequestListener(service, {
    ...options,
    evaluatorService: stubPassEvaluator,
  })
  const server = http.createServer(requestListener)
  return { server, service, repository }
}

async function request(
  server: http.Server,
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<{ status: number; data: unknown }> {
  return new Promise((resolve, reject) => {
    const port = (server.address() as { port: number }).port
    const req = http.request(
      `http://localhost:${port}${path}`,
      {
        method: options.method || 'GET',
        headers: { 'Content-Type': 'application/json', 'x-trazo-mode': 'creator' },
      },
      (res) => {
        let raw = ''
        res.on('data', (chunk) => (raw += chunk))
        res.on('end', () => {
          try {
            const data = raw ? JSON.parse(raw) : null
            resolve({ status: res.statusCode || 500, data })
          } catch {
            resolve({ status: res.statusCode || 500, data: raw })
          }
        })
      },
    )
    req.on('error', reject)
    if (options.body) {
      req.write(JSON.stringify(options.body))
    }
    req.end()
  })
}

test('1. Legal Transitions: Locked mission (N09) cannot be completed and does not mutate state', async () => {
  const { server } = createTestServer()
  await new Promise<void>((resolve) => server.listen(0, resolve))

  try {
    // Create new implementation
    const createRes = await request(server, '/api/v1/implementations', {
      method: 'POST',
      body: { courseId: course.id, courseVersion: '1.0.0' },
    })
    const impl = createRes.data as ImplementationState

    // Attempt to dev-complete N09 (which requires prerequisites N01->...->N08)
    const res = await request(server, `/api/v1/implementations/${impl.id}/dev-complete-mission`, {
      method: 'POST',
      body: { missionId: 'N09' },
    })

    assert.equal(res.status, 400)
    const errData = res.data as { error: string }
    assert.match(errData.error, /mission is currently locked due to unmet prerequisites/)

    // Verify persisted state remained completely unmodified
    const checkRes = await request(server, `/api/v1/implementations/${impl.id}`)
    const current = checkRes.data as ImplementationState
    assert.deepEqual(current.completedMissionIds, [])
  } finally {
    server.close()
  }
})

test('2. Idempotency: Repeated completion requests do not corrupt state or alter timestamps', async () => {
  const { server } = createTestServer()
  await new Promise<void>((resolve) => server.listen(0, resolve))

  try {
    const createRes = await request(server, '/api/v1/implementations', {
      method: 'POST',
      body: { courseId: course.id, courseVersion: '1.0.0' },
    })
    const impl = createRes.data as ImplementationState

    // First verified completion of N01 (artifact-producing missions require submission)
    const firstRes = await request(server, `/api/v1/implementations/${impl.id}/submissions`, {
      method: 'POST',
      body: { missionId: 'N01', evidence: { type: 'text', text: 'premise inicial' } },
    })
    assert.equal(firstRes.status, 200)
    const firstState = firstRes.data as ImplementationState
    assert.equal(firstState.completed, true)
    assert.deepEqual(firstState.state.completedMissionIds, ['N01'])
    const initialUpdatedAt = firstState.state.updatedAt

    // Second completion of N01 (idempotent repeat)
    const secondRes = await request(server, `/api/v1/implementations/${impl.id}/submissions`, {
      method: 'POST',
      body: { missionId: 'N01', evidence: { type: 'text', text: 'premise repetida' } },
    })
    assert.equal(secondRes.status, 200)
    const secondState = secondRes.data as ImplementationState

    // State, completed array, and timestamp remain strictly identical
    assert.equal(secondState.completed, true)
    assert.deepEqual(secondState.state.completedMissionIds, ['N01'])
    assert.equal(secondState.state.updatedAt, initialUpdatedAt)
  } finally {
    server.close()
  }
})

test('3. Dev Route Safety: /dev-complete-mission is rejected when dev routes are disabled', async () => {
  const { server } = createTestServer({ enableDevRoutes: false })
  await new Promise<void>((resolve) => server.listen(0, resolve))

  try {
    const res = await request(server, '/api/v1/implementations/test-impl/dev-complete-mission', {
      method: 'POST',
      body: { missionId: 'N01' },
    })
    assert.equal(res.status, 403)
    const body = res.data as { error: string }
    assert.match(body.error, /disabled in this environment/)
  } finally {
    server.close()
  }
})

test('4. Storage Backend Selection: Explicit instantiation with no silent fallbacks', () => {
  const memoryRepo = createImplementationRepository('memory')
  assert.equal(memoryRepo.constructor.name, 'MemoryImplementationRepository')

  const fileRepo = createImplementationRepository('filestorage')
  assert.equal(fileRepo.constructor.name, 'FileStorageImplementationRepository')
})

test('5. Active Mission: Completing N01 unlocks N02 and N03 without arbitrarily choosing one as active', async () => {
  const { server } = createTestServer()
  await new Promise<void>((resolve) => server.listen(0, resolve))

  try {
    const createRes = await request(server, '/api/v1/implementations', {
      method: 'POST',
      body: { courseId: course.id, courseVersion: '1.0.0' },
    })
    const impl = createRes.data as ImplementationState

    const completeRes = await request(server, `/api/v1/implementations/${impl.id}/submissions`, {
      method: 'POST',
      body: { missionId: 'N01', evidence: { type: 'text', text: 'premise para desbloqueo' } },
    })
    assert.equal(completeRes.status, 200)
    const updatedState = (completeRes.data as ImplementationState & { state: ImplementationState }).state

    // Invariant: activeMissionId is not set to N02
    assert.equal(updatedState.activeMissionId, undefined)

    // Progression DAG correctly derives N02 and N03 as available
    const progress = deriveMissionProgress(
      course.chapters[0].missions,
      new Set(updatedState.completedMissionIds),
    )
    assert.equal(progress['N01'], 'completed')
    assert.equal(progress['N02'], 'available')
    assert.equal(progress['N03'], 'available')
    assert.equal(progress['N05'], 'locked')
  } finally {
    server.close()
  }
})

test('6. GET is strictly read-only: Querying non-existent implementation returns 404 without side effects', async () => {
  const { server, repository } = createTestServer()
  await new Promise<void>((resolve) => server.listen(0, resolve))

  try {
    const res = await request(server, '/api/v1/implementations/unknown-impl-id')
    assert.equal(res.status, 404)

    // Verify zero records were created in storage
    const list = await repository.list()
    assert.equal(list.length, 0)
  } finally {
    server.close()
  }
})

test('7. Invalid mission ID rejected with 400 Bad Request', async () => {
  const { server } = createTestServer()
  await new Promise<void>((resolve) => server.listen(0, resolve))

  try {
    const createRes = await request(server, '/api/v1/implementations', {
      method: 'POST',
      body: { courseId: course.id },
    })
    const impl = createRes.data as ImplementationState

    const invalidRes = await request(server, `/api/v1/implementations/${impl.id}/dev-complete-mission`, {
      method: 'POST',
      body: { missionId: 'NON_EXISTENT_ID' },
    })
    assert.equal(invalidRes.status, 400)
    const body = invalidRes.data as { error: string }
    assert.match(body.error, /Invalid missionId 'NON_EXISTENT_ID'/)
  } finally {
    server.close()
  }
})
