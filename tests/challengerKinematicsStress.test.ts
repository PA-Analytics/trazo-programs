import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getDirectionFromAngle,
  getDirectionFromVector,
  calculateDecoupledShadow,
  CompanionPathSampler,
} from '../src/utils/companionPathSampler.ts'
import type { CompassDirection8 } from '../src/domain/companion.ts'
import type { MapPosition } from '../src/domain/course.ts'

// Direct replica of smoothSplineThroughVia from QuestEdge to test without JSX loader
function smoothSplineThroughVia(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  via: MapPosition,
): string {
  const dx1 = via.x - sourceX
  const dx2 = targetX - via.x

  const c1x = sourceX + dx1 * 0.45
  const c1y = sourceY
  const c2x = via.x - dx1 * 0.45
  const c2y = via.y

  const c3x = via.x + dx2 * 0.45
  const c3y = via.y
  const c4x = targetX - dx2 * 0.45
  const c4y = targetY

  return `M ${sourceX} ${sourceY} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${via.x} ${via.y} C ${c3x} ${c3y}, ${c4x} ${c4y}, ${targetX} ${targetY}`
}

// ---------------------------------------------------------------------------
// 1. 8-Direction Tangent Angle Quantization Across [0, 360) and Boundary Angles
// ---------------------------------------------------------------------------
test('CHALLENGE 1.1: 8-Direction Sector Boundary Verification (E, SE, S, SW, W, NW, N, NE)', () => {
  // Sectors are 45 deg wide centered at:
  // E: [337.5, 22.5) -> center 0
  // SE: [22.5, 67.5) -> center 45
  // S: [67.5, 112.5) -> center 90
  // SW: [112.5, 157.5) -> center 135
  // W: [157.5, 202.5) -> center 180
  // NW: [202.5, 247.5) -> center 225
  // N: [247.5, 292.5) -> center 270
  // NE: [292.5, 337.5) -> center 315

  const sectorBoundaries = [
    { deg: 0, expected: 'E' },
    { deg: 22.499, expected: 'E' },
    { deg: 22.5, expected: 'SE' },
    { deg: 45, expected: 'SE' },
    { deg: 67.499, expected: 'SE' },
    { deg: 67.5, expected: 'S' },
    { deg: 90, expected: 'S' },
    { deg: 112.499, expected: 'S' },
    { deg: 112.5, expected: 'SW' },
    { deg: 135, expected: 'SW' },
    { deg: 157.499, expected: 'SW' },
    { deg: 157.5, expected: 'W' },
    { deg: 180, expected: 'W' },
    { deg: 202.499, expected: 'W' },
    { deg: 202.5, expected: 'NW' },
    { deg: 225, expected: 'NW' },
    { deg: 247.499, expected: 'NW' },
    { deg: 247.5, expected: 'N' },
    { deg: 270, expected: 'N' },
    { deg: 292.499, expected: 'N' },
    { deg: 292.5, expected: 'NE' },
    { deg: 315, expected: 'NE' },
    { deg: 337.499, expected: 'NE' },
    { deg: 337.5, expected: 'E' },
    { deg: 359.999, expected: 'E' },
    { deg: 360, expected: 'E' },
  ]

  for (const { deg, expected } of sectorBoundaries) {
    const actual = getDirectionFromAngle(deg)
    assert.equal(
      actual,
      expected,
      `Angle ${deg}° failed: expected ${expected}, got ${actual}`,
    )
  }
})

test('CHALLENGE 1.2: 8-Direction Negative, Multi-Turn, and Wrap-Around Angles', () => {
  // Negative angles
  assert.equal(getDirectionFromAngle(-0.001), 'E')
  assert.equal(getDirectionFromAngle(-22.4), 'E')
  assert.equal(getDirectionFromAngle(-22.6), 'NE') // 360 - 22.6 = 337.4 -> NE
  assert.equal(getDirectionFromAngle(-45), 'NE')
  assert.equal(getDirectionFromAngle(-90), 'N')
  assert.equal(getDirectionFromAngle(-135), 'NW')
  assert.equal(getDirectionFromAngle(-180), 'W')
  assert.equal(getDirectionFromAngle(-225), 'SW')
  assert.equal(getDirectionFromAngle(-270), 'S')
  assert.equal(getDirectionFromAngle(-315), 'SE')
  assert.equal(getDirectionFromAngle(-360), 'E')
  assert.equal(getDirectionFromAngle(-720), 'E')
  assert.equal(getDirectionFromAngle(-450), 'N') // -450 % 360 = -90 -> 270 -> N

  // Large positive angles
  assert.equal(getDirectionFromAngle(360), 'E')
  assert.equal(getDirectionFromAngle(405), 'SE') // 405 - 360 = 45 -> SE
  assert.equal(getDirectionFromAngle(720), 'E')
  assert.equal(getDirectionFromAngle(1080), 'E')
  assert.equal(getDirectionFromAngle(3600 + 90), 'S')
})

