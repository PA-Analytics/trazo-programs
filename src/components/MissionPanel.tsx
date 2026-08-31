import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  EvaluationProvenanceRecord,
  ImplementationArtifact,
  Mission,
  MissionEvaluationState,
  MissionInteractionTurn,
  ProgressState,
} from '../domain/course'
import { detectFrictionRecovery } from '../domain/learner'
import { progressLabels } from '../presentation/labels'
import { getMissionEvaluationPresentation } from '../presentation/missionEvaluation'
import { CloseIcon } from './icons'

interface MissionPanelProps {
  mission: Mission
  progressState: ProgressState
  lockedReason?: string
  prerequisiteSummary?: string
  unlockSummary: string
  evidence: string
  interactionHistory: MissionInteractionTurn[]
  evaluationState?: MissionEvaluationState
  evaluationProvenance?: EvaluationProvenanceRecord[]
  artifacts?: Record<string, ImplementationArtifact>
  artifactLabels?: Record<string, string>
  onClose: () => void
  onEvidenceChange: (missionId: string, evidence: string) => void
  onSubmitEvidence: (missionId: string) => void
}

export function MissionPanel({
  mission,
  progressState,
  lockedReason,
  prerequisiteSummary,
  unlockSummary,
  evidence,
  interactionHistory,
  evaluationState,
  evaluationProvenance,
  artifacts,
  artifactLabels,
  onClose,
  onEvidenceChange,
  onSubmitEvidence,
}: MissionPanelProps) {
  const panelRef = useRef<HTMLElement>(null)
  const bodyScrollRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const completionNoteRef = useRef<HTMLParagraphElement>(null)
  const closeTimerRef = useRef<number | undefined>(undefined)
  const previousInteractionLengthRef = useRef(interactionHistory.length)
  const previousEvaluationStatusRef = useRef(evaluationState?.status)
  const previousEvaluationMessageRef = useRef(evaluationState?.message)
  const [closing, setClosing] = useState(false)
  const [dismissedInterventionId, setDismissedInterventionId] = useState<string | null>(null)
  const [interactionIntent, setInteractionIntent] = useState<'consult' | 'submit'>('submit')

  const frictionRecovery = useMemo(
    () =>
      detectFrictionRecovery(
        evaluationProvenance,
        mission,
        progressState === 'completed' ? [mission.id] : [],
      ),
    [evaluationProvenance, mission, progressState],
  )

  const isEvaluating = evaluationState?.status === 'evaluating'
  const canInteract = progressState !== 'locked'
  const hasEvidence = evidence.trim().length > 0
  const evaluationPresentation = getMissionEvaluationPresentation({
    evidence,
    progressState,
    evaluationState,
  })
  const showEvaluationFeedback =
    evaluationPresentation.state !== 'editing' && evaluationPresentation.state !== 'ready'

  const evidenceFieldId = `mission-evidence-${mission.id}`
  const evidenceCriteriaId = `mission-evidence-criteria-${mission.id}`
  const evidenceHelpId = `mission-evidence-help-${mission.id}`

  const requestClose = useCallback(() => {
    if (closing) return
    setClosing(true)
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    closeTimerRef.current = window.setTimeout(onClose, reducedMotion ? 150 : 200)
  }, [closing, onClose])

  useEffect(() => {
    closeButtonRef.current?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        requestClose()
        return
      }

      if (event.key !== 'Tab' || !panelRef.current) return
      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ),
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable.at(-1)!
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [mission.id, requestClose])

  useEffect(
    () => () => {
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current)
    },
    [],
  )

  useEffect(() => {
    if (progressState === 'completed') completionNoteRef.current?.focus()
  }, [progressState])

  useEffect(() => {
    const historyChanged = interactionHistory.length > previousInteractionLengthRef.current
    const evaluationChanged =
      evaluationState?.status !== previousEvaluationStatusRef.current ||
      evaluationState?.message !== previousEvaluationMessageRef.current

    previousInteractionLengthRef.current = interactionHistory.length
    previousEvaluationStatusRef.current = evaluationState?.status
    previousEvaluationMessageRef.current = evaluationState?.message

    if (!historyChanged && !evaluationChanged) return

    const frame = window.requestAnimationFrame(() => {
      const body = bodyScrollRef.current
      if (!body) return
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      body.scrollTo({
        top: body.scrollHeight,
        behavior: reducedMotion ? 'auto' : 'smooth',
      })
    })

    return () => window.cancelAnimationFrame(frame)
  }, [evaluationState?.message, evaluationState?.status, interactionHistory.length])

  const rubricLabelById = new Map(
    mission.rubric?.criteria.map((criterion) => [criterion.id, criterion.label]),
  )
  const consumedArtifacts = (mission.consumesArtifacts ?? [])
    .map((key) => ({ key, artifact: artifacts?.[key] }))
    .filter((entry) => Boolean(entry.artifact))
  const producedSections = (mission.artifactProductions ?? [])
    .filter((spec) => artifacts?.[spec.key] && evaluationPresentation.state === 'verified')
    .map((spec) => {
      const value = artifacts![spec.key].value as Record<string, unknown>
      const quote = typeof value[spec.build.evidenceField] === 'string'
        ? (value[spec.build.evidenceField] as string)
        : undefined
      return { key: spec.key, label: spec.displayLabel ?? 'Artefacto verificado', quote }
    })
  const historyWithoutCurrentReply = interactionHistory.filter(
    (turn, index) =>
      !(
        index === interactionHistory.length - 1 &&
        turn.role === 'companion' &&
        turn.content === evaluationState?.message
      ),
  )

  return (
    <aside
      ref={panelRef}
      id="mission-panel"
      className="mission-panel"
      data-closing={closing}
      data-node-type={mission.nodeType}
      data-progress={progressState}
      role="dialog"
      aria-modal="true"
      aria-labelledby="mission-panel-title"
      aria-describedby="mission-panel-description"
    >
      {/* 1. Cabezal Dark Mineral con botón 3D de cierre */}
      <div className="mission-panel__topline">
        <div className="mission-panel__topline-left">
          <span className="mission-panel__type">
            Misión {mission.id}
          </span>
          <span className="mission-panel__state-pill" data-progress={progressState}>
            {progressLabels[progressState]?.toUpperCase()}
          </span>
        </div>
        <button
          ref={closeButtonRef}
          type="button"
          className="mission-panel__close"
          aria-label="Cerrar panel de misión"
          disabled={closing}
          onClick={requestClose}
        >
          <CloseIcon />
        </button>
      </div>

      {/* 2. Cuerpo Dark Mineral con scroll interno */}
      <div ref={bodyScrollRef} className="mission-panel__body-scroll">
        {/* Identidad Editorial de la Misión */}
        <div className="mission-panel__hero">
          <span className="mission-panel__eyebrow">Ruta de entrenamiento · {mission.id}</span>
          <h2 id="mission-panel-title" className="mission-panel__title">
            {mission.title}
          </h2>
          <p id="mission-panel-description" className="mission-panel__lead">
            {mission.description}
          </p>
        </div>

        {/* Columna de Pasos Vertical con ADN de TRAZO */}
        <div className="mission-vertical-rail">
          {/* Paso 1: Tu punto de partida (si consume artefacto previo) */}
          {mission.consumesArtifacts && mission.consumesArtifacts.length > 0 && (
            <div className="mission-rail-step">
              <span className="mission-rail-step__num">01</span>
              <div className="mission-rail-step__content">
                <h3 className="mission-rail-step__title">Tu punto de partida</h3>
                {consumedArtifacts.length > 0 ? (
                  consumedArtifacts.map(({ key, artifact }) => {
                    const quote = artifact?.value as Record<string, unknown> | undefined
                    const statement = Object.values(quote ?? {}).find((entry) => typeof entry === 'string')
                    return (
                      <div className="mission-decision-card mission-decision-card--prior" key={key}>
                        <div className="mission-decision-card__main">
                          <strong className="mission-decision-card__title">
                            ✓ {artifactLabels?.[key] ?? 'Trabajo previo validado'}
                          </strong>
                          {typeof statement === 'string' && (
                            <blockquote className="mission-decision-card__quote">"{statement}"</blockquote>
                          )}
                        </div>
                        {artifact?.sourceMissionId && (
                          <span className="mission-decision-card__badge">
                            De {artifact.sourceMissionId}
                          </span>
                        )}
                      </div>
                    )
                  })
                ) : (
                  <div className="mission-prior-artifact__missing" role="alert">
                    <span>⚠️</span>
                    <p>Completa la misión previa para desbloquear este punto de partida.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Paso 2: Criterios a cumplir */}
          <div className="mission-rail-step">
            <span className="mission-rail-step__num">
              {mission.consumesArtifacts && mission.consumesArtifacts.length > 0 ? '02' : '01'}
            </span>
            <div className="mission-rail-step__content">
              <h3 className="mission-rail-step__title">Criterios a cumplir</h3>
              {mission.rubric?.criteria && mission.rubric.criteria.length > 0 ? (
                <div className="mission-decision-list">
                  {mission.rubric.criteria.map((crit) => (
                    <div key={crit.id} className="mission-decision-card">
                      <div className="mission-decision-card__main">
                        <strong className="mission-decision-card__title">{crit.label}</strong>
                        {crit.description && <p className="mission-decision-card__desc">{crit.description}</p>}
                      </div>
                      <span className="mission-decision-card__tag">REQUERIDO</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p id={evidenceCriteriaId} className="evidence-section__criteria">
                  {mission.evidenceCriteria}
                </p>
              )}
            </div>
          </div>

          {/* Paso 3: Al verificar / Desbloqueo (Estilo Tarjeta Activa de TRAZO) */}
          <div className="mission-rail-step mission-rail-step--unlock">
            <span className="mission-rail-step__num mission-rail-step__num--active">
              {mission.consumesArtifacts && mission.consumesArtifacts.length > 0 ? '03' : '02'}
            </span>
            <div className="mission-rail-step__content">
              <h3 className="mission-rail-step__title">Al verificar</h3>
              <div className="mission-unlock-active-card">
                <div className="mission-unlock-active-card__body">
                  <span className="mission-unlock-active-card__eyebrow">RUTA DESBLOQUEADA</span>
                  <strong className="mission-unlock-active-card__target">
                    {unlockSummary || prerequisiteSummary || 'Siguiente camino en el mapa'}
                  </strong>
                </div>
                <span className="mission-unlock-active-card__cta" aria-hidden="true">
                  CONTINUAR →
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Historial de conversación reciente con Trazz */}
        {historyWithoutCurrentReply.length > 0 && (
          <div className="mission-dialog-history">
            <h3 className="mission-dialog-history__title">Diálogo con Trazz</h3>
            <ol className="mission-conversation" aria-label="Conversación reciente" aria-live="polite">
              {historyWithoutCurrentReply.map((turn, index) => (
                <li key={`${turn.role}-${index}`} data-role={turn.role}>
                  <span>{turn.role === 'learner' ? 'Tú' : 'TRAZZ'}</span>
                  <p>{turn.content}</p>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Feedback y Evaluación de Trazz */}
        {evaluationState && showEvaluationFeedback && (
          <section
            className="companion-feedback-section"
            data-status={evaluationPresentation.state}
            aria-labelledby="companion-feedback-heading"
            aria-live="polite"
          >
            <div className="companion-feedback-header">
              <span className="companion-feedback-icon" aria-hidden="true">
                {evaluationPresentation.state === 'evaluating'
                  ? '…'
                  : evaluationPresentation.state === 'verified'
                    ? '✓'
                    : evaluationPresentation.state === 'conversation'
                      ? ''
                      : evaluationPresentation.state === 'ambiguous'
                        ? '?'
                        : evaluationPresentation.state === 'clarify'
                          ? '?'
                          : evaluationPresentation.state === 'rework'
                            ? '↺'
                            : '!'}
              </span>
              <h3 id="companion-feedback-heading">
                {evaluationPresentation.feedbackTitle === 'TRAZO'
                  ? 'TRAZZ'
                  : evaluationPresentation.feedbackTitle}
              </h3>
            </div>

            <div className="companion-feedback-body">
              {(evaluationState.message || evaluationState.evaluation?.coachingFeedback) ? (
                <p className="companion-feedback-summary">
                  {evaluationState.message || evaluationState.evaluation?.coachingFeedback}
                </p>
              ) : evaluationPresentation.feedbackCopy ? (
                <p
                  className={
                    evaluationPresentation.state === 'system_error'
                      ? 'companion-feedback-error'
                      : 'companion-feedback-evaluating'
                  }
                >
                  {evaluationPresentation.feedbackCopy}
                </p>
              ) : null}

              {evaluationPresentation.state === 'verified' && (
                <p className="companion-feedback-next-step">
                  ¡Excelente! Se abrió el siguiente camino en el mapa.
                </p>
              )}

              {evaluationPresentation.state !== 'evaluating' &&
                evaluationPresentation.state !== 'conversation' &&
                evaluationPresentation.state !== 'ambiguous' &&
                (evaluationState.evaluation?.criteria?.length ?? 0) > 0 && (
                  <details className="companion-feedback-details">
                    <summary>Ver detalle de criterios</summary>
                    <ul>
                      {evaluationState.evaluation!.criteria.map((criterion) => (
                        <li key={criterion.criterionId}>
                          <strong>{rubricLabelById.get(criterion.criterionId) ?? 'Criterio'}:</strong>{' '}
                          {criterion.rationale}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
            </div>
          </section>
        )}

        {/* Recuperación ante fricción / intentos reiterados */}
        {frictionRecovery && dismissedInterventionId !== frictionRecovery.interventionId && (
          <section
            className="mission-friction-recovery"
            aria-labelledby="friction-recovery-heading"
            data-rework-count={frictionRecovery.reworkCount}
          >
            <div className="friction-recovery__header">
              <span className="friction-recovery__badge">Consejo de Trazz</span>
              <h3 id="friction-recovery-heading">Sugerencia para avanzar</h3>
            </div>
            <div className="friction-recovery__body">
              {frictionRecovery.targetCriterion ? (
                <>
                  <p className="friction-recovery__lead">
                    Enfoquémonos en este punto clave:
                  </p>
                  <div className="friction-recovery__criterion">
                    <strong>{frictionRecovery.targetCriterion.label}</strong>
                    <p>{frictionRecovery.targetCriterion.description}</p>
                    {frictionRecovery.targetCriterion.lastRationale && (
                      <small className="friction-recovery__rationale">
                        Observación: {frictionRecovery.targetCriterion.lastRationale}
                      </small>
                    )}
                  </div>
                </>
              ) : (
                <p className="friction-recovery__lead">
                  Revisa los puntos anteriores antes de enviar tu siguiente intento.
                </p>
              )}
            </div>
            <div className="friction-recovery__actions">
              <button
                type="button"
                className="friction-recovery__retry"
                onClick={() => {
                  const el = document.getElementById(evidenceFieldId)
                  el?.focus()
                }}
              >
                Ajustar mi texto
              </button>
              <button
                type="button"
                className="friction-recovery__dismiss"
                onClick={() => setDismissedInterventionId(frictionRecovery.interventionId)}
              >
                Entendido
              </button>
            </div>
          </section>
        )}

        {/* Artefactos guardados al completar */}
        {producedSections.length > 0 && (
          <section
            className="mission-prior-artifact mission-produced-artifact"
            aria-labelledby="produced-artifact-heading"
          >
            <h3 id="produced-artifact-heading">Progreso guardado</h3>
            <p>Tu trabajo validado para los siguientes pasos:</p>
            {producedSections.map((section) => (
              <div key={section.key}>
                <strong>{section.label}</strong>
                {section.quote && (
                  <blockquote className="mission-prior-artifact__quote">"{section.quote}"</blockquote>
                )}
              </div>
            ))}
          </section>
        )}
      </div>

      {/* 3. Sticky Action Dock Fijo en la Base */}
      <footer className="mission-panel__action-dock">
        {canInteract && (
          <>
            {/* Selector de Intención */}
            <div className="mission-intent-selector" role="radiogroup" aria-label="Modo de interacción">
              <button
                type="button"
                role="radio"
                aria-checked={interactionIntent === 'consult'}
                className={`mission-intent-selector__btn ${interactionIntent === 'consult' ? 'is-active' : ''}`}
                onClick={() => setInteractionIntent('consult')}
              >
                Pedir consejo
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={interactionIntent === 'submit'}
                className={`mission-intent-selector__btn ${interactionIntent === 'submit' ? 'is-active' : ''}`}
                onClick={() => setInteractionIntent('submit')}
              >
                Entregar ejercicio ●
              </button>
            </div>

            {/* Input de redacción */}
            {mission.evidenceType === 'url' ? (
              <input
                id={evidenceFieldId}
                className="evidence-field"
                type="url"
                inputMode="url"
                autoComplete="url"
                placeholder="https://"
                value={evidence}
                readOnly={isEvaluating}
                aria-describedby={`${evidenceCriteriaId} ${evidenceHelpId}`}
                onChange={(event) => onEvidenceChange(mission.id, event.target.value)}
              />
            ) : (
              <textarea
                id={evidenceFieldId}
                className="evidence-field evidence-field--text"
                rows={3}
                placeholder={
                  interactionIntent === 'submit'
                    ? 'Escribe tu entrega aquí para contrastarla con los criterios...'
                    : 'Formula tu duda o comparte un borrador preliminar con Trazz...'
                }
                value={evidence}
                readOnly={isEvaluating}
                aria-describedby={`${evidenceCriteriaId} ${evidenceHelpId}`}
                onChange={(event) => onEvidenceChange(mission.id, event.target.value)}
              />
            )}

            <p
              id={evidenceHelpId}
              className="evidence-section__help"
              data-evaluation-state={evaluationPresentation.state}
            >
              {evaluationPresentation.evidenceHelp}
            </p>
          </>
        )}

        {progressState === 'locked' && (
          <div className="locked-explanation" role="status">
            <span className="locked-explanation__mark" aria-hidden="true" />
            <div>
              <strong>Misión bloqueada por ahora</strong>
              <p>{lockedReason || 'Completa los pasos anteriores para desbloquear este reto.'}</p>
            </div>
          </div>
        )}

        {progressState === 'completed' && (
          <p
            ref={completionNoteRef}
            className="mission-complete-note"
            role="status"
            tabIndex={0}
          >
            <span aria-hidden="true">✓</span> Ejercicio completado y validado
          </p>
        )}

        {canInteract && (
          <button
            type="button"
            className="submit-evidence-button"
            disabled={!hasEvidence || isEvaluating}
            aria-describedby={evidenceHelpId}
            onClick={() => onSubmitEvidence(mission.id)}
          >
            <span>
              {isEvaluating
                ? 'Revisando con Trazz...'
                : interactionIntent === 'consult'
                  ? 'Preguntar a Trazz'
                  : evaluationPresentation.submitLabel.includes('verificar') || evaluationPresentation.submitLabel.includes('Revisar')
                    ? evaluationPresentation.submitLabel
                    : 'Revisar con Trazz'}
            </span>
            <span className="submit-evidence-button__mark" aria-hidden="true">
              {isEvaluating ? '⏳' : '→'}
            </span>
          </button>
        )}
      </footer>
    </aside>
  )
}
