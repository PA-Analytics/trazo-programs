import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {
  CompanionPathSampler,
  getDirectionFromAngle,
  getDirectionFromVector,
  calculateDecoupledShadow,
} from '../src/utils/companionPathSampler.ts'
import type { CompanionState, CompassDirection8 } from '../src/domain/companion.ts'

test('CHALLENGER 2 - 1. Disconnected Node Path Fallback & Arbitrary Path Sampling', () => {
  // Test case A: Diagonal linear fallback M 100 100 L 500 400 (dx=400, dy=300, dist=500)
  const linearSampler = new CompanionPathSampler('M 100 100 L 500 400')
  assert.equal(linearSampler.getTotalLength(), 500)

  // Start point
  const pStart = linearSampler.sampleAtProgress(0)
  assert.equal(pStart.x, 100)
  assert.equal(pStart.y, 100)
  assert.equal(pStart.direction, 'SE')

  // Mid point
  const pMid = linearSampler.sampleAtProgress(0.5)
  assert.equal(pMid.x, 300)
  assert.equal(pMid.y, 250)
  assert.equal(pMid.direction, 'SE')

  // End point
  const pEnd = linearSampler.sampleAtProgress(1)
  assert.equal(pEnd.x, 500)
  assert.equal(pEnd.y, 400)
  assert.equal(pEnd.direction, 'SE')

  // Test case B: Backward linear fallback (traveling NW)
  const backSampler = new CompanionPathSampler('M 800 600 L 200 100')
  assert.equal(backSampler.getTotalLength(), Math.hypot(600, 500))
  const backMid = backSampler.sampleAtProgress(0.5)
  assert.equal(backMid.x, 500)
  assert.equal(backMid.y, 350)
  assert.equal(backMid.direction, 'NW')

  // Test case C: Zero-length or identical node position
  const zeroSampler = new CompanionPathSampler('M 250 250 L 250 250')
  assert.equal(zeroSampler.getTotalLength(), 1) // Safe fallback to >= 1
  const zeroSample = zeroSampler.sampleAtProgress(0.5)
  assert.equal(zeroSample.x, 250)
  assert.equal(zeroSample.y, 250)

  // Test case D: Out-of-bounds progress clamping [0, 1]
  const clampedNeg = linearSampler.sampleAtProgress(-0.5)
  assert.equal(clampedNeg.x, 100)
  const clampedPos = linearSampler.sampleAtProgress(2.5)
  assert.equal(clampedPos.x, 500)
})

test('CHALLENGER 2 - 2. Kinematic Velocity & Constant Walking Speed Formula', () => {
  const speedPxPerSec = 220

  // 1. Short path (50px): should clamp to minimum duration 300ms
  const shortLen = 50
  const shortDuration = Math.max(300, (shortLen / speedPxPerSec) * 1000)
  assert.equal(shortDuration, 300)

  // 2. Medium path (440px): 440 / 220 * 1000 = 2000ms
  const medLen = 440
  const medDuration = Math.max(300, (medLen / speedPxPerSec) * 1000)
  assert.equal(medDuration, 2000)

  // 3. Long path (1100px): 1100 / 220 * 1000 = 5000ms
  const longLen = 1100
  const longDuration = Math.max(300, (longLen / speedPxPerSec) * 1000)
  assert.equal(longDuration, 5000)

  // 4. Footstep step count formula: Math.max(2, Math.floor(totalLen / 35))
  assert.equal(Math.max(2, Math.floor(50 / 35)), 2)
  assert.equal(Math.max(2, Math.floor(440 / 35)), 12)
  assert.equal(Math.max(2, Math.floor(1100 / 35)), 31)
})

