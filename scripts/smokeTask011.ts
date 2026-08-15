import assert from 'node:assert/strict'

const BASE_URL = 'https://trazo-agentic-759796956692.us-central1.run.app'

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function request(path: string, options: RequestInit = {}) {
  const url = `${BASE_URL}${path}`
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  const text = await res.text()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    data = text
  }
  return { status: res.status, data }
}

async function main() {
  console.log('====================================================')
  console.log('TASK-011 PRODUCTION SMOKE TEST ON CLOUD RUN')
  console.log(`Endpoint: ${BASE_URL}`)
  console.log('====================================================\n')

  // ==========================================
  // PATH 1: DIRECT STRUCTURE (N01 -> N02)
  // ==========================================
  console.log('--- TEST 1: DIRECT PATH (N01 -> Contradiction REWORK -> Corrected PASS -> N02 Artifact) ---')
  const implAId = `smoke-direct-${Date.now()}`
  const createARes = await request('/api/v1/implementations', {
    method: 'POST',
    body: JSON.stringify({ id: implAId, courseId: 'primer-sistema-de-contenido' }),
  })
  assert.equal(createARes.status, 201, 'Create Impl A failed')
  console.log(`[PASS] Session A created: ${implAId}`)

  // 1. Submit N01 Evidence
  const premiseA = 'Los desarrolladores frontend pierden tiempo implementando accesibilidad por falta de auditorías tempranas.'
  console.log(`Submitting N01 premise: "${premiseA}"`)
  const t0 = Date.now()
  const n01Res = await request(`/api/v1/implementations/${implAId}/submissions`, {
    method: 'POST',
    body: JSON.stringify({ missionId: 'N01', evidence: premiseA }),
  })
  const durN01 = Date.now() - t0
  assert.equal(n01Res.status, 200, `N01 submission failed: ${JSON.stringify(n01Res.data)}`)
  assert.equal(n01Res.data.policyVerdict, 'PASS')
  assert.equal(n01Res.data.completed, true)
  assert.ok(n01Res.data.state.artifacts?.premise)
  console.log(`[PASS] N01 Verified in ${durN01}ms. Premise artifact established.`)

  // 2. Companion Next-Action with Direct Preference
  const nextActionRes = await request(`/api/v1/implementations/${implAId}/next-action`, {
    method: 'POST',
    body: JSON.stringify({ clarification: 'Prefiero una estructura directa, paso a paso y sin vueltas.' }),
  })
  assert.equal(nextActionRes.status, 200)
  assert.equal(nextActionRes.data.type, 'RECOMMEND_MISSION')
  assert.equal(nextActionRes.data.missionId, 'N02')
  console.log(`[PASS] Companion recommended N02 (Direct Structure). Rationale: ${nextActionRes.data.rationale}`)

  // 3. Start N02
  const startN02Res = await request(`/api/v1/implementations/${implAId}/start-mission`, {
    method: 'POST',
    body: JSON.stringify({ missionId: 'N02' }),
  })
  assert.equal(startN02Res.status, 200)
  assert.equal(startN02Res.data.activeMissionId, 'N02')
  console.log('[PASS] N02 started legally.')

  // 4. Submit Contradictory N02 Evidence (changes audience from frontend developers to restaurant waiters)
  const badEvidenceN02 = 'Apertura: Los meseros de restaurante no reciben propinas justas. Desarrollo: 3 pasos para atender mesas. Cierre: Conclusión sobre propinas.'
  console.log(`Submitting contradictory N02 evidence: "${badEvidenceN02}"`)
  const tBad = Date.now()
  const badN02Res = await request(`/api/v1/implementations/${implAId}/submissions`, {
    method: 'POST',
    body: JSON.stringify({ missionId: 'N02', evidence: badEvidenceN02 }),
  })
  const durBad = Date.now() - tBad
  assert.equal(badN02Res.status, 200)
  assert.equal(badN02Res.data.policyVerdict, 'REWORK', `Expected REWORK for contradictory evidence, got ${badN02Res.data.policyVerdict}`)
  assert.equal(badN02Res.data.completed, false)
  assert.equal(badN02Res.data.state.artifacts?.direct_structure, undefined, 'direct_structure artifact must not exist on REWORK')
  console.log(`[PASS] Contradictory evidence rejected (REWORK) in ${durBad}ms. Coaching feedback: "${badN02Res.data.evaluation?.coachingFeedback}"`)

  // 5. Submit Corrected N02 Evidence aligned with verified premise
  const goodEvidenceN02 = 'Apertura: ¿Sabías que el 80% de los errores de a11y en frontend se detectan demasiado tarde? Desarrollo: 1. Agrega axe-core a tu pipeline. 2. Audita navegación por teclado en cada PR. 3. Valida contraste APCA antes de diseñar. Cierre: Comienza auditando tu flujo de registro hoy.'
  console.log(`Submitting corrected N02 evidence: "${goodEvidenceN02}"`)
  const tGood = Date.now()
  const goodN02Res = await request(`/api/v1/implementations/${implAId}/submissions`, {
    method: 'POST',
    body: JSON.stringify({ missionId: 'N02', evidence: goodEvidenceN02 }),
  })
  const durGood = Date.now() - tGood
  assert.equal(goodN02Res.status, 200)
  assert.equal(goodN02Res.data.policyVerdict, 'PASS', `Expected PASS for aligned evidence, got ${goodN02Res.data.policyVerdict}`)
  assert.equal(goodN02Res.data.completed, true)
  assert.ok(goodN02Res.data.state.completedMissionIds.includes('N02'))
  assert.ok(goodN02Res.data.state.artifacts?.direct_structure)
  assert.equal(goodN02Res.data.state.artifacts.direct_structure.value.variant, 'direct')
  console.log(`[PASS] Corrected N02 verified in ${durGood}ms. direct_structure artifact persisted:`, goodN02Res.data.state.artifacts.direct_structure.value)

  // 6. Cold Reload Verification from Firestore
  const reloadARes = await request(`/api/v1/implementations/${implAId}`)
  assert.equal(reloadARes.status, 200)
  assert.deepEqual(reloadARes.data.completedMissionIds, ['N01', 'N02'])
  assert.ok(reloadARes.data.artifacts?.premise)
  assert.ok(reloadARes.data.artifacts?.direct_structure)
  console.log('[PASS] Cold reload verified: N01 and N02 persist with both premise and direct_structure artifacts.\n')

  // ==========================================
  // PATH 2: NARRATIVE STRUCTURE (N01 -> N03)
  // ==========================================
  console.log('--- TEST 2: NARRATIVE PATH (N01 -> N03 Narrative PASS -> N03 Artifact) ---')
  const implBId = `smoke-narrative-${Date.now()}`
  const createBRes = await request('/api/v1/implementations', {
    method: 'POST',
    body: JSON.stringify({ id: implBId, courseId: 'primer-sistema-de-contenido' }),
  })
  assert.equal(createBRes.status, 201)
  console.log(`[PASS] Session B created: ${implBId}`)

  // 1. Submit N01 Premise
  const premiseB = 'Los arquitectos de software junior sufren bloqueos al diseñar sistemas distribuidos sin estimar costos de red.'
  const n01BRes = await request(`/api/v1/implementations/${implBId}/submissions`, {
    method: 'POST',
    body: JSON.stringify({ missionId: 'N01', evidence: premiseB }),
  })
  assert.equal(n01BRes.status, 200)
  assert.equal(n01BRes.data.policyVerdict, 'PASS')
  console.log(`[PASS] Session B N01 Verified.`)

  // 2. Companion with Narrative Preference
  const nextActionBRes = await request(`/api/v1/implementations/${implBId}/next-action`, {
    method: 'POST',
    body: JSON.stringify({ clarification: 'Quiero contarlo en formato de historia personal y experiencia real.' }),
  })
  assert.equal(nextActionBRes.status, 200)
  assert.equal(nextActionBRes.data.type, 'RECOMMEND_MISSION')
  assert.equal(nextActionBRes.data.missionId, 'N03')
  console.log(`[PASS] Companion recommended N03 (Narrative Structure). Rationale: ${nextActionBRes.data.rationale}`)

  // 3. Start N03
  await request(`/api/v1/implementations/${implBId}/start-mission`, {
    method: 'POST',
    body: JSON.stringify({ missionId: 'N03' }),
  })

  // 4. Submit N03 Narrative Evidence
  const narrativeEvidence = 'Situación inicial: En mi primer rol de arquitecto junior dividí una app en 15 microservicios sin calcular latencia entre zonas. Cambio/Conflicto: En el primer Black Friday la factura de transferencia de red se multiplicó por 10 y colapsó el gateway. Resolución/Aprendizaje: Aprendí a simular costos de egress antes de desacoplar y ahora mantengo servicios acoplados hasta justificar el tráfico.'
  console.log(`Submitting N03 narrative evidence: "${narrativeEvidence}"`)
  const tNarrative = Date.now()
  const n03Res = await request(`/api/v1/implementations/${implBId}/submissions`, {
    method: 'POST',
    body: JSON.stringify({ missionId: 'N03', evidence: narrativeEvidence }),
  })
  const durNarrative = Date.now() - tNarrative
  assert.equal(n03Res.status, 200)
  assert.equal(n03Res.data.policyVerdict, 'PASS', `Expected PASS, got ${n03Res.data.policyVerdict}`)
  assert.ok(n03Res.data.state.completedMissionIds.includes('N03'))
  assert.ok(n03Res.data.state.artifacts?.narrative_structure)
  assert.equal(n03Res.data.state.artifacts.narrative_structure.value.variant, 'narrative')
  console.log(`[PASS] N03 Verified in ${durNarrative}ms. narrative_structure artifact persisted:`, n03Res.data.state.artifacts.narrative_structure.value)

  // 5. Cold Reload Verification for Session B
  const reloadBRes = await request(`/api/v1/implementations/${implBId}`)
  assert.deepEqual(reloadBRes.data.completedMissionIds, ['N01', 'N03'])
  assert.ok(reloadBRes.data.artifacts?.premise)
  assert.ok(reloadBRes.data.artifacts?.narrative_structure)
  assert.equal(reloadBRes.data.artifacts?.direct_structure, undefined)
  console.log('[PASS] Cold reload verified for Session B: N01 and N03 persist with narrative_structure.\n')

  // ==========================================
  // CROSS-SESSION ISOLATION & DEV ROUTE SAFETY
  // ==========================================
  console.log('--- TEST 3: CROSS-SESSION ISOLATION & DEV ROUTE SAFETY ---')
  // Verify Session A has direct_structure only, Session B has narrative_structure only
  assert.ok(reloadARes.data.artifacts?.direct_structure)
  assert.equal(reloadARes.data.artifacts?.narrative_structure, undefined)
  assert.ok(reloadBRes.data.artifacts?.narrative_structure)
  assert.equal(reloadBRes.data.artifacts?.direct_structure, undefined)
  console.log('[PASS] Strict cross-session isolation between Session A and Session B confirmed.')

  // Verify Dev route remains forbidden (HTTP 403)
  const devRouteRes = await request(`/api/v1/implementations/${implAId}/dev-complete-mission`, {
    method: 'POST',
    body: JSON.stringify({ missionId: 'N09' }),
  })
  assert.equal(devRouteRes.status, 403, 'Dev route must return 403 in production')
  console.log('[PASS] Dev route rejected with HTTP 403 Forbidden in production.')

  console.log('\n====================================================')
  console.log('ALL TASK-011 PRODUCTION SMOKE TESTS PASSED!')
  console.log('====================================================')
}

main().catch((err) => {
  console.error('[SMOKE TEST FAILED]', err)
  process.exit(1)
})
