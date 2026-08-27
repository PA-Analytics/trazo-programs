import assert from 'node:assert/strict'
import test from 'node:test'
import * as http from 'node:http'
import { createRequestListener } from '../src/server/app.ts'
import { MemoryImplementationRepository } from '../src/server/repository.ts'
import { ImplementationService } from '../src/server/service.ts'
import { EvidenceEvaluatorService } from '../src/server/evaluator/evaluatorService.ts'
import { GeminiEvidenceInterpreter } from '../src/server/evaluator/geminiInterpreter.ts'
import { validateEvidenceEvaluation, EvaluationValidationError } from '../src/server/evaluator/schema.ts'
import { course } from '../src/data/course.ts'
import type {
  ImplementationState,
  Rubric,
  StructuredEvidenceEvaluation,
} from '../src/domain/course.ts'
import type { IEvidenceInterpreter } from '../src/server/evaluator/types.ts'
import type { SubmissionResponseDTO } from '../src/server/types.ts'

const n01Mission = course.chapters[0].missions.find((m) => m.id === 'N01')!
const n01Rubric: Rubric = n01Mission.rubric!

class MockUnifiedInterpreter implements IEvidenceInterpreter {
  public mockResponse: StructuredEvidenceEvaluation | null = null
  public lastParams?: Parameters<IEvidenceInterpreter['interpret']>[0]
  public callCount = 0

