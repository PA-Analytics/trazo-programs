import { findMissionOwner, type MethodologyPack } from '../data/packs/index.ts'
import type {
  CalibrationCaseQuality,
  CalibrationExample,
  CreatorCalibration,
  Mission,
  Rubric,
} from '../domain/course.ts'
import type {
  AddCalibrationExampleDTO,
  ConfirmCalibrationDTO,
  CreateCalibrationDTO,
  ICalibrationRepository,
  JudgeCalibrationExampleDTO,
} from './types.ts'

const MAX_TEXT = 4000

interface MissionScope {
  pack: MethodologyPack
  mission: Mission
}

/**
 * Resolves a mission together with its owning methodology pack.
 * Throws when the mission does not exist or its id is ambiguous across packs.
 */
function resolveMissionScope(missionId: string): MissionScope {
  const owner = findMissionOwner(missionId)
  if (!owner) {
    throw new Error(`Mission '${missionId}' not found in any registered methodology`)
  }
  const mission = owner.chapters
    .flatMap((chapter) => chapter.missions)
    .find((item) => item.id === missionId)!
  return { pack: owner, mission }
}

function now() {
  return new Date().toISOString()
}

function normalizeText(value: unknown, field: string) {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text) throw new Error(`${field} is required`)
  return text.slice(0, MAX_TEXT)
}

/**
 * Neutral calibration examples built from mission data only.
 * Methodology-specific example copy is not allowed: calibration must work
 * identically for any methodology pack.
 */
function generatedSubmission(mission: Mission, quality: CalibrationCaseQuality) {
  if (quality === 'clear_pass') {
    return `Trabajo de ejemplo para ${mission.title}: cumple directamente lo que pide la misión (${mission.evidencePrompt}) sin información de más.`
  }
  if (quality === 'clear_rework') {
    return `Una idea general para mejorar, todavía sin concretar.`
  }
  return `Avance parcial sobre ${mission.title.toLocaleLowerCase('es-MX')}: falta definir un detalle antes de estar completo.`
}

function splitStandardCriteria(text: string) {
  return text
    .split(/[,;]|\s+y\s+|\.|\n/gi)
    .map((part) => part.trim().replace(/^(que|la|el|una|un)\s+/i, ''))
    .filter((part) => part.length >= 8)
    .slice(0, 6)
}

function buildProposal(calibration: CreatorCalibration, mission: Mission): Rubric {
  const judged = calibration.examples.filter((example) => example.verdict && example.reason)
  if (judged.length === 0) throw new Error('Judge at least one example before proposing criteria')

  const clauses = splitStandardCriteria(calibration.initialStandard)
  const labels = clauses.length
    ? clauses
    : mission.rubric?.criteria.map((criterion) => criterion.description) ?? [mission.evidenceCriteria]

  return {
    id: `calibration-${mission.id}`,
    version: '0.1.0',
    criteria: labels.map((description, index) => ({
      id: `cal_${index + 1}`,
      label: description.length > 72 ? `${description.slice(0, 69)}…` : description,
      description,
      isRequired: true,
    })),
    systemInstructions:
      'Use only the creator-confirmed criteria. Missing information is CLARIFY; sufficient but unsatisfactory work is REWORK.',
  }
}

function getCalibrationOrThrow(value: CreatorCalibration | null): CreatorCalibration {
  if (!value) throw new Error('Calibration has not been started for this mission')
  return value
}

