import { Firestore } from '@google-cloud/firestore'
import * as fs from 'node:fs'
import * as path from 'node:path'
import type { CreatorCalibration, ImplementationState } from '../domain/course.ts'
import type { MethodologyGraph } from '../domain/methodology.ts'
import { validateMethodologyGraph } from '../domain/methodologyValidation.ts'
import type { UserProfile } from '../domain/identity.ts'
import type {
  AutonomyAuditRecord,
  IAutonomyAuditRepository,
  ICalibrationRepository,
  IImplementationRepository,
  IMethodologyRepository,
  IProfileRepository,
} from './types.ts'

export type StorageBackendType = 'firestore' | 'filestorage' | 'memory'

export class StoreLoadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StoreLoadError'
  }
}

interface StoreFileSpec {
  filePath: string
  entityName: string
  isEntity: (value: unknown) => boolean
}

/**
 * Reads a canonical JSON store. A malformed file must NEVER silently become an
 * empty store: original bytes are quarantined and a StoreLoadError is thrown so
 * the failure surfaces loudly instead of destroying authoritative state on the
 * next persist.
 */
function loadStoreFile<T>({ filePath, entityName, isEntity }: StoreFileSpec): Map<string, T> {
  let raw: string
  try {
    raw = fs.readFileSync(filePath, 'utf-8')
  } catch {
    throw new StoreLoadError(`Cannot read ${entityName} store at '${filePath}'`)
  }

  if (raw.charCodeAt(0) === 0xfeff) {
    raw = raw.slice(1)
  }

  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch (err) {
    const quarantinePath = quarantineStoreFile(filePath, raw)
    throw new StoreLoadError(
      `${entityName} store at '${filePath}' is not valid JSON${
        quarantinePath ? ` (original bytes quarantined at '${quarantinePath}')` : ' (quarantine failed)'
      }: ${err instanceof Error ? err.message : String(err)}`,
    )
  }

  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    const quarantinePath = quarantineStoreFile(filePath, raw)
    throw new StoreLoadError(
      `${entityName} store at '${filePath}' must be an object keyed by id${
        quarantinePath ? ` (original bytes quarantined at '${quarantinePath}')` : ' (quarantine failed)'
      }.`,
    )
  }

  const entries = Object.entries(data as Record<string, unknown>)
  for (const [key, value] of entries) {
    if (!isEntity(value)) {
      const quarantinePath = quarantineStoreFile(filePath, raw)
      throw new StoreLoadError(
        `${entityName} store entry '${key}' at '${filePath}' has an invalid shape${
          quarantinePath ? ` (original bytes quarantined at '${quarantinePath}')` : ' (quarantine failed)'
        }.`,
      )
    }
  }

  return new Map(entries as Array<[string, T]>)
}

function quarantineStoreFile(filePath: string, raw: string): string | null {
  try {
    const dir = path.join(path.dirname(filePath), 'quarantine')
    fs.mkdirSync(dir, { recursive: true })
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const quarantinePath = path.join(dir, `${path.basename(filePath)}.${stamp}.bad`)
    fs.writeFileSync(quarantinePath, raw, 'utf-8')
    return quarantinePath
  } catch {
    return null
  }
}

function isImplementationStateLike(value: unknown): boolean {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const candidate = value as { id?: unknown; courseId?: unknown; completedMissionIds?: unknown }
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.courseId === 'string' &&
    Array.isArray(candidate.completedMissionIds) &&
    candidate.completedMissionIds.every((id) => typeof id === 'string')
  )
}

function isUserProfileLike(value: unknown): boolean {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const candidate = value as { userId?: unknown; displayName?: unknown }
  return typeof candidate.userId === 'string' && typeof candidate.displayName === 'string'
}

function isCreatorCalibrationLike(value: unknown): boolean {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const candidate = value as { missionId?: unknown; status?: unknown; examples?: unknown }
  return (
    typeof candidate.missionId === 'string' &&
    typeof candidate.status === 'string' &&
    Array.isArray(candidate.examples)
  )
}

function isAutonomyAuditRecordLike(value: unknown): boolean {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const candidate = value as {
    id?: unknown
    eventId?: unknown
    implementationId?: unknown
    decision?: unknown
  }
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.eventId === 'string' &&
    typeof candidate.implementationId === 'string' &&
    typeof candidate.decision === 'string'
  )
}

function isMethodologyGraphLike(value: unknown): boolean {
  try {
    validateMethodologyGraph(value, { requireCanonicalHash: true })
    return true
  } catch {
    return false
  }
}

