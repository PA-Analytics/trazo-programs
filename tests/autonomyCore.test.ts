import assert from 'node:assert/strict'
import http from 'node:http'
import test from 'node:test'
import { course } from '../src/data/course.ts'
import { createRequestListener } from '../src/server/app.ts'
import { AutonomyService } from '../src/server/autonomy/autonomyService.ts'
import { GeminiAutonomyReasoner } from '../src/server/autonomy/geminiReasoner.ts'
import type {
  AutonomyReasonerContext,
  AutonomyReasonerDecision,
  IAutonomyReasoner,
  LearnerStalledEventDTO,
} from '../src/server/autonomy/types.ts'
import { createCanonicalGeminiRuntime } from '../src/server/ai/runtime.ts'
import { EvidenceEvaluatorService } from '../src/server/evaluator/evaluatorService.ts'
import type { IEvidenceInterpreter } from '../src/server/evaluator/types.ts'
import {
  MemoryAutonomyAuditRepository,
  MemoryImplementationRepository,
} from '../src/server/repository.ts'
import { ImplementationService } from '../src/server/service.ts'

class MockAutonomyReasoner implements IAutonomyReasoner {
  public callCount = 0
  public lastContext: AutonomyReasonerContext | null = null
  public handler: (context: AutonomyReasonerContext) => Promise<AutonomyReasonerDecision> | AutonomyReasonerDecision =
    () => ({
      decision: 'INTERVENE',
      rationale: 'El estudiante está bloqueado en la formulación de la premisa.',
      confidence: 0.95,
      guidanceMessage: 'Define a tu cliente ideal y su dolor principal en una sola frase.',
      targetMissionId: 'N01',
    })

  async reason(context: AutonomyReasonerContext): Promise<AutonomyReasonerDecision> {
    this.callCount++
    this.lastContext = context
    return this.handler(context)
  }
}

class MockEvidenceInterpreter implements IEvidenceInterpreter {
  async interpret() {
    return {
      interactionType: 'EVIDENCE_SUBMISSION' as const,
      message: 'Excelente premisa.',
      coachingFeedback: 'Excelente premisa.',
      criteria: [
        { criterionId: 'c1_concrete_idea', status: 'PASS' as const, rationale: 'OK' },
        { criterionId: 'c2_target_audience', status: 'PASS' as const, rationale: 'OK' },
        { criterionId: 'c3_no_filler', status: 'PASS' as const, rationale: 'OK' },
      ],
    }
  }
}

function setupAutonomyTest() {
  const implRepo = new MemoryImplementationRepository()
  const auditRepo = new MemoryAutonomyAuditRepository()
  const implService = new ImplementationService(implRepo)
  const reasoner = new MockAutonomyReasoner()
  const autonomyService = new AutonomyService(implService, implRepo, auditRepo, reasoner)
  return { implRepo, auditRepo, implService, reasoner, autonomyService }
}

async function makeHttpRequest(
  server: http.Server,
  pathname: string,
  options: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
) {
  return new Promise<{ status: number; data: any }>((resolve, reject) => {
    const port = (server.address() as { port: number }).port
    const req = http.request(
      `http://localhost:${port}${pathname}`,
      {
        method: options.method ?? 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers ?? {}),
        },
      },
      (res) => {
        let raw = ''
        res.on('data', (chunk) => {
          raw += chunk
        })
        res.on('end', () =>
          resolve({
            status: res.statusCode ?? 500,
            data: raw ? JSON.parse(raw) : null,
          }),
        )
      },
    )
    req.on('error', reject)
    if (options.body !== undefined) req.write(JSON.stringify(options.body))
    req.end()
  })
}

