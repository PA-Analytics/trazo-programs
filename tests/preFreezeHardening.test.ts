import test from 'node:test'
import assert from 'node:assert/strict'
import * as http from 'node:http'
import { applyEvaluationPolicy } from '../src/domain/evaluationPolicy.ts'
import { validateEvidenceEvaluation, EvaluationValidationError } from '../src/server/evaluator/schema.ts'
import { MemoryImplementationRepository } from '../src/server/repository.ts'
import { ImplementationService } from '../src/server/service.ts'
import { createRequestListener } from '../src/server/app.ts'
import { course } from '../src/data/course.ts'
import type { Rubric, StructuredEvidenceEvaluation, ImplementationState } from '../src/domain/course.ts'
import type { IEvidenceInterpreter } from '../src/server/evaluator/types.ts'
import { EvidenceEvaluatorService } from '../src/server/evaluator/evaluatorService.ts'

class MockInterpreter implements IEvidenceInterpreter {
  public responseGenerator?: (missionId: string, evidence: string) => StructuredEvidenceEvaluation

  async interpret({ mission, evidence }: Parameters<IEvidenceInterpreter['interpret']>[0]): Promise<StructuredEvidenceEvaluation> {
    if (this.responseGenerator) {
      return this.responseGenerator(mission.id, evidence)
    }
    throw new Error('No mock response generator configured')
  }
}

const n01Rubric: Rubric = course.chapters[0].missions[0].rubric!

test('HARDENING 1: applyEvaluationPolicy fails closed (HUMAN_REVIEW) on empty criteria', () => {
  const emptyEval: StructuredEvidenceEvaluation = {
    criteria: [],
    coachingFeedback: 'Nada evaluado',
  }
  const verdict = applyEvaluationPolicy(emptyEval, n01Rubric)
  assert.equal(verdict, 'HUMAN_REVIEW', 'Empty evaluation criteria must fail-closed to HUMAN_REVIEW')
})

test('HARDENING 2: validateEvidenceEvaluation rejects empty criteria array and invalid metadata', () => {
  // Empty criteria array
  assert.throws(
    () => validateEvidenceEvaluation({ criteria: [], coachingFeedback: 'Feedback' }, n01Rubric),
    EvaluationValidationError,
  )

  // Out-of-bounds confidence (> 1)
  assert.throws(
    () =>
      validateEvidenceEvaluation(
        {
          criteria: [
            { criterionId: 'c1_audience', status: 'PASS', rationale: 'ok' },
            { criterionId: 'c2_problem', status: 'PASS', rationale: 'ok' },
            { criterionId: 'c3_transformation', status: 'PASS', rationale: 'ok' },
          ],
          coachingFeedback: 'Feedback',
          confidence: 1.5,
        },
        n01Rubric,
      ),
    EvaluationValidationError,
  )

  // Invalid recommendation string
  assert.throws(
    () =>
      validateEvidenceEvaluation(
        {
          criteria: [
            { criterionId: 'c1_audience', status: 'PASS', rationale: 'ok' },
            { criterionId: 'c2_problem', status: 'PASS', rationale: 'ok' },
            { criterionId: 'c3_transformation', status: 'PASS', rationale: 'ok' },
          ],
          coachingFeedback: 'Feedback',
          recommendation: 'INVALID_ENUM',
        },
        n01Rubric,
      ),
    EvaluationValidationError,
  )
})

