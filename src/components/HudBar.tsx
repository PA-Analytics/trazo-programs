import type { ImplementationState } from '../domain/course'
import { CenterIcon } from './icons'
import type { UserProfile } from '../domain/identity'
import { ProfileSwitcher } from './ProfileSwitcher'

interface HudBarProps {
  chapterNumber: string
  chapterTitle: string
  completed: number
  total: number
  activeMissionTitle?: string
  profile: UserProfile
  learnerSetup?: ImplementationState['learnerSetup']
  onProfileOpen: () => void
  onRecenter: () => void
  onOpenCalibration?: () => void
}

export function HudBar({
  chapterNumber,
  chapterTitle,
  completed,
  total,
  activeMissionTitle,
  profile,
  learnerSetup,
  onProfileOpen,
  onRecenter,
  onOpenCalibration,
}: HudBarProps) {
  const routeLabel =
    learnerSetup?.preferredRouteId === 'N02' || learnerSetup?.preferredRouteId === 'C02A'
      ? 'Ruta directa'
      : learnerSetup?.preferredRouteId === 'N03' || learnerSetup?.preferredRouteId === 'C02B'
        ? 'Ruta narrativa'
        : 'Ruta ajustada'
  const guidanceLabel =
    learnerSetup?.helpPreference === 'DIRECT'
      ? 'Al grano'
      : learnerSetup?.helpPreference === 'QUESTIONS'
        ? 'Preguntas guía'
        : learnerSetup?.helpPreference === 'EXAMPLE'
          ? 'Casos modelo'
          : 'Guía adaptable'
  const timeLabel =
    learnerSetup?.availableTime === '15_30_MIN'
      ? '15–30 min'
      : learnerSetup?.availableTime === '30_60_MIN'
        ? '30–60 min'
        : learnerSetup?.availableTime === '1_2_HOURS'
          ? '1–2 h'
          : learnerSetup?.availableTime === 'VARIES'
            ? 'Ritmo variable'
            : undefined

  return (
    <header className="hud-bar">
      <div className="hud-bar__identity">
        <div className="hud-bar__title">
          <span className="hud-bar__kicker">Capítulo {chapterNumber}</span>
          <h1>{chapterTitle}</h1>
        </div>
        {learnerSetup && (
          <div
            className="hud-bar__calibration-stamp"
            title={`Ruta activa: ${routeLabel} · Acompañamiento: ${guidanceLabel}`}
            aria-label="Perfil pedagógico activo"
          >
            <span className="hud-stamp__route">{routeLabel}</span>
            <span className="hud-stamp__sep hud-stamp__sep--guidance">·</span>
            <span className="hud-stamp__style">{guidanceLabel}</span>
            {timeLabel && (
              <>
                <span className="hud-stamp__sep hud-stamp__sep--time">·</span>
                <span className="hud-stamp__time">{timeLabel}</span>
              </>
            )}
          </div>
        )}
        {activeMissionTitle && (
          <div className="hud-bar__current" aria-label={`Misión actual: ${activeMissionTitle}`}>
            <span>Actual</span>
            <strong>{activeMissionTitle}</strong>
          </div>
        )}
      </div>

      <div className="hud-bar__actions">
        {profile.role === 'coach' && onOpenCalibration && (
          <button
            type="button"
            className="hud-button hud-button--calibration"
            onClick={onOpenCalibration}
            title="Abrir Estudio de Calibración"
          >
            ⚙️ Estudio de Calibración
          </button>
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
        <ProfileSwitcher profile={profile} onOpen={onProfileOpen} />
      </div>
    </header>
  )
}
