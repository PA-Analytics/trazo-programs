import test from 'node:test'
import assert from 'node:assert/strict'
import * as http from 'node:http'
import { MemoryImplementationRepository, MemoryProfileRepository } from '../src/server/repository.ts'
import { ImplementationService } from '../src/server/service.ts'
import { IdentityService } from '../src/server/identityService.ts'
import { createRequestListener } from '../src/server/app.ts'
import type { ImplementationState } from '../src/domain/course.ts'

const COURSE_ID = 'primer-sistema-de-contenido'

async function request(
  server: http.Server,
  pathname: string,
  options: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
) {
  return new Promise<{ status: number; data: any }>((resolve, reject) => {
    const port = (server.address() as { port: number }).port
    const req = http.request(
      `http://localhost:${port}${pathname}`,
      {
        method: options.method ?? 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers ?? {}),
        },
      },
      (res) => {
        let body = ''
        res.on('data', (chunk) => (body += chunk))
        res.on('end', () => {
          try {
            resolve({
              status: res.statusCode ?? 0,
              data: body ? JSON.parse(body) : null,
            })
          } catch {
            resolve({
              status: res.statusCode ?? 0,
              data: body,
            })
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

test('COACH COHORT 1: getCohortOverview returns correct counts and healthy status', async () => {
  const implRepo = new MemoryImplementationRepository()
  const profileRepo = new MemoryProfileRepository()
  const service = new ImplementationService(implRepo)

  await profileRepo.save({
    userId: 'usr-student-1',
    displayName: 'Laura Gómez',
    role: 'learner',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })

  await implRepo.save({
    id: 'impl-1',
    userId: 'usr-student-1',
    coachId: 'coach-1',
    courseId: COURSE_ID,
    completedMissionIds: ['N01'],
    activeMissionId: 'N02',
    evaluationProvenance: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })

  const overview = await service.getCohortOverview('coach-1', profileRepo)
  assert.equal(overview.cohort.length, 1)
  assert.equal(overview.cohort[0].displayName, 'Laura Gómez')
  assert.equal(overview.cohort[0].completedCount, 1)
  assert.equal(overview.cohort[0].healthStatus, 'healthy')
  assert.equal(overview.metrics.totalLearners, 1)
  assert.equal(overview.metrics.stalledLearners, 0)
})

test('COACH COHORT 2: getCohortOverview identifies stalled learners with 2+ consecutive REWORKs', async () => {
  const implRepo = new MemoryImplementationRepository()
  const profileRepo = new MemoryProfileRepository()
  const service = new ImplementationService(implRepo)

  const stalledState: ImplementationState = {
    id: 'impl-stalled',
    userId: 'usr-stalled',
    coachId: 'coach-1',
    courseId: COURSE_ID,
    completedMissionIds: [],
    activeMissionId: 'N01',
    evaluationProvenance: [
      {
        id: 'prov-1',
        evaluationId: 'eval-1',
        implementationId: 'impl-stalled',
        courseId: COURSE_ID,
        missionId: 'N01',
        criteriaSetId: 'crit-1',
        criteriaVersion: '1.0.0',
        criterionResults: [],
        policyVerdict: 'REWORK',
        evidenceHash: 'hash-1',
        timestamp: new Date().toISOString(),
      },
      {
        id: 'prov-2',
        evaluationId: 'eval-2',
        implementationId: 'impl-stalled',
        courseId: COURSE_ID,
        missionId: 'N01',
        criteriaSetId: 'crit-1',
        criteriaVersion: '1.0.0',
        criterionResults: [],
        policyVerdict: 'REWORK',
        evidenceHash: 'hash-2',
        timestamp: new Date().toISOString(),
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  await implRepo.save(stalledState)

  const overview = await service.getCohortOverview('coach-1', profileRepo)
  assert.equal(overview.cohort.length, 1)
  assert.equal(overview.cohort[0].healthStatus, 'stalled')
  assert.equal(overview.cohort[0].consecutiveReworks, 2)
  assert.equal(overview.metrics.stalledLearners, 1)
})

test('COACH COHORT 3: getCohortOverview identifies pending HUMAN_REVIEW cases', async () => {
  const implRepo = new MemoryImplementationRepository()
  const profileRepo = new MemoryProfileRepository()
  const service = new ImplementationService(implRepo)

  const reviewState: ImplementationState = {
    id: 'impl-review',
    userId: 'usr-review',
    coachId: 'coach-1',
    courseId: COURSE_ID,
    completedMissionIds: ['N01'],
    activeMissionId: 'N02',
    evaluationProvenance: [
      {
        id: 'prov-1',
        evaluationId: 'eval-1',
        implementationId: 'impl-review',
        courseId: COURSE_ID,
        missionId: 'N02',
        criteriaSetId: 'crit-2',
        criteriaVersion: '1.0.0',
        criterionResults: [],
        policyVerdict: 'HUMAN_REVIEW',
        confidence: 0.62,
        evidenceHash: 'hash-1',
        timestamp: new Date().toISOString(),
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  await implRepo.save(reviewState)

  const overview = await service.getCohortOverview('coach-1', profileRepo)
  assert.equal(overview.cohort[0].healthStatus, 'human_review')
  assert.equal(overview.metrics.pendingHumanReviews, 1)
})

test('COACH COHORT 4: getLearnerEvidenceHistory returns full provenance and artifacts', async () => {
  const implRepo = new MemoryImplementationRepository()
  const service = new ImplementationService(implRepo)

  await implRepo.save({
    id: 'impl-history',
    userId: 'usr-hist',
    coachId: 'coach-1',
    courseId: COURSE_ID,
    completedMissionIds: ['N01'],
    activeMissionId: 'N02',
    artifacts: {
      'premise:statement': {
        key: 'premise:statement',
        sourceMissionId: 'N01',
        value: { statement: 'Mi propuesta única de valor' },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    },
    evaluationProvenance: [
      {
        id: 'prov-hist-1',
        evaluationId: 'eval-hist-1',
        implementationId: 'impl-history',
        courseId: COURSE_ID,
        missionId: 'N01',
        criteriaSetId: 'crit-1',
        criteriaVersion: '1.0.0',
        criterionResults: [{ criterionId: 'crit-1', status: 'PASS', rationale: 'Excelente' }],
        policyVerdict: 'PASS',
        evidenceHash: 'hash-1',
        timestamp: new Date().toISOString(),
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })

  const history = await service.getLearnerEvidenceHistory('impl-history')
  assert.equal(history.provenance.length, 1)
  assert.equal(history.provenance[0].policyVerdict, 'PASS')
  assert.ok(history.artifacts['premise:statement'])
})

test('COACH COHORT 5: HTTP /api/v1/coach/cohort requires coach role and returns data', async () => {
  const implRepo = new MemoryImplementationRepository()
  const profileRepo = new MemoryProfileRepository()
  const service = new ImplementationService(implRepo)
  const identity = new IdentityService(profileRepo, service)

  const rawCoach = await identity.createProfile({ displayName: 'Coach Maestro' })
  const coachProfile = await identity.setRole(rawCoach.userId, 'coach')

  const rawLearner = await identity.createProfile({ displayName: 'Alumno Uno' })
  const learnerProfile = await identity.setRole(rawLearner.userId, 'learner')

  await implRepo.save({
    id: learnerProfile.learnerImplementationId!,
    userId: learnerProfile.userId,
    coachId: coachProfile.userId,
    courseId: COURSE_ID,
    completedMissionIds: [],
    activeMissionId: 'N01',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })

  const server = http.createServer(createRequestListener(service, { identityService: identity }))
  await new Promise<void>((resolve) => server.listen(0, resolve))

  try {
    // 1. Calling without coach role fails with 403
    const denied = await request(server, '/api/v1/coach/cohort', {
      headers: { 'X-Trazo-User-Id': learnerProfile.userId },
    })
    assert.equal(denied.status, 403)

    // 2. Calling with coach role returns 200 with cohort
    const res = await request(server, '/api/v1/coach/cohort', {
      headers: { 'X-Trazo-User-Id': coachProfile.userId },
    })
    assert.equal(res.status, 200)
    assert.equal(res.data.cohort.length, 1)
    assert.equal(res.data.cohort[0].displayName, 'Alumno Uno')

    // 3. Inspecting learner evidence history
    const evidenceRes = await request(
      server,
      `/api/v1/coach/implementations/${encodeURIComponent(learnerProfile.learnerImplementationId!)}/evidence`,
      {
        headers: { 'X-Trazo-User-Id': coachProfile.userId },
      },
    )
    assert.equal(evidenceRes.status, 200)
    assert.ok(Array.isArray(evidenceRes.data.provenance))
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }
})
