# TRAZO Google Hackathon — Production Local Hardening

Date: 2026-08-29

## Implemented

The production storage boundary in `src/server/repository.ts` now fails closed:

- `NODE_ENV=production` requires `STORAGE_BACKEND=firestore` in the process environment.
- Production rejects missing, `memory`, and `filestorage` values.
- Production rejects `FIRESTORE_EMULATOR_HOST`.
- Explicit factory arguments cannot bypass the production environment guard with a non-Firestore backend, or by supplying `firestore` while the required environment variable is missing/wrong.
- Non-production behavior remains available for tests and local development, including memory/file storage and the existing Firestore emulator signals.

The guard applies to all five repository factories used by the server:

- implementations
- calibration
- methodology
- profiles
- autonomy audits

## Why this was required

Before the repair, an omitted production storage variable could resolve to file storage, and an explicit memory selection was accepted. That could make a Cloud Run process appear healthy while persistence was not authoritative Firestore. The repair protects the factory boundary without changing progression, evaluation policy, or product AI behavior.

The Dockerfile does not provide a storage default. This is intentional: deployment must explicitly inject `STORAGE_BACKEND=firestore`, so a misconfigured revision fails visibly instead of silently selecting another backend.

## Tests added

`tests/storageBackendSelection.test.ts` covers:

- missing production storage configuration;
- production `memory` and `filestorage` rejection;
- production Firestore selection across all repository factories;
- explicit argument bypass attempts;
- production emulator rejection;
- unchanged non-production selection and fallback behavior.

## Verification evidence

- Focused storage test: 6 tests passed.
- Full test suite: 220 tests, 217 passed, 0 failed, 3 skipped because they require live Gemini/verified-action behavior.
- Typecheck: passed.
- Build: passed; existing Vite bundle-size warning only.
- Relevant Playwright route/recovery specs: 2 passed.
- Local production-mode process smoke: server started with explicit Firestore/Vertex configuration; `/api/v1/health` and `/` returned HTTP `200`.
- `git diff --check`: passed with only line-ending normalization warnings.

## Not verified here

- ADC, IAM, Vertex/Gemini, Firestore reads/writes, Cloud Run revision behavior, current production URL, and Cloud Logging.
- Multi-instance concurrency safety. The current `runExclusive` lock remains process-local and Firestore implementation saves have no version precondition. The later hackathon deployment checklist therefore constrains Cloud Run to one instance rather than claiming distributed safety.

No live service was contacted and no commit was created.
