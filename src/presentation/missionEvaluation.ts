import type {
  MissionEvaluationState,
  ProgressState,
  SystemEvaluationError,
} from '../domain/course'

export type MissionEvaluationUxState =
  | 'editing'
  | 'ready'
  | 'evaluating'
  | 'conversation'
  | 'ambiguous'
  | 'rework'
  | 'clarify'
  | 'human_review'
  | 'verified'
  | 'system_error'

interface MissionEvaluationPresentationInput {
  evidence: string
  progressState: ProgressState
  evaluationState?: MissionEvaluationState
}

export interface MissionEvaluationPresentation {
  state: MissionEvaluationUxState
  evidenceHelp: string
  feedbackTitle?: string
  feedbackCopy?: string
  submitLabel: string
}

const systemErrorMessage =
  'No pude revisarlo ahora. Tu entrega sigue aquí y tu progreso no cambió. Inténtalo otra vez en un momento.'

export function getMissionEvaluationPresentation({
  evidence,
  progressState,
  evaluationState,
}: MissionEvaluationPresentationInput): MissionEvaluationPresentation {
  if (evaluationState?.status === 'evaluating') {
    return {
      state: 'evaluating',
      evidenceHelp: 'Estoy revisando esto.',
      feedbackTitle: 'DAME UN SEGUNDO',
      feedbackCopy: 'Estoy viendo si esto ya tiene lo que necesita.',
      submitLabel: 'Revisando...',
    }
  }

  if (evaluationState?.status === 'conversation') {
    return {
      state: 'conversation',
      evidenceHelp: 'Puedes seguir platicando, rebotar ideas o entregar tu trabajo cuando estés listo.',
      feedbackTitle: 'TRAZO',
      submitLabel: 'Enviar →',
    }
  }

  if (evaluationState?.status === 'ambiguous') {
    return {
      state: 'ambiguous',
      evidenceHelp: 'Dime si lo tomamos como entrega o seguimos explorando.',
      feedbackTitle: 'TRAZO',
      submitLabel: 'Enviar →',
    }
  }

  if (evaluationState?.status === 'system_error') {
    return {
      state: 'system_error',
      evidenceHelp: systemErrorMessage,
      feedbackTitle: 'NO PUDE REVISARLO AHORA',
      feedbackCopy: systemErrorMessage,
      submitLabel: 'Intentar de nuevo',
    }
  }

  if (progressState === 'completed' || evaluationState?.status === 'pass') {
    return {
      state: 'verified',
      evidenceHelp: 'Esto ya tiene forma. Puedes seguir construyendo.',
      feedbackTitle: 'AHORA SÍ.',
      feedbackCopy: 'Ya queda claro qué quieres decir y para quién. Esto sí nos sirve para lo que sigue.',
      submitLabel: 'Enviar →',
    }
  }

  switch (evaluationState?.status) {
    case 'rework':
      return {
        state: 'rework',
        evidenceHelp: 'Esto sigue aquí. Le damos una vuelta y lo revisamos otra vez.',
        feedbackTitle: 'TODAVÍA NO',
        submitLabel: 'Editar y volver a verificar',
      }
    case 'clarify':
      return {
        state: 'clarify',
        evidenceHelp: 'Con esto todavía no sé por dónde seguir.',
        feedbackTitle: 'ME FALTA UNA COSA',
        submitLabel: 'Volver a verificar',
      }
    case 'human_review':
      return {
        state: 'human_review',
        evidenceHelp: 'Aquí necesito una revisión humana antes de seguir.',
        feedbackTitle: 'AQUÍ NECESITO OJOS HUMANOS',
        submitLabel: 'Volver a verificar',
      }
    default:
      break
  }

  if (evidence.trim()) {
    return {
      state: 'ready',
      evidenceHelp: 'Listo. Vamos a revisar si ya tiene forma.',
      submitLabel: 'Enviar →',
    }
  }

  return {
    state: 'editing',
    evidenceHelp: 'Escribe algo y lo vemos juntos.',
    submitLabel: 'Enviar →',
  }
}

export function normalizeSubmissionFailure(
  status?: number,
  responseCode?: unknown,
): SystemEvaluationError {
  const code =
    typeof responseCode === 'string' && /^[A-Z][A-Z0-9_]{1,63}$/.test(responseCode)
      ? responseCode
      : status
        ? `HTTP_${status}`
        : 'NETWORK_FAILURE'

  return {
    kind: 'SYSTEM_ERROR',
    userMessage: systemErrorMessage,
    debugCode: code,
  }
}

export function isSystemEvaluationError(value: unknown): value is SystemEvaluationError {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as SystemEvaluationError).kind === 'SYSTEM_ERROR'
  )
}