// T01: Normal Intervention
test('T01 normal intervention: persists guidance action record, updates state memory, does not mutate progression', async () => {
  const { implService, autonomyService, auditRepo, implRepo, reasoner } = setupAutonomyTest()
  const impl = await implService.createImplementation({ courseId: course.id })

  const event: LearnerStalledEventDTO = {
    eventId: 'evt-t01',
    eventType: 'learner_stalled',
    implementationId: impl.id,
    courseId: impl.courseId,
    stalledMissionId: 'N01',
  }

  const result = await autonomyService.handleStalledLearner(event)

  assert.equal(result.decision, 'INTERVENE')
  assert.equal(result.status, 'EXECUTED')
  assert.equal(result.actionType, 'GUIDANCE')
  assert.equal(result.modelCallMade, true)
  assert.equal(result.guidance?.targetMissionId, 'N01')
  assert.equal(reasoner.callCount, 1)

  // Audit record persisted
  const savedAudit = await auditRepo.getByEventId('evt-t01')
  assert.ok(savedAudit)
  assert.equal(savedAudit.decision, 'INTERVENE')
  assert.deepEqual(savedAudit.stateSnapshot?.completedMissionIds, [])
  assert.equal(savedAudit.sourceEvent, 'learner_stalled')

  // Autonomy actions do not write learner memory or progression; the audit is the
  // durable action record and the learner's own consequential memory remains intact.
  const updatedState = await implRepo.getById(impl.id)
  assert.ok(updatedState)
  assert.equal(updatedState.consequentialMemory, undefined)
  // Invariant: completedMissionIds remains empty
  assert.deepEqual(updatedState.completedMissionIds, [])
})

// T02: Duplicate Replay
test('T02 duplicate: replaying exact eventId returns persisted result without second model call', async () => {
  const { implService, autonomyService, reasoner } = setupAutonomyTest()
  const impl = await implService.createImplementation({ courseId: course.id })

  const event: LearnerStalledEventDTO = {
    eventId: 'evt-t02',
    eventType: 'learner_stalled',
    implementationId: impl.id,
    courseId: impl.courseId,
    stalledMissionId: 'N01',
  }

  const firstResult = await autonomyService.handleStalledLearner(event)
  assert.equal(firstResult.modelCallMade, true)
  assert.equal(reasoner.callCount, 1)

  // Replay exact same event
  const replayResult = await autonomyService.handleStalledLearner(event)
  assert.equal(replayResult.modelCallMade, false)
  assert.equal(replayResult.decision, firstResult.decision)
  assert.equal(replayResult.eventId, firstResult.eventId)
  assert.equal(reasoner.callCount, 1) // No second model call
})

// T03: Concurrent Duplicate
test('T03 concurrent duplicate: simultaneous requests for same event execute exactly one model call', async () => {
  const { implService, autonomyService, reasoner, auditRepo, implRepo } = setupAutonomyTest()
  const impl = await implService.createImplementation({ courseId: course.id })

  const event: LearnerStalledEventDTO = {
    eventId: 'evt-t03',
    eventType: 'learner_stalled',
    implementationId: impl.id,
    courseId: impl.courseId,
    stalledMissionId: 'N01',
  }

  const [res1, res2] = await Promise.all([
    autonomyService.handleStalledLearner(event),
    autonomyService.handleStalledLearner(event),
  ])

  assert.equal(res1.decision, 'INTERVENE')
  assert.equal(res2.decision, 'INTERVENE')
  assert.equal(reasoner.callCount, 1) // Exactly one model call

  const allAudits = await auditRepo.list(impl.id)
  assert.equal(allAudits.length, 1)

  const state = await implRepo.getById(impl.id)
  assert.equal(state?.consequentialMemory, undefined)
})

test('T03b separate service instances converge on one persisted action', async () => {
  const implRepo = new MemoryImplementationRepository()
  const auditRepo = new MemoryAutonomyAuditRepository()
  const serviceA = new ImplementationService(implRepo)
  const serviceB = new ImplementationService(implRepo)
  const reasoner = new MockAutonomyReasoner()
  reasoner.handler = async () => {
    await new Promise((resolve) => setTimeout(resolve, 10))
    return {
      decision: 'INTERVENE',
      rationale: 'Intervención única.',
      confidence: 0.95,
      guidanceMessage: 'Una guía.',
      targetMissionId: 'N01',
    }
  }
  const autonomyA = new AutonomyService(serviceA, implRepo, auditRepo, reasoner)
  const autonomyB = new AutonomyService(serviceB, implRepo, auditRepo, reasoner)
  const impl = await serviceA.createImplementation({ courseId: course.id })
  const event = {
    eventId: 'evt-t03b',
    eventType: 'learner_stalled' as const,
    implementationId: impl.id,
    courseId: impl.courseId,
    stalledMissionId: 'N01',
  }

  const [first, second] = await Promise.all([
    autonomyA.handleStalledLearner(event),
    autonomyB.handleStalledLearner(event),
  ])

  assert.equal(first.decision, 'INTERVENE')
  assert.equal(second.decision, 'INTERVENE')
  assert.equal((await auditRepo.list(impl.id)).length, 1)
})

