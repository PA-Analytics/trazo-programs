# REPEATED-FRICTION PROACTIVE RECOVERY V1 — IMPLEMENTATION REPORT

**Repository:** `C:\Proyectos\acompañante de ia`  
**Date:** 2026-08-29  
**Status:** `FRICTION_RECOVERY_V1_READY`  
**Feature:** Proactive recovery guidance triggered by repeated submission friction on active missions.

---

## 1. Executive Summary

`Repeated-Friction Proactive Recovery V1` enables TRAZO to detect when a learner encounters repeated rejections on an active mission. Without waiting for the learner to ask for help, TRAZO proactively surfaces focused, criterion-directed recovery guidance derived directly from the coach's canonical rubric.

---

## 2. Actual Trigger Semantics

- **Deterministic Rule:** The helper `detectFrictionRecovery()` inspects the chronological `evaluationProvenance` records for the currently active mission.
- **Trigger Condition:** Exactly $\ge 2$ consecutive evaluation attempts on the *same mission* result in policy verdict `REWORK`.
- **Exclusions & Edge Cases:**
  - Exactly 1 `REWORK` does **NOT** trigger an intervention.
  - Failures on other missions are never counted toward the current mission.
  - Any subsequent `PASS` or mission completion immediately clears the intervention (`null`).
  - Stale historical failures preceding a `PASS` are isolated.
  - Malformed, undefined, or empty provenance fails closed (`null`).

---

## 3. Exact Frontend Data Source & Synchronization

