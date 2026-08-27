import test from 'node:test'
import assert from 'node:assert/strict'
import { computeMethodologyCanonicalHash, type MethodologyGraph, type MethodologyNode } from '../src/domain/methodology.ts'
import { MethodologyGraphRuntime } from '../src/domain/methodologyRuntime.ts'
import { MethodologyValidationError, validateMethodologyGraph } from '../src/domain/methodologyValidation.ts'
import { MethodologyService } from '../src/server/methodologyService.ts'
import { MemoryCalibrationRepository, MemoryImplementationRepository, MemoryMethodologyRepository } from '../src/server/repository.ts'
import { ImplementationService } from '../src/server/service.ts'
import { CompanionService } from '../src/server/companion/companionService.ts'
import { StallDetector } from '../src/server/autonomy/stallDetector.ts'
import { FakeClock } from '../src/server/autonomy/clock.ts'
import type { NextActionContext } from '../src/server/companion/types.ts'

const COURSE_ID = 'methodology-test-course'

function node(id: string, isTerminal = false): MethodologyNode {
  return {
    id,
    title: id,
    nodeType: 'normal',
    position: { x: 0, y: 0 },
    description: `Descripción de ${id}`,
    evidenceType: 'text',
    evidencePrompt: `Entrega ${id}`,
    evidenceCriteria: `Cumple ${id}`,
    isTerminal,
  }
}