test('CHALLENGE 1.3: Continuous Sweep Over 36,000 Step Angles', () => {
  // Sweep from 0 to 360 in 0.01 increments and ensure valid CompassDirection8 is always returned
  const validSet = new Set<CompassDirection8>(['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'])
  for (let angle = 0; angle < 360; angle += 0.01) {
    const dir = getDirectionFromAngle(angle)
    assert.ok(validSet.has(dir), `Invalid direction returned at angle ${angle}: ${dir}`)
  }
})

test('CHALLENGE 1.4: Vector Direction Edge Cases (Zero, Sub-pixel, Extreme Coords)', () => {
  // Zero vector -> Defaults to 'S'
  assert.equal(getDirectionFromVector(0, 0), 'S')
  assert.equal(getDirectionFromVector(0.0001, 0.0001), 'S') // < 0.001 threshold
  assert.equal(getDirectionFromVector(-0.0005, 0.0002), 'S')

  // Tangents along axes
  assert.equal(getDirectionFromVector(1, 0), 'E')
  assert.equal(getDirectionFromVector(-1, 0), 'W')
  assert.equal(getDirectionFromVector(0, 1), 'S')
  assert.equal(getDirectionFromVector(0, -1), 'N')

  // Extreme vectors
  assert.equal(getDirectionFromVector(1e9, 0), 'E')
  assert.equal(getDirectionFromVector(0, 1e9), 'S')
  assert.equal(getDirectionFromVector(-1e9, -1e9), 'NW')
})

// ---------------------------------------------------------------------------
// 2. Path Sampling at Boundaries and Extreme Inputs
// ---------------------------------------------------------------------------
test('CHALLENGE 2.1: Path Boundary Conditions (s = 0, s = L_total, s > L_total, s < 0)', () => {
  const sampler = new CompanionPathSampler('M 100 200 L 400 600')
  const totalL = sampler.getTotalLength()
  assert.equal(totalL, 500) // sqrt(300^2 + 400^2) = 500

  // At s = 0
  const atZero = sampler.sampleAtDistance(0)
  assert.equal(atZero.x, 100)
  assert.equal(atZero.y, 200)
  assert.equal(atZero.direction, 'SE') // dx=300, dy=400 -> atan2(400,300) = 53.13 deg -> SE

  // At s = L_total
  const atEnd = sampler.sampleAtDistance(totalL)
  assert.equal(atEnd.x, 400)
  assert.equal(atEnd.y, 600)
  assert.equal(atEnd.direction, 'SE') // Must preserve SE arrival angle, NOT reset to E!

  // At s > L_total (clamped)
  const beyondEnd = sampler.sampleAtDistance(totalL * 2)
  assert.equal(beyondEnd.x, 400)
  assert.equal(beyondEnd.y, 600)
  assert.equal(beyondEnd.direction, 'SE')

  // At s < 0 (clamped)
  const belowZero = sampler.sampleAtDistance(-50)
  assert.equal(belowZero.x, 100)
  assert.equal(belowZero.y, 200)
  assert.equal(belowZero.direction, 'SE')
})

test('CHALLENGE 2.2: Degenerate and Zero-Length Paths', () => {
  // Single point path
  const pointSampler = new CompanionPathSampler('M 50 50 L 50 50')
  assert.ok(pointSampler.getTotalLength() >= 1) // Safe fallback minimum length >= 1
  const pointSample = pointSampler.sampleAtProgress(0.5)
  assert.equal(pointSample.x, 50)
  assert.equal(pointSample.y, 50)

  // Empty string path
  const emptySampler = new CompanionPathSampler('')
  assert.ok(emptySampler.getTotalLength() >= 1)
  const emptySample = emptySampler.sampleAtProgress(0)
  assert.ok(typeof emptySample.x === 'number')
  assert.ok(typeof emptySample.y === 'number')
  assert.ok(typeof emptySample.direction === 'string')
})

test('CHALLENGE 2.3: Multi-Segment & Complex Curves', () => {
  // Spline with via point generated by smoothSplineThroughVia
  const spline = smoothSplineThroughVia(100, 100, 300, 200, { x: 200, y: 150 })
  assert.ok(spline.startsWith('M 100 100'))
  assert.ok(spline.includes('C'))

  const splineSampler = new CompanionPathSampler(spline)
  assert.ok(splineSampler.getTotalLength() > 0)
  const sStart = splineSampler.sampleAtProgress(0)
  const sMid = splineSampler.sampleAtProgress(0.5)
  const sEnd = splineSampler.sampleAtProgress(1)

  assert.equal(sStart.x, 100)
  assert.equal(sStart.y, 100)
  assert.equal(sEnd.x, 300)
  assert.equal(sEnd.y, 200)
  assert.ok(sMid.x > 100 && sMid.x < 300)
})

