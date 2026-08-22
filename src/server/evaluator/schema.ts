import type {
  CriterionResult,
  CriterionVerdict,
  MissionInteractionType,
  Rubric,
  StructuredEvidenceEvaluation,
} from '../../domain/course.ts'

export class EvaluationValidationError extends Error {
  constructor(message: string) {
    super(`EvaluationValidationError: ${message}`)
    this.name = 'EvaluationValidationError'
  }
}

const ALLOWED_STATUSES: ReadonlySet<string> = new Set<CriterionVerdict>([
  'PASS',
  'NOT_MET',
  'UNVERIFIABLE',
])

const ALLOWED_RECOMMENDATIONS: ReadonlySet<string> = new Set([
  'PASS',
  'REWORK',
  'CLARIFY',
  'HUMAN_REVIEW',
])

const ALLOWED_INTERACTION_TYPES: ReadonlySet<string> = new Set<MissionInteractionType>([
  'CONVERSATION',
  'EVIDENCE_SUBMISSION',
  'AMBIGUOUS',
])

/**
 * Validates untrusted LLM output at runtime against the mission rubric and interaction contract.
 * Throws EvaluationValidationError if the response is malformed, ensuring
 * invalid model output can never accidentally produce a PASS verdict or mutate state.
 */
export function validateEvidenceEvaluation(
  raw: unknown,
  rubric?: Rubric,
): StructuredEvidenceEvaluation {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new EvaluationValidationError('LLM output must be a non-null object')
  }

  const candidate = raw as Record<string, unknown>

  // 1. Validate / default interactionType
  let interactionType: MissionInteractionType = 'EVIDENCE_SUBMISSION'
  if (candidate.interactionType !== undefined) {
    if (
      typeof candidate.interactionType !== 'string' ||
      !ALLOWED_INTERACTION_TYPES.has(candidate.interactionType as MissionInteractionType)
    ) {
      throw new EvaluationValidationError(
        `interactionType '${candidate.interactionType}' is invalid (allowed: CONVERSATION, EVIDENCE_SUBMISSION, AMBIGUOUS)`,
      )
    }
    interactionType = candidate.interactionType as MissionInteractionType
  }

  // 2. Validate message / coachingFeedback
  const messageCandidate =
    typeof candidate.message === 'string' && candidate.message.trim()
      ? candidate.message.trim()
      : typeof candidate.coachingFeedback === 'string' && candidate.coachingFeedback.trim()
        ? candidate.coachingFeedback.trim()
        : ''

  if (!messageCandidate) {
    throw new EvaluationValidationError('message or coachingFeedback must be a non-empty string')
  }

  // 3. For CONVERSATION and AMBIGUOUS, criteria array is not required
  if (interactionType === 'CONVERSATION' || interactionType === 'AMBIGUOUS') {
    return {
      interactionType,
      message: messageCandidate,
      coachingFeedback: messageCandidate,
      criteria: [],
    }
  }

  // 4. For EVIDENCE_SUBMISSION, criteria array is strictly required and validated
  if (!Array.isArray(candidate.criteria) || candidate.criteria.length === 0) {
    throw new EvaluationValidationError('criteria must be a non-empty array for EVIDENCE_SUBMISSION')
  }

  if (!rubric) {
    throw new EvaluationValidationError('a structured rubric is required for EVIDENCE_SUBMISSION')
  }

  const validCriterionIds = new Set(rubric.criteria.map((c) => c.id))
  const seenCriterionIds = new Set<string>()
  const validatedCriteria: CriterionResult[] = []

  for (let i = 0; i < candidate.criteria.length; i++) {
    const item = candidate.criteria[i]
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new EvaluationValidationError(`criteria[${i}] must be an object`)
    }

    const cItem = item as Record<string, unknown>

    if (typeof cItem.criterionId !== 'string' || !cItem.criterionId.trim()) {
      throw new EvaluationValidationError(`criteria[${i}].criterionId must be a non-empty string`)
    }

    if (!validCriterionIds.has(cItem.criterionId)) {
      throw new EvaluationValidationError(
        `criteria[${i}].criterionId '${cItem.criterionId}' does not exist in rubric '${rubric.id}'`,
      )
    }

    if (seenCriterionIds.has(cItem.criterionId)) {
      throw new EvaluationValidationError(
        `Duplicate criterionId '${cItem.criterionId}' in criteria array`,
      )
    }
    seenCriterionIds.add(cItem.criterionId)

    if (typeof cItem.status !== 'string' || !ALLOWED_STATUSES.has(cItem.status)) {
      throw new EvaluationValidationError(
        `criteria[${i}].status '${cItem.status}' is not valid (allowed: PASS, NOT_MET, UNVERIFIABLE)`,
      )
    }

    if (typeof cItem.rationale !== 'string' || !cItem.rationale.trim()) {
      throw new EvaluationValidationError(`criteria[${i}].rationale must be a non-empty string`)
    }

    validatedCriteria.push({
      criterionId: cItem.criterionId,
      status: cItem.status as CriterionVerdict,
      rationale: cItem.rationale.trim(),
    })
  }

  // 5. Optional metadata validation
  let validatedConfidence: number | undefined
  if (candidate.confidence !== undefined) {
    if (typeof candidate.confidence !== 'number' || candidate.confidence < 0 || candidate.confidence > 1) {
      throw new EvaluationValidationError('confidence must be a number between 0 and 1')
    }
    validatedConfidence = candidate.confidence
  }

  let validatedRecommendation: StructuredEvidenceEvaluation['recommendation']
  if (candidate.recommendation !== undefined) {
    if (typeof candidate.recommendation !== 'string' || !ALLOWED_RECOMMENDATIONS.has(candidate.recommendation)) {
      throw new EvaluationValidationError(
        `recommendation '${candidate.recommendation}' is invalid (allowed: PASS, REWORK, CLARIFY, HUMAN_REVIEW)`,
      )
    }
    validatedRecommendation = candidate.recommendation as StructuredEvidenceEvaluation['recommendation']
  }

  return {
    interactionType: 'EVIDENCE_SUBMISSION',
    message: messageCandidate,
    coachingFeedback: messageCandidate,
    criteria: validatedCriteria,
    confidence: validatedConfidence,
    recommendation: validatedRecommendation,
  }
}