// T04: Resolved / Stale No-op
test('T04 resolved/stale no-op: already completed mission returns NO_OP without model call', async () => {
  const { implService, autonomyService, reasoner, implRepo } = setupAutonomyTest()
  const impl = await implService.createImplementation({ courseId: course.id })
  const evaluator = new EvidenceEvaluatorService(new MockEvidenceInterpreter())

  // Complete N01
  await implService.submitEvidence(
    impl.id,
    { missionId: 'N01', evidence: 'Los programadores senior pierden horas depurando.' },
    evaluator,
  )

  const event: LearnerStalledEventDTO = {
    eventId: 'evt-t04',
    eventType: 'learner_stalled',
    implementationId: impl.id,
    courseId: impl.courseId,
    stalledMissionId: 'N01',
  }

  const result = await autonomyService.handleStalledLearner(event)

  assert.equal(result.decision, 'NO_OP')
  assert.equal(result.status, 'NO_OP')
  assert.equal(result.policyReason, 'stalled_mission_already_completed')
  assert.equal(result.modelCallMade, false)
  assert.equal(reasoner.callCount, 0)

  const state = await implRepo.getById(impl.id)
  assert.deepEqual(state?.completedMissionIds, ['N01'])
})

// T05: Low Confidence Escalation / No-op
test('T05 low confidence escalation/no-op: confidence < 0.70 fails closed to ESCALATE', async () => {
  const { implService, autonomyService, reasoner, implRepo } = setupAutonomyTest()
  const impl = await implService.createImplementation({ courseId: course.id })

  reasoner.handler = () => ({
    decision: 'INTERVENE',
    rationale: 'Incierto sobre el bloqueo del estudiante.',
    confidence: 0.45, // Low confidence (< 0.70 threshold)
    guidanceMessage: 'Intenta continuar.',
    targetMissionId: 'N01',
  })

  const event: LearnerStalledEventDTO = {
    eventId: 'evt-t05',
    eventType: 'learner_stalled',
    implementationId: impl.id,
    courseId: impl.courseId,
    stalledMissionId: 'N01',
  }

  const result = await autonomyService.handleStalledLearner(event)

  assert.equal(result.decision, 'ESCALATE')
  assert.equal(result.status, 'ESCALATED')
  assert.ok(result.policyReason.includes('low_confidence_fallback'))

  const state = await implRepo.getById(impl.id)
  assert.equal(state?.consequentialMemory, undefined)
  assert.deepEqual(state?.completedMissionIds, [])
})

// T06: Missing Workflow Fail-Closed
test('T06 missing workflow fail-closed: missing implementation or invalid courseId fails closed', async () => {
  const { autonomyService } = setupAutonomyTest()

  await assert.rejects(
    () =>
      autonomyService.handleStalledLearner({
        eventId: 'evt-t06a',
        eventType: 'learner_stalled',
        implementationId: 'impl-non-existent',
        courseId: 'primer-cliente',
      }),
    /Implementation 'impl-non-existent' not found/,
  )

  await assert.rejects(
    () =>
      autonomyService.handleStalledLearner({
        eventId: 'evt-t06b',
        eventType: 'learner_stalled',
        implementationId: '',
        courseId: 'primer-cliente',
      }),
    /implementationId is required/,
  )
})

