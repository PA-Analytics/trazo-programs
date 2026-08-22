import assert from 'node:assert/strict'
import test from 'node:test'
import * as http from 'node:http'
import { course } from '../src/data/course.ts'
import type { ImplementationState, Rubric, StructuredEvidenceEvaluation } from '../src/domain/course.ts'
import { CalibrationService } from '../src/server/calibrationService.ts'
import { createRequestListener } from '../src/server/app.ts'
import { EvidenceEvaluatorService } from '../src/server/evaluator/evaluatorService.ts'
import { GeminiEvidenceInterpreter } from '../src/server/evaluator/geminiInterpreter.ts'
import { validateEvidenceEvaluation } from '../src/server/evaluator/schema.ts'
import type { IEvidenceInterpreter } from '../src/server/evaluator/types.ts'
import { MemoryCalibrationRepository, MemoryImplementationRepository } from '../src/server/repository.ts'
import { ImplementationService } from '../src/server/service.ts'
import type { SubmissionResponseDTO } from '../src/server/types.ts'
import { createCanonicalGeminiRuntime } from '../src/server/ai/runtime.ts'

class MockInterpreter implements IEvidenceInterpreter {
  lastRubricSize = 0

  async interpret(params: Parameters<IEvidenceInterpreter['interpret']>[0]): Promise<StructuredEvidenceEvaluation> {
    this.lastRubricSize = params.rubric?.criteria.length ?? 0
    const criteria = (params.rubric ?? course.chapters[0].missions[0].rubric!).criteria.map((criterion, index) => ({
      criterionId: criterion.id,
      status: index === 0 ? 'NOT_MET' as const : 'PASS' as const,
      rationale: index === 0 ? 'Falta una señal concreta.' : 'Se observa en el texto.',
    }))
    return {
      interactionType: 'EVIDENCE_SUBMISSION',
      message: 'Todavía falta una señal concreta.',
      coachingFeedback: 'Todavía falta una señal concreta.',
      criteria,
    }
  }
}

async function request(server: http.Server, pathname: string, options: { method?: string; body?: unknown; headers?: Record<string, string> } = {}) {
  return new Promise<{ status: number; data: any }>((resolve, reject) => {
    const port = (server.address() as { port: number }).port
    const req = http.request(`http://localhost:${port}${pathname}`, {
      method: options.method ?? 'GET',
      headers: { 'Content-Type': 'application/json', ...options.headers },
    }, (res) => {
      let raw = ''
      res.on('data', (chunk) => { raw += chunk })
      res.on('end', () => resolve({ status: res.statusCode ?? 500, data: raw ? JSON.parse(raw) : null }))
    })
    req.on('error', reject)
    if (options.body !== undefined) req.write(JSON.stringify(options.body))
    req.end()
  })
}

function createTestServer() {
  const implementations = new MemoryImplementationRepository()
  const calibrations = new MemoryCalibrationRepository()
  const service = new ImplementationService(implementations, calibrations)
  const interpreter = new MockInterpreter()
  const listener = createRequestListener(service, {
    evaluatorService: new EvidenceEvaluatorService(interpreter),
    calibrationService: new CalibrationService(calibrations),
    enableDevRoutes: true,
  })
  return { server: http.createServer(listener), implementations, interpreter }
}

test('TRAZO V0 learner setup persists all three fields across reload', async () => {
  const { server } = createTestServer()
  await new Promise<void>((resolve) => server.listen(0, resolve))
  try {
    const created = await request(server, '/api/v1/implementations', {
      method: 'POST', body: { id: 'v0-learner', courseId: course.id },
    })
    const updated = await request(server, '/api/v1/implementations/v0-learner/learner-setup', {
      method: 'PATCH', body: { goal: 'Publicar mi primera pieza estratégica', availableTime: '30_60_MIN', helpPreference: 'QUESTIONS' },
    })
    assert.equal(created.status, 201)
    assert.equal(updated.status, 200)
    assert.deepEqual(updated.data.learnerSetup.goal, 'Publicar mi primera pieza estratégica')
    assert.equal(updated.data.learnerSetup.availableTime, '30_60_MIN')
    assert.equal(updated.data.learnerSetup.helpPreference, 'QUESTIONS')

    const reload = await request(server, '/api/v1/implementations/v0-learner')
    assert.deepEqual(reload.data.learnerSetup, updated.data.learnerSetup)
  } finally { server.close() }
})

