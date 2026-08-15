import { memo } from 'react'
import type { Node, NodeProps } from '@xyflow/react'
import type { MapRegion } from '../domain/course'

export interface TerritoryNodeData extends Record<string, unknown> {
  region: MapRegion
}

export type TerritoryFlowNode = Node<TerritoryNodeData, 'territory'>

const contours = {
  workshop: [
    'M3 32 C18 12 36 22 45 36 C58 56 75 10 96 28',
    'M5 58 C23 38 38 42 49 56 C62 72 81 32 98 52',
  ],
  field: [
    'M2 28 C18 10 32 40 47 26 C61 13 73 39 98 19',
    'M4 55 C21 41 35 64 52 51 C67 40 82 64 97 50',
  ],
  market: [
    'M6 32 C22 8 72 6 94 28',
    'M5 60 C28 36 73 34 94 56',
  ],
} satisfies Record<MapRegion['variant'], string[]>

export const TerritoryNode = memo(function TerritoryNode({
  data,
}: NodeProps<TerritoryFlowNode>) {
  const { region } = data

  return (
    <div
      className={`territory territory--${region.variant}`}
      style={{ width: region.width, height: region.height }}
      aria-hidden="true"
    >
      <svg
        className="territory__contours"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        fill="none"
      >
        {contours[region.variant].map((path) => (
          <path key={path} d={path} vectorEffect="non-scaling-stroke" />
        ))}
      </svg>

      <div className="territory__label">
        <span className="territory__index">
          {region.variant === 'workshop' ? '01' : region.variant === 'field' ? '02' : '03'}
        </span>
        <span className="territory__copy">
          <strong>{region.title}</strong>
          <span>{region.description}</span>
        </span>
      </div>

      {region.sequence && (
        <div className="territory__sequence">
          {region.sequence.map((step, index) => (
            <span key={step}>
              {step}
              {index < region.sequence!.length - 1 && <i>→</i>}
            </span>
          ))}
        </div>
      )}

      <span className="territory__register territory__register--a" />
      <span className="territory__register territory__register--b" />
    </div>
  )
})
