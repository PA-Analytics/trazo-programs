# TRAZO Google Hackathon — Production Readiness Audit

Date: 2026-08-29  
Owner: TRAZO Tech Lead / Orchestrator  
Scope: local production-readiness inspection and hardening only

## Decision and evidence discipline

The current repository is the primary source of truth. Older reports, smoke scripts, and deployment notes are historical evidence only.

- `VERIFIED`: observed in the current repository or reproduced locally during this audit.
- `INFERRED`: derived from current code but not exercised against the real Google services.
- `UNVERIFIED`: requires authenticated Google Cloud or a real deployment.
- `CONTRADICTED`: an older claim is not supported by the current repository state.

No `gcloud auth`, ADC login, Cloud Run deployment, live Vertex request, live Firestore request, IAM mutation, or project/service mutation was performed.

## Worktree boundary

The initial worktree already contained uncommitted Friction Recovery work and related research documents. Those files were not discarded, staged, committed, or overwritten:

- `src/App.tsx`
- `src/components/MissionPanel.tsx`
- `src/domain/learner.ts`
- `src/styles/setup-calibration.css`
- `tests/proactiveIntervention.spec.ts`
- `tests/proactiveIntervention.test.ts`
- the pre-existing `docs/hackathon-google/*` research and implementation notes

The current Friction Recovery behavior is therefore a dependency for the eventual golden path, not a frozen release artifact. The production path must be revalidated after that work is intentionally frozen and committed by the project owner.

## Current repository truth

### Cloud Run and process lifecycle

**VERIFIED**

- `Dockerfile` uses a Node 22 Alpine builder and runner.
- The builder runs `npm ci` and `npm run build`; the runner installs production dependencies and starts `src/server/index.ts` with Node's experimental type stripping.
- The server binds to `0.0.0.0` and uses `PORT`, defaulting locally to `3001`; the image sets `PORT=8080`.
- The server serves the built `dist` assets and SPA fallback from the same process.
- With explicit production environment variables, the local server listened on port `4311`; `GET /api/v1/health` and `GET /` both returned HTTP `200`.
- The server logs the selected authoritative repository constructor at startup.

**UNVERIFIED**

- Docker is not installed in this environment, so the actual image build and container runtime were not executed.
- Cloud Run revision startup, health probing, revision rollout, and shutdown behavior were not exercised.

**Known limitation**: there is no explicit `SIGTERM`/`SIGINT` shutdown handler. Node's normal process lifecycle remains the current behavior; no shutdown redesign was added for the hackathon.

### Vertex / Gemini path

**VERIFIED from current code**

The production submission path is:

`POST /api/v1/implementations/:id/submissions`  
→ `ImplementationService.submitEvidence`  
→ `EvidenceEvaluatorService`  
→ `GeminiEvidenceInterpreter`  
→ canonical `src/server/ai/runtime.ts`  
→ `GoogleGenAI` in Vertex mode using ADC  
→ JSON parsing and schema validation  
→ deterministic `applyEvaluationPolicy`  
→ state mutation only for `PASS`.

The runtime uses:

- project: `GOOGLE_CLOUD_PROJECT`, then `GCLOUD_PROJECT`, then the documented legacy default `trazo-agentic-2026`;
- location: `GOOGLE_CLOUD_LOCATION`, default `global`;
- model: `GEMINI_MODEL`, default `gemini-3.7-flash`;
- authentication: Vertex/ADC in production;
- `TRAZO_LOCAL_AI_AUTH=api-key`: explicitly rejected when `NODE_ENV=production`.

There is no provider or model fallback in the canonical runtime. The evaluator retries only transient provider responses, then returns a non-PASS/system failure path without granting progression.

**UNVERIFIED**: ADC validity, Vertex API enablement, service-account permissions, model availability, quota, latency, and real Gemini output were not tested.

### Firestore and persistence

**VERIFIED from current code**