// T07: Stale Workflow Version
test('T07 stale workflow version: mismatch between event courseVersion and state courseVersion fails closed', async () => {
  const { implService, autonomyService } = setupAutonomyTest()
  const impl = await implService.createImplementation({
    courseId: course.id,
    courseVersion: '1.0.0',
  })

  const event: LearnerStalledEventDTO = {
    eventId: 'evt-t07',
    eventType: 'learner_stalled',
    implementationId: impl.id,
    courseId: impl.courseId,
    courseVersion: '0.9.0', // Stale version
    stalledMissionId: 'N01',
  }

  await assert.rejects(
    () => autonomyService.handleStalledLearner(event),
    /Workflow version mismatch: event version '0.9.0' does not match state version '1.0.0'/,
  )
})

// T08: Malformed Output
test('T08 malformed output: invalid JSON or schema from model fails closed', async () => {
  const implRepo = new MemoryImplementationRepository()
  const auditRepo = new MemoryAutonomyAuditRepository()
  const implService = new ImplementationService(implRepo)
  const impl = await implService.createImplementation({ courseId: course.id })

  const malformedRuntime = createCanonicalGeminiRuntime({
    client: {
      models: {
        generateContent: async () => ({ text: 'NOT_JSON' }),
      },
    },
  })
  const realReasoner = new GeminiAutonomyReasoner(malformedRuntime)
  const autonomyService = new AutonomyService(implService, implRepo, auditRepo, realReasoner)

  await assert.rejects(
    () =>
      autonomyService.handleStalledLearner({
        eventId: 'evt-t08',
        eventType: 'learner_stalled',
        implementationId: impl.id,
        courseId: impl.courseId,
        courseVersion: impl.courseVersion,
        observedStateUpdatedAt: impl.updatedAt,
        stalledMissionId: 'N01',
      }),
    /Model output could not be parsed as JSON/,
  )

  const state = await implRepo.getById(impl.id)
  assert.deepEqual(state?.completedMissionIds, [])
})

// T09: Provider Failure
test('T09 provider failure: runtime network/service error fails closed without corrupting state', async () => {
  const { implService, autonomyService, reasoner, implRepo } = setupAutonomyTest()
  const impl = await implService.createImplementation({ courseId: course.id })

  reasoner.handler = () => {
    throw new Error('503 Service Unavailable: Vertex AI backend unreachable')
  }

  await assert.rejects(
    () =>
      autonomyService.handleStalledLearner({
        eventId: 'evt-t09',
        eventType: 'learner_stalled',
        implementationId: impl.id,
        courseId: impl.courseId,
        courseVersion: impl.courseVersion,
        observedStateUpdatedAt: impl.updatedAt,
        stalledMissionId: 'N01',
      }),
    /503 Service Unavailable/,
  )

  const state = await implRepo.getById(impl.id)
  assert.deepEqual(state?.completedMissionIds, [])
  assert.equal(state?.consequentialMemory, undefined)
})

// T10: Retry After Provider Failure
test('T10 retry after provider failure: clean retry succeeds and persists audit record', async () => {
  const { implService, autonomyService, reasoner, auditRepo, implRepo } = setupAutonomyTest()
  const impl = await implService.createImplementation({ courseId: course.id })

  let failedOnce = false
  reasoner.handler = () => {
    if (!failedOnce) {
      failedOnce = true
      throw new Error('503 Temporary Provider Failure')
    }
    return {
      decision: 'INTERVENE',
      rationale: 'Recuperado con éxito.',
      confidence: 0.9,
      guidanceMessage: 'Guía de recuperación.',
      targetMissionId: 'N01',
    }
  }

  const event: LearnerStalledEventDTO = {
    eventId: 'evt-t10',
    eventType: 'learner_stalled',
    implementationId: impl.id,
    courseId: impl.courseId,
    stalledMissionId: 'N01',
  }

  // Attempt 1 fails
  await assert.rejects(() => autonomyService.handleStalledLearner(event), /503 Temporary Provider Failure/)

  // Attempt 2 succeeds
  const success = await autonomyService.handleStalledLearner(event)
  assert.equal(success.decision, 'INTERVENE')
  assert.equal(success.modelCallMade, true)

  const savedAudit = await auditRepo.getByEventId('evt-t10')
  assert.ok(savedAudit)

  const state = await implRepo.getById(impl.id)
  assert.equal(state?.consequentialMemory, undefined)
})

