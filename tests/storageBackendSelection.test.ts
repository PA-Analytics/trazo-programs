import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getStorageBackendType,
  createImplementationRepository,
  createCalibrationRepository,
  createMethodologyRepository,
  createProfileRepository,
  createAutonomyAuditRepository,
  FirestoreImplementationRepository,
  FirestoreCalibrationRepository,
  FirestoreMethodologyRepository,
  FirestoreProfileRepository,
  FirestoreAutonomyAuditRepository,
  MemoryImplementationRepository,
  FileStorageImplementationRepository,
} from '../src/server/repository.ts'

test('1. Production with missing STORAGE_BACKEND fails closed', () => {
  const prevNodeEnv = process.env.NODE_ENV
  const prevStorage = process.env.STORAGE_BACKEND
  const prevEmulator = process.env.FIRESTORE_EMULATOR_HOST
  process.env.NODE_ENV = 'production'
  delete process.env.STORAGE_BACKEND
  delete process.env.FIRESTORE_EMULATOR_HOST

  try {
    assert.throws(
      () => getStorageBackendType(),
      /Production environment requires explicit STORAGE_BACKEND=firestore/,
    )
    assert.throws(
      () => getStorageBackendType('firestore'),
      /Production environment requires explicit STORAGE_BACKEND=firestore/,
    )
    assert.throws(
      () => createImplementationRepository(),
      /Production environment requires explicit STORAGE_BACKEND=firestore/,
    )
    assert.throws(
      () => createImplementationRepository('firestore'),
      /Production environment requires explicit STORAGE_BACKEND=firestore/,
    )
    assert.throws(
      () => createCalibrationRepository(),
      /Production environment requires explicit STORAGE_BACKEND=firestore/,
    )
    assert.throws(
      () => createMethodologyRepository(),
      /Production environment requires explicit STORAGE_BACKEND=firestore/,
    )
    assert.throws(
      () => createProfileRepository(),
      /Production environment requires explicit STORAGE_BACKEND=firestore/,
    )
    assert.throws(
      () => createAutonomyAuditRepository(),
      /Production environment requires explicit STORAGE_BACKEND=firestore/,
    )
  } finally {
    if (prevNodeEnv === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = prevNodeEnv
    if (prevStorage === undefined) delete process.env.STORAGE_BACKEND
    else process.env.STORAGE_BACKEND = prevStorage
    if (prevEmulator === undefined) delete process.env.FIRESTORE_EMULATOR_HOST
    else process.env.FIRESTORE_EMULATOR_HOST = prevEmulator
  }
})

test('2. Production with STORAGE_BACKEND=memory fails closed', () => {
  const prevNodeEnv = process.env.NODE_ENV
  const prevStorage = process.env.STORAGE_BACKEND
  process.env.NODE_ENV = 'production'
  process.env.STORAGE_BACKEND = 'memory'

  try {
    assert.throws(
      () => getStorageBackendType(),
      /Production environment requires explicit STORAGE_BACKEND=firestore/,
    )
    assert.throws(
      () => getStorageBackendType('firestore'),
      /Production environment requires explicit STORAGE_BACKEND=firestore/,
    )
    assert.throws(
      () => createImplementationRepository(),
      /Production environment requires explicit STORAGE_BACKEND=firestore/,
    )
    assert.throws(
      () => createImplementationRepository('firestore'),
      /Production environment requires explicit STORAGE_BACKEND=firestore/,
    )
    assert.throws(
      () => createImplementationRepository('memory'),
      /Production environment requires explicit STORAGE_BACKEND=firestore/,
    )
    assert.throws(
      () => createCalibrationRepository('memory'),
      /Production environment requires explicit STORAGE_BACKEND=firestore/,
    )
    assert.throws(
      () => createMethodologyRepository('memory'),
      /Production environment requires explicit STORAGE_BACKEND=firestore/,
    )
    assert.throws(
      () => createProfileRepository('memory'),
      /Production environment requires explicit STORAGE_BACKEND=firestore/,
    )
    assert.throws(
      () => createAutonomyAuditRepository('memory'),
      /Production environment requires explicit STORAGE_BACKEND=firestore/,
    )
  } finally {
    if (prevNodeEnv === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = prevNodeEnv
    if (prevStorage === undefined) delete process.env.STORAGE_BACKEND
    else process.env.STORAGE_BACKEND = prevStorage
  }
})

test('3. Production with STORAGE_BACKEND=filestorage fails closed', () => {
  const prevNodeEnv = process.env.NODE_ENV
  const prevStorage = process.env.STORAGE_BACKEND
  process.env.NODE_ENV = 'production'
  process.env.STORAGE_BACKEND = 'filestorage'

  try {
    assert.throws(
      () => getStorageBackendType(),
      /Production environment requires explicit STORAGE_BACKEND=firestore/,
    )
    assert.throws(
      () => getStorageBackendType('firestore'),
      /Production environment requires explicit STORAGE_BACKEND=firestore/,
    )
    assert.throws(
      () => createImplementationRepository(),
      /Production environment requires explicit STORAGE_BACKEND=firestore/,
    )
    assert.throws(
      () => createImplementationRepository('firestore'),
      /Production environment requires explicit STORAGE_BACKEND=firestore/,
    )
    assert.throws(
      () => createImplementationRepository('filestorage'),
      /Production environment requires explicit STORAGE_BACKEND=firestore/,
    )
    assert.throws(
      () => createCalibrationRepository('filestorage'),
      /Production environment requires explicit STORAGE_BACKEND=firestore/,
    )
    assert.throws(
      () => createMethodologyRepository('filestorage'),
      /Production environment requires explicit STORAGE_BACKEND=firestore/,
    )
    assert.throws(
      () => createProfileRepository('filestorage'),
      /Production environment requires explicit STORAGE_BACKEND=firestore/,
    )
    assert.throws(
      () => createAutonomyAuditRepository('filestorage'),
      /Production environment requires explicit STORAGE_BACKEND=firestore/,
    )
  } finally {
    if (prevNodeEnv === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = prevNodeEnv
    if (prevStorage === undefined) delete process.env.STORAGE_BACKEND
    else process.env.STORAGE_BACKEND = prevStorage
  }
})

test('4. Production with STORAGE_BACKEND=firestore selects Firestore repositories without network requests', () => {
  const prevNodeEnv = process.env.NODE_ENV
  const prevStorage = process.env.STORAGE_BACKEND
  const prevEmulator = process.env.FIRESTORE_EMULATOR_HOST
  process.env.NODE_ENV = 'production'
  process.env.STORAGE_BACKEND = 'firestore'
  delete process.env.FIRESTORE_EMULATOR_HOST

  try {
    assert.equal(getStorageBackendType(), 'firestore')
    assert.equal(getStorageBackendType('firestore'), 'firestore')
    assert.equal(getStorageBackendType('FIRESTORE' as unknown as 'firestore'), 'firestore')

    assert.throws(
      () => getStorageBackendType('memory'),
      /Production environment requires explicit STORAGE_BACKEND=firestore/,
    )
    assert.throws(
      () => createImplementationRepository('memory'),
      /Production environment requires explicit STORAGE_BACKEND=firestore/,
    )
    assert.throws(
      () => createImplementationRepository('filestorage'),
      /Production environment requires explicit STORAGE_BACKEND=firestore/,
    )

    const implRepo = createImplementationRepository()
    assert.equal(implRepo instanceof FirestoreImplementationRepository, true)
    assert.equal(implRepo.constructor.name, 'FirestoreImplementationRepository')

    const implRepoExplicit = createImplementationRepository('firestore')
    assert.equal(implRepoExplicit instanceof FirestoreImplementationRepository, true)
    assert.equal(implRepoExplicit.constructor.name, 'FirestoreImplementationRepository')

    const calRepo = createCalibrationRepository()
    assert.equal(calRepo instanceof FirestoreCalibrationRepository, true)
    assert.equal(calRepo.constructor.name, 'FirestoreCalibrationRepository')

    const methRepo = createMethodologyRepository()
    assert.equal(methRepo instanceof FirestoreMethodologyRepository, true)
    assert.equal(methRepo.constructor.name, 'FirestoreMethodologyRepository')

    const profRepo = createProfileRepository()
    assert.equal(profRepo instanceof FirestoreProfileRepository, true)
    assert.equal(profRepo.constructor.name, 'FirestoreProfileRepository')

    const auditRepo = createAutonomyAuditRepository()
    assert.equal(auditRepo instanceof FirestoreAutonomyAuditRepository, true)
    assert.equal(auditRepo.constructor.name, 'FirestoreAutonomyAuditRepository')
  } finally {
    if (prevNodeEnv === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = prevNodeEnv
    if (prevStorage === undefined) delete process.env.STORAGE_BACKEND
    else process.env.STORAGE_BACKEND = prevStorage
    if (prevEmulator === undefined) delete process.env.FIRESTORE_EMULATOR_HOST
    else process.env.FIRESTORE_EMULATOR_HOST = prevEmulator
  }
})

test('4b. Production rejects FIRESTORE_EMULATOR_HOST fail-closed', () => {
  const prevNodeEnv = process.env.NODE_ENV
  const prevStorage = process.env.STORAGE_BACKEND
  const prevEmulator = process.env.FIRESTORE_EMULATOR_HOST
  process.env.NODE_ENV = 'production'
  process.env.STORAGE_BACKEND = 'firestore'
  process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080'

  try {
    assert.throws(
      () => getStorageBackendType(),
      /Production environment cannot use FIRESTORE_EMULATOR_HOST/,
    )
    assert.throws(
      () => createImplementationRepository(),
      /Production environment cannot use FIRESTORE_EMULATOR_HOST/,
    )
    assert.throws(
      () => createImplementationRepository('firestore'),
      /Production environment cannot use FIRESTORE_EMULATOR_HOST/,
    )
  } finally {
    if (prevNodeEnv === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = prevNodeEnv
    if (prevStorage === undefined) delete process.env.STORAGE_BACKEND
    else process.env.STORAGE_BACKEND = prevStorage
    if (prevEmulator === undefined) delete process.env.FIRESTORE_EMULATOR_HOST
    else process.env.FIRESTORE_EMULATOR_HOST = prevEmulator
  }
})

test('5. Non-production explicit memory/filestorage behavior remains unchanged', () => {
  const prevNodeEnv = process.env.NODE_ENV
  const prevStorage = process.env.STORAGE_BACKEND
  const prevUseFirestore = process.env.USE_FIRESTORE
  const prevEmulator = process.env.FIRESTORE_EMULATOR_HOST
  process.env.NODE_ENV = 'test'
  delete process.env.STORAGE_BACKEND
  delete process.env.USE_FIRESTORE
  delete process.env.FIRESTORE_EMULATOR_HOST

  try {
    // Default in non-prod without config is filestorage
    assert.equal(getStorageBackendType(), 'filestorage')
    assert.equal(createImplementationRepository().constructor.name, 'FileStorageImplementationRepository')
    assert.equal(createCalibrationRepository().constructor.name, 'FileStorageCalibrationRepository')
    assert.equal(createMethodologyRepository().constructor.name, 'FileStorageMethodologyRepository')
    assert.equal(createProfileRepository().constructor.name, 'FileStorageProfileRepository')
    assert.equal(createAutonomyAuditRepository().constructor.name, 'FileStorageAutonomyAuditRepository')

    // Explicit argument overrides
    const memRepo = createImplementationRepository('memory')
    assert.equal(memRepo instanceof MemoryImplementationRepository, true)
    assert.equal(memRepo.constructor.name, 'MemoryImplementationRepository')

    const fileRepo = createImplementationRepository('filestorage')
    assert.equal(fileRepo instanceof FileStorageImplementationRepository, true)
    assert.equal(fileRepo.constructor.name, 'FileStorageImplementationRepository')

    const fireRepo = createImplementationRepository('firestore')
    assert.equal(fireRepo instanceof FirestoreImplementationRepository, true)
    assert.equal(fireRepo.constructor.name, 'FirestoreImplementationRepository')

    assert.equal(createCalibrationRepository('memory').constructor.name, 'MemoryCalibrationRepository')
    assert.equal(createCalibrationRepository('filestorage').constructor.name, 'FileStorageCalibrationRepository')
    assert.equal(createMethodologyRepository('memory').constructor.name, 'MemoryMethodologyRepository')
    assert.equal(createMethodologyRepository('filestorage').constructor.name, 'FileStorageMethodologyRepository')
    assert.equal(createProfileRepository('memory').constructor.name, 'MemoryProfileRepository')
    assert.equal(createProfileRepository('filestorage').constructor.name, 'FileStorageProfileRepository')
    assert.equal(createAutonomyAuditRepository('memory').constructor.name, 'MemoryAutonomyAuditRepository')
    assert.equal(createAutonomyAuditRepository('filestorage').constructor.name, 'FileStorageAutonomyAuditRepository')

    // Explicit env override
    process.env.STORAGE_BACKEND = 'memory'
    assert.equal(getStorageBackendType(), 'memory')
    assert.equal(createImplementationRepository().constructor.name, 'MemoryImplementationRepository')

    process.env.STORAGE_BACKEND = 'filestorage'
    assert.equal(getStorageBackendType(), 'filestorage')
    assert.equal(createImplementationRepository().constructor.name, 'FileStorageImplementationRepository')

    process.env.STORAGE_BACKEND = 'firestore'
    assert.equal(getStorageBackendType(), 'firestore')
    assert.equal(createImplementationRepository().constructor.name, 'FirestoreImplementationRepository')

    // Fallback signals in non-prod
    delete process.env.STORAGE_BACKEND
    process.env.USE_FIRESTORE = 'true'
    assert.equal(getStorageBackendType(), 'firestore')
    assert.equal(createImplementationRepository().constructor.name, 'FirestoreImplementationRepository')

    delete process.env.USE_FIRESTORE
    process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080'
    assert.equal(getStorageBackendType(), 'firestore')
    assert.equal(createImplementationRepository().constructor.name, 'FirestoreImplementationRepository')
  } finally {
    if (prevNodeEnv === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = prevNodeEnv
    if (prevStorage === undefined) delete process.env.STORAGE_BACKEND
    else process.env.STORAGE_BACKEND = prevStorage
    if (prevUseFirestore === undefined) delete process.env.USE_FIRESTORE
    else process.env.USE_FIRESTORE = prevUseFirestore
    if (prevEmulator === undefined) delete process.env.FIRESTORE_EMULATOR_HOST
    else process.env.FIRESTORE_EMULATOR_HOST = prevEmulator
  }
})
