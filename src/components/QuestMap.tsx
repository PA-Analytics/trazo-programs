import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  type Node,
  type NodeTypes,
  type ReactFlowInstance,
} from '@xyflow/react'
import type {
  Chapter,
  Mission,
  MissionEvaluationState,
  MissionProgress,
} from '../domain/course'
import { deriveEdgeProgress } from '../domain/progression'
import { JunctionNode } from './JunctionNode'
import { MapControls } from './MapControls'
import { QuestEdge, type QuestFlowEdge } from './QuestEdge'
import { QuestNode, type QuestFlowNode } from './QuestNode'
import { TerritoryNode, type TerritoryFlowNode } from './TerritoryNode'

interface QuestMapProps {
  chapter: Chapter
  progress: MissionProgress
  evaluationStateByMissionId: Record<string, MissionEvaluationState>
  recommendedMissionId: string | null
  selectedMissionId: string | null
  lockedReasons: Record<string, string | undefined>
  recenterRequest: number
  onMissionSelect: (missionId: string) => void
}

interface JunctionNodeData extends Record<string, unknown> {
  decorative: true
}

type JunctionFlowNode = Node<JunctionNodeData, 'junction'>
type MapNode = QuestFlowNode | JunctionFlowNode | TerritoryFlowNode

const nodeTypes = {
  quest: QuestNode,
  junction: JunctionNode,
  territory: TerritoryNode,
} satisfies NodeTypes

const edgeTypes = { quest: QuestEdge }

const nodeDimensions = {
  normal: 88,
  optional: 72,
  milestone: 160,
} as const

function getNodeDimension(mission: Mission) {
  if (mission.mapRole === 'entry' || mission.mapRole === 'convergence') return 104
  return nodeDimensions[mission.nodeType]
}

