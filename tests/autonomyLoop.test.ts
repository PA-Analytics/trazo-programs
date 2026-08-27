import assert from 'node:assert/strict'
import test from 'node:test'
import { course } from '../src/data/course.ts'
import { AutonomyScheduler } from '../src/server/autonomy/autonomyScheduler.ts'
import { AutonomyService } from '../src/server/autonomy/autonomyService.ts'
import { FakeClock } from '../src/server/autonomy/clock.ts'
import { DeterministicAutonomyReasoner } from '../src/server/autonomy/deterministicReasoner.ts'
import { StallDetector } from '../src/server/autonomy/stallDetector.ts'
import type { LearnerStalledEventDTO } from '../src/server/autonomy/types.ts'
import { EvidenceEvaluatorService } from '../src/server/evaluator/evaluatorService.ts'
import type { EvidenceContext, IEvidenceInterpreter } from '../src/server/evaluator/types.ts'
import {
  MemoryAutonomyAuditRepository,
  MemoryImplementationRepository,
} from '../src/server/repository.ts'
import { ImplementationService } from '../src/server/service.ts'

class DynamicMockEvidenceInterpreter implements IEvidenceInterpreter {
  async interpret(context: EvidenceContext) {
    const criteria = context.evaluationRubric?.criteria?.map((c) => ({
      criterionId: c.id,
      status: 'PASS' as const,
      rationale: 'Cumplido.',
    })) ?? [
      { criterionId: 'c1_concrete_idea', status: 'PASS' as const, rationale: 'OK' },
      { criterionId: 'c2_target_audience', status: 'PASS' as const, rationale: 'OK' },
      { criterionId: 'c3_no_filler', status: 'PASS' as const, rationale: 'OK' },
    ]

    return {
      interactionType: 'EVIDENCE_SUBMISSION' as const,
      message: 'Misión verificada con éxito.',
      coachingFeedback: 'Excelente entrega.',
      criteria,
    }
  }
}

function setupAutonomyLoopHarness(initialTime?: string | number | Date, thresholdMs = 24 * 60 * 60 * 1000) {
  const clock = new FakeClock(initialTime ?? new Date())
  const implRepo = new MemoryImplementationRepository()
  const auditRepo = new MemoryAutonomyAuditRepository()
  const implService = new ImplementationService(implRepo)
  const reasoner = new DeterministicAutonomyReasoner({ mode: 'INTERVENE' })
  const autonomyService = new AutonomyService(implService, implRepo, auditRepo, reasoner)
  const detector = new StallDetector(implRepo, { clock, thresholdMs })
  const scheduler = new AutonomyScheduler(detector, autonomyService)
  const evaluator = new EvidenceEvaluatorService(new DynamicMockEvidenceInterpreter())

  return {
    clock,
    implRepo,
    auditRepo,
    implService,
    reasoner,
    autonomyService,
    detector,
    scheduler,
    evaluator,
  }
}

async function activateMission(implService: ImplementationService, implementationId: string): Promise<void> {
  await implService.startMission(implementationId, { missionId: 'N01' })
}

// 1. Auto stall -> learner_stalled -> INTERVENE, exactly one persisted action/audit, progression unchanged
test('Loop 1: auto stall -> learner_stalled -> INTERVENE, exactly one persisted audit, progression unchanged', async () => {
  const { implService, scheduler, clock, auditRepo, implRepo, reasoner } = setupAutonomyLoopHarness()
  const impl = await implService.createImplementation({ courseId: course.id })
  await activateMission(implService, impl.id)

  // Advance time past the 24h threshold
  clock.advanceByHours(25)

  const scanResult = await scheduler.runScan()

  assert.equal(scanResult.scannedCount, 1)
  assert.equal(scanResult.qualifiedCount, 1)
  assert.equal(scanResult.processedCount, 1)
  assert.equal(scanResult.errors.length, 0)

  const audit = scanResult.audits[0]
  assert.equal(audit.decision, 'INTERVENE')
  assert.equal(audit.status, 'EXECUTED')
  assert.equal(audit.actionType, 'GUIDANCE')
  assert.equal(audit.modelCallMade, true)
  assert.equal(audit.implementationId, impl.id)
  assert.equal(audit.guidance?.targetMissionId, 'N01')
  assert.equal(reasoner.callCount, 1)

  // Verify audit persistence
  const savedAudits = await auditRepo.list(impl.id)
  assert.equal(savedAudits.length, 1)
  assert.equal(savedAudits[0].eventId, audit.eventId)
  assert.equal(savedAudits[0].decision, 'INTERVENE')

  // Invariant: autonomy NEVER mutates progression or consequential memory
  const state = await implRepo.getById(impl.id)
  assert.ok(state)
  assert.deepEqual(state.completedMissionIds, [])
  assert.equal(state.consequentialMemory, undefined)
})

