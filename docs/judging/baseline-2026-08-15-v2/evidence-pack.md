# TRAZO CANONICAL EVIDENCE PACK (ROUND 2 / V2)

**Evaluation Target:** All Things Agentic Hackathon 2026  
**Project:** TRAZO — AI Implementation Companion & Quest Map  
**Evaluation Date:** 2026-08-15 (Round 2 Baseline)  
**Document Status:** Canonical & Unspun Evidence Pack (V2)  

---

## 1. PRODUCT DEFINITION & SCOPE

### 1.1 What TRAZO Is
TRAZO is a web-based educational implementation companion that converts an outcome-oriented methodology into a visual directed acyclic graph (DAG) of missions, prerequisites, verified deliverables, and state-aware guidance. Instead of an open-ended conversational chatbot or a passive video library, TRAZO structures learning into an interactive quest map where progression requires submitting verifiable evidence of work.

### 1.2 User Problem & Target Audience
- **Target Buyer (Hypothesized):** Course creators, coaches, and cohort leaders who sell outcome-based educational programs but suffer from low student implementation rates and high manual review overhead.
- **Target Learner:** Students who consume course material but fail to implement due to lack of immediate feedback, unclear next actions, or absence of visible progression.

### 1.3 Demonstrated Multi-Step Workflow (Vertical Slice V2)
1. **Root Mission Submission (`N01` - "Premisa"):**
   - Learner submits premise statement.
   - Gemini 3.7 Flash evaluates against `rubric-n01` (3 criteria: `c1_concrete_idea`, `c2_target_audience`, `c3_no_filler`).
   - On `PASS`, policy engine commits completion, unlocks downstream missions `N02` and `N03`, and generates canonical immutable artifact `premise`.
2. **State-Aware Companion Guidance:**
   - When multiple branches are available (`N02` Direct vs `N03` Narrative), the companion asks a targeted clarification question (`ASK_CLARIFICATION`).
   - Upon learner response, the companion recommends the appropriate branch (`RECOMMEND_MISSION`), bounded strictly by the DAG engine.
3. **Downstream Multi-Step Consumption (`N02` - "Estructura Directa" / `N03` - "Estructura Narrativa"):**
   - Learner starts and submits deliverable for `N02` or `N03`.
   - The backend evaluator dynamically retrieves the verified `premise` artifact from Firestore and injects it into Gemini's prompt under `<trusted_context>`, while enclosing untrusted submission text in `<student_evidence>`.
   - Gemini 3.7 Flash evaluates `N02` against `rubric-n02` (including `c2_premise_consistency`, rejecting submissions that contradict the verified premise).
   - On `PASS`, policy engine records completion and produces downstream artifact (`direct_structure` or `narrative_structure`).
4. **Cross-Learner Context Isolation:**
   - Two concurrent learners with different premises receive strictly isolated `<trusted_context>` and distinct customized evaluations.

### 1.4 Active Curriculum & Rubric Coverage
- **Active Course:** 1 course definition ("Primera pieza en mercado" / `primer-sistema-de-contenido`).
- **Active Chapter:** Chapter 1 ("De idea a señal real") containing 8 missions (`N01` through `N08`).
- **Live Wired Rubrics:**
  - **`N01` ("Premisa"):** `rubric-n01` (3 criteria: `c1_concrete_idea`, `c2_target_audience`, `c3_no_filler`) → Produces `premise`.
  - **`N02` ("Estructura Directa"):** `rubric-n02` (3 criteria: `c1_three_part_order`, `c2_premise_consistency`, `c3_actionable_clarity`) → Consumes `premise`, Produces `direct_structure`.
  - **`N03` ("Estructura Narrativa"):** `rubric-n03` (3 criteria: `c1_narrative_arc`, `c2_premise_consistency`, `c3_actionable_clarity`) → Consumes `premise`, Produces `narrative_structure`.
- **Topological Nodes:** Missions `N04`–`N08` exist in DAG topology but do not yet have live rubric configurations wired.

