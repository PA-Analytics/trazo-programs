import { memo, type CSSProperties } from 'react'
import {
  Handle,
  Position,
  useViewport,
  type Node,
  type NodeProps,
} from '@xyflow/react'
import type { EvaluationStatus, Mission, ProgressState } from '../domain/course'
import { nodeTypeLabels, progressLabels } from '../presentation/labels'
import { MissionIcon, StateBadge } from './icons'

export interface QuestNodeData extends Record<string, unknown> {
  mission: Mission
  progressState: ProgressState
  evaluationStatus?: EvaluationStatus
  recommended: boolean
  selected: boolean
  lockedReason?: string
  isCorridor?: boolean
  isDimmed?: boolean
  companionContact?: boolean
  entryOrder?: number
  entryLocked?: boolean
  entryFocus?: boolean
  onSelect: (missionId: string) => void
  onHover: (missionId: string | null) => void
}

export type QuestFlowNode = Node<QuestNodeData, 'quest'>

export const QuestNode = memo(function QuestNode({ data }: NodeProps<QuestFlowNode>) {
  const {
    mission,
    progressState,
    evaluationStatus,
    recommended,
    selected,
    lockedReason,
    isCorridor,
    isDimmed,
    companionContact,
    entryOrder,
    entryLocked,
    entryFocus,
    onSelect,
    onHover,
  } = data
  const { zoom } = useViewport()
  const detailLevel = zoom >= 0.62 ? 'standard' : zoom >= 0.42 ? 'overview' : 'far'
  const stateLabel = progressLabels[progressState]
  const typeLabel = nodeTypeLabels[mission.nodeType]
  const description = lockedReason ? ` ${lockedReason}` : ''
  const subtitle = mission.mapSubtitle ? ` ${mission.mapSubtitle}` : ''
  const evaluationDescription =
    evaluationStatus === 'evaluating'
      ? ' Evidencia en evaluación.'
      : evaluationStatus === 'rework'
        ? ' La evidencia requiere ajustes.'
        : evaluationStatus === 'clarify'
          ? ' La evidencia necesita aclaración.'
          : evaluationStatus === 'human_review'
            ? ' La evidencia espera revisión humana.'
            : ''
  const recommendationDescription = recommended ? ' Recomendada por el Acompañante.' : ''
  const tooltipId = `mission-tooltip-${mission.id}`

  return (
    <div
      className={`quest-node-shell quest-node--${mission.nodeType}`}
      data-progress={progressState}
      data-evaluation={evaluationStatus ?? 'idle'}
      data-recommended={recommended}
      data-selected={selected}
      data-corridor={isCorridor ?? false}
      data-dimmed={isDimmed ?? false}
      data-companion-contact={companionContact ?? false}
      data-entry-order={entryOrder ?? 0}
      data-entry-focus={entryFocus ?? false}
      data-detail={detailLevel}
      data-role={mission.mapRole}
      style={{ '--entry-delay': `${Math.min((entryOrder ?? 0) * 90, 720)}ms` } as CSSProperties}
      onPointerEnter={() => onHover(mission.id)}
      onPointerLeave={() => onHover(null)}
    >
      {mission.nodeType === 'milestone' && (
        <span className="quest-node-destination-rings" aria-hidden="true">
          <span />
          <span />
        </span>
      )}
      <Handle type="target" position={Position.Left} isConnectable={false} />
      <button
        id={`mission-node-${mission.id}`}
        className="quest-node-button nodrag nopan"
        type="button"
        aria-label={`${typeLabel}: ${mission.title}. Estado: ${stateLabel}.${subtitle}${description}${evaluationDescription}${recommendationDescription}`}
        aria-describedby={tooltipId}
        aria-haspopup="dialog"
        aria-expanded={selected}
        tabIndex={entryLocked ? -1 : 0}
        onClick={() => onSelect(mission.id)}
        onFocus={() => onHover(mission.id)}
        onBlur={() => onHover(null)}
      >
        <span className="quest-node-depth" aria-hidden="true" />
        <span className="quest-node-shape" aria-hidden="true">
          <span className="quest-node-frame" />
          <MissionIcon state={progressState} nodeType={mission.nodeType} missionId={mission.id} />
          <StateBadge state={progressState} />
        </span>
        {mission.mapRole === 'entry' && progressState === 'available' && (
          <span className="quest-node-entry-cue" aria-hidden="true">
            <span />
            Empieza aquí
          </span>
        )}
        {mission.nodeType === 'milestone' && (
          <span className="quest-node-eyebrow" aria-hidden="true">
            Destino · 09
          </span>
        )}
        <span className="quest-node-title">{mission.title}</span>
        {mission.mapSubtitle && (
          <span className="quest-node-subtitle">{mission.mapSubtitle}</span>
        )}
        {mission.mapRole === 'convergence' && (
          <span className="quest-node-role-cue" aria-hidden="true">
            Las rutas se unen
          </span>
        )}
        {mission.nodeType === 'optional' && (
          <span className="quest-node-role-cue quest-node-role-cue--optional" aria-hidden="true">
            Ruta extra
          </span>
        )}
        {progressState === 'active' && (
          <span className="quest-node-cue" aria-hidden="true">
            <span />
            Aquí estás
          </span>
        )}
        {recommended && (
          <span className="quest-node-recommendation" aria-hidden="true">
            Recomendado
          </span>
        )}
        <span id={tooltipId} className="quest-node-tooltip" role="tooltip">
          <span>{mission.title}</span>
          <span>{stateLabel}</span>
          <span className="quest-node-tooltip__context">{mission.description}</span>
        </span>
      </button>
      <Handle type="source" position={Position.Right} isConnectable={false} />
    </div>
  )
})
