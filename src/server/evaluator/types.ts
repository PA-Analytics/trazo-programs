import type {
  ImplementationArtifact,
  Mission,
  PolicyVerdict,
  StructuredEvidenceEvaluation,
} from '../../domain/course.ts'

export interface EvaluateEvidenceDTO {
  missionId: string
  evidence: string
  consumedArtifacts?: Record<string, ImplementationArtifact>
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
  }): Promise<StructuredEvidenceEvaluation>
}
