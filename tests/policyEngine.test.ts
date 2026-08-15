import test from 'node:test'
import assert from 'node:assert/strict'
import { applyEvaluationPolicy } from '../src/domain/evaluationPolicy.ts'
import { course } from '../src/data/course.ts'
import type { StructuredEvidenceEvaluation, Rubric } from '../src/domain/course.ts'

const n01Rubric = course.chapters[0].missions.find((m) => m.id === 'N01')!.rubric as Rubric

// Rubric with both required and optional criteria for testing
const testRubricWithOptional: Rubric = {
  id: 'rubric-test-optional',
  version: '1.0.0',
  criteria: [
    {
      id: 'req_1',
      label: 'Criterio Obligatorio 1',
      description: 'Obligatorio',
      isRequired: true,
    },
    {
      id: 'req_2',
      label: 'Criterio Obligatorio 2',
      description: 'Obligatorio',
      isRequired: true,
    },
    {
      id: 'opt_1',
      label: 'Criterio Opcional 1',
      description: 'Opcional',
      isRequired: false,
    },
  ],
}

test('all required PASS -> PASS', () => {
  const evaluation: StructuredEvidenceEvaluation = {
    evaluationId: 'eval-1',
    submissionId: 'sub-1',
    missionId: 'N01',
    confidence: 0.95,
    recommendation: 'PASS',
    criteria: [
      { criterionId: 'c1_concrete_idea', status: 'PASS', rationale: 'Idea concreta verificada' },
      { criterionId: 'c2_target_audience', status: 'PASS', rationale: 'Audiencia delimitada' },
      { criterionId: 'c3_no_filler', status: 'PASS', rationale: 'Una sola frase concisa' },
    ],
    coachingFeedback: 'Excelente premisa.',
    evaluatedAt: new Date().toISOString(),
  }

  const result = applyEvaluationPolicy(evaluation, n01Rubric)
  assert.equal(result, 'PASS')
})

test('required NOT_MET -> REWORK', () => {
  const evaluation: StructuredEvidenceEvaluation = {
    evaluationId: 'eval-2',
    submissionId: 'sub-2',
    missionId: 'N01',
    confidence: 0.9,
    recommendation: 'REWORK',
    criteria: [
      { criterionId: 'c1_concrete_idea', status: 'PASS', rationale: 'Idea presente' },
      { criterionId: 'c2_target_audience', status: 'NOT_MET', rationale: 'Audiencia no identificable' },
      { criterionId: 'c3_no_filler', status: 'PASS', rationale: 'Conciso' },
    ],
    coachingFeedback: 'Falta definir la audiencia específica.',
    evaluatedAt: new Date().toISOString(),
  }

  const result = applyEvaluationPolicy(evaluation, n01Rubric)
  assert.equal(result, 'REWORK')
})

test('required UNVERIFIABLE -> CLARIFY', () => {
  const evaluation: StructuredEvidenceEvaluation = {
    evaluationId: 'eval-3',
    submissionId: 'sub-3',
    missionId: 'N01',
    confidence: 0.85,
    recommendation: 'CLARIFY',
    criteria: [
      { criterionId: 'c1_concrete_idea', status: 'PASS', rationale: 'Idea presente' },
      { criterionId: 'c2_target_audience', status: 'UNVERIFIABLE', rationale: 'La evidencia es ambigua sobre el segmento objetivo' },
      { criterionId: 'c3_no_filler', status: 'PASS', rationale: 'Conciso' },
    ],
    coachingFeedback: 'Aclara a qué segmento te refieres.',
    evaluatedAt: new Date().toISOString(),
  }

  const result = applyEvaluationPolicy(evaluation, n01Rubric)
  assert.equal(result, 'CLARIFY')
})

test('missing required criterion -> HUMAN_REVIEW', () => {
  const evaluation: StructuredEvidenceEvaluation = {
    evaluationId: 'eval-4',
    submissionId: 'sub-4',
    missionId: 'N01',
    confidence: 0.95,
    recommendation: 'PASS',
    criteria: [
      { criterionId: 'c1_concrete_idea', status: 'PASS', rationale: 'Idea concreta' },
      // c2_target_audience and c3_no_filler are missing from evaluation results
    ],
    coachingFeedback: 'Evaluación incompleta.',
    evaluatedAt: new Date().toISOString(),
  }

  const result = applyEvaluationPolicy(evaluation, n01Rubric)
  assert.equal(result, 'HUMAN_REVIEW')
})

test('optional NOT_MET does not block PASS', () => {
  const evaluation: StructuredEvidenceEvaluation = {
    evaluationId: 'eval-5',
    submissionId: 'sub-5',
    missionId: 'test-mission',
    confidence: 0.9,
    recommendation: 'PASS',
    criteria: [
      { criterionId: 'req_1', status: 'PASS', rationale: 'Requisito 1 satisfecho' },
      { criterionId: 'req_2', status: 'PASS', rationale: 'Requisito 2 satisfecho' },
      { criterionId: 'opt_1', status: 'NOT_MET', rationale: 'Opcional no cumplido' },
    ],
    coachingFeedback: 'Requisitos principales cumplidos.',
    evaluatedAt: new Date().toISOString(),
  }

  const result = applyEvaluationPolicy(evaluation, testRubricWithOptional)
  assert.equal(result, 'PASS')
})

test('optional UNVERIFIABLE does not block PASS', () => {
  const evaluation: StructuredEvidenceEvaluation = {
    evaluationId: 'eval-6',
    submissionId: 'sub-6',
    missionId: 'test-mission',
    confidence: 0.9,
    recommendation: 'PASS',
    criteria: [
      { criterionId: 'req_1', status: 'PASS', rationale: 'Requisito 1 satisfecho' },
      { criterionId: 'req_2', status: 'PASS', rationale: 'Requisito 2 satisfecho' },
      { criterionId: 'opt_1', status: 'UNVERIFIABLE', rationale: 'Opcional no verificable' },
    ],
    coachingFeedback: 'Requisitos principales cumplidos.',
    evaluatedAt: new Date().toISOString(),
  }

  const result = applyEvaluationPolicy(evaluation, testRubricWithOptional)
  assert.equal(result, 'PASS')
})

test('recommendation PASS + required NOT_MET must still -> REWORK (LLM does not control transition)', () => {
  const evaluation: StructuredEvidenceEvaluation = {
    evaluationId: 'eval-7',
    submissionId: 'sub-7',
    missionId: 'N01',
    confidence: 0.99,
    recommendation: 'PASS', // LLM attempts to vote PASS despite NOT_MET
    criteria: [
      { criterionId: 'c1_concrete_idea', status: 'PASS', rationale: 'Idea presente' },
      { criterionId: 'c2_target_audience', status: 'NOT_MET', rationale: 'Audiencia no identificada' },
      { criterionId: 'c3_no_filler', status: 'PASS', rationale: 'Conciso' },
    ],
    coachingFeedback: 'Recomendado pero falla un criterio requerido.',
    evaluatedAt: new Date().toISOString(),
  }

  const result = applyEvaluationPolicy(evaluation, n01Rubric)
  assert.equal(result, 'REWORK')
})
