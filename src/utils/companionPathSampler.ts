import type { CompassDirection8 } from '../domain/companion'

const COMPASS_MAP_8: CompassDirection8[] = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE']

export interface PathSample {
  x: number
  y: number
  direction: CompassDirection8
  angleDeg: number
}

export function getDirectionFromAngle(angleDeg: number): CompassDirection8 {
  const normalized = ((angleDeg % 360) + 360) % 360
  const sectorIndex = Math.floor(((normalized + 22.5) % 360) / 45)
  return COMPASS_MAP_8[sectorIndex] ?? 'E'
}

export function getDirectionFromVector(dx: number, dy: number): CompassDirection8 {
  if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) return 'S'
  const rad = Math.atan2(dy, dx)
  const angleDeg = ((rad * 180) / Math.PI + 360) % 360
  return getDirectionFromAngle(angleDeg)
}

export function calculateDecoupledShadow(bobbingHeight: number): { scale: number; opacity: number } {
  const scale = Math.max(0.65, 1 - bobbingHeight / 22)
  const opacity = Number((0.45 * scale).toFixed(3))
  return { scale, opacity }
}

interface PathSegment {
  length: number
  eval(t: number): { x: number; y: number }
  deriv(t: number): { dx: number; dy: number }
}

class LineSegment implements PathSegment {
  private p0: { x: number; y: number }
  private p1: { x: number; y: number }
  public length: number

  constructor(p0: { x: number; y: number }, p1: { x: number; y: number }) {
    this.p0 = p0
    this.p1 = p1
    this.length = Math.hypot(p1.x - p0.x, p1.y - p0.y)
  }

  public eval(t: number): { x: number; y: number } {
    const clampedT = Math.max(0, Math.min(1, t))
    return {
      x: this.p0.x + clampedT * (this.p1.x - this.p0.x),
      y: this.p0.y + clampedT * (this.p1.y - this.p0.y),
    }
  }

  public deriv(): { dx: number; dy: number } {
    return {
      dx: this.p1.x - this.p0.x,
      dy: this.p1.y - this.p0.y,
    }
  }
}

class QuadraticBezierSegment implements PathSegment {
  private p0: { x: number; y: number }
  private cp: { x: number; y: number }
  private p1: { x: number; y: number }
  public length: number

  constructor(
    p0: { x: number; y: number },
    cp: { x: number; y: number },
    p1: { x: number; y: number },
  ) {
    this.p0 = p0
    this.cp = cp
    this.p1 = p1
    // 16-point Riemann sum approximation of arc length
    let len = 0
    let prev = this.evalDirect(0)
    for (let i = 1; i <= 16; i++) {
      const curr = this.evalDirect(i / 16)
      len += Math.hypot(curr.x - prev.x, curr.y - prev.y)
      prev = curr
    }
    this.length = len
  }

  private evalDirect(t: number): { x: number; y: number } {
    const u = 1 - t
    return {
      x: u * u * this.p0.x + 2 * u * t * this.cp.x + t * t * this.p1.x,
      y: u * u * this.p0.y + 2 * u * t * this.cp.y + t * t * this.p1.y,
    }
  }

  public eval(t: number): { x: number; y: number } {
    return this.evalDirect(Math.max(0, Math.min(1, t)))
  }

  public deriv(t: number): { dx: number; dy: number } {
    const clampedT = Math.max(0, Math.min(1, t))
    const u = 1 - clampedT
    return {
      dx: 2 * u * (this.cp.x - this.p0.x) + 2 * clampedT * (this.p1.x - this.cp.x),
      dy: 2 * u * (this.cp.y - this.p0.y) + 2 * clampedT * (this.p1.y - this.cp.y),
    }
  }
}

class CubicBezierSegment implements PathSegment {
  private p0: { x: number; y: number }
  private c1: { x: number; y: number }
  private c2: { x: number; y: number }
  private p1: { x: number; y: number }
  public length: number

  constructor(
    p0: { x: number; y: number },
    c1: { x: number; y: number },
    c2: { x: number; y: number },
    p1: { x: number; y: number },
  ) {
    this.p0 = p0
    this.c1 = c1
    this.c2 = c2
    this.p1 = p1
    // 24-point numerical approximation of arc length
    let len = 0
    let prev = this.evalDirect(0)
    for (let i = 1; i <= 24; i++) {
      const curr = this.evalDirect(i / 24)
      len += Math.hypot(curr.x - prev.x, curr.y - prev.y)
      prev = curr
    }
    this.length = len
  }

  private evalDirect(t: number): { x: number; y: number } {
    const u = 1 - t
    const u2 = u * u
    const u3 = u2 * u
    const t2 = t * t
    const t3 = t2 * t
    return {
      x: u3 * this.p0.x + 3 * u2 * t * this.c1.x + 3 * u * t2 * this.c2.x + t3 * this.p1.x,
      y: u3 * this.p0.y + 3 * u2 * t * this.c1.y + 3 * u * t2 * this.c2.y + t3 * this.p1.y,
    }
  }

  public eval(t: number): { x: number; y: number } {
    return this.evalDirect(Math.max(0, Math.min(1, t)))
  }

