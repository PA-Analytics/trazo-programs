import type { NodeType, ProgressState } from '../domain/course'

interface MissionIconProps {
  state: ProgressState
  nodeType: NodeType
}

export function MissionIcon({ state, nodeType }: MissionIconProps) {
  const common = {
    'aria-hidden': true,
    className: 'mission-icon',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }

  if (state === 'locked') {
    return (
      <svg {...common}>
        <rect x="5" y="10" width="14" height="10" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </svg>
    )
  }

  if (state === 'completed') {
    return (
      <svg {...common} strokeWidth={3}>
        <path d="m5 12 4.3 4.3L19 6.7" />
      </svg>
    )
  }

  if (state === 'submitted') {
    return (
      <svg {...common}>
        <path d="M7 3h7l4 4v14H7z" />
        <path d="M14 3v5h5M10 13h5M10 17h3" />
      </svg>
    )
  }

  if (state === 'active') {
    return (
      <svg {...common}>
        <path d="m4 20 5-1 10-10-4-4L5 15zM13.5 6.5l4 4" />
      </svg>
    )
  }

  if (nodeType === 'milestone') {
    return (
      <svg {...common}>
        <path d="M12 3v18M6 7h9l-2 3 2 3H6" />
      </svg>
    )
  }

  return (
    <svg {...common}>
      <path d="m9 6 8 6-8 6z" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function CenterIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path d="M8 3H3v5M16 3h5v5M21 16v5h-5M3 16v5h5" />
      <circle cx="12" cy="12" r="3" />
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
