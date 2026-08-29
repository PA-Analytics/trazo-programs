# TRAZO — FIRST-RUN ROUTE MATERIALIZATION V1 IMPLEMENTATION REPORT

**Repository:** `C:\Proyectos\acompañante de ia`  
**Date:** 2026-08-29  
**Status:** `FIRST_RUN_V1_INTEGRITY_READY`  
**Evaluation Scope:** Google All Things Agentic Hackathon  

---

## 1. Executive Summary

We have designed, implemented, and verified **First-Run Route Materialization V1** in TRAZO.

Rather than subjecting the learner to a generic multi-step onboarding wizard asking dormant metadata questions ("What is your goal?", "How many hours do you have?"), TRAZO now presents an immediate, consequential **Route Framing moment** grounded in the coach's canonical methodology. The learner chooses between valid, coach-authored methodological corridors (e.g. *Estructura Directa* vs *Estructura Narrativa*), which instantly materializes the selected corridor on the interactive QuestMap while preserving the full DAG structure in a quieter state.

---

## 2. Architectural Scope & Grounding

### A. Domain & Progression Layer (`src/domain/`)
- **`LearnerSetup` in `src/domain/course.ts`:**
  - Extended to support `preferredRouteId?: string`.
  - Legacy fields (`goal`, `availableTime`, `helpPreference`) made optional to prevent fake schema stubs.
- **Corridor Derivation Engine (`deriveCorridor` in `src/domain/progression.ts`):**
  - Evaluates the active chapter (currently Chapter 1 for initial onboarding).
  - Handles the single-fork corridor pattern: identifies fork nodes (e.g. `N01`), alternative branch roots (e.g. `N03` when `N02` is selected), and traversal bounds bounded by convergence nodes (`requiresAny` / `mapRole: 'convergence'`, e.g. `N05`).
  - Computes `corridorMissionIds`, `corridorEdgeIds`, `dimmedMissionIds`, `dimmedEdgeIds`, and `hasBranching`.
  - Supports linear methodology packs (`primer-cliente-digital`) with `hasBranching: false` and zero dimming.
  - *Scope boundary:* Multi-nested cascading fork permutations are not claimed beyond the validated DAG patterns in the test suite.

### B. Server & Persistence Layer (`src/server/`)
- **`LearnerSetupDTO` in `src/server/types.ts`:**
  - Added `preferredRouteId?: string` with all other fields optional.
- **Backend Route Validation (`ImplementationService.updateLearnerSetup` in `src/server/service.ts`):**
  - Resolves the implementation's canonical course methodology via `getWorkflowContext(state)`.
  - Dynamically extracts valid route IDs from chapter forks (or entry mission for linear DAGs) using `getValidRouteIdsForChapter()`.
  - Rejects unknown or non-branch mission IDs loudly before state mutation.
  - Merges non-empty submitted fields without injecting fake default values for unchosen fields like `helpPreference`.
  - Serializes mutations under per-implementation execution locks (`runExclusive`).

### C. Presentation & UX Layer (`src/components/`)
- **Route Framing Component (`src/components/LearnerQuickSetup.tsx`):**
  - Rebuilt with canonical `ProductRouteFrame`.
  - Grounded strictly in canonical `mission.title` and `mission.description` from the course chapter; does not fabricate marketing copy or infer semantics from substrings.
  - Returns a safe loading state if chapter/course data is unavailable, without hardcoding dummy options.
  - Submits exclusively `{ preferredRouteId }` without fake defaults.
- **QuestMap Overlay & Data Attributes (`src/components/QuestMap.tsx`, `QuestNode.tsx`, `QuestEdge.tsx`):**
  - Injects `data-corridor` and `data-dimmed` into node shells and edge paths.
  - **Progression Authority Invariant:** If a dimmed mission is completed or active (`progressState in ['completed', 'active', 'submitted']`), dimming is automatically lifted (reality supersedes initial preference).
- **Design System Tokens (`src/styles.css`, `src/styles/setup-calibration.css`):**
  - Follows the 60-30-10 palette (`--trazo-paper`, `--trazo-ink`, `--trazo-indigo`).
  - Dimmed branches restore full opacity on `:hover` and `:focus-within`.

---

## 3. Invariant Compliance Checklist

| Invariant | Status | Verification Evidence |
| :--- | :---: | :--- |
| **1. Canonical Graph Immutability** | ✅ PASS | Canonical hash of `course` is unchanged. No runtime nodes or edges are created or spliced. |
| **2. Zero First-Run LLM Latency** | ✅ PASS | Branch resolution is deterministic TypeScript graph traversal executed synchronously in-memory. |
| **3. PASS-Only Progression Authority** | ✅ PASS | Corridor selection alters visual hierarchy only; prerequisite checking and unlocking remain deterministic backend operations. |
| **4. Backend State Authority** | ✅ PASS | `preferredRouteId` is validated against canonical chapter routes and persisted via serialized mutex locks. |
| **5. No Fake Schema Stubs** | ✅ PASS | LearnerQuickSetup submits only `preferredRouteId`. `helpPreference` is not fabricated. |
| **6. Truthful Route Representation** | ✅ PASS | Option titles and descriptions come directly from `mission.title` and `mission.description`. |

---

## 4. Verification & Automated Test Results

### Node Test Suite (`npm test`)
- **`202 passing`**, `3 skipped` (live API diagnostics), `0 failing` across 205 tests.
- Includes 7 regression tests in `tests/firstRunRouteMaterialization.test.ts` covering direct corridor derivation, narrative corridor derivation, linear pack fallback, server persistence, backend route validation rejection of invalid/unrelated IDs, and DAG hash immutability.

### Browser Test Suite (`npx playwright test`)
- **`3 passing`**, `0 failing` across configured specs (`tests/firstRunRouteMaterialization.spec.ts`, `tests/companionRetryCap.spec.ts`).
- Verifies real browser render of Route Framing radio choices, dispatch of `{ preferredRouteId: 'N03' }`, and live materialization of corridor/dimmed attributes on QuestMap.

### TypeScript Compilation & Build
- `npm run typecheck` (`tsc -b --pretty false`): **0 errors (Clean)**.
- `npm run build` (`vite build`): **0 errors (Clean)**.
