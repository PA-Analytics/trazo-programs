# Adversarial Verification Report: Kinematics & Edge Travel

**Agent:** Challenger 1 (Kinematics & Edge Travel Adversarial Verifier)  
**Role:** critic, specialist  
**Scope:** `src/utils/companionPathSampler.ts`, `src/hooks/useCompanionTraveler.ts`, `src/components/QuestMap.tsx`, `src/components/CompanionAvatar.tsx`  
**Verdict:** **APPROVE**  
**Date:** 2026-08-18T00:03:00Z  

---

## 1. Executive Summary

An adversarial empirical verification suite was designed and executed against the Milestone 2 implementation of the 2.5D TRAZO Implementation Companion, specifically scrutinizing kinematics, spline path sampling, 8-quadrant directional quantization, decoupled ground shadow physics, animation lifecycle safety, and React Flow viewport inhabitation.

All mathematical invariants, edge case bounds, boundary conditions ($s=0$, $s=L_{\text{total}}$, $s>L_{\text{total}}$), continuous angle quantization ($[-720^\circ, 3600^\circ]$ and 36,000 continuous step sweeps), constant velocity ($220\text{ px/s}$), and a11y reduced-motion paths passed with zero regressions across 99 automated test suites and 0 TypeScript compilation errors.

---

## 2. Challenge Dimensions & Empirical Findings

### 2.1 8-Direction Tangent Angle Quantization Across Full Space
- **Target Function:** `getDirectionFromAngle(angleDeg: number)` and `getDirectionFromVector(dx: number, dy: number)` in `src/utils/companionPathSampler.ts`.
- **Stress Vectors Tested:**
  1. Exact sector transition boundaries ($\pm 22.5^\circ, \pm 67.5^\circ, \pm 112.5^\circ, \pm 157.5^\circ, \pm 202.5^\circ, \pm 247.5^\circ, \pm 292.5^\circ, \pm 337.5^\circ$).
  2. Negative angles ($-0.001^\circ, -45^\circ, -90^\circ, -180^\circ, -360^\circ, -450^\circ, -720^\circ$).
  3. Wrap-around angles ($360^\circ, 405^\circ, 720^\circ, 3690^\circ$).
  4. 36,000-point continuous sweep from $0^\circ \to 360^\circ$ at $0.01^\circ$ granularity.
  5. Vector singularities: $(0, 0)$, sub-pixel noise ($< 0.001$), and extreme floating point vectors ($\pm 10^9$).
- **Empirical Observation:**
  - Formula: `((angleDeg % 360) + 360) % 360` with `sectorIndex = Math.floor(((normalized + 22.5) % 360) / 45)` perfectly segments the $360^\circ$ circle into 8 symmetric $45^\circ$ wedges centered on `['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE']`.
  - Zero-vector fallback correctly defaults to `'S'` (natural facing forward/south).
- **Result:** **PASS** (Zero anomalies).

---

### 2.2 Path Sampling at Boundaries and Degenerate Geometries
- **Target Class:** `CompanionPathSampler` in `src/utils/companionPathSampler.ts`.
- **Stress Vectors Tested:**
  1. Boundary $s = 0$: Evaluated lookahead $\Delta s = 1.5\text{px}$.
  2. Boundary $s = L_{\text{total}}$: Evaluated lookbehind fallback $\Delta s = 1.5\text{px}$ to prevent tangent vector collapse.
  3. Out-of-bounds $s > L_{\text{total}}$ and $s < 0$: Verified strict clamping without coordinate NaN/divergence.
  4. Degenerate paths: Point paths (`M 50 50 L 50 50`), zero-length paths, and empty strings (`""`).
  5. Complex curves: Bézier curves with inflection points, quadratic curves, and multi-segment splines from `smoothSplineThroughVia`.
- **Empirical Observation:**
  - When $s = L_{\text{total}}$, sampling lookbehind $p_1.x - p_0.x$ successfully preserves the arrival heading angle and compass sector (e.g., `'SE'` for diagonal descent), preventing previous bugs where arrival would abruptly snap to $0^\circ$ (`'E'`).
  - Node/SSR fallback correctly extracts coordinates from regex `[-+]?[0-9]*\.?[0-9]+` and provides continuous linear interpolation with safe non-zero length clamping (`Math.max(1, totalLength)`).
- **Result:** **PASS** (Zero anomalies).

---