- The repository factory supports `firestore`, `filestorage`, and `memory` for non-production use.
- Firestore collections are `implementations`, `user_profiles`, `methodologies`, `creator_calibrations`, and `autonomy_audits`.
- Implementation state is read by document ID and persisted using Firestore `set(..., { merge: true })`.
- Reload reads from the selected repository again; frontend state is not the canonical progression authority.
- Before this audit, production could select file storage by omission and could accept an explicit memory backend.
- The local hardening now makes every production repository factory fail closed unless the process environment contains `STORAGE_BACKEND=firestore`; production also rejects `FIRESTORE_EMULATOR_HOST`.
- Explicit factory arguments cannot bypass the production guard with `memory` or `filestorage`.
- Non-production selection behavior remains available for tests and local development.

**UNVERIFIED**

- Firestore ADC, reads, writes, indexes, document permissions, regional behavior, and reload against a live database.
- Whether a future deployment command actually injects `STORAGE_BACKEND=firestore`.

The Docker image intentionally does not bake in a storage default. Deployment must provide the explicit production variable so a missing deployment configuration fails visibly.

### Health and startup

**VERIFIED**

- `GET /api/v1/health` is a liveness endpoint returning `{ status: "ok", timestamp }`.
- It does not prove Firestore connectivity, Vertex connectivity, IAM, model availability, or application readiness.
- Repository selection is validated before `server.listen`; missing or non-Firestore production storage configuration fails before the server starts.
- Firestore and Vertex network/authentication failures can still first surface on an actual repository or model operation.

This endpoint is not readiness theater if interpreted as liveness, but it must not be reported as a dependency health check.

### Logging and operational visibility

**VERIFIED**

- Startup logs the server address and repository implementation.
- The next-action path logs timing and token metadata with the implementation ID.
- Submission error paths log an error code/status.

**Known gap**: there is no complete structured request/correlation trace covering request ID, implementation ID, mission ID, provider/model, evaluation verdict, policy verdict, persistence result, state version, and end-to-end latency. Raw learner evidence is not logged by the reviewed submission path. A large observability stack was intentionally out of scope.

### Concurrency and multi-instance behavior

**VERIFIED from current code**

- `runExclusive(implementationId)` serializes submissions only inside one Node process.
- `ImplementationState` has no version/compare-and-swap field.
- Firestore implementation saves do not use a transaction or write precondition for the full state update.
- The autonomy audit idempotency record uses a Firestore transaction, but that does not protect all implementation-state mutations or prevent duplicate provider calls across instances.

**Conclusion**: two Cloud Run instances can read the same implementation state, evaluate concurrently, and later write stale full states. The system is not multi-instance safe.

The selected hackathon mitigation is deployment constraint A: use `--max-instances=1` and do not claim enterprise-grade distributed concurrency. A distributed lock or broad Firestore versioning refactor was not locally justified under this scope.

### Identity and access boundary

**VERIFIED**: current application identity is supplied through request headers such as `x-trazo-user-id`/`x-trazo-mode`; these are not a production authentication mechanism by themselves.

**P0_LIVE_AUTH_REQUIRED / HUMAN DECISION**: the owner must decide the Cloud Run ingress/authentication model and how learner identity is trusted before calling the public service production-ready. Building a new auth platform was explicitly outside this local hardening mission.

### Existing production evidence

**VERIFIED**: older scripts and documents contain a historical Cloud Run URL, service name `trazo-agentic`, project `trazo-agentic-2026`, and region `us-central1`; scripts also contain live smoke flows.

**UNVERIFIED / CONTRADICTED as current proof**: the current repository contains no current deployment receipt, current production URL authority, authenticated Cloud Logging evidence, or live Vertex/Firestore evidence. Historical claims of passed live suites cannot be promoted to current production verification.

## Risk classification and disposition

