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

export type MissionInteractionType =
  | 'CONVERSATION'
  | 'EVIDENCE_SUBMISSION'
  | 'AMBIGUOUS'

export interface MissionInteractionTurn {
  role: 'learner' | 'companion'
  content: string
}

export interface NextActionTurn {
  role: 'learner' | 'companion'
  content: string
}

export interface StructuredEvidenceEvaluation {
  interactionType?: MissionInteractionType
  message?: string
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
  | 'conversation'
  | 'ambiguous'
  | 'pass'
  | 'clarify'
  | 'rework'
  | 'human_review'
  | 'system_error'

export interface SystemEvaluationError {
  kind: 'SYSTEM_ERROR'
  userMessage: string
  debugCode?: string
}

export interface MissionEvaluationState {
  status: EvaluationStatus
  interactionType?: MissionInteractionType
  message?: string
  evaluation?: StructuredEvidenceEvaluation
  policyVerdict?: PolicyVerdict
  systemError?: SystemEvaluationError
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
  userId?: string
  coachId?: string
  courseId: string
  courseVersion?: string
  completedMissionIds: string[]
  activeMissionId?: string
  artifacts?: Record<string, ImplementationArtifact>
  learnerSetup?: LearnerSetup
  createdAt: string
  updatedAt: string
}

export type AvailableTime = '15_30_MIN' | '30_60_MIN' | '1_2_HOURS' | 'VARIES'
export type HelpPreference = 'DIRECT' | 'QUESTIONS' | 'EXAMPLE' | 'ADAPTIVE'

export interface LearnerSetup {
  goal: string
  availableTime: AvailableTime
  helpPreference: HelpPreference
  updatedAt: string
}

export type CalibrationExampleSource = 'creator' | 'generated'
export type CalibrationCaseQuality = 'clear_pass' | 'clear_rework' | 'borderline'
export type CalibrationVerdict = 'PASS' | 'REWORK' | 'CLARIFY'

export interface CalibrationExample {
  id: string
  source: CalibrationExampleSource
  submission: string
  caseQuality?: CalibrationCaseQuality
  verdict?: CalibrationVerdict
  reason?: string
  judgedAt?: string
}

export interface CreatorCalibration {
  missionId: string
  userId?: string
  initialStandard: string
  examples: CalibrationExample[]
  proposedRubric?: Rubric
  status: 'draft' | 'proposed' | 'confirmed'
  confirmedAt?: string
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
