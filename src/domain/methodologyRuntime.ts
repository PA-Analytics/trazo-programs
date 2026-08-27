import type { PolicyVerdict, ProgressState } from './course.ts'
import type {
  EvidenceDecision,
  MethodologyEdge,
  MethodologyGraph,
  MethodologyGraphProvenance,
  MethodologyNode,
} from './methodology.ts'
import { validateMethodologyGraph } from './methodologyValidation.ts'

export interface NodeBlockers {
  requiredAll: string[]
  requiresOne: string[]
  lockedReason: string
}

export interface OutgoingBranchTarget {
  targetNodeId: string
  edge: MethodologyEdge
}

function normalizeDecision(verdict?: PolicyVerdict | EvidenceDecision): EvidenceDecision | undefined {
  if (!verdict) return undefined
  if (verdict === 'PASS' || verdict === 'ACCEPT') return 'ACCEPT'
  if (verdict === 'CLARIFY') return 'CLARIFY'
  if (verdict === 'REWORK') return 'REWORK'
  if (verdict === 'HUMAN_REVIEW') return 'HUMAN_REVIEW'
  return undefined
}

export class MethodologyGraphRuntime {
  public readonly graph: MethodologyGraph
  private readonly nodeMap: Map<string, MethodologyNode> = new Map()
  private readonly incomingEdges: Map<string, MethodologyEdge[]> = new Map()
  private readonly outgoingEdges: Map<string, MethodologyEdge[]> = new Map()

  constructor(graph: MethodologyGraph, validate = true) {
    if (validate) {
      validateMethodologyGraph(graph)
    }
    this.graph = graph

    for (const node of graph.nodes) {
      this.nodeMap.set(node.id, node)
      this.incomingEdges.set(node.id, [])
      this.outgoingEdges.set(node.id, [])
    }

    for (const edge of graph.edges) {
      this.incomingEdges.get(edge.target)?.push(edge)
      this.outgoingEdges.get(edge.source)?.push(edge)
    }
  }

  getNodes(): MethodologyNode[] {
    return this.graph.nodes
  }

  getNode(nodeId: string): MethodologyNode | undefined {
    return this.nodeMap.get(nodeId)
  }

  getEntryNodes(): MethodologyNode[] {
    return this.graph.entryNodeIds
      .map((id) => this.nodeMap.get(id))
      .filter((n): n is MethodologyNode => n !== undefined)
  }

  isRequirementsMet(node: MethodologyNode, completed: ReadonlySet<string>): boolean {
    const allRequired =
      !node.prerequisites ||
      node.prerequisites.length === 0 ||
      node.prerequisites.every((id) => completed.has(id))

    const anyRequired =
      !node.requiresAny ||
      node.requiresAny.length === 0 ||
      node.requiresAny.some((id) => completed.has(id))

    return allRequired && anyRequired
  }

  deriveProgress(
    completed: ReadonlySet<string>,
    activeMissionId?: string,
    workflowDecisions?: Readonly<Record<string, PolicyVerdict>>,
  ): Record<string, ProgressState> {
    const progress: Record<string, ProgressState> = {}

    for (const node of this.graph.nodes) {
      if (completed.has(node.id)) {
        progress[node.id] = 'completed'
        continue
      }

      if (activeMissionId === node.id) {
        progress[node.id] = 'active'
        continue
      }

      if (!this.isRequirementsMet(node, completed)) {
        progress[node.id] = 'locked'
        continue
      }

      // Check if entry node or reachable from completed nodes
      const isEntry = this.graph.entryNodeIds.includes(node.id)
      const incoming = this.incomingEdges.get(node.id) ?? []

      if (isEntry && incoming.length === 0) {
        progress[node.id] = 'available'
        continue
      }

      // If node has prerequisites, satisfying isRequirementsMet above is authoritative
      if (node.prerequisites?.length || node.requiresAny?.length) {
        progress[node.id] = 'available'
        continue
      }

      // Otherwise if node has incoming edges, at least one legal incoming edge must be satisfied.
      const forwardIncoming = incoming.filter((e) => e.type !== 'REMEDIATION')
      const remediationIncoming = incoming.filter((e) => e.type === 'REMEDIATION')
      const hasRemediation = remediationIncoming.some((edge) => {
        const decision = workflowDecisions?.[edge.source]
        return decision !== undefined && this.edgeMatchesDecision(edge, decision)
      })
      const hasForward = forwardIncoming.some((edge) => {
        if (!completed.has(edge.source)) return false
        const decision = workflowDecisions?.[edge.source]
        return this.edgeMatchesDecision(edge, decision)
      })
      if (
        (forwardIncoming.length === 0 && remediationIncoming.length === 0 && isEntry) ||
        hasForward ||
        hasRemediation
      ) {
        progress[node.id] = 'available'
      } else {
        progress[node.id] = 'locked'
      }
    }

    return progress
  }

