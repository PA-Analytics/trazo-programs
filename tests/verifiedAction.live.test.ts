import test from 'node:test'
import assert from 'node:assert/strict'
import * as http from 'node:http'
import { createRequestListener } from '../src/server/app.ts'
import { MemoryImplementationRepository } from '../src/server/repository.ts'
import { ImplementationService } from '../src/server/service.ts'
import { GeminiEvidenceInterpreter } from '../src/server/evaluator/geminiInterpreter.ts'
import { EvidenceEvaluatorService } from '../src/server/evaluator/evaluatorService.ts'
import { course } from '../src/data/course.ts'
import { deriveMissionProgress } from '../src/domain/progression.ts'
import type { ImplementationState } from '../src/domain/course.ts'
import type { SubmissionResponseDTO } from '../src/server/types.ts'
import { n01Fixtures } from './fixtures/n01Fixtures.ts'

const runLive = process.env.RUN_LIVE_GEMINI === 'true' && (Boolean(process.env.GEMINI_API_KEY) || Boolean(process.env.GOOGLE_CLOUD_PROJECT))

test('Live E2E: Real Gemini Verified Action submission loop', { skip: !runLive }, async () => {
  const repository = new MemoryImplementationRepository()
  const service = new ImplementationService(repository)
  const interpreter = new GeminiEvidenceInterpreter()
  const evaluatorService = new EvidenceEvaluatorService(interpreter)
  const requestListener = createRequestListener(service, { evaluatorService })
  const server = http.createServer(requestListener)

  await new Promise<void>((resolve) => server.listen(0, resolve))

  try {
    const port = (server.address() as { port: number }).port

    // 1. Create fresh implementation
    const createRes = await fetch(`http://localhost:${port}/api/v1/implementations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseId: course.id }),
    })
    assert.equal(createRes.status, 201)
    const impl: ImplementationState = await createRes.json()
    assert.deepEqual(impl.completedMissionIds, [])

    // 2. Submit Real Bad Evidence -> REWORK -> No state mutation
    const attempt1Res = await fetch(`http://localhost:${port}/api/v1/implementations/${impl.id}/submissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        missionId: 'N01',
        evidence: { type: 'text', text: n01Fixtures.broadNoAudience.evidence },
      }),
    })
    assert.equal(attempt1Res.status, 200)
    const attempt1Data: SubmissionResponseDTO = await attempt1Res.json()
    assert.notEqual(attempt1Data.policyVerdict, 'PASS')
    assert.equal(attempt1Data.completed, false)
    assert.deepEqual(attempt1Data.state.completedMissionIds, [])

    // 3. Submit Real Corrected Evidence -> PASS -> N01 completed and persisted
    const attempt2Res = await fetch(`http://localhost:${port}/api/v1/implementations/${impl.id}/submissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        missionId: 'N01',
        evidence: { type: 'text', text: n01Fixtures.validPremise.evidence },
      }),
    })
    assert.equal(attempt2Res.status, 200)
    const attempt2Data: SubmissionResponseDTO = await attempt2Res.json()
    assert.equal(attempt2Data.policyVerdict, 'PASS')
    assert.equal(attempt2Data.completed, true)
    assert.deepEqual(attempt2Data.state.completedMissionIds, ['N01'])

    // Verify progression math
    const progress = deriveMissionProgress(course.chapters[0].missions, new Set(attempt2Data.state.completedMissionIds))
    assert.equal(progress['N01'], 'completed')
    assert.equal(progress['N02'], 'available')
    assert.equal(progress['N03'], 'available')

    // 4. Verify persistence via GET reload
    const reloadRes = await fetch(`http://localhost:${port}/api/v1/implementations/${impl.id}`)
    assert.equal(reloadRes.status, 200)
    const reloaded: ImplementationState = await reloadRes.json()
    assert.deepEqual(reloaded.completedMissionIds, ['N01'])
  } finally {
    server.close()
  }
})
