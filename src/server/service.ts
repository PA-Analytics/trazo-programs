import * as crypto from 'node:crypto'
import { adaptCompanionGuidance } from '../domain/learner.ts'
import type {
  ArtifactProductionSpec,
  Chapter,
  EvaluationProvenanceRecord,
  ImplementationArtifact,
  ImplementationState,
  Mission,
  Rubric,
} from '../domain/course.ts'
import { deriveMissionProgress } from '../domain/progression.ts'
import { DEFAULT_PACK_ID, resolvePack } from '../data/packs/index.ts'
import { adaptMethodologyGraphToCourse } from '../domain/methodologyAdapter.ts'
import type { MethodologyGraphRuntime } from '../domain/methodologyRuntime.ts'
import type { EvidenceEvaluatorService } from './evaluator/evaluatorService.ts'
import type {
  CohortLearnerSummary,
  CohortOverviewResponseDTO,
  CreateImplementationDTO,
  DevCompleteMissionDTO,
  ICalibrationRepository,
  IImplementationRepository,
  IProfileRepository,
  LearnerHealthStatus,
  LearnerSetupDTO,
  StartMissionDTO,
  SubmissionResponseDTO,
  SubmitEvidenceDTO,
} from './types.ts'
import type { MethodologyService } from './methodologyService.ts'

export function buildCanonicalArtifactValue(
  spec: ArtifactProductionSpec,
  evidenceText: string,
): Record<string, unknown> {
  const value: Record<string, unknown> = {}
  if (spec.build.variant !== undefined) {
    value.variant = spec.build.variant
  }
  value[spec.build.evidenceField] = evidenceText
  if (spec.build.linkedConsumed) {
    value[spec.build.linkedConsumed.property] = spec.build.linkedConsumed.key
  }
  return value
}

/**
 * Resolves the artifact production plan for a mission.
 * Fails loudly when a mission declares an artifact without a supported declarative spec:
 * a declared canonical artifact must never silently fail to materialize on PASS.
 */
export function resolveArtifactProductions(mission: Mission): ArtifactProductionSpec[] {
  const specs = mission.artifactProductions ?? []
  const specKeys = new Set(specs.map((spec) => spec.key))
  const declared = mission.producesArtifacts ?? []
  const unsupported = declared.filter((key) => !specKeys.has(key))
  if (unsupported.length > 0) {
    throw new Error(
      `Mission '${mission.id}' declares artifact(s) [${unsupported.join(', ')}] without a supported production spec. Submission rejected before evaluation.`,
    )
  }

  const orphanSpecs = specs.filter((spec) => !declared.includes(spec.key))
  if (orphanSpecs.length > 0) {
    throw new Error(
      `Mission '${mission.id}' has production spec(s) [${orphanSpecs.map((s) => s.key).join(', ')}] not declared in producesArtifacts.`,
    )
  }
  return specs
}

function criteriaFingerprint(rubric: Rubric | undefined): string {
  const canonical = rubric
    ? {
        id: rubric.id,
        version: rubric.version,
        criteria: rubric.criteria,
        qualitySignals: rubric.qualitySignals,
        systemInstructions: rubric.systemInstructions,
      }
    : null
  return crypto.createHash('sha256').update(JSON.stringify(canonical)).digest('hex')
}

function normalizeRecentInteraction(value: unknown) {
  if (!Array.isArray(value)) return []

  return value
    .filter(
      (turn): turn is { role: 'learner' | 'companion'; content: string } =>
        typeof turn === 'object' &&
        turn !== null &&
        ((turn as { role?: unknown }).role === 'learner' ||
          (turn as { role?: unknown }).role === 'companion') &&
        typeof (turn as { content?: unknown }).content === 'string',
    )
    .map((turn) => ({ role: turn.role, content: turn.content.trim().slice(0, 1200) }))
    .filter((turn) => turn.content.length > 0)
    .slice(-4)
}

export class ImplementationService {
  public repository: IImplementationRepository
  private calibrationRepository?: ICalibrationRepository
  private methodologyService?: MethodologyService
  // Per-implementation mutation queues. Every read-modify-write cycle on an
  // implementation runs inside runExclusive() so a stale request can never save
  // over canonical state written by a newer request (F1 stale-write protection).
  private exclusiveQueues = new Map<string, Promise<unknown>>()

