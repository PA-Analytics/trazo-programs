import { resolvePack } from '../../data/packs/index.ts'
import type { ImplementationState } from '../../domain/course.ts'
import { deriveMissionProgress } from '../../domain/progression.ts'
import { adaptMethodologyGraphToCourse } from '../../domain/methodologyAdapter.ts'
import { MethodologyGraphRuntime } from '../../domain/methodologyRuntime.ts'
import type { ImplementationService } from '../service.ts'
import type { MethodologyService } from '../methodologyService.ts'
import type { IImplementationRepository } from '../types.ts'
import { validateAutonomyDecision } from './schema.ts'
import type {
  AutonomyAuditRecord,
  AutonomyDecisionType,
  AutonomyReasonerContext,
  IAutonomyAuditRepository,
  IAutonomyReasoner,
  LearnerStalledEventDTO,
} from './types.ts'

function auditId(eventId: string): string {
  return `autonomy-${encodeURIComponent(eventId)}`
}

function assertReplayScope(record: AutonomyAuditRecord, event: LearnerStalledEventDTO, implementationId: string) {
  if (record.implementationId !== implementationId || record.courseId !== event.courseId) {
    throw new Error(`Idempotency key '${event.eventId}' is already bound to another workflow`)
  }
  if (record.userId && event.userId && record.userId !== event.userId) {
    throw new Error(`Idempotency key '${event.eventId}' is already bound to another learner`)
  }
}

export class AutonomyService {
  private readonly implementationService: ImplementationService
  private readonly implementationRepo: IImplementationRepository
  private readonly auditRepo: IAutonomyAuditRepository
  private readonly reasoner: IAutonomyReasoner
  private readonly methodologyService?: MethodologyService

  constructor(
    implementationService: ImplementationService,
    implementationRepo: IImplementationRepository,
    auditRepo: IAutonomyAuditRepository,
    reasoner: IAutonomyReasoner,
    methodologyService?: MethodologyService,
  ) {
    this.implementationService = implementationService
    this.implementationRepo = implementationRepo
    this.auditRepo = auditRepo
    this.reasoner = reasoner
    this.methodologyService = methodologyService
  }

