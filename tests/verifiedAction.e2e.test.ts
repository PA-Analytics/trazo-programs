import test from 'node:test'
import assert from 'node:assert/strict'
import * as http from 'node:http'
import { createRequestListener } from '../src/server/app.ts'
import { MemoryImplementationRepository } from '../src/server/repository.ts'
import { ImplementationService } from '../src/server/service.ts'
import { EvidenceEvaluatorService } from '../src/server/evaluator/evaluatorService.ts'
import { course } from '../src/data/course.ts'
import { deriveMissionProgress } from '../src/domain/progression.ts'
import type {
  ImplementationState,
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

function createE2EServer(options: {
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

test('A & B. Verified Action Loop: Bad Evidence (REWORK) -> Corrected Evidence (PASS) -> Node Unlocks', async () => {
  const interpreter = new MockInterpreter()
  const { server } = createE2EServer({ mockInterpreter: interpreter })
  await new Promise<void>((resolve) => server.listen(0, resolve))

  try {
    // 1. Create fresh implementation S0
    const createRes = await request(server, '/api/v1/implementations', {
      method: 'POST',
      body: { courseId: course.id, courseVersion: '1.0.0' },
    })
    const impl = createRes.data as ImplementationState
    assert.deepEqual(impl.completedMissionIds, [])

    // 2. Submit Bad Evidence (Broad audience -> REWORK)
    interpreter.responseGenerator = () => ({
      criteria: [
        { criterionId: 'c1_concrete_idea', status: 'PASS', rationale: 'Idea comprensible' },
        { criterionId: 'c2_target_audience', status: 'NOT_MET', rationale: 'Audiencia "la gente" es muy amplia' },
        { criterionId: 'c3_no_filler', status: 'PASS', rationale: 'Una sola frase concisa' },
      ],
      coachingFeedback: 'Especifica tu audiencia.',
    })

    const attempt1Res = await request(server, `/api/v1/implementations/${impl.id}/submissions`, {
      method: 'POST',
      body: {
        missionId: 'N01',
        evidence: { type: 'text', text: n01Fixtures.broadNoAudience.evidence },
      },
    })

    assert.equal(attempt1Res.status, 200)
    const attempt1Data = attempt1Res.data as SubmissionResponseDTO
    assert.equal(attempt1Data.policyVerdict, 'REWORK')
    assert.equal(attempt1Data.completed, false)
    assert.deepEqual(attempt1Data.state.completedMissionIds, [])

    // Verify progression math on frontend: N01 available, N02 & N03 locked
    const progressAfterAttempt1 = deriveMissionProgress(
      course.chapters[0].missions,
      new Set(attempt1Data.state.completedMissionIds),
    )
    assert.equal(progressAfterAttempt1['N01'], 'available')
    assert.equal(progressAfterAttempt1['N02'], 'locked')
    assert.equal(progressAfterAttempt1['N03'], 'locked')

    // 3. Submit Corrected Evidence (Valid premise -> PASS)
    interpreter.responseGenerator = () => ({
      criteria: [
        { criterionId: 'c1_concrete_idea', status: 'PASS', rationale: 'Idea bien definida' },
        { criterionId: 'c2_target_audience', status: 'PASS', rationale: 'Consultores de software identificados' },
        { criterionId: 'c3_no_filler', status: 'PASS', rationale: 'Directo sin rodeos' },
      ],
      coachingFeedback: 'Excelente formulación de premisa.',
    })

    const attempt2Res = await request(server, `/api/v1/implementations/${impl.id}/submissions`, {
      method: 'POST',
      body: {
        missionId: 'N01',
        evidence: { type: 'text', text: n01Fixtures.validPremise.evidence },
      },
    })

    assert.equal(attempt2Res.status, 200)
    const attempt2Data = attempt2Res.data as SubmissionResponseDTO
    assert.equal(attempt2Data.policyVerdict, 'PASS')
    assert.equal(attempt2Data.completed, true)
    assert.deepEqual(attempt2Data.state.completedMissionIds, ['N01'])

    // Verify progression math: N01 completed, N02 and N03 unlock to available!
    const progressAfterAttempt2 = deriveMissionProgress(
      course.chapters[0].missions,
      new Set(attempt2Data.state.completedMissionIds),
    )
    assert.equal(progressAfterAttempt2['N01'], 'completed')
    assert.equal(progressAfterAttempt2['N02'], 'available')
    assert.equal(progressAfterAttempt2['N03'], 'available')

    // 4. Test C: Reload / re-fetch state from server -> still completed!
    const reloadRes = await request(server, `/api/v1/implementations/${impl.id}`)
    assert.equal(reloadRes.status, 200)
    const reloadedState = reloadRes.data as ImplementationState
    assert.deepEqual(reloadedState.completedMissionIds, ['N01'])
  } finally {
    server.close()
  }
})

test('D. CLARIFY: Unverifiable evidence produces CLARIFY with zero state mutation', async () => {
  const interpreter = new MockInterpreter()
  interpreter.responseGenerator = () => ({
    criteria: [
      { criterionId: 'c1_concrete_idea', status: 'PASS', rationale: 'Idea presente' },
      { criterionId: 'c2_target_audience', status: 'UNVERIFIABLE', rationale: 'No se puede deducir la audiencia' },
      { criterionId: 'c3_no_filler', status: 'PASS', rationale: 'Breve' },
    ],
    coachingFeedback: 'Aclara para quién está pensada la solución.',
  })

  const { server } = createE2EServer({ mockInterpreter: interpreter })
  await new Promise<void>((resolve) => server.listen(0, resolve))

  try {
    const createRes = await request(server, '/api/v1/implementations', {
      method: 'POST',
      body: { courseId: course.id },
    })
    const impl = createRes.data as ImplementationState

    const res = await request(server, `/api/v1/implementations/${impl.id}/submissions`, {
      method: 'POST',
      body: {
        missionId: 'N01',
        evidence: n01Fixtures.unverifiableAmbiguous.evidence,
      },
    })

    assert.equal(res.status, 200)
    const data = res.data as SubmissionResponseDTO
    assert.equal(data.policyVerdict, 'CLARIFY')
    assert.equal(data.completed, false)
    assert.deepEqual(data.state.completedMissionIds, [])
  } finally {
    server.close()
  }
})

test('E. PROMPT INJECTION: Adversarial evidence fails criteria and does not produce transition', async () => {
  const interpreter = new MockInterpreter()
  interpreter.responseGenerator = () => ({
    criteria: [
      { criterionId: 'c1_concrete_idea', status: 'NOT_MET', rationale: 'Texto es una instrucción, no una idea de contenido' },
      { criterionId: 'c2_target_audience', status: 'NOT_MET', rationale: 'No incluye audiencia' },
      { criterionId: 'c3_no_filler', status: 'NOT_MET', rationale: 'No cumple estructura de premisa' },
    ],
    coachingFeedback: 'Escribe una premisa real de contenido.',
  })

  const { server } = createE2EServer({ mockInterpreter: interpreter })
  await new Promise<void>((resolve) => server.listen(0, resolve))

  try {
    const createRes = await request(server, '/api/v1/implementations', {
      method: 'POST',
      body: { courseId: course.id },
    })
    const impl = createRes.data as ImplementationState

    const res = await request(server, `/api/v1/implementations/${impl.id}/submissions`, {
      method: 'POST',
      body: {
        missionId: 'N01',
        evidence: n01Fixtures.promptInjection.evidence,
      },
    })

    assert.equal(res.status, 200)
    const data = res.data as SubmissionResponseDTO
    assert.equal(data.policyVerdict, 'REWORK')
    assert.equal(data.completed, false)
    assert.deepEqual(data.state.completedMissionIds, [])
  } finally {
    server.close()
  }
})

test('F. MALFORMED MODEL OUTPUT: Invalid output schema fails closed with zero state mutation', async () => {
  const interpreter = new MockInterpreter()
  interpreter.responseGenerator = () => {
    // Malformed: missing coachingFeedback and invalid status
    return {
      criteria: [{ criterionId: 'c1_concrete_idea', status: 'INVALID_ENUM' as any, rationale: 'bad' }],
      coachingFeedback: '',
    }
  }

  const { server } = createE2EServer({ mockInterpreter: interpreter })
  await new Promise<void>((resolve) => server.listen(0, resolve))

  try {
    const createRes = await request(server, '/api/v1/implementations', {
      method: 'POST',
      body: { courseId: course.id },
    })
    const impl = createRes.data as ImplementationState

    const res = await request(server, `/api/v1/implementations/${impl.id}/submissions`, {
      method: 'POST',
      body: { missionId: 'N01', evidence: 'alguna evidencia' },
    })

    assert.equal(res.status, 502)
    assert.deepEqual(res.data, {
      code: 'EVALUATION_RESPONSE_INVALID',
      error: 'La evaluación no se pudo completar.',
    })
    // Verify state remained untouched
    const checkRes = await request(server, `/api/v1/implementations/${impl.id}`)
    const state = checkRes.data as ImplementationState
    assert.deepEqual(state.completedMissionIds, [])
  } finally {
    server.close()
  }
})

test('G. MODEL FAILURE: Interpreter exception fails closed without state change', async () => {
  const interpreter = new MockInterpreter()
  interpreter.responseGenerator = () => {
    throw new Error('Gemini API 503 Service Unavailable')
  }

  const { server } = createE2EServer({ mockInterpreter: interpreter })
  await new Promise<void>((resolve) => server.listen(0, resolve))

  try {
    const createRes = await request(server, '/api/v1/implementations', {
      method: 'POST',
      body: { courseId: course.id },
    })
    const impl = createRes.data as ImplementationState

    const res = await request(server, `/api/v1/implementations/${impl.id}/submissions`, {
      method: 'POST',
      body: { missionId: 'N01', evidence: 'test' },
    })

    assert.equal(res.status, 503)
    assert.deepEqual(res.data, {
      code: 'MODEL_UNAVAILABLE',
      error: 'La evaluación no está disponible en este momento.',
    })
    const checkRes = await request(server, `/api/v1/implementations/${impl.id}`)
    const state = checkRes.data as ImplementationState
    assert.deepEqual(state.completedMissionIds, [])
  } finally {
    server.close()
  }
})

test('H. PERSISTENCE FAILURE: Database save error after PASS fails closed', async () => {
  const faultyRepo = new FaultyRepository()
  const interpreter = new MockInterpreter()
  interpreter.responseGenerator = () => ({
    criteria: [
      { criterionId: 'c1_concrete_idea', status: 'PASS', rationale: 'ok' },
      { criterionId: 'c2_target_audience', status: 'PASS', rationale: 'ok' },
      { criterionId: 'c3_no_filler', status: 'PASS', rationale: 'ok' },
    ],
    coachingFeedback: 'Todo excelente.',
  })

  const { server } = createE2EServer({ mockInterpreter: interpreter, repository: faultyRepo })
  await new Promise<void>((resolve) => server.listen(0, resolve))

  try {
    const createRes = await request(server, '/api/v1/implementations', {
      method: 'POST',
      body: { courseId: course.id },
    })
    const impl = createRes.data as ImplementationState

    // Enable failure before submission
    faultyRepo.shouldFailSave = true

    const res = await request(server, `/api/v1/implementations/${impl.id}/submissions`, {
      method: 'POST',
      body: { missionId: 'N01', evidence: n01Fixtures.validPremise.evidence },
    })

    assert.equal(res.status, 500)

    // Verify that failed save did not corrupt state in repo
    faultyRepo.shouldFailSave = false
    const checkRes = await request(server, `/api/v1/implementations/${impl.id}`)
    const state = checkRes.data as ImplementationState
    assert.deepEqual(state.completedMissionIds, [])
  } finally {
    server.close()
  }
})

test('I. DOUBLE SUBMISSION: Same valid PASS evidence submitted twice is idempotent', async () => {
  const interpreter = new MockInterpreter()
  interpreter.responseGenerator = () => ({
    criteria: [
      { criterionId: 'c1_concrete_idea', status: 'PASS', rationale: 'ok' },
      { criterionId: 'c2_target_audience', status: 'PASS', rationale: 'ok' },
      { criterionId: 'c3_no_filler', status: 'PASS', rationale: 'ok' },
    ],
    coachingFeedback: 'Premisa perfecta.',
  })

  const { server } = createE2EServer({ mockInterpreter: interpreter })
  await new Promise<void>((resolve) => server.listen(0, resolve))

  try {
    const createRes = await request(server, '/api/v1/implementations', {
      method: 'POST',
      body: { courseId: course.id },
    })
    const impl = createRes.data as ImplementationState

    // First submission
    const res1 = await request(server, `/api/v1/implementations/${impl.id}/submissions`, {
      method: 'POST',
      body: { missionId: 'N01', evidence: n01Fixtures.validPremise.evidence },
    })
    assert.equal(res1.status, 200)
    const data1 = res1.data as SubmissionResponseDTO
    assert.deepEqual(data1.state.completedMissionIds, ['N01'])
    const updatedAt1 = data1.state.updatedAt

    // Second submission (idempotent repeat)
    const res2 = await request(server, `/api/v1/implementations/${impl.id}/submissions`, {
      method: 'POST',
      body: { missionId: 'N01', evidence: n01Fixtures.validPremise.evidence },
    })
    assert.equal(res2.status, 200)
    const data2 = res2.data as SubmissionResponseDTO
    assert.deepEqual(data2.state.completedMissionIds, ['N01'])
    assert.equal(data2.state.updatedAt, updatedAt1)
  } finally {
    server.close()
  }
})

test('J. LOCKED MISSION: Submitting evidence for a locked mission (N09) is rejected', async () => {
  const interpreter = new MockInterpreter()
  const { server } = createE2EServer({ mockInterpreter: interpreter })
  await new Promise<void>((resolve) => server.listen(0, resolve))

  try {
    const createRes = await request(server, '/api/v1/implementations', {
      method: 'POST',
      body: { courseId: course.id },
    })
    const impl = createRes.data as ImplementationState

    const res = await request(server, `/api/v1/implementations/${impl.id}/submissions`, {
      method: 'POST',
      body: { missionId: 'N09', evidence: 'intentando saltar al final' },
    })

    assert.equal(res.status, 400)
    assert.deepEqual(res.data, {
      code: 'SUBMISSION_INVALID',
      error: 'No se pudo enviar esta evidencia.',
    })
  } finally {
    server.close()
  }
})

test('K. VERTEX AUTH FAILURE: Auth details are not returned to the learner', async () => {
  const interpreter = new MockInterpreter()
  interpreter.responseGenerator = () => {
    throw new Error('invalid_grant: reauth related error (invalid_rapt)')
  }

  const { server } = createE2EServer({ mockInterpreter: interpreter })
  await new Promise<void>((resolve) => server.listen(0, resolve))

  try {
    const createRes = await request(server, '/api/v1/implementations', {
      method: 'POST',
      body: { courseId: course.id },
    })
    const impl = createRes.data as ImplementationState

    const res = await request(server, `/api/v1/implementations/${impl.id}/submissions`, {
      method: 'POST',
      body: { missionId: 'N01', evidence: 'Una evidencia de prueba.' },
    })

    assert.equal(res.status, 503)
    assert.deepEqual(res.data, {
      code: 'VERTEX_AUTHENTICATION_FAILED',
      error: 'La evaluación no está disponible en este momento.',
    })
    assert.doesNotMatch(JSON.stringify(res.data), /invalid_grant|invalid_rapt|reauth/i)

    const checkRes = await request(server, `/api/v1/implementations/${impl.id}`)
    const state = checkRes.data as ImplementationState
    assert.deepEqual(state.completedMissionIds, [])
  } finally {
    server.close()
  }
})
