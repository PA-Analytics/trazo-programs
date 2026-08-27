import type { Course, Chapter, Mission, MissionEdge } from './course.ts'
import {
  computeMethodologyCanonicalHash,
  type MethodologyEdge,
  type MethodologyGraph,
  type MethodologyNode,
} from './methodology.ts'

export function adaptCourseToMethodologyGraph(
  course: Course,
  coachId?: string,
  version = '1.0.0',
): MethodologyGraph {
  const chapter = course.chapters[0]
  if (!chapter) {
    throw new Error(`Course '${course.id}' has no chapters to adapt.`)
  }

  const allChapterMissions = course.chapters.flatMap((c) => c.missions)
  const allChapterEdges = course.chapters.flatMap((c) => c.edges)

  const incomingNonOptional = new Set(
    allChapterEdges.filter((e) => !e.optional).map((e) => e.target),
  )

  const entryNodeIds = allChapterMissions
    .filter(
      (m) =>
        m.mapRole === 'entry' ||
        m.progressState === 'available' ||
        ((!m.prerequisites || m.prerequisites.length === 0) &&
          (!m.requiresAny || m.requiresAny.length === 0) &&
          !incomingNonOptional.has(m.id)),
    )
    .map((m) => m.id)

  const finalEntryNodeIds =
    entryNodeIds.length > 0 ? entryNodeIds : [allChapterMissions[0].id]

  const nodes: MethodologyNode[] = allChapterMissions.map((m) => {
    const isTerminal =
      m.nodeType === 'milestone' ||
      !allChapterEdges.some((e) => e.source === m.id && !e.optional)

    return {
      id: m.id,
      title: m.title,
      nodeType: m.nodeType,
      mapRole: m.mapRole,
      mapSubtitle: m.mapSubtitle,
      position: { ...m.position },
      description: m.description,
      evidenceType: m.evidenceType,
      evidencePrompt: m.evidencePrompt,
      evidenceCriteria: m.evidenceCriteria,
      rubric: m.rubric ? structuredClone(m.rubric) : undefined,
      producesArtifacts: m.producesArtifacts ? [...m.producesArtifacts] : undefined,
      artifactProductions: m.artifactProductions
        ? structuredClone(m.artifactProductions)
        : undefined,
      consumesArtifacts: m.consumesArtifacts ? [...m.consumesArtifacts] : undefined,
      prerequisites: m.prerequisites ? [...m.prerequisites] : undefined,
      requiresAny: m.requiresAny ? [...m.requiresAny] : undefined,
      isTerminal,
    }
  })

  const edges: MethodologyEdge[] = allChapterEdges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    type: e.optional ? 'OPTIONAL' : 'DEFAULT',
    optional: e.optional,
    via: e.via ? { ...e.via } : undefined,
    priority: 10,
  }))

  const rawGraph = {
    id: course.id,
    coachId,
    courseId: course.id,
    version,
    status: 'active' as const,
    entryNodeIds: finalEntryNodeIds,
    nodes,
    edges,
    title: course.title,
    description: chapter.mapPromise,
    junctions: chapter.junctions ? structuredClone(chapter.junctions) : undefined,
    regions: chapter.regions ? structuredClone(chapter.regions) : undefined,
    createdAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
    updatedAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
  }

  const canonicalHash = computeMethodologyCanonicalHash(rawGraph)

  return {
    ...rawGraph,
    canonicalHash,
  }
}

export function adaptMethodologyGraphToCourse(graph: MethodologyGraph): Course {
  const missions: Mission[] = graph.nodes.map((node) => ({
    id: node.id,
    title: node.title,
    nodeType: node.nodeType,
    mapRole: node.mapRole,
    mapSubtitle: node.mapSubtitle,
    progressState: graph.entryNodeIds.includes(node.id) ? 'available' : 'locked',
    position: { ...node.position },
    description: node.description,
    evidenceType: node.evidenceType,
    evidencePrompt: node.evidencePrompt,
    evidenceCriteria: node.evidenceCriteria,
    rubric: node.rubric ? structuredClone(node.rubric) : undefined,
    producesArtifacts: node.producesArtifacts ? [...node.producesArtifacts] : undefined,
    artifactProductions: node.artifactProductions
      ? structuredClone(node.artifactProductions)
      : undefined,
    consumesArtifacts: node.consumesArtifacts ? [...node.consumesArtifacts] : undefined,
    prerequisites: node.prerequisites ? [...node.prerequisites] : undefined,
    requiresAny: node.requiresAny ? [...node.requiresAny] : undefined,
  }))

  const edges: MissionEdge[] = graph.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    optional: e.type === 'OPTIONAL' || Boolean(e.optional),
    via: e.via ? { ...e.via } : undefined,
  }))

  const chapter: Chapter = {
    id: 'chapter-1',
    title: graph.title || `Chapter 1 · ${graph.id}`,
    shortTitle: '01',
    mapPromise: graph.description,
    missions,
    edges,
    junctions: graph.junctions ? structuredClone(graph.junctions) : undefined,
    regions: graph.regions ? structuredClone(graph.regions) : undefined,
  }

  return {
    id: graph.courseId,
    title: graph.title || graph.courseId,
    chapters: [chapter],
  }
}