test('TRAZO V0 help preference changes delivery but not the deterministic verdict', async () => {
  const { server } = createTestServer()
  await new Promise<void>((resolve) => server.listen(0, resolve))
  try {
    for (const [id, helpPreference] of [['v0-direct', 'DIRECT'], ['v0-question', 'QUESTIONS']] as const) {
      await request(server, '/api/v1/implementations', { method: 'POST', body: { id, courseId: course.id } })
      await request(server, `/api/v1/implementations/${id}/learner-setup`, {
        method: 'PATCH', body: { goal: 'Validar una idea', availableTime: '15_30_MIN', helpPreference },
      })
    }
    const direct = await request(server, '/api/v1/implementations/v0-direct/submissions', { method: 'POST', body: { missionId: 'N01', evidence: 'una idea' } })
    const question = await request(server, '/api/v1/implementations/v0-question/submissions', { method: 'POST', body: { missionId: 'N01', evidence: 'una idea' } })
    const directData = direct.data as SubmissionResponseDTO
    const questionData = question.data as SubmissionResponseDTO
    assert.equal(directData.policyVerdict, 'REWORK')
    assert.equal(questionData.policyVerdict, 'REWORK')
    assert.notEqual(directData.message, questionData.message)
    assert.deepEqual(directData.state.completedMissionIds, [])
    assert.deepEqual(questionData.state.completedMissionIds, [])
  } finally { server.close() }
})

test('TRAZO V0 calibration preserves sources, separates verdicts, and confirms criteria', async () => {
  const { server, interpreter } = createTestServer()
  await new Promise<void>((resolve) => server.listen(0, resolve))
  try {
    const creatorHeaders = { 'X-Trazo-Mode': 'creator' }
    const start = await request(server, '/api/v1/calibrations/N01', {
      method: 'POST', headers: creatorHeaders, body: { initialStandard: 'La idea debe ser concreta, tener una audiencia reconocible y no aplicar a cualquiera.' },
    })
    assert.equal(start.status, 200)
    const own = await request(server, '/api/v1/calibrations/N01/examples', {
      method: 'POST', headers: creatorHeaders, body: { source: 'creator', submission: 'Para freelancers que no cierran clientes, una pieza sobre propuestas genéricas.' },
    })
    const generated = await request(server, '/api/v1/calibrations/N01/generate-examples', { method: 'POST', headers: creatorHeaders })
    assert.equal(own.data.examples.at(-1).source, 'creator')
    assert.equal(generated.data.examples.filter((example: any) => example.source === 'generated').length, 3)
    const premature = await request(server, '/api/v1/calibrations/N01/propose', { method: 'POST', headers: creatorHeaders })
    assert.equal(premature.status, 400)

    const examples = generated.data.examples.filter((example: any) => example.source === 'generated')
    const verdicts = ['PASS', 'REWORK', 'CLARIFY'] as const
    for (let index = 0; index < verdicts.length; index++) {
      const judged = await request(server, `/api/v1/calibrations/N01/examples/${examples[index].id}`, {
        method: 'PATCH', headers: creatorHeaders, body: { verdict: verdicts[index], reason: `Decisión del creador ${verdicts[index]}.` },
      })
      const judgedExample = judged.data.examples.find((example: any) => example.id === examples[index].id)
      assert.equal(judgedExample.verdict, verdicts[index])
      assert.equal(judgedExample.source, 'generated')
      assert.match(judgedExample.reason, /Decisión del creador/)
    }

    const proposal = await request(server, '/api/v1/calibrations/N01/propose', { method: 'POST', headers: creatorHeaders })
    assert.equal(proposal.data.status, 'proposed')
    assert.ok(proposal.data.proposedRubric.criteria.length > 0)
    const proposedDescriptions = proposal.data.proposedRubric.criteria.map((criterion: any) => criterion.description)
    assert.equal(proposedDescriptions.length, 3)
    assert.ok(proposedDescriptions.some((description: string) => description.includes('audiencia reconocible')))
    assert.ok(proposedDescriptions.every((description: string) => !description.includes('Decisión del creador')))
    const criteria = proposal.data.proposedRubric.criteria.map((criterion: any) => `Corregido: ${criterion.description}`)
    const confirmed = await request(server, '/api/v1/calibrations/N01/confirm', { method: 'POST', headers: creatorHeaders, body: { criteria } })
    assert.equal(confirmed.data.status, 'confirmed')
    assert.equal(confirmed.data.proposedRubric.criteria[0].description, criteria[0])
    const customEvaluation = validateEvidenceEvaluation({
      interactionType: 'EVIDENCE_SUBMISSION',
      message: 'Falta una señal concreta.',
      criteria: confirmed.data.proposedRubric.criteria.map((criterion: any, index: number) => ({
        criterionId: criterion.id,
        status: index === 0 ? 'NOT_MET' : 'PASS',
        rationale: 'Observación del caso.',
      })),
    }, confirmed.data.proposedRubric)
    assert.equal(customEvaluation.criteria.length, confirmed.data.proposedRubric.criteria.length)

    const implementation = await request(server, '/api/v1/implementations', { method: 'POST', body: { id: 'v0-policy', courseId: course.id } })
    assert.equal(implementation.status, 201)
    const submission = await request(server, '/api/v1/implementations/v0-policy/submissions', { method: 'POST', body: { missionId: 'N01', evidence: 'texto' } })
    assert.equal((submission.data as SubmissionResponseDTO).policyVerdict, 'REWORK')
    assert.equal(interpreter.lastRubricSize, confirmed.data.proposedRubric.criteria.length)
    assert.deepEqual((await request(server, '/api/v1/implementations/v0-policy')).data.completedMissionIds, [])
  } finally { server.close() }
})

