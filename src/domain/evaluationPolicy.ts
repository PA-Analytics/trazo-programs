import type {
  PolicyVerdict,
  Rubric,
  StructuredEvidenceEvaluation,
} from './course'

/**
 * Pure deterministic policy evaluator.
 * Derives PolicyVerdict strictly from rubric criteria and criterion-level results.
 *
 * Deterministic mapping for REQUIRED criteria:
 * - Empty rubric or empty evaluation -> HUMAN_REVIEW (fail-closed)
 * - Missing required criterion -> HUMAN_REVIEW
 * - Any required criterion NOT_MET -> REWORK
 * - Any required criterion UNVERIFIABLE (and none NOT_MET) -> CLARIFY
 * - All required criteria PASS -> PASS
 *
 * Optional criteria (isRequired: false) that are NOT_MET or UNVERIFIABLE do NOT block PASS.
 * Confidence and agent recommendations are advisory/metadata only and do not affect transitions.
 */
export function applyEvaluationPolicy(
  evaluation: StructuredEvidenceEvaluation,
  rubric: Rubric,
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

  return 'PASS'
}
