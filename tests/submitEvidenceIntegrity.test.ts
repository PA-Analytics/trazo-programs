import test from 'node:test'
import assert from 'node:assert/strict'
import type {
  Rubric,
  StructuredEvidenceEvaluation,
} from '../src/domain/course.ts'
import { MemoryImplementationRepository } from '../src/server/repository.ts'
import { ImplementationService } from '../src/server/service.ts'
import type { IImplementationRepository } from '../src/server/types.ts'
import { EvidenceEvaluatorService } from '../src/server/evaluator/evaluatorService.ts'
import type { IEvidenceInterpreter } from '../src/server/evaluator/types.ts'

type InterpretParams = Parameters<IEvidenceInterpreter['interpret']>[0]

const COURSE_ID = 'primer-sistema-de-contenido'

function allPassEvaluation(params: { missionRubric?: Rubric }): StructuredEvidenceEvaluation {
  const rubric = params.missionRubric
  const criteria = (rubric?.criteria ?? []).map((criterion) => ({
    criterionId: criterion.id,
    status: 'PASS' as const,
    rationale: 'cumple',
  }))
  return {
    interactionType: 'EVIDENCE_SUBMISSION',
    message: 'verificado',
    coachingFeedback: 'verificado',
    criteria,
  }
}

function countingPassInterpreter() {
  let calls = 0
  const interpreter: IEvidenceInterpreter = {
    async interpret(params: InterpretParams) {
      calls += 1
      return allPassEvaluation({ missionRubric: params.rubric ?? params.mission.rubric })
    },
  }
  return { interpreter, calls: () => calls }
}

/**
 * Deterministic barrier interpreter for concurrency tests.
 * - waitForEntry(n): resolves once interpretation call n+1 has started (never before).
 * - release(n): lets call n+1 finish; safe to call before the call starts.
 * No timing assumptions: every synchronization point is an explicit promise handoff.
 */
function gatedPassInterpreter() {
  let callCount = 0
  let enteredCalls = 0
  const entryWaiters: Array<() => void> = []
  const releaseWaiters = new Map<number, Array<() => void>>()
  const releasedEarly = new Set<number>()

  const interpreter: IEvidenceInterpreter = {
    interpret(params: InterpretParams) {
      const index = callCount
      callCount += 1
      enteredCalls += 1
      while (entryWaiters.length > 0) {
        entryWaiters.shift()?.()
      }
      if (releasedEarly.has(index)) {
        return Promise.resolve(allPassEvaluation({ missionRubric: params.rubric ?? params.mission.rubric }))
      }
      return new Promise((resolve) => {
        const waiters = releaseWaiters.get(index) ?? []
        waiters.push(() => resolve(allPassEvaluation({ missionRubric: params.rubric ?? params.mission.rubric })))
        releaseWaiters.set(index, waiters)
      })
    },
  }

  return {
    interpreter,
    calls: () => callCount,
    waitForEntry(index: number): Promise<void> {
      if (enteredCalls > index) return Promise.resolve()
      return new Promise<void>((resolve) => {
        entryWaiters.push(resolve)
      })
    },
    release(index: number) {
      if (callCount <= index) {
        releasedEarly.add(index)
        return
      }
      const waiters = releaseWaiters.get(index) ?? []
      releaseWaiters.delete(index)
      for (const waiter of waiters) waiter()
    },
  }
}

async function createImplWithCompletedPremise(service: ImplementationService, implementationId: string) {
  await service.createImplementation({ id: implementationId, courseId: COURSE_ID })
  const plain = new EvidenceEvaluatorService(countingPassInterpreter().interpreter)
  const result = await service.submitEvidence(
    implementationId,
    { missionId: 'N01', evidence: 'premise base valida' },
    plain,
  )
  assert.equal(result.completed, true)
}

test('F4: duplicate evidence submission of a completed mission does not invoke the evaluator again', async () => {
  const repository = new MemoryImplementationRepository()
  const service = new ImplementationService(repository)
  await service.createImplementation({ id: 'impl-f4', courseId: COURSE_ID })

  const counting = countingPassInterpreter()
  const evaluator = new EvidenceEvaluatorService(counting.interpreter)

  const first = await service.submitEvidence(
    'impl-f4',
    { missionId: 'N01', evidence: 'mi premisa inicial' },
    evaluator,
  )
  assert.equal(first.completed, true)
  assert.equal(counting.calls(), 1)

  const stateBefore = structuredClone(await repository.getById('impl-f4'))
  assert.ok(stateBefore)

  const duplicate = await service.submitEvidence(
    'impl-f4',
    { missionId: 'N01', evidence: 'intento duplicado distinto' },
    evaluator,
  )

  assert.equal(counting.calls(), 1)
  assert.equal(duplicate.completed, true)
  assert.equal(duplicate.policyVerdict, 'PASS')
  assert.equal(duplicate.evaluation, undefined)

  const stateAfter = await repository.getById('impl-f4')
  assert.deepEqual(stateAfter?.completedMissionIds, stateBefore.completedMissionIds)
  assert.deepEqual(stateAfter?.artifacts, stateBefore.artifacts)
  assert.equal(stateAfter?.updatedAt, stateBefore.updatedAt)
})