- **Authoritative Backend Data:** `ImplementationState.evaluationProvenance` is returned from the server in `SubmissionResponseDTO.state`.
- **Client Synchronization:** In [`src/App.tsx`](file:///c:/Proyectos/acompañante%20de%20ia/src/App.tsx), `handleSubmitEvidence` synchronizes `implementationState` on **all** evaluation outcomes (both `PASS` and non-`PASS`), ensuring the full provenance history is preserved in client memory.
- **Component Prop:** `evaluationProvenance` is passed directly into [`src/components/MissionPanel.tsx`](file:///c:/Proyectos/acompañante%20de%20ia/src/components/MissionPanel.tsx), where `useMemo` evaluates `detectFrictionRecovery`.

---

## 4. Exact Criterion Grounding (Zero AI Slop / Zero Hallucination)

- **Canonical Mapping:** `detectFrictionRecovery` identifies criteria with status `NOT_MET` across repeated attempts.
- **Rubric Resolution:** Unsatisfied criterion IDs are resolved strictly against the mission's canonical rubric ([`mission.rubric.criteria`](file:///c:/Proyectos/acompañante%20de%20ia/src/data/course.ts)).
- **Guidance Surface:** Sourced exclusively from:
  1. `criterion.label` (e.g. *"Audiencia Reconocible"*)
  2. `criterion.description` (e.g. *"Identifica con claridad el perfil, segmento o cliente objetivo..."*)
  3. `criterion.lastRationale` (latest coach/evaluator feedback on that criterion)
- **Deterministic Evaluation:** Deterministic rule-based policy evaluation without additional network requests or model quota consumption.

---

## 5. UI Surface & Presentation

- **Placement:** Inline recovery block (`.mission-friction-recovery`) inside [`MissionPanel.tsx`](file:///c:/Proyectos/acompañante%20de%20ia/src/components/MissionPanel.tsx) immediately adjacent to the submission area.
- **Companion Status:** `COMPANION_ATTENTION_DEFERRED`. V1 utilizes strictly the inline proactive recovery surface within `MissionPanel` to avoid invasive state-machine mutations.
- **Anatomy:**
  - Badge: `Acompañante · Recuperación`
  - Header: `Orientación ante intentos reiterados`
  - Focused Criterion Box: Bold label, canonical description, and previous observation.
  - Action Buttons: `[Ajustar evidencia]` (auto-focuses textarea) and `[Entendido]` (dismiss).
- **Design Tokens:** Strict adherence to the 60-30-10 palette (`--trazo-surface`, `--trazo-ink`, `--trazo-indigo`), high-contrast palette tokens, 0/12px asymmetric borders, and zero generic decorative elements.

---

## 6. Dismiss Semantics

- **Stable Identity:** `interventionId = friction-${missionId}-${latestEvaluationId}`.
- **Session-Local State:** Clicking `"Entendido"` sets `dismissedInterventionId` in local panel state, suppressing re-rendering during the session.
- **Fresh Failure Reset:** A subsequent new `REWORK` generates a new `interventionId`, legitimately allowing the intervention to re-surface if difficulty persists.

---

## 7. Invariants Protected

- **Authority:** `PASS` remains the sole authority for progression. An intervention NEVER unlocks nodes or alters `completedMissionIds`.
- **DAG Integrity:** Canonical graph structure, prerequisites, and methodology hashes remain completely unmutated.
- **Evidence Integrity:** Learner evidence is never automatically submitted or mutated.

---

## 8. Distinction from Long-Horizon Backend Autonomy

| Dimension | Repeated-Friction V1 (This Feature) | Backend Autonomy Subsystem |
| :--- | :--- | :--- |
| **Scope** | Immediate in-session friction recovery. | Multi-day background inactivity detection. |
| **Engine** | Deterministic domain helper (`detectFrictionRecovery`). | `StallDetector` + `AutonomyScheduler` + `AutonomyService`. |
| **Delivery** | Direct inline UI card in `MissionPanel`. | Background audit trail in `IAutonomyAuditRepository`. |
| **AI Dependency** | Zero new model calls (pure deterministic rubric grounding). | Optional `GeminiAutonomyReasoner` for background triage. |

---

## 9. Files Changed

| File | Change Summary |
| :--- | :--- |
| [`src/domain/learner.ts`](file:///c:/Proyectos/acompañante%20de%20ia/src/domain/learner.ts) | Implemented `detectFrictionRecovery()` and exported interfaces `ProactiveFrictionRecovery`, `TargetCriterionRecovery`. |
| [`src/components/MissionPanel.tsx`](file:///c:/Proyectos/acompa%C3%B1ante%20de%20ia/src/components/MissionPanel.tsx) | Added `evaluationProvenance` prop, friction memo, dismiss state, and `.mission-friction-recovery` card. |
| [`src/App.tsx`](file:///c:/Proyectos/acompa%C3%B1ante%20de%20ia/src/App.tsx) | Synced `implementationState` on non-PASS submissions and passed `evaluationProvenance` to `MissionPanel`. |
| [`src/styles/setup-calibration.css`](file:///c:/Proyectos/acompañante%20de%20ia/src/styles/setup-calibration.css) | Styled `.mission-friction-recovery` with high contrast, 60-30-10 palette, and accessible focus states. |
| [`tests/proactiveIntervention.test.ts`](file:///c:/Proyectos/acompañante%20de%20ia/tests/proactiveIntervention.test.ts) | 9 unit tests verifying all detection edge cases, deterministic criterion resolution, and progression immutability. |
| [`tests/proactiveIntervention.spec.ts`](file:///c:/Proyectos/acompañante%20de%20ia/tests/proactiveIntervention.spec.ts) | Playwright E2E browser flow proving 1st REWORK (no card), 2nd REWORK (card appears), dismiss, and subsequent PASS. |

---

## 10. Verification Commands & Results

```bash
# 1. Unit & Domain Tests (9/9 passing)
node --experimental-strip-types --test tests/proactiveIntervention.test.ts

# 2. Full Node Test Suite (211/211 passing)
npm test

# 3. Static Typecheck (0 errors)
npm run typecheck

# 4. Production Build (0 errors, 446ms)
npm run build

# 5. Playwright E2E Discovery & Execution:
# Total Discovered: 18 tests across 4 files.
# Active Feature Specs (4 tests in 3 files): 4/4 passing
npx playwright test tests/proactiveIntervention.spec.ts tests/firstRunRouteMaterialization.spec.ts tests/companionRetryCap.spec.ts
# Legacy Document Shell Specs (14 tests in 1 file): 14/14 pre-existing failures (pageShellScroll.spec.ts)
```

---

## 11. Live Demo Script (3-Minute Walkthrough)

1. **Enter Program:** Log in as learner and select active route.
2. **Open Mission 01 (`Premisa`):** Click the node to open `MissionPanel`.
3. **First Failed Attempt (REWORK 1):** Submit vague evidence (*"Hacer posts para vender"*). 
   - Feedback explains what is missing.
   - **No proactive intervention appears yet** (1 failure is normal learning).
4. **Second Failed Attempt (REWORK 2):** Submit second attempt with missing audience (*"Consejos diarios de productividad"*).
   - **TRAZO Proactive Moment:** Without opening the companion chat, the card `"Orientación ante intentos reiterados"` materializes inline.
   - Highlights `"Audiencia Reconocible"`, its exact rubric requirement, and previous observation.
5. **Dismiss / Adjust:** Click `"Ajustar evidencia"` $\rightarrow$ focus returns to textarea.
6. **Correct Evidence (PASS):** Submit complete premise (*"Estrategia de prospección en LinkedIn para consultores B2B de software"*).
   - Mission verifies (`PASS`), creates canonical artifact, and unlocks the next corridor on the DAG.