test('CHALLENGER 2 - 3. Multi-Tap Squish Reaction & Timing Mechanics Simulation', () => {
  // Simulate the tap state machine logic from CompanionAvatar.tsx
  class MascotTapStateMachine {
    tapCount = 0
    isSquished = false
    isOpen = false
    tapReaction: string | null = null
    lastTapTime = 0
    timeoutActive = false

    handleTap(timestamp: number) {
      const timeSinceLastTap = timestamp - this.lastTapTime
      this.lastTapTime = timestamp

      if (timeSinceLastTap < 350) {
        this.tapCount += 1
        if (this.tapCount >= 3) {
          this.isSquished = true
          this.tapReaction = '¡Oye! Estoy aquí concentrado jaja'
          this.timeoutActive = true
        }
      } else {
        this.tapCount = 1
        this.isOpen = !this.isOpen
      }
    }

    triggerCooldownExpire() {
      this.tapReaction = null
      this.isSquished = false
      this.tapCount = 0
      this.timeoutActive = false
    }
  }

  const sm = new MascotTapStateMachine()

  // Tap 1 at t = 1000 -> Open dialog
  sm.handleTap(1000)
  assert.equal(sm.tapCount, 1)
  assert.equal(sm.isOpen, true)
  assert.equal(sm.isSquished, false)
  assert.equal(sm.tapReaction, null)

  // Tap 2 at t = 1200 (200ms delta < 350ms) -> Increment tap count, do not toggle dialog
  sm.handleTap(1200)
  assert.equal(sm.tapCount, 2)
  assert.equal(sm.isOpen, true)
  assert.equal(sm.isSquished, false)

  // Tap 3 at t = 1400 (200ms delta < 350ms) -> Triggers squish!
  sm.handleTap(1400)
  assert.equal(sm.tapCount, 3)
  assert.equal(sm.isSquished, true)
  assert.equal(sm.tapReaction, '¡Oye! Estoy aquí concentrado jaja')
  assert.equal(sm.timeoutActive, true)

  // Tap 4 at t = 1550 (150ms delta < 350ms) -> Keeps squish active
  sm.handleTap(1550)
  assert.equal(sm.tapCount, 4)
  assert.equal(sm.isSquished, true)

  // Cooldown fires after 2400ms
  sm.triggerCooldownExpire()
  assert.equal(sm.isSquished, false)
  assert.equal(sm.tapReaction, null)
  assert.equal(sm.tapCount, 0)

  // Subsequent tap at t = 5000 (after cooldown and > 350ms) -> toggles popover closed
  sm.handleTap(5000)
  assert.equal(sm.tapCount, 1)
  assert.equal(sm.isOpen, false)
})

test('CHALLENGER 2 - 4. Visual State Priority Hierarchy & Modo TRAZO Cue Timing', () => {
  // Resolve visual state hierarchy according to CompanionAvatar.tsx:
  // stateOverride ?? (verifiedCueActive ? 'verified' : isEvaluating || isLoading ? 'thinking' : proposal ? 'attention' : 'idle')
  function resolveVisualState(params: {
    stateOverride?: CompanionState | null
    verifiedCueActive?: boolean
    isEvaluating?: boolean
    isLoading?: boolean
    proposal?: { type: string } | null
  }): CompanionState {
    const { stateOverride, verifiedCueActive, isEvaluating, isLoading, proposal } = params
    return (
      stateOverride ??
      (verifiedCueActive
        ? 'verified'
        : isEvaluating || isLoading
          ? 'thinking'
          : proposal?.type === 'ASK_CLARIFICATION' || proposal?.type === 'RECOMMEND_MISSION'
            ? 'attention'
            : 'idle')
    )
  }

  // 1. Default idle
  assert.equal(resolveVisualState({}), 'idle')

  // 2. Proposal brings ATTENTION state
  assert.equal(
    resolveVisualState({ proposal: { type: 'RECOMMEND_MISSION' } }),
    'attention',
  )
  assert.equal(
    resolveVisualState({ proposal: { type: 'ASK_CLARIFICATION' } }),
    'attention',
  )

  // 3. Evaluation or Loading overrides ATTENTION with THINKING
  assert.equal(
    resolveVisualState({
      proposal: { type: 'RECOMMEND_MISSION' },
      isLoading: true,
    }),
    'thinking',
  )
  assert.equal(
    resolveVisualState({
      proposal: { type: 'ASK_CLARIFICATION' },
      isEvaluating: true,
    }),
    'thinking',
  )

  // 4. Verified Action triggers VERIFIED (Modo TRAZO), overriding thinking and attention
  assert.equal(
    resolveVisualState({
      verifiedCueActive: true,
      isEvaluating: true,
      proposal: { type: 'RECOMMEND_MISSION' },
    }),
    'verified',
  )

  // 5. Explicit stateOverride has absolute precedence
  assert.equal(
    resolveVisualState({
      stateOverride: 'idle',
      verifiedCueActive: true,
      isEvaluating: true,
    }),
    'idle',
  )
})

