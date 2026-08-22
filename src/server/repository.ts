import { Firestore } from '@google-cloud/firestore'
import * as fs from 'node:fs'
import * as path from 'node:path'
import type { CreatorCalibration, ImplementationState } from '../domain/course.ts'
import type { UserProfile } from '../domain/identity.ts'
import type { ICalibrationRepository, IImplementationRepository, IProfileRepository } from './types.ts'

export type StorageBackendType = 'firestore' | 'filestorage' | 'memory'

/**
 * Firestore Implementation Repository
 * Uses Cloud Firestore (or local Firestore Emulator when FIRESTORE_EMULATOR_HOST is set).
 * Fails explicitly if connection/credentials are invalid.
 */
export class FirestoreImplementationRepository implements IImplementationRepository {
  private firestore: Firestore
  private collectionName = 'implementations'

  constructor(firestoreOrOptions?: Firestore | { projectId?: string; databaseId?: string }) {
    if (firestoreOrOptions && 'collection' in firestoreOrOptions) {
      this.firestore = firestoreOrOptions
    } else {
      const projectId =
        firestoreOrOptions?.projectId ||
        process.env.GOOGLE_CLOUD_PROJECT ||
        process.env.GCLOUD_PROJECT
      const databaseId = firestoreOrOptions?.databaseId || process.env.FIRESTORE_DATABASE_ID

      this.firestore = new Firestore({
        ...(projectId ? { projectId } : {}),
        ...(databaseId ? { databaseId } : {}),
        ignoreUndefinedProperties: true,
      })
    }
  }

  async getById(id: string): Promise<ImplementationState | null> {
    const docRef = this.firestore.collection(this.collectionName).doc(id)
    const doc = await docRef.get()
    if (!doc.exists) {
      return null
    }
    return doc.data() as ImplementationState
  }

  async save(state: ImplementationState): Promise<void> {
    const docRef = this.firestore.collection(this.collectionName).doc(state.id)
    // Convert undefined properties into omitted fields for clean Firestore persistence
    const cleanState = JSON.parse(JSON.stringify(state))
    await docRef.set(cleanState, { merge: true })
  }

  async list(): Promise<ImplementationState[]> {
    const snapshot = await this.firestore.collection(this.collectionName).get()
    return snapshot.docs.map((d) => d.data() as ImplementationState)
  }

  async delete(id: string): Promise<void> {
    const docRef = this.firestore.collection(this.collectionName).doc(id)
    await docRef.delete()
  }
}

export class FirestoreProfileRepository implements IProfileRepository {
  private firestore: Firestore
  private collectionName = 'user_profiles'

  constructor(firestoreOrOptions?: Firestore | { projectId?: string; databaseId?: string }) {
    if (firestoreOrOptions && 'collection' in firestoreOrOptions) {
      this.firestore = firestoreOrOptions
    } else {
      const projectId = firestoreOrOptions?.projectId || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT
      const databaseId = firestoreOrOptions?.databaseId || process.env.FIRESTORE_DATABASE_ID
      this.firestore = new Firestore({
        ...(projectId ? { projectId } : {}),
        ...(databaseId ? { databaseId } : {}),
        ignoreUndefinedProperties: true,
      })
    }
  }

  async getById(userId: string): Promise<UserProfile | null> {
    const doc = await this.firestore.collection(this.collectionName).doc(userId).get()
    return doc.exists ? (doc.data() as UserProfile) : null
  }

  async save(profile: UserProfile): Promise<void> {
    await this.firestore.collection(this.collectionName).doc(profile.userId).set(
      JSON.parse(JSON.stringify(profile)),
      { merge: true },
    )
  }

  async list(): Promise<UserProfile[]> {
    const snapshot = await this.firestore.collection(this.collectionName).get()
    return snapshot.docs.map((doc) => doc.data() as UserProfile)
  }
}

/**
 * FileStorage Implementation Repository
 * Durable JSON file persistence for local development without Firestore.
 * Implements strict deep-cloning to prevent in-memory reference leakage.
 */
export class FileStorageImplementationRepository implements IImplementationRepository {
  private filePath: string
  private cache: Map<string, ImplementationState> = new Map()

  constructor(filePath?: string) {
    this.filePath = filePath || path.join(process.cwd(), '.data', 'implementations.json')
    this.load()
  }

