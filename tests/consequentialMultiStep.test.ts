import assert from 'node:assert/strict'
import test from 'node:test'
import { course } from '../src/data/course.ts'
import type {
  ImplementationArtifact,
  ImplementationState,
  Mission,
  StructuredEvidenceEvaluation,
} from '../src/domain/course.ts'
import { EvidenceEvaluatorService } from '../src/server/evaluator/evaluatorService.ts'
import type { IEvidenceInterpreter } from '../src/server/evaluator/types.ts'
import { MemoryImplementationRepository } from '../src/server/repository.ts'
import { ImplementationService } from '../src/server/service.ts'

class MockContextualInterpreter implements IEvidenceInterpreter {
  public lastPromptReceived: {
    mission: Mission
    evidence: string
    consumedArtifacts?: Record<string, ImplementationArtifact>
  } | null = null

  public responseGenerator: (params: {
    mission: Mission
    evidence: string
    consumedArtifacts?: Record<string, ImplementationArtifact>
  }) => StructuredEvidenceEvaluation = () => ({
    criteria: [
      { criterionId: 'c1_three_part_order', status: 'PASS', rationale: 'Valid' },
      { criterionId: 'c2_premise_consistency', status: 'PASS', rationale: 'Consistent' },
      { criterionId: 'c3_actionable_clarity', status: 'PASS', rationale: 'Clear' },
    ],
    coachingFeedback: 'Excelente estructura.',
    confidence: 0.95,
  })

  async interpret(params: {
    mission: Mission
    evidence: string
    consumedArtifacts?: Record<string, ImplementationArtifact>
  }): Promise<StructuredEvidenceEvaluation> {
    this.lastPromptReceived = params
    return this.responseGenerator(params)
  }
}

test('N02: 1. Locked mission cannot be submitted before prerequisites', async () => {
  const repo = new MemoryImplementationRepository()
  const service = new ImplementationService(repo)
  const interpreter = new MockContextualInterpreter()
  const evaluator = new EvidenceEvaluatorService(interpreter)

  const impl = await service.createImplementation({ courseId: course.id })

  await assert.rejects(
    () =>
      service.submitEvidence(
        impl.id,
        { missionId: 'N02', evidence: 'Apertura, desarrollo y cierre' },
        evaluator,
      ),
    /mission is currently locked/,
  )
})