  constructor(
    repository: IImplementationRepository,
    calibrationRepository?: ICalibrationRepository,
    methodologyService?: MethodologyService,
  ) {
    this.repository = repository
    this.calibrationRepository = calibrationRepository
    this.methodologyService = methodologyService
  }

  private async getWorkflowContext(state: ImplementationState): Promise<{
    course: ReturnType<typeof resolvePack>
    runtime?: MethodologyGraphRuntime
    methodologyId?: string
    methodologyVersion?: string
    methodologyHash?: string
  }> {
    if (!this.methodologyService) return { course: resolvePack(state.courseId) }
    const methodology = await this.methodologyService.getForState(state)
    return {
      course: adaptMethodologyGraphToCourse(methodology),
      runtime: await this.methodologyService.getRuntimeForState(state),
      methodologyId: methodology.id,
      methodologyVersion: methodology.version,
      methodologyHash: methodology.canonicalHash,
    }
  }

  runExclusive<T>(implementationId: string, operation: () => Promise<T>): Promise<T> {
    const prior = (this.exclusiveQueues.get(implementationId) ?? Promise.resolve()).catch(() => {})
    const result = prior.then(operation)
    this.exclusiveQueues.set(implementationId, result.catch(() => {}))
    return result
  }

  /**
   * Strictly read-only implementation state retrieval.
   * Does not perform silent creation side effects.
   */
  async getImplementation(id: string): Promise<ImplementationState | null> {
    return this.repository.getById(id)
  }

