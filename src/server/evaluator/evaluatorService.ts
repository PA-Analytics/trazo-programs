import { applyEvaluationPolicy } from '../../domain/evaluationPolicy.ts'
import { resolvePack } from '../../data/packs/index.ts'
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
   * 1. Resolves the methodology pack from the request courseId (explicit preview default only).
   * 2. Validates mission and rubric existence within that pack.
   * 3. Calls probabilistic interpreter (Google Gen AI SDK / mock).
   * 4. Performs strict runtime schema validation (validateEvidenceEvaluation).
   * 5. If interactionType === 'EVIDENCE_SUBMISSION': Evaluates deterministic policy (applyEvaluationPolicy).
   *    If interactionType === 'CONVERSATION' or 'AMBIGUOUS': Returns safe non-PASS verdict ('CLARIFY').
   * 6. Pure interpretation and policy derivation only:
   *    - ZERO state mutation.
   *    - ZERO database updates.
   *    - ZERO mission completions.
   */
  async evaluateEvidence(dto: EvaluateEvidenceDTO): Promise<EvaluationResultDTO> {
    const missionId = dto.missionId?.trim()
    if (!missionId) {
      throw new Error('missionId is required')
    }

    // Explicit preview-only boundary: the standalone evaluation preview endpoint has no
    // persisted implementation state, so it resolves the documented default pack when
    // no courseId is supplied. Product submission paths always pass the state's courseId.
    const course = resolvePack(dto.courseId ?? undefined)

    const evidence = dto.evidence !== undefined ? String(dto.evidence) : ''

    // Find mission in the resolved methodology
    const mission = course.chapters
      .flatMap((chapter) => chapter.missions)
      .find((m) => m.id === missionId)

    if (!mission) {
      throw new Error(`Mission '${missionId}' not found in course '${course.id}'`)
    }

    // Foreign rubric cross-mission guard: reject caller-injected foreign rubrics
    if (dto.evaluationRubric) {
      if (dto.evaluationRubric.missionId && dto.evaluationRubric.missionId !== missionId) {
        throw new Error(
          `Foreign evaluationRubric with missionId '${dto.evaluationRubric.missionId}' cannot be applied to mission '${missionId}'`,
        )
      }
      if (dto.evaluationRubric.courseId && dto.evaluationRubric.courseId !== course.id) {
        throw new Error(
          `Foreign evaluationRubric with courseId '${dto.evaluationRubric.courseId}' cannot be applied to course '${course.id}'`,
        )
      }
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
