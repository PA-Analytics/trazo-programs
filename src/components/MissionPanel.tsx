import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  ImplementationArtifact,
  Mission,
  MissionEvaluationState,
  PremiseArtifactValue,
  ProgressState,
} from '../domain/course'
import { nodeTypeLabels, progressLabels } from '../presentation/labels'
import { CloseIcon, MissionIcon } from './icons'

interface MissionPanelProps {
  mission: Mission
  progressState: ProgressState
  lockedReason?: string
  prerequisiteSummary?: string
  evidence: string
  evaluationState?: MissionEvaluationState
  artifacts?: Record<string, ImplementationArtifact>
  onClose: () => void
  onEvidenceChange: (missionId: string, evidence: string) => void
  onSubmitEvidence: (missionId: string) => void
}

const completableStates: ProgressState[] = ['available', 'active', 'submitted']

export function MissionPanel({
  mission,
  progressState,
  lockedReason,
  prerequisiteSummary,
  evidence,
  evaluationState,
  artifacts,
  onClose,
  onEvidenceChange,
  onSubmitEvidence,
}: MissionPanelProps) {
  const panelRef = useRef<HTMLElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const completionNoteRef = useRef<HTMLParagraphElement>(null)
  const closeTimerRef = useRef<number | undefined>(undefined)
  const [closing, setClosing] = useState(false)

  const isEvaluating = evaluationState?.status === 'evaluating'
  const canComplete = completableStates.includes(progressState)
  const hasEvidence = evidence.trim().length > 0

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

  const premiseArtifact = artifacts?.['premise']
  const premiseStatement = (premiseArtifact?.value as PremiseArtifactValue)?.statement

  return (
    <aside
      ref={panelRef}
      id="mission-panel"
      className="mission-panel"
      data-closing={closing}
      data-node-type={mission.nodeType}
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

      {/* Consequential Artifact Consumer Section (TASK-005 & TASK-011) */}
      {mission.consumesArtifacts?.includes('premise') && (
        <section className="mission-prior-artifact" aria-labelledby="prior-artifact-heading">
          <h3 id="prior-artifact-heading" className="visually-hidden">Artefacto de misión previa</h3>
          {premiseStatement ? (
            <div className="mission-prior-artifact__card">
              <div className="mission-prior-artifact__header">
                <span className="mission-prior-artifact__badge">Trabajo verificado de N01</span>
                <strong>Partimos de tu premisa verificada:</strong>
              </div>
              <blockquote className="mission-prior-artifact__quote">
                "{premiseStatement}"
              </blockquote>
              <p className="mission-prior-artifact__hint">
                {mission.id === 'N02'
                  ? 'Convierte esta premisa en una estructura directa de apertura, desarrollo y cierre.'
                  : 'Desarrolla esta premisa en una estructura narrativa con situación inicial, cambio y resolución.'}
              </p>
            </div>
          ) : (
            <div className="mission-prior-artifact__missing" role="alert">
              <span>⚠️</span>
              <p>No se encontró la premisa verificada de la misión anterior.</p>
            </div>
          )}
        </section>
      )}

      <section className="mission-panel__section" aria-labelledby="route-heading">
        <h3 id="route-heading">Condición de ruta</h3>
        <p>{prerequisiteSummary ?? 'Punto de partida del capítulo.'}</p>
      </section>

      <section className="evidence-section" aria-labelledby="evidence-heading">
        <div className="evidence-section__heading">
          <h3 id="evidence-heading">Evidencia de misión</h3>
        </div>
        <label htmlFor={evidenceFieldId}>{mission.evidencePrompt}</label>
        <p id={evidenceCriteriaId} className="evidence-section__criteria">
          <strong>Criterio:</strong> {mission.evidenceCriteria}
        </p>

        {mission.evidenceType === 'url' ? (
          <input
            id={evidenceFieldId}
            className="evidence-field"
            type="url"
            inputMode="url"
            autoComplete="url"
            placeholder="https://"
            value={evidence}
            readOnly={progressState === 'completed' || isEvaluating}
            disabled={progressState === 'locked'}
            aria-describedby={`${evidenceCriteriaId} ${evidenceHelpId}`}
            onChange={(event) => onEvidenceChange(mission.id, event.target.value)}
          />
        ) : (
          <textarea
            id={evidenceFieldId}
            className="evidence-field evidence-field--text"
            rows={5}
            placeholder="Escribe aquí tu evidencia…"
            value={evidence}
            readOnly={progressState === 'completed' || isEvaluating}
            disabled={progressState === 'locked'}
            aria-describedby={`${evidenceCriteriaId} ${evidenceHelpId}`}
            onChange={(event) => onEvidenceChange(mission.id, event.target.value)}
          />
        )}
        <p id={evidenceHelpId} className="evidence-section__help">
          {progressState === 'locked'
            ? 'Podrás añadir evidencia cuando desbloquees esta misión.'
            : isEvaluating
              ? 'El Acompañante está evaluando tu evidencia...'
              : progressState === 'completed'
                ? 'Evidencia verificada y persistida en el servidor.'
                : hasEvidence
                  ? 'Evidencia lista para verificar.'
                  : 'Añade evidencia para habilitar la entrega.'}
        </p>
      </section>

      {/* Companion Feedback & Evaluation Results Section */}
      {evaluationState && evaluationState.status !== 'idle' && (
        <section
          className="companion-feedback-section"
          aria-labelledby="companion-feedback-heading"
        >
          <div className="companion-feedback-header">
            <span className="companion-feedback-icon" aria-hidden="true">
              {evaluationState.status === 'evaluating'
                ? '⏳'
                : evaluationState.status === 'pass'
                  ? '✓'
                  : evaluationState.status === 'clarify'
                    ? '⚡'
                    : evaluationState.status === 'rework'
                      ? '✍️'
                      : evaluationState.status === 'human_review'
                        ? 'ℹ️'
                        : '⚠️'}
            </span>
            <h3 id="companion-feedback-heading">
              {evaluationState.status === 'evaluating' && 'Evaluando evidencia...'}
              {evaluationState.status === 'pass' && 'Acción Verificada: Aprobada'}
              {evaluationState.status === 'clarify' && 'Aclaración Solicitada'}
              {evaluationState.status === 'rework' && 'Ajuste Requerido'}
              {evaluationState.status === 'human_review' && 'Revisión Manual'}
              {evaluationState.status === 'error' && 'Error de Evaluación'}
            </h3>
          </div>

          {evaluationState.status === 'evaluating' && (
            <p className="companion-feedback-evaluating">
              El Acompañante está analizando tu texto contra los criterios de la rúbrica...
            </p>
          )}

          {evaluationState.evaluation && (
            <div className="companion-feedback-body">
              <blockquote className="companion-feedback-quote">
                "{evaluationState.evaluation.coachingFeedback}"
              </blockquote>

              {evaluationState.evaluation.criteria.length > 0 && (
                <div className="companion-criteria-list">
                  <h4>Criterios evaluados:</h4>
                  <ul>
                    {evaluationState.evaluation.criteria.map((c) => (
                      <li key={c.criterionId} data-verdict={c.status}>
                        <span className="criterion-badge" data-verdict={c.status}>
                          {c.status}
                        </span>
                        <div className="criterion-info">
                          <strong>{c.criterionId}:</strong> {c.rationale}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {evaluationState.errorMessage && (
            <p className="companion-feedback-error">{evaluationState.errorMessage}</p>
          )}
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

        {canComplete && (
          <button
            type="button"
            className="submit-evidence-button"
            disabled={!hasEvidence || isEvaluating}
            aria-describedby={evidenceHelpId}
            onClick={() => onSubmitEvidence(mission.id)}
          >
            <span>
              {isEvaluating
                ? 'Verificando con Acompañante…'
                : evaluationState?.status === 'rework' || evaluationState?.status === 'clarify'
                  ? 'Reenviar evidencia'
                  : 'Verificar acción'}
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
