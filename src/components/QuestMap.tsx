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

type MapEntryPhase = 'commit' | 'tracing' | 'destination' | 'return' | 'ready' | 'settled'

const mapEntryCopy: Record<Exclude<MapEntryPhase, 'settled'>, { label: string; title: string }> = {
  commit: { label: 'Decisiones registradas', title: 'Trazando tu recorrido.' },
  tracing: { label: 'Ruta en marcha', title: 'Cada tramo abre el siguiente.' },
  destination: { label: 'Destino trazado', title: 'La ruta llega a su hito.' },
  return: { label: 'Punto de partida', title: 'Ahora el primer paso es tuyo.' },
  ready: { label: 'Primer movimiento', title: 'Todo empieza aquí.' },
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
    x: mission.position.x + dim + 60,
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
  preferredRouteTitle,
  destinationTitle,
  onSkip,
}: {
  phase: MapEntryPhase | null
  firstMissionTitle?: string
  preferredRouteTitle?: string
  destinationTitle?: string
  onSkip: () => void
}) {
  if (!phase || phase === 'settled') return null
  const copy = mapEntryCopy[phase]
  const showsFirstMission = phase === 'ready'
  const showsRoute = phase === 'commit' || phase === 'tracing'
  const showsDestination = phase === 'destination'

  return (
    <aside className={`quest-map-entry quest-map-entry--${phase}`} aria-label="Entrada al mapa">
      <p className="quest-map-entry__copy" aria-live="polite">
        <span>{copy.label}</span>
        <strong>{copy.title}</strong>
        {showsRoute && preferredRouteTitle && <small>Vía elegida: {preferredRouteTitle}</small>}
        {showsDestination && destinationTitle && <small>{destinationTitle}</small>}
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
  const previousMissionIdRef = useRef<string | null>(
    selectedMissionId ?? activeMissionId ?? chapter.missions[0]?.id ?? null,
  )
  const [instance, setInstance] = useState<ReactFlowInstance<MapNode, QuestFlowEdge> | null>(null)
  const [hoveredMissionId, setHoveredMissionId] = useState<string | null>(null)
  const [cameraZoom, setCameraZoom] = useState(1)
  const [companionContactMissionId, setCompanionContactMissionId] = useState<string | null>(
    () => selectedMissionId ?? activeMissionId ?? chapter.missions[0]?.id ?? null,
  )
  const [entryPhase, setEntryPhase] = useState<MapEntryPhase | null>(
    () => (entrySequence ? 'commit' : null),
  )
  const [entryJourneyStep, setEntryJourneyStep] = useState(-1)
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

  const entryJourney = useMemo(() => {
    const originId = firstActionableMission?.id
    const missionIds: string[] = originId ? [originId] : []
    const edgeIds: string[] = []
    const visited = new Set(missionIds)
    let currentId = originId

    while (currentId) {
      const candidates = chapter.edges.filter(
        (edge) => edge.source === currentId && corridor.corridorEdgeIds.has(edge.id),
      )
      const nextEdge =
        (currentId === originId && preferredRouteId
          ? candidates.find((edge) => edge.target === preferredRouteId)
          : undefined) ??
        candidates.find((edge) => !edge.optional && !visited.has(edge.target)) ??
        candidates.find((edge) => !visited.has(edge.target))

      if (!nextEdge) break
      edgeIds.push(nextEdge.id)
      missionIds.push(nextEdge.target)
      visited.add(nextEdge.target)
      currentId = nextEdge.target
    }

    const missionStepById = new Map(missionIds.map((missionId, index) => [missionId, index]))
    const edgeStepById = new Map(edgeIds.map((edgeId, index) => [edgeId, index]))
    const preferredMission = chapter.missions.find((mission) => mission.id === preferredRouteId)
    const destinationMission = chapter.missions.find((mission) => mission.id === missionIds.at(-1))

    return {
      missionIds: new Set(missionIds),
      edgeIds: new Set(edgeIds),
      orderedEdgeIds: edgeIds,
      missionStepById,
      edgeStepById,
      preferredRouteTitle: preferredMission?.title,
      destinationMission,
    }
  }, [chapter.edges, chapter.missions, corridor.corridorEdgeIds, firstActionableMission?.id, preferredRouteId])

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
    completeEntrySequence()
  }, [clearEntryTimers, completeEntrySequence, entrySequence])

  useEffect(() => {
    if (!entrySequence) {
      clearEntryTimers()
      entryRunRef.current = false
      setEntryPhase(null)
      setEntryJourneyStep(-1)
      return
    }
    if (!instance || !firstActionableMission || entryRunRef.current) return

    entryRunRef.current = true
    setEntryPhase('commit')
    setEntryJourneyStep(-1)
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

    const focusJourneyEdge = (edgeId: string, zoom: number) => {
      const edge = chapter.edges.find((candidate) => candidate.id === edgeId)
      if (!edge) return
      const source = chapter.missions.find((mission) => mission.id === edge.source)
      const target = chapter.missions.find((mission) => mission.id === edge.target)
      if (!source || !target) return

      const sourceSize = getNodeDimension(source)
      const targetSize = getNodeDimension(target)
      void instance.setCenter(
        (source.position.x + sourceSize / 2 + target.position.x + targetSize / 2) / 2,
        (source.position.y + sourceSize / 2 + target.position.y + targetSize / 2) / 2,
        { zoom, duration: 600 },
      )
    }

    const traceStart = 520
    const traceCadence = 680
    const traceTimers = entryJourney.orderedEdgeIds.map((edgeId, index) =>
      window.setTimeout(() => {
        setEntryPhase('tracing')
        setEntryJourneyStep(index)
        focusJourneyEdge(edgeId, index === 0 ? 0.64 : 0.7)
      }, traceStart + index * traceCadence),
    )
    const destinationDelay = traceStart + entryJourney.orderedEdgeIds.length * traceCadence + 80
    const destinationTimer = window.setTimeout(() => {
      setEntryPhase('destination')
      setEntryJourneyStep(entryJourney.orderedEdgeIds.length)
      const destination = entryJourney.destinationMission
      if (!destination) return
      const size = getNodeDimension(destination)
      void instance.setCenter(
        destination.position.x + size / 2,
        destination.position.y + size / 2,
        { zoom: 0.88, duration: 760 },
      )
    }, destinationDelay)
    const returnDelay = destinationDelay + 980
    const returnTimer = window.setTimeout(() => {
      setEntryPhase('return')
      const size = getNodeDimension(firstActionableMission)
      void instance.setCenter(
        firstActionableMission.position.x + size / 2,
        firstActionableMission.position.y + size / 2,
        { zoom: 0.74, duration: 900 },
      )
    }, returnDelay)
    const readyDelay = returnDelay + 1080
    const readyTimer = window.setTimeout(() => setEntryPhase('ready'), readyDelay)
    const completeTimer = window.setTimeout(completeEntrySequence, readyDelay + 620)
    entryTimersRef.current = [
      ...traceTimers,
      destinationTimer,
      returnTimer,
      readyTimer,
      completeTimer,
    ]

    return () => clearEntryTimers()
  }, [chapter.edges, chapter.missions, clearEntryTimers, completeEntrySequence, entryJourney, entrySequence, firstActionableMission, instance])

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
          entryRoute: entrySequence && entryJourney.missionIds.has(mission.id),
          entryRevealed:
            entrySequence &&
            (entryJourney.missionStepById.get(mission.id) ?? Number.POSITIVE_INFINITY) <=
              entryJourneyStep,
          entryCurrent:
            entrySequence &&
            entryPhase === 'tracing' &&
            entryJourney.missionStepById.get(mission.id) === entryJourneyStep + 1,
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
    entryJourney,
    entryJourneyStep,
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
            entryRoute: entrySequence && entryJourney.edgeIds.has(edge.id),
            entryRevealed:
              entrySequence &&
              (entryJourney.edgeStepById.get(edge.id) ?? Number.POSITIVE_INFINITY) < entryJourneyStep,
            entryCurrent:
              entrySequence &&
              entryPhase === 'tracing' &&
              entryJourney.edgeStepById.get(edge.id) === entryJourneyStep,
            via: edge.via,
          },
        }
      })
    },
    [chapter.edges, chapter.missions, corridor, entryJourney, entryJourneyStep, entryPhase, entrySequence, hoveredMissionId, progress],
  )

  useEffect(() => {
    if (!selectedMissionId || selectedMissionId === previousMissionIdRef.current) return
    const prevId = previousMissionIdRef.current ?? activeOrInitialMission?.id ?? chapter.missions[0]?.id ?? null
    previousMissionIdRef.current = selectedMissionId

    const targetMission = chapter.missions.find((item) => item.id === selectedMissionId)
    if (!targetMission) return

    const targetRestPos = getCompanionRestPosition(targetMission)

    if (prevId) {
      const prevMission = chapter.missions.find((item) => item.id === prevId)
      if (prevMission && prevMission.id !== targetMission.id) {
        const prevRestPos = getCompanionRestPosition(prevMission)
        const edge = chapter.edges.find(
          (item) =>
            (item.source === prevId && item.target === selectedMissionId) ||
            (item.target === prevId && item.source === selectedMissionId),
        )

        let edgePath: string
        if (edge && edge.via) {
          edgePath = smoothSplineThroughVia(
            prevRestPos.x,
            prevRestPos.y,
            targetRestPos.x,
            targetRestPos.y,
            edge.via,
          )
        } else if (edge) {
          const isForward = edge.source === prevId
          edgePath = getBezierPath({
            sourceX: prevRestPos.x,
            sourceY: prevRestPos.y,
            targetX: targetRestPos.x,
            targetY: targetRestPos.y,
            sourcePosition: isForward ? Position.Right : Position.Left,
            targetPosition: isForward ? Position.Left : Position.Right,
            curvature: 0.35,
          })[0]
        } else {
          const midX = (prevRestPos.x + targetRestPos.x) / 2
          const midY = (prevRestPos.y + targetRestPos.y) / 2 - 40
          edgePath = `M ${prevRestPos.x} ${prevRestPos.y} Q ${midX} ${midY} ${targetRestPos.x} ${targetRestPos.y}`
        }

        setCompanionContactMissionId(null)
        companionRef.current?.moveToNode(edgePath, selectedMissionId)
        return
      }
    }

    setCompanionContactMissionId(targetMission.id)
    companionRef.current?.teleportTo(targetRestPos)
  }, [activeOrInitialMission?.id, chapter.edges, chapter.missions, selectedMissionId])

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
      duration: reducedMotion ? 0 : 750,
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
      data-entry-phase={entrySequence ? entryPhase ?? 'commit' : undefined}
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
        preferredRouteTitle={entryJourney.preferredRouteTitle}
        destinationTitle={entryJourney.destinationMission?.title}
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
