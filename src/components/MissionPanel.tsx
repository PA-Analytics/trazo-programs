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
import { nodeTypeLabels, progressLabels } from '../presentation/labels'
import { getMissionEvaluationPresentation } from '../presentation/missionEvaluation'
import { CloseIcon, MissionIcon } from './icons'

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
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const completionNoteRef = useRef<HTMLParagraphElement>(null)
  const closeTimerRef = useRef<number | undefined>(undefined)
  const [closing, setClosing] = useState(false)
  const [dismissedInterventionId, setDismissedInterventionId] = useState<string | null>(null)

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
  const verificationResolved =
    progressState === 'completed' || evaluationPresentation.state === 'verified'
  const verificationStarted = showEvaluationFeedback || isEvaluating
  const actionFlowState =
    progressState === 'locked'
      ? 'blocked'
      : progressState === 'completed' || hasEvidence || verificationStarted
        ? 'complete'
        : 'active'
  const evidenceFlowState =
    progressState === 'locked'
      ? 'blocked'
      : progressState === 'completed' || verificationStarted || verificationResolved
        ? 'complete'
        : hasEvidence
          ? 'active'
          : 'pending'
  const verificationFlowState = verificationResolved
    ? 'complete'
    : verificationStarted
      ? 'active'
      : 'pending'
  const routeFlowState = verificationResolved ? 'complete' : 'pending'

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
      <div className="mission-panel__topline">
        <span className="mission-panel__type">{nodeTypeLabels[mission.nodeType]}</span>
        <button
          ref={closeButtonRef}
          type="button"
          className="mission-panel__close"
          aria-label="Cerrar detalle de misión"
          disabled={closing}
          onClick={requestClose}
        >
          <CloseIcon />
        </button>
      </div>

      <div className="mission-panel__identity">
        <span
          className={`mission-panel__icon mission-panel__icon--${mission.nodeType}`}
          data-progress={progressState}
          aria-hidden="true"
        >
          <MissionIcon state={progressState} nodeType={mission.nodeType} />
        </span>
        <div>
          <span className="mission-panel__state" data-progress={progressState}>
            {progressLabels[progressState]}
          </span>
          <h2 id="mission-panel-title">{mission.title}</h2>
        </div>
      </div>

      <p id="mission-panel-description" className="mission-panel__description">
        {mission.description}
      </p>

      <ol className="mission-flow" aria-label="Secuencia de avance de esta misión">
        {[
          ['01', 'Acción', actionFlowState],
          ['02', 'Evidencia', evidenceFlowState],
          ['03', 'Verificación', verificationFlowState],
          ['04', 'Ruta', routeFlowState],
        ].map(([number, label, state]) => (
          <li key={label} data-state={state}>
            <span aria-hidden="true">{number}</span>
            <strong>{label}</strong>
            <small>{state === 'complete' ? 'Listo' : state === 'active' ? 'Ahora' : state === 'blocked' ? 'Bloqueado' : 'Después'}</small>
          </li>
        ))}
      </ol>

      {/* Consequential Artifact Consumer Section (TASK-005 & TASK-011) */}
      {mission.consumesArtifacts && mission.consumesArtifacts.length > 0 && (
        <section className="mission-prior-artifact" aria-labelledby="prior-artifact-heading">
          <h3 id="prior-artifact-heading" className="visually-hidden">Artefacto de misión previa</h3>
          {consumedArtifacts.length > 0 ? (
            consumedArtifacts.map(({ key, artifact }) => {
              const quote = artifact?.value as Record<string, unknown> | undefined
              const statement = Object.values(quote ?? {}).find((entry) => typeof entry === 'string')
              return (
                <div className="mission-prior-artifact__card" key={key}>
                  <div className="mission-prior-artifact__header">
                    <span className="mission-prior-artifact__eyebrow">Construyes desde</span>
                    <strong className="mission-prior-artifact__verified-title">
                      <span aria-hidden="true">✓</span> {artifactLabels?.[key] ?? 'Trabajo verificado'}
                    </strong>
                    {artifact?.sourceMissionId && (
                      <span className="mission-prior-artifact__badge">
                        Trabajo verificado de {artifact.sourceMissionId}
                      </span>
                    )}
                    <strong>
                      Partimos de tu{' '}
                      {(artifactLabels?.[key] ?? 'trabajo previo').toLocaleLowerCase('es-MX')}:
                    </strong>
                  </div>
                  {typeof statement === 'string' && (
                    <blockquote className="mission-prior-artifact__quote">"{statement}"</blockquote>
                  )}
                  <p className="mission-prior-artifact__direction">
                    Esta evidencia ya fue validada y define el punto de partida de esta misión.
                  </p>
                </div>
              )
            })
          ) : (
            <div className="mission-prior-artifact__missing" role="alert">
              <span>⚠️</span>
              <p>Todavía no está disponible el trabajo verificado que esta misión necesita.</p>
            </div>
          )}
        </section>
      )}

      <section className="mission-panel__section" aria-labelledby="route-heading">
        <h3 id="route-heading">Condición de ruta</h3>
        <p>{prerequisiteSummary ?? 'Punto de partida del capítulo.'}</p>
        <p className="mission-panel__unlock">{unlockSummary}</p>
      </section>

      <section className="evidence-section" aria-labelledby="evidence-heading">
        <div className="evidence-section__heading">
          <h3 id="evidence-heading">Trabajo con el acompañante</h3>
        </div>
        <label htmlFor={evidenceFieldId}>{mission.evidencePrompt}</label>
        <p id={evidenceCriteriaId} className="evidence-section__criteria">
          <strong>Criterio:</strong> {mission.evidenceCriteria}
        </p>

        {historyWithoutCurrentReply.length > 0 && (
          <ol className="mission-conversation" aria-label="Conversación reciente con TRAZO">
            {historyWithoutCurrentReply.map((turn, index) => (
              <li key={`${turn.role}-${index}`} data-role={turn.role}>
                <span>{turn.role === 'learner' ? 'Tú' : 'TRAZO'}</span>
                <p>{turn.content}</p>
              </li>
            ))}
          </ol>
        )}

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
            disabled={progressState === 'locked'}
            aria-describedby={`${evidenceCriteriaId} ${evidenceHelpId}`}
            onChange={(event) => onEvidenceChange(mission.id, event.target.value)}
          />
        ) : (
          <textarea
            id={evidenceFieldId}
            className="evidence-field evidence-field--text"
            rows={5}
            placeholder="Escribe tu avance, duda o mensaje para TRAZO…"
            value={evidence}
            readOnly={isEvaluating}
            disabled={progressState === 'locked'}
            aria-describedby={`${evidenceCriteriaId} ${evidenceHelpId}`}
            onChange={(event) => onEvidenceChange(mission.id, event.target.value)}
          />
        )}
        <p
          id={evidenceHelpId}
          className="evidence-section__help"
          data-evaluation-state={evaluationPresentation.state}
        >
          {progressState === 'locked'
            ? 'Podrás interactuar cuando desbloquees esta misión.'
            : evaluationPresentation.evidenceHelp}
        </p>
      </section>

      {/* Companion Feedback & Evaluation Results Section */}
      {evaluationState && showEvaluationFeedback && (
        <section
          className="companion-feedback-section"
          data-status={evaluationPresentation.state}
          aria-labelledby="companion-feedback-heading"
        >
          <div className="companion-feedback-header">
            <span className="companion-feedback-icon" aria-hidden="true">
              {evaluationPresentation.state === 'evaluating'
                ? '…'
                : evaluationPresentation.state === 'verified'
                  ? '✓'
                  : evaluationPresentation.state === 'conversation'
                    ? '💬'
                    : evaluationPresentation.state === 'ambiguous'
                      ? '?'
                      : evaluationPresentation.state === 'clarify'
                        ? '?'
                        : evaluationPresentation.state === 'rework'
                          ? '↺'
                          : evaluationPresentation.state === 'human_review'
                            ? 'i'
                            : '!'}
            </span>
            <h3 id="companion-feedback-heading">
              {evaluationPresentation.feedbackTitle}
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
                Continúa con la siguiente misión disponible en el mapa.
              </p>
            )}

            {evaluationPresentation.state !== 'evaluating' &&
              evaluationPresentation.state !== 'conversation' &&
              evaluationPresentation.state !== 'ambiguous' &&
              (evaluationState.evaluation?.criteria?.length ?? 0) > 0 && (
                <details className="companion-feedback-details">
                  <summary>Ver por qué</summary>
                  <ul>
                    {evaluationState.evaluation!.criteria.map((criterion) => (
                      <li key={criterion.criterionId}>
                        <strong>{rubricLabelById.get(criterion.criterionId) ?? 'Detalle'}:</strong>{' '}
                        {criterion.rationale}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
          </div>

          {evaluationPresentation.state === 'system_error' &&
            import.meta.env.DEV &&
            evaluationState.systemError?.debugCode && (
              <details className="companion-feedback-debug">
                <summary>Detalles técnicos</summary>
                <code>{evaluationState.systemError.debugCode}</code>
              </details>
            )}
        </section>
      )}

      {frictionRecovery && dismissedInterventionId !== frictionRecovery.interventionId && (
        <section
          className="mission-friction-recovery"
          aria-labelledby="friction-recovery-heading"
          data-rework-count={frictionRecovery.reworkCount}
        >
          <div className="friction-recovery__header">
            <span className="friction-recovery__badge">Acompañante · Recuperación</span>
            <h3 id="friction-recovery-heading">Orientación ante intentos reiterados</h3>
          </div>
          <div className="friction-recovery__body">
            {frictionRecovery.targetCriterion ? (
              <>
                <p className="friction-recovery__lead">
                  Detectamos varios intentos en esta misión. Te sugerimos concentrarte en este criterio:
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
                Detectamos varios intentos sin verificar. Revisa los criterios del coach antes de volver a enviar.
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
              Ajustar evidencia
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

      {producedSections.length > 0 && (
        <section
          className="mission-prior-artifact mission-produced-artifact"
          aria-labelledby="produced-artifact-heading"
        >
          <h3 id="produced-artifact-heading">Progreso guardado</h3>
          <p>Esta evidencia creó trabajo verificado para las siguientes misiones.</p>
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

      <div className="mission-panel__action">
        {progressState === 'locked' && (
          <div className="locked-explanation" role="status">
            <span className="locked-explanation__mark" aria-hidden="true" />
            <div>
              <strong>Bloqueada por ahora</strong>
              <p>{lockedReason}</p>
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
            <span aria-hidden="true">✓</span> Condición completada y verificada
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
              {evaluationPresentation.submitLabel}
            </span>
            <span className="submit-evidence-button__mark" aria-hidden="true">
              {isEvaluating ? '⏳' : '→'}
            </span>
          </button>
        )}
      </div>
    </aside>
  )
}
