import type {
  PolicyVerdict,
  Rubric,
  StructuredEvidenceEvaluation,
} from './course'

export const DETERMINISTIC_CONFIDENCE_THRESHOLD = 0.70

/**
 * Pure deterministic policy evaluator.
 * Derives PolicyVerdict strictly from rubric criteria and criterion-level results.
 *
 * Deterministic mapping for REQUIRED criteria:
 * - Empty rubric or empty evaluation -> HUMAN_REVIEW (fail-closed)
 * - Missing required criterion -> HUMAN_REVIEW
 * - Any required criterion NOT_MET -> REWORK
 * - Any required criterion UNVERIFIABLE (and none NOT_MET) -> CLARIFY
 * - Internal contradiction (recommendation non-PASS or conflict) -> fails closed to non-PASS
 * - Confidence below deterministic threshold (< 0.70) -> HUMAN_REVIEW (cannot PASS)
 * - All required criteria PASS + valid confidence -> PASS
 *
 * Optional criteria (isRequired: false) that are NOT_MET or UNVERIFIABLE do NOT block PASS.
 */
export function applyEvaluationPolicy(
  evaluation: StructuredEvidenceEvaluation,
  rubric: Rubric,
  confidenceThreshold: number = DETERMINISTIC_CONFIDENCE_THRESHOLD,
): PolicyVerdict {
  if (
    !rubric.criteria ||
    rubric.criteria.length === 0 ||
    !evaluation.criteria ||
    evaluation.criteria.length === 0
  ) {
    return 'HUMAN_REVIEW'
  }

  const criteriaResultMap = new Map(
    evaluation.criteria.map((item) => [item.criterionId, item]),
  )

  let requiredCriteriaCount = 0
  let hasMissingRequired = false
  let hasNotMetRequired = false
  let hasUnverifiableRequired = false

  for (const criterion of rubric.criteria) {
    if (!criterion.isRequired) continue
    requiredCriteriaCount++

    const result = criteriaResultMap.get(criterion.id)
    if (!result) {
      hasMissingRequired = true
      continue
    }

    if (result.status === 'NOT_MET') {
      hasNotMetRequired = true
    } else if (result.status === 'UNVERIFIABLE') {
      hasUnverifiableRequired = true
    } else if (result.status !== 'PASS') {
      hasNotMetRequired = true
    }
  }

  // If rubric has no required criteria, it is misconfigured; fail closed to HUMAN_REVIEW
  if (requiredCriteriaCount === 0) {
    return 'HUMAN_REVIEW'
  }

  if (hasMissingRequired) {
    return 'HUMAN_REVIEW'
  }

  if (hasNotMetRequired) {
    return 'REWORK'
  }

  if (hasUnverifiableRequired) {
    return 'CLARIFY'
  }

  // Low confidence below deterministic threshold must not PASS
  if (
    typeof evaluation.confidence === 'number' &&
    evaluation.confidence < confidenceThreshold
  ) {
    return 'HUMAN_REVIEW'
  }

  // Internal contradiction guards: non-PASS recommendation prevents premature PASS
  if (evaluation.recommendation === 'HUMAN_REVIEW') {
    return 'HUMAN_REVIEW'
  }
  if (evaluation.recommendation === 'REWORK') {
    return 'REWORK'
  }
  if (evaluation.recommendation === 'CLARIFY') {
    return 'CLARIFY'
  }

  return 'PASS'
}
