# TRAZO — PROACTIVE STALL INTERVENTION FEASIBILITY AUDIT

**Repository:** `C:\Proyectos\acompañante de ia`  
**Date:** 2026-08-29  
**Status:** `READ-ONLY AUDIT COMPLETE`  
**Scope:** Feasibility Assessment for Google All Things Agentic Hackathon  

---

## 1. Executive Summary

This audit assesses the feasibility of introducing a **Proactive Stall Intervention** feature in TRAZO. 

Our investigation reveals a crucial architectural reality:
1. **A complete, robust Backend Autonomy Subsystem already exists** (`src/server/autonomy/`), featuring `StallDetector`, `AutonomyScheduler`, `AutonomyService`, and `GeminiAutonomyReasoner` with rigorous fail-closed policy guards, mutex locking, and audit persistence (`IAutonomyAuditRepository`).
2. **However, this backend autonomy is currently disconnected from the Learner UI**. The backend scheduler executes background scans and logs `AutonomyAuditRecord` entries to repository storage, but there is no push/query mechanism that delivers these interventions into the learner's live QuestMap or MissionPanel.
3. **In the frontend**, the companion automatically fetches recommendations via `/next-action` only when multiple unlocked paths branch out (`availableMissions.length > 1`). If a learner is stuck on a single mission experiencing repeated `REWORK` failures, the system remains passive.

We conclude that building an end-to-end proactive intervention feature is **FEASIBLE with reduced scope** by leveraging the persisted `evaluationProvenance` records to trigger **Repeated-Friction Interventions** (Option A) rather than full multi-day background inactivity polling (Option B).

---

## 2. Evidence of Existing Stall & Autonomy Capabilities

### A. Stall / Inactivity Signals in Current Code

