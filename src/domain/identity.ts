export type UserRole = 'learner' | 'coach'

export type CoachSubmissionType = 'text' | 'document' | 'link' | 'image' | 'combination' | 'other'

export type CalibrationMode = 'own_examples' | 'generated_examples' | 'mixed_examples'

export interface CoachSetup {
  transformationContext: string
  submissionTypes: CoachSubmissionType[]
  calibrationMode: CalibrationMode
  completedAt: string
}

export interface UserProfile {
  userId: string
  displayName: string
  role: UserRole | null
  learnerImplementationId?: string
  coachSetup?: CoachSetup
  createdAt: string
  updatedAt: string
}

export interface UserProfileSummary {
  userId: string
  displayName: string
  role: UserRole | null
}
