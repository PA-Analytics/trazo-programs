## 2026-08-17T23:52:09Z
You are the Developer / Worker for the 2.5D TRAZO Implementation Companion mission.
Working directory: c:/Proyectos/acompañante de ia/.agents/worker_1

Authoritative references to read:
- ORIGINAL_REQUEST.md at c:/Proyectos/acompañante de ia/ORIGINAL_REQUEST.md
- DESIGN.md at c:/Proyectos/acompañante de ia/DESIGN.md
- PROJECT.md at c:/Proyectos/acompañante de ia/PROJECT.md
- AGENTS.md at c:/Proyectos/acompañante de ia/AGENTS.md
- Explorer 1 Survey: c:/Proyectos/acompañante de ia/.agents/explorer_survey_1/analysis.md
- Explorer 2 Survey: c:/Proyectos/acompañante de ia/.agents/explorer_survey_2/analysis.md
- Explorer 3 Survey: c:/Proyectos/acompañante de ia/.agents/explorer_survey_3/analysis.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Task & Scope:
1. Review and refine the physical 2.5D TRAZO Implementation Companion in `src/components/CompanionAvatar.tsx`, `src/hooks/useCompanionTraveler.ts`, `src/utils/companionPathSampler.ts`, and `src/styles/companion.css`.
   - Ensure all 5 visual states (`idle`, `attention`, `thinking`, `moving`, `verified`) are robustly rendered with genuine physical anatomy, antenna, compass, eyes, and decoupled ground drop shadow ($S = \max(0.65, 1 - h/22)$).
   - Verify 8-direction body/eye compass rotation (`N`, `NE`, `E`, `SE`, `S`, `SW`, `W`, `NW`) derived from tangent lookahead vector.
   - Adhere strictly to 60-30-10 palette and anti-slop rules (Paper `#F1F1EC`, Ink `#141A16`, Cobalt `#3657FF`, no generic purple SaaS gradients or emojis).
2. Mount `<CompanionAvatar>` directly into `QuestMapCanvas` in `src/components/QuestMap.tsx` within the React Flow viewport layer (`.react-flow__viewport`), ensuring it scales/pans with hardware acceleration.
   - Pass `activeNodeId`, `nodes`, `edges`, recommendation proposals, evaluation states, and navigation handlers.
   - Stop event propagation on mascot and anchored popover to ensure dragging/panning the map remains butter-smooth.
   - Remove/replace obsolete bottom bar references where appropriate in favor of the anchored in-canvas popover.
3. Wire Real-Geometry Edge Travel:
   - When the companion moves between connected nodes, retrieve the exact edge geometry (from `smoothSplineThroughVia` or `getBezierPath`) so the companion travels along the real SVG curve at constant velocity ($220\text{ px/s}$).
   - Fall back to smooth linear interpolation or instant jump if nodes are disconnected.
   - Ensure full `prefers-reduced-motion` compliance (teleports instantly with 0ms delay).
4. Anchored Conversation Popover & Micro-Reactions:
   - Ensure popover dialog supports turn history, clarification questions, and "Ir a esta ruta →" route execution CTA.
   - Clamp popover within viewport boundaries and auto-dismiss on `Escape`, outside clicks, or travel initiation.
   - Add micro-reactions (hover focus, click squish, survey idle look, triumph jump on verified PASS).
5. Build and Test Verification:
   - Run `npm run typecheck` to ensure 0 TypeScript compilation errors.
   - Run `npm test` to verify that all test suites pass with 0 regressions.
   - If needed, add or update unit/component tests in `tests/` to verify companion state transitions and path sampling.
6. Write a complete, self-contained handoff report to `c:/Proyectos/acompañante de ia/.agents/worker_1/handoff.md` and use `send_message` to report back to your caller (parent).
