import { course } from '../../data/course.ts'
import type { ImplementationState, NextActionProposal } from '../../domain/course.ts'
import { deriveMissionProgress } from '../../domain/progression.ts'
import type { INextActionProposer, NextActionContext } from './types.ts'

export class CompanionService {
  private proposer: INextActionProposer

  constructor(proposer: INextActionProposer) {
    this.proposer = proposer
  }

  /**
   * Reason about the next best action within the deterministic graph boundaries.
   *
   * Invariants:
   * 1. The deterministic engine decides what missions are legally available.
   * 2. The Companion reasons ONLY among those allowed options.
   * 3. Proposing next action has ZERO side effects on ImplementationState.
   */
  async proposeNextAction(
    state: ImplementationState,
    clarification?: string | null,
  ): Promise<NextActionProposal> {
    const allCourseMissions = course.chapters.flatMap((chapter) => chapter.missions)
    const currentCompleted = new Set(state.completedMissionIds)
    const currentProgress = deriveMissionProgress(allCourseMissions, currentCompleted)

    // Allowed available missions
    const availableMissions = allCourseMissions.filter(
      (m) => currentProgress[m.id] === 'available' || currentProgress[m.id] === 'active',
    )

    if (availableMissions.length === 0) {
      return {
        type: 'RECOMMEND_MISSION',
        missionId: '',
        rationale: 'No hay más misiones disponibles en este capítulo.',
      }
    }

    if (availableMissions.length === 1 && !clarification) {
      return {
        type: 'RECOMMEND_MISSION',
        missionId: availableMissions[0].id,
        rationale: `Continuar con ${availableMissions[0].title}.`,
      }
    }

    const context: NextActionContext = {
      courseTitle: course.title,
      completedMissionIds: state.completedMissionIds,
      activeMissionId: state.activeMissionId,
      availableMissions: availableMissions.map((m) => ({
        id: m.id,
        title: m.title,
        description: m.description,
        nodeType: m.nodeType,
      })),
      verifiedArtifacts: state.artifacts,
      clarificationAnswer: clarification?.trim() || null,
    }

    const proposal = await this.proposer.proposeNextAction(context)

    // Runtime Legality Verification
    if (proposal.type === 'RECOMMEND_MISSION') {
      const isAllowed = availableMissions.some((m) => m.id === proposal.missionId)
      if (!isAllowed) {
        throw new Error(
          `Invalid recommendation: Mission '${proposal.missionId}' is locked or not in the allowed available set [${availableMissions.map((m) => m.id).join(', ')}]`,
        )
      }
    }

    return proposal
  }
}
