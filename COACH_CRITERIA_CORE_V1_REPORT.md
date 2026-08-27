# TRAZO — Coach Criteria Core V1 Report

## Executive verdict

**COACH CRITERIA CORE V1: PASS**

TRAZO now evaluates evidence against a coach-, course-, and mission-scoped criteria set instead of applying one generic standard. The result is criterion-level, versioned, auditable, deterministic at the consequence boundary, and provider-independent in local tests.

The exact same evidence can produce different valid outcomes under different coach criteria. `ACCEPT` still flows through the existing progression state machine; the evaluator cannot complete a mission, unlock work, or overwrite criteria directly.

## Baseline architecture

Before this mission, TRAZO already had:

- `Rubric` and `RubricCriterion` on missions;
- `EvidenceEvaluatorService` → interpreter/provider → schema validation → `applyEvaluationPolicy`;
- `ImplementationService` as the authoritative evidence/state transition boundary;
- persistent implementation, calibration, memory, and audit repositories;
- coach/learner identity and methodology/course isolation;
- autonomy event runtime, idempotency, stale-event protection, and local provider-independent E2E;
- no-PASS progression protection and canonical artifact rules.

The implementation extended those boundaries. It did not create a parallel evidence engine, agent swarm, authoring UI, or cloud deployment.

## V1.1 changes

- Added coach/course/mission-scoped calibration and rubric resolution.
- Added versioned `Rubric`, `activeRubric`, status, ownership, quality signals, and evaluation provenance.
- Added criterion kinds for hard requirements, quality signals, rejection conditions, and human-review triggers.
- Added deterministic criterion-level validation and policy handling for missing, unsatisfied, uncertain, malformed, unsafe, and low-confidence results.
- Added `submissionId` + evidence hash replay protection before and after PASS.
- Added criteria snapshot provenance and SHA-256 criteria fingerprints. A content change is stale even if a coach accidentally reuses the same version string.
- Added learner-evidence prompt-injection boundaries and unsafe model-output rejection.
- Added authenticated coach-context derivation for HTTP calibration routes and rejection of arbitrary `coachId` attachment on identity-wired implementation creation.
- Added focused Coach Criteria tests and preserved the V0 calibration flow.

## Domain and persistence model

The persisted rubric carries:

```text
coachId + courseId + missionId + rubric id + version + status
required criteria[]
qualitySignals[]
system/evaluation guidance
```

An evaluation provenance record stores the implementation, coach, course, mission, criteria set, criteria version, criterion results, policy verdict, confidence, evidence hash, submission identity, and the structured evaluation snapshot. Historical records are not rewritten when criteria change.

Local tests use the existing repository contracts with `MemoryImplementationRepository` and `MemoryCalibrationRepository`. Production Firestore remains optional and was not required or contacted.

## Evaluation flow

```text
coach criteria
  → scoped criteria lookup
  → relevant mission/state/artifact context
  → provider/interpreter boundary
  → typed criterion-level evaluation
  → schema + deterministic policy validation
  → existing state-transition engine
  → provenance/audit persistence
```

Learner evidence, imported examples, and reference examples are context data, not system instructions. The runtime does not include the entire conversation history as authoritative evidence.

## Flagship same-evidence demonstration

The executable fixture in `tests/coachCriteriaCore.test.ts` uses one submission:

```text
Evidence: Propuesta para consultores sobre retención.

Coach A / N01 / v1.0.0:
  cA1 — Idea definida
  cA2 — Audiencia clara
  cA3 — Propuesta concreta
  Result: PASS / mission completed

Coach B / N01 / v1.0.0:
  cB1 — Idea definida
  cB2 — Audiencia clara
  cB3 — Propuesta concreta
  cB4 — Métrica de éxito especificada
  Result: CLARIFY
  Missing: cB4 / métrica de éxito
```

The evaluator receives the same evidence, but the resolved coach rubric differs. The result is explainable by the additional required criterion; no style or personality imitation is involved.

The product-shaped equivalent is the same five-interview submission with past behavior and repeated pain: Coach A requires those three signals and accepts; Coach B additionally requires willingness-to-pay evidence and asks for clarification.

## Safety and adversarial behavior

