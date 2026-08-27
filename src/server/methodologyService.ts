import type { Course, ImplementationState } from '../domain/course.ts'
import { resolvePack } from '../data/packs/index.ts'
import {
  adaptCourseToMethodologyGraph,
  adaptMethodologyGraphToCourse,
} from '../domain/methodologyAdapter.ts'
import { MethodologyGraphRuntime } from '../domain/methodologyRuntime.ts'
import type { MethodologyGraph } from '../domain/methodology.ts'
import { validateMethodologyGraph } from '../domain/methodologyValidation.ts'
import type { ICalibrationRepository, IMethodologyRepository } from './types.ts'

export interface MethodologyWorkflowView {
  methodology: MethodologyGraph
  course: Course
  progress: Record<string, string>
  legalNextMissionIds: string[]
  terminal: boolean
}

export class MethodologyService {
  private readonly repository: IMethodologyRepository
  private readonly calibrationRepository?: ICalibrationRepository

  constructor(
    repository: IMethodologyRepository,
    calibrationRepository?: ICalibrationRepository,
  ) {
    this.repository = repository
    this.calibrationRepository = calibrationRepository
  }

  async save(graph: MethodologyGraph): Promise<MethodologyGraph> {
    validateMethodologyGraph(graph, {
      expectedCoachId: graph.coachId,
      expectedCourseId: graph.courseId,
      requireCanonicalHash: true,
    })
    for (const node of graph.nodes) {
      const reference = node.criteriaRef
      if (!reference) continue
      if (
        reference.coachId !== graph.coachId ||
        reference.courseId !== graph.courseId ||
        (reference.missionId || node.id) !== node.id
      ) {
        throw new Error(`Criteria reference for node '${node.id}' crosses methodology ownership or mission scope`)
      }
      if (!this.calibrationRepository || !graph.coachId) {
        throw new Error(`Criteria reference for node '${node.id}' requires a coach-scoped calibration repository`)
      }
      const calibration = await this.calibrationRepository.getByMissionId(
        node.id,
        undefined,
        graph.courseId,
        graph.coachId,
        reference.version,
      )
      if (
        !calibration ||
        calibration.status !== 'confirmed' ||
        (reference.criteriaSetId && calibration.proposedRubric?.id !== reference.criteriaSetId)
      ) {
        throw new Error(`Criteria reference for node '${node.id}' was not found in the same coach/course scope`)
      }
    }
    await this.repository.save(graph)
    return structuredClone(graph)
  }

  async resolveGraph(
    courseId: string,
    coachId?: string,
    methodologyId?: string,
    version?: string,
  ): Promise<MethodologyGraph> {
    if (methodologyId && version) {
      const pinned = await this.repository.getVersion(coachId, courseId, methodologyId, version)
      if (!pinned && methodologyId !== courseId) {
        throw new Error(`Methodology '${methodologyId}' version '${version}' not found for this workflow scope`)
      }
      if (!pinned) {
        const legacy = adaptCourseToMethodologyGraph(resolvePack(courseId), coachId, version)
        validateMethodologyGraph(legacy, { expectedCoachId: coachId, expectedCourseId: courseId, expectedVersion: version, requireCanonicalHash: true })
        return legacy
      }
      validateMethodologyGraph(pinned, { expectedCoachId: coachId, expectedCourseId: courseId, expectedVersion: version, requireCanonicalHash: true })
      return pinned
    }

    if (coachId) {
      const active = await this.repository.getActive(coachId, courseId)
      if (methodologyId && active && active.id !== methodologyId) {
        throw new Error(
          `Methodology '${methodologyId}' is not the active methodology for coach '${coachId}' and course '${courseId}'.`,
        )
      }
      if (active && (!methodologyId || active.id === methodologyId)) {
        validateMethodologyGraph(active, { expectedCoachId: coachId, expectedCourseId: courseId, requireCanonicalHash: true })
        return active
      }
    }

    const pack = resolvePack(courseId)
    const graph = adaptCourseToMethodologyGraph(pack, coachId, version || '1.0.0')
    validateMethodologyGraph(graph, { expectedCoachId: coachId, expectedCourseId: courseId, requireCanonicalHash: true })
    return graph
  }

  async getForState(state: ImplementationState): Promise<MethodologyGraph> {
    if (state.methodologyId && state.methodologyVersion) {
      return this.resolveGraph(state.courseId, state.coachId, state.methodologyId, state.methodologyVersion)
    }
    return this.resolveGraph(state.courseId, state.coachId)
  }

  async getRuntimeForState(state: ImplementationState): Promise<MethodologyGraphRuntime> {
    return new MethodologyGraphRuntime(await this.getForState(state))
  }

  async getWorkflowView(state: ImplementationState): Promise<MethodologyWorkflowView> {
    const methodology = await this.getForState(state)
    const runtime = new MethodologyGraphRuntime(methodology)
    const completed = new Set(state.completedMissionIds)
    const progress = runtime.deriveProgress(completed, state.activeMissionId, state.workflowDecisions)
    return {
      methodology,
      course: adaptMethodologyGraphToCourse(methodology),
      progress,
      legalNextMissionIds: runtime.getLegalAvailableNodes(completed, state.activeMissionId, state.workflowDecisions).map((node) => node.id),
      terminal: runtime.isTerminalState(completed, state.workflowDecisions),
    }
  }
}
