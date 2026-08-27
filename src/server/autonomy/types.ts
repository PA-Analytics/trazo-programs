import type { ConsequentialLearnerMemory } from '../../domain/course.ts'

export type AutonomyDecisionType = 'INTERVENE' | 'ESCALATE' | 'NO_OP'

export interface LearnerStalledEventDTO {
  eventId: string
  eventType: 'learner_stalled'
  implementationId: string
  userId?: string
  courseId: string
  courseVersion?: string
  observedStateUpdatedAt?: string
  idempotencyKey?: string
  correlationId?: string
  stalledMissionId?: string
  stallDurationMs?: number
  context?: Record<string, unknown>
}

export interface AutonomyReasonerDecision {
  decision: AutonomyDecisionType
  rationale: string
  confidence: number
  guidanceMessage?: string
  escalationReason?: string
  targetMissionId?: string
}

export interface AutonomyAuditRecord {
  id: string
  eventId: string
  implementationId: string
  userId?: string
  courseId: string
  courseVersion?: string
  eventType: string
  idempotencyKey?: string
  correlationId?: string
  observedStateUpdatedAt?: string
  sourceEvent?: string
  stateSnapshot?: {
    updatedAt: string
    activeMissionId?: string
    completedMissionIds: string[]
    consequentialMemory?: ConsequentialLearnerMemory[]
  }
  decision: AutonomyDecisionType
  status: 'EXECUTED' | 'NO_OP' | 'ESCALATED' | 'FAILED_CLOSED'
  policyReason: string
  confidence?: number
  guidance?: {
    message: string
    targetMissionId?: string
  }
  escalation?: {
    reason: string
  }
  actionType: 'GUIDANCE' | 'HUMAN_REVIEW' | 'NO_OP'
  modelCallMade: boolean
  executedAt: string
  createdAt: string
}

export interface IAutonomyAuditRepository {
  getById(id: string): Promise<AutonomyAuditRecord | null>
  getByEventId(eventId: string): Promise<AutonomyAuditRecord | null>
  getByIdempotencyKey(idempotencyKey: string): Promise<AutonomyAuditRecord | null>
  save(record: AutonomyAuditRecord): Promise<void>
  createIfAbsent(record: AutonomyAuditRecord): Promise<AutonomyAuditRecord>
  list(implementationId?: string): Promise<AutonomyAuditRecord[]>
}

export interface AutonomyReasonerContext {
  implementationId: string
  courseId: string
  courseTitle: string
  courseVersion?: string
  stalledMission?: {
    id: string
    title: string
    description: string
    nodeType: string
    progressState: string
  }
  availableMissions: Array<{
    id: string
    title: string
    description: string
  }>
  completedMissionIds: string[]
  learnerSetup?: {
    goal: string
    availableTime: string
    helpPreference: string
  }
  verifiedArtifacts?: Record<string, unknown>
  consequentialMemory?: ConsequentialLearnerMemory[]
}

export interface IAutonomyReasoner {
  reason(context: AutonomyReasonerContext): Promise<AutonomyReasonerDecision>
}

export interface IClock {
  now(): Date
}

export interface IStallDetector {
  detectStalls(): Promise<LearnerStalledEventDTO[]>
}

export interface AutonomyScanResult {
  scannedCount: number
  qualifiedCount: number
  processedCount: number
  audits: AutonomyAuditRecord[]
  errors: Array<{ implementationId: string; eventId: string; error: string }>
}

export type DeterministicReasonerMode =
  | 'INTERVENE'
  | 'ESCALATE'
  | 'LOW_CONFIDENCE'
  | 'NO_OP'
  | 'MALFORMED'
  | 'PROVIDER_FAILURE'
  | 'TIMEOUT'
  | 'CUSTOM'