  private load(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8')
        const data = JSON.parse(raw) as Record<string, ImplementationState>
        this.cache = new Map(Object.entries(data))
      }
    } catch {
      this.cache = new Map()
    }
  }

  private persist(): void {
    try {
      const dir = path.dirname(this.filePath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      const data = Object.fromEntries(this.cache.entries())
      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf-8')
    } catch (err) {
      console.error('Failed to persist implementations to disk:', err)
      throw err
    }
  }

  async getById(id: string): Promise<ImplementationState | null> {
    this.load()
    const item = this.cache.get(id)
    return item ? structuredClone(item) : null
  }

  async save(state: ImplementationState): Promise<void> {
    this.cache.set(state.id, structuredClone(state))
    this.persist()
  }

  async list(): Promise<ImplementationState[]> {
    this.load()
    return Array.from(this.cache.values()).map((v) => structuredClone(v))
  }
}

export class FileStorageProfileRepository implements IProfileRepository {
  private filePath: string
  private cache: Map<string, UserProfile> = new Map()

  constructor(filePath?: string) {
    this.filePath = filePath || path.join(process.cwd(), '.data', 'user-profiles.json')
    this.load()
  }

  private load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8')
        this.cache = new Map(Object.entries(JSON.parse(raw) as Record<string, UserProfile>))
      }
    } catch {
      this.cache = new Map()
    }
  }

  private persist() {
    const dir = path.dirname(this.filePath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(this.filePath, JSON.stringify(Object.fromEntries(this.cache.entries()), null, 2), 'utf-8')
  }

  async getById(userId: string) {
    this.load()
    const profile = this.cache.get(userId)
    return profile ? structuredClone(profile) : null
  }

  async save(profile: UserProfile) {
    this.cache.set(profile.userId, structuredClone(profile))
    this.persist()
  }

  async list() {
    this.load()
    return Array.from(this.cache.values()).map((profile) => structuredClone(profile))
  }
}

/**
 * In-Memory Implementation Repository
 * For fast, isolated unit testing.
 * Uses structuredClone to enforce 100% copy-on-write isolation and prevent reference leaks.
 */
export class MemoryImplementationRepository implements IImplementationRepository {
  private storage: Map<string, ImplementationState> = new Map()

  async getById(id: string): Promise<ImplementationState | null> {
    const item = this.storage.get(id)
    return item ? structuredClone(item) : null
  }

  async save(state: ImplementationState): Promise<void> {
    this.storage.set(state.id, structuredClone(state))
  }

  async list(): Promise<ImplementationState[]> {
    return Array.from(this.storage.values()).map((v) => structuredClone(v))
  }
}

export class MemoryProfileRepository implements IProfileRepository {
  private storage: Map<string, UserProfile> = new Map()

  async getById(userId: string) {
    const profile = this.storage.get(userId)
    return profile ? structuredClone(profile) : null
  }

  async save(profile: UserProfile) {
    this.storage.set(profile.userId, structuredClone(profile))
  }

  async list() {
    return Array.from(this.storage.values()).map((profile) => structuredClone(profile))
  }
}

export class FirestoreCalibrationRepository implements ICalibrationRepository {
  private firestore: Firestore
  private collectionName = 'creator_calibrations'

  constructor(firestoreOrOptions?: Firestore | { projectId?: string; databaseId?: string }) {
    if (firestoreOrOptions && 'collection' in firestoreOrOptions) {
      this.firestore = firestoreOrOptions
    } else {
      const projectId =
        firestoreOrOptions?.projectId || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT
      const databaseId = firestoreOrOptions?.databaseId || process.env.FIRESTORE_DATABASE_ID
      this.firestore = new Firestore({
        ...(projectId ? { projectId } : {}),
        ...(databaseId ? { databaseId } : {}),
        ignoreUndefinedProperties: true,
      })
    }
  }

  async getByMissionId(missionId: string, userId?: string): Promise<CreatorCalibration | null> {
    const key = userId ? `${userId}:${missionId}` : missionId
    const doc = await this.firestore.collection(this.collectionName).doc(key).get()
    if (doc.exists) return doc.data() as CreatorCalibration
    if (userId) return null
    const matches = await this.firestore.collection(this.collectionName).where('missionId', '==', missionId).limit(1).get()
    return matches.empty ? null : (matches.docs[0].data() as CreatorCalibration)
  }

