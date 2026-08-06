import { CenterIcon } from './icons'

interface HudBarProps {
  chapterTitle: string
  completed: number
  total: number
  onRecenter: () => void
}

export function HudBar({
  chapterTitle,
  completed,
  total,
  onRecenter,
}: HudBarProps) {
  return (
    <header className="hud-bar">
      <div className="hud-bar__title">
        <span className="hud-bar__kicker">Ruta activa</span>
        <h1>{chapterTitle}</h1>
      </div>
      <div className="hud-bar__actions">
        <span className="hud-bar__progress" aria-label={`${completed} de ${total} misiones completadas`}>
          <strong>{completed}</strong>
          <span aria-hidden="true"> / </span>
          {total}
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