- Polished or detailed prose cannot satisfy a missing hard criterion.
- Positive-example similarity cannot override hard criteria.
- Hypothetical-only evidence is rejected or clarified when the coach requires observed behavior.
- Conflicting criteria fail validation or route to human review.
- Low confidence (`< 0.70`) routes to `HUMAN_REVIEW`.
- Malformed output, opaque numeric scores, unknown quality signals, unsafe rationale, and contradictory `PASS` + required `NOT_MET` fail closed.
- `IGNORE ALL PREVIOUS RULES` in learner evidence cannot override the rubric.
- Cross-coach, cross-course, and cross-mission lookups are isolated.
- Authenticated HTTP coach context is derived from the authenticated profile; a foreign `x-trazo-coach-id` header is not authoritative.
- `ACCEPT` cannot bypass locked prerequisites or the existing progression transition system.

## Versioning and stale criteria

The evaluation snapshots `criteriaSetId` and `criteriaVersion` before the provider call. After the call, the active confirmed rubric is re-read. A version change or criteria fingerprint change aborts the consequence, persists the original snapshot provenance, and does not claim that the result used the newer criteria.

Tests cover both version changes and same-version content changes.

## Adversarial matrix

| Test | Expected | Actual |
|---|---|---|
| R01 same evidence / different coach | different explainable result | PASS |
| R02 same evidence / different mission | no cross-mission reuse | PASS |
| R03 missing hard criterion | no ACCEPT | PASS |
| R04 polished irrelevant evidence | fail/clarify | PASS |
| R05 positive-example mimicry | hard requirement wins | PASS |
| R06 counterexample similarity | rejection/clarification | PASS |
| R07 conflicting criteria | validation or human review | PASS |
| R08 low confidence | HUMAN_REVIEW | PASS |
| R09–R10 stale/version update race | snapshot preserved, no progression | PASS |
| R11–R13 coach/course/mission leakage | isolated lookup | PASS |
| R14–R15 malformed or contradictory model result | fail closed | PASS |
| R16–R17 duplicate/replayed evaluation | one effective result | PASS |
| R18–R19 provider failure/timeout | valid state, retryable | PASS |
| R20 irrelevant chat injection | non-authoritative | PASS |
| R21–R23 learner/criteria prompt injection | no policy override | PASS |
| R24–R25 missing/disabled criteria | explicit safe failure | PASS |
| R26 illegal state transition | no completion/unlock | PASS |
| R27 historical provenance | criteria version retained | PASS |
| R28 provider substitution | same interpreter contract | PASS |

## Worker contributions

### AGY

Implemented the bounded production core: domain fields, calibration persistence and resolution, typed evaluation/provenance, schema and policy validation, prompt boundaries, state integration, replay protection, tests, and compatibility updates. No deployment or cloud configuration was performed.

### ECHO

`ECHO_INDEPENDENT_REVIEW = PASS`.

Echo first performed independent reconnaissance, then a final red-team pass found three real issues: coach-header impersonation, arbitrary implementation coach attachment, and a V0 hard-criteria confirmation regression. LUNA corrected them. Echo’s post-fix read-only verification confirmed the fixes and reported no remaining P0/P1. Echo also verified the criteria fingerprint stale check.

### LUNA

Reconnaissance, contract decisions, worker orchestration, integration review, adversarial correction, regression execution, final acceptance, and this report.

## Verification status

- Focused Coach Criteria + V0 tests: **22/22 PASS**.
- Full test suite: **192 total; 189 PASS, 0 FAIL, 3 SKIPPED**.
- Typecheck: **PASS** (`npm run typecheck`).
- Build: **PASS** (`npm run build`).
- Local domain E2E: **PASS**.
- Provider-independent E2E: **PASS**.
- Firestore Emulator: **NOT RUN**; local repository adapters used.
- Live Gemini API: **SKIPPED_NO_KEY**.
- Vertex live: **PENDING_AUTH / NOT REQUIRED**.
- Production cloud event producer: **NOT DEPLOYED**.

The three skips are live-provider diagnostics; they do not block the deterministic local suite.

## Remaining risks and next recommended core

No remaining P0/P1 defects were found in the post-fix audit. The current HTTP implementation-creation rule intentionally rejects a client-supplied coach assignment unless it matches an authenticated coach profile; a future identity/assignment core should formalize learner-to-coach assignment rather than accepting it from an untrusted client.

Recommended next core: Coach Criteria authoring and lifecycle management with explicit publish/archive history and assignment permissions. This is not implemented here.

## Final acceptance statement

TRAZO now evaluates learner evidence against the specific coach methodology for the specific mission, explains criterion-level outcomes, preserves criteria provenance, isolates coach/course/mission state, rejects prompt-injection overrides, and routes consequences through deterministic progression safety. The complete core is locally testable without Vertex, production Firestore, Google credentials, or deployment.
