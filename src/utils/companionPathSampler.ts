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

export class CompanionPathSampler {
  private pathElement: SVGPathElement | null = null
  private totalLength: number = 100
  private fallbackCoords: { startX: number; startY: number; endX: number; endY: number } | null = null

  constructor(pathData: string) {
    if (typeof document !== 'undefined' && typeof document.createElementNS === 'function') {
      try {
        this.pathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path')
        this.pathElement.setAttribute('d', pathData)
        this.totalLength = this.pathElement.getTotalLength() || 1
      } catch {
        this.pathElement = null
      }
    }

    if (!this.pathElement) {
      // Robust Node/SSR fallback: extract start and end coordinates from SVG path string
      const numbers = (pathData.match(/[-+]?[0-9]*\.?[0-9]+/g) || []).map(Number)
      if (numbers.length >= 4) {
        const startX = numbers[0] ?? 0
        const startY = numbers[1] ?? 0
        const endX = numbers[numbers.length - 2] ?? 100
        const endY = numbers[numbers.length - 1] ?? 100
        const dx = endX - startX
        const dy = endY - startY
        this.fallbackCoords = { startX, startY, endX, endY }
        this.totalLength = Math.max(1, Math.hypot(dx, dy))
      } else {
        this.totalLength = 100
      }
    }
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

    if (!this.pathElement) {
      // Deterministic calculation for Node/SSR environments
      const ratio = this.totalLength > 0 ? clampedDist / this.totalLength : 0
      const startX = this.fallbackCoords?.startX ?? 0
      const startY = this.fallbackCoords?.startY ?? 0
      const endX = this.fallbackCoords?.endX ?? 100
      const endY = this.fallbackCoords?.endY ?? 100
      const x = startX + ratio * (endX - startX)
      const y = startY + ratio * (endY - startY)
      const dx = endX - startX
      const dy = endY - startY
      const direction = getDirectionFromVector(dx, dy)
      const angleDeg = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360
      return { x, y, direction, angleDeg }
    }

    const p1 = this.pathElement.getPointAtLength(clampedDist)
    let dx = 0
    let dy = 0

    // Sample lookahead; if at the end of the path, sample lookbehind to retain arrival heading
    if (clampedDist < this.totalLength - 0.5) {
      const lookAheadDist = Math.min(clampedDist + 1.5, this.totalLength)
      const p2 = this.pathElement.getPointAtLength(lookAheadDist)
      dx = p2.x - p1.x
      dy = p2.y - p1.y
    } else {
      const lookBehindDist = Math.max(0, clampedDist - 1.5)
      const p0 = this.pathElement.getPointAtLength(lookBehindDist)
      dx = p1.x - p0.x
      dy = p1.y - p0.y
    }

    let angleDeg = 0
    if (Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001) {
      const rad = Math.atan2(dy, dx)
      angleDeg = ((rad * 180) / Math.PI + 360) % 360
    }

    const direction = getDirectionFromAngle(angleDeg)

    return {
      x: p1.x,
      y: p1.y,
      direction,
      angleDeg,
    }
  }
}