export function validateCriteriaStructure(rubric: Rubric, mission?: Mission): void {
  if (!rubric.criteria || rubric.criteria.length === 0) {
    throw new Error('Criteria set must contain at least one criterion')
  }

  const seenIds = new Set<string>()
  let hasRequired = false

  for (let i = 0; i < rubric.criteria.length; i++) {
    const criterion = rubric.criteria[i]
    if (!criterion.id || !criterion.id.trim()) {
      throw new Error(`Criterion at index ${i} has an empty id`)
    }
    if (seenIds.has(criterion.id)) {
      throw new Error(`Duplicate criterion id '${criterion.id}'`)
    }
    seenIds.add(criterion.id)

    if (!criterion.description || !criterion.description.trim()) {
      throw new Error(`Criterion '${criterion.id}' has an empty description`)
    }

    if (criterion.isRequired) {
      hasRequired = true
    }
  }

  if (!hasRequired) {
    throw new Error('Criteria set must have at least one required criterion')
  }

  // Hard requirement preservation guard: if mission has base hard criteria, coach cannot erase them
  if (mission?.rubric?.criteria) {
    const baseRequired = mission.rubric.criteria.filter((c) => c.isRequired)
    const requiredCount = rubric.criteria.filter((criterion) => criterion.isRequired).length
    if (requiredCount < baseRequired.length) {
      throw new Error(
        `Cannot confirm criteria: mission hard requirements cannot be erased; at least ${baseRequired.length} required criteria are needed`,
      )
    }
  }
}

export class CalibrationService {
  private readonly repository: ICalibrationRepository

  constructor(repository: ICalibrationRepository) {
    this.repository = repository
  }

  async get(
    missionId: string,
    userId?: string,
    coachId?: string,
    courseId?: string,
    version?: string,
  ) {
    const pack = courseId ? { id: courseId } : resolveMissionScope(missionId).pack
    return this.repository.getByMissionId(missionId, userId, pack.id, coachId, version)
  }