function methodologyKey(
  coachId: string | undefined,
  courseId: string,
  methodologyId: string,
  version?: string,
): string {
  const scope = `${coachId || 'legacy'}:${courseId}:${methodologyId}`
  return version ? `${scope}:v${version}` : `${scope}:active`
}


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
    if (!fs.existsSync(this.filePath)) {
      return
    }
    this.cache = loadStoreFile<ImplementationState>({
      filePath: this.filePath,
      entityName: 'Implementations',
      isEntity: isImplementationStateLike,
    })
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
    if (!fs.existsSync(this.filePath)) {
      return
    }
    this.cache = loadStoreFile<UserProfile>({
      filePath: this.filePath,
      entityName: 'User profiles',
      isEntity: isUserProfileLike,
    })
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

export class MemoryMethodologyRepository implements IMethodologyRepository {
  private storage = new Map<string, MethodologyGraph>()

  async getActive(coachId: string | undefined, courseId: string): Promise<MethodologyGraph | null> {
    const candidates = [...this.storage.values()].filter(
      (graph) => graph.courseId === courseId && graph.coachId === coachId && (graph.status === 'active' || graph.status === 'confirmed'),
    )
    const graph = candidates.sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }) || b.updatedAt.localeCompare(a.updatedAt))[0]
    return graph ? structuredClone(graph) : null
  }

  async getVersion(coachId: string | undefined, courseId: string, methodologyId: string, version: string) {
    const graph = this.storage.get(methodologyKey(coachId, courseId, methodologyId, version))
    return graph ? structuredClone(graph) : null
  }

  async getById(coachId: string | undefined, courseId: string, methodologyId: string) {
    const candidates = [...this.storage.values()].filter(
      (graph) => graph.id === methodologyId && graph.courseId === courseId && graph.coachId === coachId,
    )
    const graph = candidates.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
    return graph ? structuredClone(graph) : null
  }

  async save(graph: MethodologyGraph) {
    validateMethodologyGraph(graph, {
      expectedCoachId: graph.coachId,
      expectedCourseId: graph.courseId,
      requireCanonicalHash: true,
    })
    this.storage.set(methodologyKey(graph.coachId, graph.courseId, graph.id, graph.version), structuredClone(graph))
    if (graph.status === 'active' || graph.status === 'confirmed') {
      this.storage.set(methodologyKey(graph.coachId, graph.courseId, graph.id), structuredClone(graph))
    }
  }

  async list(coachId?: string, courseId?: string) {
    return [...this.storage.values()]
      .filter((graph) => (!coachId || graph.coachId === coachId) && (!courseId || graph.courseId === courseId))
      .map((graph) => structuredClone(graph))
  }
}

export class FileStorageMethodologyRepository implements IMethodologyRepository {
  private filePath: string
  private cache = new Map<string, MethodologyGraph>()

  constructor(filePath?: string) {
    this.filePath = filePath || path.join(process.cwd(), '.data', 'methodologies.json')
    this.load()
  }

  private load() {
    if (!fs.existsSync(this.filePath)) return
    this.cache = loadStoreFile<MethodologyGraph>({
      filePath: this.filePath,
      entityName: 'Methodologies',
      isEntity: isMethodologyGraphLike,
    })
  }

  private persist() {
    const dir = path.dirname(this.filePath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(this.filePath, JSON.stringify(Object.fromEntries(this.cache.entries()), null, 2), 'utf-8')
  }

  async getActive(coachId: string | undefined, courseId: string) {
    this.load()
    const candidates = [...this.cache.values()].filter(
      (item) => item.coachId === coachId && item.courseId === courseId && (item.status === 'active' || item.status === 'confirmed'),
    )
    const selected = candidates.sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }) || b.updatedAt.localeCompare(a.updatedAt))[0]
    return selected ? structuredClone(selected) : null
  }

  async getVersion(coachId: string | undefined, courseId: string, methodologyId: string, version: string) {
    this.load()
    const graph = this.cache.get(methodologyKey(coachId, courseId, methodologyId, version))
    return graph ? structuredClone(graph) : null
  }

  async getById(coachId: string | undefined, courseId: string, methodologyId: string) {
    this.load()
    const graph = [...this.cache.values()]
      .filter((item) => item.id === methodologyId && item.coachId === coachId && item.courseId === courseId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
    return graph ? structuredClone(graph) : null
  }

  async save(graph: MethodologyGraph) {
    validateMethodologyGraph(graph, { expectedCoachId: graph.coachId, expectedCourseId: graph.courseId, requireCanonicalHash: true })
    this.cache.set(methodologyKey(graph.coachId, graph.courseId, graph.id, graph.version), structuredClone(graph))
    if (graph.status === 'active' || graph.status === 'confirmed') {
      this.cache.set(methodologyKey(graph.coachId, graph.courseId, graph.id), structuredClone(graph))
    }
    this.persist()
  }

  async list(coachId?: string, courseId?: string) {
    this.load()
    return [...this.cache.values()]
      .filter((graph) => (!coachId || graph.coachId === coachId) && (!courseId || graph.courseId === courseId))
      .map((graph) => structuredClone(graph))
  }
}

