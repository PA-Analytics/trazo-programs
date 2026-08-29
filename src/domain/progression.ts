import type {
  Chapter,
  EdgeProgress,
  Mission,
  MissionEdge,
  MissionProgress,
} from './course'

export interface CorridorState {
  corridorMissionIds: Set<string>
  corridorEdgeIds: Set<string>
  dimmedMissionIds: Set<string>
  dimmedEdgeIds: Set<string>
  hasBranching: boolean
}

export function deriveCorridor(
  chapter: Chapter,
  preferredRouteId?: string,
): CorridorState {
  const allMissionIds = new Set(chapter.missions.map((m) => m.id))
  const allEdgeIds = new Set(chapter.edges.map((e) => e.id))

  const outgoingBySource = new Map<string, MissionEdge[]>()
  for (const edge of chapter.edges) {
    const list = outgoingBySource.get(edge.source) ?? []
    list.push(edge)
    outgoingBySource.set(edge.source, list)
  }

  const forkEntries = [...outgoingBySource.entries()].filter(([, edges]) => edges.length > 1)
  const hasBranching = forkEntries.length > 0

  if (!hasBranching || !preferredRouteId || !allMissionIds.has(preferredRouteId)) {
    return {
      corridorMissionIds: allMissionIds,
      corridorEdgeIds: allEdgeIds,
      dimmedMissionIds: new Set(),
      dimmedEdgeIds: new Set(),
      hasBranching,
    }
  }

  const relevantFork = forkEntries.find(([, edges]) =>
    edges.some((edge) => edge.target === preferredRouteId),
  )

  if (!relevantFork) {
    return {
      corridorMissionIds: allMissionIds,
      corridorEdgeIds: allEdgeIds,
      dimmedMissionIds: new Set(),
      dimmedEdgeIds: new Set(),
      hasBranching,
    }
  }

  const [, forkEdges] = relevantFork
  const otherBranchRoots = forkEdges
    .map((e) => e.target)
    .filter((target) => target !== preferredRouteId)

  const convergenceNodeIds = new Set(
    chapter.missions
      .filter((m) => (m.requiresAny && m.requiresAny.length > 1) || m.mapRole === 'convergence')
      .map((m) => m.id),
  )

  const dimmedMissionIds = new Set<string>()
  const queue = [...otherBranchRoots]

  while (queue.length > 0) {
    const current = queue.shift()!
    if (dimmedMissionIds.has(current) || convergenceNodeIds.has(current)) continue
    dimmedMissionIds.add(current)

    const nextEdges = outgoingBySource.get(current) ?? []
    for (const nextEdge of nextEdges) {
      if (!dimmedMissionIds.has(nextEdge.target) && !convergenceNodeIds.has(nextEdge.target)) {
        queue.push(nextEdge.target)
      }
    }
  }

  const dimmedEdgeIds = new Set<string>()
  for (const edge of chapter.edges) {
    if (dimmedMissionIds.has(edge.source) || dimmedMissionIds.has(edge.target)) {
      dimmedEdgeIds.add(edge.id)
    }
  }

  const corridorMissionIds = new Set(
    [...allMissionIds].filter((id) => !dimmedMissionIds.has(id)),
  )
  const corridorEdgeIds = new Set(
    [...allEdgeIds].filter((id) => !dimmedEdgeIds.has(id)),
  )

  return {
    corridorMissionIds,
    corridorEdgeIds,
    dimmedMissionIds,
    dimmedEdgeIds,
    hasBranching: true,
  }
}

function requirementsAreMet(mission: Mission, completed: ReadonlySet<string>) {
  const allRequired =
    !mission.prerequisites ||
    mission.prerequisites.every((missionId) => completed.has(missionId))
  const anyRequired =
    !mission.requiresAny ||
    mission.requiresAny.some((missionId) => completed.has(missionId))

  return allRequired && anyRequired
}

export function deriveMissionProgress(
  missions: Mission[],
  completed: ReadonlySet<string>,
): MissionProgress {
  return Object.fromEntries(
    missions.map((mission) => {
      if (completed.has(mission.id) || mission.progressState === 'completed') {
        return [mission.id, 'completed']
      }

      if (!requirementsAreMet(mission, completed)) {
        return [mission.id, 'locked']
      }

      const unlockedState =
        mission.progressState === 'locked' ? 'available' : mission.progressState
      return [mission.id, unlockedState]
    }),
  )
}

export function deriveEdgeProgress(
  edge: MissionEdge,
  progress: MissionProgress,
): EdgeProgress {
  if (progress[edge.source] === 'completed') {
    return 'completed'
  }

  if (progress[edge.source] !== 'locked' && progress[edge.target] !== 'locked') {
    return 'available'
  }

  return 'locked'
}

export function getBlockingMissionTitles(
  mission: Mission,
  missions: Mission[],
  completed: ReadonlySet<string>,
) {
  const titleById = new Map(missions.map((item) => [item.id, item.title]))
  const requiredAll = (mission.prerequisites ?? [])
    .filter((id) => !completed.has(id))
    .map((id) => titleById.get(id) ?? id)
  const requiresOne = mission.requiresAny?.some((id) => completed.has(id))
    ? []
    : (mission.requiresAny ?? []).map((id) => titleById.get(id) ?? id)

  return { requiredAll, requiresOne }
}

export function formatLockedReason(
  mission: Mission,
  missions: Mission[],
  completed: ReadonlySet<string>,
) {
  const { requiredAll, requiresOne } = getBlockingMissionTitles(
    mission,
    missions,
    completed,
  )

  if (requiresOne.length > 0) {
    return `Completa una de estas misiones: ${requiresOne.join(' o ')}.`
  }

  if (requiredAll.length > 0) {
    return `Completa primero: ${requiredAll.join(', ')}.`
  }

  return 'Esta misión todavía no está disponible.'
}
