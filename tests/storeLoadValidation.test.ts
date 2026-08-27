import test from 'node:test'
import assert from 'node:assert/strict'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import {
  FileStorageCalibrationRepository,
  FileStorageImplementationRepository,
  FileStorageProfileRepository,
  StoreLoadError,
} from '../src/server/repository.ts'

function makeStoreDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'trazo-store-'))
}

function readBytes(filePath: string): Buffer {
  return fs.readFileSync(filePath)
}

test('valid store file loads into memory', () => {
  const dir = makeStoreDir()
  const filePath = path.join(dir, 'implementations.json')
  const payload = {
    'impl-1': {
      id: 'impl-1',
      courseId: 'primer-sistema-de-contenido',
      completedMissionIds: ['N01'],
      createdAt: '2026-08-23T00:00:00.000Z',
      updatedAt: '2026-08-23T00:00:00.000Z',
    },
  }
  fs.writeFileSync(filePath, JSON.stringify(payload), 'utf-8')

  const repo = new FileStorageImplementationRepository(filePath)
  return repo.getById('impl-1').then((state) => {
    assert.equal(state?.id, 'impl-1')
    assert.deepEqual(state?.completedMissionIds, ['N01'])
  })
})

test('UTF-8 BOM prefixed valid JSON loads without resetting the store', () => {
  const dir = makeStoreDir()
  const filePath = path.join(dir, 'implementations.json')
  const json = JSON.stringify({
    'impl-bom': {
      id: 'impl-bom',
      courseId: 'primer-sistema-de-contenido',
      completedMissionIds: [],
      createdAt: '2026-08-23T00:00:00.000Z',
      updatedAt: '2026-08-23T00:00:00.000Z',
    },
  })
  fs.writeFileSync(filePath, Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(json, 'utf-8')]))

  const repo = new FileStorageImplementationRepository(filePath)
  return repo.getById('impl-bom').then((state) => {
    assert.equal(state?.id, 'impl-bom')
  })
})

test('malformed JSON fails loudly, quarantines original bytes, and never resets silently', async () => {
  const dir = makeStoreDir()
  const filePath = path.join(dir, 'implementations.json')
  const corrupt = '{"impl-1": {"id": "impl-1", "completedMissionIds": ["N01"'
  fs.writeFileSync(filePath, corrupt, 'utf-8')
  const bytesBefore = readBytes(filePath)

  assert.throws(
    () => new FileStorageImplementationRepository(filePath),
    (err: unknown) => err instanceof StoreLoadError && /not valid JSON/.test(err.message),
  )

  assert.deepEqual(readBytes(filePath), bytesBefore)

  const quarantineDir = path.join(dir, 'quarantine')
  const quarantined = fs.readdirSync(quarantineDir).filter((name) => name.endsWith('.bad'))
  assert.equal(quarantined.length, 1)
  assert.equal(fs.readFileSync(path.join(quarantineDir, quarantined[0]), 'utf-8'), corrupt)
})

test('wrong-shape entities fail loudly instead of being served or wiped', () => {
  const dir = makeStoreDir()
  const filePath = path.join(dir, 'implementations.json')
  const invalidShape = JSON.stringify({ 'impl-x': { something: 'else' } })
  fs.writeFileSync(filePath, invalidShape, 'utf-8')

  assert.throws(
    () => new FileStorageImplementationRepository(filePath),
    (err: unknown) => err instanceof StoreLoadError && /invalid shape/.test(err.message),
  )

  const quarantineDir = path.join(dir, 'quarantine')
  assert.equal(fs.existsSync(quarantineDir), true)
})

test('empty object store is a legal fresh-install shape', () => {
  const dir = makeStoreDir()
  const filePath = path.join(dir, 'implementations.json')
  fs.writeFileSync(filePath, '{}', 'utf-8')

  const repo = new FileStorageImplementationRepository(filePath)
  return repo.list().then((items) => {
    assert.deepEqual(items, [])
  })
})

test('non-object store payloads are rejected loudly', () => {
  const dir = makeStoreDir()
  const filePath = path.join(dir, 'user-profiles.json')
  fs.writeFileSync(filePath, '[1,2,3]', 'utf-8')

  assert.throws(
    () => new FileStorageProfileRepository(filePath),
    (err: unknown) => err instanceof StoreLoadError,
  )
})

test('profile and calibration stores get the same loud-failure treatment', () => {
  const dir = makeStoreDir()

  const profilesPath = path.join(dir, 'user-profiles.json')
  fs.writeFileSync(profilesPath, '{broken', 'utf-8')
  assert.throws(
    () => new FileStorageProfileRepository(profilesPath),
    (err: unknown) => err instanceof StoreLoadError,
  )

  const calibrationsPath = path.join(dir, 'creator-calibrations.json')
  fs.writeFileSync(calibrationsPath, '{"cal": {"missionId": 42}}', 'utf-8')
  assert.throws(
    () => new FileStorageCalibrationRepository(calibrationsPath),
    (err: unknown) => err instanceof StoreLoadError && /invalid shape/.test(err.message),
  )
})
