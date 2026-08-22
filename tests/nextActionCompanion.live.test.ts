import test from 'node:test'
import assert from 'node:assert/strict'
import * as http from 'node:http'
import { createRequestListener } from '../src/server/app.ts'
import { MemoryImplementationRepository } from '../src/server/repository.ts'
import { ImplementationService } from '../src/server/service.ts'
import { CompanionService } from '../src/server/companion/companionService.ts'
import { GeminiNextActionProposer } from '../src/server/companion/geminiProposer.ts'
import { course } from '../src/data/course.ts'
import type { ImplementationState, NextActionProposal } from '../src/domain/course.ts'

const runLive = process.env.RUN_LIVE_GEMINI === 'true' && (Boolean(process.env.GEMINI_API_KEY) || Boolean(process.env.GOOGLE_CLOUD_PROJECT))

test('Live Gemini Next Action Diagnostic', { skip: !runLive }, async () => {
  const repository = new MemoryImplementationRepository()
  const service = new ImplementationService(repository)
  const proposer = new GeminiNextActionProposer()
  const companionService = new CompanionService(proposer)
  const requestListener = createRequestListener(service, { companionService })
  const server = http.createServer(requestListener)

  await new Promise<void>((resolve) => server.listen(0, resolve))

  try {
    const port = (server.address() as { port: number }).port

    // Setup state where N01 is completed
    const state: ImplementationState = {
      id: 'impl-live-next-action',
      courseId: course.id,
      completedMissionIds: ['N01'],
      artifacts: {
        premise: {
          key: 'premise',
          sourceMissionId: 'N01',
          value: {
            statement: 'Los consultores de software pierden 15 horas semanales en propuestas porque no estandarizan su alcance inicial.',
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    await repository.save(state)

    // Case 1: No clarification provided -> Should ask clarification
    const res1 = await fetch(`http://localhost:${port}/api/v1/implementations/${state.id}/next-action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    assert.equal(res1.status, 200)
    const prop1: NextActionProposal = await res1.json()
    console.log('Live Case 1 (No context):', prop1)
    assert.equal(prop1.type, 'ASK_CLARIFICATION')

    // Case 2: Direct preference provided -> Should recommend N02
    const res2 = await fetch(`http://localhost:${port}/api/v1/implementations/${state.id}/next-action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clarification: 'Quiero un post directo, rápido y sin rodeos' }),
    })
    assert.equal(res2.status, 200)
    const prop2: NextActionProposal = await res2.json()
    console.log('Live Case 2 (Direct preference):', prop2)
    assert.equal(prop2.type, 'RECOMMEND_MISSION')
    if (prop2.type === 'RECOMMEND_MISSION') {
      assert.equal(prop2.missionId, 'N02')
    }

    // Case 3: Narrative preference provided -> Should recommend N03
    const res3 = await fetch(`http://localhost:${port}/api/v1/implementations/${state.id}/next-action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clarification: 'Quiero contar una historia con conflicto, tensión y moraleja' }),
    })
    assert.equal(res3.status, 200)
    const prop3: NextActionProposal = await res3.json()
    console.log('Live Case 3 (Narrative preference):', prop3)
    assert.equal(prop3.type, 'RECOMMEND_MISSION')
    if (prop3.type === 'RECOMMEND_MISSION') {
      assert.equal(prop3.missionId, 'N03')
    }
  } finally {
    server.close()
  }
})