  /**
   * Creates a new persistent implementation instance.
   * If an implementation with the specified ID already exists, returns the existing state
   * without destroying or overwriting existing progress.
   */
  async createImplementation(dto: CreateImplementationDTO): Promise<ImplementationState> {
    const id = dto.id?.trim() || `impl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const courseId = dto.courseId?.trim() || DEFAULT_PACK_ID
    if (!this.methodologyService) resolvePack(courseId)

    return this.runExclusive(id, async () => {
      const existing = await this.repository.getById(id)
      if (existing) {
        return existing
      }

      const now = new Date().toISOString()
      const state: ImplementationState = {
        id,
        ...(dto.userId ? { userId: dto.userId } : {}),
        ...(dto.coachId ? { coachId: dto.coachId } : {}),
        courseId,
        courseVersion: dto.courseVersion || '1.0.0',
        completedMissionIds: [],
        createdAt: now,
        updatedAt: now,
      }

      if (this.methodologyService) {
        const methodology = await this.methodologyService.resolveGraph(
          courseId,
          dto.coachId,
          dto.methodologyId,
          dto.methodologyVersion,
        )
        state.methodologyId = methodology.id
        state.methodologyVersion = methodology.version
        state.methodologyHash = methodology.canonicalHash
        state.courseVersion = methodology.version
      }

      await this.repository.save(state)
      return state
    })
  }

  private getValidRouteIdsForChapter(chapter: Chapter): Set<string> {
    const outgoingBySource = new Map<string, string[]>()
    for (const edge of chapter.edges) {
      const list = outgoingBySource.get(edge.source) ?? []
      list.push(edge.target)
      outgoingBySource.set(edge.source, list)
    }

    const forks = [...outgoingBySource.entries()].filter(([, targets]) => targets.length > 1)
    if (forks.length > 0) {
      const branchTargets = new Set<string>()
      for (const [, targets] of forks) {
        for (const target of targets) {
          branchTargets.add(target)
        }
      }
      return branchTargets
    }

    const firstMission = chapter.missions[0]
    return firstMission ? new Set([firstMission.id]) : new Set()
  }

  async updateLearnerSetup(implementationId: string, dto: LearnerSetupDTO): Promise<ImplementationState> {
    const goal = typeof dto.goal === 'string' ? dto.goal.trim() : undefined
    if (dto.goal !== undefined && !goal) {
      throw new Error('goal cannot be empty')
    }

    if (dto.availableTime !== undefined && !['15_30_MIN', '30_60_MIN', '1_2_HOURS', 'VARIES'].includes(dto.availableTime)) {
      throw new Error('availableTime is invalid')
    }

    if (dto.helpPreference !== undefined && !['DIRECT', 'QUESTIONS', 'EXAMPLE', 'ADAPTIVE'].includes(dto.helpPreference)) {
      throw new Error('helpPreference is invalid')
    }

    const preferredRouteId = typeof dto.preferredRouteId === 'string' ? dto.preferredRouteId.trim() : undefined
    if (dto.preferredRouteId !== undefined && !preferredRouteId) {
      throw new Error('preferredRouteId cannot be empty')
    }

    if (!goal && !dto.availableTime && !dto.helpPreference && !preferredRouteId) {
      throw new Error('at least one setup field is required')
    }

    return this.runExclusive(implementationId, async () => {
      const state = await this.repository.getById(implementationId)
      if (!state) throw new Error(`Implementation '${implementationId}' not found`)

      if (preferredRouteId !== undefined) {
        const { course } = await this.getWorkflowContext(state)
        const chapter = course.chapters[0]
        if (!chapter) {
          throw new Error(`No chapters found in course '${state.courseId}'`)
        }

        const validRouteIds = this.getValidRouteIdsForChapter(chapter)
        if (!validRouteIds.has(preferredRouteId)) {
          throw new Error(
            `preferredRouteId '${preferredRouteId}' is not a valid route option for course '${state.courseId}'. Valid options: [${[...validRouteIds].join(', ')}]`,
          )
        }
      }

      const existingSetup = state.learnerSetup
      state.learnerSetup = {
        ...(existingSetup ?? {}),
        ...(goal !== undefined ? { goal: goal.slice(0, 300) } : {}),
        ...(dto.availableTime !== undefined ? { availableTime: dto.availableTime } : {}),
        ...(dto.helpPreference !== undefined ? { helpPreference: dto.helpPreference } : {}),
        ...(preferredRouteId !== undefined ? { preferredRouteId: preferredRouteId.slice(0, 80) } : {}),
        updatedAt: new Date().toISOString(),
      }
      state.updatedAt = new Date().toISOString()
      await this.repository.save(state)
      return state
    })
  }

  /**
   * Starts a legally available mission by setting activeMissionId (TASK-006).
   *
   * Flow:
   * 1. Load authoritative state.
   * 2. Resolve methodology from the persisted courseId (fail loudly on unknown).
   * 3. Validate mission exists in that methodology.
   * 4. Derive current progress.
   * 5. Verify mission is legally available (available, active, or submitted). Locked missions are rejected.
   * 6. Set activeMissionId = missionId.
   * 7. Persist to repository.
   */
  async startMission(
    implementationId: string,
    dto: StartMissionDTO,
  ): Promise<ImplementationState> {
    const missionId = dto.missionId?.trim()
    if (!missionId) {
      throw new Error('missionId is required')
    }

    return this.runExclusive(implementationId, async () => {
      const state = await this.repository.getById(implementationId)
      if (!state) {
        throw new Error(`Implementation '${implementationId}' not found`)
      }

      const workflow = await this.getWorkflowContext(state)
      const course = workflow.course
      const allCourseMissions = course.chapters.flatMap((chapter) => chapter.missions)
      const mission = allCourseMissions.find((m) => m.id === missionId)
      if (!mission) {
        throw new Error(`Mission '${missionId}' not found in course '${course.id}'`)
      }

      const currentCompleted = new Set(state.completedMissionIds)
      const currentProgress = workflow.runtime
        ? workflow.runtime.deriveProgress(currentCompleted, state.activeMissionId, state.workflowDecisions)
        : deriveMissionProgress(allCourseMissions, currentCompleted)
      const currentMissionState = currentProgress[missionId]

      if (currentMissionState === 'locked') {
        throw new Error(
          `Cannot start mission '${missionId}': mission is currently locked due to unmet prerequisites`,
        )
      }

      if (!['available', 'active', 'submitted', 'completed'].includes(currentMissionState)) {
        throw new Error(
          `Cannot start mission '${missionId}': invalid progress state '${currentMissionState}'`,
        )
      }

      state.activeMissionId = missionId
      state.updatedAt = new Date().toISOString()
      await this.repository.save(state)
      return state
    })
  }

  /**
   * Verified Action End-to-End Submission Pipeline (TASK-004)
   *
   * Flow (whole read-modify-write cycle serialized per implementation):
   * 1. Load authoritative ImplementationState (must exist).
   * 2. Validate missionId exists in course DAG.
   * 3. Derive current graph progress using progression.ts math.
   * 4. Verify mission can legally receive a submission (not locked).
   * 5. Idempotency: if mission is already completed, return existing verified state
   *    WITHOUT invoking the paid evaluator.
   * 6. Fail loudly on unsupported artifact declarations / missing consumed artifacts.
   * 7. Resolve criteria: coach-scoped if coachId exists (failing safely if missing), or pack rubric for no-coach path.
   * 8. Snapshot criteria id/version before evaluator await.
   * 9. Invoke evidence evaluator (Gemini + schema validation + applyEvaluationPolicy).
   * 10. Stale criteria detection: re-read active criteria; if version changed, record v1 provenance and abort progression.
   * 11. Append evaluation provenance record (for both PASS and non-PASS).
   * 12. IF PASS: Apply legal persisted transition, materialize canonical artifacts
   *     (post-condition guarded) and persist.
   * 13. IF NOT PASS: Return evaluation & feedback without mutating ImplementationState progression.
   */
  async submitEvidence(
    implementationId: string,
    dto: SubmitEvidenceDTO,
    evaluator: EvidenceEvaluatorService,
  ): Promise<SubmissionResponseDTO> {
    const missionId = dto.missionId?.trim()
    if (!missionId) {
      throw new Error('missionId is required')
    }

    const rawEvidence = dto.evidence
    const evidenceText =
      typeof rawEvidence === 'string'
        ? rawEvidence
        : typeof rawEvidence === 'object' && rawEvidence && 'text' in rawEvidence
          ? String(rawEvidence.text)
          : ''

    const trimmedEvidence = evidenceText.trim()
    if (!trimmedEvidence) {
      throw new Error('Evidence text cannot be empty or whitespace')
    }
    const evidenceHash = crypto.createHash('sha256').update(trimmedEvidence).digest('hex')

    return this.runExclusive(implementationId, async () => {
      // 1. Load authoritative state
      const state = await this.repository.getById(implementationId)
      if (!state) {
        throw new Error(`Implementation '${implementationId}' not found`)
      }

      // 2. Resolve methodology from persisted courseId and validate mission exists in it
      const workflow = await this.getWorkflowContext(state)
      const course = workflow.course
      const allCourseMissions = course.chapters.flatMap((chapter) => chapter.missions)
      const mission = allCourseMissions.find((m) => m.id === missionId)
      if (!mission) {
        throw new Error(`Mission '${missionId}' not found in course '${course.id}'`)
      }

      const priorSubmission = dto.submissionId
        ? state.evaluationProvenance?.find(
            (record) => record.submissionId === dto.submissionId && record.missionId === missionId,
          )
        : undefined
      if (priorSubmission) {
        if (priorSubmission.evidenceHash !== evidenceHash) {
          throw new Error(`submissionId '${dto.submissionId}' is already bound to different evidence`)
        }
        return {
          interactionType: 'EVIDENCE_SUBMISSION' as const,
          message: priorSubmission.evaluation?.message || priorSubmission.evaluation?.coachingFeedback || 'Esta entrega ya fue evaluada.',
          evaluation: priorSubmission.evaluation,
          policyVerdict: priorSubmission.policyVerdict,
          state,
          completed: state.completedMissionIds.includes(missionId),
        }
      }

      // 3. Derive current progress
      const currentCompleted = new Set(state.completedMissionIds)
      const currentProgress = workflow.runtime
        ? workflow.runtime.deriveProgress(currentCompleted, state.activeMissionId, state.workflowDecisions)
        : deriveMissionProgress(allCourseMissions, currentCompleted)
      const currentMissionState = currentProgress[missionId]

      // 4. Verify mission can legally receive submission
      if (currentMissionState === 'locked') {
        throw new Error(
          `Cannot submit evidence for mission '${missionId}': mission is currently locked due to unmet prerequisites`,
        )
      }

      // 5. Idempotency BEFORE any paid evaluation: an already-verified mission never
      // re-invokes the evaluator nor re-mutates canonical state on duplicate submissions.
      if (state.completedMissionIds.includes(missionId)) {
        return {
          interactionType: 'EVIDENCE_SUBMISSION' as const,
          message: 'Esta misión ya quedó verificada. Podemos hablar de lo que sigue.',
          policyVerdict: 'PASS' as const,
          state,
          completed: true,
        }
      }

      // 6. Fail loudly on unsupported artifact declarations BEFORE any evaluation cost.
      // A declared canonical artifact must never PASS silently without materializing.
      const productionSpecs = resolveArtifactProductions(mission)

      // 7. Resolve consumed artifacts for this mission; fail closed when missing.
      const consumedArtifacts: Record<string, ImplementationArtifact> = {}
      if (mission.consumesArtifacts && mission.consumesArtifacts.length > 0) {
        for (const artifactKey of mission.consumesArtifacts) {
          const artifact = state.artifacts?.[artifactKey]
          if (!artifact) {
            throw new Error(
              `Cannot evaluate mission '${missionId}': required artifact '${artifactKey}' from previous missions is missing`,
            )
          }
          consumedArtifacts[artifactKey] = artifact
        }
      }

      // 8. Resolve criteria authoritatively
      let resolvedRubric: Rubric | undefined
      let criteriaSnapshot: { id: string; version: string; fingerprint: string }

      if (state.coachId) {
        // Coach-scoped resolution:
        // Must resolve ONLY confirmed active criteria for (coachId, state.courseId, missionId).
        // Missing criteria must fail explicitly and safely, never use another coach or a static rubric.
        const coachCalibration = await this.calibrationRepository?.getByMissionId(
          missionId,
          undefined,
          state.courseId,
          state.coachId,
        )
        if (!coachCalibration || coachCalibration.status !== 'confirmed' || !coachCalibration.proposedRubric) {
          throw new Error(
            `No active confirmed criteria found for coach '${state.coachId}' on mission '${missionId}' in course '${state.courseId}'`,
          )
        }
        resolvedRubric = coachCalibration.proposedRubric
        criteriaSnapshot = {
          id: resolvedRubric.id,
          version: resolvedRubric.version || '1.0.0',
          fingerprint: criteriaFingerprint(resolvedRubric),
        }
      } else {
        // Legacy / no-coach path:
        const calibration = await this.calibrationRepository?.getByMissionId(missionId, undefined, course.id)
        resolvedRubric = (calibration?.status === 'confirmed' && calibration.proposedRubric)
          ? calibration.proposedRubric
          : mission.rubric
        criteriaSnapshot = {
          id: resolvedRubric?.id ?? `rubric-${mission.id}`,
          version: resolvedRubric?.version ?? '1.0.0',
          fingerprint: criteriaFingerprint(resolvedRubric),
        }
      }

      // 9. Evaluate evidence via the evaluator pipeline (Gemini/Mock -> Schema Validator -> applyEvaluationPolicy)
      const evaluationResult = await evaluator.evaluateEvidence({
        missionId,
        evidence: trimmedEvidence,
        courseId: course.id,
        consumedArtifacts,
        currentProgress: currentMissionState,
        recentInteraction: normalizeRecentInteraction(dto.recentInteraction),
        learnerHelpPreference: state.learnerSetup?.helpPreference,
        evaluationRubric: resolvedRubric,
      })

      if (workflow.runtime && workflow.methodologyHash) {
        const latestWorkflow = await this.getWorkflowContext(state)
        if (latestWorkflow.methodologyHash !== workflow.methodologyHash) {
          throw new Error(
            `Stale methodology detected: graph hash changed during evaluation for '${workflow.methodologyId || state.courseId}'. State progression aborted.`,
          )
        }
      }

      // 10. Snapshot criteria version verification:
      // After evaluator await, re-read active criteria and if version changed,
      // return/throw explicit stale-criteria without progression mutation.
      if (state.coachId) {
        const latestCalibration = await this.calibrationRepository?.getByMissionId(
          missionId,
          undefined,
          state.courseId,
          state.coachId,
        )
        const latestRubric = latestCalibration?.proposedRubric
        const latestVersion = latestRubric?.version || latestCalibration?.version || '1.0.0'
        const latestFingerprint = criteriaFingerprint(latestRubric)
        if (
          !latestCalibration ||
          latestCalibration.status !== 'confirmed' ||
          latestVersion !== criteriaSnapshot.version ||
          latestFingerprint !== criteriaSnapshot.fingerprint
        ) {
          const now = new Date().toISOString()
          const staleRecord: EvaluationProvenanceRecord = {
            id: `prov-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            evaluationId:
              evaluationResult.evaluation.evaluationId ||
              `eval-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            submissionId: dto.submissionId || `sub-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            implementationId,
            coachId: state.coachId,
            courseId: course.id,
            missionId,
            criteriaSetId: criteriaSnapshot.id,
            criteriaVersion: criteriaSnapshot.version,
            criterionResults: evaluationResult.evaluation.criteria,
            policyVerdict: evaluationResult.policyVerdict,
            confidence: evaluationResult.evaluation.confidence,
            evidenceHash,
            timestamp: now,
            missingRequirements:
              evaluationResult.policyVerdict === 'HUMAN_REVIEW' && resolvedRubric
                ? resolvedRubric.criteria
                    .filter(
                      (c) =>
                        c.isRequired &&
                        !evaluationResult.evaluation.criteria.some((rc) => rc.criterionId === c.id),
                    )
                    .map((c) => c.id)
                : undefined,
          }
          state.evaluationProvenance = [...(state.evaluationProvenance || []), staleRecord]
          await this.repository.save(state)