// T11: Illegal Action Cannot Mutate Progression
test('T11 illegal action cannot mutate progression: recommending locked mission fails closed to ESCALATE', async () => {
  const { implService, autonomyService, reasoner, implRepo } = setupAutonomyTest()
  const impl = await implService.createImplementation({ courseId: course.id })

  // Reasoner illegally recommends locked mission N09
  reasoner.handler = () => ({
    decision: 'INTERVENE',
    rationale: 'Saltar directo a la misión final.',
    confidence: 0.95,
    guidanceMessage: 'Ve a N09.',
    targetMissionId: 'N09', // Locked!
  })

  const event: LearnerStalledEventDTO = {
    eventId: 'evt-t11',
    eventType: 'learner_stalled',
    implementationId: impl.id,
    courseId: impl.courseId,
    stalledMissionId: 'N01',
  }

  const result = await autonomyService.handleStalledLearner(event)

  assert.equal(result.decision, 'ESCALATE')
  assert.ok(result.policyReason.includes('illegal_target_mission'))

  const state = await implRepo.getById(impl.id)
  assert.deepEqual(state?.completedMissionIds, [])
})

test('T11b a stalled event for a locked mission fails closed before intervention', async () => {
  const { implService, autonomyService, reasoner, auditRepo } = setupAutonomyTest()
  const impl = await implService.createImplementation({ courseId: course.id })

  await assert.rejects(
    () => autonomyService.handleStalledLearner({
      eventId: 'evt-t11b',
      eventType: 'learner_stalled',
      implementationId: impl.id,
      courseId: impl.courseId,
      stalledMissionId: 'N09',
    }),
    /locked mission 'N09'/,
  )
  assert.equal(reasoner.callCount, 0)
  assert.equal((await auditRepo.list(impl.id)).length, 0)
})

test('event idempotency cannot be replayed against another implementation', async () => {
  const { implService, autonomyService } = setupAutonomyTest()
  const first = await implService.createImplementation({ id: 'impl-idem-a', courseId: course.id })
  const second = await implService.createImplementation({ id: 'impl-idem-b', courseId: course.id })
  const event = {
    eventId: 'evt-scope-1',
    eventType: 'learner_stalled' as const,
    implementationId: first.id,
    courseId: first.courseId,
    stalledMissionId: 'N01',
  }

  await autonomyService.handleStalledLearner(event)
  await assert.rejects(
    () => autonomyService.handleStalledLearner({ ...event, implementationId: second.id }),
    /already bound to another workflow/,
  )
})

// T12: Consequential Memory Context
test('T12 consequential memory context: reasoner receives verified artifacts and learner preferences, not chat', async () => {
  const { implService, autonomyService, reasoner } = setupAutonomyTest()
  const impl = await implService.createImplementation({ courseId: course.id })
  await implService.repository.save({
    ...impl,
    consequentialMemory: [{
      id: 'memory-choice-1',
      kind: 'decision',
      summary: 'Eligió una estrategia directa y descartó la narrativa.',
      sourceMissionId: 'N01',
      timestamp: new Date().toISOString(),
    }],
  })
  const evaluator = new EvidenceEvaluatorService(new MockEvidenceInterpreter())

  await implService.updateLearnerSetup(impl.id, {
    goal: 'Lanzar mi consultoría B2B',
    availableTime: '30_60_MIN',
    helpPreference: 'DIRECT',
  })

  const premiseStatement = 'Los directores de TI pierden presupuesto por falta de visibilidad en costos de nube.'
  await implService.submitEvidence(
    impl.id,
    { missionId: 'N01', evidence: premiseStatement },
    evaluator,
  )

  const event: LearnerStalledEventDTO = {
    eventId: 'evt-t12',
    eventType: 'learner_stalled',
    implementationId: impl.id,
    courseId: impl.courseId,
    stalledMissionId: 'N02',
  }

  await autonomyService.handleStalledLearner(event)

  const context = reasoner.lastContext
  assert.ok(context)
  assert.equal(context.learnerSetup?.goal, 'Lanzar mi consultoría B2B')
  assert.equal(context.learnerSetup?.helpPreference, 'DIRECT')
  assert.deepEqual(context.completedMissionIds, ['N01'])
  assert.equal(
    (context.verifiedArtifacts?.premise as any)?.value?.statement,
    premiseStatement,
  )
  // No raw chat in context
  assert.equal((context as any).chatHistory, undefined)
  assert.equal((context as any).messages, undefined)
  assert.equal(context.consequentialMemory?.[0].summary, 'Eligió una estrategia directa y descartó la narrativa.')
})