  async handleStalledLearner(event: LearnerStalledEventDTO): Promise<AutonomyAuditRecord> {
    const eventId = event.eventId?.trim()
    if (!eventId) throw new Error('eventId is required')
    if (event.eventType !== 'learner_stalled') {
      throw new Error(`Invalid eventType '${event.eventType}', expected 'learner_stalled'`)
    }
    const implementationId = event.implementationId?.trim()
    if (!implementationId) throw new Error('implementationId is required')
    const courseId = event.courseId?.trim()
    if (!courseId) throw new Error('courseId is required')
    const idempotencyKey = event.idempotencyKey?.trim() || eventId

    // Fast-path replay: check for existing audit record before acquiring lock
    const existingAudit = await this.auditRepo.getByIdempotencyKey(idempotencyKey)
    if (existingAudit) {
      assertReplayScope(existingAudit, event, implementationId)
      return {
        ...existingAudit,
        modelCallMade: false,
      }
    }

    return this.implementationService.runExclusive(implementationId, async () => {
      // Re-check idempotency inside lock for concurrent duplicate calls
      const lockedAudit = await this.auditRepo.getByIdempotencyKey(idempotencyKey)
      if (lockedAudit) {
        assertReplayScope(lockedAudit, event, implementationId)
        return {
          ...lockedAudit,
          modelCallMade: false,
        }
      }

      // Load authoritative state
      const state = await this.implementationRepo.getById(implementationId)
      if (!state) {
        throw new Error(`Implementation '${implementationId}' not found`)
      }

      // Validate identity / isolation
      if (event.userId && state.userId && event.userId !== state.userId) {
        throw new Error(
          `User mismatch: event userId '${event.userId}' does not match implementation userId '${state.userId}'`,
        )
      }

      // Validate course and pack
      if (state.courseId !== courseId) {
        throw new Error(
          `Course mismatch: event courseId '${courseId}' does not match state courseId '${state.courseId}'`,
        )
      }

      if (event.courseVersion && state.courseVersion && event.courseVersion !== state.courseVersion) {
        throw new Error(
          `Workflow version mismatch: event version '${event.courseVersion}' does not match state version '${state.courseVersion}'`,
        )
      }

      const methodology = this.methodologyService
        ? await this.methodologyService.getForState(state)
        : undefined
      const course = methodology ? adaptMethodologyGraphToCourse(methodology) : resolvePack(state.courseId)
      const graphRuntime = methodology ? new MethodologyGraphRuntime(methodology) : undefined
      const allCourseMissions = course.chapters.flatMap((ch) => ch.missions)

      if (event.stalledMissionId && !allCourseMissions.some((mission) => mission.id === event.stalledMissionId)) {
        throw new Error(`Mission '${event.stalledMissionId}' not found in course '${course.id}'`)
      }

      // Validate observed state freshness
      if (event.observedStateUpdatedAt) {
        const observedTime = new Date(event.observedStateUpdatedAt).getTime()
        const stateTime = new Date(state.updatedAt).getTime()
        if (Number.isNaN(observedTime)) {
          throw new Error('observedStateUpdatedAt must be a valid timestamp')
        }
        if (!isNaN(observedTime) && !isNaN(stateTime) && observedTime < stateTime) {
          const now = new Date().toISOString()
          const auditRecord: AutonomyAuditRecord = {
            id: auditId(idempotencyKey),
            eventId,
            implementationId,
            userId: state.userId,
            courseId: state.courseId,
            courseVersion: state.courseVersion,
            eventType: event.eventType,
            idempotencyKey,
            correlationId: event.correlationId,
            observedStateUpdatedAt: event.observedStateUpdatedAt,
            sourceEvent: event.eventType,
            stateSnapshot: snapshotState(state),
            decision: 'NO_OP',
            status: 'NO_OP',
            policyReason: 'stale_observed_state_freshness',
            modelCallMade: false,
            actionType: 'NO_OP',
            executedAt: now,
            createdAt: now,
          }
          return this.persistAudit(auditRecord)
        }
      }

      // Derive progression
      const currentCompleted = new Set(state.completedMissionIds)
      const currentProgress = graphRuntime
        ? graphRuntime.deriveProgress(currentCompleted, state.activeMissionId, state.workflowDecisions)
        : deriveMissionProgress(allCourseMissions, currentCompleted)

      // Resolved / Stale no-op: check if stalled mission is already completed
      if (event.stalledMissionId && state.completedMissionIds.includes(event.stalledMissionId)) {
        const now = new Date().toISOString()
        const auditRecord: AutonomyAuditRecord = {
            id: auditId(idempotencyKey),
          eventId,
          implementationId,
          userId: state.userId,
          courseId: state.courseId,
          courseVersion: state.courseVersion,
            eventType: event.eventType,
            idempotencyKey,
            correlationId: event.correlationId,
            observedStateUpdatedAt: event.observedStateUpdatedAt,
            sourceEvent: event.eventType,
            stateSnapshot: snapshotState(state),
            decision: 'NO_OP',
          status: 'NO_OP',
          policyReason: 'stalled_mission_already_completed',
            modelCallMade: false,
            actionType: 'NO_OP',
          executedAt: now,
          createdAt: now,
        }
        return this.persistAudit(auditRecord)
      }

      if (event.stalledMissionId && currentProgress[event.stalledMissionId] === 'locked') {
        throw new Error(`Cannot process stalled event for locked mission '${event.stalledMissionId}'`)
      }

      const availableMissions = allCourseMissions.filter(
        (m) => currentProgress[m.id] === 'available' || currentProgress[m.id] === 'active',
      )

      if (availableMissions.length === 0) {
        const now = new Date().toISOString()
        const auditRecord: AutonomyAuditRecord = {
          id: auditId(idempotencyKey),
          eventId,
          implementationId,
          userId: state.userId,
          courseId: state.courseId,
          courseVersion: state.courseVersion,
          eventType: event.eventType,
          idempotencyKey,
          correlationId: event.correlationId,
          observedStateUpdatedAt: event.observedStateUpdatedAt,
          sourceEvent: event.eventType,
          stateSnapshot: snapshotState(state),
          decision: 'NO_OP',
          status: 'NO_OP',
          policyReason: 'no_available_missions',
          modelCallMade: false,
          actionType: 'NO_OP',
          executedAt: now,
          createdAt: now,
        }
        return this.persistAudit(auditRecord)
      }

      const stalledMission = event.stalledMissionId
        ? allCourseMissions.find((m) => m.id === event.stalledMissionId)
        : state.activeMissionId
          ? allCourseMissions.find((m) => m.id === state.activeMissionId)
          : availableMissions[0]

      // Construct Blocker Context (pure durable state, no raw chat)
      const context: AutonomyReasonerContext = {
        implementationId: state.id,
        courseId: course.id,
        courseTitle: course.title,
        courseVersion: state.courseVersion,
        stalledMission: stalledMission
          ? {
              id: stalledMission.id,
              title: stalledMission.title,
              description: stalledMission.description,
              nodeType: stalledMission.nodeType,
              progressState: currentProgress[stalledMission.id] || 'unknown',
            }
          : undefined,
        availableMissions: availableMissions.map((m) => ({
          id: m.id,
          title: m.title,
          description: m.description,
        })),
        completedMissionIds: state.completedMissionIds,
        learnerSetup: state.learnerSetup
          ? {
              goal: state.learnerSetup.goal,
              availableTime: state.learnerSetup.availableTime,
              helpPreference: state.learnerSetup.helpPreference,
            }
          : undefined,
        verifiedArtifacts: state.artifacts,
        consequentialMemory: state.consequentialMemory,
      }

      // Call reasoner
      const reasonerDecision = validateAutonomyDecision(await this.reasoner.reason(context))

      let finalDecision: AutonomyDecisionType = reasonerDecision.decision
      let policyReason = reasonerDecision.rationale
      const confidence = reasonerDecision.confidence

      // Fail-closed policy: Low confidence (< 0.70)
      if (confidence < 0.7) {
        finalDecision = 'ESCALATE'
        policyReason = `low_confidence_fallback (confidence=${confidence})`
      }

      // Fail-closed policy: Illegal target mission
      const resolvedTargetMissionId = reasonerDecision.targetMissionId || stalledMission?.id
      if (finalDecision === 'INTERVENE') {
        const isTargetAllowed = Boolean(
          resolvedTargetMissionId && availableMissions.some((m) => m.id === resolvedTargetMissionId),
        )
        if (!isTargetAllowed) {
          finalDecision = 'ESCALATE'
          policyReason = `illegal_target_mission '${resolvedTargetMissionId || 'missing'}' is not in allowed available set`
        }
      }

      const now = new Date().toISOString()
      let status: AutonomyAuditRecord['status'] = 'EXECUTED'
      let guidance: AutonomyAuditRecord['guidance']
      let escalation: AutonomyAuditRecord['escalation']

      if (finalDecision === 'INTERVENE') {
        status = 'EXECUTED'
        guidance = {
          message: reasonerDecision.guidanceMessage || reasonerDecision.rationale,
          targetMissionId: resolvedTargetMissionId,
        }
      } else if (finalDecision === 'ESCALATE') {
        status = 'ESCALATED'
        escalation = {
          reason: reasonerDecision.escalationReason || policyReason,
        }
      } else {
        status = 'NO_OP'
      }

      const auditRecord: AutonomyAuditRecord = {
        id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        eventId,
        implementationId,
        userId: state.userId,
        courseId: state.courseId,
        courseVersion: state.courseVersion,
        eventType: event.eventType,
        idempotencyKey,
        correlationId: event.correlationId,
        observedStateUpdatedAt: event.observedStateUpdatedAt,
        sourceEvent: event.eventType,
        stateSnapshot: snapshotState(state),
        decision: finalDecision,
        status,
        policyReason,
        confidence,
        guidance,
        escalation,
        modelCallMade: true,
        actionType: finalDecision === 'INTERVENE' ? 'GUIDANCE' : finalDecision === 'ESCALATE' ? 'HUMAN_REVIEW' : 'NO_OP',
        executedAt: now,
        createdAt: now,
      }

      return this.persistAudit(auditRecord)
    })
  }

  private persistAudit(record: AutonomyAuditRecord): Promise<AutonomyAuditRecord> {
    return this.auditRepo.createIfAbsent(record)
  }
}

function snapshotState(state: ImplementationState): AutonomyAuditRecord['stateSnapshot'] {
  return {
    updatedAt: state.updatedAt,
    activeMissionId: state.activeMissionId,
    completedMissionIds: [...state.completedMissionIds],
    consequentialMemory: state.consequentialMemory?.slice(-10),
  }
}
