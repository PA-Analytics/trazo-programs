export type NodeType = 'normal' | 'optional' | 'milestone'

export type ProgressState =
  | 'locked'
  | 'available'
  | 'active'
  | 'submitted'
  | 'completed'

export type InteractionState = 'idle' | 'hovered' | 'selected' | 'focused'

export interface MapPosition {
  x: number
  y: number
}

export interface Mission {
  id: string
  title: string
  nodeType: NodeType
  progressState: ProgressState
  prerequisites?: string[]
  requiresAny?: string[]
  position: MapPosition
  description: string
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

export interface Chapter {
  id: string
  title: string
  shortTitle: string
  missions: Mission[]
  edges: MissionEdge[]
  junctions?: MapJunction[]
}

export interface Course {
  id: string
  title: string
  chapters: Chapter[]
}

export type MissionProgress = Record<string, ProgressState>

export type EdgeProgress = 'locked' | 'available' | 'completed'
