import type { PolicyVerdict } from './course.ts'
import {
  computeMethodologyCanonicalHash,
  type EdgeCondition,
  type EdgeType,
  type EvidenceDecision,
  type MethodologyEdge,
  type MethodologyGraph,
  type MethodologyNode,
  type MethodologyStatus,
} from './methodology.ts'

export class MethodologyValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MethodologyValidationError'
  }
}

const VALID_EDGE_TYPES: ReadonlySet<EdgeType> = new Set([
  'DEFAULT',
  'CONDITIONAL',
  'REMEDIATION',
  'OPTIONAL',
])

const VALID_EVIDENCE_DECISIONS: ReadonlySet<EvidenceDecision> = new Set([
  'ACCEPT',
  'CLARIFY',
  'REWORK',
  'HUMAN_REVIEW',
])

const VALID_POLICY_VERDICTS: ReadonlySet<PolicyVerdict> = new Set([
  'PASS',
  'CLARIFY',
  'REWORK',
  'HUMAN_REVIEW',
])

const VALID_STATUSES: ReadonlySet<MethodologyStatus> = new Set([
  'draft',
  'proposed',
  'confirmed',
  'active',
  'archived',
])

export interface ValidationOptions {
  expectedCoachId?: string
  expectedCourseId?: string
  expectedVersion?: string
  requireCanonicalHash?: boolean
}

export function validateMethodologyGraph(
  raw: unknown,
  options?: ValidationOptions,
): { valid: true; hash: string } {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new MethodologyValidationError('Methodology graph must be a non-null object.')
  }

  const g = raw as Partial<MethodologyGraph>

  if (!g.id || typeof g.id !== 'string' || !g.id.trim()) {
    throw new MethodologyValidationError('Methodology graph requires a non-empty id.')
  }

  if (!g.courseId || typeof g.courseId !== 'string' || !g.courseId.trim()) {
    throw new MethodologyValidationError('Methodology graph requires a non-empty courseId.')
  }
  if (options?.expectedCourseId && g.courseId !== options.expectedCourseId) {
    throw new MethodologyValidationError(
      `Course mismatch: graph courseId '${g.courseId}' does not match expected '${options.expectedCourseId}'.`,
    )
  }

  if (g.coachId !== undefined) {
    if (typeof g.coachId !== 'string' || !g.coachId.trim()) {
      throw new MethodologyValidationError('coachId if present must be a non-empty string.')
    }
    if (options?.expectedCoachId && g.coachId !== options.expectedCoachId) {
      throw new MethodologyValidationError(
        `Coach mismatch: graph coachId '${g.coachId}' does not match expected '${options.expectedCoachId}'.`,
      )
    }
  } else if (options?.expectedCoachId) {
    throw new MethodologyValidationError(
      `Coach mismatch: graph has no coachId but expected '${options.expectedCoachId}'.`,
    )
  }

  if (!g.version || typeof g.version !== 'string' || !g.version.trim()) {
    throw new MethodologyValidationError('Methodology graph requires a non-empty version.')
  }
  if (options?.expectedVersion && g.version !== options.expectedVersion) {
    throw new MethodologyValidationError(
      `Version mismatch: graph version '${g.version}' does not match expected '${options.expectedVersion}'.`,
    )
  }

  if (!g.status || !VALID_STATUSES.has(g.status)) {
    throw new MethodologyValidationError(
      `Invalid methodology status '${String(g.status)}'. Must be one of draft, proposed, confirmed, active, archived.`,
    )
  }

  if (!Array.isArray(g.entryNodeIds) || g.entryNodeIds.length === 0) {
    throw new MethodologyValidationError('Methodology graph must have at least one entryNodeId.')
  }
  for (const entryId of g.entryNodeIds) {
    if (typeof entryId !== 'string' || !entryId.trim()) {
      throw new MethodologyValidationError('entryNodeIds contains invalid non-string entry.')
    }
  }

  if (!Array.isArray(g.nodes) || g.nodes.length === 0) {
    throw new MethodologyValidationError('Methodology graph must contain at least one node.')
  }

  const nodeIds = new Set<string>()
  for (const node of g.nodes) {
    validateNode(node, g as MethodologyGraph)
    if (nodeIds.has(node.id)) {
      throw new MethodologyValidationError(`Duplicate node id '${node.id}' in methodology graph.`)
    }
    nodeIds.add(node.id)
  }

  for (const entryId of g.entryNodeIds) {
    if (!nodeIds.has(entryId)) {
      throw new MethodologyValidationError(
        `entryNodeId '${entryId}' does not exist in graph nodes.`,
      )
    }
  }

  if (!Array.isArray(g.edges)) {
    throw new MethodologyValidationError('Methodology graph edges must be an array.')
  }

  const edgeIds = new Set<string>()
  for (const edge of g.edges) {
    validateEdge(edge, nodeIds)
    if (edgeIds.has(edge.id)) {
      throw new MethodologyValidationError(`Duplicate edge id '${edge.id}' in methodology graph.`)
    }
    edgeIds.add(edge.id)
  }

  // Validate node prerequisites reference existing nodes
  for (const node of g.nodes) {
    if (node.prerequisites) {
      for (const prereqId of node.prerequisites) {
        if (!nodeIds.has(prereqId)) {
          throw new MethodologyValidationError(
            `Node '${node.id}' has unknown prerequisite '${prereqId}'.`,
          )
        }
        if (prereqId === node.id) {
          throw new MethodologyValidationError(
            `Node '${node.id}' cannot have itself as a prerequisite.`,
          )
        }
      }
    }
    if (node.requiresAny) {
      for (const reqId of node.requiresAny) {
        if (!nodeIds.has(reqId)) {
          throw new MethodologyValidationError(
            `Node '${node.id}' has unknown requiresAny target '${reqId}'.`,
          )
        }
        if (reqId === node.id) {
          throw new MethodologyValidationError(
            `Node '${node.id}' cannot have itself in requiresAny.`,
          )
        }
      }
    }

    if (node.isTerminal) {
      const outgoingDefault = g.edges.filter(
        (e) => e.source === node.id && (e.type === 'DEFAULT' || e.type === 'CONDITIONAL'),
      )
      if (outgoingDefault.length > 0) {
        throw new MethodologyValidationError(
          `Terminal node '${node.id}' cannot have forward outgoing DEFAULT/CONDITIONAL edges.`,
        )
      }
    }
  }

  // Illegal forward cycle detection (DAG validation for DEFAULT, CONDITIONAL, OPTIONAL edges)
  validateNoIllegalCycles(g.nodes, g.edges)

  const computedHash = computeMethodologyCanonicalHash(g as MethodologyGraph)
  if (options?.requireCanonicalHash || g.canonicalHash !== undefined) {
    if (!g.canonicalHash || typeof g.canonicalHash !== 'string') {
      throw new MethodologyValidationError('Methodology graph is missing required canonicalHash.')
    }
    if (g.canonicalHash !== computedHash) {
      throw new MethodologyValidationError(
        `Methodology canonicalHash mismatch. Expected '${computedHash}', got '${g.canonicalHash}'.`,
      )
    }
  }

  return { valid: true, hash: computedHash }
}

