import type { NodeType, ProgressState } from '../domain/course'

interface MissionIconProps {
  state: ProgressState
  nodeType: NodeType
  missionId?: string
}

export function MissionIcon({ state, nodeType, missionId }: MissionIconProps) {
  const common = {
    'aria-hidden': true,
    className: `mission-icon mission-icon--${state}`,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }

  let content = null

  switch (missionId) {
    case 'N01':
      // Premisa -> idea / spark / starting point
      content = (
        <>
          <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
          <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
        </>
      )
      break
    case 'N02':
      // Estructura Directa -> 2x2 grid blocks
      content = (
        <>
          <rect x="4" y="4" width="7" height="7" rx="1.5" />
          <rect x="13" y="4" width="7" height="7" rx="1.5" />
          <rect x="4" y="13" width="7" height="7" rx="1.5" />
          <rect x="13" y="13" width="7" height="7" rx="1.5" />
        </>
      )
      break
    case 'N03':
      // Estructura Narrativa -> narrative sequence curve arc
      content = (
        <>
          <path d="M3 16c4 0 5-9 9-9s5 9 9 9" />
          <circle cx="3" cy="16" r="1.5" fill="currentColor" />
          <circle cx="12" cy="7" r="1.5" fill="currentColor" />
          <circle cx="21" cy="16" r="1.5" fill="currentColor" />
        </>
      )
      break
    case 'N04':
      // Revisión Opcional -> magnifying glass with check
      content = (
        <>
          <circle cx="10.5" cy="10.5" r="5.5" />
          <path d="m20 20-4.2-4.2" />
          <path d="m8 10.5 1.8 1.8 3.5-3.5" />
        </>
      )
      break
    case 'N05':
      // Ensamble -> converging layers / merge
      content = (
        <>
          <path d="m12 3 9 4.5-9 4.5-9-4.5z" />
          <path d="m3 12 9 4.5 9-4.5" />
          <path d="m3 16.5 9 4.5 9-4.5" />
        </>
      )
      break
    case 'N06':
      // Publicación -> paper plane / release output
      content = (
        <>
          <path d="M22 2L11 13" />
          <path d="M22 2l-7 20-4-9-9-4 20-7z" />
        </>
      )
      break
    case 'N07':
      // Registro de Señales -> radar / pulse wave signal
      content = (
        <path d="M2 12h4l3-8 4 16 3-8h6" />
      )
      break
    case 'N08':
      // Análisis -> bar chart with inspection trend line
      content = (
        <>
          <path d="M18 20V10M12 20V4M6 20v-6" />
          <path d="m4 11 5-5 4 4 6-6" />
        </>
      )
      break
    case 'N09':
      // Primera Pieza en Mercado -> published piece crossing into a signal field
      content = (
        <>
          <path d="M2.5 4.5h9v15h-9z" />
          <path d="M5.5 8h3M5.5 11h3" />
          <path d="M11.5 12h6" />
          <path d="m14.5 9 3 3-3 3" />
          <circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" />
          <path d="M20.5 8.5a5 5 0 0 1 0 7" />
          <path d="M22 6.5a8 8 0 0 1 0 11" />
        </>
      )
      break
    default:
      if (nodeType === 'milestone') {
        content = <path d="M12 3v18M6 7h9l-2 3 2 3H6" />
      } else {
        content = <path d="m9 6 8 6-8 6z" fill="currentColor" stroke="none" />
      }
  }

  return (
    <svg {...common}>
      {content}
    </svg>
  )
}

export function StateBadge({ state }: { state: ProgressState }) {
  if (state === 'locked') {
    return (
      <span className="mission-state-badge mission-state-badge--locked" aria-hidden="true">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="10" height="10">
          <rect x="3" y="7" width="10" height="7" rx="1.5" />
          <path d="M5 7V5a3 3 0 0 1 6 0v2" />
        </svg>
      </span>
    )
  }

  if (state === 'completed') {
    return (
      <span className="mission-state-badge mission-state-badge--completed" aria-hidden="true">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="10" height="10">
          <path d="m3.5 8.5 3 3 6-6" />
        </svg>
      </span>
    )
  }

  return null
}

export function CenterIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path d="M8 3H3v5M16 3h5v5M21 16v5h-5M3 16v5h5" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

export function ZoomInIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

export function ZoomOutIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path d="M5 12h14" />
    </svg>
  )
}

export function CloseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  )
}
