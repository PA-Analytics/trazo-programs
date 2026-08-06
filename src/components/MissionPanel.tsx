import { useCallback, useEffect, useRef, useState } from 'react'
import type { Mission, ProgressState } from '../domain/course'
import { nodeTypeLabels, progressLabels } from '../presentation/labels'
import { CloseIcon, MissionIcon } from './icons'

interface MissionPanelProps {
  mission: Mission
  progressState: ProgressState
  lockedReason?: string
  prerequisiteSummary?: string
  onClose: () => void
  onComplete: (missionId: string) => void
}

const completableStates: ProgressState[] = ['available', 'active', 'submitted']

export function MissionPanel({
  mission,
  progressState,
  lockedReason,
  prerequisiteSummary,
  onClose,
  onComplete,
}: MissionPanelProps) {
  const panelRef = useRef<HTMLElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const closeTimerRef = useRef<number | undefined>(undefined)
  const [closing, setClosing] = useState(false)
  const canComplete = completableStates.includes(progressState)

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
          'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
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

  return (
    <aside
      ref={panelRef}
      id="mission-panel"
      className="mission-panel"
      data-closing={closing}
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

      <section className="mission-panel__section" aria-labelledby="route-heading">
        <h3 id="route-heading">Condición de ruta</h3>
        <p>{prerequisiteSummary ?? 'Punto de partida del capítulo.'}</p>
      </section>

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
          <p className="mission-complete-note">
            <span aria-hidden="true">✓</span> Condición completada
          </p>
        )}

        {canComplete && (
          <button
            type="button"
            className="complete-mission-button"
            onClick={() => onComplete(mission.id)}
          >
            Completar misión
          </button>
        )}
      </div>
    </aside>
  )
}
