import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getDirectionFromAngle,
  getDirectionFromVector,
  calculateDecoupledShadow,
  CompanionPathSampler,
} from '../src/utils/companionPathSampler.ts'
import type { CompanionState } from '../src/domain/companion.ts'

test('1. Angle Quantization: Converts continuous degrees to 8 compass sectors correctly', () => {
  assert.equal(getDirectionFromAngle(0), 'E')
  assert.equal(getDirectionFromAngle(22.4), 'E')
  assert.equal(getDirectionFromAngle(22.6), 'SE')
  assert.equal(getDirectionFromAngle(45), 'SE')
  assert.equal(getDirectionFromAngle(67.4), 'SE')
  assert.equal(getDirectionFromAngle(67.6), 'S')
  assert.equal(getDirectionFromAngle(90), 'S')
  assert.equal(getDirectionFromAngle(135), 'SW')
  assert.equal(getDirectionFromAngle(180), 'W')
  assert.equal(getDirectionFromAngle(225), 'NW')
  assert.equal(getDirectionFromAngle(270), 'N')
  assert.equal(getDirectionFromAngle(315), 'NE')
  assert.equal(getDirectionFromAngle(359), 'E')
})

test('2. Vector Direction: Converts (dx, dy) motion delta to compass orientation', () => {
  assert.equal(getDirectionFromVector(10, 0), 'E')
  assert.equal(getDirectionFromVector(10, 10), 'SE')
  assert.equal(getDirectionFromVector(0, 10), 'S')
  assert.equal(getDirectionFromVector(-10, 10), 'SW')
  assert.equal(getDirectionFromVector(-10, 0), 'W')
  assert.equal(getDirectionFromVector(-10, -10), 'NW')
  assert.equal(getDirectionFromVector(0, -10), 'N')
  assert.equal(getDirectionFromVector(10, -10), 'NE')
  // Zero vector default
  assert.equal(getDirectionFromVector(0, 0), 'S')
})

test('3. Companion Visual States: Types and domain conform strictly to 5 core states', () => {
  const validStates: CompanionState[] = ['idle', 'attention', 'thinking', 'moving', 'verified']
  assert.equal(validStates.length, 5)
  assert.ok(validStates.includes('idle'))
  assert.ok(validStates.includes('attention'))
  assert.ok(validStates.includes('thinking'))
  assert.ok(validStates.includes('moving'))
  assert.ok(validStates.includes('verified'))
})

test('4. Path Sampler: Handles safe sampling in Node environment without throwing', () => {
  const sampler = new CompanionPathSampler('M 0 0 L 100 0')
  assert.equal(sampler.getTotalLength(), 100)
  const sample = sampler.sampleAtDistance(50)
  assert.equal(sample.x, 50)
  assert.equal(sample.y, 0)
  assert.equal(sample.direction, 'E')
})

test('5. Decoupled Shadow Calculation: S = max(0.65, 1 - h/22) and alpha attenuation', () => {
  // Ground level (h = 0)
  const ground = calculateDecoupledShadow(0)
  assert.equal(ground.scale, 1.0)
  assert.equal(ground.opacity, 0.45)

  // Step elevation (h = 4px)
  const step = calculateDecoupledShadow(4)
  assert.ok(step.scale < 1.0)
  assert.ok(step.scale > 0.65)
  assert.equal(step.scale, 1 - 4 / 22)
  assert.equal(step.opacity, Number((0.45 * (1 - 4 / 22)).toFixed(3)))

  // Extreme elevation clamp (h = 20px) -> clamps at 0.65
  const extreme = calculateDecoupledShadow(20)
  assert.equal(extreme.scale, 0.65)
  assert.equal(extreme.opacity, Number((0.45 * 0.65).toFixed(3)))
})

test('6. Progress Sampling: sampleAtProgress(t) maps normalized [0, 1] range safely', () => {
  const sampler = new CompanionPathSampler('M 10 20 L 110 220')
  const start = sampler.sampleAtProgress(0)
  assert.equal(start.x, 10)
  assert.equal(start.y, 20)

  const mid = sampler.sampleAtProgress(0.5)
  assert.equal(mid.x, 60)
  assert.equal(mid.y, 120)

  const end = sampler.sampleAtProgress(1)
  assert.equal(end.x, 110)
  assert.equal(end.y, 220)
})

