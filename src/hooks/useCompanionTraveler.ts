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
  const settleTimeoutRef = useRef<number | null>(null)

  const cancelTravel = useCallback(() => {
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = null
    }

    if (settleTimeoutRef.current !== null) {
      clearTimeout(settleTimeoutRef.current)
      settleTimeoutRef.current = null
    }

    const element = containerRef.current
    if (element?.dataset.state === 'moving') {
      element.dataset.state = 'idle'
      element.dataset.motionPhase = 'settled'
      element.dataset.contact = 'settled'
      const shadow = element.querySelector('.trazo-companion-shadow') as HTMLElement | null
      if (shadow) {
        shadow.style.transform = 'translateX(-50%) scale(1, 1)'
        shadow.style.opacity = '0.45'
      }
    }
  }, [containerRef])

  const teleportTo = useCallback(
    (pos: MapPosition, direction: CompassDirection8 = 'SE') => {
      cancelTravel()
      const element = containerRef.current
      if (!element) return

      element.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`
      element.dataset.direction = direction
      element.dataset.state = 'idle'
      element.dataset.motionPhase = 'settled'
      element.dataset.contact = 'settled'
      element.style.zIndex = `${Math.floor(pos.y / 10) + 15}`

      const shadow = element.querySelector('.trazo-companion-shadow') as HTMLElement | null
      if (shadow) {
        shadow.style.transform = 'translateX(-50%) scale(1, 1)'
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
        element.dataset.motionPhase = 'settled'
        element.dataset.contact = 'settled'
        element.style.zIndex = `${Math.floor(finalSample.y / 10) + 15}`

        const shadow = element.querySelector('.trazo-companion-shadow') as HTMLElement | null
        if (shadow) {
          shadow.style.transform = 'translateX(-50%) scale(1, 1)'
          shadow.style.opacity = '0.45'
        }

        onTravelComplete?.(targetMissionId)
        return
      }

      const durationMs = Math.max(420, (totalLen / speedPxPerSec) * 1000)
      const anticipationEnd = 0.12
      const travelEnd = 0.88
      let startTime: number | null = null
      element.dataset.state = 'moving'
      element.dataset.motionPhase = 'anticipate'
      element.dataset.contact = 'moving'

      const step = (now: number) => {
        if (!startTime) startTime = now
        const elapsed = now - startTime
        const progress = Math.min(elapsed / durationMs, 1)

        const travelProgress = Math.max(
          0,
          Math.min(1, (progress - anticipationEnd) / (travelEnd - anticipationEnd)),
        )
        const easedTravelProgress =
          travelProgress < 0.5
            ? 4 * travelProgress * travelProgress * travelProgress
            : 1 - Math.pow(-2 * travelProgress + 2, 3) / 2
        const currentDistance = easedTravelProgress * totalLen
        const sample = sampler.sampleAtDistance(currentDistance)

        const lift =
          progress > anticipationEnd && progress < travelEnd
            ? Math.sin(travelProgress * Math.PI) * 1.8
            : 0
        const motionPhase = progress < anticipationEnd ? 'anticipate' : 'travel'
        element.dataset.motionPhase = motionPhase

        element.style.transform = `translate3d(${sample.x}px, ${sample.y - lift}px, 0)`
        element.dataset.direction = sample.direction
        element.style.zIndex = `${Math.floor(sample.y / 10) + 15}`

        const shadow = element.querySelector('.trazo-companion-shadow') as HTMLElement | null
        if (shadow) {
          const { scale, opacity } = calculateDecoupledShadow(lift)
          const travelWeight = Math.sin(travelProgress * Math.PI)
          const scaleX = scale * (motionPhase === 'anticipate' ? 0.92 : 1 + travelWeight * 0.12)
          const scaleY = scale * (motionPhase === 'anticipate' ? 0.82 : 0.88)
          const adjustedOpacity = opacity * (motionPhase === 'anticipate' ? 0.92 : 1 - travelWeight * 0.18)
          shadow.style.transform = `translateX(-50%) scale(${scaleX}, ${scaleY})`
          shadow.style.opacity = `${adjustedOpacity}`
        }

        if (progress < 1) {
          animFrameRef.current = requestAnimationFrame(step)
        } else {
          element.dataset.state = 'idle'
          element.dataset.motionPhase = 'settle'
          element.dataset.contact = 'settled'
          animFrameRef.current = null
          if (shadow) {
            shadow.style.transform = 'translateX(-50%) scale(1, 1)'
            shadow.style.opacity = '0.45'
          }
          settleTimeoutRef.current = window.setTimeout(() => {
            if (containerRef.current === element) {
              element.dataset.motionPhase = 'settled'
            }
            settleTimeoutRef.current = null
          }, 240)
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
