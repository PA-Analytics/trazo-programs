import * as assert from 'node:assert/strict'
import test from 'node:test'
import { course as primerSistemaDeContenido } from '../src/data/course.ts'
import { primerClienteDigital } from '../src/data/packs/primer-cliente.ts'
import { deriveCorridor, deriveMissionProgress } from '../src/domain/progression.ts'
import { computeMethodologyCanonicalHash } from '../src/domain/methodology.ts'
import { adaptCourseToMethodologyGraph } from '../src/domain/methodologyAdapter.ts'
import { ImplementationService } from '../src/server/service.ts'
import { MemoryImplementationRepository } from '../src/server/repository.ts'

test('1. deriveCorridor with preferredRouteId="N02" (Direct Route)', () => {
  const chapter = primerSistemaDeContenido.chapters[0]
  const corridor = deriveCorridor(chapter, 'N02')

  assert.equal(corridor.hasBranching, true)

  // Direct corridor includes entry, N02, convergence N05, and downstream milestones
  assert.ok(corridor.corridorMissionIds.has('N01'))
  assert.ok(corridor.corridorMissionIds.has('N02'))
  assert.ok(corridor.corridorMissionIds.has('N05'))
  assert.ok(corridor.corridorMissionIds.has('N06'))
  assert.ok(corridor.corridorMissionIds.has('N07'))
  assert.ok(corridor.corridorMissionIds.has('N08'))
  assert.ok(corridor.corridorMissionIds.has('N09'))

  // Alternative narrative branch is dimmed
  assert.ok(corridor.dimmedMissionIds.has('N03'))
  assert.ok(corridor.dimmedMissionIds.has('N04'))
  assert.ok(!corridor.corridorMissionIds.has('N03'))
  assert.ok(!corridor.corridorMissionIds.has('N04'))

  // Edges
  assert.ok(corridor.corridorEdgeIds.has('E01')) // N01 -> N02
  assert.ok(corridor.corridorEdgeIds.has('E03')) // N02 -> N05
  assert.ok(corridor.corridorEdgeIds.has('E07')) // N05 -> N06
  assert.ok(corridor.dimmedEdgeIds.has('E02')) // N01 -> N03
  assert.ok(corridor.dimmedEdgeIds.has('E04')) // N03 -> N05
  assert.ok(corridor.dimmedEdgeIds.has('E05')) // N03 -> N04
  assert.ok(corridor.dimmedEdgeIds.has('E06')) // N04 -> N05
})

test('2. deriveCorridor with preferredRouteId="N03" (Narrative Route)', () => {
  const chapter = primerSistemaDeContenido.chapters[0]
  const corridor = deriveCorridor(chapter, 'N03')

  assert.equal(corridor.hasBranching, true)

  // Narrative corridor includes entry, N03, N04, convergence N05, and downstream
  assert.ok(corridor.corridorMissionIds.has('N01'))
  assert.ok(corridor.corridorMissionIds.has('N03'))
  assert.ok(corridor.corridorMissionIds.has('N04'))
  assert.ok(corridor.corridorMissionIds.has('N05'))
  assert.ok(corridor.corridorMissionIds.has('N09'))

  // Direct branch is dimmed
  assert.ok(corridor.dimmedMissionIds.has('N02'))
  assert.ok(!corridor.corridorMissionIds.has('N02'))

  // Edges
  assert.ok(corridor.corridorEdgeIds.has('E02')) // N01 -> N03
  assert.ok(corridor.corridorEdgeIds.has('E04')) // N03 -> N05
  assert.ok(corridor.corridorEdgeIds.has('E05')) // N03 -> N04
  assert.ok(corridor.corridorEdgeIds.has('E06')) // N04 -> N05
  assert.ok(corridor.dimmedEdgeIds.has('E01')) // N01 -> N02
  assert.ok(corridor.dimmedEdgeIds.has('E03')) // N02 -> N05
})

test('3. deriveCorridor with no preference or unknown route ID falls back gracefully', () => {
  const chapter = primerSistemaDeContenido.chapters[0]
  const corridorNoPref = deriveCorridor(chapter, undefined)
  const corridorUnknown = deriveCorridor(chapter, 'UNKNOWN_ID')

  assert.equal(corridorNoPref.hasBranching, true)
  assert.equal(corridorNoPref.dimmedMissionIds.size, 0)
  assert.equal(corridorNoPref.dimmedEdgeIds.size, 0)
  assert.equal(corridorNoPref.corridorMissionIds.size, chapter.missions.length)

  assert.equal(corridorUnknown.hasBranching, true)
  assert.equal(corridorUnknown.dimmedMissionIds.size, 0)
  assert.equal(corridorUnknown.dimmedEdgeIds.size, 0)
})

