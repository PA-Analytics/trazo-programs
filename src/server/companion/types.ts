import type { NextActionProposal } from '../../domain/course.ts'

export interface AvailableMissionSummary {
  id: string
  title: string
  description: string
  nodeType: string
}

export interface NextActionContext {
  courseTitle: string
  completedMissionIds: string[]
  activeMissionId?: string
  availableMissions: AvailableMissionSummary[]
  verifiedArtifacts?: Record<string, unknown>
  clarificationAnswer?: string | null
}

export interface INextActionProposer {
  proposeNextAction(context: NextActionContext): Promise<NextActionProposal>
}