| Class | Finding | Disposition |
| --- | --- | --- |
| `P0_LOCAL_FIX` | Production storage selection could silently use file storage or accept memory; emulator could be used in production. | Implemented and locally verified. |
| `P0_LIVE_AUTH_REQUIRED` | ADC, Vertex, Firestore, IAM, Cloud Run deployment, ingress, and current URL are not verified. | Checklist only; no live action today. |
| `P0_LIVE_AUTH_REQUIRED` | Header-based identity is not sufficient public authentication. | Human decision; no broad auth build. |
| `P1_OPTIONAL` | Liveness-only health, incomplete structured trace, graceful shutdown, image build, and multi-instance safety remain bounded gaps. | Documented; no scope expansion. |
| `DO_NOT_DO_FOR_HACKATHON` | Distributed locks/version migration, auth platform, OTel stack, UI redesign, SSE/WebSockets, cron, dynamic graph changes, or policy changes. | Explicitly not built. |

## Multi-agent build and review record

### AGY / Gemini implementation

AGY was invoked through the installed `agy` CLI with edit permission scoped by prompt to the approved storage boundary. The first invocation timed out waiting for the final wrapper response, but its actual diff was inspected. It changed only:

- `src/server/repository.ts`
- `tests/storageBackendSelection.test.ts`

The repair invocation addressed the only valid adversarial finding below. It also timed out at the wrapper level after editing; Luna independently ran the focused tests and all final verification commands. No deployment, authentication, or commit was performed.

### ECHO / OpenCode red team

ECHO was invoked using the requested route `opencode/muse-spark-1.2-contributor-free`. The review was read-only; no reasoning level was inferred or claimed. It reviewed the actual AGY diff and repository state.

Material findings:

1. The production guard could be bypassed by passing an explicit `firestore` argument while the environment was missing or wrong.
2. The new fail-closed guard means deployment must inject `STORAGE_BACKEND=firestore`; adding a Docker default would hide a deployment error.
3. Health is liveness-only, and process-local locking remains process-local; neither was a new regression.

## Arbitration

- Finding 1: `ACCEPT`. It was a real invariant gap in the same approved boundary. AGY repaired it and added focused assertions for missing, non-Firestore, explicit-argument, and emulator cases.
- Finding 2: `PARTIAL`. The deployment precondition is valid and is now explicit in the checklist. The proposed Docker `ENV` default was rejected because it would conceal missing deployment configuration.
- Finding 3 health limitation: `ACCEPT as known limitation`, no repair because the requested local scope did not include a readiness redesign.
- Emulator whitespace speculation: `REJECT / no actionable evidence`; current guard behavior is sufficient for the selected boundary.
- No Vertex, persistence fallback, privacy, test weakening, or unnecessary-scope finding produced an additional repair.

No second AGY repair cycle was needed.

## Final local verification

**Typechecked**

```text
npm run typecheck
exit 0
```

**Tested**

```text
npm test
220 tests, 217 passed, 0 failed, 3 skipped
```

The three skipped tests explicitly require live Gemini/verified-action behavior.

**Built**

```text
npm run build
exit 0
```

The build emitted only the existing Vite bundle-size warning (>500 KB), not a build failure.

**Live-Local-Verified**

- `npx playwright test tests/firstRunRouteMaterialization.spec.ts tests/proactiveIntervention.spec.ts`: 2 passed.
- Direct production-mode server smoke with explicit Firestore/Vertex configuration: server started, `GET /api/v1/health` returned `200`, and `GET /` returned `200` with `text/html`.
- `git diff --check`: exit 0; only Git's LF/CRLF normalization warnings were emitted.

**Known pre-existing Playwright failures**

`npx playwright test tests/pageShellScroll.spec.ts --reporter=line` produced 14 failures and 0 passes across desktop/mobile document-shell cases. Failures include missing `.entry-shell`, scroll invariant mismatches, missing onboarding controls, and `ECONNREFUSED` from the Vite proxy for the methodology route. This suite was not modified and is reported separately; it prevents claiming that the entire Playwright surface is green.

## Later live checklist

The following is a later, authenticated-PC checklist. It is not evidence that any live step has happened.

### MUST DO

