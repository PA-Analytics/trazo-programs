import { useCallback, useEffect, useRef } from 'react'
import type { CompassDirection8 } from '../domain/companion'
import type { MapPosition } from '../domain/course'
import { CompanionPathSampler, calculateDecoupledShadow } from '../utils/companionPathSampler'

interface UseCompanionTravelerOptions {
  containerRef: React.RefObject<HTMLDivElement | null>
  onTravelStart?: (targetMissionId: string) => void
  onTravelComplete?: (targetMissionId: string) => void
}

export function useCompanionTraveler({
  containerRef,
  onTravelStart,
  onTravelComplete,
}: UseCompanionTravelerOptions) {
  const animFrameRef = useRef<number | null>(null)

  const cancelTravel = useCallback(() => {
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = null
    }
  }, [])

  const teleportTo = useCallback(
    (pos: MapPosition, direction: CompassDirection8 = 'SE') => {
      cancelTravel()
      const element = containerRef.current
      if (!element) return

      element.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`
      element.dataset.direction = direction
      element.dataset.state = 'idle'
      element.style.zIndex = `${Math.floor(pos.y / 10) + 15}`

      const shadow = element.querySelector('.trazo-companion-shadow') as HTMLElement | null
      if (shadow) {
        shadow.style.transform = 'translateX(-50%) scale(1)'
        shadow.style.opacity = '0.45'
      }
    },
    [cancelTravel, containerRef],
  )

  const travelAlongPath = useCallback(
    (svgPathData: string, targetMissionId: string, speedPxPerSec = 220) => {
      cancelTravel()
      const element = containerRef.current
      if (!element) return

      onTravelStart?.(targetMissionId)

      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches

      const sampler = new CompanionPathSampler(svgPathData)
      const totalLen = sampler.getTotalLength()

      if (prefersReducedMotion || totalLen <= 1) {
        const finalSample = sampler.sampleAtDistance(totalLen)
        element.style.transform = `translate3d(${finalSample.x}px, ${finalSample.y}px, 0)`
        element.dataset.direction = finalSample.direction
        element.dataset.state = 'idle'
        element.style.zIndex = `${Math.floor(finalSample.y / 10) + 15}`

        const shadow = element.querySelector('.trazo-companion-shadow') as HTMLElement | null
        if (shadow) {
          shadow.style.transform = 'translateX(-50%) scale(1)'
          shadow.style.opacity = '0.45'
        }

        onTravelComplete?.(targetMissionId)
        return
      }

      const durationMs = Math.max(300, (totalLen / speedPxPerSec) * 1000)
      const numSteps = Math.max(2, Math.floor(totalLen / 35))
      let startTime: number | null = null
      element.dataset.state = 'moving'

      const step = (now: number) => {
        if (!startTime) startTime = now
        const elapsed = now - startTime
        const progress = Math.min(elapsed / durationMs, 1)

        // Smooth easeInOutQuad easing
        const easedProgress =
          progress < 0.5
            ? 2 * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 2) / 2

        const currentDistance = easedProgress * totalLen
        const sample = sampler.sampleAtDistance(currentDistance)

        // Sub-pixel footstep bobbing (up to 4px elevation)
        const bobbing = Math.abs(Math.sin(easedProgress * Math.PI * numSteps)) * 4

        // Direct GPU mutation (bypasses React fiber reconciliation)
        element.style.transform = `translate3d(${sample.x}px, ${sample.y - bobbing}px, 0)`
        element.dataset.direction = sample.direction
        element.style.zIndex = `${Math.floor(sample.y / 10) + 15}`

        // Decoupled ground shadow scaling S = max(0.65, 1 - h/22)
        const shadow = element.querySelector('.trazo-companion-shadow') as HTMLElement | null
        if (shadow) {
          const { scale, opacity } = calculateDecoupledShadow(bobbing)
          shadow.style.transform = `translateX(-50%) scale(${scale})`
          shadow.style.opacity = `${opacity}`
        }

        if (progress < 1) {
          animFrameRef.current = requestAnimationFrame(step)
        } else {
          element.dataset.state = 'idle'
          animFrameRef.current = null
          if (shadow) {
            shadow.style.transform = 'translateX(-50%) scale(1)'
            shadow.style.opacity = '0.45'
          }
          onTravelComplete?.(targetMissionId)
        }
      }

      animFrameRef.current = requestAnimationFrame(step)
    },
    [cancelTravel, containerRef, onTravelComplete, onTravelStart],
  )

  useEffect(() => {
    return () => cancelTravel()
  }, [cancelTravel])

  return { travelAlongPath, teleportTo, cancelTravel }
}