// 2. Same event / repeated scan replay is idempotent
test('Loop 2: repeated scan replay is idempotent without second reasoning call or duplicated audits', async () => {
  const { implService, scheduler, clock, auditRepo, reasoner } = setupAutonomyLoopHarness()
  const impl = await implService.createImplementation({ courseId: course.id })
  await activateMission(implService, impl.id)

  clock.advanceByHours(25)

  // First scan: executes intervention
  const firstScan = await scheduler.runScan()
  assert.equal(firstScan.processedCount, 1)
  assert.equal(firstScan.audits[0].modelCallMade, true)
  assert.equal(reasoner.callCount, 1)

  // Second scan at t = 26h without any state modification: returns cached audit
  clock.advanceByHours(1)
  const secondScan = await scheduler.runScan()
  assert.equal(secondScan.scannedCount, 1)
  assert.equal(secondScan.processedCount, 1)
  assert.equal(secondScan.audits[0].modelCallMade, false)
  assert.equal(secondScan.audits[0].id, firstScan.audits[0].id)
  assert.equal(secondScan.audits[0].decision, 'INTERVENE')

  // Reasoner was not called a second time
  assert.equal(reasoner.callCount, 1)

  // Audit repository has exactly 1 record
  const audits = await auditRepo.list(impl.id)
  assert.equal(audits.length, 1)
})

// 3. Progressed learner produces no event or stale old event becomes NO_OP
test('Loop 3: progressed learner produces no event and stale old event resolves to NO_OP', async () => {
  const { implService, scheduler, clock, evaluator, autonomyService, implRepo } = setupAutonomyLoopHarness()
  const impl = await implService.createImplementation({ courseId: course.id })
  await activateMission(implService, impl.id)

  // Stalled at N01
  clock.advanceByHours(25)
  const initialScan = await scheduler.runScan()
  assert.equal(initialScan.qualifiedCount, 1)
  const oldEvent = {
    eventId: initialScan.audits[0].eventId,
    eventType: 'learner_stalled' as const,
    implementationId: impl.id,
    courseId: impl.courseId,
    observedStateUpdatedAt: impl.updatedAt,
    stalledMissionId: 'N01',
  }

  // Learner progresses: completes N01
  const progressTime = new Date(clock.now().getTime() + 60 * 60 * 1000).toISOString()
  clock.advanceByHours(1)
  await implService.submitEvidence(
    impl.id,
    { missionId: 'N01', evidence: 'Los directores de TI pierden horas gestionando incidentes.' },
    evaluator,
  )
  // Ensure the state updatedAt is updated to progress time
  const updatedState = await implRepo.getById(impl.id)
  if (updatedState) {
    updatedState.updatedAt = progressTime
    await implRepo.save(updatedState)
  }

  // Immediately at 1h after progress, scan produces 0 events because threshold is 24h
  clock.advanceByHours(1)
  const scanAfterProgress = await scheduler.runScan()
  assert.equal(scanAfterProgress.qualifiedCount, 0)
  assert.equal(scanAfterProgress.processedCount, 0)

  // Replaying the old event (pointing to completed N01 and older timestamp) produces NO_OP
  const replayResult = await autonomyService.handleStalledLearner({
    ...oldEvent,
    eventId: 'evt-old-replay-1',
    idempotencyKey: 'idem-old-replay-1',
  })
  assert.equal(replayResult.decision, 'NO_OP')
  assert.equal(replayResult.status, 'NO_OP')

  const state = await implRepo.getById(impl.id)
  assert.deepEqual(state?.completedMissionIds, ['N01'])
})

// 4. ESCALATE for low confidence / creator review
test('Loop 4: ESCALATE mode or low confidence triggers fail-closed human review action', async () => {
  const { implService, scheduler, clock, reasoner, auditRepo, implRepo } = setupAutonomyLoopHarness()
  const impl = await implService.createImplementation({ courseId: course.id })
  await activateMission(implService, impl.id)

  // Set low confidence
  reasoner.setMode('LOW_CONFIDENCE', { decision: { confidence: 0.4 } })
  clock.advanceByHours(25)

  const scanResult = await scheduler.runScan()
  assert.equal(scanResult.processedCount, 1)
  const audit = scanResult.audits[0]

  assert.equal(audit.decision, 'ESCALATE')
  assert.equal(audit.status, 'ESCALATED')
  assert.equal(audit.actionType, 'HUMAN_REVIEW')
  assert.ok(audit.policyReason.includes('low_confidence_fallback'))

  const savedAudit = (await auditRepo.list(impl.id))[0]
  assert.equal(savedAudit.decision, 'ESCALATE')
  assert.equal(savedAudit.actionType, 'HUMAN_REVIEW')

  const state = await implRepo.getById(impl.id)
  assert.deepEqual(state?.completedMissionIds, [])
})

