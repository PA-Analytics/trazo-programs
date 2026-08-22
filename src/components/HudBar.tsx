import { CenterIcon } from './icons'

interface HudBarProps {
  chapterNumber: string
  chapterTitle: string
  completed: number
  total: number
  activeMissionTitle?: string
  onRecenter: () => void
}

export function HudBar({
  chapterNumber,
  chapterTitle,
  completed,
  total,
  activeMissionTitle,
  onRecenter,
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
