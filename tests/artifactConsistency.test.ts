import test from 'node:test'
import assert from 'node:assert/strict'
import type { Rubric, StructuredEvidenceEvaluation } from '../src/domain/course.ts'
import type { IEvidenceInterpreter } from '../src/server/evaluator/types.ts'
import { EvidenceEvaluatorService } from '../src/server/evaluator/evaluatorService.ts'
import { MemoryImplementationRepository } from '../src/server/repository.ts'
import { ImplementationService } from '../src/server/service.ts'

const COURSE_ID = 'primer-sistema-de-contenido'

type InterpretParams = Parameters<IEvidenceInterpreter['interpret']>[0]

function evaluationWithStatus(status: 'PASS' | 'NOT_MET', rubric?: Rubric): StructuredEvidenceEvaluation {
  return {
    interactionType: 'EVIDENCE_SUBMISSION',
    message: 'feedback',
    coachingFeedback: 'feedback',
    criteria: (rubric?.criteria ?? []).map((criterion) => ({
      criterionId: criterion.id,
      status,
      rationale: 'rationale',
    })),
  }
}

async function createImpl(service: ImplementationService, id: string) {
  await service.createImplementation({ id, courseId: COURSE_ID })
}

test('F3: legal PASS materializes every declared canonical artifact before claiming completion', async () => {
  const repository = new MemoryImplementationRepository()
  const service = new ImplementationService(repository)
  await createImpl(service, 'impl-artifact')

  const evaluator = new EvidenceEvaluatorService({
    async interpret(params: InterpretParams) {
      return evaluationWithStatus('PASS', params.rubric ?? params.mission.rubric)
    },
  })

  const result = await service.submitEvidence(
    'impl-artifact',
    { missionId: 'N01', evidence: 'premise concreta y valida' },
    evaluator,
  )

  assert.equal(result.completed, true)
  assert.equal(result.policyVerdict, 'PASS')

  const state = await repository.getById('impl-artifact')
  assert.ok(state)
  assert.equal(state.completedMissionIds.includes('N01'), true)
  const premise = state.artifacts?.premise
  assert.ok(premise, 'premise artifact must exist after legal PASS')
  assert.equal(premise.sourceMissionId, 'N01')
})

test('F3: non-PASS verdicts never complete the mission nor mint canonical artifacts', async () => {
  const repository = new MemoryImplementationRepository()
  const service = new ImplementationService(repository)
  await createImpl(service, 'impl-rework')

  const evaluator = new EvidenceEvaluatorService({
    async interpret(params: InterpretParams) {
      return evaluationWithStatus('NOT_MET', params.rubric ?? params.mission.rubric)
    },
  })

  const result = await service.submitEvidence(
    'impl-rework',
    { missionId: 'N01', evidence: 'trabajo insuficiente' },
    evaluator,
  )

  assert.equal(result.completed, false)
  assert.equal(result.policyVerdict, 'REWORK')

  const state = await repository.getById('impl-rework')
  assert.ok(state)
  assert.deepEqual(state.completedMissionIds, [])
  assert.equal(state.artifacts, undefined)
  assert.equal(state.updatedAt, (await service.getImplementation('impl-rework'))?.updatedAt)
})

test('F3: dev-complete refuses artifact-producing missions instead of minting zero-artifact completion', async () => {
  const repository = new MemoryImplementationRepository()
  const service = new ImplementationService(repository)
  await createImpl(service, 'impl-dev')

  await assert.rejects(
    service.devCompleteMission('impl-dev', { missionId: 'N01' }),
    /declares canonical artifacts \[premise\] that can only be produced by a verified submission/,
  )

  const state = await repository.getById('impl-dev')
  assert.ok(state)
  assert.deepEqual(state.completedMissionIds, [])
  assert.equal(state.artifacts, undefined)
})

test('F3: dev-complete refuses missions whose consumed artifacts are missing even when unlocked', async () => {
  const repository = new MemoryImplementationRepository()
  const service = new ImplementationService(repository)
  await createImpl(service, 'impl-poison')

  // Poisoned legacy-style state: N01 completed but its canonical artifact never existed.
  const state = await repository.getById('impl-poison')
  assert.ok(state)
  const nowIso = new Date().toISOString()
  await repository.save({
    ...state,
    completedMissionIds: ['N01'],
    artifacts: {},
    updatedAt: nowIso,
  })

  // N02 is graph-unlocked but its completion path requires premise; every completion
  // route must fail closed on the artifact inconsistency (producer or consumer rule).
  await assert.rejects(
    service.devCompleteMission('impl-poison', { missionId: 'N02' }),
    /required artifact 'premise'|declares canonical artifacts/,
  )
  await assert.rejects(
    service.submitEvidence(
      'impl-poison',
      { missionId: 'N02', evidence: 'apertura desarrollo cierre' },
      new EvidenceEvaluatorService({
        async interpret(params: InterpretParams) {
          return evaluationWithStatus('PASS', params.rubric ?? params.mission.rubric)
        },
      }),
    ),
    /required artifact 'premise'/,
  )

  const finalState = await repository.getById('impl-poison')
  assert.ok(finalState)
  assert.deepEqual(finalState.completedMissionIds, ['N01'])
})
