import * as crypto from "node:crypto"
import type {
  ArtifactProductionSpec,
  EvidenceType,
  MapJunction,
  MapPosition,
  MapRegion,
  NodeType,
  MapRole,
  PolicyVerdict,
  Rubric,
} from "./course.ts"

export type EdgeType = "DEFAULT" | "CONDITIONAL" | "REMEDIATION" | "OPTIONAL"

export type EvidenceDecision = "ACCEPT" | "CLARIFY" | "REWORK" | "HUMAN_REVIEW"

export type MethodologyStatus = "draft" | "proposed" | "confirmed" | "active" | "archived"

export interface EdgeCondition {
  decision?: EvidenceDecision | EvidenceDecision[]
  verdict?: PolicyVerdict | PolicyVerdict[]
  priority?: number
  requiredArtifacts?: string[]
  metadata?: Record<string, unknown>
}

export interface MethodologyEdge {
  id: string
  source: string
  target: string
  type: EdgeType
  condition?: EdgeCondition
  priority?: number
  optional?: boolean
  via?: MapPosition
}

export interface CriteriaReference {
  coachId?: string
  courseId?: string
  missionId?: string
  version?: string
  criteriaSetId?: string
}

export interface MethodologyNode {
  id: string
  title: string
  nodeType: NodeType
  mapRole?: MapRole
  mapSubtitle?: string
  position: MapPosition
  description: string
  evidenceType: EvidenceType
  evidencePrompt: string
  evidenceCriteria: string
  rubric?: Rubric
  criteriaRef?: CriteriaReference
  producesArtifacts?: string[]
  artifactProductions?: ArtifactProductionSpec[]
  consumesArtifacts?: string[]
  prerequisites?: string[]
  requiresAny?: string[]
  isTerminal?: boolean
}

export interface MethodologyGraph {
  id: string
  coachId?: string
  courseId: string
  version: string
  status: MethodologyStatus
  entryNodeIds: string[]
  nodes: MethodologyNode[]
  edges: MethodologyEdge[]
  canonicalHash: string
  createdAt: string
  updatedAt: string
  title?: string
  description?: string
  junctions?: MapJunction[]
  regions?: MapRegion[]
}

export interface MethodologyGraphProvenance {
  methodologyId: string
  methodologyVersion: string
  canonicalHash: string
  coachId?: string
  courseId: string
}

export function computeMethodologyCanonicalHash(
  graph: Omit<MethodologyGraph, "canonicalHash"> | MethodologyGraph,
): string {
  const normalizedNodes = [...graph.nodes]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((node) => ({
      id: node.id,
      title: node.title,
      nodeType: node.nodeType,
      mapRole: node.mapRole ?? null,
      mapSubtitle: node.mapSubtitle ?? null,
      position: { x: node.position.x, y: node.position.y },
      description: node.description,
      evidenceType: node.evidenceType,
      evidencePrompt: node.evidencePrompt,
      evidenceCriteria: node.evidenceCriteria,
      criteriaRef: node.criteriaRef
        ? {
            coachId: node.criteriaRef.coachId ?? null,
            courseId: node.criteriaRef.courseId ?? null,
            missionId: node.criteriaRef.missionId ?? null,
            version: node.criteriaRef.version ?? null,
            criteriaSetId: node.criteriaRef.criteriaSetId ?? null,
          }
        : null,
      producesArtifacts: node.producesArtifacts ? [...node.producesArtifacts].sort() : null,
      artifactProductions: node.artifactProductions
        ? [...node.artifactProductions].sort((a, b) => a.key.localeCompare(b.key))
        : null,
      consumesArtifacts: node.consumesArtifacts ? [...node.consumesArtifacts].sort() : null,
      prerequisites: node.prerequisites ? [...node.prerequisites].sort() : null,
      requiresAny: node.requiresAny ? [...node.requiresAny].sort() : null,
      isTerminal: Boolean(node.isTerminal),
    }))

  const normalizedEdges = [...graph.edges]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: edge.type,
      priority: edge.priority ?? (edge.condition?.priority ?? 100),
      optional: Boolean(edge.optional),
      condition: edge.condition
        ? {
            decision: Array.isArray(edge.condition.decision)
              ? [...edge.condition.decision].sort()
              : edge.condition.decision ?? null,
            verdict: Array.isArray(edge.condition.verdict)
              ? [...edge.condition.verdict].sort()
              : edge.condition.verdict ?? null,
            priority: edge.condition.priority ?? null,
            requiredArtifacts: edge.condition.requiredArtifacts
              ? [...edge.condition.requiredArtifacts].sort()
              : null,
          }
        : null,
      via: edge.via ? { x: edge.via.x, y: edge.via.y } : null,
    }))

  const canonicalPayload = {
    id: graph.id,
    coachId: graph.coachId ?? null,
    courseId: graph.courseId,
    version: graph.version,
    status: graph.status,
    entryNodeIds: [...graph.entryNodeIds].sort(),
    nodes: normalizedNodes,
    edges: normalizedEdges,
  }

  return crypto
    .createHash("sha256")
    .update(JSON.stringify(canonicalPayload))
    .digest("hex")
}
