import test from 'node:test'
import assert from 'node:assert/strict'
import * as http from 'node:http'
import { createRequestListener } from '../src/server/app.ts'
import { MemoryImplementationRepository } from '../src/server/repository.ts'
import { ImplementationService } from '../src/server/service.ts'
import { EvidenceEvaluatorService } from '../src/server/evaluator/evaluatorService.ts'
import { validateEvidenceEvaluation, EvaluationValidationError } from '../src/server/evaluator/schema.ts'
import { course } from '../src/data/course.ts'
import { applyEvaluationPolicy } from '../src/domain/evaluationPolicy.ts'
import type {
  ImplementationState,
  Rubric,
  StructuredEvidenceEvaluation,
} from '../src/domain/course.ts'
import type { IEvidenceInterpreter } from '../src/server/evaluator/types.ts'
import { n01Fixtures } from './fixtures/n01Fixtures.ts'

const n01Mission = course.chapters[0].missions.find((m) => m.id === 'N01')!
const n01Rubric: Rubric = n01Mission.rubric!

class MockEvidenceInterpreter implements IEvidenceInterpreter {
  public mockResponse: StructuredEvidenceEvaluation | null = null

  async interpret(): Promise<StructuredEvidenceEvaluation> {
    if (!this.mockResponse) {
      throw new Error('Mock response not configured')
    }
    return this.mockResponse
  }
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

// ==========================================
// 0. PRE-TASK SAFETY FIX TESTS
// ==========================================
test('0. Pre-Task Safety: Explicit opt-in for dev routes', async () => {
  const service = new ImplementationService(new MemoryImplementationRepository())

  // Case 1: Missing / undefined -> disabled
  const listenerDefault = createRequestListener(service, {})
  const serverDefault = http.createServer(listenerDefault)
  await new Promise<void>((resolve) => serverDefault.listen(0, resolve))
  try {
    const res = await request(serverDefault, '/api/v1/implementations/test/dev-complete-mission', {
      method: 'POST',
      body: { missionId: 'N01' },
    })
    assert.equal(res.status, 403)
  } finally {
    serverDefault.close()
  }

  // Case 2: Explicitly false -> disabled
  const listenerFalse = createRequestListener(service, { enableDevRoutes: false })
  const serverFalse = http.createServer(listenerFalse)
  await new Promise<void>((resolve) => serverFalse.listen(0, resolve))
  try {
    const res = await request(serverFalse, '/api/v1/implementations/test/dev-complete-mission', {
      method: 'POST',
      body: { missionId: 'N01' },
    })
    assert.equal(res.status, 403)
  } finally {
    serverFalse.close()
  }

  // Case 3: Explicitly true in non-production -> enabled
  const listenerTrue = createRequestListener(service, { enableDevRoutes: true })
  const serverTrue = http.createServer(listenerTrue)
  await new Promise<void>((resolve) => serverTrue.listen(0, resolve))
  try {
    // Calling with non-existent impl will return 404 (not 403 Forbidden)
    const res = await request(serverTrue, '/api/v1/implementations/non-existent/dev-complete-mission', {
      method: 'POST',
      body: { missionId: 'N01' },
    })
    assert.equal(res.status, 404)
  } finally {
    serverTrue.close()
  }
})

// ==========================================
// 1. RUNTIME VALIDATION & SCHEMA TESTS
// ==========================================
test('1. Runtime Validation: Valid model response is parsed and validated', () => {
  const raw = {
    criteria: [
      { criterionId: 'c1_concrete_idea', status: 'PASS', rationale: 'Idea definida' },
      { criterionId: 'c2_target_audience', status: 'PASS', rationale: 'Audiencia específica' },
      { criterionId: 'c3_no_filler', status: 'PASS', rationale: 'Directo y conciso' },
    ],
    coachingFeedback: 'Excelente formulación de premisa.',
  }

  const validated = validateEvidenceEvaluation(raw, n01Rubric)
  assert.equal(validated.criteria.length, 3)
  assert.equal(validated.coachingFeedback, 'Excelente formulación de premisa.')
})

test('1b. Runtime Validation: Malformed / invalid responses fail safely', () => {
  // Non-object
  assert.throws(
    () => validateEvidenceEvaluation('invalid string', n01Rubric),
    EvaluationValidationError,
  )

  // Missing coachingFeedback
  assert.throws(
    () =>
      validateEvidenceEvaluation(
        {
          criteria: [{ criterionId: 'c1_concrete_idea', status: 'PASS', rationale: 'ok' }],
        },
        n01Rubric,
      ),
    EvaluationValidationError,
  )

  // Unknown criterionId
  assert.throws(
    () =>
      validateEvidenceEvaluation(
        {
          criteria: [{ criterionId: 'UNKNOWN_CRITERION', status: 'PASS', rationale: 'ok' }],
          coachingFeedback: 'feedback',
        },
        n01Rubric,
      ),
    EvaluationValidationError,
  )

  // Invalid status enum
  assert.throws(
    () =>
      validateEvidenceEvaluation(
        {
          criteria: [{ criterionId: 'c1_concrete_idea', status: 'APPROVED', rationale: 'ok' }],
          coachingFeedback: 'feedback',
        },
        n01Rubric,
      ),
    EvaluationValidationError,
  )

  // Duplicate criterionId
  assert.throws(
    () =>
      validateEvidenceEvaluation(
        {
          criteria: [
            { criterionId: 'c1_concrete_idea', status: 'PASS', rationale: 'ok 1' },
            { criterionId: 'c1_concrete_idea', status: 'PASS', rationale: 'ok 2' },
          ],
          coachingFeedback: 'feedback',
        },
        n01Rubric,
      ),
    EvaluationValidationError,
  )
})

// ==========================================
// 2. MOCKED EVALUATION & DETERMINISTIC POLICY INTEGRATION
// ==========================================
test('2. Mocked Integration: Valid evaluation flows through applyEvaluationPolicy to PASS', async () => {
  const mockInterpreter = new MockEvidenceInterpreter()
  mockInterpreter.mockResponse = {
    criteria: [
      { criterionId: 'c1_concrete_idea', status: 'PASS', rationale: 'Idea bien definida' },
      { criterionId: 'c2_target_audience', status: 'PASS', rationale: 'Audiencia delimitada' },
      { criterionId: 'c3_no_filler', status: 'PASS', rationale: 'Sin rodeos' },
    ],
    coachingFeedback: 'La premisa está lista para pasar a las siguientes misiones.',
  }

  const evaluatorService = new EvidenceEvaluatorService(mockInterpreter)
  const result = await evaluatorService.evaluateEvidence({
    missionId: 'N01',
    evidence: n01Fixtures.validPremise.evidence,
  })

  assert.equal(result.policyVerdict, 'PASS')
  assert.equal(result.evaluation.criteria.length, 3)
})

test('2b. Mocked Integration: Required NOT_MET flows to REWORK', async () => {
  const mockInterpreter = new MockEvidenceInterpreter()
  mockInterpreter.mockResponse = {
    criteria: [
      { criterionId: 'c1_concrete_idea', status: 'PASS', rationale: 'Idea presente' },
      { criterionId: 'c2_target_audience', status: 'NOT_MET', rationale: 'Audiencia "la gente" es muy genérica' },
      { criterionId: 'c3_no_filler', status: 'PASS', rationale: 'Conciso' },
    ],
    coachingFeedback: 'Especifica a qué grupo concreto ayudas.',
  }

  const evaluatorService = new EvidenceEvaluatorService(mockInterpreter)
  const result = await evaluatorService.evaluateEvidence({
    missionId: 'N01',
    evidence: n01Fixtures.broadNoAudience.evidence,
  })

  assert.equal(result.policyVerdict, 'REWORK')
})

test('2c. Mocked Integration: Required UNVERIFIABLE flows to CLARIFY', async () => {
  const mockInterpreter = new MockEvidenceInterpreter()
  mockInterpreter.mockResponse = {
    criteria: [
      { criterionId: 'c1_concrete_idea', status: 'PASS', rationale: 'Idea comprensible' },
      { criterionId: 'c2_target_audience', status: 'UNVERIFIABLE', rationale: 'No se puede deducir la audiencia' },
      { criterionId: 'c3_no_filler', status: 'PASS', rationale: 'Breve' },
    ],
    coachingFeedback: 'Aclara para quién está pensada esta solución.',
  }

  const evaluatorService = new EvidenceEvaluatorService(mockInterpreter)
  const result = await evaluatorService.evaluateEvidence({
    missionId: 'N01',
    evidence: n01Fixtures.unverifiableAmbiguous.evidence,
  })

  assert.equal(result.policyVerdict, 'CLARIFY')
})

// ==========================================
// 3. STATE MUTATION PROHIBITION TEST (CRITICAL)
// ==========================================
test('3. State Mutation Prohibition: Calling POST /evaluations/evidence never mutates ImplementationState', async () => {
  const repository = new MemoryImplementationRepository()
  const implService = new ImplementationService(repository)
  const mockInterpreter = new MockEvidenceInterpreter()
  mockInterpreter.mockResponse = {
    criteria: [
      { criterionId: 'c1_concrete_idea', status: 'PASS', rationale: 'Idea perfecta' },
      { criterionId: 'c2_target_audience', status: 'PASS', rationale: 'Audiencia clara' },
      { criterionId: 'c3_no_filler', status: 'PASS', rationale: 'Sin relleno' },
    ],
    coachingFeedback: 'Excelente.',
  }
  const evaluatorService = new EvidenceEvaluatorService(mockInterpreter)

  const requestListener = createRequestListener(implService, { evaluatorService })
  const server = http.createServer(requestListener)
  await new Promise<void>((resolve) => server.listen(0, resolve))

  try {
    // 1. Create S0
    const createRes = await request(server, '/api/v1/implementations', {
      method: 'POST',
      body: { courseId: course.id, courseVersion: '1.0.0' },
    })
    const s0 = createRes.data as ImplementationState
    assert.deepEqual(s0.completedMissionIds, [])

    // 2. Call evidence evaluation endpoint (returns PASS verdict)
    const evalRes = await request(server, '/api/v1/evaluations/evidence', {
      method: 'POST',
      body: {
        missionId: 'N01',
        evidence: n01Fixtures.validPremise.evidence,
      },
    })
    assert.equal(evalRes.status, 200)
    const evalBody = evalRes.data as { policyVerdict: string }
    assert.equal(evalBody.policyVerdict, 'PASS')

    // 3. Re-fetch ImplementationState: MUST EQUAL S0 EXACTLY
    const checkRes = await request(server, `/api/v1/implementations/${s0.id}`)
    assert.equal(checkRes.status, 200)
    const s1 = checkRes.data as ImplementationState

    // Invariant assertions
    assert.deepEqual(s1.completedMissionIds, s0.completedMissionIds)
    assert.equal(s1.updatedAt, s0.updatedAt)
    assert.equal(s1.activeMissionId, s0.activeMissionId)
    assert.equal(s1.id, s0.id)
  } finally {
    server.close()
  }
})