test('N02: 2. Evaluator receives verified premise and rejects premise-contradicting evidence', async () => {
  const repo = new MemoryImplementationRepository()
  const service = new ImplementationService(repo)
  const interpreter = new MockContextualInterpreter()
  const evaluator = new EvidenceEvaluatorService(interpreter)

  const impl = await service.createImplementation({ courseId: course.id })

  // 1. Complete N01 with PASS
  interpreter.responseGenerator = () => ({
    criteria: [
      { criterionId: 'c1_concrete_idea', status: 'PASS', rationale: 'Valid' },
      { criterionId: 'c2_target_audience', status: 'PASS', rationale: 'Valid' },
      { criterionId: 'c3_no_filler', status: 'PASS', rationale: 'Valid' },
    ],
    coachingFeedback: 'Buena premisa.',
  })

  const verifiedPremise = 'Los programadores senior pierden 10 horas semanales depurando sin pruebas de regresión.'
  const n01Res = await service.submitEvidence(
    impl.id,
    { missionId: 'N01', evidence: verifiedPremise },
    evaluator,
  )
  assert.equal(n01Res.policyVerdict, 'PASS')
  assert.equal(n01Res.state.artifacts?.['premise']?.value?.statement, verifiedPremise)

  // 2. Submit contradictory N02 evidence (e.g. changing audience to chefs cooking pasta)
  interpreter.responseGenerator = (params) => {
    // Assert interpreter received the trusted premise from N01
    assert.equal(
      params.consumedArtifacts?.['premise']?.value?.statement,
      verifiedPremise,
    )
    return {
      criteria: [
        { criterionId: 'c1_three_part_order', status: 'PASS', rationale: 'Tiene estructura' },
        {
          criterionId: 'c2_premise_consistency',
          status: 'NOT_MET',
          rationale: 'Cambiaste el público objetivo de programadores senior a chefs de cocina.',
        },
        { criterionId: 'c3_actionable_clarity', status: 'PASS', rationale: 'Claro' },
      ],
      coachingFeedback:
        'Tu estructura está bien armada en tres pasos, pero contradice tu premisa de N01 al cambiar de programadores a chefs.',
    }
  }

  const badN02Res = await service.submitEvidence(
    impl.id,
    {
      missionId: 'N02',
      evidence: 'Apertura: Los chefs necesitan cuchillos. Desarrollo: Técnicas de corte. Cierre: Platos listos.',
    },
    evaluator,
  )

  assert.equal(badN02Res.policyVerdict, 'REWORK')
  assert.equal(badN02Res.completed, false)
  assert.ok(!badN02Res.state.completedMissionIds.includes('N02'))
  assert.equal(badN02Res.state.artifacts?.['direct_structure'], undefined)

  // Verify cold state in repository remains untouched for N02
  const reloaded = await service.getImplementation(impl.id)
  assert.ok(!reloaded?.completedMissionIds.includes('N02'))
  assert.equal(reloaded?.artifacts?.['direct_structure'], undefined)

  // 3. Submit corrected N02 evidence aligned with verified premise
  interpreter.responseGenerator = () => ({
    criteria: [
      { criterionId: 'c1_three_part_order', status: 'PASS', rationale: 'Apertura, desarrollo y cierre completos.' },
      {
        criterionId: 'c2_premise_consistency',
        status: 'PASS',
        rationale: 'Fiel a la premisa de programadores senior y pruebas de regresión.',
      },
      { criterionId: 'c3_actionable_clarity', status: 'PASS', rationale: 'Esquema directo y accionable.' },
    ],
    coachingFeedback: 'Excelente estructura directa. Lista para ensamblar.',
  })

  const goodEvidence =
    'Apertura: ¿Pierdes 10 horas depurando código en producción? Desarrollo: Configura una suite de pruebas de regresión automática con 3 capas. Cierre: Empieza con tu flujo crítico hoy mismo.'
  const goodN02Res = await service.submitEvidence(
    impl.id,
    { missionId: 'N02', evidence: goodEvidence },
    evaluator,
  )

  assert.equal(goodN02Res.policyVerdict, 'PASS')
  assert.equal(goodN02Res.completed, true)
  assert.ok(goodN02Res.state.completedMissionIds.includes('N02'))

  const directArtifact = goodN02Res.state.artifacts?.['direct_structure']
  assert.ok(directArtifact)
  assert.equal(directArtifact.key, 'direct_structure')
  assert.equal(directArtifact.sourceMissionId, 'N02')
  assert.equal(directArtifact.value.variant, 'direct')
  assert.equal(directArtifact.value.content, goodEvidence)
  assert.equal(directArtifact.value.sourcePremiseArtifactId, 'premise')

  // 4. Idempotency on completed N02
  const repeatN02 = await service.submitEvidence(
    impl.id,
    { missionId: 'N02', evidence: 'OTRA EVIDENCIA' },
    evaluator,
  )
  assert.equal(repeatN02.policyVerdict, 'PASS')
  assert.equal(repeatN02.state.artifacts?.['direct_structure']?.value?.content, goodEvidence)
})

