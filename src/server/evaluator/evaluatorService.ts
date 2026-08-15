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
   * Evaluates learner text evidence against the mission rubric.
   *
   * Flow:
   * 1. Validates mission and rubric existence.
   * 2. Calls probabilistic interpreter (Google Gen AI SDK / mock).
   * 3. Performs strict runtime schema validation (validateEvidenceEvaluation).
   * 4. Evaluates deterministic policy (applyEvaluationPolicy).
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

    if (!mission.rubric) {
      throw new Error(`Mission '${missionId}' has no structured rubric configured for evaluation`)
    }

    // Call probabilistic interpreter
    const rawEvaluation = await this.interpreter.interpret({
      mission,
      evidence,
      consumedArtifacts: dto.consumedArtifacts,
    })

    // Runtime Schema Validation Gatekeeper
    const validatedEvaluation = validateEvidenceEvaluation(rawEvaluation, mission.rubric)

    // Apply existing deterministic policy gatekeeper
    const policyVerdict = applyEvaluationPolicy(validatedEvaluation, mission.rubric)

    return {
      evaluation: validatedEvaluation,
      policyVerdict,
    }
  }
}
