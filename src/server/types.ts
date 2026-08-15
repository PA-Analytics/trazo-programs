import type {
  ImplementationState,
  PolicyVerdict,
  StructuredEvidenceEvaluation,
} from '../domain/course.ts'

export interface IImplementationRepository {
  getById(id: string): Promise<ImplementationState | null>
  save(state: ImplementationState): Promise<void>
  list(): Promise<ImplementationState[]>
}

export interface CreateImplementationDTO {
  id?: string
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
}

export interface SubmissionResponseDTO {
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
}