test('N03: Evaluator receives verified premise and produces narrative_structure artifact on PASS', async () => {
  const repo = new MemoryImplementationRepository()
  const service = new ImplementationService(repo)
  const interpreter = new MockContextualInterpreter()
  const evaluator = new EvidenceEvaluatorService(interpreter)

  const impl = await service.createImplementation({ courseId: course.id })

  // 1. Complete N01
  interpreter.responseGenerator = () => ({
    criteria: [
      { criterionId: 'c1_concrete_idea', status: 'PASS', rationale: 'Valid' },
      { criterionId: 'c2_target_audience', status: 'PASS', rationale: 'Valid' },
      { criterionId: 'c3_no_filler', status: 'PASS', rationale: 'Valid' },
    ],
    coachingFeedback: 'Premisa lista.',
  })

  const premiseText = 'Los redactores freelance tardan días en cobrar por no pedir anticipo en sus contratos.'
  await service.submitEvidence(impl.id, { missionId: 'N01', evidence: premiseText }, evaluator)

  // 2. Submit contradictory N03 narrative
  interpreter.responseGenerator = (params) => {
    assert.equal(params.consumedArtifacts?.['premise']?.value?.statement, premiseText)
    return {
      criteria: [
        { criterionId: 'c1_narrative_arc', status: 'PASS', rationale: 'Historia con inicio y final' },
        {
          criterionId: 'c2_premise_consistency',
          status: 'NOT_MET',
          rationale: 'La historia trata sobre comprar una casa y no sobre redactores freelance cobrando anticipos.',
        },
        { criterionId: 'c3_tension_resolution', status: 'PASS', rationale: 'Hay tensión' },
      ],
      coachingFeedback: 'La historia tiene ritmo, pero se desvió por completo de la premisa de anticipos para redactores.',
    }
  }

  const badN03 = await service.submitEvidence(
    impl.id,
    { missionId: 'N03', evidence: 'Un día fui a comprar una casa y el banco me negó el crédito.' },
    evaluator,
  )
  assert.equal(badN03.policyVerdict, 'REWORK')
  assert.equal(badN03.state.artifacts?.['narrative_structure'], undefined)

  // 3. Submit valid aligned narrative
  interpreter.responseGenerator = () => ({
    criteria: [
      { criterionId: 'c1_narrative_arc', status: 'PASS', rationale: 'Situación inicial, conflicto y desenlace claros.' },
      {
        criterionId: 'c2_premise_consistency',
        status: 'PASS',
        rationale: 'Ilustra perfectamente la premisa de redactores freelance y anticipos.',
      },
      { criterionId: 'c3_tension_resolution', status: 'PASS', rationale: 'Tensión resuelta con aprendizaje concreto.' },
    ],
    coachingFeedback: 'Gran estructura narrativa con arco coherente.',
  })

  const narrativeText =
    'Situación inicial: Pasé 3 semanas redactando un manual sin pedir 50% de anticipo. Giro: El cliente desapareció sin pagar el saldo. Desenlace: Modifiqué mi contrato estándar y nunca volví a entregar un borrador sin anticipo en cuenta.'
  const goodN03 = await service.submitEvidence(
    impl.id,
    { missionId: 'N03', evidence: narrativeText },
    evaluator,
  )

  assert.equal(goodN03.policyVerdict, 'PASS')
  assert.ok(goodN03.state.completedMissionIds.includes('N03'))

  const narrativeArtifact = goodN03.state.artifacts?.['narrative_structure']
  assert.ok(narrativeArtifact)
  assert.equal(narrativeArtifact.key, 'narrative_structure')
  assert.equal(narrativeArtifact.sourceMissionId, 'N03')
  assert.equal(narrativeArtifact.value.variant, 'narrative')
  assert.equal(narrativeArtifact.value.content, narrativeText)
  assert.equal(narrativeArtifact.value.sourcePremiseArtifactId, 'premise')
})

test('Cross-Learner Isolation: Learner A and Learner B receive only their own verified premise', async () => {
  const repo = new MemoryImplementationRepository()
  const service = new ImplementationService(repo)
  const interpreter = new MockContextualInterpreter()
  const evaluator = new EvidenceEvaluatorService(interpreter)

  const implA = await service.createImplementation({ courseId: course.id })
  const implB = await service.createImplementation({ courseId: course.id })

  const premiseA = 'Premisa de Learner A: Consultores de ciberseguridad.'
  const premiseB = 'Premisa de Learner B: Docentes universitarios.'

  interpreter.responseGenerator = () => ({
    criteria: [
      { criterionId: 'c1_concrete_idea', status: 'PASS', rationale: 'OK' },
      { criterionId: 'c2_target_audience', status: 'PASS', rationale: 'OK' },
      { criterionId: 'c3_no_filler', status: 'PASS', rationale: 'OK' },
    ],
    coachingFeedback: 'OK',
  })

  await service.submitEvidence(implA.id, { missionId: 'N01', evidence: premiseA }, evaluator)
  await service.submitEvidence(implB.id, { missionId: 'N01', evidence: premiseB }, evaluator)

  // Verify Learner A N02 call receives Premise A
  interpreter.responseGenerator = (params) => {
    assert.equal(params.consumedArtifacts?.['premise']?.value?.statement, premiseA)
    return {
      criteria: [
        { criterionId: 'c1_three_part_order', status: 'PASS', rationale: 'OK' },
        { criterionId: 'c2_premise_consistency', status: 'PASS', rationale: 'OK' },
        { criterionId: 'c3_actionable_clarity', status: 'PASS', rationale: 'OK' },
      ],
      coachingFeedback: 'OK A',
    }
  }
  await service.submitEvidence(implA.id, { missionId: 'N02', evidence: 'Estructura directa A' }, evaluator)

  // Verify Learner B N03 call receives Premise B
  interpreter.responseGenerator = (params) => {
    assert.equal(params.consumedArtifacts?.['premise']?.value?.statement, premiseB)
    return {
      criteria: [
        { criterionId: 'c1_narrative_arc', status: 'PASS', rationale: 'OK' },
        { criterionId: 'c2_premise_consistency', status: 'PASS', rationale: 'OK' },
        { criterionId: 'c3_tension_resolution', status: 'PASS', rationale: 'OK' },
      ],
      coachingFeedback: 'OK B',
    }
  }
  await service.submitEvidence(implB.id, { missionId: 'N03', evidence: 'Narrativa B' }, evaluator)

  const stateA = await service.getImplementation(implA.id)
  const stateB = await service.getImplementation(implB.id)

  assert.ok(stateA?.artifacts?.['direct_structure'])
  assert.equal(stateA?.artifacts?.['narrative_structure'], undefined)

  assert.ok(stateB?.artifacts?.['narrative_structure'])
  assert.equal(stateB?.artifacts?.['direct_structure'], undefined)
})