  async create(
    missionId: string,
    dto: CreateCalibrationDTO,
    userId?: string,
    coachId?: string,
    courseId?: string,
  ) {
    const pack = courseId ? { id: courseId } : resolveMissionScope(missionId).pack
    const existing = await this.repository.getByMissionId(missionId, userId, pack.id, coachId)
    if (existing) return existing
    const timestamp = now()
    const calibration: CreatorCalibration = {
      missionId,
      courseId: pack.id,
      ...(userId ? { userId } : {}),
      ...(coachId ? { coachId } : {}),
      initialStandard: normalizeText(dto.initialStandard, 'initialStandard'),
      examples: [],
      status: 'draft',
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    await this.repository.save(calibration)
    return calibration
  }

  async addExample(
    missionId: string,
    dto: AddCalibrationExampleDTO,
    userId?: string,
    coachId?: string,
    courseId?: string,
  ) {
    const pack = courseId ? { id: courseId } : resolveMissionScope(missionId).pack
    const calibration = getCalibrationOrThrow(
      await this.repository.getByMissionId(missionId, userId, pack.id, coachId),
    )
    const submission = normalizeText(dto.submission, 'submission')
    if (dto.source !== 'creator' && dto.source !== 'generated') throw new Error('Invalid example source')
    const example: CalibrationExample = {
      id: `example-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      source: dto.source,
      submission,
      ...(dto.caseQuality ? { caseQuality: dto.caseQuality } : {}),
    }
    calibration.examples.push(example)
    calibration.updatedAt = now()
    await this.repository.save(calibration)
    return calibration
  }

  async generateExamples(
    missionId: string,
    userId?: string,
    coachId?: string,
    courseId?: string,
  ) {
    const { pack, mission } = resolveMissionScope(missionId)
    const effectiveCourseId = courseId || pack.id
    const calibration = getCalibrationOrThrow(
      await this.repository.getByMissionId(missionId, userId, effectiveCourseId, coachId),
    )
    const qualities: CalibrationCaseQuality[] = ['clear_pass', 'clear_rework', 'borderline']
    for (const caseQuality of qualities) {
      calibration.examples.push({
        id: `generated-${caseQuality}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        source: 'generated',
        caseQuality,
        submission: generatedSubmission(mission, caseQuality),
      })
    }
    calibration.updatedAt = now()
    await this.repository.save(calibration)
    return calibration
  }

  async judgeExample(
    missionId: string,
    exampleId: string,
    dto: JudgeCalibrationExampleDTO,
    userId?: string,
    coachId?: string,
    courseId?: string,
  ) {
    const pack = courseId ? { id: courseId } : resolveMissionScope(missionId).pack
    const calibration = getCalibrationOrThrow(
      await this.repository.getByMissionId(missionId, userId, pack.id, coachId),
    )
    const example = calibration.examples.find((item) => item.id === exampleId)
    if (!example) throw new Error(`Calibration example '${exampleId}' not found`)
    if (!['PASS', 'REWORK', 'CLARIFY'].includes(dto.verdict)) throw new Error('Invalid calibration verdict')
    example.verdict = dto.verdict
    example.reason = normalizeText(dto.reason, 'reason')
    example.judgedAt = now()
    calibration.updatedAt = now()
    await this.repository.save(calibration)
    return calibration
  }

  async propose(
    missionId: string,
    userId?: string,
    coachId?: string,
    courseId?: string,
  ) {
    const { pack, mission } = resolveMissionScope(missionId)
    const effectiveCourseId = courseId || pack.id
    const calibration = getCalibrationOrThrow(
      await this.repository.getByMissionId(missionId, userId, effectiveCourseId, coachId),
    )
    calibration.proposedRubric = buildProposal(calibration, mission)
    calibration.status = 'proposed'
    calibration.updatedAt = now()
    await this.repository.save(calibration)
    return calibration
  }

  async confirm(
    missionId: string,
    dto: ConfirmCalibrationDTO,
    userId?: string,
    coachId?: string,
    courseId?: string,
  ) {
    const { pack, mission } = resolveMissionScope(missionId)
    const effectiveCourseId = courseId || pack.id
    const calibration = getCalibrationOrThrow(
      await this.repository.getByMissionId(missionId, userId, effectiveCourseId, coachId),
    )
    if (!calibration.proposedRubric) throw new Error('Propose criteria before confirming calibration')

    const edited = dto.criteria?.map((criterion) => criterion.trim()).filter(Boolean).slice(0, 8)
    const newVersion = dto.version || (calibration.version ? incrementVersion(calibration.version) : '1.0.0')

    let finalizedCriteria = calibration.proposedRubric.criteria
    if (edited && edited.length > 0) {
      finalizedCriteria = edited.map((description, index) => ({
        id: `cal_${index + 1}`,
        label: description.length > 72 ? `${description.slice(0, 69)}…` : description,
        description,
        isRequired: true,
        kind: 'hard_requirement' as const,
      }))
    }

    const qualitySignals = dto.qualitySignals?.map((qs, index) => ({
      id: qs.id || `qs_${index + 1}`,
      label: qs.label || qs.description.slice(0, 50),
      description: qs.description,
      isRequired: false,
      kind: 'quality_signal' as const,
    }))

    const confirmedRubric: Rubric = {
      ...calibration.proposedRubric,
      id: `rubric-${coachId ? `${coachId}-` : ''}${effectiveCourseId}-${missionId}`,
      criteria: finalizedCriteria,
      qualitySignals,
      coachId,
      courseId: effectiveCourseId,
      missionId,
      version: newVersion,
      status: 'active',
      updatedAt: now(),
    }

    validateCriteriaStructure(confirmedRubric, mission)

    calibration.proposedRubric = confirmedRubric
    calibration.activeRubric = confirmedRubric
    calibration.version = newVersion
    calibration.status = 'confirmed'
    calibration.confirmedAt = now()
    calibration.updatedAt = now()
    await this.repository.save(calibration)
    return calibration
  }
}

function incrementVersion(version: string): string {
  const parts = version.split('.').map(Number)
  if (parts.length === 3 && parts.every((n) => !isNaN(n))) {
    return `${parts[0]}.${parts[1] + 1}.${parts[2]}`
  }
  return '1.0.0'
}
