import assert from 'node:assert/strict'
import test from 'node:test'
import type { MissionEvaluationState } from '../src/domain/course.ts'
import {
  getMissionEvaluationPresentation,
  normalizeSubmissionFailure,
} from '../src/presentation/missionEvaluation.ts'

function presentation(evidence: string, evaluationState?: MissionEvaluationState) {
  return getMissionEvaluationPresentation({
    evidence,
    progressState: 'available',
    evaluationState,
  })
}

test('A. Mission evaluation UX distinguishes EDITING and READY evidence states', () => {
  assert.equal(presentation('   ').state, 'editing')
  assert.equal(presentation('Una premisa concreta para consultores.').state, 'ready')
  assert.equal(presentation('Una premisa concreta para consultores.').evidenceHelp, 'Listo. Vamos a revisar si ya tiene forma.')
})

test('B. Mission evaluation UX exposes EVALUATING without clearing evidence', () => {
  const evidence = 'Una premisa concreta para consultores independientes.'
  const state = presentation(evidence, { status: 'evaluating' })

  assert.equal(state.state, 'evaluating')
  assert.equal(state.feedbackTitle, 'DAME UN SEGUNDO')
  assert.equal(evidence, 'Una premisa concreta para consultores independientes.')
})

test('C. Mission evaluation UX keeps REWORK and CLARIFY separate from system failures', () => {
  const rework = presentation('evidencia', {
    status: 'rework',
    evaluation: { criteria: [], coachingFeedback: 'Especifica a quién ayudas.' },
  })
  const clarify = presentation('evidencia', {
    status: 'clarify',
    evaluation: { criteria: [], coachingFeedback: 'Aclara el público objetivo.' },
  })

  assert.equal(rework.state, 'rework')
  assert.equal(rework.feedbackTitle, 'TODAVÍA NO')
  assert.equal(clarify.state, 'clarify')
  assert.equal(clarify.feedbackTitle, 'ME FALTA UNA COSA')
})

test('D. Mission evaluation UX maps PASS to VERIFIED and retains HUMAN_REVIEW as a learner outcome', () => {
  assert.equal(presentation('evidencia', { status: 'pass' }).state, 'verified')
  assert.equal(presentation('evidencia', { status: 'human_review' }).state, 'human_review')
})

test('D2. A conversation remains visible after a mission is already completed', () => {
  const state = getMissionEvaluationPresentation({
    evidence: '',
    progressState: 'completed',
    evaluationState: {
      status: 'conversation',
      message: 'Sí, ya cuenta. Ahora podemos ver lo que sigue.',
    },
  })

  assert.equal(state.state, 'conversation')
  assert.equal(state.feedbackTitle, 'TRAZO')
})

test('E. SYSTEM_ERROR is sanitized, retryable, and never presented as verified', () => {
  const error = normalizeSubmissionFailure(503, 'VERTEX_AUTHENTICATION_FAILED')
  const state = presentation('skibidi toilet', { status: 'system_error', systemError: error })

  assert.equal(state.state, 'system_error')
  assert.equal(state.feedbackTitle, 'NO PUDE REVISARLO AHORA')
  assert.equal(state.submitLabel, 'Intentar de nuevo')
  assert.doesNotMatch(error.userMessage, /invalid_grant|oauth|json|reauth/i)
  assert.equal(error.debugCode, 'VERTEX_AUTHENTICATION_FAILED')
})

test('F. Unknown server bodies cannot leak into SYSTEM_ERROR details', () => {
  const error = normalizeSubmissionFailure(500, '{"error":"invalid_grant","stack":"secret"}')

  assert.equal(error.debugCode, 'HTTP_500')
  assert.doesNotMatch(JSON.stringify(error), /invalid_grant|secret/i)
})
