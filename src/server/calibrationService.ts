import { course } from '../data/course.ts'
import type {
  CalibrationCaseQuality,
  CalibrationExample,
  CreatorCalibration,
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

function missionById(missionId: string) {
  const mission = course.chapters.flatMap((chapter) => chapter.missions).find((item) => item.id === missionId)
  if (!mission) throw new Error(`Mission '${missionId}' not found in course '${course.id}'`)
  return mission
}

function now() {
  return new Date().toISOString()
}

function normalizeText(value: unknown, field: string) {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text) throw new Error(`${field} is required`)
  return text.slice(0, MAX_TEXT)
}

function generatedSubmission(missionTitle: string, quality: CalibrationCaseQuality) {
  const title = missionTitle.toLocaleLowerCase('es-MX')
  if (quality === 'clear_pass') {
    return `Para freelancers que ya tienen reuniones pero no cierran clientes, ${title} debe mostrar una idea concreta, una audiencia reconocible y un siguiente paso claro.`
  }
  if (quality === 'clear_rework') {
    return `Una idea para mejorar el contenido de todo el mundo.`
  }
  return `Ayudo a freelancers a mejorar sus propuestas para conseguir más clientes.`
}

function splitStandardCriteria(text: string) {
  return text
    .split(/[,;]|\s+y\s+|\.|\n/gi)
    .map((part) => part.trim().replace(/^(que|la|el|una|un)\s+/i, ''))
    .filter((part) => part.length >= 8)
    .slice(0, 6)
}

function buildProposal(calibration: CreatorCalibration, missionId: string): Rubric {
  const mission = missionById(missionId)
  const judged = calibration.examples.filter((example) => example.verdict && example.reason)
  if (judged.length === 0) throw new Error('Judge at least one example before proposing criteria')

  const clauses = splitStandardCriteria(calibration.initialStandard)
  const labels = clauses.length
    ? clauses
    : mission.rubric?.criteria.map((criterion) => criterion.description) ?? [mission.evidenceCriteria]

  return {
    id: `calibration-${missionId}`,
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

export class CalibrationService {
  private readonly repository: ICalibrationRepository

  constructor(repository: ICalibrationRepository) {
    this.repository = repository
  }

  async get(missionId: string, userId?: string) {
    missionById(missionId)
    return this.repository.getByMissionId(missionId, userId)
  }

  async create(missionId: string, dto: CreateCalibrationDTO, userId?: string) {
    missionById(missionId)
    const existing = await this.repository.getByMissionId(missionId, userId)
    if (existing) return existing
    const timestamp = now()
    const calibration: CreatorCalibration = {
      missionId,
      ...(userId ? { userId } : {}),
      initialStandard: normalizeText(dto.initialStandard, 'initialStandard'),
      examples: [],
      status: 'draft',
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    await this.repository.save(calibration)
    return calibration
  }

  async addExample(missionId: string, dto: AddCalibrationExampleDTO, userId?: string) {
    const calibration = getCalibrationOrThrow(await this.repository.getByMissionId(missionId, userId))
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

  async generateExamples(missionId: string, userId?: string) {
    const calibration = getCalibrationOrThrow(await this.repository.getByMissionId(missionId, userId))
    const mission = missionById(missionId)
    const qualities: CalibrationCaseQuality[] = ['clear_pass', 'clear_rework', 'borderline']
    for (const caseQuality of qualities) {
      calibration.examples.push({
        id: `generated-${caseQuality}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        source: 'generated',
        caseQuality,
        submission: generatedSubmission(mission.title, caseQuality),
      })
    }
    calibration.updatedAt = now()
    await this.repository.save(calibration)
    return calibration
  }

  async judgeExample(missionId: string, exampleId: string, dto: JudgeCalibrationExampleDTO, userId?: string) {
    const calibration = getCalibrationOrThrow(await this.repository.getByMissionId(missionId, userId))
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

  async propose(missionId: string, userId?: string) {
    const calibration = getCalibrationOrThrow(await this.repository.getByMissionId(missionId, userId))
    calibration.proposedRubric = buildProposal(calibration, missionId)
    calibration.status = 'proposed'
    calibration.updatedAt = now()
    await this.repository.save(calibration)
    return calibration
  }

  async confirm(missionId: string, dto: ConfirmCalibrationDTO, userId?: string) {
    const calibration = getCalibrationOrThrow(await this.repository.getByMissionId(missionId, userId))
    if (!calibration.proposedRubric) throw new Error('Propose criteria before confirming calibration')
    const edited = dto.criteria?.map((criterion) => criterion.trim()).filter(Boolean).slice(0, 8)
    if (edited && edited.length > 0) {
      calibration.proposedRubric = {
        ...calibration.proposedRubric,
        criteria: edited.map((description, index) => ({
          id: `cal_${index + 1}`,
          label: description.length > 72 ? `${description.slice(0, 69)}…` : description,
          description,
          isRequired: true,
        })),
        version: '0.1.1',
      }
    }
    calibration.status = 'confirmed'
    calibration.confirmedAt = now()
    calibration.updatedAt = now()
    await this.repository.save(calibration)
    return calibration
  }
}
