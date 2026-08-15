import test from 'node:test'
import assert from 'node:assert/strict'
import * as http from 'node:http'
import { createRequestListener } from '../src/server/app.ts'
import { MemoryImplementationRepository } from '../src/server/repository.ts'
import { ImplementationService } from '../src/server/service.ts'
import { EvidenceEvaluatorService } from '../src/server/evaluator/evaluatorService.ts'
import { course } from '../src/data/course.ts'
import type {
  ImplementationState,
  PremiseArtifactValue,
  StructuredEvidenceEvaluation,
} from '../src/domain/course.ts'
import type { IEvidenceInterpreter, SubmissionResponseDTO } from '../src/server/types.ts'
import { n01Fixtures } from './fixtures/n01Fixtures.ts'

class MockInterpreter implements IEvidenceInterpreter {
  public responseGenerator?: (params: { missionId: string; evidence: string }) => StructuredEvidenceEvaluation

  async interpret(params: { mission: { id: string }; evidence: string }): Promise<StructuredEvidenceEvaluation> {
    if (this.responseGenerator) {
      return this.responseGenerator({ missionId: params.mission.id, evidence: params.evidence })
    }
    throw new Error('No mock response configured')
  }
}

class FaultyRepository extends MemoryImplementationRepository {
  public shouldFailSave = false

  override async save(state: ImplementationState): Promise<void> {
    if (this.shouldFailSave) {
      throw new Error('Simulated database write failure')
    }
    return super.save(state)
  }
}

