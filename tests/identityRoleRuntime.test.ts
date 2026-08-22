import assert from 'node:assert/strict'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import test from 'node:test'
import { course } from '../src/data/course.ts'
import { CalibrationService } from '../src/server/calibrationService.ts'
import { createRequestListener } from '../src/server/app.ts'
import { IdentityService } from '../src/server/identityService.ts'
import { MemoryCalibrationRepository, MemoryImplementationRepository, MemoryProfileRepository } from '../src/server/repository.ts'
import { ImplementationService } from '../src/server/service.ts'
import { CompanionService } from '../src/server/companion/companionService.ts'
import type { INextActionProposer, NextActionContext } from '../src/server/companion/types.ts'
import type { NextActionProposal } from '../src/domain/course.ts'

class ProfileContextProposer implements INextActionProposer {
  contexts: NextActionContext[] = []

  async proposeNextAction(context: NextActionContext): Promise<NextActionProposal> {
    this.contexts.push(context)
    return {
      type: 'ASK_CLARIFICATION',
      question: `Te tengo como ${context.profile?.displayName ?? 'perfil activo'}.`,
      rationale: 'Contexto del perfil activo.',
    }
  }
}

async function request(server: http.Server, pathname: string, options: { method?: string; body?: unknown; userId?: string } = {}) {
  return new Promise<{ status: number; data: any }>((resolve, reject) => {
    const port = (server.address() as { port: number }).port
    const req = http.request(`http://localhost:${port}${pathname}`, {
      method: options.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.userId ? { 'X-Trazo-User-Id': options.userId } : {}),
      },
    }, (res) => {
      let raw = ''
      res.on('data', (chunk) => { raw += chunk })
      res.on('end', () => resolve({ status: res.statusCode ?? 500, data: raw ? JSON.parse(raw) : null }))
    })
    req.on('error', reject)
    if (options.body !== undefined) req.write(JSON.stringify(options.body))
    req.end()
  })
}

function createTestServer(companionService?: CompanionService) {
  const implementations = new MemoryImplementationRepository()
  const calibrations = new MemoryCalibrationRepository()
  const profiles = new MemoryProfileRepository()
  const service = new ImplementationService(implementations, calibrations)
  const identity = new IdentityService(profiles, service)
  const listener = createRequestListener(service, {
    identityService: identity,
    calibrationService: new CalibrationService(calibrations),
    companionService,
    enableDevRoutes: false,
  })
  return http.createServer(listener)
}

test('profile selection lists persisted summaries without exposing profile state', async () => {
  const server = createTestServer()
  await new Promise<void>((resolve) => server.listen(0, resolve))
  try {
    const pablo = await request(server, '/api/v1/profiles', { method: 'POST', body: { displayName: 'Pablo' } })
    const euge = await request(server, '/api/v1/profiles', { method: 'POST', body: { displayName: 'Euge' } })
    const listed = await request(server, '/api/v1/profiles')
    assert.equal(listed.status, 200)
    assert.deepEqual(listed.data, [
      { userId: euge.data.userId, displayName: 'Euge', role: null },
      { userId: pablo.data.userId, displayName: 'Pablo', role: null },
    ])
  } finally {
    server.close()
  }
})

test('next-action loads the active persisted profile into Companion context', async () => {
  const proposer = new ProfileContextProposer()
  const companion = new CompanionService(proposer)
  const server = createTestServer(companion)
  await new Promise<void>((resolve) => server.listen(0, resolve))
  try {
    const pablo = await request(server, '/api/v1/profiles', { method: 'POST', body: { displayName: 'Pablo' } })
    const role = await request(server, `/api/v1/profiles/${pablo.data.userId}/role`, {
      method: 'PATCH', userId: pablo.data.userId, body: { role: 'learner' },
    })
    const implementationId = role.data.learnerImplementationId as string

    const response = await request(server, `/api/v1/implementations/${implementationId}/next-action`, {
      method: 'POST',
      userId: pablo.data.userId,
      body: { clarification: '¿Cómo me llamo?' },
    })

    assert.equal(response.status, 200)
    assert.equal(proposer.contexts[0]?.profile?.displayName, 'Pablo')
    assert.equal(proposer.contexts[0]?.profile?.role, 'learner')
  } finally {
    server.close()
  }
})

