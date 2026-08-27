import type { ReactNode } from 'react'
import { RouteRail, type RouteStage } from './RouteRail'

interface ProductRouteFrameProps {
  stages: RouteStage[]
  children: ReactNode
  variant?: 'identity' | 'branch' | 'calibration'
}

export function ProductRouteFrame({
  stages,
  children,
  variant = 'identity',
}: ProductRouteFrameProps) {
  return (
    <main className={`product-route product-route--${variant}`}>
      <RouteRail label="Ruta de configuración" stages={stages} />
      <section className="product-route__content">
        {children}
      </section>
    </main>
  )
}