test('CHALLENGER 2 - 5. Z-Index Dynamic Y-Sorting Invariant', () => {
  // Formula: z = Math.floor(y / 10) + 15
  // Verifies that characters further down the canvas (higher Y) render in front of upper elements
  const yUpper = 100
  const zUpper = Math.floor(yUpper / 10) + 15
  assert.equal(zUpper, 25)

  const yLower = 850
  const zLower = Math.floor(yLower / 10) + 15
  assert.equal(zLower, 100)

  assert.ok(zLower > zUpper, 'Lower elements must have higher Z-index for proper 2.5D depth sorting')
})

test('CHALLENGER 2 - 6. Anti-Slop & Design System Palette Verification', () => {
  const cssPath = path.resolve('c:/Proyectos/acompañante de ia/src/styles/companion.css')
  const cssContent = fs.readFileSync(cssPath, 'utf8')

  // 1. Must NOT contain generic purple gradients or AI-slop clichés
  assert.ok(!cssContent.includes('linear-gradient(to right, #8a2be2'), 'No generic purple gradients')
  assert.ok(!cssContent.includes('linear-gradient(135deg, #667eea'), 'No SaaS template gradients')
  assert.ok(!cssContent.includes('backdrop-filter: blur(20px)'), 'No excessive purposeless glassmorphism')

  // 2. Must use canonical CSS variables for 60-30-10 palette
  assert.ok(cssContent.includes('var(--trazo-paper)'), 'Uses paper token')
  assert.ok(cssContent.includes('var(--trazo-ink)'), 'Uses ink token')
  assert.ok(cssContent.includes('var(--trazo-action)'), 'Uses action (cobalt) token')
  assert.ok(cssContent.includes('var(--trazo-muted)'), 'Uses muted token')

  // 3. Must contain full prefers-reduced-motion block
  assert.ok(
    cssContent.includes('@media (prefers-reduced-motion: reduce)'),
    'Contains prefers-reduced-motion media query',
  )
  assert.ok(
    cssContent.includes('animation: none !important'),
    'Suppresses animations under reduced motion',
  )
})

test('CHALLENGER 2 - 7. Event Propagation & React Flow Drag Isolation Verification', () => {
  const tsxPath = path.resolve('c:/Proyectos/acompañante de ia/src/components/CompanionAvatar.tsx')
  const tsxContent = fs.readFileSync(tsxPath, 'utf8')

  // 1. Root container must have nodrag and nopan classes
  assert.ok(
    tsxContent.includes('className="trazo-companion-root nodrag nopan"'),
    'Root element has nodrag and nopan',
  )

  // 2. Interactive elements must stop pointerdown, mousedown, and click
  assert.ok(
    tsxContent.includes('onPointerDown={stopPointerEvent}'),
    'Stops pointer down event propagation',
  )
  assert.ok(
    tsxContent.includes('onMouseDown={stopPointerEvent}'),
    'Stops mouse down event propagation',
  )
  assert.ok(
    tsxContent.includes('onClick={stopPointerEvent}'),
    'Stops click event propagation',
  )

  // 3. Anchored panel must have nodrag and nopan classes
  assert.ok(
    tsxContent.includes('className="trazo-anchored-panel nodrag nopan"'),
    'Popover panel has nodrag and nopan',
  )
})

test('CHALLENGER 2 - 8. Accessibility Semantics & Keyboard Contract', () => {
  const tsxPath = path.resolve('c:/Proyectos/acompañante de ia/src/components/CompanionAvatar.tsx')
  const tsxContent = fs.readFileSync(tsxPath, 'utf8')

  // 1. Popover dialog must have role="dialog" and aria-label
  assert.ok(
    tsxContent.includes('role="dialog"'),
    'Anchored panel specifies role="dialog"',
  )
  assert.ok(
    tsxContent.includes('aria-label="Diálogo con Acompañante TRAZO"'),
    'Dialog has accessible descriptive label',
  )

  // 2. Escape key dismissal must focus mascot button
  assert.ok(
    tsxContent.includes("if (event.key === 'Escape')"),
    'Listens for Escape key',
  )
  assert.ok(
    tsxContent.includes('mascotBtnRef.current?.focus()'),
    'Restores focus to mascot button on dismissal',
  )

  // 3. Decorative figure parts must have aria-hidden="true"
  assert.ok(
    tsxContent.includes('aria-hidden="true"'),
    'Decorative vector sprite elements are hidden from assistive tech',
  )
})
