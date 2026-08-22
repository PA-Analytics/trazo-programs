import { course } from '../../data/course.ts'
import { applyEvaluationPolicy } from '../../domain/evaluationPolicy.ts'
import { validateEvidenceEvaluation } from './schema.ts'
import type {
  EvaluateEvidenceDTO,
  EvaluationResultDTO,
  IEvidenceInterpreter,
} from './types.ts'

export class EvidenceEvaluatorService {
  private interpreter: IEvidenceInterpreter

  constructor(interpreter: IEvidenceInterpreter) {
    this.interpreter = interpreter
  }

  /**
   * Evaluates learner text/message against the mission interaction contract.
   *
   * Flow:
   * 1. Validates mission and rubric existence.
   * 2. Calls probabilistic interpreter (Google Gen AI SDK / mock).
   * 3. Performs strict runtime schema validation (validateEvidenceEvaluation).
   * 4. If interactionType === 'EVIDENCE_SUBMISSION': Evaluates deterministic policy (applyEvaluationPolicy).
   *    If interactionType === 'CONVERSATION' or 'AMBIGUOUS': Returns safe non-PASS verdict ('CLARIFY').
   * 5. Pure interpretation and policy derivation only:
   *    - ZERO state mutation.
   *    - ZERO database updates.
   *    - ZERO mission completions.
   */
  async evaluateEvidence(dto: EvaluateEvidenceDTO): Promise<EvaluationResultDTO> {
    const missionId = dto.missionId?.trim()
    if (!missionId) {
      throw new Error('missionId is required')
    }

    const evidence = dto.evidence !== undefined ? String(dto.evidence) : ''

    // Find mission in course definition
    const mission = course.chapters
      .flatMap((chapter) => chapter.missions)
      .find((m) => m.id === missionId)

    if (!mission) {
      throw new Error(`Mission '${missionId}' not found in course '${course.id}'`)
    }

    // Call probabilistic interpreter
    const evaluationRubric = dto.evaluationRubric || mission.rubric
    const rawEvaluation = await this.interpreter.interpret({
      mission,
      evidence,
      consumedArtifacts: dto.consumedArtifacts,
      currentProgress: dto.currentProgress,
      recentInteraction: dto.recentInteraction,
      learnerHelpPreference: dto.learnerHelpPreference,
      rubric: evaluationRubric,
    })

    // Runtime Schema Validation Gatekeeper
    const validatedEvaluation = validateEvidenceEvaluation(rawEvaluation, evaluationRubric)

    // Deterministic Policy Gatekeeper
    const isSubmission = validatedEvaluation.interactionType === 'EVIDENCE_SUBMISSION'
    const policyVerdict = isSubmission && evaluationRubric
      ? applyEvaluationPolicy(validatedEvaluation, evaluationRubric)
      : 'CLARIFY'

    return {
      evaluation: validatedEvaluation,
      policyVerdict,
    }
  }
}
