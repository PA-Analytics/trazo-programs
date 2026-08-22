# Handoff Report — Explorer 2: Mascot 2.5D Physical Specs & Visual States

**Agent:** Explorer 2 (`mascot-visual-specifier`)  
**Directory:** `c:/Proyectos/acompañante de ia/.agents/explorer_survey_2`  
**Handoff Type:** Hard (Complete Specification)  
**Date:** 2026-08-17  

---

## 1. Observation

Direct observations from codebase inspection:

1. **`ORIGINAL_REQUEST.md` (Lines 20–33, 48–58):**
   - R1 defines: *"Mount the mascot inside the React Flow viewport layer so it naturally scales and pans with hardware acceleration. Implement directional body orientation across 8 compass angles (`N`, `NE`, `E`, `SE`, `S`, `SW`, `W`, `NW`) ... dynamic ground drop shadow with ambient occlusion (scaling/fading with bounce height) and dynamic Y-sorting Z-index."*
   - R2 defines: *"Support exactly 5 core visual states: `IDLE`, `ATTENTION`, `THINKING`, `MOVING`, and `VERIFIED` (Modo TRAZO)."*
   - Acceptance Criteria: *"Mascot sits cleanly beside the active mission node with a ground shadow. Mascot faces the tangent direction of the edge when moving between nodes. Mascot activates ATTENTION state when a clarification or route recommendation is pending without opening the chat automatically. Verified mission PASS triggers Modo TRAZO (periwinkle surface, cobalt accent, route illumination)."*

2. **`DESIGN.md` (Lines 7–12, 51–67):**
   - Anti-patterns: *"Evitar específicamente: generic SaaS dashboard aesthetic; purple SaaS gradients; glassmorphism sin propósito; cards para todo; rounded-xl indiscriminado; emojis como iconos; glow excesivo; chat como interfaz principal; branding de 'AI' como protagonista; decoración sin función."*
   - Product feeling: *"Una interfaz de progresión inspirada en quest systems y skill trees de videojuegos, reinterpretada para educación profesional. Debe sentirse exploratoria, clara, satisfactoria, seria, distintiva y adaptable a la marca del creador."*

3. **`docs/brand/BRAND_SYSTEM.md` (Lines 14–22, 26–34):**
   - Visual essence: *"Papel cálido como campo de lectura; tinta oscura como estructura, texto y borde; índigo como señal escasa de acción, ruta o progreso; geometría cartográfica: nodos, rutas, bifurcaciones, hitos y evidencia."*
   - Observable principle 1: *"La estructura se dibuja. Los límites importantes se expresan con filetes de tinta, marcos y divisores; no con sombras o gradientes."*
   - Observable principle 2: *"El color comunica estado. El índigo aparece en acción, progreso, selección, ruta completada y desbloqueo; no como relleno ambiental."*

4. **`docs/brand/TOKENS.md` (Lines 7–25, 41–47):**
   - Paleta canónica: `--trazo-paper: #F3EEE2` (fondo cálido), `--trazo-ink: #1A2119` (estructura), `--trazo-indigo: #2625B7` (acción/desbloqueo), `--trazo-stone: #969181` (bloqueado/inactivo).
   - Forma y bordes: Borde principal `2px`, radios asimétricos `.edge` (`13px 3px 13px 3px`).

5. **`src/components/CompanionAvatar.tsx` (Lines 164–178, 226–285):**
   - State resolution:
     ```typescript
     const visualState: CompanionState = isVerifiedAction
       ? 'verified'
       : isEvaluating || isLoading
         ? 'thinking'
         : proposal?.type === 'ASK_CLARIFICATION' || proposal?.type === 'RECOMMEND_MISSION'
           ? 'attention'
           : 'idle'
     ```
   - DOM Hierarchy: `trazo-companion-root` > `trazo-companion-shadow` (desacoplada) + `trazo-companion-body-btn` > `trazo-companion-halo` + `trazo-figure-antenna` + `trazo-figure-torso` (`trazo-figure-eyes`, `trazo-figure-compass`).

6. **`src/styles/companion.css` (Lines 5–36, 80–174, 194–203, 397–408):**
   - Shadow math: Radial gradient `ellipse at center, rgba(20, 26, 22, 0.45) 0%, rgba(20, 26, 22, 0) 72%`.
   - 8-Direction eye shifts mapped via `data-direction="N|NE|E|SE|S|SW|W|NW"`.
   - Strict `prefers-reduced-motion` resets all animations and transitions.

7. **`src/hooks/useCompanionTraveler.ts` (Lines 23–86):**
   - Arc speed: $220\text{ px/s}$ with constant sampling via `CompanionPathSampler`.
   - Kinematics: `easeInOutQuad` progress interpolation, $4\text{px}$ sinusoidal step bobbing, and phase-linked shadow scaling $S = \max(0.7, 1 - \text{bobbing}/20)$.

