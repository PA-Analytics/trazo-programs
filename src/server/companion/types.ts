import type { NextActionProposal, NextActionTurn } from '../../domain/course.ts'
import type { UserRole } from '../../domain/identity.ts'

export interface NextActionLatencyTrace {
  attempts: number
  promptBuildMs: number
  vertexMs: number
  validationMs: number
  promptCharacters: number
  outputCharacters: number
  promptTokens?: number
  outputTokens?: number
  thoughtsTokens?: number
  totalTokens?: number
}

export interface AvailableMissionSummary {
  id: string
  title: string
  description: string
  nodeType: string
}

export interface CompanionProfileContext {
  displayName: string
  role: UserRole
}

export interface NextActionContext {
  courseTitle: string
  completedMissionIds: string[]
  activeMissionId?: string
  availableMissions: AvailableMissionSummary[]
  verifiedArtifacts?: Record<string, unknown>
  clarificationAnswer?: string | null
  recentDecisionTurns?: NextActionTurn[]
  profile?: CompanionProfileContext
  onLatencyTrace?: (trace: NextActionLatencyTrace) => void
}

export interface INextActionProposer {
  proposeNextAction(context: NextActionContext): Promise<NextActionProposal>
}