test('4. deriveCorridor in linear methodology (primer-cliente-digital) has no dimmed branches', () => {
  const chapter = primerClienteDigital.chapters[0]
  const corridor = deriveCorridor(chapter, 'C01')

  assert.equal(corridor.hasBranching, false)
  assert.equal(corridor.dimmedMissionIds.size, 0)
  assert.equal(corridor.dimmedEdgeIds.size, 0)
  assert.equal(corridor.corridorMissionIds.size, chapter.missions.length)
})

test('5. ImplementationService.updateLearnerSetup persists preferredRouteId and supports legacy setup', async () => {
  const repo = new MemoryImplementationRepository()
  const service = new ImplementationService(repo)

  const impl = await service.createImplementation({
    id: 'impl-first-run-test',
    courseId: 'primer-sistema-de-contenido',
  })

  // 1. Update with preferredRouteId only
  const updated1 = await service.updateLearnerSetup(impl.id, {
    preferredRouteId: 'N02',
  })

  assert.equal(updated1.learnerSetup?.preferredRouteId, 'N02')
  assert.equal(updated1.learnerSetup?.helpPreference, undefined)
  assert.ok(updated1.learnerSetup?.updatedAt)

  // 2. Empty update throws
  await assert.rejects(
    async () => service.updateLearnerSetup(impl.id, {}),
    /at least one setup field is required/,
  )

  // 3. Invalid preference throws
  await assert.rejects(
    async () => service.updateLearnerSetup(impl.id, { helpPreference: 'INVALID' as any }),
    /helpPreference is invalid/,
  )

  // 4. Legacy full update is backward-compatible
  const updatedLegacy = await service.updateLearnerSetup(impl.id, {
    goal: 'Publicar mi primera pieza estratégica',
    availableTime: '30_60_MIN',
    helpPreference: 'DIRECT',
  })

  assert.equal(updatedLegacy.learnerSetup?.goal, 'Publicar mi primera pieza estratégica')
  assert.equal(updatedLegacy.learnerSetup?.availableTime, '30_60_MIN')
  assert.equal(updatedLegacy.learnerSetup?.helpPreference, 'DIRECT')
  assert.equal(updatedLegacy.learnerSetup?.preferredRouteId, 'N02') // Preserves prior route
})

test('6. Progression & Methodology immutability: selecting a route does not mutate the DAG or progression', () => {
  const chapter = primerSistemaDeContenido.chapters[0]

  // Canonical hash is invariant
  const graph = adaptCourseToMethodologyGraph(primerSistemaDeContenido)
  const hash1 = computeMethodologyCanonicalHash(graph)
  const hash2 = computeMethodologyCanonicalHash(graph)
  assert.equal(hash1, hash2)

  // Progression is 100% deterministic and allows legal execution of any branch regardless of preference
  const completed = new Set(['N01'])
  const progress = deriveMissionProgress(chapter.missions, completed)

  // When N01 is complete, BOTH N02 and N03 are available in progression truth
  assert.equal(progress.N01, 'completed')
  assert.equal(progress.N02, 'available')
  assert.equal(progress.N03, 'available')
  assert.equal(progress.N05, 'locked')

  // Completing N03 (even if N02 was preferred corridor) legally unlocks convergence N05
  const completedAlternative = new Set(['N01', 'N03'])
  const progressAlternative = deriveMissionProgress(chapter.missions, completedAlternative)
  assert.equal(progressAlternative.N05, 'available')
})

test('7. Backend Route Validation: unknown or non-branch route IDs are rejected and leave state unchanged', async () => {
  const repo = new MemoryImplementationRepository()
  const service = new ImplementationService(repo)

  const impl = await service.createImplementation({
    id: 'impl-validation-test',
    courseId: 'primer-sistema-de-contenido',
  })

  // 1. Invented non-existent route ID is rejected
  await assert.rejects(
    async () => service.updateLearnerSetup(impl.id, { preferredRouteId: 'invented-fake-id' }),
    /preferredRouteId 'invented-fake-id' is not a valid route option for course 'primer-sistema-de-contenido'/,
  )

  // 2. Unrelated downstream mission (N09 is not a fork branch) is rejected
  await assert.rejects(
    async () => service.updateLearnerSetup(impl.id, { preferredRouteId: 'N09' }),
    /preferredRouteId 'N09' is not a valid route option for course 'primer-sistema-de-contenido'/,
  )

  // 3. State remains completely unchanged
  const current = await repo.getById(impl.id)
  assert.equal(current?.learnerSetup, undefined)

  // 4. Valid branch target (N02 or N03) succeeds
  const updatedValid = await service.updateLearnerSetup(impl.id, { preferredRouteId: 'N02' })
  assert.equal(updatedValid.learnerSetup?.preferredRouteId, 'N02')
})