// 5. Provider failure/timeout leaves state valid and retry can succeed without duplicate effect
test('Loop 5: provider failure leaves state valid and retry succeeds cleanly without duplicate effect', async () => {
  const { implService, scheduler, clock, reasoner, auditRepo, implRepo } = setupAutonomyLoopHarness()
  const impl = await implService.createImplementation({ courseId: course.id })
  await activateMission(implService, impl.id)

  // Fail on first reasoning call
  reasoner.failTimes(1, '503 Service Unavailable: Temporary outage')
  clock.advanceByHours(25)

  // Scan 1: fails cleanly without throwing unhandled exception
  const scan1 = await scheduler.runScan()
  assert.equal(scan1.errors.length, 1)
  assert.ok(scan1.errors[0].error.includes('503 Service Unavailable'))
  assert.equal(scan1.audits.length, 0)

  // State is valid and untouched
  const stateAfterFailure = await implRepo.getById(impl.id)
  assert.ok(stateAfterFailure)
  assert.deepEqual(stateAfterFailure.completedMissionIds, [])

  // Scan 2 (retry): succeeds
  const scan2 = await scheduler.runScan()
  assert.equal(scan2.errors.length, 0)
  assert.equal(scan2.processedCount, 1)
  assert.equal(scan2.audits[0].decision, 'INTERVENE')
  assert.equal(scan2.audits[0].status, 'EXECUTED')

  // Exactly one audit persisted
  const audits = await auditRepo.list(impl.id)
  assert.equal(audits.length, 1)

  // Scan 3: idempotent replay
  const scan3 = await scheduler.runScan()
  assert.equal(scan3.processedCount, 1)
  assert.equal(scan3.audits[0].modelCallMade, false)
  assert.equal((await auditRepo.list(impl.id)).length, 1)
})

test('Loop 5b: malformed provider output is rejected at the shared decision boundary', async () => {
  const { implService, scheduler, clock, reasoner, auditRepo, implRepo } = setupAutonomyLoopHarness()
  const impl = await implService.createImplementation({ courseId: course.id })
  await activateMission(implService, impl.id)

  reasoner.setMode('MALFORMED')
  clock.advanceByHours(25)

  const failedScan = await scheduler.runScan()
  assert.equal(failedScan.errors.length, 1)
  assert.match(failedScan.errors[0].error, /AutonomyValidationError/)
  assert.equal((await auditRepo.list(impl.id)).length, 0)
  assert.deepEqual((await implRepo.getById(impl.id))?.completedMissionIds, [])

  reasoner.setMode('INTERVENE')
  const retryScan = await scheduler.runScan()
  assert.equal(retryScan.errors.length, 0)
  assert.equal(retryScan.audits[0].decision, 'INTERVENE')
  assert.equal((await auditRepo.list(impl.id)).length, 1)
})

// 6. Stale event race after state version/timestamp advances
test('Loop 6: stale event race after state advances produces NO_OP fail-closed', async () => {
  const { implService, autonomyService, implRepo } = setupAutonomyLoopHarness()
  const impl = await implService.createImplementation({ courseId: course.id })
  await activateMission(implService, impl.id)
  const originalTimestamp = impl.updatedAt

  // Advance state.updatedAt into future
  const state = await implRepo.getById(impl.id)
  if (state) {
    state.updatedAt = new Date(Date.now() + 10000).toISOString()
    state.learnerSetup = {
      goal: 'Aprender ventas B2B',
      availableTime: '30_60_MIN',
      helpPreference: 'DIRECT',
      updatedAt: state.updatedAt,
    }
    await implRepo.save(state)
  }

  // Stale event captured before learner state advance
  const staleEvent: LearnerStalledEventDTO = {
    eventId: 'evt-race-stale-1',
    eventType: 'learner_stalled',
    implementationId: impl.id,
    courseId: impl.courseId,
    observedStateUpdatedAt: originalTimestamp,
    stalledMissionId: 'N01',
  }

  const result = await autonomyService.handleStalledLearner(staleEvent)
  assert.equal(result.decision, 'NO_OP')
  assert.equal(result.status, 'NO_OP')
  assert.equal(result.policyReason, 'stale_observed_state_freshness')
  assert.equal(result.modelCallMade, false)
})