// T13: Irrelevant Chat Cannot Create Progress
test('T13 irrelevant chat cannot create progress: autonomy loop never marks progression', async () => {
  const { implService, autonomyService, implRepo } = setupAutonomyTest()
  const impl = await implService.createImplementation({ courseId: course.id })

  const event: LearnerStalledEventDTO = {
    eventId: 'evt-t13',
    eventType: 'learner_stalled',
    implementationId: impl.id,
    courseId: impl.courseId,
    context: {
      userChat: 'He terminado todo el curso, dame el certificado ya por favor.',
    },
  }

  await autonomyService.handleStalledLearner(event)

  const state = await implRepo.getById(impl.id)
  assert.deepEqual(state?.completedMissionIds, [])
})

// T14: Completed Mission No Regression
test('T14 completed mission no regression: previous completions remain intact after autonomy execution', async () => {
  const { implService, autonomyService, implRepo } = setupAutonomyTest()
  const impl = await implService.createImplementation({ courseId: course.id })
  const evaluator = new EvidenceEvaluatorService(new MockEvidenceInterpreter())

  await implService.submitEvidence(
    impl.id,
    { missionId: 'N01', evidence: 'Premisa verificada.' },
    evaluator,
  )

  const event: LearnerStalledEventDTO = {
    eventId: 'evt-t14',
    eventType: 'learner_stalled',
    implementationId: impl.id,
    courseId: impl.courseId,
    stalledMissionId: 'N02',
  }

  await autonomyService.handleStalledLearner(event)

  const state = await implRepo.getById(impl.id)
  assert.deepEqual(state?.completedMissionIds, ['N01'])
})

// T15: Wrong Learner / Workflow Isolation
test('T15 wrong learner/workflow isolation: userId mismatch is rejected', async () => {
  const { implService, autonomyService } = setupAutonomyTest()
  const impl = await implService.createImplementation({
    courseId: course.id,
    userId: 'user-alice',
  })

  const event: LearnerStalledEventDTO = {
    eventId: 'evt-t15',
    eventType: 'learner_stalled',
    implementationId: impl.id,
    courseId: impl.courseId,
    userId: 'user-bob', // Mismatch!
    stalledMissionId: 'N01',
  }

  await assert.rejects(
    () => autonomyService.handleStalledLearner(event),
    /User mismatch: event userId 'user-bob' does not match implementation userId 'user-alice'/,
  )
})

// T16: Repeated Stable Execution
test('T16 repeated stable execution: successive stall events on different missions execute deterministically', async () => {
  const { implService, autonomyService, implRepo, reasoner } = setupAutonomyTest()
  const impl = await implService.createImplementation({ courseId: course.id })
  const evaluator = new EvidenceEvaluatorService(new MockEvidenceInterpreter())

  // Event 1 on N01
  const res1 = await autonomyService.handleStalledLearner({
    eventId: 'evt-t16-1',
    eventType: 'learner_stalled',
    implementationId: impl.id,
    courseId: impl.courseId,
    stalledMissionId: 'N01',
  })
  assert.equal(res1.decision, 'INTERVENE')

  // Complete N01
  await implService.submitEvidence(
    impl.id,
    { missionId: 'N01', evidence: 'Premisa válida.' },
    evaluator,
  )

  // Event 2 on N02
  reasoner.handler = () => ({
    decision: 'INTERVENE',
    rationale: 'Bloqueado en N02.',
    confidence: 0.92,
    guidanceMessage: 'Estructura en apertura, desarrollo y cierre.',
    targetMissionId: 'N02',
  })

  const res2 = await autonomyService.handleStalledLearner({
    eventId: 'evt-t16-2',
    eventType: 'learner_stalled',
    implementationId: impl.id,
    courseId: impl.courseId,
    stalledMissionId: 'N02',
  })
  assert.equal(res2.decision, 'INTERVENE')

  const state = await implRepo.getById(impl.id)
  assert.equal(state?.consequentialMemory, undefined)
  assert.deepEqual(state?.completedMissionIds, ['N01'])
})

