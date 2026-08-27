import { DEFAULT_PACK_ID, resolvePack } from '../data/packs/index.ts'
import type { CalibrationMode, CoachSetup, UserProfile, UserProfileSummary, UserRole, CoachSubmissionType } from '../domain/identity.ts'
import type { IProfileRepository } from './types.ts'
import type { ImplementationService } from './service.ts'

const USER_ID_PATTERN = /^[a-zA-Z0-9_-]{8,80}$/
const VALID_ROLES: UserRole[] = ['learner', 'coach']
const VALID_SUBMISSION_TYPES: CoachSubmissionType[] = [
  'text',
  'document',
  'link',
  'image',
  'combination',
  'other',
]
const VALID_CALIBRATION_MODES: CalibrationMode[] = [
  'own_examples',
  'generated_examples',
  'mixed_examples',
]

function now() {
  return new Date().toISOString()
}

function normalizeDisplayName(value: unknown) {
  const displayName = typeof value === 'string' ? value.trim() : ''
  if (!displayName) throw new Error('displayName is required')
  return displayName.slice(0, 80)
}

function normalizeUserId(value: unknown) {
  const userId = typeof value === 'string' ? value.trim() : ''
  if (!USER_ID_PATTERN.test(userId)) throw new Error('userId is invalid')
  return userId
}

export class IdentityService {
  private readonly profiles: IProfileRepository
  private readonly implementations: ImplementationService
  private readonly defaultCourseId: string

  constructor(
    profiles: IProfileRepository,
    implementations: ImplementationService,
    defaultCourseId: string = DEFAULT_PACK_ID,
  ) {
    this.profiles = profiles
    this.implementations = implementations
    resolvePack(defaultCourseId)
    this.defaultCourseId = defaultCourseId
  }

  async getProfile(userId: string) {
    return this.profiles.getById(normalizeUserId(userId))
  }

  async listProfiles(): Promise<UserProfileSummary[]> {
    const profiles = await this.profiles.list()
    return profiles
      .map(({ userId, displayName, role }) => ({ userId, displayName, role }))
      .sort((left, right) => left.displayName.localeCompare(right.displayName, 'es'))
  }

  async createProfile(input: { userId?: string; displayName: string }) {
    const userId = input.userId ? normalizeUserId(input.userId) : `user-${crypto.randomUUID()}`
    const existing = await this.profiles.getById(userId)
    if (existing) return existing

    const timestamp = now()
    const profile: UserProfile = {
      userId,
      displayName: normalizeDisplayName(input.displayName),
      role: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    await this.profiles.save(profile)
    return profile
  }

  async setRole(userId: string, role: UserRole) {
    const profile = await this.requireProfile(userId)
    if (!VALID_ROLES.includes(role)) throw new Error('role is invalid')
    if (profile.role && profile.role !== role) {
      throw new Error('role cannot be changed after onboarding')
    }

    if (role === 'learner' && !profile.learnerImplementationId) {
      const implementation = await this.implementations.createImplementation({
        id: `learner-${profile.userId}`,
        userId: profile.userId,
        courseId: this.defaultCourseId,
        courseVersion: '1.0.0',
      })
      profile.learnerImplementationId = implementation.id
    }

    profile.role = role
    profile.updatedAt = now()
    await this.profiles.save(profile)
    return profile
  }

  async saveCoachSetup(userId: string, input: {
    transformationContext: string
    submissionTypes: CoachSubmissionType[]
    calibrationMode: CalibrationMode
  }) {
    const profile = await this.requireProfile(userId)
    if (profile.role !== 'coach') throw new Error('coach role is required')

    const transformationContext = normalizeDisplayName(input.transformationContext).slice(0, 500)
    const submissionTypes = Array.isArray(input.submissionTypes)
      ? input.submissionTypes.filter((value): value is CoachSubmissionType => VALID_SUBMISSION_TYPES.includes(value))
      : []
    if (submissionTypes.length === 0) throw new Error('submissionTypes is required')
    if (!VALID_CALIBRATION_MODES.includes(input.calibrationMode)) throw new Error('calibrationMode is invalid')

    const setup: CoachSetup = {
      transformationContext,
      submissionTypes: [...new Set(submissionTypes)],
      calibrationMode: input.calibrationMode,
      completedAt: now(),
    }
    profile.coachSetup = setup
    profile.updatedAt = now()
    await this.profiles.save(profile)
    return profile
  }

  async requireRole(userId: string, role: UserRole) {
    const profile = await this.requireProfile(userId)
    if (profile.role !== role) throw new Error(`profile requires role '${role}'`)
    return profile
  }

  private async requireProfile(userId: string) {
    const profile = await this.getProfile(userId)
    if (!profile) throw new Error(`Profile '${userId}' not found`)
    return profile
  }
}