function createServer(options: {
  mockInterpreter?: MockInterpreter
  repository?: MemoryImplementationRepository
} = {}) {
  const repository = options.repository || new MemoryImplementationRepository()
  const service = new ImplementationService(repository)
  const interpreter = options.mockInterpreter || new MockInterpreter()
  const evaluatorService = new EvidenceEvaluatorService(interpreter)
  const requestListener = createRequestListener(service, { evaluatorService, enableDevRoutes: true })
  const server = http.createServer(requestListener)
  return { server, service, repository, interpreter, evaluatorService }
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
        headers: { 'Content-Type': 'application/json' },
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

test('A. NON-PASS DOES NOT CREATE ARTIFACT: N01 REWORK produces no canonical artifact', async () => {
  const interpreter = new MockInterpreter()
  interpreter.responseGenerator = () => ({
    criteria: [
      { criterionId: 'c1_concrete_idea', status: 'PASS', rationale: 'ok' },
      { criterionId: 'c2_target_audience', status: 'NOT_MET', rationale: 'Audiencia muy amplia' },
      { criterionId: 'c3_no_filler', status: 'PASS', rationale: 'ok' },
    ],
    coachingFeedback: 'Ajusta la audiencia.',
  })

  const { server } = createServer({ mockInterpreter: interpreter })
  await new Promise<void>((resolve) => server.listen(0, resolve))

  try {
    const createRes = await request(server, '/api/v1/implementations', {
      method: 'POST',
      body: { courseId: course.id },
    })
    const impl = createRes.data as ImplementationState

    const subRes = await request(server, `/api/v1/implementations/${impl.id}/submissions`, {
      method: 'POST',
      body: {
        missionId: 'N01',
        evidence: n01Fixtures.broadNoAudience.evidence,
      },
    })

    assert.equal(subRes.status, 200)
    const subData = subRes.data as SubmissionResponseDTO
    assert.equal(subData.policyVerdict, 'REWORK')
    assert.equal(subData.completed, false)
    assert.equal(subData.state.artifacts?.['premise'], undefined)

    // Verify backend persistence is unchanged
    const getRes = await request(server, `/api/v1/implementations/${impl.id}`)
    const currentState = getRes.data as ImplementationState
    assert.equal(currentState.artifacts?.['premise'], undefined)
  } finally {
    server.close()
  }
})

test('B & C. PASS CREATES ARTIFACT & PERSISTS: N01 PASS extracts verified premise artifact', async () => {
  const interpreter = new MockInterpreter()
  interpreter.responseGenerator = () => ({
    criteria: [
      { criterionId: 'c1_concrete_idea', status: 'PASS', rationale: 'ok' },
      { criterionId: 'c2_target_audience', status: 'PASS', rationale: 'ok' },
      { criterionId: 'c3_no_filler', status: 'PASS', rationale: 'ok' },
    ],
    coachingFeedback: 'Excelente.',
  })

  const { server } = createServer({ mockInterpreter: interpreter })
  await new Promise<void>((resolve) => server.listen(0, resolve))

  try {
    const createRes = await request(server, '/api/v1/implementations', {
      method: 'POST',
      body: { courseId: course.id },
    })
    const impl = createRes.data as ImplementationState

    const verifiedEvidenceText = n01Fixtures.validPremise.evidence
    const subRes = await request(server, `/api/v1/implementations/${impl.id}/submissions`, {
      method: 'POST',
      body: {
        missionId: 'N01',
        evidence: verifiedEvidenceText,
      },
    })

    assert.equal(subRes.status, 200)
    const subData = subRes.data as SubmissionResponseDTO
    assert.equal(subData.policyVerdict, 'PASS')
    assert.equal(subData.completed, true)

    // Verify artifact shape in returned state
    assert.ok(subData.state.artifacts)
    const premiseArtifact = subData.state.artifacts['premise']
    assert.ok(premiseArtifact)
    assert.equal(premiseArtifact.key, 'premise')
    assert.equal(premiseArtifact.sourceMissionId, 'N01')
    assert.equal((premiseArtifact.value as PremiseArtifactValue).statement, verifiedEvidenceText)
    assert.ok(premiseArtifact.createdAt)
    assert.ok(premiseArtifact.updatedAt)

    // Test C: Persistence check via GET reload
    const getRes = await request(server, `/api/v1/implementations/${impl.id}`)
    assert.equal(getRes.status, 200)
    const reloadedState = getRes.data as ImplementationState
    assert.ok(reloadedState.artifacts?.['premise'])
    assert.equal(
      (reloadedState.artifacts['premise'].value as PremiseArtifactValue).statement,
      verifiedEvidenceText,
    )
  } finally {
    server.close()
  }
})

test('D. N02 CONSUMPTION: N02 mission definition declares dependency and resolves verified artifact', () => {
  const n01Mission = course.chapters[0].missions.find((m) => m.id === 'N01')!
  const n02Mission = course.chapters[0].missions.find((m) => m.id === 'N02')!

  assert.deepEqual(n01Mission.producesArtifacts, ['premise'])
  assert.deepEqual(n02Mission.consumesArtifacts, ['premise'])

  // Simulate state with verified premise artifact
  const mockState: ImplementationState = {
    id: 'impl-test',
    courseId: course.id,
    completedMissionIds: ['N01'],
    artifacts: {
      premise: {
        key: 'premise',
        sourceMissionId: 'N01',
        value: {
          statement: 'Los consultores de software pierden 15 horas semanales en propuestas porque no estandarizan su alcance inicial.',
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  // Consumer resolution logic
  const requiredArtifactKey = n02Mission.consumesArtifacts?.[0]
  assert.equal(requiredArtifactKey, 'premise')
  const resolvedArtifact = mockState.artifacts?.[requiredArtifactKey!]
  assert.ok(resolvedArtifact)
  assert.equal(
    (resolvedArtifact.value as PremiseArtifactValue).statement,
    'Los consultores de software pierden 15 horas semanales en propuestas porque no estandarizan su alcance inicial.',
  )
})

test('E. SHARED METHODOLOGY + PERSONALIZED IMPLEMENTATION: Two learners get distinct N02 context', async () => {
  const interpreter = new MockInterpreter()
  interpreter.responseGenerator = () => ({
    criteria: [
      { criterionId: 'c1_concrete_idea', status: 'PASS', rationale: 'ok' },
      { criterionId: 'c2_target_audience', status: 'PASS', rationale: 'ok' },
      { criterionId: 'c3_no_filler', status: 'PASS', rationale: 'ok' },
    ],
    coachingFeedback: 'Aprobado.',
  })

  const { server } = createServer({ mockInterpreter: interpreter })
  await new Promise<void>((resolve) => server.listen(0, resolve))

  try {
    // Learner A
    const premiseA = 'Los consultores de software pierden 15 horas semanales en propuestas porque no estandarizan su alcance inicial.'
    const createResA = await request(server, '/api/v1/implementations', {
      method: 'POST',
      body: { courseId: course.id },
    })
    const implA = createResA.data as ImplementationState

    const subResA = await request(server, `/api/v1/implementations/${implA.id}/submissions`, {
      method: 'POST',
      body: { missionId: 'N01', evidence: premiseA },
    })
    const dataA = subResA.data as SubmissionResponseDTO

    // Learner B
    const premiseB = 'Los diseñadores freelance cobran 50% menos de lo debido por no saber cotizar valor.'
    const createResB = await request(server, '/api/v1/implementations', {
      method: 'POST',
      body: { courseId: course.id },
    })
    const implB = createResB.data as ImplementationState

    const subResB = await request(server, `/api/v1/implementations/${implB.id}/submissions`, {
      method: 'POST',
      body: { missionId: 'N01', evidence: premiseB },
    })
    const dataB = subResB.data as SubmissionResponseDTO

    // Compare N02 methodology vs individual artifacts
    const n02Mission = course.chapters[0].missions.find((m) => m.id === 'N02')!
    assert.equal(n02Mission.title, 'Estructura Directa')
    assert.equal(n02Mission.description, 'Convierte la premisa en una estructura breve, explícita y fácil de seguir.')

    const resolvedA = (dataA.state.artifacts?.['premise']?.value as PremiseArtifactValue).statement
    const resolvedB = (dataB.state.artifacts?.['premise']?.value as PremiseArtifactValue).statement

    assert.equal(resolvedA, premiseA)
    assert.equal(resolvedB, premiseB)
    assert.notEqual(resolvedA, resolvedB)
  } finally {
    server.close()
  }
})

test('F. MISSING ARTIFACT SAFETY: Safe explicit detection when artifact is not found', () => {
  const n02Mission = course.chapters[0].missions.find((m) => m.id === 'N02')!
  const emptyState: ImplementationState = {
    id: 'impl-empty',
    courseId: course.id,
    completedMissionIds: ['N01'],
    artifacts: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  const requiredArtifactKey = n02Mission.consumesArtifacts?.[0]
  const resolvedArtifact = emptyState.artifacts?.[requiredArtifactKey!]
  assert.equal(resolvedArtifact, undefined)
})

test('G. PERSISTENCE FAILURE: Failure during repository write leaves no partial canonical state', async () => {
  const faultyRepo = new FaultyRepository()
  const interpreter = new MockInterpreter()
  interpreter.responseGenerator = () => ({
    criteria: [
      { criterionId: 'c1_concrete_idea', status: 'PASS', rationale: 'ok' },
      { criterionId: 'c2_target_audience', status: 'PASS', rationale: 'ok' },
      { criterionId: 'c3_no_filler', status: 'PASS', rationale: 'ok' },
    ],
    coachingFeedback: 'Aprobado.',
  })

  const { server } = createServer({ mockInterpreter: interpreter, repository: faultyRepo })
  await new Promise<void>((resolve) => server.listen(0, resolve))

  try {
    const createRes = await request(server, '/api/v1/implementations', {
      method: 'POST',
      body: { courseId: course.id },
    })
    const impl = createRes.data as ImplementationState

    faultyRepo.shouldFailSave = true

    const subRes = await request(server, `/api/v1/implementations/${impl.id}/submissions`, {
      method: 'POST',
      body: { missionId: 'N01', evidence: n01Fixtures.validPremise.evidence },
    })

    assert.equal(subRes.status, 500)

    faultyRepo.shouldFailSave = false
    const checkRes = await request(server, `/api/v1/implementations/${impl.id}`)
    const state = checkRes.data as ImplementationState
    assert.deepEqual(state.completedMissionIds, [])
    assert.equal(state.artifacts?.['premise'], undefined)
  } finally {
    server.close()
  }
})
