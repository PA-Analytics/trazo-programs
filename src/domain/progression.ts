import type {
  EdgeProgress,
  Mission,
  MissionEdge,
  MissionProgress,
} from './course'

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
