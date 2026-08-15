import { course } from '../data/course.ts'
import type { ImplementationState } from '../domain/course.ts'
import { deriveMissionProgress } from '../domain/progression.ts'
import type { EvidenceEvaluatorService } from './evaluator/evaluatorService.ts'
import type {
  CreateImplementationDTO,
  DevCompleteMissionDTO,
  IImplementationRepository,
  StartMissionDTO,
  SubmissionResponseDTO,
  SubmitEvidenceDTO,
} from './types.ts'

export class ImplementationService {
  private repository: IImplementationRepository

  constructor(repository: IImplementationRepository) {
    this.repository = repository
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

    const existing = await this.repository.getById(id)
    if (existing) {
      return existing
    }

    const now = new Date().toISOString()
    const state: ImplementationState = {
      id,
      courseId: dto.courseId,
      courseVersion: dto.courseVersion || '1.0.0',
      completedMissionIds: [],
      createdAt: now,
      updatedAt: now,
    }

    await this.repository.save(state)
    return state
  }

  /**
   * Starts a legally available mission by setting activeMissionId (TASK-006).
   *
   * Flow:
   * 1. Load authoritative state.
   * 2. Validate mission exists in course definition.
   * 3. Derive current progress.
   * 4. Verify mission is legally available (available, active, or submitted). Locked missions are rejected.
   * 5. Set activeMissionId = missionId.
   * 6. Persist to repository.
   */
  async startMission(
    implementationId: string,
    dto: StartMissionDTO,
  ): Promise<ImplementationState> {
    const missionId = dto.missionId?.trim()
    if (!missionId) {
      throw new Error('missionId is required')
    }

    const allCourseMissions = course.chapters.flatMap((chapter) => chapter.missions)
    const mission = allCourseMissions.find((m) => m.id === missionId)
    if (!mission) {
      throw new Error(`Mission '${missionId}' not found in course '${course.id}'`)
    }

    const state = await this.repository.getById(implementationId)
    if (!state) {
      throw new Error(`Implementation '${implementationId}' not found`)
    }

    const currentCompleted = new Set(state.completedMissionIds)
    const currentProgress = deriveMissionProgress(allCourseMissions, currentCompleted)
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
  }

  /**
   * Verified Action End-to-End Submission Pipeline (TASK-004)
   *
   * Flow:
   * 1. Load authoritative ImplementationState (must exist).
   * 2. Validate missionId exists in course DAG.
   * 3. Derive current graph progress using progression.ts math.
   * 4. Verify mission can legally receive a submission (not locked).
   * 5. Check idempotency: if mission is already completed, return existing verified state.
   * 6. Validate evidence is non-empty.
   * 7. Invoke evidence evaluator (Gemini + schema validation + applyEvaluationPolicy).
   * 8. IF PASS: Apply legal persisted transition to ImplementationState and persist canonical artifact.
   * 9. IF NOT PASS: Return evaluation & feedback without mutating ImplementationState.
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

    // 1. Load authoritative state
    const state = await this.repository.getById(implementationId)
    if (!state) {
      throw new Error(`Implementation '${implementationId}' not found`)
    }

    // 2. Validate mission exists in course definition
    const allCourseMissions = course.chapters.flatMap((chapter) => chapter.missions)
    const mission = allCourseMissions.find((m) => m.id === missionId)
    if (!mission) {
      throw new Error(`Mission '${missionId}' not found in course '${course.id}'`)
    }

    // 3. Derive current progress
    const currentCompleted = new Set(state.completedMissionIds)
    const currentProgress = deriveMissionProgress(allCourseMissions, currentCompleted)
    const currentMissionState = currentProgress[missionId]

    // 4. Verify mission can legally receive submission
    if (currentMissionState === 'locked') {
      throw new Error(
        `Cannot submit evidence for mission '${missionId}': mission is currently locked due to unmet prerequisites`,
      )
    }

    // 5. Idempotency short-circuit: If mission is already completed, preserve existing canonical artifact
    if (state.completedMissionIds.includes(missionId)) {
      return {
        policyVerdict: 'PASS',
        state,
        completed: true,
      }
    }

    // 6. Evaluate evidence via the evaluator pipeline (Gemini/Mock -> Schema Validator -> applyEvaluationPolicy)
    const evaluationResult = await evaluator.evaluateEvidence({
      missionId,
      evidence: trimmedEvidence,
    })

    const { evaluation, policyVerdict } = evaluationResult

    // 7. State Transition: ONLY if policyVerdict === 'PASS'
    if (policyVerdict === 'PASS') {
      const now = new Date().toISOString()
      let stateChanged = false

      if (!state.completedMissionIds.includes(missionId)) {
        state.completedMissionIds = [...state.completedMissionIds, missionId]
        stateChanged = true
      }

      if (state.activeMissionId === missionId) {
        delete state.activeMissionId
        stateChanged = true
      }

      // Consequential Artifact Pipeline: Canonical artifact produced only on verified PASS
      if (mission.producesArtifacts?.includes('premise')) {
        state.artifacts = state.artifacts ?? {}
        const existingArtifact = state.artifacts['premise']

        if (!existingArtifact) {
          state.artifacts['premise'] = {
            key: 'premise',
            sourceMissionId: mission.id,
            value: {
              statement: trimmedEvidence,
            },
            createdAt: now,
            updatedAt: now,
          }
          stateChanged = true
        }
      }

      if (stateChanged) {
        state.updatedAt = now
        await this.repository.save(state)
      }

      return {
        evaluation,
        policyVerdict: 'PASS',
        state,
        completed: true,
      }
    }

    // 8. Non-PASS: Zero state mutation
    return {
      evaluation,
      policyVerdict,
      state,
      completed: false,
    }
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

    // 1. Validate that missionId exists in course definition
    const allCourseMissions = course.chapters.flatMap((chapter) => chapter.missions)
    const validMissionIds = new Set(allCourseMissions.map((m) => m.id))

    if (!validMissionIds.has(missionId)) {
      throw new Error(`Invalid missionId '${missionId}' not found in course '${course.id}'`)
    }

    // 2. Load authoritative state (must exist)
    const state = await this.repository.getById(implementationId)
    if (!state) {
      throw new Error(`Implementation '${implementationId}' not found`)
    }

    // 3. Idempotency: If already completed, return unchanged state
    if (state.completedMissionIds.includes(missionId)) {
      return state
    }

    // 4. Legal Transition check: Target mission must not be locked
    const currentCompleted = new Set(state.completedMissionIds)
    const currentProgress = deriveMissionProgress(allCourseMissions, currentCompleted)
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

    // 5. Apply transition and update state
    state.completedMissionIds = [...state.completedMissionIds, missionId]
    state.updatedAt = new Date().toISOString()

    // Clear activeMissionId if it was the mission just completed (do not arbitrarily choose a next branch)
    if (state.activeMissionId === missionId) {
      delete state.activeMissionId
    }

    await this.repository.save(state)
    return state
  }
}
