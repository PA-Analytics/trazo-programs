import type { ReactNode } from 'react'
import { RouteRail, type RouteStage } from './RouteRail'

interface ProductRouteFrameProps {
  stages?: RouteStage[]
  children: ReactNode
  variant?: 'identity' | 'branch' | 'calibration' | 'centered'
  hideRail?: boolean
}

export function ProductRouteFrame({
  stages = [],
  children,
  variant = 'identity',
  hideRail = false,
}: ProductRouteFrameProps) {
  const shouldHideRail = hideRail || variant === 'identity' || stages.length === 0

  return (
    <main className={`product-route product-route--${variant} ${shouldHideRail ? 'product-route--no-rail' : ''}`}>
      {!shouldHideRail && <RouteRail label="Ruta de configuración" stages={stages} />}
      <section className="product-route__content">
        {children}
      </section>
    </main>
  )
}
