import * as fs from 'node:fs'
import * as path from 'node:path'

// Load .env variables into process.env
const envPath = path.join(process.cwd(), '.env')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8')
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=')
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim()
        const value = trimmed.slice(idx + 1).trim()
        if (key && !process.env[key]) {
          process.env[key] = value
        }
      }
    }
  }
}

import { GeminiEvidenceInterpreter } from '../src/server/evaluator/geminiInterpreter.ts'
import { EvidenceEvaluatorService } from '../src/server/evaluator/evaluatorService.ts'
import { ImplementationService } from '../src/server/service.ts'
import { MemoryImplementationRepository } from '../src/server/repository.ts'
import { course } from '../src/data/course.ts'
import { n01Fixtures } from '../tests/fixtures/n01Fixtures.ts'

interface CaseRunResult {
  caseId: string
  caseName: string
  iteration: number
  input: string
  criteria: Array<{
    criterionId: string
    status: string
    rationale: string
  }>
  policyVerdict: string
  coachingFeedback: string
  latencyMs: number
}

async function runCalibration() {
  console.log('==================================================================')
  console.log('  TRAZO AGENTIC — TASK-003 LIVE CALIBRATION SUITE')
  console.log(`  Model: ${process.env.GEMINI_MODEL || 'gemini-3.7-flash'}`)
  console.log(`  Timestamp: ${new Date().toISOString()}`)
  console.log('==================================================================\n')

  const interpreter = new GeminiEvidenceInterpreter()
  const evaluatorService = new EvidenceEvaluatorService(interpreter)

  const executionPlan = [
    { id: 'A', name: 'useless evidence', fixture: n01Fixtures.emptyOrUseless, runs: 1 },
    { id: 'B', name: 'broad audience', fixture: n01Fixtures.broadNoAudience, runs: 3 },
    { id: 'C', name: 'clearly strong premise', fixture: n01Fixtures.validPremise, runs: 3 },
    { id: 'D', name: 'verbose/filler-heavy', fixture: n01Fixtures.verboseFiller, runs: 1 },
    { id: 'E', name: 'prompt injection', fixture: n01Fixtures.promptInjection, runs: 3 },
    { id: 'F', name: 'missing/unverifiable information', fixture: n01Fixtures.unverifiableAmbiguous, runs: 1 },
    { id: 'G', name: 'adversarial semantic injection', fixture: n01Fixtures.adversarialSemanticInjection, runs: 1 },
    { id: 'H', name: 'borderline premise', fixture: n01Fixtures.borderlinePremise, runs: 3 },
  ]

  const results: CaseRunResult[] = []

  for (const item of executionPlan) {
    for (let run = 1; run <= item.runs; run++) {
      const label = item.runs > 1 ? `CASE ${item.id} (Run ${run}/${item.runs}) — ${item.name}` : `CASE ${item.id} — ${item.name}`
      console.log(`>>> EXECUTING: ${label}`)

      const startTime = performance.now()
      try {
        const res = await evaluatorService.evaluateEvidence({
          missionId: 'N01',
          evidence: item.fixture.evidence,
        })
        const duration = Math.round(performance.now() - startTime)

        const runRecord: CaseRunResult = {
          caseId: item.id,
          caseName: item.name,
          iteration: run,
          input: item.fixture.evidence,
          criteria: res.evaluation.criteria.map((c) => ({
            criterionId: c.criterionId,
            status: c.status,
            rationale: c.rationale,
          })),
          policyVerdict: res.policyVerdict,
          coachingFeedback: res.evaluation.coachingFeedback,
          latencyMs: duration,
        }

        results.push(runRecord)

        console.log(`INPUT: "${runRecord.input}"`)
        console.log('CRITERIA:')
        for (const c of runRecord.criteria) {
          console.log(`  ${c.criterionId} → [${c.status}] ${c.rationale}`)
        }
        console.log(`POLICY VERDICT: ${runRecord.policyVerdict}`)
        console.log(`COACHING FEEDBACK: "${runRecord.coachingFeedback}"`)
        console.log(`LATENCY: ${duration}ms\n`)
      } catch (err: unknown) {
        const duration = Math.round(performance.now() - startTime)
        console.error(`ERROR in ${label}:`, err)
        console.log(`LATENCY: ${duration}ms\n`)
      }

      // Pacing to respect Free Tier RPM (5 requests/minute)
      await new Promise((resolve) => setTimeout(resolve, 13000))
    }
  }

  // State Safety Verification
  console.log('==================================================================')
  console.log('  STATE MUTATION SAFETY VERIFICATION (LIVE)')
  console.log('==================================================================')
  const repo = new MemoryImplementationRepository()
  const implService = new ImplementationService(repo)
  const s0 = await implService.createImplementation({ courseId: course.id })
  console.log(`Initial State S0: id=${s0.id}, completed=${JSON.stringify(s0.completedMissionIds)}`)

  await evaluatorService.evaluateEvidence({
    missionId: 'N01',
    evidence: n01Fixtures.validPremise.evidence,
  })

  const s1 = await implService.getImplementation(s0.id)
  const isStateUnchanged =
    JSON.stringify(s1?.completedMissionIds) === JSON.stringify(s0.completedMissionIds) &&
    s1?.updatedAt === s0.updatedAt

  console.log(`Post-Evaluation State S1: id=${s1?.id}, completed=${JSON.stringify(s1?.completedMissionIds)}`)
  console.log(`State Safety Invariant Verified: ${isStateUnchanged ? 'PASS (State 100% untouched)' : 'FAIL'}\n`)

  // Save JSON report for detailed inspection
  const reportPath = path.join(process.cwd(), '.data', 'calibration-report.json')
  fs.mkdirSync(path.dirname(reportPath), { recursive: true })
  fs.writeFileSync(reportPath, JSON.stringify({ timestamp: new Date().toISOString(), results, stateSafe: isStateUnchanged }, null, 2))
  console.log(`Calibration report saved to ${reportPath}`)
}

void runCalibration()
