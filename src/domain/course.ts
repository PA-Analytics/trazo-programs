export type NodeType = 'normal' | 'optional' | 'milestone'

export type MapRole = 'entry' | 'convergence'

export type MapRegionVariant = 'workshop' | 'field' | 'market'

export type ProgressState =
  | 'locked'
  | 'available'
  | 'active'
  | 'submitted'
  | 'completed'

export type InteractionState = 'idle' | 'hovered' | 'selected' | 'focused'

export type EvidenceType = 'text' | 'url'

export interface MapPosition {
  x: number
  y: number
}

export interface RubricCriterion {
  id: string
  label: string
  description: string
  isRequired: boolean
}

export interface Rubric {
  id: string
  version: string
  criteria: RubricCriterion[]
  systemInstructions?: string
}

export type CriterionVerdict = 'PASS' | 'NOT_MET' | 'UNVERIFIABLE'

export interface CriterionResult {
  criterionId: string
  status: CriterionVerdict
  rationale: string
}

export type AgentRecommendation = 'PASS' | 'CLARIFY' | 'REWORK' | 'HUMAN_REVIEW'

export type PolicyVerdict = 'PASS' | 'CLARIFY' | 'REWORK' | 'HUMAN_REVIEW'

export interface StructuredEvidenceEvaluation {
  criteria: CriterionResult[]
  coachingFeedback: string
  confidence?: number
  recommendation?: AgentRecommendation
  evaluationId?: string
  submissionId?: string
  missionId?: string
  evaluatedAt?: string
}

export type NextActionProposal =
  | {
      type: 'ASK_CLARIFICATION'
      question: string
      rationale: string
    }
  | {
      type: 'RECOMMEND_MISSION'
      missionId: string
      rationale: string
    }

export type EvaluationStatus =
  | 'idle'
  | 'evaluating'
  | 'pass'
  | 'clarify'
  | 'rework'
  | 'human_review'
  | 'error'

export interface MissionEvaluationState {
  status: EvaluationStatus
  evaluation?: StructuredEvidenceEvaluation
  policyVerdict?: PolicyVerdict
  errorMessage?: string
}

export interface ImplementationArtifact<T = unknown> {
  key: string
  sourceMissionId: string
  value: T
  createdAt: string
  updatedAt: string
}

export interface PremiseArtifactValue {
  statement: string
}

export interface DirectStructureArtifactValue {
  variant: 'direct'
  content: string
  sourcePremiseArtifactId?: string
}

export interface NarrativeStructureArtifactValue {
  variant: 'narrative'
  content: string
  sourcePremiseArtifactId?: string
}

export interface ImplementationState {
  id: string
  courseId: string
  courseVersion?: string
  completedMissionIds: string[]
  activeMissionId?: string
  artifacts?: Record<string, ImplementationArtifact>
  createdAt: string
  updatedAt: string
}

export interface Mission {
  id: string
  title: string
  nodeType: NodeType
  mapRole?: MapRole
  mapSubtitle?: string
  progressState: ProgressState
  prerequisites?: string[]
  requiresAny?: string[]
  position: MapPosition
  description: string
  evidenceType: EvidenceType
  evidencePrompt: string
  evidenceCriteria: string
  rubric?: Rubric
  producesArtifacts?: string[]
  consumesArtifacts?: string[]
}

export interface MissionEdge {
  id: string
  source: string
  target: string
  optional?: boolean
  via?: MapPosition
}

export interface MapJunction {
  id: string
  position: MapPosition
}

export interface MapRegion {
  id: string
  title: string
  description: string
  sequence?: string[]
  variant: MapRegionVariant
  position: MapPosition
  width: number
  height: number
}

export interface Chapter {
  id: string
  title: string
  shortTitle: string
  mapPromise?: string
  missions: Mission[]
  edges: MissionEdge[]
  junctions?: MapJunction[]
  regions?: MapRegion[]
}

export interface Course {
  id: string
  title: string
  chapters: Chapter[]
}

export type MissionProgress = Record<string, ProgressState>

export type EdgeProgress = 'locked' | 'available' | 'completed'