test('creator calibration requires explicit creator/demo mode', async () => {
  const { server } = createTestServer()
  await new Promise<void>((resolve) => server.listen(0, resolve))
  try {
    const learnerAttempt = await request(server, '/api/v1/calibrations/N01', {
      method: 'POST',
      body: { initialStandard: 'Intento desde la superficie learner.' },
    })
    assert.equal(learnerAttempt.status, 403)
    assert.equal(learnerAttempt.data.code, 'CREATOR_MODE_REQUIRED')

    const creatorAccess = await request(server, '/api/v1/calibrations/N01', {
      method: 'POST',
      headers: { 'X-Trazo-Mode': 'creator' },
      body: { initialStandard: 'La respuesta debe ser concreta.' },
    })
    assert.equal(creatorAccess.status, 200)
  } finally { server.close() }
})

test('confirmed rubric is used when Gemini output is validated', async () => {
  const mission = course.chapters[0].missions.find((item) => item.id === 'N01')!
  const confirmedRubric: Rubric = {
    id: 'confirmed-calibration-rubric',
    version: '0.1.1',
    criteria: [{
      id: 'creator_specificity',
      label: 'Especificidad del creador',
      description: 'La respuesta nombra una audiencia concreta.',
      isRequired: true,
    }],
    systemInstructions: 'Usa el criterio confirmado.',
  }
  const runtime = createCanonicalGeminiRuntime({
    client: {
      models: {
        generateContent: async () => ({
          text: JSON.stringify({
            interactionType: 'EVIDENCE_SUBMISSION',
            message: 'La audiencia está delimitada.',
            criteria: [{ criterionId: 'creator_specificity', status: 'PASS', rationale: 'Se nombra una audiencia concreta.' }],
          }),
        }),
      },
    },
  })
  const interpreter = new GeminiEvidenceInterpreter(runtime)

  const evaluation = await interpreter.interpret({
    mission,
    evidence: 'Freelancers que reciben reuniones pero no cierran clientes.',
    rubric: confirmedRubric,
  })
  assert.equal(evaluation.criteria[0].criterionId, 'creator_specificity')
})
