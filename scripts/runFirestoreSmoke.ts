import { FirestoreImplementationRepository } from '../src/server/repository.ts'
import { ImplementationService } from '../src/server/service.ts'
import { EvidenceEvaluatorService } from '../src/server/evaluator/evaluatorService.ts'
import { course } from '../src/data/course.ts'
import { deriveMissionProgress } from '../src/domain/progression.ts'
import type { IEvidenceInterpreter } from '../src/server/evaluator/types.ts'
import type { Mission, StructuredEvidenceEvaluation } from '../src/domain/course.ts'

class MockPassInterpreter implements IEvidenceInterpreter {
  async interpret(_params: { mission: Mission; evidence: string }): Promise<StructuredEvidenceEvaluation> {
    return {
      criteria: [
        { criterionId: 'c1_concrete_idea', status: 'PASS', rationale: 'Idea central concreta y única' },
        { criterionId: 'c2_target_audience', status: 'PASS', rationale: 'Audiencia reconocible' },
        { criterionId: 'c3_no_filler', status: 'PASS', rationale: 'Sin explicaciones accesorias' },
      ],
      coachingFeedback: 'Excelente premisa verificada.',
    }
  }
}

class MockReworkInterpreter implements IEvidenceInterpreter {
  async interpret(_params: { mission: Mission; evidence: string }): Promise<StructuredEvidenceEvaluation> {
    return {
      criteria: [
        { criterionId: 'c1_concrete_idea', status: 'PASS', rationale: 'Idea central concreta' },
        { criterionId: 'c2_target_audience', status: 'NOT_MET', rationale: 'Falta especificar audiencia' },
        { criterionId: 'c3_no_filler', status: 'PASS', rationale: 'Sin explicaciones accesorias' },
      ],
      coachingFeedback: 'Ajusta la audiencia objetivo.',
    }
  }
}