function validateNode(node: unknown, graph: MethodologyGraph): void {
  if (node === null || typeof node !== 'object') {
    throw new MethodologyValidationError('Node must be an object.')
  }
  const n = node as Partial<MethodologyNode>

  if (!n.id || typeof n.id !== 'string' || !n.id.trim()) {
    throw new MethodologyValidationError('Node requires a non-empty id.')
  }
  if (!n.title || typeof n.title !== 'string' || !n.title.trim()) {
    throw new MethodologyValidationError(`Node '${n.id || 'unknown'}' requires a title.`)
  }
  if (!n.nodeType || !['normal', 'optional', 'milestone'].includes(n.nodeType)) {
    throw new MethodologyValidationError(
      `Node '${n.id}' has invalid nodeType '${String(n.nodeType)}'.`,
    )
  }
  if (
    !n.position ||
    typeof n.position.x !== 'number' ||
    typeof n.position.y !== 'number' ||
    !Number.isFinite(n.position.x) ||
    !Number.isFinite(n.position.y)
  ) {
    throw new MethodologyValidationError(`Node '${n.id}' requires valid position {x, y}.`)
  }
  if (typeof n.description !== 'string') {
    throw new MethodologyValidationError(`Node '${n.id}' requires a description string.`)
  }
  if (!n.evidenceType || !['text', 'url'].includes(n.evidenceType)) {
    throw new MethodologyValidationError(`Node '${n.id}' has invalid evidenceType.`)
  }

  if (n.criteriaRef) {
    if (n.criteriaRef.courseId && n.criteriaRef.courseId !== graph.courseId) {
      throw new MethodologyValidationError(
        `Node '${n.id}' criteriaRef courseId '${n.criteriaRef.courseId}' must match graph courseId '${graph.courseId}'.`,
      )
    }
    if (n.criteriaRef.coachId && graph.coachId && n.criteriaRef.coachId !== graph.coachId) {
      throw new MethodologyValidationError(
        `Node '${n.id}' criteriaRef coachId '${n.criteriaRef.coachId}' must match graph coachId '${graph.coachId}'.`,
      )
    }
    if (n.criteriaRef.missionId && n.criteriaRef.missionId !== n.id) {
      throw new MethodologyValidationError(
        `Node '${n.id}' criteriaRef missionId '${n.criteriaRef.missionId}' must match node id '${n.id}'.`,
      )
    }
  }

  if (n.artifactProductions && n.producesArtifacts) {
    const declared = new Set(n.producesArtifacts)
    for (const spec of n.artifactProductions) {
      if (!declared.has(spec.key)) {
        throw new MethodologyValidationError(
          `Node '${n.id}' artifactProduction '${spec.key}' is not declared in producesArtifacts.`,
        )
      }
    }
    const specKeys = new Set(n.artifactProductions.map((s) => s.key))
    for (const key of n.producesArtifacts) {
      if (!specKeys.has(key)) {
        throw new MethodologyValidationError(
          `Node '${n.id}' declares artifact '${key}' without production spec.`,
        )
      }
    }
  }
}

