import test from 'node:test'
import assert from 'node:assert/strict'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { MemoryImplementationRepository, FileStorageImplementationRepository, MemoryCalibrationRepository } from '../src/server/repository.ts'
import { ImplementationService, resolveArtifactProductions } from '../src/server/service.ts'
import { CalibrationService } from '../src/server/calibrationService.ts'
import { EvidenceEvaluatorService } from '../src/server/evaluator/evaluatorService.ts'
import { packs, resolvePack } from '../src/data/packs/index.ts'
import type {
  CriterionResult,
  ImplementationState,
  Rubric,
  StructuredEvidenceEvaluation,
} from '../src/domain/course.ts'
import type { IEvidenceInterpreter } from '../src/server/types.ts'

const PACK_A_ID = 'primer-sistema-de-contenido'
const PACK_B_ID = 'primer-cliente-digital'

function passingEvaluation(rubric: Rubric): StructuredEvidenceEvaluation {
  const criteria: CriterionResult[] = rubric.criteria
    .filter((criterion) => criterion.isRequired)
    .map((criterion) => ({
      criterionId: criterion.id,
      status: 'PASS',
      rationale: 'Cumple el criterio.',
    }))
  return { interactionType: 'EVIDENCE_SUBMISSION', message: 'Bien.', criteria }
}

function failingEvaluation(rubric: Rubric, status: CriterionResult['status']): StructuredEvidenceEvaluation {
  const target = rubric.criteria.find((criterion) => criterion.isRequired)!
  const criteria: CriterionResult[] = rubric.criteria
    .filter((criterion) => criterion.isRequired)
    .map((criterion) => ({
      criterionId: criterion.id,
      status: criterion.id === target.id ? status : 'PASS',
      rationale: 'Observación.',
    }))
  return { interactionType: 'EVIDENCE_SUBMISSION', message: 'Todavía no.', criteria }
}

class PackAwareMockInterpreter implements IEvidenceInterpreter {
  async interpret(params: { mission: { rubric?: Rubric; id: string }; evidence: string }): Promise<StructuredEvidenceEvaluation> {
    if (!params.mission.rubric) throw new Error('Mission has no rubric in test fixture')
    // Deterministic fixture: evidence containing 'REJECT:<criterionId>' marks that criterion with the given status.
    if (params.evidence.includes('REWORK:')) {
      return failingEvaluation(params.mission.rubric, 'NOT_MET')
    }
    if (params.evidence.includes('CLARIFY:')) {
      return failingEvaluation(params.mission.rubric, 'UNVERIFIABLE')
    }
    return passingEvaluation(params.mission.rubric)
  }
}

function createServices() {
  const implementations = new MemoryImplementationRepository()
  const calibrations = new MemoryCalibrationRepository()
  const service = new ImplementationService(implementations, calibrations)
  const evaluator = new EvidenceEvaluatorService(new PackAwareMockInterpreter())
  return { service, evaluator, calibrations }
}

test('B. Second methodology executes the full verified loop through the same engine', async () => {
  const { service, evaluator } = createServices()
  assert.equal(resolvePack(PACK_B_ID).id, PACK_B_ID)

  const impl = await service.createImplementation({ courseId: PACK_B_ID })
  assert.equal(impl.courseId, PACK_B_ID)

  // Locked downstream mission cannot start or receive evidence.
  await assert.rejects(
    () => service.startMission(impl.id, { missionId: 'C03' }),
    /locked/,
  )
  await assert.rejects(
    () => service.submitEvidence(impl.id, { missionId: 'C02', evidence: 'lista' }, evaluator),
    /locked/,
  )

  await service.startMission(impl.id, { missionId: 'C01' })
  const c01 = await service.submitEvidence(impl.id, { missionId: 'C01', evidence: 'Oferta de diseño web para clínicas dentales...' }, evaluator)
  assert.equal(c01.policyVerdict, 'PASS')
  assert.equal(c01.completed, true)
  const offerArtifact = c01.state.artifacts?.['offer']
  assert.ok(offerArtifact, 'declared offer artifact must materialize on PASS')
  assert.equal(offerArtifact.sourceMissionId, 'C01')
  assert.equal((offerArtifact.value as Record<string, unknown>).content.includes('Oferta'), true)

  // Fail-closed consumption inside pack B: C02 needs the offer artifact (present now).
  await service.startMission(impl.id, { missionId: 'C02' })
  const c02 = await service.submitEvidence(impl.id, { missionId: 'C02', evidence: '1. Clínica A (correo)...' }, evaluator)
  assert.equal(c02.policyVerdict, 'PASS')
  const listArtifact = c02.state.artifacts?.['prospect_list']
  assert.ok(listArtifact)
  assert.equal((listArtifact.value as Record<string, unknown>).sourceOfferArtifactId, 'offer')

  // C03 is url-evidence typed and consumes prospect_list; same pipeline handles it.
  await service.startMission(impl.id, { missionId: 'C03' })
  const c03 = await service.submitEvidence(impl.id, { missionId: 'C03', evidence: 'https://mail.example.com/hilo-contacto-123' }, evaluator)
  assert.equal(c03.policyVerdict, 'PASS')
  assert.ok(c03.state.artifacts?.['outreach_sent'])
  assert.deepEqual([...c03.state.completedMissionIds].sort(), ['C01', 'C02', 'C03'])

  // Milestone C04 completes the route without producing artifacts.
  await service.startMission(impl.id, { missionId: 'C04' })
  const c04 = await service.submitEvidence(impl.id, { missionId: 'C04', evidence: 'Contacté a Clínica A; acordamos llamada el viernes.' }, evaluator)
  assert.equal(c04.policyVerdict, 'PASS')
  assert.deepEqual([...c04.state.completedMissionIds].sort(), ['C01', 'C02', 'C03', 'C04'])
})