test('F1: completion written while another submission is mid-evaluation is never erased', async () => {
  const repository = new MemoryImplementationRepository()
  const service = new ImplementationService(repository)
  await createImplWithCompletedPremise(service, 'impl-race')

  const gated = gatedPassInterpreter()
  const evaluator = new EvidenceEvaluatorService(gated.interpreter)

  const submissionA = service.submitEvidence(
    'impl-race',
    { missionId: 'N03', evidence: 'esquema narrativo del alumno' },
    evaluator,
  )

  await gated.waitForEntry(0)

  const startB = service.startMission('impl-race', { missionId: 'N02' })

  gated.release(0)
  const [resultA] = await Promise.all([submissionA, startB])
  assert.equal(resultA.completed, true)

  const final = await repository.getById('impl-race')
  assert.ok(final)
  assert.equal(final.completedMissionIds.includes('N03'), true)
  assert.equal(final.completedMissionIds.includes('N01'), true)
  assert.notEqual(final.artifacts?.narrative_structure, undefined)
  assert.equal(final.activeMissionId, 'N02')
})

test('F1: same-implementation mutations are serialized: no load may interleave another load-save pair', async () => {
  const inner = new MemoryImplementationRepository()
  const events: string[] = []
  const repository: IImplementationRepository = {
    async getById(id) {
      events.push(`load:${id}`)
      return inner.getById(id)
    },
    async save(state) {
      await inner.save(state)
      events.push(`save:${state.id}`)
    },
    async list() {
      return inner.list()
    },
  }
  const service = new ImplementationService(repository)
  await createImplWithCompletedPremise(service, 'impl-order')
  events.length = 0

  const gated = gatedPassInterpreter()
  const evaluator = new EvidenceEvaluatorService(gated.interpreter)

  const submissionA = service.submitEvidence(
    'impl-order',
    { missionId: 'N03', evidence: 'esquema narrativo del alumno' },
    evaluator,
  )
  await gated.waitForEntry(0)

  const startB = service.startMission('impl-order', { missionId: 'N02' })

  gated.release(0)
  await Promise.all([submissionA, startB])

  const implEvents = events.filter((e) => e.includes('impl-order'))
  const loadCount = implEvents.filter((e) => e.startsWith('load')).length
  const saveCount = implEvents.filter((e) => e.startsWith('save')).length
  assert.equal(loadCount, saveCount)
  for (let i = 0; i < implEvents.length - 1; i++) {
    const [currentKind] = implEvents[i].split(':')
    const [nextKind] = implEvents[i + 1].split(':')
    assert.ok(
      !(currentKind === 'load' && nextKind === 'load'),
      `interleaved loads detected in mutation log: ${implEvents.join(' -> ')}`,
    )
  }
  assert.equal(implEvents[implEvents.length - 1].startsWith('save'), true)

  const final = await inner.getById('impl-order')
  assert.ok(final)
  assert.equal(final.completedMissionIds.includes('N01'), true)
  assert.equal(final.completedMissionIds.includes('N03'), true)
  assert.notEqual(final.artifacts?.narrative_structure, undefined)
})

test('F1: two concurrent submissions for different missions both persist completions and artifacts', async () => {
  const repository = new MemoryImplementationRepository()
  const service = new ImplementationService(repository)
  await createImplWithCompletedPremise(service, 'impl-race2')

  const gated = gatedPassInterpreter()
  const evaluator = new EvidenceEvaluatorService(gated.interpreter)

  const submissionA = service.submitEvidence(
    'impl-race2',
    { missionId: 'N02', evidence: 'apertura desarrollo cierre' },
    evaluator,
  )
  const submissionB = service.submitEvidence(
    'impl-race2',
    { missionId: 'N03', evidence: 'inicio giro resolucion' },
    evaluator,
  )

  await gated.waitForEntry(0)
  gated.release(0)
  const resultA = await submissionA
  assert.equal(resultA.completed, true)

  await gated.waitForEntry(1)
  gated.release(1)
  const resultB = await submissionB
  assert.equal(resultB.completed, true)

  const final = await repository.getById('impl-race2')
  assert.ok(final)
  assert.equal(final.completedMissionIds.includes('N02'), true)
  assert.equal(final.completedMissionIds.includes('N03'), true)
  assert.notEqual(final.artifacts?.premise, undefined)
  assert.notEqual(final.artifacts?.direct_structure, undefined)
  assert.notEqual(final.artifacts?.narrative_structure, undefined)
})