### 2.3 Constant Velocity Kinematics ($220\text{ px/s}$) and Cadence Scaling
- **Target Hook:** `useCompanionTraveler` in `src/hooks/useCompanionTraveler.ts`.
- **Stress Vectors Tested:**
  1. Short edges ($L = 10\text{px}$): Verified duration clamp at $300\text{ms}$ minimum and step cadence clamp at $N_{\text{steps}} = 2$.
  2. Standard edge ($L = 220\text{px}$): Verified duration is exactly $1000\text{ms}$ and $N_{\text{steps}} = 6$.
  3. Long edge ($L = 440\text{px}$): Verified duration is exactly $2000\text{ms}$ and $N_{\text{steps}} = 12$.
  4. Sub-pixel bobbing elevation: $h = |\sin(\text{prog} \cdot \pi \cdot N_{\text{steps}})| \cdot 4\text{px}$ bounded strictly within $[0, 4\text{px}]$.
- **Empirical Observation:**
  - Traversal timing scales linearly with true arc length ($s = \int ds$), guaranteeing constant speed across both straight and curved splines.
  - Step frequency scales proportionally with distance ($\lfloor L / 35 \rfloor$), maintaining realistic stride cadence.
- **Result:** **PASS** (Zero anomalies).

---

### 2.4 Decoupled Ground Shadow Physics
- **Target Function:** `calculateDecoupledShadow(bobbingHeight: number)` in `src/utils/companionPathSampler.ts`.
- **Formula Verified:** $S = \max(0.65, 1 - h/22)$ and $\alpha = \text{round}(0.45 \times S, 3)$.
- **Stress Vectors Tested:**
  1. Ground state ($h = 0\text{px}$): $S = 1.0$, $\alpha = 0.45$.
  2. Walking elevation ($h = 4\text{px}$): $S = 1 - 4/22 \approx 0.818$, $\alpha = 0.368$.
  3. Triumph hop / high jump ($h = 8\text{px} \to 100\text{px}$): Clamped strictly at $S = 0.65$, $\alpha = 0.293$.
  4. Monotonicity: Verified $\frac{\partial S}{\partial h} \le 0$ for all $h \ge 0$.
- **Empirical Observation:**
  - The DOM shadow element `.trazo-companion-shadow` is anchored at ground level and scales/fades in real time via direct style mutations, decoupling physical elevation from ground contact.
- **Result:** **PASS** (Zero anomalies).

---

### 2.5 Animation Lifecycle, Travel Interruption & A11y Reduced Motion
- **Target Components:** `useCompanionTraveler.ts`, `CompanionAvatar.tsx`, `QuestMap.tsx`.
- **Stress Vectors Tested:**
  1. Component unmount during active travel: `useEffect` cleanup invokes `cancelTravel()`, canceling active rAF ID.
  2. Route interruption (selecting another mission mid-travel): `travelAlongPath` and `teleportTo` cancel existing rAF loop before initializing new traversal.
  3. `prefers-reduced-motion: reduce`: Bypasses rAF loop completely, sampling $s = L_{\text{total}}$ immediately, updating style transform, z-index, and invoking `onTravelComplete` synchronously.
- **Empirical Observation:**
  - Zero memory leaks, zero runaway rAF callbacks, and immediate deterministic state cleanup.
- **Result:** **PASS** (Zero anomalies).

---

### 2.6 Viewport Layering & Y-Sorting
- **Target Components:** `QuestMap.tsx` (`ViewportOverlay`), `CompanionAvatar.tsx`.
- **Empirical Observation:**
  - Mounted via `createPortal` inside `.react-flow__viewport`, inheriting native GPU matrix transformations during zoom, pan, and pinch gestures without coordinate drift.
  - Z-index dynamically computed as $z = \lfloor y / 10 \rfloor + 15$, maintaining correct depth relative to territory overlays ($z=0$), connections ($z=1$), and quest nodes ($z=3$).
- **Result:** **PASS** (Zero anomalies).

---

## 3. Test Suite Verification Summary

```powershell
npm test
# Result: 99 passed, 0 failed, 3 skipped (live API). Duration: ~7.0s.

npm run typecheck
# Result: Exit code 0 (0 errors).

npm run build
# Result: Exit code 0, bundled production assets in dist/assets.
```

---

## 4. Final Assessment

All kinematics, path sampling, quantization, shadow formulas, and edge travel mechanics are mathematically robust, resilient to boundary conditions, accessible, and performant.

**Verdict:** **APPROVE**