test('C. Non-PASS verdicts never unlock in the second methodology', async () => {
  const { service, evaluator } = createServices()
  const impl = await service.createImplementation({ courseId: PACK_B_ID })

  const rework = await service.submitEvidence(impl.id, { missionId: 'C01', evidence: 'REWORK: oferta vaga' }, evaluator)
  assert.equal(rework.policyVerdict, 'REWORK')
  assert.equal(rework.completed, false)
  assert.deepEqual(rework.state.completedMissionIds, [])
  assert.equal(rework.state.artifacts?.['offer'], undefined)

  const clarify = await service.submitEvidence(impl.id, { missionId: 'C01', evidence: 'CLARIFY: qué significa entrega' }, evaluator)
  assert.equal(clarify.policyVerdict, 'CLARIFY')
  assert.deepEqual(clarify.state.completedMissionIds, [])
  assert.equal(clarify.state.artifacts?.['offer'], undefined)
})

test('D. Declared artifact without production spec fails loudly before evaluation', async () => {
  const packA = resolvePack(PACK_A_ID)
  const n01 = packA.chapters[0].missions.find((mission) => mission.id === 'N01')!
  const broken = { ...n01, artifactProductions: [] }

  assert.throws(
    () => resolveArtifactProductions(broken),
    /without a supported production spec/,
  )

  // Orphan spec (spec without declaration) is also a loud configuration error.
  const orphan = { ...n01, producesArtifacts: [] }
  assert.throws(() => resolveArtifactProductions(orphan), /not declared/)
})

test('D2. Unknown methodology id fails loudly at creation and resolution', async () => {
  const { service } = createServices()
  assert.throws(() => resolvePack('metodologia-inexistente'), /Unknown methodology pack/)
  await assert.rejects(
    () => service.createImplementation({ courseId: 'metodologia-inexistente' }),
    /Unknown methodology pack/,
  )
})

test('E. Cross-methodology isolation: calibration scoped per course cannot collide on shared mission ids', async () => {
  const implementations = new MemoryImplementationRepository()
  const calibrations = new MemoryCalibrationRepository()

  const calibrationA: import('../src/domain/course.ts').CreatorCalibration = {
    missionId: 'N01',
    courseId: PACK_A_ID,
    initialStandard: 'estándar A',
    examples: [],
    status: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  const calibrationBSameMissionId: import('../src/domain/course.ts').CreatorCalibration = {
    missionId: 'N01',
    courseId: PACK_B_ID,
    userId: 'coach-1',
    initialStandard: 'estándar B',
    examples: [],
    status: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  await calibrations.save(calibrationA)
  await calibrations.save(calibrationBSameMissionId)

  const scopedA = await calibrations.getByMissionId('N01', undefined, PACK_A_ID)
  const scopedBCoach = await calibrations.getByMissionId('N01', 'coach-1', PACK_B_ID)
  assert.equal(scopedA?.initialStandard, 'estándar A')
  assert.equal(scopedBCoach?.initialStandard, 'estándar B')

  const calibrationService = new CalibrationService(calibrations)
  const createdForPackBMission = await calibrationService.create('C01', { initialStandard: 'ofertas claras y con audiencia definida para validar' })
  assert.equal(createdForPackBMission.courseId, PACK_B_ID)

  // State isolation: two learners on different methodologies never share state.
  const service = new ImplementationService(implementations)
  const implA = await service.createImplementation({ courseId: PACK_A_ID })
  const implB = await service.createImplementation({ courseId: PACK_B_ID })
  assert.notEqual(implA.courseId, implB.courseId)
  assert.equal(implA.courseId, PACK_A_ID)
  assert.equal(implB.courseId, PACK_B_ID)
})

test('F. Persisted courseId survives file-storage reload and re-resolves its pack', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'trazo-pack-test-'))
  try {
    const filePath = path.join(dir, 'implementations.json')
    const firstInstance = new FileStorageImplementationRepository(filePath)
    const state: ImplementationState = {
      id: 'reload-check-1',
      courseId: PACK_B_ID,
      courseVersion: '1.0.0',
      completedMissionIds: [],
      artifacts: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    await firstInstance.save(state)

    const secondInstance = new FileStorageImplementationRepository(filePath)
    const reloaded = await secondInstance.getById('reload-check-1')
    assert.ok(reloaded)
    assert.equal(reloaded.courseId, PACK_B_ID)
    assert.equal(resolvePack(reloaded.courseId).id, PACK_B_ID)
    assert.equal(resolvePack(reloaded.courseId).chapters[0].missions[0].id, 'C01')
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('Registry sanity: both packs are structurally valid for the shared engine', () => {
  assert.equal(packs.length, 2)
  for (const pack of packs) {
    assert.ok(pack.chapters.length > 0)
    for (const chapter of pack.chapters) {
      const ids = new Set(chapter.missions.map((mission) => mission.id))
      assert.equal(ids.size, chapter.missions.length, `duplicate mission ids in ${pack.id}`)
      for (const mission of chapter.missions) {
        for (const prerequisite of [...(mission.prerequisites ?? []), ...(mission.requiresAny ?? [])]) {
          assert.ok(ids.has(prerequisite), `${pack.id}:${mission.id} references unknown ${prerequisite}`)
        }
        resolveArtifactProductions(mission)
        for (const consumed of mission.consumesArtifacts ?? []) {
          assert.ok(
            chapter.missions.some((producer) => producer.producesArtifacts?.includes(consumed)),
            `${pack.id}:${mission.id} consumes undeclared artifact '${consumed}'`,
          )
        }
      }
    }
  }
})
