import { CenterIcon } from './icons'

interface HudBarProps {
  chapterNumber: string
  chapterTitle: string
  completed: number
  total: number
  activeMissionTitle?: string
  implementationId?: string
  localSessionIds?: string[]
  onRecenter: () => void
  onNewSession?: () => void
  onSelectLocalSession?: (id: string) => void
}

export function HudBar({
  chapterNumber,
  chapterTitle,
  completed,
  total,
  activeMissionTitle,
  implementationId,
  localSessionIds = [],
  onRecenter,
  onNewSession,
  onSelectLocalSession,
}: HudBarProps) {
  return (
    <header className="hud-bar">
      <div className="hud-bar__identity">
        <span className="hud-bar__brand">TRAZO</span>
        <div className="hud-bar__title">
          <span className="hud-bar__kicker">Capítulo {chapterNumber}</span>
          <h1>{chapterTitle}</h1>
        </div>
        {activeMissionTitle && (
          <div className="hud-bar__current" aria-label={`Misión actual: ${activeMissionTitle}`}>
            <span>Actual</span>
            <strong>{activeMissionTitle}</strong>
          </div>
        )}
      </div>

      <div className="hud-bar__actions">
        {implementationId && (
          <div className="hud-bar__session" role="region" aria-label="Control de sesión">
            {localSessionIds.length > 1 && onSelectLocalSession ? (
              <select
                className="hud-session-select"
                aria-label="Seleccionar sesión local"
                value={implementationId}
                onChange={(event) => onSelectLocalSession(event.target.value)}
              >
                {localSessionIds.map((id) => (
                  <option key={id} value={id}>
                    Sesión {id.length > 16 ? `${id.slice(0, 14)}…` : id}
                  </option>
                ))}
              </select>
            ) : (
              <span className="hud-session-badge" title={`Sesión activa: ${implementationId}`}>
                <span className="hud-session-dot" aria-hidden="true" />
                <span className="hud-session-text">Sesión</span>
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

        <span className="hud-bar__progress" aria-label={`${completed} de ${total} misiones verificadas`}>
          <strong>{completed} / {total}</strong> verificadas
        </span>
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
