import test from 'node:test'
import assert from 'node:assert/strict'
import * as http from 'node:http'
import { createRequestListener } from '../src/server/app.ts'
import { MemoryImplementationRepository } from '../src/server/repository.ts'
import { ImplementationService } from '../src/server/service.ts'
import { CompanionService } from '../src/server/companion/companionService.ts'
import { course } from '../src/data/course.ts'
import type { ImplementationState, NextActionProposal } from '../src/domain/course.ts'
import type { INextActionProposer, NextActionContext } from '../src/server/companion/types.ts'

class MockProposer implements INextActionProposer {
  public responseGenerator?: (context: NextActionContext) => NextActionProposal

  async proposeNextAction(context: NextActionContext): Promise<NextActionProposal> {
    if (this.responseGenerator) {
      return this.responseGenerator(context)
    }
    throw new Error('No mock proposer configured')
  }
}

function createServer(options: {
  mockProposer?: MockProposer
  repository?: MemoryImplementationRepository
} = {}) {
  const repository = options.repository || new MemoryImplementationRepository()
  const service = new ImplementationService(repository)
  const proposer = options.mockProposer || new MockProposer()
  const companionService = new CompanionService(proposer)
  const requestListener = createRequestListener(service, { companionService, enableDevRoutes: true })
  const server = http.createServer(requestListener)
  return { server, service, repository, proposer, companionService }
}