test('Same Methodology / Different Path: Learner 1 chooses Direct (N02), Learner 2 chooses Narrative (N03)', async () => {
  const repo = new MemoryImplementationRepository()
  const service = new ImplementationService(repo)
  const interpreter = new MockContextualInterpreter()
  const evaluator = new EvidenceEvaluatorService(interpreter)

  const sharedPremise = 'Los diseñadores UI pierden horas exportando assets manualmente.'

  const l1 = await service.createImplementation({ courseId: course.id })
  const l2 = await service.createImplementation({ courseId: course.id })

  interpreter.responseGenerator = () => ({
    criteria: [
      { criterionId: 'c1_concrete_idea', status: 'PASS', rationale: 'OK' },
      { criterionId: 'c2_target_audience', status: 'PASS', rationale: 'OK' },
      { criterionId: 'c3_no_filler', status: 'PASS', rationale: 'OK' },
    ],
    coachingFeedback: 'OK',
  })

  await service.submitEvidence(l1.id, { missionId: 'N01', evidence: sharedPremise }, evaluator)
  await service.submitEvidence(l2.id, { missionId: 'N01', evidence: sharedPremise }, evaluator)

  // Learner 1 starts and completes N02
  await service.startMission(l1.id, { missionId: 'N02' })
  interpreter.responseGenerator = () => ({
    criteria: [
      { criterionId: 'c1_three_part_order', status: 'PASS', rationale: 'OK' },
      { criterionId: 'c2_premise_consistency', status: 'PASS', rationale: 'OK' },
      { criterionId: 'c3_actionable_clarity', status: 'PASS', rationale: 'OK' },
    ],
    coachingFeedback: 'Estructura directa lista',
  })
  await service.submitEvidence(l1.id, { missionId: 'N02', evidence: 'Apertura, desarrollo, cierre UI' }, evaluator)

  // Learner 2 starts and completes N03
  await service.startMission(l2.id, { missionId: 'N03' })
  interpreter.responseGenerator = () => ({
    criteria: [
      { criterionId: 'c1_narrative_arc', status: 'PASS', rationale: 'OK' },
      { criterionId: 'c2_premise_consistency', status: 'PASS', rationale: 'OK' },
      { criterionId: 'c3_tension_resolution', status: 'PASS', rationale: 'OK' },
    ],
    coachingFeedback: 'Narrativa lista',
  })
  await service.submitEvidence(l2.id, { missionId: 'N03', evidence: 'Historia de un diseñador y un plugin' }, evaluator)

  const finalL1 = await service.getImplementation(l1.id)
  const finalL2 = await service.getImplementation(l2.id)

  assert.deepEqual(finalL1?.completedMissionIds, ['N01', 'N02'])
  assert.deepEqual(finalL2?.completedMissionIds, ['N01', 'N03'])
  assert.equal(finalL1?.artifacts?.['direct_structure']?.value?.variant, 'direct')
  assert.equal(finalL2?.artifacts?.['narrative_structure']?.value?.variant, 'narrative')
})
