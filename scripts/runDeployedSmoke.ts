const CLOUD_RUN_URL = process.env.DEPLOYED_URL || 'https://trazo-agentic-759796956692.us-central1.run.app'

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function runDeployedSmoke() {
  console.log('======================================================================')
  console.log('  TRAZO CLOUD RUN LIVE PRODUCTION DEPLOYMENT SMOKE (TASK-008)')
  console.log('======================================================================\n')
  console.log(`[Target Service URL] ${CLOUD_RUN_URL}\n`)

  const liveId = `trazo-live-e2e-${Date.now()}`

  // 1. HEALTH CHECK
  console.log('[1/8] Checking GET /api/v1/health...')
  const healthRes = await fetch(`${CLOUD_RUN_URL}/api/v1/health`)
  if (!healthRes.ok) throw new Error(`Health check failed with status ${healthRes.status}`)
  const healthData = (await healthRes.json()) as { status: string; timestamp: string }
  if (healthData.status !== 'ok') throw new Error(`Unexpected health payload: ${JSON.stringify(healthData)}`)
  console.log(`✔ [1/8] HEALTH CHECK PASSED: HTTP ${healthRes.status}, status="${healthData.status}"\n`)

  // 2. DEV ROUTE PRODUCTION SAFETY
  console.log('[2/8] Testing /dev-complete-mission endpoint security in production...')
  const devRouteRes = await fetch(`${CLOUD_RUN_URL}/api/v1/implementations/${liveId}/dev-complete-mission`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ missionId: 'N01' }),
  })
  if (devRouteRes.status !== 403) {
    throw new Error(`Expected 403 Forbidden for dev route, got HTTP ${devRouteRes.status}`)
  }
  const devRouteData = (await devRouteRes.json()) as { error: string }
  console.log(`✔ [2/8] DEV ROUTE SAFETY PASSED: HTTP 403 Forbidden (${devRouteData.error})\n`)

  // 3. STATIC FRONTEND SERVING & SAME-ORIGIN SPA
  console.log('[3/8] Testing static frontend delivery (GET /)...')
  const frontendRes = await fetch(`${CLOUD_RUN_URL}/`)
  if (!frontendRes.ok) throw new Error(`Frontend GET / failed with status ${frontendRes.status}`)
  const html = await frontendRes.text()
  if (!html.includes('<div id="root">') && !html.includes('id="root"')) {
    throw new Error('Frontend response does not contain root container')
  }
  console.log(`✔ [3/8] FRONTEND SERVING PASSED: HTTP ${frontendRes.status}, HTML size: ${html.length} bytes\n`)

  // 4. FRESH IMPLEMENTATION CREATION
  console.log(`[4/8] Creating fresh ImplementationState (${liveId})...`)
  const createRes = await fetch(`${CLOUD_RUN_URL}/api/v1/implementations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: liveId,
      courseId: 'creador-desde-cero',
      courseVersion: '1.0.0',
    }),
  })
  if (!createRes.ok) throw new Error(`Create implementation failed: ${createRes.status}`)
  const createdState = await createRes.json()
  console.log(`✔ [4/8] CREATE STATE PASSED: Created in Firestore (completed: [${createdState.completedMissionIds}])\n`)

  // 5. REAL GEMINI VERIFIED ACTION — BAD EVIDENCE
  console.log('[5/8] Submitting BAD evidence to Real Gemini ("Quiero enseñar a la gente a usar IA.")...')
  await delay(2000)
  const badEvidenceRes = await fetch(`${CLOUD_RUN_URL}/api/v1/implementations/${liveId}/submissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      missionId: 'N01',
      evidence: 'Quiero enseñar a la gente a usar IA.',
    }),
  })
  if (!badEvidenceRes.ok) {
    const errText = await badEvidenceRes.text()
    throw new Error(`Bad evidence submission failed with ${badEvidenceRes.status}: ${errText}`)
  }
  const badSubResult = (await badEvidenceRes.json()) as {
    completed: boolean
    policyVerdict: string
    state: { completedMissionIds: string[]; artifacts?: Record<string, unknown> }
    evaluation: { criteria: Array<{ criterionId: string; status: string; rationale: string }>; coachingFeedback: string }
  }

  console.log(`- Real Gemini Verdict: ${badSubResult.policyVerdict}`)
  console.log(`- Coaching Feedback: "${badSubResult.evaluation?.coachingFeedback}"`)
  if (badSubResult.completed || badSubResult.policyVerdict === 'PASS') {
    throw new Error(`Bad evidence should NOT result in PASS! Got: ${badSubResult.policyVerdict}`)
  }
  if (badSubResult.state.completedMissionIds.length > 0 || badSubResult.state.artifacts?.premise) {
    throw new Error('Non-PASS verdict leaked completed mission or artifact into state!')
  }
  console.log('✔ [5/8] REAL GEMINI BAD EVIDENCE PASSED: Evaluated by Real Gemini, non-PASS verdict, 0 state mutations.\n')

  // 6. REAL GEMINI VERIFIED ACTION — CORRECTED EVIDENCE
  console.log('[6/8] Submitting CORRECTED evidence to Real Gemini (with rate limit backoff)...')
  await delay(4000)
  const correctedText = 'Los consultores de software pierden 15 horas semanales en propuestas porque no estandarizan su alcance inicial.'
  const goodEvidenceRes = await fetch(`${CLOUD_RUN_URL}/api/v1/implementations/${liveId}/submissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      missionId: 'N01',
      evidence: correctedText,
    }),
  })
  if (!goodEvidenceRes.ok) {
    const errText = await goodEvidenceRes.text()
    throw new Error(`Good evidence submission failed with ${goodEvidenceRes.status}: ${errText}`)
  }
  const goodSubResult = (await goodEvidenceRes.json()) as {
    completed: boolean
    policyVerdict: string
    state: { completedMissionIds: string[]; artifacts?: Record<string, { value: { statement?: string } }> }
    evaluation: { criteria: Array<{ criterionId: string; status: string; rationale: string }>; coachingFeedback: string }
  }

  console.log(`- Real Gemini Verdict: ${goodSubResult.policyVerdict}`)
  console.log(`- Completed missions in state: [${goodSubResult.state.completedMissionIds}]`)
  console.log(`- Artifact premise generated: ${JSON.stringify(goodSubResult.state.artifacts?.premise?.value)}`)

  if (!goodSubResult.completed || goodSubResult.policyVerdict !== 'PASS') {
    throw new Error(`Corrected evidence expected PASS, got: ${goodSubResult.policyVerdict}`)
  }
  console.log('✔ [6/8] REAL GEMINI CORRECTED EVIDENCE PASSED: Real Gemini evaluated, PASS verdict, canonical premise artifact created.\n')

  // 7. COLD READ / RELOAD PERSISTENCE FROM FIRESTORE
  console.log('[7/8] Performing cold read GET /api/v1/implementations/:id to verify Firestore persistence...')
  const reloadRes = await fetch(`${CLOUD_RUN_URL}/api/v1/implementations/${liveId}`)
  if (!reloadRes.ok) throw new Error(`Reload failed: ${reloadRes.status}`)
  const reloadedState = (await reloadRes.json()) as {
    completedMissionIds: string[]
    artifacts?: Record<string, { value: { statement?: string } }>
    activeMissionId?: string
  }
  if (!reloadedState.completedMissionIds.includes('N01')) {
    throw new Error('N01 missing from completedMissionIds after reload!')
  }
  if (reloadedState.artifacts?.premise?.value?.statement !== correctedText) {
    throw new Error('Premise artifact value mismatch after reload!')
  }
  console.log(`✔ [7/8] RELOAD PERSISTENCE PASSED: State & artifact confirmed in Firestore.\n`)

  // 8. REAL GEMINI NEXT-ACTION COMPANION & START MISSION
  console.log('[8/8] Invoking Real Gemini Next-Action Companion...')
  await delay(4000)
  // Clarification query
  const nextAction1Res = await fetch(`${CLOUD_RUN_URL}/api/v1/implementations/${liveId}/next-action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
  if (!nextAction1Res.ok) {
    const errText = await nextAction1Res.text()
    throw new Error(`Next action call 1 failed with ${nextAction1Res.status}: ${errText}`)
  }
  const proposal1 = (await nextAction1Res.json()) as {
    type: string
    question?: string
    recommendedMissionId?: string
    rationale?: string
  }
  console.log(`- Step 8a (No context): Companion Proposal = ${proposal1.type}`)
  if (proposal1.type === 'ASK_CLARIFICATION') {
    console.log(`- Clarification Question: "${proposal1.question}"`)
  }

  // Answer clarification with direct intent
  console.log('- Step 8b: Providing clarification intent ("Quiero que se entienda rápido y sea muy directa")...')
  await delay(4000)
  const nextAction2Res = await fetch(`${CLOUD_RUN_URL}/api/v1/implementations/${liveId}/next-action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clarification: 'Quiero que se entienda rápido y sea muy directa.',
    }),
  })
  if (!nextAction2Res.ok) {
    const errText = await nextAction2Res.text()
    throw new Error(`Next action call 2 failed with ${nextAction2Res.status}: ${errText}`)
  }
  const proposal2 = (await nextAction2Res.json()) as {
    type: string
    missionId?: string
    rationale?: string
  }
  console.log(`- Companion Proposal 2: Type = ${proposal2.type}, Recommended = ${proposal2.missionId}`)
  console.log(`- Companion Rationale: "${proposal2.rationale}"`)

  if (proposal2.type !== 'RECOMMEND_MISSION' || !proposal2.missionId) {
    throw new Error(`Expected RECOMMEND_MISSION with missionId, got type=${proposal2.type}, missionId=${proposal2.missionId}`)
  }

  // Start recommended mission
  console.log(`- Step 8c: Explicitly starting recommended mission (${proposal2.missionId})...`)
  const startRes = await fetch(`${CLOUD_RUN_URL}/api/v1/implementations/${liveId}/start-mission`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ missionId: proposal2.missionId }),
  })
  if (!startRes.ok) throw new Error(`Start mission failed: ${startRes.status}`)
  const startedState = (await startRes.json()) as { activeMissionId?: string }
  if (startedState.activeMissionId !== proposal2.missionId) {
    throw new Error(`activeMissionId expected ${proposal2.missionId}, got ${startedState.activeMissionId}`)
  }

  // Final reload to verify activeMissionId persisted in Firestore
  const finalRes = await fetch(`${CLOUD_RUN_URL}/api/v1/implementations/${liveId}`)
  const finalState = (await finalRes.json()) as { activeMissionId?: string }
  if (finalState.activeMissionId !== proposal2.missionId) {
    throw new Error('activeMissionId did not persist across final reload!')
  }
  console.log(`✔ [8/8] NEXT-ACTION COMPANION & START MISSION PASSED: Legality validated, activeMissionId="${finalState.activeMissionId}" persisted in Firestore.\n`)

  console.log('======================================================================')
  console.log('  ALL 8 CLOUD RUN LIVE PRODUCTION CHECKS PASSED!')
  console.log('======================================================================')
}

void runDeployedSmoke()
