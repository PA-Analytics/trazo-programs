import type {
  AvailableTime,
  CalibrationCaseQuality,
  CalibrationExampleSource,
  CalibrationVerdict,
  CreatorCalibration,
  ImplementationState,
  HelpPreference,
  MissionInteractionTurn,
  MissionInteractionType,
  NextActionTurn,
  PolicyVerdict,
  StructuredEvidenceEvaluation,
} from '../domain/course.ts'
import type { UserProfile } from '../domain/identity.ts'
import type { MethodologyGraph } from '../domain/methodology.ts'

export interface IImplementationRepository {
  getById(id: string): Promise<ImplementationState | null>
  save(state: ImplementationState): Promise<void>
  list(): Promise<ImplementationState[]>
}

export interface ICalibrationRepository {
  getByMissionId(
    missionId: string,
    userId?: string,
    courseId?: string,
    coachId?: string,
    version?: string,
  ): Promise<CreatorCalibration | null>
  save(calibration: CreatorCalibration): Promise<void>
  list(coachId?: string, courseId?: string): Promise<CreatorCalibration[]>
  getHistory?(coachId: string, courseId: string, missionId: string): Promise<CreatorCalibration[]>
}

export interface IMethodologyRepository {
  getActive(coachId: string | undefined, courseId: string): Promise<MethodologyGraph | null>
  getVersion(coachId: string | undefined, courseId: string, methodologyId: string, version: string): Promise<MethodologyGraph | null>
  getById(coachId: string | undefined, courseId: string, methodologyId: string): Promise<MethodologyGraph | null>
  save(graph: MethodologyGraph): Promise<void>
  list(coachId?: string, courseId?: string): Promise<MethodologyGraph[]>
}

export interface CreateImplementationDTO {
  id?: string
  userId?: string
  coachId?: string
  courseId: string
  courseVersion?: string
  methodologyId?: string
  methodologyVersion?: string
}

export interface DevCompleteMissionDTO {
  missionId: string
}

export interface TextEvidence {
  type: 'text'
  text: string
}

export interface SubmitEvidenceDTO {
  missionId: string
  evidence: string | TextEvidence
  recentInteraction?: MissionInteractionTurn[]
  submissionId?: string
}

export interface SubmissionResponseDTO {
  interactionType: MissionInteractionType
  message: string
  evaluation?: StructuredEvidenceEvaluation
  policyVerdict: PolicyVerdict
  state: ImplementationState
  completed: boolean
}

export interface StartMissionDTO {
  missionId: string
}

export interface NextActionRequestDTO {
  clarification?: string | null
  recentDecisionTurns?: NextActionTurn[]
}

export interface LearnerSetupDTO {
  goal?: string
  availableTime?: AvailableTime
  helpPreference?: HelpPreference
  preferredRouteId?: string
}

export interface CreateCalibrationDTO {
  initialStandard: string
}

export interface AddCalibrationExampleDTO {
  source: CalibrationExampleSource
  submission: string
  caseQuality?: CalibrationCaseQuality
}

export interface JudgeCalibrationExampleDTO {
  verdict: CalibrationVerdict
  reason: string
}

export interface ConfirmCalibrationDTO {
  criteria?: string[]
  qualitySignals?: Array<{
    id?: string
    label?: string
    description: string
    isRequired?: boolean
  }>
  version?: string
}

export interface IProfileRepository {
  getById(userId: string): Promise<UserProfile | null>
  save(profile: UserProfile): Promise<void>
  list(): Promise<UserProfile[]>
}

export type {
  AutonomyAuditRecord,
  AutonomyDecisionType,
  AutonomyReasonerContext,
  AutonomyReasonerDecision,
  AutonomyScanResult,
  DeterministicReasonerMode,
  IAutonomyAuditRepository,
  IAutonomyReasoner,
  IClock,
  IStallDetector,
  LearnerStalledEventDTO,
} from './autonomy/types.ts'