// ---------------------------------------------------------------------------
// 3. Constant Velocity Kinematics (220 px/s) and Cadence Scaling
// ---------------------------------------------------------------------------
test('CHALLENGE 3.1: Duration and Cadence Calculation Invariants', () => {
  const speedPxPerSec = 220

  const calcDuration = (len: number) => Math.max(300, (len / speedPxPerSec) * 1000)
  const calcSteps = (len: number) => Math.max(2, Math.floor(len / 35))

  // Short edge (10px): duration clamped to 300ms minimum
  assert.equal(calcDuration(10), 300)
  assert.equal(calcSteps(10), 2)

  // Medium edge (220px): exact 1.000s duration
  assert.equal(calcDuration(220), 1000)
  assert.equal(calcSteps(220), 6) // floor(220 / 35) = 6

  // Long edge (440px): exact 2.000s duration
  assert.equal(calcDuration(440), 2000)
  assert.equal(calcSteps(440), 12)

  // Sub-pixel footstep bobbing height invariant
  for (let progress = 0; progress <= 1; progress += 0.05) {
    const bobbing = Math.abs(Math.sin(progress * Math.PI * 6)) * 4
    assert.ok(bobbing >= 0 && bobbing <= 4.0001, `Bobbing height out of [0, 4] bounds: ${bobbing}`)
  }
})

// ---------------------------------------------------------------------------
// 4. Decoupled Ground Shadow Formula Robustness
// ---------------------------------------------------------------------------
test('CHALLENGE 4.1: Shadow Scale and Opacity Bounds Across [0, 50px] Elevation', () => {
  // S = max(0.65, 1 - h/22)
  // alpha = 0.45 * S

  // Ground level (h = 0)
  const h0 = calculateDecoupledShadow(0)
  assert.equal(h0.scale, 1.0)
  assert.equal(h0.opacity, 0.45)

  // Typical max bobbing during walk (h = 4px)
  const h4 = calculateDecoupledShadow(4)
  assert.equal(h4.scale, 1 - 4 / 22)
  assert.equal(h4.opacity, Number((0.45 * (1 - 4 / 22)).toFixed(3)))

  // Jump / triumph hop (h = 8px) -> 1 - 8/22 = 0.636 < 0.65, so clamped at 0.65
  const h8 = calculateDecoupledShadow(8)
  assert.equal(h8.scale, 0.65)
  assert.equal(h8.opacity, Number((0.45 * 0.65).toFixed(3)))

  // Extreme elevation (h = 100px) -> clamped at 0.65
  const h100 = calculateDecoupledShadow(100)
  assert.equal(h100.scale, 0.65)
  assert.equal(h100.opacity, 0.293)

  // Monotonic non-increasing property for h >= 0
  let prevScale = 1.0
  for (let h = 0; h <= 30; h += 0.5) {
    const res = calculateDecoupledShadow(h)
    assert.ok(res.scale <= prevScale + 1e-9, `Scale increased with height at h=${h}`)
    assert.ok(res.scale >= 0.65, `Scale dropped below minimum 0.65 at h=${h}`)
    assert.ok(res.opacity >= 0.292 && res.opacity <= 0.45, `Opacity out of bounds at h=${h}`)
    prevScale = res.scale
  }
})

// ---------------------------------------------------------------------------
// 5. Node Rest Positioning and Viewport Coordinate Invariants
// ---------------------------------------------------------------------------
test('CHALLENGE 5.1: Companion Rest Position Invariants Beside Active Nodes', () => {
  const nodeDimensions = {
    normal: 88,
    optional: 72,
    milestone: 160,
  } as const

  const getNodeDimension = (mapRole?: string, nodeType: 'normal' | 'optional' | 'milestone' = 'normal') => {
    if (mapRole === 'entry' || mapRole === 'convergence') return 104
    return nodeDimensions[nodeType]
  }

  const getCompanionRestPosition = (pos: MapPosition, mapRole?: string, nodeType: 'normal' | 'optional' | 'milestone' = 'normal') => {
    const dim = getNodeDimension(mapRole, nodeType)
    return {
      x: pos.x + dim + 16,
      y: pos.y + dim / 2,
    }
  }

  // Normal node at (100, 200)
  const normalRest = getCompanionRestPosition({ x: 100, y: 200 }, 'standard', 'normal')
  assert.equal(normalRest.x, 100 + 88 + 16) // 204
  assert.equal(normalRest.y, 200 + 44) // 244

  // Entry node at (0, 0)
  const entryRest = getCompanionRestPosition({ x: 0, y: 0 }, 'entry', 'normal')
  assert.equal(entryRest.x, 104 + 16) // 120
  assert.equal(entryRest.y, 52) // 52

  // Milestone node at (500, 300)
  const milestoneRest = getCompanionRestPosition({ x: 500, y: 300 }, 'standard', 'milestone')
  assert.equal(milestoneRest.x, 500 + 160 + 16) // 676
  assert.equal(milestoneRest.y, 300 + 80) // 380
})
