# TRAZO — METHODOLOGY / IMPLEMENTATION GRAPH CORE V1

## Executive verdict

**METHODOLOGY / IMPLEMENTATION GRAPH CORE V1: PASS WITH NOTES**

The local product core now executes a coach-scoped, course-scoped, versioned methodology graph. Nodes, dependencies, legal branches, remediation paths, criteria references, workflow provenance, companion recommendations, stall detection and autonomy routing are resolved from the pinned graph rather than from product-specific next-mission code.

The remaining notes are operational, not blockers for this mission: no production deployment was made; Firestore cloud behavior was not live-verified; a full coach graph-authoring UI is intentionally out of scope; and distributed multi-instance concurrency should receive a dedicated cloud-proof pass.

## Previous architecture

Before this mission, course packs in `src/data/packs/` and `src/data/course.ts` were the effective workflow source. `deriveMissionProgress()` and mission prerequisites determined availability, while the frontend bundled the selected pack. The existing state machine correctly denied locked missions, but methodology ordering and branching were not a persisted first-class object.

## New architecture

```text
Coach
  ↓
MethodologyService
  ↓
validated MethodologyGraph + canonical hash
  ↓
Memory / file / Firestore repository
  ↓
MethodologyGraphRuntime
  ↓
Coach Criteria result
  ↓
existing deterministic state-transition layer
  ↓
Autonomy / companion / stall detector
```

Implemented in:

- `src/domain/methodology.ts`
- `src/domain/methodologyValidation.ts`
- `src/domain/methodologyRuntime.ts`
- `src/domain/methodologyAdapter.ts`
- `src/server/methodologyService.ts`
- `src/server/repository.ts`

## Domain model

`MethodologyGraph` is persistent, versioned and owned by `coachId` + `courseId`. It contains `entryNodeIds`, `nodes`, `edges`, `status`, timestamps and `canonicalHash`.

Nodes retain mission/evidence fields and may declare prerequisites, `requiresAny`, terminal state and a scoped `criteriaRef`. Edges are bounded structured data: `DEFAULT`, `CONDITIONAL`, `REMEDIATION` or `OPTIONAL`, with constrained decision/verdict conditions and priority. No arbitrary executable condition language was introduced.

## Validation and corruption safety

Activation/repository writes fail closed for:

- duplicate node or edge IDs;
- missing entry nodes;
- broken edge endpoints;
- invalid node or edge fields;
- malformed branch decisions/verdicts;
- invalid prerequisites;
- ownership or course mismatch;
- canonical hash mismatch;
- illegal self-edges;
- non-remediation cycles.

Forward graph cycles are rejected. Remediation edges can represent explicit retry loops and are not treated as ordinary progression cycles. Runtime branch resolution is deterministic and bounded by persisted workflow state and decisions.

## Versioning and stale safety

Creating an implementation snapshots `methodologyId`, `methodologyVersion` and `methodologyHash` into authoritative workflow state. Existing learners resolve their pinned graph version; publishing a newer active version does not silently migrate them. A same-version content/hash change during evidence evaluation aborts before progression mutation.

The graph hash is included in evaluation provenance. Coach Criteria provenance remains independently versioned and its existing stale-version protections remain green.

## Criteria integration

Methodology nodes reference Coach Criteria; they do not duplicate the rubric engine. `MethodologyService.save()` checks that each reference belongs to the same coach, course and mission, and—when a calibration repository is supplied—that the referenced confirmed criteria exists in that scope.

Coach Criteria decides whether evidence passes. The graph decides which legal consequences follow. The existing state machine remains the only authority that mutates completion, artifacts or progression.

## Runtime integration

The graph runtime now supplies:

- current node progress;
- prerequisite blockers;
- legal available missions;
- legal branch targets;
- terminal state;
- methodology provenance.

`ImplementationService`, `AutonomyService`, `CompanionService` and `StallDetector` use the pinned methodology when configured. The local API exposes `GET /api/v1/implementations/:id/methodology`; the frontend consumes its graph-derived course and progress map. This closes the P1 found by Echo where companion/stall paths still used static pack ordering.

## Hardcoding audit

| Finding | Outcome |
|---|---|
| Product-critical graph lookup and progression | Migrated to `MethodologyService` + `MethodologyGraphRuntime` |
| Existing course packs | Retained as explicit legacy/demo fixtures and adapted through `methodologyAdapter.ts` |
| Frontend static fallback | Retained only for compatibility when the graph endpoint is unavailable |
| Coach graph authoring UI | Not built; fixture/API persistence is sufficient for V1 |
| Cloud scheduler/deployment | Not built; local scheduler boundary remains reusable |
| Distributed Firestore CAS / multi-instance proof | Remains for the cloud-proof mission |

There is no remaining product-critical `if mission === ... then next = ...` methodology progression path in the graph-aware runtime. Static packs remain data fixtures, not a second authority when a methodology is pinned.

## Branching and remediation evidence

The deterministic fixture in `tests/methodologyGraphCore.test.ts` proves:

- `A → OFFER` is legal for `ACCEPT`/`PASS`;
- `A → RETRY` is legal for `CLARIFY`;
- the remediation path remains inspectable and does not create duplicate node identity;
- an illegal skip to a node absent from the graph is rejected.

The same test suite proves multiple prerequisites: `C` remains locked until both `A` and `B` are complete.

## Two-coach / two-method flagship

The deterministic repository fixture uses the same course and mission identity while storing:

- Coach A v1: `A → B`;
- Coach A v2: `A → D`;
- Coach B v1: `A → P`.

The runtime resolves the pinned version for the learner and the coach-scoped active version for new work. The resulting legal next mission differs without changing runtime code or asking Gemini to invent an edge.

## Progression and autonomy safety

`ACCEPT` does not directly complete a mission. It must pass Coach Criteria validation, graph legality, artifact checks and the existing state-transition path. Non-PASS results do not unlock downstream nodes.

Autonomy receives the graph-derived available set and cannot recommend a locked or undefined target. Stall detection itself now resolves the pinned graph, so an external `learner_stalled` event is produced for a legal graph node rather than a static pack position. Replay/idempotency and stale-event protections from AUTONOMY CORE V1.1 remain green.

## Test matrix

| Area | Result | Evidence |
|---|---|---|
| Graph model and canonical hash | PASS | `tests/methodologyGraphCore.test.ts` |
| Validation/corruption | PASS | duplicate IDs, broken edges, malformed conditions and cycles |
| Version pinning/isolation | PASS | coach isolation and v1/v2 resolution tests |
| Prerequisites/unlocks | PASS | multiple-prerequisite and illegal-skip tests |
| Conditional branching | PASS | ACCEPT vs CLARIFY branch test |
| Remediation loop representation | PASS | explicit remediation edge test |
| Criteria linkage | PASS | scoped reference validation in `MethodologyService` |
| State-machine integration | PASS | existing evidence/progression regressions remain green |
| Autonomy integration | PASS | graph-aware stalled scan, locked-target rejection and existing autonomy loop tests |
| Frontend/map source | PASS WITH NOTES | API graph/progress consumed; static fallback retained for compatibility |
| Product hardcode removal | PASS WITH NOTES | legacy fixture adapters remain intentionally |

## Verification totals

- Full suite: **198 tests total, 195 pass, 0 fail, 3 skipped**.
- Methodology Graph Core focused tests: **6 pass**.
- Methodology isolation/regression tests: **7 pass**.
- Autonomy regression and loop tests: pass.
- Coach Criteria regression tests: pass.
- Typecheck: **PASS** (`npm run typecheck`).
- Build: **PASS** (`npm run build`).
- Build emitted only the existing large-client-chunk warning; no build failure.

## Provider and cloud status

- Local provider-independent graph/runtime validation: **PASS**.
- Deterministic local tests without Vertex: **PASS**.
- Gemini Developer API: **not required / not run**.
- Vertex live: **PENDING_AUTH / NOT REQUIRED**.
- Firestore emulator: **NOT RUN**; memory and file repositories were exercised.
- Production Firestore: **NOT VERIFIED**.
- Production cloud scheduler/event producer: **NOT DEPLOYED**.

## Worker contributions

### AGY

AGY was invoked with Gemini 3.7 Flash High and created the initial methodology domain modules. The upstream run timed out before producing a completion report or full integration. Its partial work was reviewed, repaired and integrated by LUNA; no unsupported AGY completion claim is made.

### ECHO

`ECHO_INDEPENDENT_REVIEW = PASS` using OpenCode with `opencode/muse-spark-1.2-contributor-free`.

Echo first performed independent reconnaissance before implementation and correctly reported the pre-feature graph gaps. Its post-fix audit found two P1 residual static-pack paths and one P2 frontend divergence. Those were corrected. The final audit reported:

```text
ECHO_POST_FIX_VERDICT=PASS
P0=0
P1=2 (found before final correction)
P2=1 (found before final correction)
```

After the final production wiring correction in `src/server/index.ts`, Echo performed a closure spot check:

```text
ECHO_CLOSURE=PASS
P0=0
P1=0
P2=0
```

The final focused and full suites pass after those corrections.

### LUNA

LUNA performed repository reconnaissance, preserved unrelated human changes, integrated the partial builder output, added persistence/service/API/runtime wiring, repaired graph-aware companion and stall detection, added tests, ran the full regression suite, typecheck and build, and authored this acceptance report.

## Remaining risks

1. Production multi-instance Firestore concurrency and cloud trigger behavior require a separate cloud-proof mission.
2. There is no full coach-facing methodology authoring UI; API/fixture creation is intentional for V1.
3. Legacy static course packs remain as compatibility/demo data and should be retired only after an explicit migration of historical workflows.
4. No live provider or production cloud claim is made.

## Final acceptance statement

TRAZO’s methodology core is now locally end-to-end executable without Vertex or production Google Cloud authentication. A coach-scoped, versioned graph defines legal workflow structure; Coach Criteria evaluates execution; deterministic validation protects transitions; autonomy and companion behavior use the pinned graph; stale versions and illegal routes fail closed; and the existing autonomy/evidence guarantees remain green.