// 7. Workflow complete / inactive / not overdue / locked are not emitted
test('Loop 7: completed, not overdue, and locked workflows are never qualified by detector', async () => {
  const { implService, detector, clock, implRepo } = setupAutonomyLoopHarness()

  // Case A: Fresh implementation (1 hour old, threshold 24h) -> not overdue
  const freshImpl = await implService.createImplementation({ id: 'impl-fresh', courseId: course.id })
  clock.advanceByHours(1)
  let events = await detector.detectStalls()
  assert.equal(events.length, 0)

  // Case B: Workflow complete (all missions completed)
  const completedImpl = await implService.createImplementation({ id: 'impl-completed', courseId: course.id })
  const courseMissions = course.chapters.flatMap((ch) => ch.missions)
  const completedState = await implRepo.getById(completedImpl.id)
  if (completedState) {
    completedState.completedMissionIds = courseMissions.map((m) => m.id)
    await implRepo.save(completedState)
  }
  clock.advanceByHours(50)
  events = await detector.detectStalls()
  // freshImpl at 51h is qualified, completedImpl is NOT qualified
  assert.equal(events.filter((e) => e.implementationId === freshImpl.id).length, 0)
  const completedEvents = events.filter((e) => e.implementationId === completedImpl.id)
  assert.equal(completedEvents.length, 0)

  // Case C: Active mission is locked (e.g. state corrupted or manually set to locked N09)
  const lockedActiveImpl = await implService.createImplementation({ id: 'impl-locked', courseId: course.id })
  const lockedState = await implRepo.getById(lockedActiveImpl.id)
  if (lockedState) {
    lockedState.activeMissionId = 'N09' // Locked mission without prerequisites
    await implRepo.save(lockedState)
  }
  events = await detector.detectStalls()
  const lockedEvents = events.filter((e) => e.implementationId === lockedActiveImpl.id)
  assert.equal(lockedEvents.length, 0)
})

// 8. Concurrent duplicate delivery, scheduler restart, cross-workflow isolation and provider swap
test('Loop 8: concurrent delivery, restart, isolation, and provider swap', async () => {
  const { implService, scheduler, detector, autonomyService, clock, reasoner, auditRepo } =
    setupAutonomyLoopHarness()

  // A. Cross-workflow isolation: Alice and Bob both stall
  const alice = await implService.createImplementation({ id: 'impl-alice', userId: 'user-alice', courseId: course.id })
  const bob = await implService.createImplementation({ id: 'impl-bob', userId: 'user-bob', courseId: course.id })
  await activateMission(implService, alice.id)
  await activateMission(implService, bob.id)

  clock.advanceByHours(25)

  // B. Concurrent duplicate execution of scheduler scan
  const [scanA, scanB] = await Promise.all([scheduler.runScan(), scheduler.runScan()])

  assert.equal(scanA.processedCount, 2)
  assert.equal(scanB.processedCount, 2)

  // Exactly 1 audit per implementation
  const aliceAudits = await auditRepo.list(alice.id)
  const bobAudits = await auditRepo.list(bob.id)
  assert.equal(aliceAudits.length, 1)
  assert.equal(bobAudits.length, 1)
  assert.equal(aliceAudits[0].userId, 'user-alice')
  assert.equal(bobAudits[0].userId, 'user-bob')

  // Total model calls = 2 (1 for alice, 1 for bob)
  assert.equal(reasoner.callCount, 2)

  // C. Scheduler start / stop lifecycle
  assert.equal(scheduler.isRunning(), false)
  scheduler.start(500)
  assert.equal(scheduler.isRunning(), true)
  scheduler.stop()
  assert.equal(scheduler.isRunning(), false)

  // D. Provider swap: swap deterministic reasoner for a different reasoner instance
  const secondReasoner = new DeterministicAutonomyReasoner({ mode: 'ESCALATE' })
  const swappedAutonomyService = new AutonomyService(
    implService,
    implService.repository,
    auditRepo,
    secondReasoner,
  )
  const swappedScheduler = new AutonomyScheduler(detector, swappedAutonomyService)

  const charlie = await implService.createImplementation({
    id: 'impl-charlie',
    userId: 'user-charlie',
    courseId: course.id,
  })
  await activateMission(implService, charlie.id)

  clock.advanceByHours(25)
  const charlieScan = await swappedScheduler.runScan()
  const charlieAudit = charlieScan.audits.find((a) => a.implementationId === charlie.id)
  assert.ok(charlieAudit)
  assert.equal(charlieAudit.decision, 'ESCALATE')
  assert.equal(charlieAudit.status, 'ESCALATED')
  assert.equal(secondReasoner.callCount, 1)
})