async function request(
  server: http.Server,
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<{ status: number; data: unknown }> {
  return new Promise((resolve, reject) => {
    const port = (server.address() as { port: number }).port
    const req = http.request(
      `http://localhost:${port}${path}`,
      {
        method: options.method || 'GET',
        headers: { 'Content-Type': 'application/json' },
      },
      (res) => {
        let raw = ''
        res.on('data', (chunk) => (raw += chunk))
        res.on('end', () => {
          try {
            const data = raw ? JSON.parse(raw) : null
            resolve({ status: res.statusCode || 500, data })
          } catch {
            resolve({ status: res.statusCode || 500, data: raw })
          }
        })
      },
    )
    req.on('error', reject)
    if (options.body) {
      req.write(JSON.stringify(options.body))
    }
    req.end()
  })
}

test('A. MULTIPLE OPTIONS + NO CONTEXT: Companion asks targeted clarification', async () => {
  const proposer = new MockProposer()
  proposer.responseGenerator = (ctx) => {
    assert.deepEqual(ctx.completedMissionIds, ['N01'])
    assert.equal(ctx.availableMissions.length, 2)
    assert.ok(ctx.availableMissions.some((m) => m.id === 'N02'))
    assert.ok(ctx.availableMissions.some((m) => m.id === 'N03'))
    return {
      type: 'ASK_CLARIFICATION',
      question: '¿Para esta pieza prefieres una estructura directa y clara o una narrativa con giro?',
      rationale: 'N02 y N03 ofrecen enfoques estructurales distintos.',
    }
  }

  const { server, repository } = createServer({ mockProposer: proposer })
  await new Promise<void>((resolve) => server.listen(0, resolve))

  try {
    // Setup state with N01 completed
    const state: ImplementationState = {
      id: 'impl-branch-test',
      courseId: course.id,
      completedMissionIds: ['N01'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    await repository.save(state)

    const res = await request(server, `/api/v1/implementations/${state.id}/next-action`, {
      method: 'POST',
      body: {},
    })

    assert.equal(res.status, 200)
    const proposal = res.data as NextActionProposal
    assert.equal(proposal.type, 'ASK_CLARIFICATION')
    if (proposal.type === 'ASK_CLARIFICATION') {
      assert.ok(proposal.question.includes('directa'))
    }
  } finally {
    server.close()
  }
})

test('B. DIRECT PREFERENCE: Recommends N02 Estructura Directa based on clarification', async () => {
  const proposer = new MockProposer()
  proposer.responseGenerator = (ctx) => {
    assert.equal(ctx.clarificationAnswer, 'Quiero un post directo y conciso')
    return {
      type: 'RECOMMEND_MISSION',
      missionId: 'N02',
      rationale: 'Tu objetivo de concisión se adapta perfectamente a Estructura Directa.',
    }
  }

  const { server, repository } = createServer({ mockProposer: proposer })
  await new Promise<void>((resolve) => server.listen(0, resolve))

  try {
    const state: ImplementationState = {
      id: 'impl-direct-test',
      courseId: course.id,
      completedMissionIds: ['N01'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    await repository.save(state)

    const res = await request(server, `/api/v1/implementations/${state.id}/next-action`, {
      method: 'POST',
      body: { clarification: 'Quiero un post directo y conciso' },
    })

    assert.equal(res.status, 200)
    const proposal = res.data as NextActionProposal
    assert.equal(proposal.type, 'RECOMMEND_MISSION')
    if (proposal.type === 'RECOMMEND_MISSION') {
      assert.equal(proposal.missionId, 'N02')
    }
  } finally {
    server.close()
  }
})

test('C. NARRATIVE PREFERENCE: Recommends N03 Estructura Narrativa based on clarification', async () => {
  const proposer = new MockProposer()
  proposer.responseGenerator = (ctx) => {
    assert.equal(ctx.clarificationAnswer, 'Quiero contar una historia con conflicto y resolución')
    return {
      type: 'RECOMMEND_MISSION',
      missionId: 'N03',
      rationale: 'Estructura Narrativa desarrollará la tensión y cambio de tu premisa.',
    }
  }

  const { server, repository } = createServer({ mockProposer: proposer })
  await new Promise<void>((resolve) => server.listen(0, resolve))

  try {
    const state: ImplementationState = {
      id: 'impl-narrative-test',
      courseId: course.id,
      completedMissionIds: ['N01'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    await repository.save(state)

    const res = await request(server, `/api/v1/implementations/${state.id}/next-action`, {
      method: 'POST',
      body: { clarification: 'Quiero contar una historia con conflicto y resolución' },
    })

    assert.equal(res.status, 200)
    const proposal = res.data as NextActionProposal
    assert.equal(proposal.type, 'RECOMMEND_MISSION')
    if (proposal.type === 'RECOMMEND_MISSION') {
      assert.equal(proposal.missionId, 'N03')
    }
  } finally {
    server.close()
  }
})

test('D. ILLEGAL LLM RECOMMENDATION: Proposing locked mission (N09) is rejected by deterministic engine', async () => {
  const proposer = new MockProposer()
  proposer.responseGenerator = () => ({
    type: 'RECOMMEND_MISSION',
    missionId: 'N09', // Locked!
    rationale: 'Saltemos al final.',
  })

  const { server, repository } = createServer({ mockProposer: proposer })
  await new Promise<void>((resolve) => server.listen(0, resolve))

  try {
    const state: ImplementationState = {
      id: 'impl-illegal-test',
      courseId: course.id,
      completedMissionIds: ['N01'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    await repository.save(state)

    const res = await request(server, `/api/v1/implementations/${state.id}/next-action`, {
      method: 'POST',
      body: { clarification: 'llm intenta saltar a n09' },
    })

    assert.equal(res.status, 400)
    const body = res.data as { error: string }
    assert.match(body.error, /locked or not in the allowed available set/)

    // State must remain strictly unchanged
    const checkRes = await request(server, `/api/v1/implementations/${state.id}`)
    const currentState = checkRes.data as ImplementationState
    assert.equal(currentState.activeMissionId, undefined)
  } finally {
    server.close()
  }
})

test('E. RECOMMENDATION HAS NO SIDE EFFECT: Calling next-action endpoint leaves ImplementationState untouched', async () => {
  const proposer = new MockProposer()
  proposer.responseGenerator = () => ({
    type: 'RECOMMEND_MISSION',
    missionId: 'N02',
    rationale: 'Recomendado',
  })

  const { server, repository } = createServer({ mockProposer: proposer })
  await new Promise<void>((resolve) => server.listen(0, resolve))

  try {
    const state: ImplementationState = {
      id: 'impl-pure-test',
      courseId: course.id,
      completedMissionIds: ['N01'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    await repository.save(state)

    const nextRes = await request(server, `/api/v1/implementations/${state.id}/next-action`, {
      method: 'POST',
      body: { clarification: 'directo' },
    })
    assert.equal(nextRes.status, 200)

    // State must NOT have activeMissionId set
    const getRes = await request(server, `/api/v1/implementations/${state.id}`)
    const reloaded = getRes.data as ImplementationState
    assert.equal(reloaded.activeMissionId, undefined)
    assert.equal(reloaded.updatedAt, state.updatedAt)
  } finally {
    server.close()
  }
})

test('F. ACCEPT LEGAL RECOMMENDATION: Starting available mission persists activeMissionId', async () => {
  const { server, repository } = createServer()
  await new Promise<void>((resolve) => server.listen(0, resolve))

  try {
    const state: ImplementationState = {
      id: 'impl-start-test',
      courseId: course.id,
      completedMissionIds: ['N01'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    await repository.save(state)

    const startRes = await request(server, `/api/v1/implementations/${state.id}/start-mission`, {
      method: 'POST',
      body: { missionId: 'N02' },
    })

    assert.equal(startRes.status, 200)
    const updated = startRes.data as ImplementationState
    assert.equal(updated.activeMissionId, 'N02')

    // Verify persistence after reload
    const getRes = await request(server, `/api/v1/implementations/${state.id}`)
    const reloaded = getRes.data as ImplementationState
    assert.equal(reloaded.activeMissionId, 'N02')
  } finally {
    server.close()
  }
})

test('G. START LOCKED MISSION: Attempting to start locked mission (N09) is rejected', async () => {
  const { server, repository } = createServer()
  await new Promise<void>((resolve) => server.listen(0, resolve))

  try {
    const state: ImplementationState = {
      id: 'impl-start-locked-test',
      courseId: course.id,
      completedMissionIds: ['N01'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    await repository.save(state)

    const startRes = await request(server, `/api/v1/implementations/${state.id}/start-mission`, {
      method: 'POST',
      body: { missionId: 'N09' },
    })

    assert.equal(startRes.status, 400)
    const body = startRes.data as { error: string }
    assert.match(body.error, /mission is currently locked/)

    // State unchanged
    const getRes = await request(server, `/api/v1/implementations/${state.id}`)
    const reloaded = getRes.data as ImplementationState
    assert.equal(reloaded.activeMissionId, undefined)
  } finally {
    server.close()
  }
})

test('H. TWO LEARNERS: Same methodology, different preferences yield distinct mission paths', async () => {
  const proposer = new MockProposer()
  proposer.responseGenerator = (ctx) => {
    if (ctx.clarificationAnswer?.includes('directo')) {
      return {
        type: 'RECOMMEND_MISSION',
        missionId: 'N02',
        rationale: 'Estructura directa para formato conciso.',
      }
    }
    return {
      type: 'RECOMMEND_MISSION',
      missionId: 'N03',
      rationale: 'Estructura narrativa para contar historias.',
    }
  }

  const { server, repository } = createServer({ mockProposer: proposer })
  await new Promise<void>((resolve) => server.listen(0, resolve))

  try {
    // Learner A (Direct)
    const stateA: ImplementationState = {
      id: 'impl-learner-a',
      courseId: course.id,
      completedMissionIds: ['N01'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    await repository.save(stateA)

    const resA = await request(server, `/api/v1/implementations/${stateA.id}/next-action`, {
      method: 'POST',
      body: { clarification: 'formato directo' },
    })
    const propA = resA.data as NextActionProposal

    // Learner B (Storytelling)
    const stateB: ImplementationState = {
      id: 'impl-learner-b',
      courseId: course.id,
      completedMissionIds: ['N01'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    await repository.save(stateB)

    const resB = await request(server, `/api/v1/implementations/${stateB.id}/next-action`, {
      method: 'POST',
      body: { clarification: 'historia y emoción' },
    })
    const propB = resB.data as NextActionProposal

    assert.equal(propA.type, 'RECOMMEND_MISSION')
    assert.equal(propB.type, 'RECOMMEND_MISSION')
    if (propA.type === 'RECOMMEND_MISSION' && propB.type === 'RECOMMEND_MISSION') {
      assert.equal(propA.missionId, 'N02')
      assert.equal(propB.missionId, 'N03')
      assert.notEqual(propA.missionId, propB.missionId)
    }
  } finally {
    server.close()
  }
})
