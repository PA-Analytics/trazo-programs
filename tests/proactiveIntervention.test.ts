import * as assert from 'node:assert/strict'
import test from 'node:test'
import { course } from '../src/data/course.ts'
import type { EvaluationProvenanceRecord, Mission } from '../src/domain/course.ts'
import { computeMethodologyCanonicalHash } from '../src/domain/methodology.ts'
import { adaptCourseToMethodologyGraph } from '../src/domain/methodologyAdapter.ts'
import { deriveMissionProgress } from '../src/domain/progression.ts'
import { detectFrictionRecovery } from '../src/domain/learner.ts'

function mockProvenance(
  records: Array<{
    missionId: string
    verdict: 'PASS' | 'REWORK' | 'CLARIFY' | 'HUMAN_REVIEW'
    timestamp?: string
    evaluationId?: string
    failingCriterionId?: string
    failingRationale?: string
  }>,
): EvaluationProvenanceRecord[] {
  return records.map((r, i) => ({
    id: `prov-${i + 1}`,
    evaluationId: r.evaluationId || `eval-${i + 1}`,
    implementationId: 'impl-test',
    courseId: 'primer-sistema-de-contenido',
    missionId: r.missionId,
    criteriaSetId: 'crit-set-1',
    criteriaVersion: '1.0.0',
    policyVerdict: r.verdict,
    evidenceHash: `hash-${i + 1}`,
    timestamp: r.timestamp || new Date(Date.now() + i * 1000).toISOString(),
    criterionResults: r.failingCriterionId
      ? [
          {
            criterionId: r.failingCriterionId,
            status: 'NOT_MET' as const,
            rationale: r.failingRationale || 'No cumple con el estándar requerido.',
          },
        ]
      : [],
  }))
}

test('1. one REWORK -> no intervention', () => {
  const mission = course.chapters[0].missions[0] // N01
  const provenance = mockProvenance([
    { missionId: 'N01', verdict: 'REWORK', failingCriterionId: 'c2_target_audience' },
  ])

  const recovery = detectFrictionRecovery(provenance, mission, [])
  assert.equal(recovery, null)
})

test('2. two consecutive REWORKs on same mission -> intervention', () => {
  const mission = course.chapters[0].missions[0] // N01
  const provenance = mockProvenance([
    { missionId: 'N01', verdict: 'REWORK', failingCriterionId: 'c2_target_audience', failingRationale: 'Falta público' },
    { missionId: 'N01', verdict: 'REWORK', failingCriterionId: 'c2_target_audience', failingRationale: 'Sigue faltando público' },
  ])

  const recovery = detectFrictionRecovery(provenance, mission, [])
  assert.ok(recovery)
  assert.equal(recovery.missionId, 'N01')
  assert.equal(recovery.reworkCount, 2)
  assert.equal(recovery.targetCriterion?.id, 'c2_target_audience')
  assert.equal(recovery.targetCriterion?.label, 'Audiencia Reconocible')
  assert.equal(recovery.targetCriterion?.lastRationale, 'Sigue faltando público')
  assert.ok(recovery.interventionId.includes('N01'))
})

test('3. failures across different missions -> no false intervention', () => {
  const missionN01 = course.chapters[0].missions[0] // N01
  const missionN02 = course.chapters[0].missions[1] // N02
  const provenance = mockProvenance([
    { missionId: 'N01', verdict: 'REWORK' },
    { missionId: 'N02', verdict: 'REWORK' },
  ])

  // Only 1 rework on N01, 1 rework on N02 -> neither should trigger intervention
  const recoveryN01 = detectFrictionRecovery(provenance, missionN01, [])
  const recoveryN02 = detectFrictionRecovery(provenance, missionN02, [])

  assert.equal(recoveryN01, null)
  assert.equal(recoveryN02, null)
})

test('4. REWORK -> PASS -> no stale intervention', () => {
  const mission = course.chapters[0].missions[0] // N01
  const provenance = mockProvenance([
    { missionId: 'N01', verdict: 'REWORK', timestamp: '2026-08-29T10:00:00Z' },
    { missionId: 'N01', verdict: 'REWORK', timestamp: '2026-08-29T10:01:00Z' },
    { missionId: 'N01', verdict: 'PASS', timestamp: '2026-08-29T10:02:00Z' },
  ])

  const recovery = detectFrictionRecovery(provenance, mission, [])
  assert.equal(recovery, null)
})

test('5. completed mission -> no intervention', () => {
  const mission = course.chapters[0].missions[0] // N01
  const provenance = mockProvenance([
    { missionId: 'N01', verdict: 'REWORK' },
    { missionId: 'N01', verdict: 'REWORK' },
  ])

  // Completed set includes N01
  const recovery = detectFrictionRecovery(provenance, mission, ['N01'])
  assert.equal(recovery, null)
})

test('6. malformed / missing provenance -> fail closed', () => {
  const mission = course.chapters[0].missions[0]
  assert.equal(detectFrictionRecovery(undefined, mission, []), null)
  assert.equal(detectFrictionRecovery([], mission, []), null)
})

test('7. repeated failing criterion detection is deterministic', () => {
  const mission = course.chapters[0].missions[0] // N01
  const provenance = mockProvenance([
    {
      missionId: 'N01',
      verdict: 'REWORK',
      failingCriterionId: 'c1_concrete_idea',
      failingRationale: 'Falta claridad en la idea central',
    },
    {
      missionId: 'N01',
      verdict: 'REWORK',
      failingCriterionId: 'c1_concrete_idea',
      failingRationale: 'Idea sigue ambigua',
    },
  ])

  const recovery = detectFrictionRecovery(provenance, mission, [])
  assert.ok(recovery)
  assert.equal(recovery.targetCriterion?.id, 'c1_concrete_idea')
  assert.equal(recovery.targetCriterion?.label, 'Idea Concreta')
  assert.equal(recovery.targetCriterion?.lastRationale, 'Idea sigue ambigua')
})

test('8. criterion guidance resolves strictly from canonical rubric data', () => {
  const missionN02 = course.chapters[0].missions[1] // N02 Estructura Directa
  const provenance = mockProvenance([
    { missionId: 'N02', verdict: 'REWORK', failingCriterionId: 'c1_three_part_order' },
    { missionId: 'N02', verdict: 'REWORK', failingCriterionId: 'c1_three_part_order' },
  ])

  const recovery = detectFrictionRecovery(provenance, missionN02, [])
  assert.ok(recovery)
  assert.equal(recovery.targetCriterion?.id, 'c1_three_part_order')
  assert.equal(recovery.targetCriterion?.label, 'Apertura, Desarrollo y Cierre')
  assert.ok(recovery.targetCriterion?.description.includes('tres momentos claros'))
})

test('9. Invariant: Progression, DAG, and methodology hashes remain completely unmutated', () => {
  const graph = adaptCourseToMethodologyGraph(course)
  const hashBefore = computeMethodologyCanonicalHash(graph)

  const mission = course.chapters[0].missions[0]
  const provenance = mockProvenance([
    { missionId: 'N01', verdict: 'REWORK' },
    { missionId: 'N01', verdict: 'REWORK' },
  ])

  // Calling friction recovery
  const recovery = detectFrictionRecovery(provenance, mission, [])
  assert.ok(recovery)

  // Progression is 100% untouched
  const progress = deriveMissionProgress(course.chapters[0].missions, new Set([]))
  assert.equal(progress.N01, 'available')
  assert.equal(progress.N02, 'locked')
  assert.equal(progress.N03, 'locked')

  const hashAfter = computeMethodologyCanonicalHash(graph)
  assert.equal(hashBefore, hashAfter)
})