// T17: Persistence Failure Retry-Safe
test('T17 persistence failure retry-safe: repository save failure rejects cleanly and retry succeeds', async () => {
  const { implService, reasoner } = setupAutonomyTest()
  const impl = await implService.createImplementation({ courseId: course.id })

  let failAuditSave = true
  const failingAuditRepo = new MemoryAutonomyAuditRepository()
  const originalSave = failingAuditRepo.save.bind(failingAuditRepo)
  failingAuditRepo.save = async (record) => {
    if (failAuditSave) {
      throw new Error('Database disk full / connection timeout')
    }
    return originalSave(record)
  }
  const originalCreateIfAbsent = failingAuditRepo.createIfAbsent.bind(failingAuditRepo)
  failingAuditRepo.createIfAbsent = async (record) => {
    if (failAuditSave) {
      throw new Error('Database disk full / connection timeout')
    }
    return originalCreateIfAbsent(record)
  }

  const autonomyService = new AutonomyService(
    implService,
    implService.repository,
    failingAuditRepo,
    reasoner,
  )

  const event: LearnerStalledEventDTO = {
    eventId: 'evt-t17',
    eventType: 'learner_stalled',
    implementationId: impl.id,
    courseId: impl.courseId,
    stalledMissionId: 'N01',
  }

  await assert.rejects(
    () => autonomyService.handleStalledLearner(event),
    /Database disk full/,
  )

  // Enable persistence and retry
  failAuditSave = false
  const retryResult = await autonomyService.handleStalledLearner(event)
  assert.equal(retryResult.decision, 'INTERVENE')
  assert.equal(retryResult.status, 'EXECUTED')
  assert.equal((await implService.getImplementation(impl.id))?.consequentialMemory, undefined)
})

// T18: Concurrent Learner Mutation / State Freshness
test('T18 concurrent learner mutation/state freshness: stale observed timestamp produces NO_OP', async () => {
  const { implService, autonomyService, implRepo, reasoner } = setupAutonomyTest()
  const impl = await implService.createImplementation({ courseId: course.id })

  // State is updated now
  await implService.updateLearnerSetup(impl.id, {
    goal: 'Objetivo nuevo',
    availableTime: '15_30_MIN',
    helpPreference: 'ADAPTIVE',
  })

  // Event with older observed timestamp (before learner setup update)
  const staleEvent: LearnerStalledEventDTO = {
    eventId: 'evt-t18',
    eventType: 'learner_stalled',
    implementationId: impl.id,
    courseId: impl.courseId,
    observedStateUpdatedAt: '2020-01-01T00:00:00.000Z', // Far in the past
    stalledMissionId: 'N01',
  }

  const result = await autonomyService.handleStalledLearner(staleEvent)

  assert.equal(result.decision, 'NO_OP')
  assert.equal(result.status, 'NO_OP')
  assert.equal(result.policyReason, 'stale_observed_state_freshness')
  assert.equal(result.modelCallMade, false)
  assert.equal(reasoner.callCount, 0)
})

