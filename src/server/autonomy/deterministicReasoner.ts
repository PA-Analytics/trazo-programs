import type {
  AutonomyReasonerContext,
  AutonomyReasonerDecision,
  DeterministicReasonerMode,
  IAutonomyReasoner,
} from './types.ts'

export interface DeterministicReasonerOptions {
  mode?: DeterministicReasonerMode
  decision?: Partial<AutonomyReasonerDecision>
  errorMessage?: string
  failTimes?: number
  handler?: (context: AutonomyReasonerContext) => Promise<AutonomyReasonerDecision> | AutonomyReasonerDecision
}

export class DeterministicAutonomyReasoner implements IAutonomyReasoner {
  public callCount = 0
  public lastContext: AutonomyReasonerContext | null = null

  private mode: DeterministicReasonerMode
  private decisionOverride?: Partial<AutonomyReasonerDecision>
  private errorMessage?: string
  private remainingFailures: number
  private customHandler?: (
    context: AutonomyReasonerContext,
  ) => Promise<AutonomyReasonerDecision> | AutonomyReasonerDecision

  constructor(options: DeterministicReasonerOptions = {}) {
    this.mode = options.mode ?? 'INTERVENE'
    this.decisionOverride = options.decision
    this.errorMessage = options.errorMessage
    this.remainingFailures = options.failTimes ?? 0
    this.customHandler = options.handler
  }

  setMode(mode: DeterministicReasonerMode, options: Omit<DeterministicReasonerOptions, 'mode'> = {}): void {
    this.mode = mode
    if (options.decision !== undefined) this.decisionOverride = options.decision
    if (options.errorMessage !== undefined) this.errorMessage = options.errorMessage
    if (options.failTimes !== undefined) this.remainingFailures = options.failTimes
    if (options.handler !== undefined) this.customHandler = options.handler
  }

  setDecision(decision: Partial<AutonomyReasonerDecision>): void {
    this.decisionOverride = decision
  }

  setHandler(
    handler: (context: AutonomyReasonerContext) => Promise<AutonomyReasonerDecision> | AutonomyReasonerDecision,
  ): void {
    this.mode = 'CUSTOM'
    this.customHandler = handler
  }

  failTimes(times: number, errorMessage = '503 Service Unavailable: Provider backend failure'): void {
    this.remainingFailures = times
    this.errorMessage = errorMessage
  }

  reset(): void {
    this.callCount = 0
    this.lastContext = null
    this.mode = 'INTERVENE'
    this.decisionOverride = undefined
    this.errorMessage = undefined
    this.remainingFailures = 0
    this.customHandler = undefined
  }

  async reason(context: AutonomyReasonerContext): Promise<AutonomyReasonerDecision> {
    this.callCount++
    this.lastContext = context

    if (this.remainingFailures > 0) {
      this.remainingFailures--
      throw new Error(this.errorMessage || '503 Service Unavailable: Provider backend failure')
    }

    switch (this.mode) {
      case 'PROVIDER_FAILURE':
        throw new Error(this.errorMessage || '503 Service Unavailable: Provider backend failure')

      case 'TIMEOUT':
        throw new Error(this.errorMessage || 'Provider timeout: request exceeded deadline')

      case 'MALFORMED':
        // Returns an invalid decision object to trigger schema/policy validation failure
        return {
          decision: 'INVALID_DECISION' as unknown as 'INTERVENE',
          rationale: '',
          confidence: 999,
        }

      case 'LOW_CONFIDENCE': {
        const targetId =
          this.decisionOverride?.targetMissionId ||
          context.stalledMission?.id ||
          context.availableMissions[0]?.id

        return {
          decision: 'INTERVENE',
          rationale: this.decisionOverride?.rationale || 'Baja confianza en la causa raíz del bloqueo.',
          confidence: this.decisionOverride?.confidence ?? 0.45,
          guidanceMessage: this.decisionOverride?.guidanceMessage || 'Continúa avanzando con la misión.',
          targetMissionId: targetId,
          ...this.decisionOverride,
        }
      }

      case 'ESCALATE':
        return {
          decision: 'ESCALATE',
          rationale: this.decisionOverride?.rationale || 'Se requiere revisión de coach humano.',
          confidence: this.decisionOverride?.confidence ?? 0.95,
          escalationReason:
            this.decisionOverride?.escalationReason ||
            'Bloqueo conceptual complejo que requiere intervención humana.',
          ...this.decisionOverride,
        }

      case 'NO_OP':
        return {
          decision: 'NO_OP',
          rationale:
            this.decisionOverride?.rationale || 'El learner no requiere intervención autónoma en este momento.',
          confidence: this.decisionOverride?.confidence ?? 0.95,
          ...this.decisionOverride,
        }

      case 'CUSTOM':
        if (this.customHandler) {
          return this.customHandler(context)
        }
        break

      case 'INTERVENE':
      default: {
        const targetMissionId =
          this.decisionOverride?.targetMissionId ||
          context.stalledMission?.id ||
          context.availableMissions[0]?.id

        if (!targetMissionId && context.availableMissions.length === 0) {
          return {
            decision: 'NO_OP',
            rationale: 'No hay misiones disponibles para intervenir.',
            confidence: 0.95,
          }
        }

        return {
          decision: 'INTERVENE',
          rationale:
            this.decisionOverride?.rationale ||
            `Intervención guiada determinista para destrabar la misión ${targetMissionId}.`,
          confidence: this.decisionOverride?.confidence ?? 0.95,
          guidanceMessage:
            this.decisionOverride?.guidanceMessage ||
            `Revisa los requisitos y avanza con la misión ${targetMissionId}.`,
          targetMissionId,
          ...this.decisionOverride,
        }
      }
    }

    return {
      decision: 'NO_OP',
      rationale: 'Modo no configurado.',
      confidence: 0.95,
    }
  }
}
