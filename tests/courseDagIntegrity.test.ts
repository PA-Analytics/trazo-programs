import assert from 'node:assert/strict'
import test from 'node:test'
import { course } from '../src/data/course.ts'
import type { Mission } from '../src/domain/course.ts'

test('Course DAG Integrity: All mission references and edges exist within the course', () => {
  const allMissions = course.chapters.flatMap((chapter) => chapter.missions)
  const missionMap = new Map<string, Mission>(allMissions.map((m) => [m.id, m]))

  assert.ok(allMissions.length > 0, 'Course must contain at least one mission')

  for (const chapter of course.chapters) {
    for (const mission of chapter.missions) {
      // Validate prerequisites
      if (mission.prerequisites) {
        for (const prereqId of mission.prerequisites) {
          assert.ok(
            missionMap.has(prereqId),
            `Mission '${mission.id}' references non-existent prerequisite '${prereqId}'`,
          )
        }
      }

      // Validate requiresAny
      if (mission.requiresAny) {
        for (const reqId of mission.requiresAny) {
          assert.ok(
            missionMap.has(reqId),
            `Mission '${mission.id}' references non-existent requiresAny '${reqId}'`,
          )
        }
      }
    }

    // Validate edge source & target
    for (const edge of chapter.edges) {
      assert.ok(
        missionMap.has(edge.source),
        `Edge '${edge.id}' in chapter '${chapter.id}' references non-existent source mission '${edge.source}'`,
      )
      assert.ok(
        missionMap.has(edge.target),
        `Edge '${edge.id}' in chapter '${chapter.id}' references non-existent target mission '${edge.target}'`,
      )
    }
  }
})

test('Course DAG Integrity: Prerequisite graph contains zero cycles (Strict Acyclic DAG)', () => {
  const allMissions = course.chapters.flatMap((chapter) => chapter.missions)
  const adjacencyList = new Map<string, string[]>()

  for (const mission of allMissions) {
    const dependencies = [
      ...(mission.prerequisites || []),
      ...(mission.requiresAny || []),
    ]
    adjacencyList.set(mission.id, dependencies)
  }

  // Detect cycles using DFS with coloring (0: unvisited, 1: visiting, 2: visited)
  const visited = new Map<string, number>()

  function hasCycle(nodeId: string, path: string[]): boolean {
    visited.set(nodeId, 1) // In current DFS stack
    path.push(nodeId)

    const deps = adjacencyList.get(nodeId) || []
    for (const depId of deps) {
      const state = visited.get(depId) || 0
      if (state === 1) {
        throw new Error(
          `Cycle detected in Course DAG: ${path.join(' -> ')} -> ${depId}`,
        )
      }
      if (state === 0 && hasCycle(depId, path)) {
        return true
      }
    }

    path.pop()
    visited.set(nodeId, 2) // Fully visited
    return false
  }

  for (const mission of allMissions) {
    if (!visited.has(mission.id)) {
      hasCycle(mission.id, [])
    }
  }
})

test('Course DAG Integrity: Rubrics are valid, non-empty, and have unique criterion IDs with at least one required criterion', () => {
  const allMissions = course.chapters.flatMap((chapter) => chapter.missions)

  for (const mission of allMissions) {
    if (!mission.rubric) continue

    const rubric = mission.rubric
    assert.ok(rubric.id && rubric.id.trim(), `Mission '${mission.id}' has a rubric with missing id`)
    assert.ok(rubric.version && rubric.version.trim(), `Mission '${mission.id}' rubric '${rubric.id}' has missing version`)
    assert.ok(
      Array.isArray(rubric.criteria) && rubric.criteria.length > 0,
      `Mission '${mission.id}' rubric '${rubric.id}' must have a non-empty criteria array`,
    )

    const seenCriterionIds = new Set<string>()
    let hasRequiredCriterion = false

    for (const criterion of rubric.criteria) {
      assert.ok(
        criterion.id && criterion.id.trim(),
        `Mission '${mission.id}' rubric '${rubric.id}' criterion has missing id`,
      )
      assert.ok(
        !seenCriterionIds.has(criterion.id),
        `Duplicate criterion id '${criterion.id}' in mission '${mission.id}' rubric '${rubric.id}'`,
      )
      seenCriterionIds.add(criterion.id)

      assert.ok(
        criterion.label && criterion.label.trim(),
        `Criterion '${criterion.id}' in mission '${mission.id}' has missing label`,
      )
      assert.ok(
        criterion.description && criterion.description.trim(),
        `Criterion '${criterion.id}' in mission '${mission.id}' has missing description`,
      )

      if (criterion.isRequired) {
        hasRequiredCriterion = true
      }
    }

    assert.ok(
      hasRequiredCriterion,
      `Mission '${mission.id}' rubric '${rubric.id}' must have at least one criterion with isRequired: true`,
    )
  }
})

test('Course DAG Integrity: Consumed artifacts are produced by reachable upstream prerequisite missions', () => {
  const allMissions = course.chapters.flatMap((chapter) => chapter.missions)
  const missionMap = new Map<string, Mission>(allMissions.map((m) => [m.id, m]))

  // Helper to find all reachable upstream ancestor mission IDs
  function getAncestors(missionId: string): Set<string> {
    const ancestors = new Set<string>()
    const queue = [missionId]

    while (queue.length > 0) {
      const currentId = queue.shift()!
      const current = missionMap.get(currentId)
      if (!current) continue

      const deps = [
        ...(current.prerequisites || []),
        ...(current.requiresAny || []),
      ]

      for (const depId of deps) {
        if (!ancestors.has(depId)) {
          ancestors.add(depId)
          queue.push(depId)
        }
      }
    }

    return ancestors
  }

  for (const mission of allMissions) {
    if (!mission.consumesArtifacts || mission.consumesArtifacts.length === 0) continue

    const ancestors = getAncestors(mission.id)

    for (const artifactKey of mission.consumesArtifacts) {
      let producerFound = false

      for (const ancestorId of ancestors) {
        const ancestor = missionMap.get(ancestorId)
        if (ancestor?.producesArtifacts?.includes(artifactKey)) {
          producerFound = true
          break
        }
      }

      assert.ok(
        producerFound,
        `Mission '${mission.id}' consumes artifact '${artifactKey}', but no upstream prerequisite mission produces it`,
      )
    }
  }
})
