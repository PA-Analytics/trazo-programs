import type {
  Mission,
  PolicyVerdict,
  StructuredEvidenceEvaluation,
} from '../../domain/course.ts'

export interface EvaluateEvidenceDTO {
  missionId: string
  evidence: string
}

export interface EvaluationResultDTO {
  evaluation: StructuredEvidenceEvaluation
  policyVerdict: PolicyVerdict
}

export interface IEvidenceInterpreter {
  interpret(params: {
    mission: Mission
    evidence: string
  }): Promise<StructuredEvidenceEvaluation>
}