function graph(
  coachId: string,
  version: string,
  nodes: MethodologyNode[],
  edges: MethodologyGraph['edges'],
  entryNodeIds = ['A'],
): MethodologyGraph {
  const raw = {
    id: `method-${coachId}`,
    coachId,
    courseId: COURSE_ID,
    version,
    status: 'active' as const,
    entryNodeIds,
    nodes,
    edges,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
  return { ...raw, canonicalHash: computeMethodologyCanonicalHash(raw) }
}

test('graph validation rejects duplicate nodes, broken edges, malformed conditions, and forward cycles', () => {
  const duplicate = graph('coach-a', '1.0.0', [node('A'), node('A')], [])
  assert.throws(() => validateMethodologyGraph(duplicate), MethodologyValidationError)

  const broken = graph('coach-a', '1.0.0', [node('A')], [{ id: 'e1', source: 'A', target: 'MISSING', type: 'DEFAULT' }])
  assert.throws(() => validateMethodologyGraph(broken), /does not exist/)

  const malformed = graph('coach-a', '1.0.0', [node('A'), node('B')], [{ id: 'e1', source: 'A', target: 'B', type: 'CONDITIONAL', condition: { decision: 'SKIP' as never } }])
  assert.throws(() => validateMethodologyGraph(malformed), /invalid decision/)

  const cycle = graph('coach-a', '1.0.0', [node('A'), node('B')], [
    { id: 'e1', source: 'A', target: 'B', type: 'DEFAULT' },
    { id: 'e2', source: 'B', target: 'A', type: 'DEFAULT' },
  ])
  assert.throws(() => validateMethodologyGraph(cycle), /cycle/)
})

test('graph runtime resolves multiple prerequisites and denies an illegal skip', () => {
  const c = node('C', true)
  c.prerequisites = ['A', 'B']
  const runtime = new MethodologyGraphRuntime(graph('coach-a', '1.0.0', [node('A'), node('B'), c], [
    { id: 'a-c', source: 'A', target: 'C', type: 'DEFAULT' },
    { id: 'b-c', source: 'B', target: 'C', type: 'DEFAULT' },
  ], ['A', 'B']))

  assert.deepEqual(runtime.getLegalAvailableNodes(new Set()).map((item) => item.id), ['A', 'B'])
  assert.deepEqual(runtime.getLegalAvailableNodes(new Set(['A'])).map((item) => item.id), ['B'])
  assert.deepEqual(runtime.getLegalAvailableNodes(new Set(['A', 'B'])).map((item) => item.id), ['C'])
})

test('conditional branches and explicit remediation cycles remain bounded and inspectable', () => {
  const branch = graph('coach-a', '1.0.0', [node('A'), node('OFFER'), node('RETRY')], [
    { id: 'accept', source: 'A', target: 'OFFER', type: 'CONDITIONAL', condition: { decision: 'ACCEPT' } },
    { id: 'clarify', source: 'A', target: 'RETRY', type: 'REMEDIATION', condition: { decision: 'CLARIFY' } },
  ])
  const runtime = new MethodologyGraphRuntime(branch)
  assert.deepEqual(runtime.getLegalAvailableNodes(new Set(['A']), undefined, { A: 'PASS' }).map((item) => item.id), ['OFFER'])
  assert.deepEqual(runtime.getLegalAvailableNodes(new Set(), undefined, { A: 'CLARIFY' }).map((item) => item.id), ['A', 'RETRY'])
  assert.deepEqual(runtime.getOutgoingBranchTargets('A', 'CLARIFY').map((item) => item.targetNodeId), ['RETRY'])
})

test('methodology repository isolates coaches and pins versions', async () => {
  const repository = new MemoryMethodologyRepository()
  const aV1 = graph('coach-a', '1.0.0', [node('A'), node('B', true)], [{ id: 'a-b', source: 'A', target: 'B', type: 'DEFAULT' }])
  const aV2 = graph('coach-a', '2.0.0', [node('A'), node('D', true)], [{ id: 'a-d', source: 'A', target: 'D', type: 'DEFAULT' }])
  const bV1 = graph('coach-b', '1.0.0', [node('A'), node('P', true)], [{ id: 'a-p', source: 'A', target: 'P', type: 'DEFAULT' }])
  await repository.save(aV1)
  await repository.save(aV2)
  await repository.save(bV1)

  assert.equal((await repository.getVersion('coach-a', COURSE_ID, aV1.id, '1.0.0'))?.nodes[1].id, 'B')
  assert.equal((await repository.getActive('coach-a', COURSE_ID))?.nodes[1].id, 'D')
  assert.equal(await repository.getActive('coach-b', COURSE_ID).then((item) => item?.nodes[1].id), 'P')
  assert.equal(await repository.getActive('coach-c', COURSE_ID), null)
})

test('implementation creation snapshots the selected methodology and startMission uses graph legality', async () => {
  const methodologyRepository = new MemoryMethodologyRepository()
  const methodologyService = new MethodologyService(methodologyRepository)
  const selected = graph('coach-a', '2.0.0', [node('A'), node('D', true)], [{ id: 'a-d', source: 'A', target: 'D', type: 'DEFAULT' }])
  await methodologyService.save(selected)
  const implementationService = new ImplementationService(new MemoryImplementationRepository(), new MemoryCalibrationRepository(), methodologyService)
  const implementation = await implementationService.createImplementation({ id: 'graph-impl', coachId: 'coach-a', courseId: COURSE_ID })

  assert.equal(implementation.methodologyId, selected.id)
  assert.equal(implementation.methodologyVersion, '2.0.0')
  await assert.rejects(() => implementationService.startMission(implementation.id, { missionId: 'B' }), /not found/)
  const started = await implementationService.startMission(implementation.id, { missionId: 'A' })
  assert.equal(started.activeMissionId, 'A')
})

test('companion and stall detection use the pinned graph instead of static pack ordering', async () => {
  const methodologyRepository = new MemoryMethodologyRepository()
  const methodologyService = new MethodologyService(methodologyRepository)
  const selected = graph('coach-a', '2.0.0', [node('A'), node('D', true)], [{ id: 'a-d', source: 'A', target: 'D', type: 'DEFAULT' }])
  await methodologyService.save(selected)

  const state = {
    id: 'graph-boundary-impl',
    coachId: 'coach-a',
    courseId: COURSE_ID,
    courseVersion: selected.version,
    methodologyId: selected.id,
    methodologyVersion: selected.version,
    methodologyHash: selected.canonicalHash,
    completedMissionIds: ['A'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }

  let context: NextActionContext | undefined
  const companion = new CompanionService({
    async proposeNextAction(input) {
      context = input
      return { type: 'RECOMMEND_MISSION', missionId: 'D', rationale: 'Ruta del grafo.' }
    },
  }, methodologyService)
  await companion.proposeNextAction(state, 'elige la siguiente misión')
  assert.deepEqual(context?.availableMissions.map((mission) => mission.id), ['D'])

  const repository = new MemoryImplementationRepository()
  await repository.save(state)
  const detector = new StallDetector(repository, {
    methodologyService,
    clock: new FakeClock('2026-01-03T00:00:00.000Z'),
    thresholdMs: 24 * 60 * 60 * 1000,
  })
  const [event] = await detector.detectStalls()
  assert.equal(event.stalledMissionId, 'D')
})