  private edgeMatchesDecision(edge: MethodologyEdge, verdict?: PolicyVerdict): boolean {
    if (!edge.condition) return true
    const decision = normalizeDecision(verdict)
    if (edge.condition.decision) {
      const decisions = Array.isArray(edge.condition.decision) ? edge.condition.decision : [edge.condition.decision]
      if (!decision || !decisions.includes(decision)) return false
    }
    if (edge.condition.verdict) {
      const verdicts = Array.isArray(edge.condition.verdict) ? edge.condition.verdict : [edge.condition.verdict]
      if (!verdict || !verdicts.includes(verdict)) return false
    }
    return true
  }

  getLegalAvailableNodes(
    completed: ReadonlySet<string>,
    activeMissionId?: string,
    workflowDecisions?: Readonly<Record<string, PolicyVerdict>>,
  ): MethodologyNode[] {
    const progress = this.deriveProgress(completed, activeMissionId, workflowDecisions)
    return this.graph.nodes.filter(
      (node) => progress[node.id] === 'available' || progress[node.id] === 'active',
    )
  }

  getBlockers(nodeId: string, completed: ReadonlySet<string>): NodeBlockers {
    const node = this.nodeMap.get(nodeId)
    if (!node) {
      return {
        requiredAll: [],
        requiresOne: [],
        lockedReason: 'Misión no encontrada.',
      }
    }

    const titleById = new Map(this.graph.nodes.map((n) => [n.id, n.title]))

    const requiredAll = (node.prerequisites ?? [])
      .filter((id) => !completed.has(id))
      .map((id) => titleById.get(id) ?? id)

    const requiresOne = node.requiresAny?.some((id) => completed.has(id))
      ? []
      : (node.requiresAny ?? []).map((id) => titleById.get(id) ?? id)

    let lockedReason = 'Esta misión todavía no está disponible.'
    if (requiresOne.length > 0) {
      lockedReason = `Completa una de estas misiones: ${requiresOne.join(' o ')}.`
    } else if (requiredAll.length > 0) {
      lockedReason = `Completa primero: ${requiredAll.join(', ')}.`
    }

    return { requiredAll, requiresOne, lockedReason }
  }

  getOutgoingBranchTargets(
    nodeId: string,
    verdict?: PolicyVerdict | EvidenceDecision,
  ): OutgoingBranchTarget[] {
    const edges = this.outgoingEdges.get(nodeId) ?? []
    const decision = normalizeDecision(verdict)
    const policyVerdict = verdict === 'ACCEPT' ? 'PASS' : verdict

    const matching = edges.filter((edge) => {
      if (edge.type === 'DEFAULT') {
        return decision === undefined || decision === 'ACCEPT'
      }

      if (edge.type === 'OPTIONAL') {
        return decision === undefined || decision === 'ACCEPT'
      }

      if (edge.type === 'REMEDIATION') {
        if (edge.condition?.decision) {
          const decisions = Array.isArray(edge.condition.decision)
            ? edge.condition.decision
            : [edge.condition.decision]
          return decision ? decisions.includes(decision) : false
        }
        return decision === 'REWORK' || decision === 'CLARIFY'
      }

      if (edge.type === 'CONDITIONAL') {
        if (!edge.condition) return true

        if (edge.condition.decision && decision) {
          const decisions = Array.isArray(edge.condition.decision)
            ? edge.condition.decision
            : [edge.condition.decision]
          if (decisions.includes(decision)) return true
        }

        if (edge.condition.verdict && policyVerdict) {
          const verdicts = Array.isArray(edge.condition.verdict)
            ? edge.condition.verdict
            : [edge.condition.verdict]
          if (verdicts.includes(policyVerdict as PolicyVerdict)) return true
        }

        return false
      }

      return false
    })

    return matching
      .sort((a, b) => {
        const priorityA = a.priority ?? (a.condition?.priority ?? 100)
        const priorityB = b.priority ?? (b.condition?.priority ?? 100)
        return priorityA - priorityB
      })
      .map((edge) => ({
        targetNodeId: edge.target,
        edge,
      }))
  }

  isTerminalState(
    completed: ReadonlySet<string>,
    workflowDecisions?: Readonly<Record<string, PolicyVerdict>>,
  ): boolean {
    const terminalNodes = this.graph.nodes.filter((n) => n.isTerminal)
    if (terminalNodes.length > 0) {
      return terminalNodes.every((n) => completed.has(n.id))
    }

    const available = this.getLegalAvailableNodes(completed, undefined, workflowDecisions)
    return available.length === 0
  }

  getProvenance(): MethodologyGraphProvenance {
    return {
      methodologyId: this.graph.id,
      methodologyVersion: this.graph.version,
      canonicalHash: this.graph.canonicalHash,
      coachId: this.graph.coachId,
      courseId: this.graph.courseId,
    }
  }
}