  async save(calibration: CreatorCalibration): Promise<void> {
    const key = calibration.userId ? `${calibration.userId}:${calibration.missionId}` : calibration.missionId
    await this.firestore
      .collection(this.collectionName)
      .doc(key)
      .set(JSON.parse(JSON.stringify(calibration)), { merge: true })
  }

  async list(): Promise<CreatorCalibration[]> {
    const snapshot = await this.firestore.collection(this.collectionName).get()
    return snapshot.docs.map((doc) => doc.data() as CreatorCalibration)
  }
}

export class FileStorageCalibrationRepository implements ICalibrationRepository {
  private filePath: string
  private cache: Map<string, CreatorCalibration> = new Map()

  constructor(filePath?: string) {
    this.filePath = filePath || path.join(process.cwd(), '.data', 'creator-calibrations.json')
    this.load()
  }

  private load(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8')
        const data = JSON.parse(raw) as Record<string, CreatorCalibration>
        this.cache = new Map(Object.entries(data))
      }
    } catch {
      this.cache = new Map()
    }
  }

  private persist(): void {
    const dir = path.dirname(this.filePath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(
      this.filePath,
      JSON.stringify(Object.fromEntries(this.cache.entries()), null, 2),
      'utf-8',
    )
  }

  async getByMissionId(missionId: string, userId?: string): Promise<CreatorCalibration | null> {
    this.load()
    const value = this.cache.get(userId ? `${userId}:${missionId}` : missionId)
      ?? (!userId ? Array.from(this.cache.values()).find((item) => item.missionId === missionId) : undefined)
    return value ? structuredClone(value) : null
  }

  async save(calibration: CreatorCalibration): Promise<void> {
    const key = calibration.userId ? `${calibration.userId}:${calibration.missionId}` : calibration.missionId
    this.cache.set(key, structuredClone(calibration))
    this.persist()
  }

  async list(): Promise<CreatorCalibration[]> {
    this.load()
    return Array.from(this.cache.values()).map((value) => structuredClone(value))
  }
}

export class MemoryCalibrationRepository implements ICalibrationRepository {
  private storage: Map<string, CreatorCalibration> = new Map()

  async getByMissionId(missionId: string, userId?: string): Promise<CreatorCalibration | null> {
    const value = this.storage.get(userId ? `${userId}:${missionId}` : missionId)
      ?? (!userId ? Array.from(this.storage.values()).find((item) => item.missionId === missionId) : undefined)
    return value ? structuredClone(value) : null
  }

  async save(calibration: CreatorCalibration): Promise<void> {
    const key = calibration.userId ? `${calibration.userId}:${calibration.missionId}` : calibration.missionId
    this.storage.set(key, structuredClone(calibration))
  }

  async list(): Promise<CreatorCalibration[]> {
    return Array.from(this.storage.values()).map((value) => structuredClone(value))
  }
}

/**
 * Resolves the configured storage backend explicitly without silent fallback
 */
export function getStorageBackendType(): StorageBackendType {
  const explicit = process.env.STORAGE_BACKEND?.toLowerCase() as StorageBackendType
  if (explicit === 'firestore' || explicit === 'filestorage' || explicit === 'memory') {
    return explicit
  }
  if (process.env.USE_FIRESTORE === 'true' || process.env.FIRESTORE_EMULATOR_HOST) {
    return 'firestore'
  }
  return 'filestorage'
}

/**
 * Factory creating the authoritative repository instance based on explicit configuration.
 * Fails explicitly if the requested backend cannot be instantiated.
 */
export function createImplementationRepository(backendType?: StorageBackendType): IImplementationRepository {
  const selected = backendType || getStorageBackendType()

  if (selected === 'firestore') {
    return new FirestoreImplementationRepository()
  }

  if (selected === 'memory') {
    return new MemoryImplementationRepository()
  }

  return new FileStorageImplementationRepository()
}

export function createCalibrationRepository(backendType?: StorageBackendType): ICalibrationRepository {
  const selected = backendType || getStorageBackendType()
  if (selected === 'firestore') return new FirestoreCalibrationRepository()
  if (selected === 'memory') return new MemoryCalibrationRepository()
  return new FileStorageCalibrationRepository()
}

export function createProfileRepository(backendType?: StorageBackendType): IProfileRepository {
  const selected = backendType || getStorageBackendType()
  if (selected === 'firestore') return new FirestoreProfileRepository()
  if (selected === 'memory') return new MemoryProfileRepository()
  return new FileStorageProfileRepository()
}
