export type TrazzSlotState = 'idle' | 'attention' | 'thinking' | 'moving' | 'verified'

interface TrazzSlotProps {
  state?: TrazzSlotState
}

export function TrazzSlot({ state = 'idle' }: TrazzSlotProps) {
  return (
    <div className="trazz-slot" data-state={state} aria-hidden="true">
      <span className="trazz-slot__route" />
      <span className="trazz-slot__waypoint trazz-slot__waypoint--origin" />
      <span className="trazz-slot__waypoint trazz-slot__waypoint--current" />
      <span className="trazz-slot__waypoint trazz-slot__waypoint--future" />
    </div>
  )
}
