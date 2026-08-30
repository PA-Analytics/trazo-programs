import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import {
  ReactFlow,
  ReactFlowProvider,
  type Node,
  type NodeTypes,
  type ReactFlowInstance,
  getBezierPath,
  Position,
} from '@xyflow/react'
import type {
  Chapter,
  MapPosition,
  Mission,
  MissionEvaluationState,
  MissionProgress,
} from '../domain/course'
import { deriveCorridor, deriveEdgeProgress } from '../domain/progression'
import { CompanionAvatar, type CompanionHandle } from './CompanionAvatar'
import { JunctionNode } from './JunctionNode'
import { MapControls } from './MapControls'
import { QuestEdge, smoothSplineThroughVia, type QuestFlowEdge } from './QuestEdge'
import { QuestNode, type QuestFlowNode } from './QuestNode'
import { TerritoryNode, type TerritoryFlowNode } from './TerritoryNode'

interface QuestMapProps {
  userId: string
  chapter: Chapter
  progress: MissionProgress
  evaluationStateByMissionId: Record<string, MissionEvaluationState>
  recommendedMissionId: string | null
  selectedMissionId: string | null
  lockedReasons: Record<string, string | undefined>
  recenterRequest: number
  onMissionSelect: (missionId: string) => void
  implementationId: string
  availableMissions: Mission[]
  onStartMission: (missionId: string) => Promise<void>
  onRecommendationChange: (missionId: string | null) => void
  activeMissionId?: string
  preferredRouteId?: string
  isEvaluating?: boolean
  isVerifiedAction?: boolean
  entrySequence?: boolean
  onEntrySequenceComplete?: () => void
}

interface JunctionNodeData extends Record<string, unknown> {
  decorative: true
}

type JunctionFlowNode = Node<JunctionNodeData, 'junction'>
type MapNode = QuestFlowNode | JunctionFlowNode | TerritoryFlowNode

type MapEntryPhase = 'world' | 'corridor' | 'nodes' | 'focus' | 'expand' | 'return' | 'settled'

const mapEntryCopy: Record<Exclude<MapEntryPhase, 'settled'>, { label: string; title: string }> = {
  world: { label: 'Territorio', title: 'El mapa se revela.' },
  corridor: { label: 'Ruta elegida', title: 'Tu corredor toma forma.' },
  nodes: { label: 'Puntos de acción', title: 'Cada paso ocupa su lugar.' },
  focus: { label: 'Primer paso', title: 'Aquí comienza todo.' },
  expand: { label: 'Más allá', title: 'La ruta tiene más de un camino.' },
  return: { label: 'Primer paso', title: 'Ahora te toca a ti.' },
}

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

function getCompanionRestPosition(mission: Mission): MapPosition {
  const dim = getNodeDimension(mission)
  return {
    x: mission.position.x + dim + 16,
    y: mission.position.y + dim / 2,
  }
}

function ViewportOverlay({
  containerRef,
  children,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>
  children: ReactNode
}) {
  const [viewportEl, setViewportEl] = useState<HTMLElement | null>(null)

  useEffect(() => {
    const el =
      (containerRef.current?.querySelector('.react-flow__viewport') as HTMLElement | null) ||
      (document.querySelector('.react-flow__viewport') as HTMLElement | null)
    if (el) {
      setViewportEl(el)
    }
  }, [containerRef])

  if (!viewportEl) {
    return <>{children}</>
  }

  return createPortal(children, viewportEl)
}

function MapEntryOverlay({
  phase,
  firstMissionTitle,
  onSkip,
}: {
  phase: MapEntryPhase | null
  firstMissionTitle?: string
  onSkip: () => void
}) {
  if (!phase || phase === 'settled') return null
  const copy = mapEntryCopy[phase]
  const showsFirstMission = phase === 'focus' || phase === 'return'

  return (
    <aside className={`quest-map-entry quest-map-entry--${phase}`} aria-label="Entrada al mapa">
      <p className="quest-map-entry__copy" aria-live="polite">
        <span>{copy.label}</span>
        <strong>{copy.title}</strong>
        {showsFirstMission && firstMissionTitle && <small>{firstMissionTitle}</small>}
      </p>
      <button type="button" className="quest-map-entry__skip" onClick={onSkip}>
        Omitir introducción
      </button>
    </aside>
  )
}