function QuestMapCanvas({
  chapter,
  progress,
  evaluationStateByMissionId,
  recommendedMissionId,
  selectedMissionId,
  lockedReasons,
  recenterRequest,
  onMissionSelect,
}: QuestMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const [instance, setInstance] = useState<ReactFlowInstance<MapNode, QuestFlowEdge> | null>(null)
  const [hoveredMissionId, setHoveredMissionId] = useState<string | null>(null)
  const [cameraZoom, setCameraZoom] = useState(1)

  const cameraDuration = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ? 0
    : 150

  const fitMap = useCallback(() => {
    if (!instance) return
    void instance.fitView({
      padding: 0.08,
      minZoom: 0.4,
      maxZoom: 1.05,
      duration: cameraDuration,
    })
  }, [cameraDuration, instance])

  const nodes = useMemo<MapNode[]>(() => {
    const missionNodes: QuestFlowNode[] = chapter.missions.map((mission) => ({
      id: mission.id,
      type: 'quest',
      position: mission.position,
      draggable: false,
      selectable: true,
      connectable: false,
      focusable: false,
      zIndex: 3,
      data: {
        mission,
        progressState: progress[mission.id],
        evaluationStatus: evaluationStateByMissionId[mission.id]?.status,
        recommended: mission.id === recommendedMissionId,
        selected: mission.id === selectedMissionId,
        lockedReason: lockedReasons[mission.id],
        onSelect: onMissionSelect,
        onHover: setHoveredMissionId,
      },
    }))

    const junctionNodes: JunctionFlowNode[] = (chapter.junctions ?? []).map(
      (junction) => ({
        id: junction.id,
        type: 'junction',
        position: {
          x: junction.position.x - 3,
          y: junction.position.y - 3,
        },
        draggable: false,
        selectable: false,
        connectable: false,
        focusable: false,
        deletable: false,
        zIndex: 4,
        data: { decorative: true },
      }),
    )

    const territoryNodes: TerritoryFlowNode[] = (chapter.regions ?? []).map(
      (region) => ({
        id: region.id,
        type: 'territory',
        position: region.position,
        draggable: false,
        selectable: false,
        connectable: false,
        focusable: false,
        deletable: false,
        zIndex: 0,
        style: { width: region.width, height: region.height },
        data: { region },
      }),
    )

    return [...territoryNodes, ...missionNodes, ...junctionNodes]
  }, [
    chapter,
    evaluationStateByMissionId,
    lockedReasons,
    onMissionSelect,
    progress,
    recommendedMissionId,
    selectedMissionId,
  ])

  const edges = useMemo<QuestFlowEdge[]>(
    () => {
      const nodeTypeById = new Map(
        chapter.missions.map((mission) => [mission.id, mission.nodeType]),
      )

      return chapter.edges.map((edge) => {
        const sourceState = progress[edge.source]
        const targetState = progress[edge.target]
        const routeTier =
          sourceState === 'completed' && targetState === 'completed'
            ? 'traveled'
            : sourceState === 'completed' &&
                ['available', 'active', 'submitted'].includes(targetState)
              ? 'immediate'
              : 'future'

        return {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          type: 'quest',
          focusable: false,
          selectable: false,
          zIndex: 1,
          data: {
            progressState: deriveEdgeProgress(edge, progress),
            routeTier,
            optional: edge.optional ?? false,
            highlighted:
              hoveredMissionId === edge.source || hoveredMissionId === edge.target,
            leadsToMilestone: nodeTypeById.get(edge.target) === 'milestone',
            via: edge.via,
          },
        }
      })
    },
    [chapter.edges, chapter.missions, hoveredMissionId, progress],
  )

  useEffect(() => {
    if (!instance || recenterRequest === 0) return
    fitMap()
  }, [fitMap, instance, recenterRequest])

  useEffect(() => {
    if (!instance || !selectedMissionId || !mapContainerRef.current) return
    const mission = chapter.missions.find((item) => item.id === selectedMissionId)
    if (!mission) return

    const mapWidth = mapContainerRef.current.clientWidth
    const panelWidth = Math.min(460, Math.max(360, mapWidth * 0.32))
    const zoom = instance.getZoom()
    const size = getNodeDimension(mission)
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const centerX = mission.position.x + size / 2 + panelWidth / (2 * zoom)
    const centerY = mission.position.y + size / 2

    void instance.setCenter(centerX, centerY, {
      zoom,
      duration: reducedMotion ? 0 : 250,
    })
  }, [chapter.missions, instance, selectedMissionId])

  function handleKeyboardPan(event: KeyboardEvent<HTMLDivElement>) {
    if (!instance || event.target !== event.currentTarget) return
    const step = event.shiftKey ? 96 : 48
    const viewport = instance.getViewport()
    const offsets: Partial<Record<string, { x: number; y: number }>> = {
      ArrowLeft: { x: step, y: 0 },
      ArrowRight: { x: -step, y: 0 },
      ArrowUp: { x: 0, y: step },
      ArrowDown: { x: 0, y: -step },
    }
    const offset = offsets[event.key]
    if (!offset) return
    event.preventDefault()
    void instance.setViewport(
      {
        x: viewport.x + offset.x,
        y: viewport.y + offset.y,
        zoom: viewport.zoom,
      },
      { duration: 0 },
    )
  }

  return (
    <div
      ref={mapContainerRef}
      id="quest-map"
      className="quest-map"
      tabIndex={0}
      aria-label="Lienzo del mapa de misiones"
      aria-describedby="quest-map-instructions"
      onKeyDown={handleKeyboardPan}
    >
      <p id="quest-map-instructions" className="visually-hidden">
        Mapa de misiones. Usa Tab para recorrer las misiones y Enter para abrir sus detalles.
        Usa las flechas para desplazar el mapa y los controles para acercar, alejar o volver a
        encuadrar la ruta. El capítulo recorre tres territorios: Taller, desde la premisa hasta
        el ensamble; Campo, donde publicas, observas y decides; y Mercado, el destino de la
        primera pieza publicada.
      </p>
      <ReactFlow<MapNode, QuestFlowEdge>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onInit={setInstance}
        onMove={(_event, viewport) => setCameraZoom(viewport.zoom)}
        minZoom={0.4}
        maxZoom={1.5}
        fitView
        fitViewOptions={{ padding: 0.08, minZoom: 0.4, maxZoom: 1.05 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        nodesFocusable={false}
        edgesFocusable={false}
        zoomOnDoubleClick={false}
        panOnDrag
        zoomOnScroll
        zoomOnPinch
        preventScrolling
        aria-label="Mapa visual de misiones del Chapter 1"
        proOptions={{ hideAttribution: true }}
      />
      <MapControls
        zoom={cameraZoom}
        disabled={!instance}
        onZoomIn={() => void instance?.zoomIn({ duration: cameraDuration })}
        onZoomOut={() => void instance?.zoomOut({ duration: cameraDuration })}
        onFit={fitMap}
      />
    </div>
  )
}

export function QuestMap(props: QuestMapProps) {
  return (
    <ReactFlowProvider>
      <QuestMapCanvas {...props} />
    </ReactFlowProvider>
  )
}