export class FirestoreMethodologyRepository implements IMethodologyRepository {
  private firestore: Firestore
  private collectionName = 'methodologies'

  constructor(firestoreOrOptions?: Firestore | { projectId?: string; databaseId?: string }) {
    if (firestoreOrOptions && 'collection' in firestoreOrOptions) this.firestore = firestoreOrOptions
    else {
      const projectId = firestoreOrOptions?.projectId || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT
      const databaseId = firestoreOrOptions?.databaseId || process.env.FIRESTORE_DATABASE_ID
      this.firestore = new Firestore({ ...(projectId ? { projectId } : {}), ...(databaseId ? { databaseId } : {}), ignoreUndefinedProperties: true })
    }
  }

  async getActive(coachId: string | undefined, courseId: string) {
    const snapshot = await this.firestore.collection(this.collectionName).where('courseId', '==', courseId).where('status', 'in', ['active', 'confirmed']).get()
    const graph = snapshot.docs.map((doc) => doc.data() as MethodologyGraph).find((item) => item.coachId === coachId)
    return graph ? structuredClone(graph) : null
  }

  async getVersion(coachId: string | undefined, courseId: string, methodologyId: string, version: string) {
    const doc = await this.firestore.collection(this.collectionName).doc(methodologyKey(coachId, courseId, methodologyId, version)).get()
    return doc.exists ? (doc.data() as MethodologyGraph) : null
  }

  async getById(coachId: string | undefined, courseId: string, methodologyId: string) {
    const snapshot = await this.firestore.collection(this.collectionName).where('courseId', '==', courseId).where('id', '==', methodologyId).get()
    const graph = snapshot.docs.map((doc) => doc.data() as MethodologyGraph).find((item) => item.coachId === coachId)
    return graph ? structuredClone(graph) : null
  }

  async save(graph: MethodologyGraph) {
    validateMethodologyGraph(graph, { expectedCoachId: graph.coachId, expectedCourseId: graph.courseId, requireCanonicalHash: true })
    const clean = JSON.parse(JSON.stringify(graph))
    await this.firestore.collection(this.collectionName).doc(methodologyKey(graph.coachId, graph.courseId, graph.id, graph.version)).set(clean)
    if (graph.status === 'active' || graph.status === 'confirmed') await this.firestore.collection(this.collectionName).doc(methodologyKey(graph.coachId, graph.courseId, graph.id)).set(clean)
  }

