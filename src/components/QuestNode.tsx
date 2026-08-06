import { memo } from 'react'
import {
  Handle,
  Position,
  useViewport,
  type Node,
  type NodeProps,
} from '@xyflow/react'
import type { Mission, ProgressState } from '../domain/course'
import { nodeTypeLabels, progressLabels } from '../presentation/labels'
import { MissionIcon } from './icons'

export interface QuestNodeData extends Record<string, unknown> {
  mission: Mission
  progressState: ProgressState
  selected: boolean
  lockedReason?: string
  onSelect: (missionId: string) => void
  onHover: (missionId: string | null) => void
}

export type QuestFlowNode = Node<QuestNodeData, 'quest'>

export const QuestNode = memo(function QuestNode({ data }: NodeProps<QuestFlowNode>) {
  const { mission, progressState, selected, lockedReason, onSelect, onHover } = data
  const { zoom } = useViewport()
  const detailLevel = zoom > 0.8 ? 'standard' : zoom >= 0.5 ? 'overview' : 'far'
  const stateLabel = progressLabels[progressState]
  const typeLabel = nodeTypeLabels[mission.nodeType]
  const description = lockedReason ? ` ${lockedReason}` : ''
  const tooltipId = `mission-tooltip-${mission.id}`

  return (
    <div
      className={`quest-node-shell quest-node--${mission.nodeType}`}
      data-progress={progressState}
      data-selected={selected}
      data-detail={detailLevel}
      onPointerEnter={() => onHover(mission.id)}
      onPointerLeave={() => onHover(null)}
    >
      <Handle type="target" position={Position.Left} isConnectable={false} />
      <button
        id={`mission-node-${mission.id}`}
        className="quest-node-button nodrag nopan"
        type="button"
        aria-label={`${typeLabel}: ${mission.title}. Estado: ${stateLabel}.${description}`}
        aria-describedby={tooltipId}
        aria-haspopup="dialog"
        aria-expanded={selected}
        onClick={() => onSelect(mission.id)}
        onFocus={() => onHover(mission.id)}
        onBlur={() => onHover(null)}
      >
        <span className="quest-node-shape" aria-hidden="true">
          {mission.nodeType !== 'normal' && <span className="quest-node-frame" />}
          <MissionIcon state={progressState} nodeType={mission.nodeType} />
        </span>
        <span className="quest-node-title">{mission.title}</span>
        <span id={tooltipId} className="quest-node-tooltip" role="tooltip">
          <span>{mission.title}</span>
          <span>{stateLabel}</span>
        </span>
      </button>
      <Handle type="source" position={Position.Right} isConnectable={false} />
    </div>
  )
})
