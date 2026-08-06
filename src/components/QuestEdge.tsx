import { memo } from 'react'
import {
  BaseEdge,
  getSmoothStepPath,
  type Edge,
  type EdgeProps,
} from '@xyflow/react'
import type { EdgeProgress, MapPosition } from '../domain/course'

export interface QuestEdgeData extends Record<string, unknown> {
  progressState: EdgeProgress
  optional: boolean
  highlighted: boolean
  via?: MapPosition
}

export type QuestFlowEdge = Edge<QuestEdgeData, 'quest'>

function distance(a: MapPosition, b: MapPosition) {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

function pointTowards(from: MapPosition, to: MapPosition, amount: number) {
  const segmentLength = distance(from, to)
  if (segmentLength === 0) return from
  const ratio = amount / segmentLength
  return {
    x: from.x + (to.x - from.x) * ratio,
    y: from.y + (to.y - from.y) * ratio,
  }
}

function roundedOrthogonalPath(points: MapPosition[], radius = 6) {
  const cleanPoints = points.filter(
    (point, index) =>
      index === 0 ||
      point.x !== points[index - 1].x ||
      point.y !== points[index - 1].y,
  )

  if (cleanPoints.length < 2) return ''

  let path = `M ${cleanPoints[0].x} ${cleanPoints[0].y}`
  for (let index = 1; index < cleanPoints.length - 1; index += 1) {
    const previous = cleanPoints[index - 1]
    const corner = cleanPoints[index]
    const next = cleanPoints[index + 1]
    const cornerRadius = Math.min(
      radius,
      distance(previous, corner) / 2,
      distance(corner, next) / 2,
    )
    const before = pointTowards(corner, previous, cornerRadius)
    const after = pointTowards(corner, next, cornerRadius)
    path += ` L ${before.x} ${before.y} Q ${corner.x} ${corner.y} ${after.x} ${after.y}`
  }
  const last = cleanPoints.at(-1)!
  return `${path} L ${last.x} ${last.y}`
}

export const QuestEdge = memo(function QuestEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps<QuestFlowEdge>) {
  const via = data?.via
  const [defaultPath] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 6,
  })
  const edgePath = via
    ? roundedOrthogonalPath([
        { x: sourceX, y: sourceY },
        { x: via.x - 28, y: sourceY },
        { x: via.x - 28, y: via.y },
        via,
        { x: via.x, y: targetY },
        { x: targetX, y: targetY },
      ])
    : defaultPath

  return (
    <BaseEdge
      path={edgePath}
      className="quest-edge-path"
      data-progress={data?.progressState ?? 'locked'}
      data-optional={data?.optional ?? false}
      data-highlighted={data?.highlighted ?? false}
    />
  )
})