async function runSmoke() {
  console.log('======================================================================')
  console.log('  TRAZO REAL FIRESTORE PRODUCTION SLICE SMOKE TEST (TASK-007)')
  console.log('======================================================================\n')

  const projectId = process.env.GOOGLE_CLOUD_PROJECT || 'trazo-agentic-2026'
  console.log(`[Config] Google Cloud Project: ${projectId}`)

  const smokeIdA = `trazo-smoke-a-${Date.now()}`
  const smokeIdB = `trazo-smoke-b-${Date.now()}`
  const premiseTextA = 'Los consultores de software pierden 15 horas semanales en propuestas porque no estandarizan su alcance inicial.'
  const premiseTextB = 'Los veterinarios de campo pierden margen porque no registran mermas en tiempo real.'

  const createdDocIds: string[] = []

  try {
    // ---------------------------------------------------------------------------------------
    // CHECK 1: INITIAL CREATE & RE-INSTANTIATION READ (Implementation A)
    // ---------------------------------------------------------------------------------------
    console.log(`\n[1/8] Creating Implementation A (${smokeIdA})...`)
    const repo1 = new FirestoreImplementationRepository({ projectId })
    const service1 = new ImplementationService(repo1)

    const initialA = await service1.createImplementation({
      id: smokeIdA,
      courseId: course.id,
      courseVersion: '1.0.0',
    })
    createdDocIds.push(smokeIdA)

    console.log(`- Created in Firestore: id = ${initialA.id}, completed = [${initialA.completedMissionIds}]`)

    // Fresh repository instance for clean read
    const repoFresh1 = new FirestoreImplementationRepository({ projectId })
    const serviceFresh1 = new ImplementationService(repoFresh1)
    const readA = await serviceFresh1.getImplementation(smokeIdA)

    if (!readA || readA.completedMissionIds.length !== 0 || readA.activeMissionId !== undefined) {
      throw new Error(`Initial read failed for ${smokeIdA}`)
    }
    console.log('✔ CHECK 1 PASSED: Initial state persisted and verified via fresh repository instance.')

    // ---------------------------------------------------------------------------------------
    // CHECK 2: VERIFIED ACTION PERSISTENCE (N01 PASS + Premise Artifact)
    // ---------------------------------------------------------------------------------------
    console.log(`\n[2/8] Executing Verified Action on Implementation A (N01 PASS)...`)
    const evaluatorPass = new EvidenceEvaluatorService(new MockPassInterpreter())
    const subResultA = await serviceFresh1.submitEvidence(
      smokeIdA,
      { missionId: 'N01', evidence: premiseTextA },
      evaluatorPass,
    )

    if (!subResultA.completed || subResultA.policyVerdict !== 'PASS') {
      throw new Error(`Expected PASS on N01 submission, got: ${subResultA.policyVerdict}`)
    }
    console.log(`- Verdict: ${subResultA.policyVerdict}, completedMissionIds: [${subResultA.state.completedMissionIds}]`)
    console.log(`- Artifact generated: ${JSON.stringify(subResultA.state.artifacts?.premise?.value)}`)
    console.log('✔ CHECK 2 PASSED: N01 completed and canonical premise artifact created in Firestore.')

    // ---------------------------------------------------------------------------------------
    // CHECK 3: RE-INSTANTIATION PERSISTENCE & GRAPH PROGRESSION
    // ---------------------------------------------------------------------------------------
    console.log(`\n[3/8] Verifying persistence across complete process re-instantiation...`)
    const repoFresh2 = new FirestoreImplementationRepository({ projectId })
    const serviceFresh2 = new ImplementationService(repoFresh2)
    const reloadedA = await serviceFresh2.getImplementation(smokeIdA)

    if (!reloadedA) throw new Error(`Could not reload ${smokeIdA}`)
    if (!reloadedA.completedMissionIds.includes('N01')) throw new Error('N01 not found in completedMissionIds after reload')
    const statementSaved = (reloadedA.artifacts?.premise?.value as { statement?: string })?.statement
    if (statementSaved !== premiseTextA) throw new Error(`Premise statement mismatch: ${statementSaved}`)

    // Graph derivation
    const allMissions = course.chapters[0].missions
    const progress = deriveMissionProgress(allMissions, new Set(reloadedA.completedMissionIds))
    if (progress['N01'] !== 'completed') throw new Error('N01 should be completed in graph')
    if (progress['N02'] !== 'available' || progress['N03'] !== 'available') {
      throw new Error(`N02/N03 should be available, got N02=${progress['N02']}, N03=${progress['N03']}`)
    }
    console.log(`- Reloaded completedMissionIds: [${reloadedA.completedMissionIds}]`)
    console.log(`- Reloaded premise artifact: "${statementSaved}"`)
    console.log(`- Graph progress: N01=${progress['N01']}, N02=${progress['N02']}, N03=${progress['N03']}`)
    console.log('✔ CHECK 3 PASSED: State & artifact survived re-instantiation and unlocked N02/N03.')

    // ---------------------------------------------------------------------------------------
    // CHECK 4: ACTIVE MISSION PERSISTENCE (startMission N02)
    // ---------------------------------------------------------------------------------------
    console.log(`\n[4/8] Starting legal mission N02 and testing persistence...`)
    const startResult = await serviceFresh2.startMission(smokeIdA, { missionId: 'N02' })
    if (startResult.activeMissionId !== 'N02') throw new Error(`Expected activeMissionId 'N02', got ${startResult.activeMissionId}`)

    // Re-verify with fresh instance
    const repoFresh3 = new FirestoreImplementationRepository({ projectId })
    const serviceFresh3 = new ImplementationService(repoFresh3)
    const reloadedStartA = await serviceFresh3.getImplementation(smokeIdA)
    if (reloadedStartA?.activeMissionId !== 'N02') throw new Error(`activeMissionId 'N02' did not persist in Firestore`)
    console.log(`- Persisted activeMissionId: "${reloadedStartA.activeMissionId}"`)
    console.log('✔ CHECK 4 PASSED: activeMissionId persisted and verified after reload.')

    // ---------------------------------------------------------------------------------------
    // CHECK 5: NON-PASS FIRESTORE SAFETY (Implementation B with REWORK)
    // ---------------------------------------------------------------------------------------
    console.log(`\n[5/8] Creating Implementation B (${smokeIdB}) and testing non-PASS safety (REWORK)...`)
    await serviceFresh3.createImplementation({
      id: smokeIdB,
      courseId: course.id,
      courseVersion: '1.0.0',
    })
    createdDocIds.push(smokeIdB)

    const evaluatorRework = new EvidenceEvaluatorService(new MockReworkInterpreter())
    const subResultB = await serviceFresh3.submitEvidence(
      smokeIdB,
      { missionId: 'N01', evidence: premiseTextB },
      evaluatorRework,
    )

    if (subResultB.completed || subResultB.policyVerdict !== 'REWORK') {
      throw new Error(`Expected REWORK on N01 for B, got: ${subResultB.policyVerdict}`)
    }

    const repoFresh4 = new FirestoreImplementationRepository({ projectId })
    const serviceFresh4 = new ImplementationService(repoFresh4)
    const reloadedB = await serviceFresh4.getImplementation(smokeIdB)

    if (!reloadedB || reloadedB.completedMissionIds.length !== 0 || reloadedB.artifacts?.premise) {
      throw new Error(`Non-PASS state leaked canonical completion or artifact into Firestore!`)
    }
    console.log(`- Implementation B completed: [${reloadedB.completedMissionIds}], artifacts: ${JSON.stringify(reloadedB.artifacts || {})}`)
    console.log('✔ CHECK 5 PASSED: Non-PASS verdict created zero canonical completions or artifacts in Firestore.')

    // ---------------------------------------------------------------------------------------
    // CHECK 6: CREATE IDEMPOTENCY
    // ---------------------------------------------------------------------------------------
    console.log(`\n[6/8] Testing createImplementation idempotency against real Firestore...`)
    const repeatCreateA = await serviceFresh4.createImplementation({
      id: smokeIdA,
      courseId: course.id,
    })
    if (!repeatCreateA.completedMissionIds.includes('N01') || repeatCreateA.activeMissionId !== 'N02') {
      throw new Error('createImplementation destroyed existing progress on Firestore!')
    }
    console.log('✔ CHECK 6 PASSED: createImplementation on existing ID preserved all progress and activeMissionId.')

    // ---------------------------------------------------------------------------------------
    // CHECK 7: COMPLETED SUBMISSION IDEMPOTENCY
    // ---------------------------------------------------------------------------------------
    console.log(`\n[7/8] Testing completed mission resubmission idempotency...`)
    const resubA = await serviceFresh4.submitEvidence(
      smokeIdA,
      { missionId: 'N01', evidence: 'Alternative text trying to overwrite' },
      evaluatorPass,
    )
    if (!resubA.completed) throw new Error('Resubmission should return completed: true')
    const finalReloadA = await serviceFresh4.getImplementation(smokeIdA)
    const finalStatement = (finalReloadA?.artifacts?.premise?.value as { statement?: string })?.statement
    if (finalStatement !== premiseTextA) {
      throw new Error(`Canonical artifact was overwritten on resubmission: ${finalStatement}`)
    }
    console.log('✔ CHECK 7 PASSED: Completed mission resubmission preserved canonical artifact and timestamps.')

    // ---------------------------------------------------------------------------------------
    // CHECK 8: MULTI-IMPLEMENTATION ISOLATION
    // ---------------------------------------------------------------------------------------
    console.log(`\n[8/8] Verifying multi-implementation isolation (A vs B)...`)
    const finalA = await serviceFresh4.getImplementation(smokeIdA)
    const finalB = await serviceFresh4.getImplementation(smokeIdB)
    if (finalA?.id === finalB?.id) throw new Error('IDs matched')
    if (finalA?.completedMissionIds.length !== 1 || finalB?.completedMissionIds.length !== 0) {
      throw new Error('Progress cross-leak detected between A and B')
    }
    console.log('✔ CHECK 8 PASSED: Complete isolation between Implementation A and B.')

    console.log('\n======================================================================')
    console.log('  ALL 8 FIRESTORE PRODUCTION SLICE CHECKS PASSED SUCCESSFULLY!')
    console.log('======================================================================')

  } finally {
    // Cleanup of unique smoke documents
    console.log('\n[Cleanup] Cleaning up temporary smoke test documents from Firestore...')
    const cleanupRepo = new FirestoreImplementationRepository({ projectId })
    for (const docId of createdDocIds) {
      try {
        await cleanupRepo.delete(docId)
        console.log(`- Deleted smoke document: ${docId}`)
      } catch (err) {
        console.warn(`- Failed to delete smoke document ${docId}:`, err)
      }
    }
    console.log('[Cleanup] Cleanup complete.')
  }
}

void runSmoke()