| Signal | Status | Exact File & Code Location | Behavior / Notes |
| :--- | :---: | :--- | :--- |
| **Elapsed Inactivity (`now - updatedAt >= 24h`)** | `EXISTS` | [`src/server/autonomy/stallDetector.ts:118-130`](file:///c:/Proyectos/acompañante%20de%20ia/src/server/autonomy/stallDetector.ts#L118-L130) | `StallDetector.evaluateState` checks `now - state.updatedAt >= thresholdMs` (default 24h), filters non-terminal states with available missions, and generates `LearnerStalledEventDTO`. |
| **Repeated `REWORK` / Submission Friction** | `PARTIAL` | [`src/server/service.ts:605-636`](file:///c:/Proyectos/acompañante%20de%20ia/src/server/service.ts#L605-L636) | `state.evaluationProvenance` persists an array of every submission attempt (`missionId`, `policyVerdict`, `criterionResults`, `missingRequirements`, `timestamp`). The data exists, but no detection trigger currently aggregates consecutive failures. |
| **Multiple Unlocked Routes Stalled** | `EXISTS` | [`src/components/CompanionAvatar.tsx:222-233`](file:///c:/Proyectos/acompañante%20de%20ia/src/components/CompanionAvatar.tsx#L222-L233) | When `availableMissions.length > 1 && !proposal`, `CompanionAvatar` automatically triggers `/api/v1/implementations/:id/next-action` to offer guidance or ask for clarification. |
| **In-Session Client Inactivity Timer** | `DOES_NOT_EXIST` | N/A | There are no idle timers or keystroke monitors in `MissionPanel.tsx` or `QuestMap.tsx`. |
| **Failed `/next-action` Requests** | `EXISTS` | [`src/components/CompanionAvatar.tsx:105-108`](file:///c:/Proyectos/acompañante%20de%20ia/src/components/CompanionAvatar.tsx#L105-L108) | `autoFetchGateFor(key).held` prevents auto-retry loops on server failure and presents an explicit "Reintentar" button. |
| **Explicit Learner Help Request** | `EXISTS` | [`src/components/CompanionAvatar.tsx:296-328`](file:///c:/Proyectos/acompañante%20de%20ia/src/components/CompanionAvatar.tsx#L296-L328) | Clicking the mascot opens the companion dialog panel; submitting a prompt sends context to `/next-action`. |

---

### B. Existing Autonomy Architecture (`src/server/autonomy/`)

The backend autonomy subsystem is fully implemented and tested (see [`tests/autonomyCore.test.ts`](file:///c:/Proyectos/acompañante%20de%20ia/tests/autonomyCore.test.ts) and [`tests/autonomyLoop.test.ts`](file:///c:/Proyectos/acompañante%20de%20ia/tests/autonomyLoop.test.ts)):

1. **`StallDetector` (`stallDetector.ts`):** Scans all implementations; qualifies states with activity that have remained untouched for $>24\text{h}$.
2. **`AutonomyScheduler` (`autonomyScheduler.ts`):** Orchestrates scan batches (`runScan()`) and periodic timers (`start(intervalMs)`).
3. **`AutonomyService` (`autonomyService.ts`):**
   - Locks execution per implementation (`runExclusive`).
   - Re-checks freshness (`observedStateUpdatedAt`) and progression truth.
   - Constructs bounded `AutonomyReasonerContext` (course, stalled mission, available missions, completed missions, learner setup, verified artifacts, consequential memory).
   - Calls `IAutonomyReasoner` (`GeminiAutonomyReasoner` or `DeterministicAutonomyReasoner`).
   - **Deterministic Policy Guards:**
     - Low model confidence ($<0.70$) fails closed to `ESCALATE` (human coach review).
     - Recommending an unapproved/locked mission fails closed to `ESCALATE`.
     - Stalled mission already completed yields `NO_OP`.
     - **Invariant:** Autonomy NEVER modifies progression state, completed missions, or canonical DAG structure.
   - Saves audit trail in `IAutonomyAuditRepository`.
4. **`POST /api/v1/events/learner-stalled` (`app.ts:800-860`):** Authenticated endpoint to trigger autonomy processing.

---

### C. Persisted State Truth

`ImplementationState` in [`src/domain/course.ts:200-218`](file:///c:/Proyectos/acompañante%20de%20ia/src/domain/course.ts#L200-L218) stores:
- `updatedAt: string` — ISO timestamp updated on every mutation (`startMission`, `submitEvidence`, `updateLearnerSetup`).
- `activeMissionId?: string` — Currently started mission.
- `completedMissionIds: string[]` — Deterministic completion history.
- `learnerSetup?: LearnerSetup` — Preferences including `preferredRouteId` and `helpPreference`.
- `evaluationProvenance?: EvaluationProvenanceRecord[]` — Complete chronological list of every evaluation:
  - `missionId: string`
  - `policyVerdict: PolicyVerdict` (`'PASS' | 'CLARIFY' | 'REWORK' | 'HUMAN_REVIEW'`)
  - `timestamp: string`
  - `criterionResults: CriterionResult[]`
  - `missingRequirements?: string[]`
  - `evaluation?: StructuredEvidenceEvaluation`

**Conclusion on Persistence:** Persisted state contains rich, authoritative evidence to detect both **elapsed time stalls** (`updatedAt`) and **repeated submission friction** (`evaluationProvenance`).

---

## 3. Comparison of Minimum V1 Options

| Criterion | Option A: Repeated-Friction Intervention | Option B: Inactivity / Time-Based Intervention |
| :--- | :--- | :--- |
| **Core Trigger** | $\ge 2$ consecutive `REWORK` / `CLARIFY` attempts on the same mission. | Elapsed time ($\ge 24\text{h}$ or $\ge N\text{ min}$) since `updatedAt`. |
| **Repository Grounding** | Reads existing `evaluationProvenance` array in `ImplementationState`. | Uses `StallDetector` + `updatedAt` comparison. |
| **Client Delivery** | Instantaneous. When `submitEvidence` returns non-PASS, `MissionPanel` / `CompanionAvatar` immediately detects the pattern. | Requires creating a client polling mechanism, server SSE, or mock time-warp in demo. |
| **Deterministic Reliability** | 100% deterministic count of failed attempts. Zero clock-skew risk. | Dependent on system clock and scan intervals. |
| **Demo Clarity** | **Outstanding for live hackathon.** Judge sees: submit bad evidence $\rightarrow$ REWORK $\rightarrow$ submit bad evidence again $\rightarrow$ Companion proactively intervenes with criterion-directed help. | **Awkward for 3-minute demo.** Requires waiting or artificial clock manipulation. |
| **False-Positive Risk** | Near zero (learner is actively struggling in front of the screen). | Moderate (learner stepped away for lunch). |
| **Required Infrastructure** | **Zero new infrastructure.** | Background worker, client polling endpoint, or cron. |
| **Estimated Build Time** | **1.5 – 2.5 hours.** | 4 – 6 hours. |

---

## 4. Minimum Real V1 Design (Option A Recommended)

### UX Experience Flow:
1. **Learner Submits Evidence:** Learner receives a `REWORK` verdict on an active mission (e.g. `N01`).
2. **Second Failed Attempt:** Learner attempts again, but fails to satisfy a specific criterion (e.g. `c2_target_audience`).
3. **Proactive Companion Intervention:**
   - Instead of merely repeating generic feedback, TRAZO activates the Companion in `attention` state (`"Veo que este criterio te está costando"`).
   - In `MissionPanel` / `CompanionAvatar`, an **Intervention Card** surfaces:
     - Identifies the specific stuck criterion label.
     - Offers one targeted recovery action grounded in coach criteria (e.g. *"Enfócate sólo en identificar quién es el cliente en una frase corta"*).
     - Allows 1-click retry or dismiss.
4. **Progression Authority Invariant:** Zero optimistic unlock. State advances only when a subsequent submission genuinely achieves `PASS`.

---

## 5. Gemini / AI Policy Evaluation

- **Is a new Gemini call required?** **NO.**
  - The evaluation interpreter already generates `coachingFeedback` and `criterionResults` during `submitEvidence`.
  - The domain logic can deterministically extract the failing criteria and format targeted guidance using `adaptCompanionGuidance` in [`src/domain/learner.ts`](file:///c:/Proyectos/acompañante%20de%20ia/src/domain/learner.ts).
  - *Optional AI enhancement:* If desired, `/next-action` can be queried with the failing criteria context, but deterministic recovery is faster, 100% reliable, zero extra latency, and zero additional quota consumption.

---

## 6. Scope & Implementation Estimate

### Files to Touch (Estimated):
- `src/domain/learner.ts` (helper: `detectFrictionState(provenance, missionId)`)
- `src/components/MissionPanel.tsx` (render proactive intervention card on repeated rework)
- `src/components/CompanionAvatar.tsx` (trigger attention cue on detected friction)
- `src/styles/setup-calibration.css` (clean styling for intervention badge/card)
- `tests/proactiveIntervention.test.ts` (unit tests for friction detection)
- `tests/proactiveIntervention.spec.ts` (e2e browser flow)

### Invariants Protected:
- Zero DAG mutation.
- `PASS`-only progression authority.
- Deterministic detection based on canonical `evaluationProvenance`.

---

## 7. Risks & Mitigations

| Risk | Severity | Mitigation |
| :--- | :---: | :--- |
| **Annoying/Modal Spam** | Medium | Keep intervention inline within `MissionPanel` and subtle companion badge; no blocking modal popups. |
| **Model Hallucination on Advice** | Low | Ground guidance strictly on canonical `criterion.label` and `criterion.description` from the mission rubric. |
| **Progression Leakage** | Critical | Enforce Invariant 5: intervention can never set `completedMissionIds` or unlock edges. |

---

## 8. Final Audit Verdict

# STALL_INTERVENTION_GO_WITH_REDUCED_SCOPE
*(Option A: Repeated-Friction Intervention grounded on `evaluationProvenance`)*