### 1.5 What is NOT Implemented (Explicit Gaps)
- **No Self-Service Creator Editor UI:** Course DAG and rubrics are defined in code as Curriculum-as-Code (`src/data/course.ts`), not via a visual drag-and-drop authoring UI.
- **No Multi-Agent Swarm:** System uses focused single-agent roles (Evaluator, Proposer) bounded by deterministic backend code, not an autonomous multi-agent swarm.
- **No Long-Term Vector Memory:** Session continuity relies on structured Firestore state (`completedMissionIds`, `artifacts`), not an external vector database.
- **No Multi-LMS Integration:** Standalone web application; no Skool, Teachable, or Discord webhooks.

---

## 2. CORE PRODUCT MECHANISM & MULTI-STEP PIPELINE

```
[Learner Action: Submit N01]
       │
       ▼
[Gemini 3.7 Flash Evaluates rubric-n01]
       │
       ▼
[Deterministic Policy Engine -> PASS]
       │
       ▼
[State Persisted in Cloud Firestore]
- completedMissionIds += [N01]
- artifacts['premise'] = { statement: "..." }
- N02 & N03 unlocked in DAG
       │
       ├───────────────────────────────────────┐
       ▼                                       ▼
[Learner Action: Submit N02]           [Learner Action: Submit N03]
       │                                       │
       ▼                                       ▼
[Evaluator injects trusted 'premise']   [Evaluator injects trusted 'premise']
       │                                       │
       ▼                                       ▼
[Gemini 3.7 Flash Evaluates rubric-n02] [Gemini 3.7 Flash Evaluates rubric-n03]
(Validates premise consistency)         (Validates narrative arc + premise)
       │                                       │
       ▼                                       ▼
[Policy Engine -> PASS]                 [Policy Engine -> PASS]
- artifacts['direct_structure']         - artifacts['narrative_structure']
```

---

## 3. AGENTIC BEHAVIOR & AUTHORITY BOUNDARIES

### 3.1 What the AI CAN Decide (Advisory & Interpretive Authority)
1. **Multi-Step Evidence Interpretation:** Assesses whether raw learner text satisfies rubric criteria across `N01`, `N02`, and `N03`, verifying consistency against previously verified artifacts.
2. **Coaching Feedback:** Generates contextual guidance explaining why a criterion failed and how to improve.
3. **Dialogue Disambiguation:** Formulates clarification questions (`ASK_CLARIFICATION`) when learner intent between multiple open branches is ambiguous.
4. **Mission Recommendation:** Proposes which available mission to pursue next (`RECOMMEND_MISSION`) based on learner answers and verified artifacts.

### 3.2 What the AI CANNOT Decide (Zero LLM State Authority)
1. **State Mutation:** Gemini cannot directly mark a mission complete, modify arrays, or write to Firestore.
2. **Policy Verdict:** Gemini cannot override deterministic policy. Even if the LLM suggests `PASS` in metadata, if any required criterion evaluated to `NOT_MET`, the policy engine overrides to `REWORK`.
3. **Graph Topology & Legality:** Gemini cannot unlock missions, bypass prerequisites, or recommend locked missions. If Gemini outputs an invalid or locked mission ID, the server rejects it at runtime.
4. **Artifact Creation & Overwrite:** Gemini cannot create canonical state artifacts without a deterministic `PASS` verdict, and completed artifacts are immutable against subsequent overwrites.

### 3.3 What Deterministic TRAZO Owns (Authoritative Engine)
- Graph dependency mathematics (`src/domain/progression.ts`).
- Rubric evaluation policy (`src/domain/evaluationPolicy.ts`).
- Artifact injection & extraction pipeline (`src/server/service.ts`).
- State persistence and concurrency safety in Firestore (`src/server/repository.ts`).
- Route authorization and dev-endpoint blocking in production (`src/server/app.ts`).

---

## 4. ARCHITECTURE & TECH STACK