  async interpret(params: Parameters<IEvidenceInterpreter['interpret']>[0]): Promise<StructuredEvidenceEvaluation> {
    this.lastParams = params
    this.callCount += 1
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

// =========================================================================
// 1. DETERMINISTIC ROUTING & ZERO-MUTATION UNIT TESTS (MOCKED)
// =========================================================================

test('1. CONVERSATION intent: Returns companion response and NEVER mutates state', async () => {
  const repository = new MemoryImplementationRepository()
  const service = new ImplementationService(repository)
  const interpreter = new MockUnifiedInterpreter()
  const evaluatorService = new EvidenceEvaluatorService(interpreter)

  const initialState = await service.createImplementation({ courseId: course.id })
  const implementationId = initialState.id

  interpreter.mockResponse = {
    interactionType: 'CONVERSATION',
    message: 'Va. Aquí no necesito que escribas algo bonito todavía. Dime qué quieres contar y para quién.',
    coachingFeedback: 'Va. Aquí no necesito que escribas algo bonito todavía. Dime qué quieres contar y para quién.',
    criteria: [],
  }

  const listener = createRequestListener(service, { evaluatorService })
  const server = http.createServer(listener)
  await new Promise<void>((resolve) => server.listen(0, resolve))

  try {
    const res = await request(server, `/api/v1/implementations/${implementationId}/submissions`, {
      method: 'POST',
      body: {
        missionId: 'N01',
        evidence: 'no entiendo qué significa audiencia',
      },
    })

    assert.equal(res.status, 200)
    const body = res.data as SubmissionResponseDTO
    assert.equal(body.interactionType, 'CONVERSATION')
    assert.equal(body.completed, false)
    assert.match(body.message, /no necesito que escribas algo bonito/i)

    // Verify ZERO state mutation in repository
    const stateAfter = await repository.getById(implementationId)
    assert.deepEqual(stateAfter?.completedMissionIds, [])
    assert.equal(stateAfter?.artifacts?.['premise'], undefined)
  } finally {
    server.close()
  }
})

test('2. AMBIGUOUS intent: Returns clarifying question and NEVER mutates state', async () => {
  const repository = new MemoryImplementationRepository()
  const service = new ImplementationService(repository)
  const interpreter = new MockUnifiedInterpreter()
  const evaluatorService = new EvidenceEvaluatorService(interpreter)

  const initialState = await service.createImplementation({ courseId: course.id })
  const implementationId = initialState.id

  interpreter.mockResponse = {
    interactionType: 'AMBIGUOUS',
    message: 'Esa dirección sobre suplementos ya suena como premisa. ¿Quieres que la tomemos como entrega o seguimos explorando?',
    coachingFeedback: 'Esa dirección sobre suplementos ya suena como premisa. ¿Quieres que la tomemos como entrega o seguimos explorando?',
    criteria: [],
  }

  const listener = createRequestListener(service, { evaluatorService })
  const server = http.createServer(listener)
  await new Promise<void>((resolve) => server.listen(0, resolve))

  try {
    const res = await request(server, `/api/v1/implementations/${implementationId}/submissions`, {
      method: 'POST',
      body: {
        missionId: 'N01',
        evidence: 'qué tal si hago algo sobre suplementos para gente del gym?',
      },
    })

    assert.equal(res.status, 200)
    const body = res.data as SubmissionResponseDTO
    assert.equal(body.interactionType, 'AMBIGUOUS')
    assert.equal(body.completed, false)
    assert.match(body.message, /¿Quieres que la tomemos como entrega/i)

    // Verify ZERO state mutation
    const stateAfter = await repository.getById(implementationId)
    assert.deepEqual(stateAfter?.completedMissionIds, [])
    assert.equal(stateAfter?.artifacts?.['premise'], undefined)
  } finally {
    server.close()
  }
})

test('3. EVIDENCE_SUBMISSION with NOT_MET: Returns structured REWORK and NEVER mutates state', async () => {
  const repository = new MemoryImplementationRepository()
  const service = new ImplementationService(repository)
  const interpreter = new MockUnifiedInterpreter()
  const evaluatorService = new EvidenceEvaluatorService(interpreter)

  const initialState = await service.createImplementation({ courseId: course.id })
  const implementationId = initialState.id

  interpreter.mockResponse = {
    interactionType: 'EVIDENCE_SUBMISSION',
    message: 'Aquí tenemos la idea general pero nos falta definir para quién es.',
    coachingFeedback: 'Aquí tenemos la idea general pero nos falta definir para quién es.',
    criteria: [
      { criterionId: 'c1_concrete_idea', status: 'PASS', rationale: 'Tema presente' },
      { criterionId: 'c2_target_audience', status: 'NOT_MET', rationale: 'Falta audiencia' },
      { criterionId: 'c3_no_filler', status: 'PASS', rationale: 'Es conciso' },
    ],
  }

  const listener = createRequestListener(service, { evaluatorService })
  const server = http.createServer(listener)
  await new Promise<void>((resolve) => server.listen(0, resolve))

  try {
    const res = await request(server, `/api/v1/implementations/${implementationId}/submissions`, {
      method: 'POST',
      body: {
        missionId: 'N01',
        evidence: 'explicar los suplementos',
      },
    })

    assert.equal(res.status, 200)
    const body = res.data as SubmissionResponseDTO
    assert.equal(body.interactionType, 'EVIDENCE_SUBMISSION')
    assert.equal(body.policyVerdict, 'REWORK')
    assert.equal(body.completed, false)

    // Verify ZERO state mutation
    const stateAfter = await repository.getById(implementationId)
    assert.deepEqual(stateAfter?.completedMissionIds, [])
    assert.equal(stateAfter?.artifacts?.['premise'], undefined)
  } finally {
    server.close()
  }
})

test('4. EVIDENCE_SUBMISSION with PASS: Authoritatively mutates state and creates canonical artifact', async () => {
  const repository = new MemoryImplementationRepository()
  const service = new ImplementationService(repository)
  const interpreter = new MockUnifiedInterpreter()
  const evaluatorService = new EvidenceEvaluatorService(interpreter)

  const initialState = await service.createImplementation({ courseId: course.id })
  const implementationId = initialState.id

  const validEvidence = 'wey pues quiero decirle a freelancers que dejen de mandar propuestas genéricas porque pierden clientes'

  interpreter.mockResponse = {
    interactionType: 'EVIDENCE_SUBMISSION',
    message: 'Queda clarísimo el tema y la audiencia.',
    coachingFeedback: 'Queda clarísimo el tema y la audiencia.',
    criteria: [
      { criterionId: 'c1_concrete_idea', status: 'PASS', rationale: 'Propuestas genéricas' },
      { criterionId: 'c2_target_audience', status: 'PASS', rationale: 'Freelancers' },
      { criterionId: 'c3_no_filler', status: 'PASS', rationale: 'Conciso y concreto' },
    ],
  }

  const listener = createRequestListener(service, { evaluatorService })
  const server = http.createServer(listener)
  await new Promise<void>((resolve) => server.listen(0, resolve))

  try {
    const res = await request(server, `/api/v1/implementations/${implementationId}/submissions`, {
      method: 'POST',
      body: {
        missionId: 'N01',
        evidence: validEvidence,
      },
    })

    assert.equal(res.status, 200)
    const body = res.data as SubmissionResponseDTO
    assert.equal(body.interactionType, 'EVIDENCE_SUBMISSION')
    assert.equal(body.policyVerdict, 'PASS')
    assert.equal(body.completed, true)

    // Verify authoritative state mutation in repository
    const stateAfter = await repository.getById(implementationId)
    assert.deepEqual(stateAfter?.completedMissionIds, ['N01'])
    assert.equal(stateAfter?.artifacts?.['premise']?.value.statement, validEvidence)
  } finally {
    server.close()
  }
})

test('5. Schema Validation: Malformed interactionType fails closed with EvaluationValidationError', () => {
  assert.throws(
    () => {
      validateEvidenceEvaluation(
        {
          interactionType: 'INVALID_TYPE',
          message: 'Hola',
        },
        n01Rubric,
      )
    },
    (err: Error) => {
      assert(err instanceof EvaluationValidationError)
      assert.match(err.message, /interactionType 'INVALID_TYPE' is invalid/i)
      return true
    },
  )
})

test('6. Schema Validation: EVIDENCE_SUBMISSION without criteria fails closed', () => {
  assert.throws(
    () => {
      validateEvidenceEvaluation(
        {
          interactionType: 'EVIDENCE_SUBMISSION',
          message: 'Buen trabajo',
          criteria: [],
        },
        n01Rubric,
      )
    },
    (err: Error) => {
      assert(err instanceof EvaluationValidationError)
      assert.match(err.message, /criteria must be a non-empty array for EVIDENCE_SUBMISSION/i)
      return true
    },
  )
})

test('7. Recent mission exchange is forwarded as bounded, non-authoritative context', async () => {
  const repository = new MemoryImplementationRepository()
  const service = new ImplementationService(repository)
  const interpreter = new MockUnifiedInterpreter()
  const evaluatorService = new EvidenceEvaluatorService(interpreter)
  const initialState = await service.createImplementation({ courseId: course.id })

  interpreter.mockResponse = {
    interactionType: 'CONVERSATION',
    message: 'Sí, esa ya es una audiencia. Ahora nos falta qué quieres decirles.',
    coachingFeedback: 'Sí, esa ya es una audiencia. Ahora nos falta qué quieres decirles.',
    criteria: [],
  }

  const result = await service.submitEvidence(
    initialState.id,
    {
      missionId: 'N01',
      evidence: 'ahhh o sea podría ser para gente nueva en el gym?',
      recentInteraction: [
        { role: 'learner', content: 'no entiendo qué tengo que poner' },
        { role: 'companion', content: 'Dime qué quieres contar y para quién.' },
      ],
    },
    evaluatorService,
  )

  assert.equal(result.interactionType, 'CONVERSATION')
  assert.deepEqual(interpreter.lastParams?.recentInteraction, [
    { role: 'learner', content: 'no entiendo qué tengo que poner' },
    { role: 'companion', content: 'Dime qué quieres contar y para quién.' },
  ])
  assert.deepEqual((await repository.getById(initialState.id))?.completedMissionIds, [])
})

test('8. Completed missions stay idempotent: no evaluator call, no progress change, conversation lives at /next-action', async () => {
  const repository = new MemoryImplementationRepository()
  const service = new ImplementationService(repository)
  const interpreter = new MockUnifiedInterpreter()
  const evaluatorService = new EvidenceEvaluatorService(interpreter)
  const initialState = await service.createImplementation({ courseId: course.id })
  const validEvidence = 'Quiero explicarle a personas que acaban de entrar al gym qué suplementos básicos sí valen la pena.'

  interpreter.mockResponse = {
    interactionType: 'EVIDENCE_SUBMISSION',
    message: 'Queda claro el tema y la audiencia.',
    coachingFeedback: 'Queda claro el tema y la audiencia.',
    criteria: [
      { criterionId: 'c1_concrete_idea', status: 'PASS', rationale: 'Suplementos básicos' },
      { criterionId: 'c2_target_audience', status: 'PASS', rationale: 'Gente nueva en el gym' },
      { criterionId: 'c3_no_filler', status: 'PASS', rationale: 'Conciso' },
    ],
  }
  await service.submitEvidence(initialState.id, { missionId: 'N01', evidence: validEvidence }, evaluatorService)
  const callsAfterVerification = interpreter.callCount

  interpreter.mockResponse = {
    interactionType: 'CONVERSATION',
    message: 'Sí, ya cuenta. La premisa quedó guardada y puedes seguir desde ahí.',
    coachingFeedback: 'Sí, ya cuenta. La premisa quedó guardada y puedes seguir desde ahí.',
    criteria: [],
  }
  const response = await service.submitEvidence(
    initialState.id,
    { missionId: 'N01', evidence: 'esto ya cuenta o todavía no?' },
    evaluatorService,
  )

  // F4: duplicate submission of a completed mission is answered by the canned
  // idempotent response WITHOUT invoking the paid evaluator again.
  assert.equal(interpreter.callCount, callsAfterVerification)
  assert.equal(response.interactionType, 'EVIDENCE_SUBMISSION')
  assert.equal(response.policyVerdict, 'PASS')
  assert.equal(response.completed, true)
  assert.match(response.message, /ya quedó verificada/)
  assert.equal(response.evaluation, undefined)
  const stateAfter = await repository.getById(initialState.id)
  assert.deepEqual(stateAfter?.completedMissionIds, ['N01'])
  assert.equal(stateAfter?.artifacts?.premise?.value.statement, validEvidence)
})

test('9. Missions without a rubric can still hold a non-authoritative conversation', async () => {
  const interpreter = new MockUnifiedInterpreter()
  const evaluatorService = new EvidenceEvaluatorService(interpreter)

  interpreter.mockResponse = {
    interactionType: 'CONVERSATION',
    message: 'Cuéntame qué parte del ritmo quieres revisar y lo aterrizamos.',
    coachingFeedback: 'Cuéntame qué parte del ritmo quieres revisar y lo aterrizamos.',
    criteria: [],
  }

  const result = await evaluatorService.evaluateEvidence({
    missionId: 'N04',
    evidence: 'No se si el ritmo esta funcionando.',
  })

  assert.equal(result.evaluation.interactionType, 'CONVERSATION')
  assert.equal(result.policyVerdict, 'CLARIFY')
  assert.deepEqual(result.evaluation.criteria, [])
})

test('10. Missions without a rubric reject evidence evaluation instead of inventing authority', async () => {
  assert.throws(
    () => {
      validateEvidenceEvaluation(
        {
          interactionType: 'EVIDENCE_SUBMISSION',
          message: 'Esto parece una entrega.',
          criteria: [{ criterionId: 'made_up', status: 'PASS', rationale: 'No importa.' }],
        },
        undefined,
      )
    },
    (err: Error) => {
      assert(err instanceof EvaluationValidationError)
      assert.match(err.message, /structured rubric is required/i)
      return true
    },
  )
})
