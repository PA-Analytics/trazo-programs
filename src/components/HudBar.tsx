import { CenterIcon } from './icons'

interface HudBarProps {
  chapterTitle: string
  chapterPromise?: string
  completed: number
  total: number
  implementationId?: string
  localSessionIds?: string[]
  onRecenter: () => void
  onNewSession?: () => void
  onSelectLocalSession?: (id: string) => void
}

export function HudBar({
  chapterTitle,
  chapterPromise,
  completed,
  total,
  implementationId,
  localSessionIds = [],
  onRecenter,
  onNewSession,
  onSelectLocalSession,
}: HudBarProps) {
  return (
    <header className="hud-bar">
      <div className="hud-bar__title">
        <span className="hud-bar__kicker">Ruta activa</span>
        <span className="hud-bar__heading">
          <h1>{chapterTitle}</h1>
          {chapterPromise && <span className="hud-bar__promise">{chapterPromise}</span>}
        </span>
      </div>
      <div className="hud-bar__actions">
        {implementationId && (
          <div className="hud-bar__session" role="region" aria-label="Control de sesión">
            {localSessionIds.length > 1 && onSelectLocalSession ? (
              <select
                className="hud-session-select"
                aria-label="Seleccionar sesión local"
                value={implementationId}
                onChange={(e) => onSelectLocalSession(e.target.value)}
              >
                {localSessionIds.map((id) => (
                  <option key={id} value={id}>
                    #{id.length > 16 ? `${id.slice(0, 14)}…` : id}
                  </option>
                ))}
              </select>
            ) : (
              <span className="hud-session-badge" title={`Sesión activa: ${implementationId}`}>
                <span className="hud-session-dot" aria-hidden="true" />
                <span className="hud-session-text">
                  #{implementationId.length > 16 ? `${implementationId.slice(0, 14)}…` : implementationId}
                </span>
              </span>
            )}
            {onNewSession && (
              <button
                type="button"
                className="hud-session-btn"
                title="Crear una nueva sesión limpia en este navegador"
                onClick={onNewSession}
              >
                + Nueva
              </button>
            )}
          </div>
        )}

        <div className="hud-bar__progress-readout" title={`${completed} de ${total} misiones completadas`}>
          <span className="hud-bar__progress" aria-label={`${completed} de ${total} misiones completadas`}>
            <strong>{completed}</strong>
            <span aria-hidden="true"> / </span>
            {total}
          </span>
          <span className="hud-bar__progress-caption" aria-hidden="true">
            {completed === 0 ? 'Aún sin comenzar' : 'Misiones completadas'}
          </span>
        </div>
        <button
          type="button"
          className="hud-button"
          aria-label="Volver a centrar el mapa"
          aria-controls="quest-map"
          title="Volver a centrar el mapa"
          onClick={onRecenter}
        >
          <CenterIcon />
        </button>
      </div>
    </header>
  )
}