function validateEdge(edge: unknown, nodeIds: Set<string>): void {
  if (edge === null || typeof edge !== 'object') {
    throw new MethodologyValidationError('Edge must be an object.')
  }
  const e = edge as Partial<MethodologyEdge>

  if (!e.id || typeof e.id !== 'string' || !e.id.trim()) {
    throw new MethodologyValidationError('Edge requires a non-empty id.')
  }
  if (!e.source || typeof e.source !== 'string' || !nodeIds.has(e.source)) {
    throw new MethodologyValidationError(
      `Edge '${e.id || 'unknown'}' source '${String(e.source)}' does not exist in graph nodes.`,
    )
  }
  if (!e.target || typeof e.target !== 'string' || !nodeIds.has(e.target)) {
    throw new MethodologyValidationError(
      `Edge '${e.id || 'unknown'}' target '${String(e.target)}' does not exist in graph nodes.`,
    )
  }
  if (e.source === e.target) {
    throw new MethodologyValidationError(
      `Edge '${e.id}' is an illegal self-edge (source equals target '${e.source}').`,
    )
  }
  if (!e.type || !VALID_EDGE_TYPES.has(e.type)) {
    throw new MethodologyValidationError(
      `Edge '${e.id}' has invalid edge type '${String(e.type)}'.`,
    )
  }
  if (e.priority !== undefined && (!Number.isFinite(e.priority) || e.priority < 0)) {
    throw new MethodologyValidationError(
      `Edge '${e.id}' priority must be a finite non-negative number.`,
    )
  }

  if (e.condition) {
    validateEdgeCondition(e.id, e.condition)
  }
}

function validateEdgeCondition(edgeId: string, cond: EdgeCondition): void {
  if (cond === null || typeof cond !== 'object') {
    throw new MethodologyValidationError(`Edge '${edgeId}' condition must be an object.`)
  }

  if (cond.decision !== undefined) {
    const decisions = Array.isArray(cond.decision) ? cond.decision : [cond.decision]
    for (const d of decisions) {
      if (!VALID_EVIDENCE_DECISIONS.has(d)) {
        throw new MethodologyValidationError(
          `Edge '${edgeId}' condition has invalid decision '${String(d)}'.`,
        )
      }
    }
  }

  if (cond.verdict !== undefined) {
    const verdicts = Array.isArray(cond.verdict) ? cond.verdict : [cond.verdict]
    for (const v of verdicts) {
      if (!VALID_POLICY_VERDICTS.has(v)) {
        throw new MethodologyValidationError(
          `Edge '${edgeId}' condition has invalid verdict '${String(v)}'.`,
        )
      }
    }
  }

  if (cond.priority !== undefined && (!Number.isFinite(cond.priority) || cond.priority < 0)) {
    throw new MethodologyValidationError(
      `Edge '${edgeId}' condition priority must be a finite non-negative number.`,
    )
  }
}

function validateNoIllegalCycles(nodes: MethodologyNode[], edges: MethodologyEdge[]): void {
  const adj = new Map<string, string[]>()
  for (const n of nodes) {
    adj.set(n.id, [])
  }
  for (const e of edges) {
    if (e.type !== 'REMEDIATION') {
      adj.get(e.source)?.push(e.target)
    }
  }

  const visited = new Set<string>()
  const inStack = new Set<string>()

  function dfs(nodeId: string, path: string[]): void {
    visited.add(nodeId)
    inStack.add(nodeId)

    for (const neighbor of adj.get(nodeId) ?? []) {
      if (inStack.has(neighbor)) {
        const cycle = [...path, neighbor].join(' -> ')
        throw new MethodologyValidationError(
          `Illegal forward cycle detected in methodology graph: ${cycle}`,
        )
      }
      if (!visited.has(neighbor)) {
        dfs(neighbor, [...path, neighbor])
      }
    }

    inStack.delete(nodeId)
  }

  for (const n of nodes) {
    if (!visited.has(n.id)) {
      dfs(n.id, [n.id])
    }
  }
}
