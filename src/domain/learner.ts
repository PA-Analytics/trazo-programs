import type {
  CalibrationVerdict,
  EvaluationProvenanceRecord,
  HelpPreference,
  Mission,
  PolicyVerdict,
} from './course'

export interface TargetCriterionRecovery {
  id: string
  label: string
  description: string
  lastRationale?: string
}

export interface ProactiveFrictionRecovery {
  missionId: string
  reworkCount: number
  targetCriterion?: TargetCriterionRecovery
  interventionId: string
}

export function adaptCompanionGuidance(
  message: string,
  preference: HelpPreference | undefined,
  mission: Mission,
  verdict: PolicyVerdict,
): string {
  if (!preference || preference === 'ADAPTIVE' || verdict === 'PASS') return message

  const focus = mission.title.toLocaleLowerCase('es-MX')
  if (preference === 'QUESTIONS') {
    return `${message} ¿Qué parte de ${focus} todavía no se puede comprobar con lo que escribiste?`
  }

  if (preference === 'EXAMPLE') {
    return `${message} Por ejemplo, vuelve a escribirlo con un caso concreto de ${focus}.`
  }

  return message
}

export function calibrationVerdictLabel(verdict: CalibrationVerdict): string {
  return verdict === 'PASS' ? 'PASS' : verdict === 'REWORK' ? 'REWORK' : 'CLARIFY'
}

/**
 * Deterministically detects repeated submission friction on an active mission.
 *
 * Rules:
 * 1. Counts attempts strictly for the given mission.
 * 2. Requires the last two chronological attempts on that mission to BOTH be REWORK.
 * 3. Returns null if the mission is already completed.
 * 4. Returns null if fewer than two evaluations exist or the most recent attempt is not REWORK.
 * 5. Identifies persistent failing criteria matching canonical rubric order.
 * 6. Generates a stable interventionId for session-local dismiss semantics.
 */
export function detectFrictionRecovery(
  provenance: EvaluationProvenanceRecord[] | undefined,
  mission: Mission,
  completedMissionIds: string[] | Set<string>,
): ProactiveFrictionRecovery | null {
  if (!provenance || provenance.length === 0) return null

  const isCompleted =
    completedMissionIds instanceof Set
      ? completedMissionIds.has(mission.id)
      : completedMissionIds.includes(mission.id)
  if (isCompleted) return null

  // Filter evaluation records strictly for this mission
  const missionRecords = provenance.filter((r) => r.missionId === mission.id)
  if (missionRecords.length < 2) return null

  // Sort chronologically by timestamp (stable asc)
  const sorted = [...missionRecords].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  )

  const lastTwo = sorted.slice(-2)
  const [prevAttempt, lastAttempt] = lastTwo

  // Both recent attempts must be REWORK
  if (prevAttempt.policyVerdict !== 'REWORK' || lastAttempt.policyVerdict !== 'REWORK') {
    return null
  }

  // Count total consecutive REWORKs from the end
  let consecutiveReworks = 0
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].policyVerdict === 'REWORK') {
      consecutiveReworks++
    } else {
      break
    }
  }

  // Find failing criteria (NOT_MET) in previous and last attempts
  const prevFailedIds = new Set(
    (prevAttempt.criterionResults || [])
      .filter((c) => c.status === 'NOT_MET')
      .map((c) => c.criterionId),
  )
  const lastFailedResults = (lastAttempt.criterionResults || []).filter(
    (c) => c.status === 'NOT_MET',
  )
  const persistentFailingResults = lastFailedResults.filter((c) =>
    prevFailedIds.has(c.criterionId),
  )

  const rubricCriteria = mission.rubric?.criteria ?? []
  let targetCriterion: TargetCriterionRecovery | undefined

  if (persistentFailingResults.length > 0) {
    const persistentIds = new Set(persistentFailingResults.map((r) => r.criterionId))
    const matchingRubricCrit = rubricCriteria.find((c) => persistentIds.has(c.id))
    if (matchingRubricCrit) {
      const lastResult = persistentFailingResults.find(
        (r) => r.criterionId === matchingRubricCrit.id,
      )
      targetCriterion = {
        id: matchingRubricCrit.id,
        label: matchingRubricCrit.label,
        description: matchingRubricCrit.description,
        lastRationale: lastResult?.rationale,
      }
    }
  } else if (lastFailedResults.length > 0) {
    const failingIds = new Set(lastFailedResults.map((r) => r.criterionId))
    const matchingRubricCrit = rubricCriteria.find((c) => failingIds.has(c.id))
    if (matchingRubricCrit) {
      const lastResult = lastFailedResults.find(
        (r) => r.criterionId === matchingRubricCrit.id,
      )
      targetCriterion = {
        id: matchingRubricCrit.id,
        label: matchingRubricCrit.label,
        description: matchingRubricCrit.description,
        lastRationale: lastResult?.rationale,
      }
    }
  }

  const uniqueSuffix = lastAttempt.evaluationId || lastAttempt.id || lastAttempt.timestamp
  const interventionId = `friction-${mission.id}-${uniqueSuffix}`

  return {
    missionId: mission.id,
    reworkCount: consecutiveReworks,
    targetCriterion,
    interventionId,
  }
}
