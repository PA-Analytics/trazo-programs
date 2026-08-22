import { course } from '../src/data/course.ts'
import { GeminiEvidenceInterpreter } from '../src/server/evaluator/geminiInterpreter.ts'
import { createCanonicalGeminiRuntime } from '../src/server/ai/runtime.ts'
import { EvidenceEvaluatorService } from '../src/server/evaluator/evaluatorService.ts'
import { MemoryImplementationRepository } from '../src/server/repository.ts'
import { ImplementationService } from '../src/server/service.ts'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function runLiveEvaluation() {
  console.log('=== RUNNING LIVE GEMINI 3.7 FLASH COMPANION CONVERSATION TESTS ===\n')

  const repository = new MemoryImplementationRepository()
  const service = new ImplementationService(repository)
  const interpreter = new GeminiEvidenceInterpreter(createCanonicalGeminiRuntime())
  const evaluatorService = new EvidenceEvaluatorService(interpreter)

  // --- MULTI-TURN CONVERSATION TEST ---
  console.log('--- MULTI-TURN CONVERSATION ---')
  const multiTurnState = await service.createImplementation({ courseId: course.id })
  const multiTurnId = multiTurnState.id

  // TURN 1
  console.log('\n[TURN 1]')
  const input1 = 'no entiendo qué tengo que poner'
  console.log('INPUT:', input1)
  const res1 = await service.submitEvidence(multiTurnId, { missionId: 'N01', evidence: input1 }, evaluatorService)
  console.log('TYPE:', res1.interactionType)
  console.log('OUTPUT:', res1.message)
  console.log('STATE MUTATION:', res1.completed ? 'MUTATED (PASS)' : 'NONE')
  await sleep(1000)

  // TURN 2
  console.log('\n[TURN 2]')
  const input2 = 'ahhh o sea podría ser para gente nueva en el gym?'
  console.log('INPUT:', input2)
  const res2 = await service.submitEvidence(multiTurnId, { missionId: 'N01', evidence: input2 }, evaluatorService)
  console.log('TYPE:', res2.interactionType)
  console.log('OUTPUT:', res2.message)
  console.log('STATE MUTATION:', res2.completed ? 'MUTATED (PASS)' : 'NONE')
  await sleep(1000)

  // TURN 3
  console.log('\n[TURN 3]')
  const input3 = 'quiero explicarles qué suplementos sí valen la pena cuando apenas empiezan'
  console.log('INPUT:', input3)
  const res3 = await service.submitEvidence(multiTurnId, { missionId: 'N01', evidence: input3 }, evaluatorService)
  console.log('TYPE:', res3.interactionType)
  console.log('OUTPUT:', res3.message)
  console.log('STATE MUTATION:', res3.completed ? 'MUTATED (PASS)' : 'NONE')
  console.log('POLICY VERDICT:', res3.policyVerdict)
  if (res3.evaluation?.criteria) {
    console.log('CRITERIA:', res3.evaluation.criteria.map((c) => `${c.criterionId}: ${c.status}`).join(' | '))
  }
  await sleep(1000)

  // --- CASUAL CONVERSATION & VENTING TEST ---
  console.log('\n--- CASUAL CONVERSATION / VENTING ---')
  const ventState = await service.createImplementation({ courseId: course.id })
  const inputVent = 'wey neta me cagas'
  console.log('INPUT:', inputVent)
  const resVent = await service.submitEvidence(ventState.id, { missionId: 'N01', evidence: inputVent }, evaluatorService)
  console.log('TYPE:', resVent.interactionType)
  console.log('OUTPUT:', resVent.message)
  console.log('STATE MUTATION:', resVent.completed ? 'MUTATED (PASS)' : 'NONE')
  await sleep(1000)

  // --- CASUAL VALID EVIDENCE TEST ---
  console.log('\n--- CASUAL VALID EVIDENCE ---')
  const casualState = await service.createImplementation({ courseId: course.id })
  const inputCasualValid = 'wey pues quiero decirle a freelancers que dejen de mandar propuestas genéricas porque pierden clientes'
  console.log('INPUT:', inputCasualValid)
  const resCasualValid = await service.submitEvidence(casualState.id, { missionId: 'N01', evidence: inputCasualValid }, evaluatorService)
  console.log('TYPE:', resCasualValid.interactionType)
  console.log('OUTPUT:', resCasualValid.message)
  console.log('STATE MUTATION:', resCasualValid.completed ? 'MUTATED (PASS)' : 'NONE')
  console.log('POLICY VERDICT:', resCasualValid.policyVerdict)
  if (resCasualValid.evaluation?.criteria) {
    console.log('CRITERIA:', resCasualValid.evaluation.criteria.map((c) => `${c.criterionId}: ${c.status}`).join(' | '))
  }
  await sleep(1000)

  // --- RUBRIC WORD RESEMBLANCE QUESTION ---
  console.log('\n--- RUBRIC WORD RESEMBLANCE QUESTION ---')
  const rubricWordState = await service.createImplementation({ courseId: course.id })
  const inputRubricWord = 'no entiendo qué significa audiencia'
  console.log('INPUT:', inputRubricWord)
  const resRubricWord = await service.submitEvidence(rubricWordState.id, { missionId: 'N01', evidence: inputRubricWord }, evaluatorService)
  console.log('TYPE:', resRubricWord.interactionType)
  console.log('OUTPUT:', resRubricWord.message)
  console.log('STATE MUTATION:', resRubricWord.completed ? 'MUTATED (PASS)' : 'NONE')
  await sleep(1000)

  // --- AMBIGUOUS EXPLORATION TEST ---
  console.log('\n--- AMBIGUOUS EXPLORATION ---')
  const ambiguousState = await service.createImplementation({ courseId: course.id })
  const inputAmbiguous = 'qué tal si hago algo sobre suplementos para gente del gym?'
  console.log('INPUT:', inputAmbiguous)
  const resAmbiguous = await service.submitEvidence(ambiguousState.id, { missionId: 'N01', evidence: inputAmbiguous }, evaluatorService)
  console.log('TYPE:', resAmbiguous.interactionType)
  console.log('OUTPUT:', resAmbiguous.message)
  console.log('STATE MUTATION:', resAmbiguous.completed ? 'MUTATED (PASS)' : 'NONE')
  await sleep(1000)

  // --- ASKING READINESS CONVERSATION ---
  console.log('\n--- ASKING READINESS CONVERSATION ---')
  const readinessState = await service.createImplementation({ courseId: course.id })
  const inputReadiness = 'esto ya cuenta o todavía no?'
  console.log('INPUT:', inputReadiness)
  const resReadiness = await service.submitEvidence(readinessState.id, { missionId: 'N01', evidence: inputReadiness }, evaluatorService)
  console.log('TYPE:', resReadiness.interactionType)
  console.log('OUTPUT:', resReadiness.message)
  console.log('STATE MUTATION:', resReadiness.completed ? 'MUTATED (PASS)' : 'NONE')

  console.log('\n=== ALL LIVE TESTS COMPLETED ===')
}

runLiveEvaluation().catch(console.error)
