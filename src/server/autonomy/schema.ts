import type { AutonomyDecisionType, AutonomyReasonerDecision } from './types.ts'

export class AutonomyValidationError extends Error {
  constructor(message: string) {
    super(`AutonomyValidationError: ${message}`)
    this.name = 'AutonomyValidationError'
  }
}

export function validateAutonomyDecision(
  raw: unknown,
  allowedMissionIds: string[] = [],
): AutonomyReasonerDecision {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new AutonomyValidationError('Output must be a non-null object')
  }

  const obj = raw as Record<string, unknown>

  if (typeof obj.decision !== 'string' || !['INTERVENE', 'ESCALATE', 'NO_OP'].includes(obj.decision)) {
    throw new AutonomyValidationError(`Invalid decision '${String(obj.decision)}' (must be INTERVENE, ESCALATE, or NO_OP)`)
  }

  if (typeof obj.rationale !== 'string' || !obj.rationale.trim()) {
    throw new AutonomyValidationError('rationale must be a non-empty string')
  }

  if (obj.rationale.length > 1200) {
    throw new AutonomyValidationError('rationale exceeds the maximum allowed length')
  }

  if (typeof obj.confidence !== 'number' || obj.confidence < 0 || obj.confidence > 1 || Number.isNaN(obj.confidence)) {
    throw new AutonomyValidationError('confidence must be a number between 0 and 1')
  }

  const decision = obj.decision as AutonomyDecisionType
  const rationale = obj.rationale.trim()
  const confidence = obj.confidence

  let guidanceMessage: string | undefined
  if (decision === 'INTERVENE') {
    if (typeof obj.guidanceMessage !== 'string' || !obj.guidanceMessage.trim()) {
      throw new AutonomyValidationError('guidanceMessage is required for INTERVENE')
    }
    guidanceMessage = obj.guidanceMessage.trim()
    if (guidanceMessage.length > 1200 || containsUnsafeInstruction(guidanceMessage)) {
      throw new AutonomyValidationError('guidanceMessage is unsafe or exceeds the maximum allowed length')
    }
  }

  let escalationReason: string | undefined
  if (decision === 'ESCALATE') {
    if (typeof obj.escalationReason !== 'string' || !obj.escalationReason.trim()) {
      escalationReason = rationale
    } else {
      escalationReason = obj.escalationReason.trim()
    }
    if (escalationReason.length > 1200 || containsUnsafeInstruction(escalationReason)) {
      throw new AutonomyValidationError('escalationReason is unsafe or exceeds the maximum allowed length')
    }
  }

  let targetMissionId: string | undefined
  if (typeof obj.targetMissionId === 'string' && obj.targetMissionId.trim()) {
    targetMissionId = obj.targetMissionId.trim()
    if (allowedMissionIds.length > 0 && !allowedMissionIds.includes(targetMissionId)) {
      throw new AutonomyValidationError(`targetMissionId '${targetMissionId}' is not in allowed missions [${allowedMissionIds.join(', ')}]`)
    }
  }

  return {
    decision,
    rationale,
    confidence,
    guidanceMessage,
    escalationReason,
    targetMissionId,
  }
}

function containsUnsafeInstruction(value: string): boolean {
  return /ignore (?:all|previous)|system override|bypass (?:the )?prerequisite|unlock (?:the )?mission|mark .*complete/i.test(value)
}