          throw new Error(
            `Stale criteria detected: criteria version changed from '${criteriaSnapshot.version}' during evaluation. State progression aborted.`,
          )
        }
      }

      const { evaluation: rawEvaluation, policyVerdict } = evaluationResult
      const now = new Date().toISOString()
      const evaluationId =
        rawEvaluation.evaluationId || `eval-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      const submissionId = dto.submissionId || `sub-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      const evaluation = {
        ...rawEvaluation,
        evaluationId,
        submissionId,
        missionId,
        evaluatedAt: now,
        criteriaVersion: criteriaSnapshot.version,
        evidenceHash,
        message: adaptCompanionGuidance(
          rawEvaluation.message || rawEvaluation.coachingFeedback,
          state.learnerSetup?.helpPreference,
          mission,
          policyVerdict,
        ),
        coachingFeedback: adaptCompanionGuidance(
          rawEvaluation.coachingFeedback,
          state.learnerSetup?.helpPreference,
          mission,
          policyVerdict,
        ),
      }
      const interactionType = evaluation.interactionType || 'EVIDENCE_SUBMISSION'
      const message = evaluation.message || evaluation.coachingFeedback || ''

      const provenanceRecord: EvaluationProvenanceRecord = {
        id: `prov-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        evaluationId,
        submissionId,
        implementationId,
        coachId: state.coachId,
        courseId: course.id,
        missionId,
        criteriaSetId: criteriaSnapshot.id,
        criteriaVersion: criteriaSnapshot.version,
        criterionResults: rawEvaluation.criteria,
        policyVerdict,
        confidence: rawEvaluation.confidence,
        evidenceHash,
        timestamp: now,
        missingRequirements:
          policyVerdict === 'HUMAN_REVIEW' && resolvedRubric
            ? resolvedRubric.criteria
                .filter(
                  (c) =>
                    c.isRequired &&
                    !rawEvaluation.criteria.some((rc) => rc.criterionId === c.id),
                )
                .map((c) => c.id)
            : undefined,
        qualitySignals: rawEvaluation.qualitySignals,
        evaluation,
        methodologyId: workflow.methodologyId,
        methodologyVersion: workflow.methodologyVersion,
        methodologyHash: workflow.methodologyHash,
      }
      state.evaluationProvenance = [...(state.evaluationProvenance || []), provenanceRecord]
      state.workflowDecisions = {
        ...(state.workflowDecisions || {}),
        [missionId]: policyVerdict,
      }

      // 11. State Transition: ONLY if interactionType === 'EVIDENCE_SUBMISSION' AND policyVerdict === 'PASS'
      if (interactionType === 'EVIDENCE_SUBMISSION' && policyVerdict === 'PASS') {
        if (!state.completedMissionIds.includes(missionId)) {
          state.completedMissionIds = [...state.completedMissionIds, missionId]
        }

        if (state.activeMissionId === missionId) {
          delete state.activeMissionId
        }

        // Consequential Artifact Pipeline: canonical artifacts produced only on verified PASS.
        // Production is declarative (ArtifactProductionSpec); every declared key was validated
        // before evaluation, so a declared artifact can never silently disappear on PASS.
        state.artifacts = state.artifacts ?? {}

        for (const spec of productionSpecs) {
          const existingArtifact = state.artifacts[spec.key]
          if (!existingArtifact) {
            state.artifacts[spec.key] = {
              key: spec.key,
              sourceMissionId: mission.id,
              value: buildCanonicalArtifactValue(spec, trimmedEvidence),
              createdAt: now,
              updatedAt: now,
            }
          }
        }

        // Post-condition guard: every declared artifact materialized before claiming completion.
        for (const spec of productionSpecs) {
          if (!state.artifacts[spec.key]) {
            throw new Error(
              `Canonical artifact '${spec.key}' failed to materialize for mission '${mission.id}'. Completion rejected.`,
            )
          }
        }

        state.updatedAt = now
        await this.repository.save(state)

        return {
          interactionType,
          message,
          evaluation,
          policyVerdict: 'PASS' as const,
          state,
          completed: true,
        }
      }

      // 12. Non-PASS / CONVERSATION / AMBIGUOUS: Zero progression mutation, provenance persisted
      await this.repository.save(state)

      return {
        interactionType,
        message,
        evaluation,
        policyVerdict,
        state,
        completed: false,
      }
    })
  }

  /**
   * @deprecated DEV-ONLY mutation. Kept strictly for isolated tests.
   * Normal product flow uses submitEvidence().
   */
  async devCompleteMission(
    implementationId: string,
    dto: DevCompleteMissionDTO,
  ): Promise<ImplementationState> {
    const missionId = dto.missionId?.trim()
    if (!missionId) {
      throw new Error('missionId is required')
    }

    return this.runExclusive(implementationId, async () => {
      // 1. Load authoritative state (must exist)
      const state = await this.repository.getById(implementationId)
      if (!state) {
        throw new Error(`Implementation '${implementationId}' not found`)
      }

      // 2. Validate that missionId exists in the implementation's methodology
      const workflow = await this.getWorkflowContext(state)
      const course = workflow.course
      const allCourseMissions = course.chapters.flatMap((chapter) => chapter.missions)
      const mission = allCourseMissions.find((m) => m.id === missionId)

      if (!mission) {
        throw new Error(`Invalid missionId '${missionId}' not found in course '${course.id}'`)
      }

      // 3. Idempotency: If already completed, return unchanged state
      if (state.completedMissionIds.includes(missionId)) {
        return state
      }

      // 4. Legal Transition check: Target mission must not be locked
      const currentCompleted = new Set(state.completedMissionIds)
      const currentProgress = workflow.runtime
        ? workflow.runtime.deriveProgress(currentCompleted, state.activeMissionId, state.workflowDecisions)
        : deriveMissionProgress(allCourseMissions, currentCompleted)
      const currentMissionState = currentProgress[missionId]

      if (currentMissionState === 'locked') {
        throw new Error(
          `Cannot complete mission '${missionId}': mission is currently locked due to unmet prerequisites`,
        )
      }

      if (!['available', 'active', 'submitted'].includes(currentMissionState)) {
        throw new Error(
          `Cannot complete mission '${missionId}': invalid progress state '${currentMissionState}'`,
        )
      }

      // 5. Artifact consistency: a dev completion must never claim a transition whose
      // canonical artifact cannot materialize (artifacts only arise from verified PASS),
      // nor bypass declared artifact prerequisites (fail closed), matching
      // submitEvidence production and consumption rules.
      const productionSpecs = resolveArtifactProductions(mission)
      if (productionSpecs.length > 0) {
        throw new Error(
          `Cannot dev-complete mission '${missionId}': it declares canonical artifacts [${productionSpecs
            .map((spec) => spec.key)
            .join(', ')}] that can only be produced by a verified submission.`,
        )
      }

      for (const artifactKey of mission.consumesArtifacts ?? []) {
        if (!state.artifacts?.[artifactKey]) {
          throw new Error(
            `Cannot complete mission '${missionId}': required artifact '${artifactKey}' from previous missions is missing`,
          )
        }
      }

      // 6. Apply transition and update state
      state.completedMissionIds = [...state.completedMissionIds, missionId]
      state.updatedAt = new Date().toISOString()

      // Clear activeMissionId if it was the mission just completed (do not arbitrarily choose a next branch)
      if (state.activeMissionId === missionId) {
        delete state.activeMissionId
      }

      await this.repository.save(state)
      return state
    })
  }

  /**
   * Returns a structured overview of all learners associated with the coach.
   * Calculates health status, completion progress, stall alerts, and pending human review cases.
   */
  async getCohortOverview(coachId?: string, profileRepository?: IProfileRepository): Promise<CohortOverviewResponseDTO> {
    const allImplementations = await this.repository.list()
    const allProfiles = profileRepository ? await profileRepository.list() : []
    const profileMap = new Map(allProfiles.map((p) => [p.userId, p]))

    const coachImplementations = allImplementations.filter((impl) => {
      if (impl.userId && profileMap.get(impl.userId)?.role === 'coach') {
        return false
      }
      if (coachId) {
        return impl.coachId === coachId || !impl.coachId
      }
      return true
    })

    const cohort: CohortLearnerSummary[] = coachImplementations.map((impl) => {
      const course = resolvePack(impl.courseId || DEFAULT_PACK_ID)
      const allMissions = course.chapters.flatMap((c) => c.missions)
      const totalMissions = allMissions.length
      const completedCount = impl.completedMissionIds?.length ?? 0
      const progressPercentage = totalMissions > 0 ? Math.round((completedCount / totalMissions) * 100) : 0

      const activeMission = allMissions.find((m) => m.id === impl.activeMissionId)
      const userProfile = impl.userId ? profileMap.get(impl.userId) : undefined
      const displayName = userProfile?.displayName || impl.userId || `Alumno ${impl.id.slice(-4)}`

      // Calculate health status based on evaluation provenance
      const provenance = impl.evaluationProvenance ?? []
      const activeMissionProvenance = impl.activeMissionId
        ? provenance.filter((p) => p.missionId === impl.activeMissionId)
        : []

      // Count consecutive reworks on active mission
      let consecutiveReworks = 0
      for (let i = activeMissionProvenance.length - 1; i >= 0; i--) {
        if (activeMissionProvenance[i].policyVerdict === 'REWORK') {
          consecutiveReworks++
        } else {
          break
        }
      }

      let healthStatus: LearnerHealthStatus = 'healthy'
      const latestVerdict = provenance[provenance.length - 1]?.policyVerdict

      if (latestVerdict === 'HUMAN_REVIEW') {
        healthStatus = 'human_review'
      } else if (consecutiveReworks >= 2) {
        healthStatus = 'stalled'
      } else if (consecutiveReworks === 1) {
        healthStatus = 'iterating'
      }

      return {
        implementationId: impl.id,
        userId: impl.userId,
        displayName,
        courseId: course.id,
        courseTitle: course.title,
        completedMissionIds: impl.completedMissionIds ?? [],
        completedCount,
        totalMissions,
        progressPercentage,
        activeMissionId: impl.activeMissionId,
        activeMissionTitle: activeMission?.title,
        healthStatus,
        consecutiveReworks,
        lastActivityAt: impl.updatedAt || impl.createdAt || new Date().toISOString(),
        preferredRouteId: impl.learnerSetup?.preferredRouteId,
        helpPreference: impl.learnerSetup?.helpPreference,
      }
    })

    const totalLearners = cohort.length
    const stalledLearners = cohort.filter((l) => l.healthStatus === 'stalled').length
    const pendingHumanReviews = cohort.filter((l) => l.healthStatus === 'human_review').length
    const totalCompleted = cohort.reduce((sum, l) => sum + l.completedCount, 0)
    const averageCompleted = totalLearners > 0 ? Number((totalCompleted / totalLearners).toFixed(1)) : 0
    const globalPassRate = totalLearners > 0 ? Math.round(cohort.reduce((sum, l) => sum + l.progressPercentage, 0) / totalLearners) : 0

    return {
      cohort,
      metrics: {
        totalLearners,
        stalledLearners,
        pendingHumanReviews,
        averageCompleted,
        globalPassRate,
      },
    }
  }

  /**
   * Retrieves full evidence history, evaluation provenance, and artifacts for a learner.
   */
  async getLearnerEvidenceHistory(implementationId: string): Promise<{
    implementation: ImplementationState
    provenance: EvaluationProvenanceRecord[]
    artifacts: Record<string, ImplementationArtifact>
  }> {
    const implementation = await this.repository.getById(implementationId)
    if (!implementation) {
      throw new Error(`Implementation '${implementationId}' not found`)
    }
    return {
      implementation,
      provenance: implementation.evaluationProvenance ?? [],
      artifacts: implementation.artifacts ?? {},
    }
  }
}