---

## 2. Logic Chain

1. **Premise 1 (Identity & Anti-Slop):** From `DESIGN.md` (lines 51–67) and `BRAND_SYSTEM.md` (lines 14–22), the companion must be designed as a physical cartographic instrument (paper + ink + cobalt) and strictly avoid cartoonish Pixar tropes, purple gradients, emoji eyes, or floating AI orbs.
2. **Premise 2 (60-30-10 Color Allocation):** By mapping the tokens from `TOKENS.md` to the 60-30-10 master rule:
   - 60% Dominant: Mineral Warm Paper (`#F1F1EC` / `#F3EEE2`) on torso and bubble surfaces.
   - 30% Structural: Technical Carbon Ink (`#141A16`) on 1.5px outlines, eyes, antenna stem, and floor shadow.
   - 10% Vibrant Accent: Pure Cobalt (`#3657FF` / `#2625B7`) reserved strictly for sensor tip, compass needle, and Modo TRAZO illumination.
3. **Premise 3 (2.5D Physical Depth & Layering):** To achieve true 2.5D grounding without visual distortion:
   - The ground shadow must be decoupled from the bouncing body (`useCompanionTraveler.ts:69–74`).
   - Sombra scaling formula: $S = \max(0.65, 1 - h/22)$ and $\alpha = 0.45 \times S$.
   - Y-sorting: `z-index = Math.floor(posY / 10) + 15` ensures natural map occlusions.
4. **Premise 4 (5 Visual States Integrity):**
   - `IDLE`: Resting next to active node with 3.4s harmonic breathing cycle.
   - `ATTENTION`: Articulated antenna (+15°), sensor tip in cobalt, non-intrusive cue pill without auto-opening panel.
   - `THINKING`: Mechanical dial vibration ($\pm 18^\circ$) and antenna sweep ($\pm 12^\circ$ over 1.2s), eliminating SaaS spinners.
   - `MOVING`: 8-quadrant directional orientation, tangent tilt ($6^\circ$), constant velocity ($220\text{ px/s}$), step bobbing ($3.5\text{px}$), and trailing waypoints.
   - `VERIFIED / MODO TRAZO`: Cobalt halo activation, periwinkle torso fill, triumph jump ($8\text{px}$), and restrained confirmation stamp.
5. **Premise 5 (Motion Accessibility):** `prefers-reduced-motion` must bypass frame-by-frame interpolation to execute instant cross-fade teleportation and suppress all infinite loops.

---

## 3. Caveats

1. **Canvas Zoom Edge Cases:** Under extreme zoom levels ($<0.4\times$ or $>1.5\times$), the pixel size of the mascot may require Level of Detail (LOD) simplification (e.g., hiding pupil shift details when zoomed far out).
2. **WebGL / Canvas Acceleration:** The current architecture uses DOM/SVG elements transformed via GPU `translate3d`. If the quest map expands to $>500$ simultaneous animated nodes, offloading the mascot to a canvas layer might be evaluated, though DOM-based hardware acceleration remains optimal for current node counts.
3. **Voice/Audio Cues:** Audio design (e.g., subtle mechanical click on milestone unlock) was not part of this survey and remains optional.

---

## 4. Conclusion

The physical 2.5D TRAZO Implementation Companion mascot is fully specified with:
- **Exact 2.5D physical anatomy** and decoupled ground shadow physics ($32\times 10\text{px}$ ellipse with height-coupled attenuation).
- **Strict 60-30-10 color balance** adhering to the mineral paper (`#F1F1EC`), carbon ink (`#141A16`), and cobalt (`#3657FF`) brand tokens.
- **Robust 5-state state-machine** (`IDLE`, `ATTENTION`, `THINKING`, `MOVING`, `VERIFIED`), completely free of generic AI slop or SaaS spinners.
- **8-directional compass orientation** and micro-reactions (hover tracking, rapid multi-tap squish, long-idle survey mode).
- **Comprehensive technical report** stored at `c:/Proyectos/acompañante de ia/.agents/explorer_survey_2/analysis.md`.

---

## 5. Verification Method

To independently verify the specifications:
1. **Design & Token Consistency:** Inspect `analysis.md` against `DESIGN.md` and `docs/brand/TOKENS.md` to confirm zero purple gradients and exact 60-30-10 token mapping.
2. **Component & Style Inspection:** Review `src/components/CompanionAvatar.tsx` and `src/styles/companion.css` to verify that the 5 states, 8 directional classes, decoupled shadow, and reduced-motion overrides are structurally aligned with this spec.
3. **Typecheck Verification:** Run:
   ```powershell
   npm run typecheck
   ```
4. **Invalidation Conditions:** The specification is invalidated if the mascot uses generic SaaS spinners, emoji eyes, unconstrained bounce loops, or violates the 60-30-10 palette by introducing non-brand gradients.