  public deriv(t: number): { dx: number; dy: number } {
    const clampedT = Math.max(0, Math.min(1, t))
    const u = 1 - clampedT
    return {
      dx:
        3 * u * u * (this.c1.x - this.p0.x) +
        6 * u * clampedT * (this.c2.x - this.c1.x) +
        3 * clampedT * clampedT * (this.p1.x - this.c2.x),
      dy:
        3 * u * u * (this.c1.y - this.p0.y) +
        6 * u * clampedT * (this.c2.y - this.c1.y) +
        3 * clampedT * clampedT * (this.p1.y - this.c2.y),
    }
  }
}

export class CompanionPathSampler {
  private segments: PathSegment[] = []
  private totalLength: number = 0

  constructor(pathData: string) {
    this.parsePath(pathData)
  }

  private parsePath(pathData: string) {
    const commandRegex = /([a-df-z])\s*([^a-df-z]*)/gi
    let currentPoint = { x: 0, y: 0 }
    let match: RegExpExecArray | null

    while ((match = commandRegex.exec(pathData)) !== null) {
      const command = match[1]?.toUpperCase()
      const rawParams = match[2]?.trim() ?? ''
      const numbers = (rawParams.match(/[-+]?[0-9]*\.?[0-9]+(?:e[-+]?[0-9]+)?/gi) || []).map(Number)

      if (command === 'M' && numbers.length >= 2) {
        currentPoint = { x: numbers[0] ?? 0, y: numbers[1] ?? 0 }
      } else if (command === 'L' && numbers.length >= 2) {
        for (let i = 0; i + 1 < numbers.length; i += 2) {
          const nextPoint = { x: numbers[i] ?? 0, y: numbers[i + 1] ?? 0 }
          this.segments.push(new LineSegment(currentPoint, nextPoint))
          currentPoint = nextPoint
        }
      } else if (command === 'Q' && numbers.length >= 4) {
        for (let i = 0; i + 3 < numbers.length; i += 4) {
          const cp = { x: numbers[i] ?? 0, y: numbers[i + 1] ?? 0 }
          const nextPoint = { x: numbers[i + 2] ?? 0, y: numbers[i + 3] ?? 0 }
          this.segments.push(new QuadraticBezierSegment(currentPoint, cp, nextPoint))
          currentPoint = nextPoint
        }
      } else if (command === 'C' && numbers.length >= 6) {
        for (let i = 0; i + 5 < numbers.length; i += 6) {
          const c1 = { x: numbers[i] ?? 0, y: numbers[i + 1] ?? 0 }
          const c2 = { x: numbers[i + 2] ?? 0, y: numbers[i + 3] ?? 0 }
          const nextPoint = { x: numbers[i + 4] ?? 0, y: numbers[i + 5] ?? 0 }
          this.segments.push(new CubicBezierSegment(currentPoint, c1, c2, nextPoint))
          currentPoint = nextPoint
        }
      }
    }

    if (this.segments.length === 0) {
      // Fallback: simple line if parsing yielded no segments
      const numbers = (pathData.match(/[-+]?[0-9]*\.?[0-9]+/g) || []).map(Number)
      if (numbers.length >= 4) {
        const start = { x: numbers[0] ?? 0, y: numbers[1] ?? 0 }
        const end = { x: numbers[numbers.length - 2] ?? 100, y: numbers[numbers.length - 1] ?? 100 }
        this.segments.push(new LineSegment(start, end))
      } else {
        this.segments.push(new LineSegment({ x: 0, y: 0 }, { x: 100, y: 0 }))
      }
    }

    const sum = this.segments.reduce((acc, seg) => acc + seg.length, 0)
    this.totalLength = Math.max(1, sum)
  }

  public getTotalLength(): number {
    return this.totalLength
  }

  public sampleAtProgress(t: number): PathSample {
    const progress = Math.max(0, Math.min(1, t))
    return this.sampleAtDistance(progress * this.totalLength)
  }

  public sampleAtDistance(distance: number): PathSample {
    const clampedDist = Math.max(0, Math.min(distance, this.totalLength))

    let accumulated = 0
    for (let i = 0; i < this.segments.length; i++) {
      const segment = this.segments[i]!
      const segLen = segment.length

      if (clampedDist <= accumulated + segLen || i === this.segments.length - 1) {
        const distInSeg = Math.max(0, Math.min(segLen, clampedDist - accumulated))
        const t = segLen > 0 ? distInSeg / segLen : 0
        const point = segment.eval(t)
        const deriv = segment.deriv(t)
        const angleDeg = ((Math.atan2(deriv.dy, deriv.dx) * 180) / Math.PI + 360) % 360
        const direction = getDirectionFromVector(deriv.dx, deriv.dy)

        return {
          x: point.x,
          y: point.y,
          direction,
          angleDeg,
        }
      }

      accumulated += segLen
    }

    const lastSeg = this.segments[this.segments.length - 1]!
    const point = lastSeg.eval(1)
    const deriv = lastSeg.deriv(1)
    const angleDeg = ((Math.atan2(deriv.dy, deriv.dx) * 180) / Math.PI + 360) % 360
    return {
      x: point.x,
      y: point.y,
      direction: getDirectionFromVector(deriv.dx, deriv.dy),
      angleDeg,
    }
  }
}