1. Confirm ADC for the account intended to run the deployment. If the check fails, the owner must complete the interactive ADC login and recheck it:

   ```powershell
   gcloud auth application-default print-access-token
   gcloud auth application-default login
   gcloud auth application-default print-access-token
   ```

   Do not paste the token into logs or chat.

2. Confirm the project, service, and region instead of relying on historical names:

   ```powershell
   $PROJECT_ID = "trazo-agentic-2026"
   $SERVICE = "trazo-agentic"
   $REGION = "us-central1"
   gcloud config get-value project
   gcloud run services describe $SERVICE --project $PROJECT_ID --region $REGION
   ```

   The values above are historical repository evidence, not current deployment proof.

3. Verify required APIs and enable only if the owner confirms the project. The code requires Cloud Run, Vertex AI, and Firestore capabilities:

   ```powershell
   gcloud services list --enabled --project $PROJECT_ID
   gcloud services enable run.googleapis.com aiplatform.googleapis.com firestore.googleapis.com --project $PROJECT_ID
   ```

4. Verify the Cloud Run runtime service account and its permissions for Vertex AI prediction and Firestore read/write. No current service-account email or IAM binding is present in the repository, so do not invent one; inspect the service description and project policy first.

5. Deploy with the exact production storage guard and canonical runtime configuration. The owner must confirm service/project/region and the ingress decision before executing:

   ```powershell
   gcloud run deploy $SERVICE `
     --source . `
     --project $PROJECT_ID `
     --region $REGION `
     --set-env-vars "NODE_ENV=production,STORAGE_BACKEND=firestore,GOOGLE_CLOUD_PROJECT=$PROJECT_ID,GOOGLE_CLOUD_LOCATION=global,GEMINI_MODEL=gemini-3.7-flash" `
     --max-instances 1
   ```

   Do not set `FIRESTORE_EMULATOR_HOST` or `TRAZO_LOCAL_AI_AUTH=api-key` in production. Do not add `GEMINI_API_KEY` as a substitute for ADC.

6. Resolve the public/private ingress and trusted learner identity decision before the smoke test. Header-provided identity is not sufficient proof of authentication.

### VERIFY ONLY

- Obtain the deployed URL from Cloud Run rather than using the historical hardcoded URL:

  ```powershell
  $PRODUCTION_URL = gcloud run services describe $SERVICE --project $PROJECT_ID --region $REGION --format="value(status.url)"
  Invoke-WebRequest -UseBasicParsing "$PRODUCTION_URL/api/v1/health"
  Invoke-WebRequest -UseBasicParsing "$PRODUCTION_URL/"
  ```

- Confirm the revision has `NODE_ENV=production` and `STORAGE_BACKEND=firestore`; confirm no emulator variable is present.
- Confirm the startup log names `FirestoreImplementationRepository`.
- Confirm Cloud Run settings show the intended `max instances = 1`. This is a hackathon mitigation, not multi-instance safety.
- If using the existing repository smoke script after the URL is confirmed, run it with the current URL only:

  ```powershell
  $env:DEPLOYED_URL = $PRODUCTION_URL
  node --experimental-strip-types scripts/runDeployedSmoke.ts
  ```

  This existing script creates live test data and covers health, dev-route protection, static serving, create, bad/good evidence, reload, and next-action. It does not by itself prove the current repeated-Friction-Recovery UI path.
- Verify Cloud Logging for startup, request failures, next-action timing, and the absence of raw learner evidence. Current code does not emit a complete request-to-policy-to-persistence correlation record.
- Inspect Firestore documents in the known collections, especially the implementation document's `completedMissionIds`, `activeMissionId`, `artifacts`, learner setup, and evaluation provenance after the smoke.

### OPTIONAL

- Run `scripts/runFirestoreSmoke.ts` only after reviewing its live data creation/cleanup behavior and confirming the authenticated project. It directly exercises Firestore repositories and is not a local test.
- Run the broader `scripts/runDemoReliabilitySuite.ts` only if the owner accepts its live test data and latency/quota cost. Its results must be reported as a separate live measurement, not as proof of universal reliability.
- Add a minimal structured request/policy/persistence trace or graceful shutdown handler after the hackathon if operational evidence becomes a scoring or reliability requirement.

## Production golden-path smoke specification

This is the intended future smoke, not a result from this mission. The current uncommitted Friction Recovery work must be frozen/committed and deployed before step 6 can be treated as a release requirement.

| Step | User action | Expected UI | Expected API/backend | Expected Firestore state | Expected log evidence |
| --- | --- | --- | --- | --- | --- |
| 1. Entry | Learner opens the deployed URL. | Entry screen renders and allows learner entry. | Static `GET /`; profile/implementation bootstrap uses the current app route. | New implementation document exists with empty completion state. | Startup repository log; request failure logs only if a request fails. |
| 2. First-Run branch | Learner selects a route preference. | Selected branch remains visibly selected and can continue. | `PATCH /api/v1/implementations/:id/learner-setup` persists the preference. | `learnerSetup.preferredRouteId` (or current canonical field) is present. | Current code has no complete structured persistence event; verify response and document. |
| 3. Route materialization | Learner continues into the selected route. | Route/mission map reflects the selected route. | Implementation and methodology reads return the persisted state and course data. | State still has no completed mission; route preference survives reload. | Repository/read errors if any; no live proof today. |
| 4. Open mission | Learner opens N01 and starts it. | N01 is active and its evidence prompt is visible. | `POST /start-mission` passes deterministic legality checks. | `activeMissionId = N01`. | Current startup/endpoint logs; no guaranteed structured state event. |
| 5. First bad evidence | Learner submits evidence that misses a rubric criterion. | Feedback shows `REWORK`; mission remains available and no unlock is shown. | Submission calls Vertex/Gemini, validates structured output, applies deterministic `REWORK`; only provenance is persisted. | `completedMissionIds` remains empty; no canonical PASS artifact is minted. | Must capture provider/policy outcome from response and Firestore; current logs do not emit the full chain. |
| 6. Repeated friction | Learner submits a second bad attempt. | After the repeated `REWORK`, proactive recovery guidance/card appears. | Same non-PASS path; no progression side effect. Current UI derives recovery from persisted evaluation provenance. | Two relevant `REWORK` provenance entries; no completion/artifact. | Verify persisted provenance and UI behavior; this is blocked on freezing the current uncommitted Friction Recovery work. |
| 7. Valid evidence | Learner submits rubric-satisfying evidence. | Feedback shows `PASS`; mission completion is visible. | Vertex/Gemini structured evaluation returns; deterministic policy returns `PASS`; service mints the canonical artifact and saves state. | N01 is in `completedMissionIds`; the expected canonical premise artifact exists. | Capture provider/model, verdict, policy, persistence, and latency evidence where available; current code has only partial logs. |
| 8. Next mission unlock | Learner follows the unlocked route/starts the next legal mission. | N02/N03 availability follows the graph; active mission changes only through a legal action. | Progression derives from completed IDs; `POST /start-mission` validates prerequisites. | `activeMissionId` is the selected next mission. | Verify response and document state; do not infer from UI alone. |
| 9. Refresh | Learner refreshes the browser. | The app reloads without losing route, completion, artifact, or active mission. | Fresh GETs read implementation state and methodology from Firestore. | Same `learnerSetup`, `completedMissionIds`, artifacts, and `activeMissionId`. | Correlate the fresh reads with the Firestore document; current code lacks request IDs. |
| 10. Restore proof | Reviewer compares UI, API response, and Firestore. | UI exactly reflects the persisted state after refresh. | No frontend-only state is accepted as proof. | Firestore is the authoritative source and matches the API/UI. | Save Cloud Logging and Firestore evidence with timestamp, implementation ID, and mission ID. |

## Final status

Local production hardening is ready for the later authenticated deployment checklist. It is not a live deployment or live Google service verification.
