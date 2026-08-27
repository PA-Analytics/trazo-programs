import { resolvePack } from '../../data/packs/index.ts'
import type { ImplementationState } from '../../domain/course.ts'
import { deriveMissionProgress } from '../../domain/progression.ts'
import { adaptMethodologyGraphToCourse } from '../../domain/methodologyAdapter.ts'
import { MethodologyGraphRuntime } from '../../domain/methodologyRuntime.ts'
import type { MethodologyService } from '../methodologyService.ts'
import type { IImplementationRepository } from '../types.ts'
import { SystemClock } from './clock.ts'
import type { IClock, IStallDetector, LearnerStalledEventDTO } from './types.ts'

export interface StallDetectorOptions {
  thresholdMs?: number
  clock?: IClock
  methodologyService?: MethodologyService
}

export const DEFAULT_STALL_THRESHOLD_MS = 24 * 60 * 60 * 1000

export class StallDetector implements IStallDetector {
  private readonly implementationRepo: IImplementationRepository
  private readonly clock: IClock
  private readonly thresholdMs: number
  private readonly methodologyService?: MethodologyService

  constructor(
    implementationRepo: IImplementationRepository,
    options: StallDetectorOptions = {},
  ) {
    this.implementationRepo = implementationRepo
    this.clock = options.clock ?? new SystemClock()
    this.thresholdMs = options.thresholdMs ?? DEFAULT_STALL_THRESHOLD_MS
    this.methodologyService = options.methodologyService
  }

  async detectStalls(): Promise<LearnerStalledEventDTO[]> {
    const states = await this.implementationRepo.list()
    const events: LearnerStalledEventDTO[] = []

    for (const state of states) {
      const event = await this.evaluateState(state)
      if (event) {
        events.push(event)
      }
    }

    return events
  }

  async evaluateState(state: ImplementationState): Promise<LearnerStalledEventDTO | null> {
    if (!state.id || !state.courseId || !state.updatedAt) {
      return null
    }

    let methodology
    let course
    let runtime
    try {
      methodology = this.methodologyService
        ? await this.methodologyService.getForState(state)
        : undefined
      course = methodology ? adaptMethodologyGraphToCourse(methodology) : resolvePack(state.courseId)
      runtime = methodology ? new MethodologyGraphRuntime(methodology) : undefined
    } catch {
      return null
    }

    const allCourseMissions = course.chapters.flatMap((ch) => ch.missions)
    if (allCourseMissions.length === 0) {
      return null
    }

    const completedSet = new Set(state.completedMissionIds || [])
    const hasLearnerActivity = Boolean(
      state.activeMissionId || state.learnerSetup || state.completedMissionIds?.length,
    )
    if (!hasLearnerActivity) {
      return null
    }

    const missionProgress = runtime
      ? runtime.deriveProgress(completedSet, state.activeMissionId, state.workflowDecisions)
      : deriveMissionProgress(allCourseMissions, completedSet)

    const isWorkflowComplete = runtime
      ? runtime.isTerminalState(completedSet, state.workflowDecisions)
      : allCourseMissions.every((m) => completedSet.has(m.id))
    if (isWorkflowComplete) {
      return null
    }

    const availableMissions = allCourseMissions.filter(
      (m) => missionProgress[m.id] === 'available' || missionProgress[m.id] === 'active',
    )
    if (availableMissions.length === 0) {
      return null
    }

    let targetMissionId: string | undefined
    if (state.activeMissionId) {
      if (!allCourseMissions.some((mission) => mission.id === state.activeMissionId)) {
        return null
      }
      if (completedSet.has(state.activeMissionId)) {
        return null
      }
      if (missionProgress[state.activeMissionId] === 'locked') {
        return null
      }
      targetMissionId = state.activeMissionId
    } else {
      targetMissionId = availableMissions[0]?.id
    }

    if (!targetMissionId) {
      return null
    }

    const stateUpdatedAtMs = new Date(state.updatedAt).getTime()
    if (Number.isNaN(stateUpdatedAtMs)) {
      return null
    }

    const nowMs = this.clock.now().getTime()
    if (Number.isNaN(nowMs) || nowMs < stateUpdatedAtMs) {
      return null
    }
    const stallDurationMs = nowMs - stateUpdatedAtMs
    if (stallDurationMs < this.thresholdMs) {
      return null
    }

    const eventId = `stall-${encodeURIComponent(state.id)}-${encodeURIComponent(state.updatedAt)}`

    return {
      eventId,
      eventType: 'learner_stalled',
      implementationId: state.id,
      userId: state.userId,
      courseId: state.courseId,
      courseVersion: state.courseVersion || '1.0.0',
      observedStateUpdatedAt: state.updatedAt,
      idempotencyKey: eventId,
      stalledMissionId: targetMissionId,
      stallDurationMs,
    }
  }
}