  async list(coachId?: string, courseId?: string) {
    let query: FirebaseFirestore.Query = this.firestore.collection(this.collectionName)
    if (coachId) query = query.where('coachId', '==', coachId)
    if (courseId) query = query.where('courseId', '==', courseId)
    const snapshot = await query.get()
    return snapshot.docs.map((doc) => doc.data() as MethodologyGraph)
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

/**
 * Calibration document key. Includes the methodology and coach scope when known so that
 * two coaches or two packs sharing a mission id can never collide on calibration state.
 * Legacy format (no coachId/courseId) remains readable for pre-existing local data.
 */
function calibrationKey(
  missionId: string,
  userId?: string,
  courseId?: string,
  coachId?: string,
  version?: string,
): string {
  if (coachId && courseId && version) return `coach:${coachId}:${courseId}:${missionId}:v${version}`
  if (coachId && courseId) return `coach:${coachId}:${courseId}:${missionId}`
  if (coachId) return `coach:${coachId}:${missionId}`
  if (userId && courseId) return `${userId}:${courseId}:${missionId}`
  if (courseId) return `${courseId}:${missionId}`
  if (userId) return `${userId}:${missionId}`
  return missionId
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

  async getByMissionId(
    missionId: string,
    userId?: string,
    courseId?: string,
    coachId?: string,
    version?: string,
  ): Promise<CreatorCalibration | null> {
    const key = calibrationKey(missionId, userId, courseId, coachId, version)
    const doc = await this.firestore.collection(this.collectionName).doc(key).get()
    if (doc.exists) return doc.data() as CreatorCalibration
    if (coachId || userId || courseId) return null
    const matches = await this.firestore.collection(this.collectionName).where('missionId', '==', missionId).limit(1).get()
    return matches.empty ? null : (matches.docs[0].data() as CreatorCalibration)
  }

  async save(calibration: CreatorCalibration): Promise<void> {
    const clean = JSON.parse(JSON.stringify(calibration))
    const mainKey = calibrationKey(
      calibration.missionId,
      calibration.userId,
      calibration.courseId,
      calibration.coachId,
      calibration.version,
    )
    await this.firestore.collection(this.collectionName).doc(mainKey).set(clean, { merge: true })

    if (calibration.coachId && calibration.courseId) {
      const activeKey = calibrationKey(
        calibration.missionId,
        undefined,
        calibration.courseId,
        calibration.coachId,
      )
      if (activeKey !== mainKey) {
        await this.firestore.collection(this.collectionName).doc(activeKey).set(clean, { merge: true })
      }
    }
  }

  async list(coachId?: string, courseId?: string): Promise<CreatorCalibration[]> {
    let query: FirebaseFirestore.Query = this.firestore.collection(this.collectionName)
    if (coachId) query = query.where('coachId', '==', coachId)
    if (courseId) query = query.where('courseId', '==', courseId)
    const snapshot = await query.get()
    return snapshot.docs.map((doc) => doc.data() as CreatorCalibration)
  }

  async getHistory(coachId: string, courseId: string, missionId: string): Promise<CreatorCalibration[]> {
    const snapshot = await this.firestore
      .collection(this.collectionName)
      .where('coachId', '==', coachId)
      .where('courseId', '==', courseId)
      .where('missionId', '==', missionId)
      .get()
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
    if (!fs.existsSync(this.filePath)) {
      return
    }
    this.cache = loadStoreFile<CreatorCalibration>({
      filePath: this.filePath,
      entityName: 'Creator calibrations',
      isEntity: isCreatorCalibrationLike,
    })
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

  async getByMissionId(
    missionId: string,
    userId?: string,
    courseId?: string,
    coachId?: string,
    version?: string,
  ): Promise<CreatorCalibration | null> {
    this.load()
    const scoped = calibrationKey(missionId, userId, courseId, coachId, version)
    const value = this.cache.get(scoped)
      ?? (!userId && !courseId && !coachId
        ? Array.from(this.cache.values()).find((item) => item.missionId === missionId)
        : undefined)
    return value ? structuredClone(value) : null
  }

  async save(calibration: CreatorCalibration): Promise<void> {
    const mainKey = calibrationKey(
      calibration.missionId,
      calibration.userId,
      calibration.courseId,
      calibration.coachId,
      calibration.version,
    )
    this.cache.set(mainKey, structuredClone(calibration))

    if (calibration.coachId && calibration.courseId) {
      const activeKey = calibrationKey(
        calibration.missionId,
        undefined,
        calibration.courseId,
        calibration.coachId,
      )
      this.cache.set(activeKey, structuredClone(calibration))
      if (calibration.version) {
        const versionedKey = calibrationKey(
          calibration.missionId,
          undefined,
          calibration.courseId,
          calibration.coachId,
          calibration.version,
        )
        this.cache.set(versionedKey, structuredClone(calibration))
      }
    }
    this.persist()
  }

  async list(coachId?: string, courseId?: string): Promise<CreatorCalibration[]> {
    this.load()
    let items = Array.from(this.cache.values())
    if (coachId) items = items.filter((item) => item.coachId === coachId)
    if (courseId) items = items.filter((item) => item.courseId === courseId)
    return items.map((value) => structuredClone(value))
  }

  async getHistory(coachId: string, courseId: string, missionId: string): Promise<CreatorCalibration[]> {
    this.load()
    return Array.from(this.cache.values())
      .filter((item) => item.coachId === coachId && item.courseId === courseId && item.missionId === missionId)
      .map((value) => structuredClone(value))
  }
}

export class MemoryCalibrationRepository implements ICalibrationRepository {
  private storage: Map<string, CreatorCalibration> = new Map()

  async getByMissionId(
    missionId: string,
    userId?: string,
    courseId?: string,
    coachId?: string,
    version?: string,
  ): Promise<CreatorCalibration | null> {
    const scoped = calibrationKey(missionId, userId, courseId, coachId, version)
    const value = this.storage.get(scoped)
      ?? (!userId && !courseId && !coachId
        ? Array.from(this.storage.values()).find((item) => item.missionId === missionId)
        : undefined)
    return value ? structuredClone(value) : null
  }

  async save(calibration: CreatorCalibration): Promise<void> {
    const mainKey = calibrationKey(
      calibration.missionId,
      calibration.userId,
      calibration.courseId,
      calibration.coachId,
      calibration.version,
    )
    this.storage.set(mainKey, structuredClone(calibration))

    if (calibration.coachId && calibration.courseId) {
      const activeKey = calibrationKey(
        calibration.missionId,
        undefined,
        calibration.courseId,
        calibration.coachId,
      )
      this.storage.set(activeKey, structuredClone(calibration))
      if (calibration.version) {
        const versionedKey = calibrationKey(
          calibration.missionId,
          undefined,
          calibration.courseId,
          calibration.coachId,
          calibration.version,
        )
        this.storage.set(versionedKey, structuredClone(calibration))
      }
    }
  }

  async list(coachId?: string, courseId?: string): Promise<CreatorCalibration[]> {
    let items = Array.from(this.storage.values())
    if (coachId) items = items.filter((item) => item.coachId === coachId)
    if (courseId) items = items.filter((item) => item.courseId === courseId)
    return items.map((value) => structuredClone(value))
  }

  async getHistory(coachId: string, courseId: string, missionId: string): Promise<CreatorCalibration[]> {
    return Array.from(this.storage.values())
      .filter((item) => item.coachId === coachId && item.courseId === courseId && item.missionId === missionId)
      .map((value) => structuredClone(value))
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

export function createMethodologyRepository(backendType?: StorageBackendType): IMethodologyRepository {
  const selected = backendType || getStorageBackendType()
  if (selected === 'firestore') return new FirestoreMethodologyRepository()
  if (selected === 'memory') return new MemoryMethodologyRepository()
  return new FileStorageMethodologyRepository()
}

export function createProfileRepository(backendType?: StorageBackendType): IProfileRepository {
  const selected = backendType || getStorageBackendType()
  if (selected === 'firestore') return new FirestoreProfileRepository()
  if (selected === 'memory') return new MemoryProfileRepository()
  return new FileStorageProfileRepository()
}

export class FirestoreAutonomyAuditRepository implements IAutonomyAuditRepository {
  private firestore: Firestore
  private collectionName = 'autonomy_audits'

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

  async getById(id: string): Promise<AutonomyAuditRecord | null> {
    const doc = await this.firestore.collection(this.collectionName).doc(id).get()
    return doc.exists ? (doc.data() as AutonomyAuditRecord) : null
  }

  async getByEventId(eventId: string): Promise<AutonomyAuditRecord | null> {
    const snapshot = await this.firestore
      .collection(this.collectionName)
      .where('eventId', '==', eventId)
      .limit(1)
      .get()
    return snapshot.empty ? null : (snapshot.docs[0].data() as AutonomyAuditRecord)
  }

  async getByIdempotencyKey(idempotencyKey: string): Promise<AutonomyAuditRecord | null> {
    const snapshot = await this.firestore
      .collection(this.collectionName)
      .where('idempotencyKey', '==', idempotencyKey)
      .limit(1)
      .get()
    return snapshot.empty ? null : (snapshot.docs[0].data() as AutonomyAuditRecord)
  }

  async save(record: AutonomyAuditRecord): Promise<void> {
    await this.firestore
      .collection(this.collectionName)
      .doc(record.id)
      .set(JSON.parse(JSON.stringify(record)), { merge: true })
  }

  async createIfAbsent(record: AutonomyAuditRecord): Promise<AutonomyAuditRecord> {
    const docRef = this.firestore.collection(this.collectionName).doc(record.id)
    const cleanRecord = JSON.parse(JSON.stringify(record)) as AutonomyAuditRecord
    const persisted = await this.firestore.runTransaction(async (transaction) => {
      const existing = await transaction.get(docRef)
      if (existing.exists) return existing.data() as AutonomyAuditRecord
      transaction.create(docRef, cleanRecord)
      return record
    })
    return structuredClone(persisted)
  }

  async list(implementationId?: string): Promise<AutonomyAuditRecord[]> {
    let query: FirebaseFirestore.Query = this.firestore.collection(this.collectionName)
    if (implementationId) {
      query = query.where('implementationId', '==', implementationId)
    }
    const snapshot = await query.get()
    return snapshot.docs.map((doc) => doc.data() as AutonomyAuditRecord)
  }
}

export class FileStorageAutonomyAuditRepository implements IAutonomyAuditRepository {
  private filePath: string
  private cache: Map<string, AutonomyAuditRecord> = new Map()

  constructor(filePath?: string) {
    this.filePath = filePath || path.join(process.cwd(), '.data', 'autonomy-audits.json')
    this.load()
  }

  private load(): void {
    if (!fs.existsSync(this.filePath)) {
      return
    }
    this.cache = loadStoreFile<AutonomyAuditRecord>({
      filePath: this.filePath,
      entityName: 'Autonomy audits',
      isEntity: isAutonomyAuditRecordLike,
    })
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

  async getById(id: string): Promise<AutonomyAuditRecord | null> {
    this.load()
    const item = this.cache.get(id)
    return item ? structuredClone(item) : null
  }

  async getByEventId(eventId: string): Promise<AutonomyAuditRecord | null> {
    this.load()
    const item = Array.from(this.cache.values()).find((r) => r.eventId === eventId)
    return item ? structuredClone(item) : null
  }

  async getByIdempotencyKey(idempotencyKey: string): Promise<AutonomyAuditRecord | null> {
    this.load()
    const item = Array.from(this.cache.values()).find((record) => record.idempotencyKey === idempotencyKey || record.eventId === idempotencyKey)
    return item ? structuredClone(item) : null
  }

  async save(record: AutonomyAuditRecord): Promise<void> {
    this.cache.set(record.id, structuredClone(record))
    this.persist()
  }

  async createIfAbsent(record: AutonomyAuditRecord): Promise<AutonomyAuditRecord> {
    this.load()
    const existing = this.cache.get(record.id) ?? Array.from(this.cache.values()).find((item) => item.eventId === record.eventId)
    if (existing) return structuredClone(existing)
    this.cache.set(record.id, structuredClone(record))
    this.persist()
    return structuredClone(record)
  }

  async list(implementationId?: string): Promise<AutonomyAuditRecord[]> {
    this.load()
    const all = Array.from(this.cache.values()).map((v) => structuredClone(v))
    return implementationId ? all.filter((r) => r.implementationId === implementationId) : all
  }
}

export class MemoryAutonomyAuditRepository implements IAutonomyAuditRepository {
  private storage: Map<string, AutonomyAuditRecord> = new Map()

  async getById(id: string): Promise<AutonomyAuditRecord | null> {
    const item = this.storage.get(id)
    return item ? structuredClone(item) : null
  }

  async getByEventId(eventId: string): Promise<AutonomyAuditRecord | null> {
    const item = Array.from(this.storage.values()).find((r) => r.eventId === eventId)
    return item ? structuredClone(item) : null
  }

  async getByIdempotencyKey(idempotencyKey: string): Promise<AutonomyAuditRecord | null> {
    const item = Array.from(this.storage.values()).find((record) => record.idempotencyKey === idempotencyKey || record.eventId === idempotencyKey)
    return item ? structuredClone(item) : null
  }

  async save(record: AutonomyAuditRecord): Promise<void> {
    this.storage.set(record.id, structuredClone(record))
  }

  async createIfAbsent(record: AutonomyAuditRecord): Promise<AutonomyAuditRecord> {
    const existing = this.storage.get(record.id) ?? Array.from(this.storage.values()).find((item) => item.eventId === record.eventId)
    if (existing) return structuredClone(existing)
    const stored = structuredClone(record)
    this.storage.set(record.id, stored)
    return structuredClone(stored)
  }

  async list(implementationId?: string): Promise<AutonomyAuditRecord[]> {
    const all = Array.from(this.storage.values()).map((v) => structuredClone(v))
    return implementationId ? all.filter((r) => r.implementationId === implementationId) : all
  }
}

export function createAutonomyAuditRepository(backendType?: StorageBackendType): IAutonomyAuditRepository {
  const selected = backendType || getStorageBackendType()
  if (selected === 'firestore') return new FirestoreAutonomyAuditRepository()
  if (selected === 'memory') return new MemoryAutonomyAuditRepository()
  return new FileStorageAutonomyAuditRepository()
}