test('first identity and role persist; reload does not create a second learner', async () => {
  const server = createTestServer()
  await new Promise<void>((resolve) => server.listen(0, resolve))
  try {
    const created = await request(server, '/api/v1/profiles', { method: 'POST', body: { displayName: 'Pablo' } })
    assert.equal(created.status, 201)
    assert.equal(created.data.displayName, 'Pablo')
    assert.equal(created.data.role, null)

    const role = await request(server, `/api/v1/profiles/${created.data.userId}/role`, {
      method: 'PATCH', userId: created.data.userId, body: { role: 'learner' },
    })
    assert.equal(role.status, 200)
    assert.equal(role.data.role, 'learner')
    assert.ok(role.data.learnerImplementationId)

    const reload = await request(server, `/api/v1/profiles/${created.data.userId}`)
    assert.deepEqual(reload.data, role.data)
    const implementation = await request(server, `/api/v1/implementations/${role.data.learnerImplementationId}`, { userId: created.data.userId })
    assert.equal(implementation.status, 200)
    assert.equal(implementation.data.userId, created.data.userId)

    const repeatRole = await request(server, `/api/v1/profiles/${created.data.userId}/role`, {
      method: 'PATCH', userId: created.data.userId, body: { role: 'learner' },
    })
    assert.equal(repeatRole.data.learnerImplementationId, role.data.learnerImplementationId)
  } finally {
    server.close()
  }
})

test('two identities remain isolated and learner cannot mutate coach calibration', async () => {
  const server = createTestServer()
  await new Promise<void>((resolve) => server.listen(0, resolve))
  try {
    const learner = await request(server, '/api/v1/profiles', { method: 'POST', body: { displayName: 'Learner' } })
    const coachA = await request(server, '/api/v1/profiles', { method: 'POST', body: { displayName: 'Coach A' } })
    const coachB = await request(server, '/api/v1/profiles', { method: 'POST', body: { displayName: 'Coach B' } })
    for (const profile of [learner, coachA, coachB]) {
      const role = profile === learner ? 'learner' : 'coach'
      await request(server, `/api/v1/profiles/${profile.data.userId}/role`, {
        method: 'PATCH', userId: profile.data.userId, body: { role },
      })
    }
    await request(server, `/api/v1/profiles/${coachA.data.userId}/coach-setup`, {
      method: 'PATCH', userId: coachA.data.userId,
      body: { transformationContext: 'Conseguir clientes', submissionTypes: ['text'], calibrationMode: 'own_examples' },
    })

    const learnerCalibration = await request(server, '/api/v1/calibrations/N01', {
      method: 'POST', userId: learner.data.userId, body: { initialStandard: 'No debería pasar.' },
    })
    assert.equal(learnerCalibration.status, 403)

    const calibrationA = await request(server, '/api/v1/calibrations/N01', {
      method: 'POST', userId: coachA.data.userId, body: { initialStandard: 'Debe ser específico.' },
    })
    const calibrationB = await request(server, '/api/v1/calibrations/N01', {
      method: 'POST', userId: coachB.data.userId, body: { initialStandard: 'Debe tener evidencia.' },
    })
    assert.equal(calibrationA.status, 200)
    assert.equal(calibrationB.status, 200)
    assert.notEqual(calibrationA.data.initialStandard, calibrationB.data.initialStandard)

    const crossRead = await request(server, '/api/v1/calibrations/N01', { userId: learner.data.userId })
    assert.equal(crossRead.status, 403)
  } finally {
    server.close()
  }
})

test('Google GenAI client construction remains inside canonical runtime', () => {
  const root = path.resolve(process.cwd(), 'src/server')
  const files: string[] = []
  function visit(directory: string) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name)
      if (entry.isDirectory()) visit(absolute)
      else if (entry.name.endsWith('.ts')) files.push(absolute)
    }
  }
  visit(root)
  const unauthorized = files.filter((file) => {
    if (file.endsWith(path.join('ai', 'runtime.ts'))) return false
    const source = fs.readFileSync(file, 'utf8')
    return source.includes("from '@google/genai'") || source.includes('new GoogleGenAI')
  })
  assert.deepEqual(unauthorized, [])
})

test('canonical runtime exposes explicit auth mode and stable production configuration', async () => {
  const { createCanonicalGeminiRuntime } = await import('../src/server/ai/runtime.ts')
  const runtime = createCanonicalGeminiRuntime({ client: { models: { generateContent: async () => ({ text: '{}' }) } } })
  assert.equal(runtime.authMode, 'injected-test-client')
  assert.equal(runtime.project, 'trazo-agentic-2026')
  assert.equal(runtime.location, 'global')
  assert.equal(runtime.model, 'gemini-3.7-flash')
})