// HTTP Route Integration Tests
test('HTTP route POST /api/v1/events/learner-stalled processes event and returns 200', async () => {
  const { implService, autonomyService, auditRepo } = setupAutonomyTest()
  const impl = await implService.createImplementation({ courseId: course.id })

  const listener = createRequestListener(implService, {
    autonomyService,
    autonomyAuditRepository: auditRepo,
  })
  const server = http.createServer(listener)
  await new Promise<void>((resolve) => server.listen(0, resolve))

  try {
    const res = await makeHttpRequest(server, '/api/v1/events/learner-stalled', {
      method: 'POST',
      body: {
        eventId: 'evt-http-1',
        eventType: 'learner_stalled',
        implementationId: impl.id,
        courseId: impl.courseId,
        courseVersion: impl.courseVersion,
        observedStateUpdatedAt: impl.updatedAt,
        stalledMissionId: 'N01',
      },
    })

    assert.equal(res.status, 200)
    assert.equal(res.data.decision, 'INTERVENE')
    assert.equal(res.data.eventId, 'evt-http-1')

    // Duplicate replay over HTTP returns same record
    const replayRes = await makeHttpRequest(server, '/api/v1/events/learner-stalled', {
      method: 'POST',
      body: {
        eventId: 'evt-http-1',
        eventType: 'learner_stalled',
        implementationId: impl.id,
        courseId: impl.courseId,
        courseVersion: impl.courseVersion,
        observedStateUpdatedAt: impl.updatedAt,
        stalledMissionId: 'N01',
      },
    })
    assert.equal(replayRes.status, 200)
    assert.equal(replayRes.data.modelCallMade, false)
  } finally {
    server.close()
  }
})

test('HTTP route POST /api/v1/implementations/:id/events/learner-stalled infers implementationId from path', async () => {
  const { implService, autonomyService, auditRepo } = setupAutonomyTest()
  const impl = await implService.createImplementation({ courseId: course.id })

  const listener = createRequestListener(implService, {
    autonomyService,
    autonomyAuditRepository: auditRepo,
  })
  const server = http.createServer(listener)
  await new Promise<void>((resolve) => server.listen(0, resolve))

  try {
    const res = await makeHttpRequest(
      server,
      `/api/v1/implementations/${impl.id}/events/learner-stalled`,
      {
        method: 'POST',
        body: {
          eventId: 'evt-http-path-1',
          eventType: 'learner_stalled',
          courseId: impl.courseId,
          courseVersion: impl.courseVersion,
          observedStateUpdatedAt: impl.updatedAt,
          stalledMissionId: 'N01',
        },
      },
    )

    assert.equal(res.status, 200)
    assert.equal(res.data.decision, 'INTERVENE')
    assert.equal(res.data.implementationId, impl.id)
  } finally {
    server.close()
  }
})

test('HTTP autonomy route is authenticated in production', async () => {
  const previousNodeEnv = process.env.NODE_ENV
  const previousToken = process.env.TRAZO_AUTONOMY_EVENT_TOKEN
  process.env.NODE_ENV = 'production'
  delete process.env.TRAZO_AUTONOMY_EVENT_TOKEN

  const { implService, autonomyService, auditRepo } = setupAutonomyTest()
  const impl = await implService.createImplementation({ courseId: course.id })
  const listener = createRequestListener(implService, {
    autonomyService,
    autonomyAuditRepository: auditRepo,
  })
  const server = http.createServer(listener)
  await new Promise<void>((resolve) => server.listen(0, resolve))

  try {
    const res = await makeHttpRequest(server, '/api/v1/events/learner-stalled', {
      method: 'POST',
      body: {
        eventId: 'evt-http-auth-1',
        eventType: 'learner_stalled',
        implementationId: impl.id,
        courseId: impl.courseId,
        courseVersion: impl.courseVersion,
        observedStateUpdatedAt: impl.updatedAt,
        stalledMissionId: 'N01',
      },
    })

    assert.equal(res.status, 403)
    assert.equal(res.data.code, 'AUTONOMY_EVENT_AUTH_REQUIRED')
  } finally {
    server.close()
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = previousNodeEnv
    if (previousToken === undefined) delete process.env.TRAZO_AUTONOMY_EVENT_TOKEN
    else process.env.TRAZO_AUTONOMY_EVENT_TOKEN = previousToken
  }
})
