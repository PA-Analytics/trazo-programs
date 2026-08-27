export interface RouteStage {
  label: string
  state: 'complete' | 'current' | 'future'
}

interface RouteRailProps {
  label: string
  stages: RouteStage[]
}

export function RouteRail({ label, stages }: RouteRailProps) {
  return (
    <aside className="route-rail" aria-label={label}>
      <span className="route-rail__label">{label}</span>
      <ol className="route-rail__stages">
        {stages.map((stage, index) => (
          <li key={stage.label} data-state={stage.state}>
            <span className="route-rail__node" aria-hidden="true">
              {stage.state === 'complete' ? '✓' : String(index + 1).padStart(2, '0')}
            </span>
            <span className="route-rail__stage-label">{stage.label}</span>
          </li>
        ))}
      </ol>
    </aside>
  )
}
