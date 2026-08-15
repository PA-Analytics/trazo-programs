import test from 'node:test'
import assert from 'node:assert/strict'
import { GeminiEvidenceInterpreter } from '../src/server/evaluator/geminiInterpreter.ts'
import { EvidenceEvaluatorService } from '../src/server/evaluator/evaluatorService.ts'
import { n01Fixtures } from './fixtures/n01Fixtures.ts'

const runLive = process.env.RUN_LIVE_GEMINI === 'true' && Boolean(process.env.GEMINI_API_KEY)

test('Live Gemini Diagnostic Evaluation on N01 Fixtures', { skip: !runLive }, async () => {
  console.log('\n=== RUNNING LIVE GEMINI DIAGNOSTIC TEST (N01) ===\n')

  const interpreter = new GeminiEvidenceInterpreter()
  const evaluatorService = new EvidenceEvaluatorService(interpreter)

  const fixtures = [
    { key: 'A. emptyOrUseless', fixture: n01Fixtures.emptyOrUseless, expectedNotPass: true },
    { key: 'B. broadNoAudience', fixture: n01Fixtures.broadNoAudience, expectedNotPass: true },
    { key: 'C. validPremise', fixture: n01Fixtures.validPremise, expectedPass: true },
    { key: 'D. verboseFiller', fixture: n01Fixtures.verboseFiller, expectedNotPass: true },
    { key: 'E. promptInjection', fixture: n01Fixtures.promptInjection, expectedNotPass: true },
    { key: 'F. unverifiableAmbiguous', fixture: n01Fixtures.unverifiableAmbiguous, expectedNotPass: true },
  ]

  for (const { key, fixture, expectedNotPass, expectedPass } of fixtures) {
    console.log(`--- Evaluating Fixture: ${key} ---`)
    console.log(`Evidence: "${fixture.evidence}"`)

    const result = await evaluatorService.evaluateEvidence({
      missionId: 'N01',
      evidence: fixture.evidence,
    })

    console.log(`Policy Verdict: ${result.policyVerdict}`)
    console.log(`Coaching Feedback: "${result.evaluation.coachingFeedback}"`)
    console.log('Criteria Details:', JSON.stringify(result.evaluation.criteria, null, 2))
    console.log('--------------------------------------------------\n')

    if (expectedPass) {
      assert.equal(
        result.policyVerdict,
        'PASS',
        `Expected ${key} to PASS but got ${result.policyVerdict}`,
      )
    }

    if (expectedNotPass) {
      assert.notEqual(
        result.policyVerdict,
        'PASS',
        `Expected ${key} to NOT PASS but got PASS`,
      )
    }
  }
})