function QuestMapCanvas({
  userId,
  chapter,
  progress,
  evaluationStateByMissionId,
  recommendedMissionId,
  selectedMissionId,
  lockedReasons,
  recenterRequest,
  onMissionSelect,
  implementationId,
  availableMissions,
  onStartMission,
  onRecommendationChange,
  activeMissionId,
  preferredRouteId,
  isEvaluating,
  isVerifiedAction,
  entrySequence = false,
  onEntrySequenceComplete,
}: QuestMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const companionRef = useRef<CompanionHandle>(null)
  const previousMissionIdRef = useRef<string | null>(selectedMissionId || activeMissionId || null)
  const [instance, setInstance] = useState<ReactFlowInstance<MapNode, QuestFlowEdge> | null>(null)
  const [hoveredMissionId, setHoveredMissionId] = useState<string | null>(null)
  const [cameraZoom, setCameraZoom] = useState(1)
  const [companionContactMissionId, setCompanionContactMissionId] = useState<string | null>(
    () => selectedMissionId ?? activeMissionId ?? chapter.missions[0]?.id ?? null,
  )
  const [entryPhase, setEntryPhase] = useState<MapEntryPhase | null>(
    () => (entrySequence ? 'world' : null),
  )
  const entryRunRef = useRef(false)
  const entryTimersRef = useRef<number[]>([])

  const corridor = useMemo(
    () => deriveCorridor(chapter, preferredRouteId),
    [chapter, preferredRouteId],
  )

  const activeOrInitialMission =
    chapter.missions.find((m) => m.id === (selectedMissionId || activeMissionId)) ||
    chapter.missions[0]

  const firstActionableMission =
    chapter.missions.find((mission) =>
      ['available', 'active', 'submitted'].includes(progress[mission.id]),
    ) ?? chapter.missions[0]

  const companionInitialPos = useMemo(() => {
    if (!activeOrInitialMission) return { x: 0, y: 0 }
    return getCompanionRestPosition(activeOrInitialMission)
  }, [activeOrInitialMission])

  const handleCompanionTravelStart = useCallback(() => {
    setCompanionContactMissionId(null)
  }, [])

  const handleCompanionTravelComplete = useCallback((missionId: string) => {
    setCompanionContactMissionId(missionId)
  }, [])

  const cameraDuration =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
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

  const clearEntryTimers = useCallback(() => {
    for (const timer of entryTimersRef.current) window.clearTimeout(timer)
    entryTimersRef.current = []
  }, [])

  const completeEntrySequence = useCallback(() => {
    clearEntryTimers()
    setEntryPhase('settled')
    onEntrySequenceComplete?.()
  }, [clearEntryTimers, onEntrySequenceComplete])

  const skipEntrySequence = useCallback(() => {
    if (!entrySequence) return
    clearEntryTimers()
    if (instance) {
      void instance.fitView({
        padding: 0.08,
        minZoom: 0.4,
        maxZoom: 1.05,
        duration: 0,
      })
    }
    completeEntrySequence()
  }, [clearEntryTimers, completeEntrySequence, entrySequence, instance])

  useEffect(() => {
    if (!entrySequence) {
      clearEntryTimers()
      entryRunRef.current = false
      setEntryPhase(null)
      return
    }
    if (!instance || !firstActionableMission || entryRunRef.current) return

    entryRunRef.current = true
    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

    void instance.fitView({
      padding: 0.08,
      minZoom: 0.4,
      maxZoom: 1.05,
      duration: 0,
    })

    if (reducedMotion) {
      completeEntrySequence()
      return () => clearEntryTimers()
    }

    const firstMissionSize = getNodeDimension(firstActionableMission)
    const focusFirstMission = () => {
      setEntryPhase('focus')
      void instance.setCenter(
        firstActionableMission.position.x + firstMissionSize / 2,
        firstActionableMission.position.y + firstMissionSize / 2,
        { zoom: 0.94, duration: 700 },
      )
    }
    const revealWorld = window.setTimeout(() => setEntryPhase('corridor'), 720)
    const revealNodes = window.setTimeout(() => setEntryPhase('nodes'), 1520)
    const focusTimer = window.setTimeout(focusFirstMission, 2520)
    const expandTimer = window.setTimeout(() => {
      setEntryPhase('expand')
      fitMap()
    }, 3820)
    const returnTimer = window.setTimeout(() => {
      setEntryPhase('return')
      void instance.setCenter(
        firstActionableMission.position.x + firstMissionSize / 2,
        firstActionableMission.position.y + firstMissionSize / 2,
        { zoom: 0.86, duration: 700 },
      )
    }, 5050)
    const completeTimer = window.setTimeout(completeEntrySequence, 6250)
    entryTimersRef.current = [revealWorld, revealNodes, focusTimer, expandTimer, returnTimer, completeTimer]

    return () => clearEntryTimers()
  }, [clearEntryTimers, completeEntrySequence, entrySequence, firstActionableMission, fitMap, instance])

  const nodes = useMemo<MapNode[]>(() => {
    const missionNodes: QuestFlowNode[] = chapter.missions.map((mission) => {
      const isDimmed =
        corridor.hasBranching &&
        corridor.dimmedMissionIds.has(mission.id) &&
        !['completed', 'active', 'submitted'].includes(progress[mission.id])
      const isCorridor = corridor.corridorMissionIds.has(mission.id)

      return {
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
          isCorridor,
          isDimmed,
          companionContact: mission.id === companionContactMissionId,
          entryOrder: chapter.missions.indexOf(mission),
          entryLocked: entrySequence && entryPhase !== 'settled',
          entryFocus: entrySequence && mission.id === firstActionableMission?.id,
          onSelect: onMissionSelect,
          onHover: setHoveredMissionId,
        },
      }
    })

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
    corridor,
    companionContactMissionId,
    entryPhase,
    entrySequence,
    evaluationStateByMissionId,
    firstActionableMission,
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

        const isDimmed =
          corridor.hasBranching &&
          corridor.dimmedEdgeIds.has(edge.id) &&
          progress[edge.source] !== 'completed' &&
          progress[edge.target] !== 'completed'
        const isCorridor = corridor.corridorEdgeIds.has(edge.id)

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
            isCorridor,
            isDimmed,
            via: edge.via,
          },
        }
      })
    },
    [chapter.edges, chapter.missions, corridor, hoveredMissionId, progress],
  )

  useEffect(() => {
    if (!selectedMissionId || selectedMissionId === previousMissionIdRef.current) return
    const prevId = previousMissionIdRef.current
    previousMissionIdRef.current = selectedMissionId

    const targetMission = chapter.missions.find((item) => item.id === selectedMissionId)
    if (!targetMission) return

    const targetRestPos = getCompanionRestPosition(targetMission)

    if (prevId) {
      const edge = chapter.edges.find(
        (item) =>
          (item.source === prevId && item.target === selectedMissionId) ||
          (item.target === prevId && item.source === selectedMissionId),
      )
      const prevMission = chapter.missions.find((item) => item.id === prevId)
      if (edge && prevMission) {
        const prevDim = getNodeDimension(prevMission)
        const targetDim = getNodeDimension(targetMission)
        const isForward = edge.source === prevId
        const sourceX = isForward
          ? prevMission.position.x + prevDim
          : prevMission.position.x
        const sourceY = prevMission.position.y + prevDim / 2
        const targetX = isForward
          ? targetMission.position.x
          : targetMission.position.x + targetDim
        const targetY = targetMission.position.y + targetDim / 2

        const edgePath = edge.via
          ? smoothSplineThroughVia(sourceX, sourceY, targetX, targetY, edge.via)
          : getBezierPath({
              sourceX,
              sourceY,
              targetX,
              targetY,
              sourcePosition: isForward ? Position.Right : Position.Left,
              targetPosition: isForward ? Position.Left : Position.Right,
              curvature: 0.34,
            })[0]

        companionRef.current?.moveToNode(edgePath, selectedMissionId)
        return
      }

      if (prevMission) {
        const prevRestPos = getCompanionRestPosition(prevMission)
        const fallbackPath = `M ${prevRestPos.x} ${prevRestPos.y} L ${targetRestPos.x} ${targetRestPos.y}`
        companionRef.current?.moveToNode(fallbackPath, selectedMissionId)
        return
      }
    }

    setCompanionContactMissionId(targetMission.id)
    companionRef.current?.teleportTo(targetRestPos)
  }, [chapter.edges, chapter.missions, selectedMissionId])

  useEffect(() => {
    if (!instance || recenterRequest === 0) return
    fitMap()
  }, [fitMap, instance, recenterRequest])

  useEffect(() => {
    if (!instance || !mapContainerRef.current || selectedMissionId || !activeOrInitialMission) return
    if (mapContainerRef.current.clientWidth > 640) return

    const size = getNodeDimension(activeOrInitialMission)
    const timer = window.setTimeout(() => {
      void instance.setCenter(
        activeOrInitialMission.position.x + size / 2,
        activeOrInitialMission.position.y + size / 2,
        { zoom: 0.72, duration: 0 },
      )
    }, 80)

    return () => window.clearTimeout(timer)
  }, [activeOrInitialMission, instance, selectedMissionId])

  useEffect(() => {
    if (!instance || !selectedMissionId || !mapContainerRef.current) return
    const mission = chapter.missions.find((item) => item.id === selectedMissionId)
    if (!mission) return

    const mapWidth = mapContainerRef.current.clientWidth
    const panelWidth = Math.min(460, Math.max(360, mapWidth * 0.32))
    const zoom = instance.getZoom()
    const size = getNodeDimension(mission)
    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const centerX = mission.position.x + size / 2 + panelWidth / (2 * zoom)
    const centerY = mission.position.y + size / 2

    void instance.setCenter(centerX, centerY, {
      zoom,
      duration: reducedMotion ? 0 : 250,
    })
  }, [chapter.missions, instance, selectedMissionId])

  function handleKeyboardPan(event: KeyboardEvent<HTMLDivElement>) {
    if (!instance || event.target !== event.currentTarget || (entrySequence && entryPhase !== 'settled')) return
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
      data-entry-phase={entrySequence ? entryPhase ?? 'world' : undefined}
      data-entry-locked={entrySequence && entryPhase !== 'settled'}
      tabIndex={0}
      aria-busy={entrySequence && entryPhase !== 'settled'}
      aria-label="Lienzo del mapa de misiones"
      aria-describedby="quest-map-instructions"
      onKeyDown={handleKeyboardPan}
    >
      <p id="quest-map-instructions" className="visually-hidden">
        Mapa de misiones. Usa Tab para recorrer las misiones y Enter para abrir sus detalles.
        Usa las flechas para desplazar el mapa y los controles para acercar, alejar o volver a
        encuadrar la ruta.
        {chapter.regions && chapter.regions.length > 0 && (
          <> El capítulo recorre {chapter.regions.length} territorios: {chapter.regions.map((region) => `${region.title}, ${region.description.toLocaleLowerCase('es-MX')}`).join('; ')}.</>
        )}
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
        panOnDrag={!(entrySequence && entryPhase !== 'settled')}
        zoomOnScroll={!(entrySequence && entryPhase !== 'settled')}
        zoomOnPinch={!(entrySequence && entryPhase !== 'settled')}
        preventScrolling
        aria-label="Mapa visual de misiones"
        proOptions={{ hideAttribution: true }}
      >
        <ViewportOverlay containerRef={mapContainerRef}>
          <CompanionAvatar
            ref={companionRef}
            initialPosition={companionInitialPos}
            userId={userId}
            implementationId={implementationId}
            activeMissionId={activeMissionId}
            availableMissions={availableMissions}
            onStartMission={onStartMission}
            onSelectMission={onMissionSelect}
            onRecommendationChange={onRecommendationChange}
            onTravelStart={handleCompanionTravelStart}
            onTravelComplete={handleCompanionTravelComplete}
            isEvaluating={isEvaluating}
            isVerifiedAction={isVerifiedAction}
          />
        </ViewportOverlay>
      </ReactFlow>
      <MapEntryOverlay
        phase={entrySequence ? entryPhase : null}
        firstMissionTitle={firstActionableMission?.title}
        onSkip={skipEntrySequence}
      />
      <MapControls
        zoom={cameraZoom}
        disabled={!instance || (entrySequence && entryPhase !== 'settled')}
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