| Component | Technology | Role & Deployment |
| :--- | :--- | :--- |
| **Frontend** | React 19, TypeScript, `@xyflow/react`, Vite | Visual interactive quest map & HUD; served as same-origin static bundle |
| **Backend API** | Node.js (native HTTP server, zero heavy framework overhead) | REST API `/api/v1/*` handling submissions, next-action, and state |
| **LLM Inference** | Google Gen AI SDK (`@google/genai` v2.17.1), Gemini 3.7 Flash | Evidence interpretation and next-action reasoning via Vertex AI |
| **Database** | Cloud Firestore (`@google-cloud/firestore` v9.0.0) | Authoritative persistence for `ImplementationState` collection |
| **Cloud Hosting** | Google Cloud Run (Containerized via Docker) | Fully managed serverless deployment in `us-central1` |
| **Graph Logic** | Pure TypeScript domain module (`src/domain/`) | Deterministic DAG resolution and policy gate |

---

## 5. PRODUCTION ENVIRONMENT & VERIFICATION

- **Live Public URL:** `https://trazo-agentic-759796956692.us-central1.run.app`
- **Cloud Run Service:** `trazo-agentic`
- **GCP Project Number / ID:** `759796956692` / `trazo-agentic-2026`
- **Region:** `us-central1`
- **Model In Use:** `gemini-3.7-flash` (Vertex AI / Google Gen AI SDK)
- **Database:** Cloud Firestore (`implementations` collection)
- **Production Safety Gate:** Dev routes (`/dev-complete-mission`) strictly return `403 Forbidden` in production.

---

## 6. RELIABILITY & AUTOMATED TEST RESULTS

### 6.1 Test Suite Summary
- **Total Tests:** 57 automated tests in repo.
- **Pass:** 54 tests passed (100% of non-skipped test suite).
- **Fail:** 0 failed.
- **Skipped:** 3 tests (explicitly marked live diagnostic tests requiring manual live execution flags).
- **TypeScript Typecheck:** Clean (`tsc -b` exits with code 0).

### 6.2 Key Verified Test Scenarios
1. **Multi-Step Consequential Chaining (`tests/consequentialMultiStep.test.ts`):**
   - Locked mission `N02` cannot be submitted before prerequisites.
   - Evaluator receives verified `premise` and rejects premise-contradicting evidence for `N02`.
   - `N03` evaluator receives verified `premise` and produces `narrative_structure` artifact on `PASS`.
   - Cross-learner isolation: Learner A and Learner B receive only their own verified premise.
2. **Artifact Pipeline & Immutability (`tests/artifactPipeline.test.ts`):**
   - Non-PASS produces no canonical artifact.
   - PASS creates immutable artifact and persists to repository.
   - Repository failure during save leaves no partial canonical state.
3. **12/12 Production Destruction Tests Passed on Cloud Run:**
   - Concurrency race conditions handled cleanly (exactly 1 completion recorded).
   - In-flight client abort leaves Firestore state intact.
   - Malformed JSON / empty whitespace rejected with HTTP 400.
   - Adversarial prompt injection attacks (`SYSTEM OVERRIDE...`) fail criteria with 0 state mutations.
   - Non-existent IDs return HTTP 404 with zero ghost documents created.
   - Multi-session concurrent provisioning isolated without collisions.

---

## 7. USER & MARKET EVIDENCE

- **Creator Adoption:** **NOT YET PROVEN**. Zero external creators have deployed TRAZO to live paying cohorts.
- **Learner Retention / Completion Improvement:** **NOT YET PROVEN**. No empirical A/B test data comparing completion rates against standard LMS platforms.
- **Willingness to Pay:** **NOT YET PROVEN**. Commercial pricing and customer commitment are unvalidated hypotheses.

---

## 8. DEMO & SUBMISSION STATUS

- **4-Minute Submission Video:** **NO SUBMISSION VIDEO CURRENTLY EXISTS**.
- **Architecture Diagram:** Defined in codebase documentation and technical specs.
- **Track Selection:** Formally targeted as **Collaborative Partner** (submission metadata declaration in progress).
