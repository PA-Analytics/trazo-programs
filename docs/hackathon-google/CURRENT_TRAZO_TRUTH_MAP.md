# CURRENT_TRAZO_TRUTH_MAP

**Audit Date:** August 28, 2026  
**Auditor:** REPO_TRUTH_AGENT (Forensic Analysis)  
**Repository Scope:** `C:\Proyectos\acompañante de ia`  
**TypeScript / Build Status:** `tsc -b` PASS (0 errors), `npm test` 195/198 PASS (3 skipped live Cloud tests).

---

## 1. Executive Summary of Implementation State

TRAZO is an interactive, spatial learning and methodology operating system powered by Google Gemini and Google Cloud Platform. It replaces linear learning management systems and naive chatbot assistants with an interactive **2.5D Quest Map Canvas** and a **Deterministic Progression & Autonomy Architecture**.

The core invariant of TRAZO is: **"Probabilistic LLM reasoning for natural language understanding and adaptive coaching; 100% deterministic authority for state transitions, mission unlocking, canonical artifact production, and progression integrity."**

---

## 2. Forensic Repo Evidence Matrix

Every capability has been inspected directly in the source code and classified according to the canonical evidence hierarchy:

| CLAIM_ID | Capability | Status | File | Line / Symbol | Test Evidence | Production / GCP Evidence | Known Limitations |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TRUTH-01** | Gemini Canonical Runtime (Vertex AI + GenAI SDK) | `IMPLEMENTED_AND_TESTED` | [`src/server/ai/runtime.ts`](file:///c:/Proyectos/acompañante de ia/src/server/ai/runtime.ts#L73-L97) | `createCanonicalGeminiRuntime` | `tests/evaluator.unit.test.ts`, `tests/evaluator.live.test.ts` (opt-in) | Configured for Vertex AI ADC (`vertexai: true`, project/location) | Live test requires active Google Cloud ADC credentials. |
| **TRUTH-02** | 2.5D Physical Mascot & Kinematics Engine | `IMPLEMENTED_AND_TESTED` | [`src/components/CompanionAvatar.tsx`](file:///c:/Proyectos/acompañante de ia/src/components/CompanionAvatar.tsx), [`src/hooks/useCompanionTraveler.ts`](file:///c:/Proyectos/acompañante de ia/src/hooks/useCompanionTraveler.ts) | `CompanionAvatar`, `useCompanionTraveler`, `CompanionPathSampler` | `tests/companionMotion.test.ts`, `tests/companionVoice.test.ts` | 60/120fps rAF GPU translate3d, 8-way compass tangents, height-attenuated shadow | Canvas coordinate mapping relies on React Flow viewport DOM mounting. |
| **TRUTH-03** | Next-Action Companion Proposer | `IMPLEMENTED_AND_TESTED` | [`src/server/companion/companionService.ts`](file:///c:/Proyectos/acompañante de ia/src/server/companion/companionService.ts#L35-L105), [`src/server/companion/geminiProposer.ts`](file:///c:/Proyectos/acompañante de ia/src/server/companion/geminiProposer.ts) | `CompanionService.proposeNextAction` | `tests/nextActionCompanion.test.ts` (9/9 pass) | JSON mode via Gemini 3.7 Flash; transient retry exponential backoff | Zero side effects on state; proposes only among legally available missions. |
| **TRUTH-04** | Deterministic Evidence Evaluation Policy | `IMPLEMENTED_AND_TESTED` | [`src/domain/evaluationPolicy.ts`](file:///c:/Proyectos/acompañante de ia/src/domain/evaluationPolicy.ts#L24-L103) | `applyEvaluationPolicy` | `tests/policyEngine.test.ts`, `tests/evaluator.unit.test.ts` | Pure functional engine; confidence threshold 0.70; fail-closed on malformed/empty rubrics | Model recommendation cannot bypass required criterion NOT_MET. |
| **TRUTH-05** | Verified Action & Canonical Artifact Pipeline | `IMPLEMENTED_AND_TESTED` | [`src/server/service.ts`](file:///c:/Proyectos/acompañante de ia/src/server/service.ts#L300-L646), [`docs/PROGRESSION_ARTIFACT_CONTRACT.md`](file:///c:/Proyectos/acompañante de ia/docs/PROGRESSION_ARTIFACT_CONTRACT.md) | `ImplementationService.submitEvidence`, `buildCanonicalArtifactValue` | `tests/verifiedAction.e2e.test.ts`, `tests/artifactPipeline.test.ts`, `tests/artifactConsistency.test.ts` | Generates immutable `ImplementationArtifact` strictly upon deterministic `PASS` | Raw non-PASS evidence is recorded in provenance but never creates artifacts. |
| **TRUTH-06** | Graph Progression & DAG Math | `IMPLEMENTED_AND_TESTED` | [`src/domain/progression.ts`](file:///c:/Proyectos/acompañante de ia/src/domain/progression.ts#L19-L38) | `deriveMissionProgress`, `deriveEdgeProgress` | `tests/courseDagIntegrity.test.ts`, `tests/consequentialMultiStep.test.ts` | Mathematical resolution of prerequisites (`prerequisites`, `requiresAny`) | Forward progression only; no arbitrary skipping. |
| **TRUTH-07** | Custom Methodology Graphs & Cryptographic Hashing | `IMPLEMENTED_AND_TESTED` | [`src/domain/methodology.ts`](file:///c:/Proyectos/acompañante de ia/src/domain/methodology.ts), [`src/domain/methodologyValidation.ts`](file:///c:/Proyectos/acompañante de ia/src/domain/methodologyValidation.ts) | `computeMethodologyHash`, `validateMethodologyGraph` | `tests/methodologyGraphCore.test.ts`, `tests/methodologyIsolation.test.ts` | SHA-256 canonical hashing; cycle detection; version pinning | Dynamic coach-defined graphs must pass structural DAG validation. |
| **TRUTH-08** | Coach Calibration & Few-Shot Rubric Tuning | `IMPLEMENTED_AND_TESTED` | [`src/server/calibrationService.ts`](file:///c:/Proyectos/acompañante de ia/src/server/calibrationService.ts) | `CalibrationService` | `tests/coachCriteriaCore.test.ts`, `tests/trazoV0.test.ts` | Generates edge-case examples via Gemini; coach confirms rubric before activation | Unconfirmed calibrations cannot be used for learner grading. |
| **TRUTH-09** | Stall Detection & Proactive Autonomy Engine | `IMPLEMENTED_AND_TESTED` | [`src/server/autonomy/stallDetector.ts`](file:///c:/Proyectos/acompañante de ia/src/server/autonomy/stallDetector.ts), [`src/server/autonomy/autonomyService.ts`](file:///c:/Proyectos/acompañante de ia/src/server/autonomy/autonomyService.ts), [`src/server/autonomy/autonomyScheduler.ts`](file:///c:/Proyectos/acompañante de ia/src/server/autonomy/autonomyScheduler.ts) | `StallDetector.detectStalls`, `AutonomyService.handleStalledLearner` | `tests/autonomyCore.test.ts`, `tests/autonomyLoop.test.ts` | Idempotency key tracking; fail-closed on low confidence (<0.70) or illegal missions; audit trail | Background polling runs in-process or via `/api/v1/events/learner-stalled`. |
| **TRUTH-10** | Cloud Firestore Persistence Engine | `IMPLEMENTED_AND_TESTED` | [`src/server/repository.ts`](file:///c:/Proyectos/acompañante de ia/src/server/repository.ts#L163-L250, L480-L524, L564-L639, L851-L920) | `FirestoreImplementationRepository`, `FirestoreProfileRepository`, `FirestoreMethodologyRepository`, `FirestoreCalibrationRepository`, `FirestoreAutonomyAuditRepository` | `tests/storeLoadValidation.test.ts`, `tests/implementationState.test.ts` | Full `@google-cloud/firestore` collections for all 5 aggregates | Local dev uses file storage (`.data/*.json`) or Firestore emulator. |
| **TRUTH-11** | Concurrency Serialization & Anti-Race Protection | `IMPLEMENTED_AND_TESTED` | [`src/server/service.ts`](file:///c:/Proyectos/acompañante de ia/src/server/service.ts#L135-L140) | `ImplementationService.runExclusive` | `tests/submitEvidenceIntegrity.test.ts` (F1, F4 concurrency tests) | Mutex queue per `implementationId` prevents interleaving read-modify-write | In-memory queue per instance; multi-instance Cloud Run relies on Firestore transactions for audits. |
| **TRUTH-12** | Cloud Run Containerization | `IMPLEMENTED_NOT_TESTED` | [`Dockerfile`](file:///c:/Proyectos/acompañante de ia/Dockerfile) | Multi-stage Docker build (`node:22-alpine`) | Compiles clean (`npm run build`), container spec complete | Cloud Run container exposes port 8080, non-root user `node` | Requires running `gcloud run deploy` with service identity in active GCP project. |
| **TRUTH-13** | Anti-Slop Visual System & Tokens | `IMPLEMENTED_AND_TESTED` | [`src/styles/trazo-tokens.css`](file:///c:/Proyectos/acompañante de ia/src/styles/trazo-tokens.css), [`DESIGN.md`](file:///c:/Proyectos/acompañante de ia/DESIGN.md) | 60-30-10 palette (`#F1F1EC`, `#141A16`, `#3657FF`) | `tests/pageShellScroll.spec.ts`, `tests/companionMotion.test.ts` | Zero purple gradients, zero generic SaaS card borders, WCAG AA / APCA compliant | Strictly enforces physical paper/ink aesthetic. |

---

## 3. Truth Analysis by Subsystem

### A. Product Loop
- **What it is:** A dual-sided platform for Learners (interactive graphical quest map progression) and Coaches/Creators (methodology graph designer and rubric calibration studio).
- **Reality:** Full end-to-end loop operates locally. A learner can register, view the graph, select missions, travel along edges, submit evidence, receive fine-grained feedback, unlock downstream missions, and complete the chapter.

### B. Agent Loop & Autonomy
- **What it is:** Multi-agent interaction consisting of:
  1. *Companion Proposer:* Reactive guidance when learner asks questions or finishes a node.
  2. *Evidence Evaluator:* Structured rubric evaluation against multimodal/text evidence.
  3. *Autonomous Reasoner & Stall Detector:* Proactive event-driven agent that detects stalled progress and autonomously generates intervention guidance or human escalation.
- **Reality:** All three loops use Gemini 3.7 Flash via `@google/genai`. All three enforce strict fail-closed deterministic policy boundaries.

### C. State & Memory
- **What it is:** Deep structured state (`ImplementationState`, `UserProfile`, `CreatorCalibration`, `MethodologyGraph`, `AutonomyAuditRecord`).
- **Reality:** State includes immutable evaluation provenance records with SHA-256 evidence hashes and version snapshots, plus canonical artifacts that downstream missions consume.

### D. Dead Code / Stale Items / Overclaims
- `devCompleteMission` in `src/server/service.ts`: Deprecated endpoint guarded by `ENABLE_DEV_ROUTES=true` and identity checks. Kept only for isolated unit tests.
- Live Cloud smoke tests (`evaluator.live.test.ts`, `nextActionCompanion.live.test.ts`, `verifiedAction.live.test.ts`) are currently skipped in local CI without ADC credentials.
- No live deployed Cloud Run URL is currently listed in `README.md` (deployment configuration is ready via `Dockerfile`).

---

## 4. Repository Truth Verdict
**Classification:** `READY_FOR_AUDIT`  
The TRAZO repository contains a functional, well-tested, zero-typecheck-error TypeScript/Node.js application with explicit Google Cloud integrations and deterministic domain safeguards.
