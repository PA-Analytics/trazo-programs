import type {
  ImplementationArtifact,
  Mission,
  MissionInteractionTurn,
  PolicyVerdict,
  ProgressState,
  Rubric,
  StructuredEvidenceEvaluation,
} from '../../domain/course.ts'

export interface EvaluateEvidenceDTO {
  missionId: string
  evidence: string
  consumedArtifacts?: Record<string, ImplementationArtifact>
  currentProgress?: ProgressState
  recentInteraction?: MissionInteractionTurn[]
  learnerHelpPreference?: 'DIRECT' | 'QUESTIONS' | 'EXAMPLE' | 'ADAPTIVE'
  evaluationRubric?: Rubric
}

export interface EvaluationResultDTO {
  evaluation: StructuredEvidenceEvaluation
  policyVerdict: PolicyVerdict
}

export interface IEvidenceInterpreter {
  interpret(params: {
    mission: Mission
    evidence: string
    consumedArtifacts?: Record<string, ImplementationArtifact>
    currentProgress?: ProgressState
    recentInteraction?: MissionInteractionTurn[]
    learnerHelpPreference?: 'DIRECT' | 'QUESTIONS' | 'EXAMPLE' | 'ADAPTIVE'
    rubric?: Rubric
  }): Promise<StructuredEvidenceEvaluation>
}
