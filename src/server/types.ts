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

export interface IImplementationRepository {
  getById(id: string): Promise<ImplementationState | null>
  save(state: ImplementationState): Promise<void>
  list(): Promise<ImplementationState[]>
}

export interface ICalibrationRepository {
  getByMissionId(missionId: string, userId?: string): Promise<CreatorCalibration | null>
  save(calibration: CreatorCalibration): Promise<void>
  list(): Promise<CreatorCalibration[]>
}

export interface CreateImplementationDTO {
  id?: string
  userId?: string
  courseId: string
  courseVersion?: string
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
  goal: string
  availableTime: AvailableTime
  helpPreference: HelpPreference
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
}

export interface IProfileRepository {
  getById(userId: string): Promise<UserProfile | null>
  save(profile: UserProfile): Promise<void>
  list(): Promise<UserProfile[]>
}