test('HARDENING 3: MemoryImplementationRepository deep-cloning prevents reference leakage', async () => {
  const repository = new MemoryImplementationRepository()
  const state: ImplementationState = {
    id: 'impl-clone-test',
    courseId: course.id,
    completedMissionIds: ['N01'],
    artifacts: {
      premise: {
        key: 'premise',
        sourceMissionId: 'N01',
        value: { statement: 'Original verified statement' },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  await repository.save(state)

  // Mutate local state in-place without saving
  const fetched = await repository.getById('impl-clone-test')
  assert.ok(fetched)
  fetched.completedMissionIds.push('N09') // Attempt in-place reference mutation
  if (fetched.artifacts?.premise?.value) {
    ;(fetched.artifacts.premise.value as { statement: string }).statement = 'Corrupted statement'
  }

  // Verify that repository internal state remained completely untouched
  const reloaded = await repository.getById('impl-clone-test')
  assert.ok(reloaded)
  assert.deepEqual(reloaded.completedMissionIds, ['N01'])
  assert.equal(
    (reloaded.artifacts?.premise?.value as { statement: string }).statement,
    'Original verified statement',
  )
})

test('HARDENING 4: submitEvidence rejects whitespace-only evidence', async () => {
  const repository = new MemoryImplementationRepository()
  const service = new ImplementationService(repository)
  const interpreter = new MockInterpreter()
  const evaluator = new EvidenceEvaluatorService(interpreter)

  const state: ImplementationState = {
    id: 'impl-whitespace-test',
    courseId: course.id,
    completedMissionIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  await repository.save(state)

  await assert.rejects(
    async () => {
      await service.submitEvidence(state.id, { missionId: 'N01', evidence: '    \n\t  ' }, evaluator)
    },
    {
      message: /Evidence text cannot be empty or whitespace/,
    },
  )
})

test('HARDENING 5: Canonical artifact is immutable against evidence re-submissions of completed missions', async () => {
  const repository = new MemoryImplementationRepository()
  const service = new ImplementationService(repository)
  const interpreter = new MockInterpreter()
  const evaluator = new EvidenceEvaluatorService(interpreter)

  const originalTime = new Date(Date.now() - 50000).toISOString()
  const state: ImplementationState = {
    id: 'impl-resubmit-test',
    courseId: course.id,
    completedMissionIds: ['N01'],
    artifacts: {
      premise: {
        key: 'premise',
        sourceMissionId: 'N01',
        value: { statement: 'Canonical verified premise' },
        createdAt: originalTime,
        updatedAt: originalTime,
      },
    },
    createdAt: originalTime,
    updatedAt: originalTime,
  }
  await repository.save(state)

  interpreter.responseGenerator = () => ({
    interactionType: 'EVIDENCE_SUBMISSION',
    message: 'Esta es una nueva evidencia.',
    coachingFeedback: 'Esta es una nueva evidencia.',
    criteria: [
      { criterionId: 'c1_concrete_idea', status: 'PASS', rationale: 'Idea concreta.' },
      { criterionId: 'c2_target_audience', status: 'PASS', rationale: 'Audiencia clara.' },
      { criterionId: 'c3_no_filler', status: 'PASS', rationale: 'Una frase directa.' },
    ],
  })

  // A completed mission may receive a new turn, but it must retain its canonical artifact.
  const response = await service.submitEvidence(
    state.id,
    { missionId: 'N01', evidence: 'New attempt to alter premise' },
    evaluator,
  )

  assert.equal(response.completed, true)
  assert.equal(response.policyVerdict, 'PASS')

  const reloaded = await repository.getById(state.id)
  assert.equal(
    (reloaded?.artifacts?.premise?.value as { statement: string }).statement,
    'Canonical verified premise',
  )
  assert.equal(reloaded?.updatedAt, originalTime)
})

test('HARDENING 6: createImplementation does not overwrite existing progress if ID exists', async () => {
  const repository = new MemoryImplementationRepository()
  const service = new ImplementationService(repository)

  const state: ImplementationState = {
    id: 'existing-impl',
    courseId: course.id,
    completedMissionIds: ['N01', 'N02'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  await repository.save(state)

  const result = await service.createImplementation({
    id: 'existing-impl',
    courseId: course.id,
  })

  assert.deepEqual(result.completedMissionIds, ['N01', 'N02'])
  const persisted = await repository.getById('existing-impl')
  assert.deepEqual(persisted?.completedMissionIds, ['N01', 'N02'])
})
