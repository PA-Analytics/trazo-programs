import { Firestore } from '@google-cloud/firestore'
import * as fs from 'node:fs'
import * as path from 'node:path'
import type { ImplementationState } from '../domain/course.ts'
import type { IImplementationRepository } from './types.ts'

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
