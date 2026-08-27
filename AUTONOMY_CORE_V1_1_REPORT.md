# TRAZO AUTONOMY CORE V1.1 REPORT

## Executive verdict

**TRAZO AUTONOMY CORE V1.1: PASS**

El loop de autonomía es ahora end-to-end testeable localmente sin Vertex AI,
Application Default Credentials, gcloud, service accounts, IAM, Firestore cloud
ni despliegue. Un workflow activo que supera el umbral de inactividad produce un
evento `learner_stalled`, despierta el `AutonomyService` canónico, recupera el
estado persistente y la memoria consecuencial, obtiene una decisión tipada desde
un provider intercambiable, aplica validación determinista, persiste una acción y
su auditoría, rechaza estado obsoleto y no duplica efectos al repetir el evento.

Este PASS es local y provider-independent. No implica verificación de producción,
Vertex ni infraestructura Google Cloud.

## V1 baseline

V1 ya tenía:

- recepción externa de `learner_stalled` sin un nuevo mensaje del learner;
- acceso de Gemini por `CanonicalGeminiRuntime`;
- decisiones `INTERVENE | ESCALATE | NO_OP` tipadas;
- validación determinista, freshness/stale safety y aislamiento de workflow;
- idempotencia y auditoría durable con `createIfAbsent`;
- protección de progresión: autonomía no completa misiones ni crea artefactos;
- memoria consecuencial acotada en el contexto recuperado;
- 163 tests pass, 3 diagnósticos live skipped, typecheck y build pass.

El hueco de V1 era la ausencia de un productor automático de stalls y de una
prueba local que conectara detección, evento y runtime completo.

## V1.1 changes

- `src/server/autonomy/clock.ts`: `IClock`, `SystemClock` y `FakeClock`.
- `src/server/autonomy/stallDetector.ts`: escaneo del repositorio autoritativo y
  producción de eventos con identidad estable.
- `src/server/autonomy/autonomyScheduler.ts`: frontera local `runScan()` que
  conecta productor y `AutonomyService`; también ofrece ciclo `start()`/`stop()`.
- `src/server/autonomy/deterministicReasoner.ts`: provider determinista que
  implementa el mismo `IAutonomyReasoner` de producción y permite intervenir,
  escalar, no-op, baja confianza, salida malformada, timeout y fallo de provider.
- `src/server/autonomy/autonomyService.ts`: validación de schema en el boundary
  compartido antes de aplicar política y consecuencias.
- `tests/autonomyLoop.test.ts`: ocho escenarios de integración, más la prueba de
  salida malformada en el boundary compartido.

No se modificaron semánticas de progresión, no se creó un runtime Gemini paralelo
y no se añadió infraestructura cloud.

## Provider architecture

```text
AutonomyScheduler / external trigger
              |
              v
       AutonomyService
              |
              v
       IAutonomyReasoner
        /       |        \
Gemini API  Vertex Gemini  Deterministic provider
              |
              v
     typed decision + schema/policy validation
```

La implementación productiva actual sigue usando `GeminiAutonomyReasoner` sobre
el runtime canónico. El loop no conoce Vertex: en las pruebas se inyecta
`DeterministicAutonomyReasoner` en la misma frontera. Una salida malformada es
rechazada antes de crear un audit; un target con forma válida pero no permitido
se convierte en `ESCALATE` por la política determinista existente.

El runtime también conserva la opción explícita de Gemini Developer API mediante
`TRAZO_LOCAL_AI_AUTH=api-key` y `GEMINI_API_KEY`, sin hardcodear secretos. No se
ejecutó porque no había una clave disponible en el entorno del proceso.

## Persistence architecture

Las pruebas usan `MemoryImplementationRepository` y
`MemoryAutonomyAuditRepository`, ambos implementando los contratos existentes.
La autoridad sigue siendo `ImplementationState`; el audit describe el efecto y
no sustituye el estado de progresión. Los adaptadores de archivo y Firestore V1
continúan disponibles, y Firestore conserva `createIfAbsent` transaccional.

No se necesitó Firestore Emulator ni credenciales de producción para validar el
loop local.

## Stall detection and producer

`StallDetector.detectStalls()` hace `list()` sobre el repositorio canónico y
califica un estado únicamente cuando:

1. el pack existe y contiene misiones;
2. el workflow no está completo;
3. el learner tiene actividad observable (`activeMissionId`, `learnerSetup` o
   progreso previo); una implementación recién creada e inactiva no dispara;
4. la misión activa/seleccionada existe, no está completada y no está bloqueada;
5. quedan misiones `available` o `active`;
6. `now - state.updatedAt >= thresholdMs`; timestamps inválidos o futuros no
   califican.

`updatedAt` es la marca canónica de cambio del estado de learner disponible en
V1. La identidad estable es `stall-{implementationId}-{updatedAt}` y se usa como
`eventId` e `idempotencyKey`. Una modificación posterior del estado produce una
identidad distinta; repetir el scan sin cambio conserva la misma identidad.

La detección está separada del razonamiento. `AutonomyScheduler.runScan()` puede
ser llamado por tests, un proceso local o un futuro trigger cloud, y alimenta los
eventos al servicio existente sin decidir qué intervención enviar.

## Full local E2E sequence

```text
FakeClock advances beyond threshold
  -> StallDetector scans ImplementationState
  -> learner_stalled with stable identity
  -> AutonomyScheduler calls AutonomyService
  -> state, mission graph and consequential memory load
  -> injected IAutonomyReasoner returns typed decision
  -> schema + deterministic freshness/target/confidence policy validate it
  -> intervention/escalation/no-op audit is persisted with createIfAbsent
  -> completedMissionIds and canonical artifacts remain unchanged
```

`Loop 1` verifies the intervention path with exactly one persisted audit and no
progression mutation. `Loop 4` verifies escalation. `Loop 5` verifies provider
failure and retry. `Loop 5b` verifies malformed output rejection through the
shared decision boundary.

## Idempotency and replay evidence

`Loop 2` advances the clock and runs the same unchanged workflow twice. The
second scan returns the same audit, has `modelCallMade: false`, makes no second
provider call and leaves exactly one audit record. `Loop 8` runs concurrent scans
for two isolated learners and verifies one audit per learner, correct user scope,
and safe scheduler restart. Existing V1 tests additionally cover concurrent
duplicate delivery and separate service instances converging on one persisted
effect.

## Stale-state safety

`Loop 3` completes the stalled mission before replay; the detector emits nothing
after progress and replaying the old event becomes `NO_OP`. `Loop 6` advances the
authoritative timestamp after event creation; the old event is rejected as
`stale_observed_state_freshness` without a model call or state mutation.

## Failure recovery

`Loop 5` injects a provider failure. The scheduler returns an observable error,
the workflow remains valid, no audit or progression side effect is half-applied,
and a retry succeeds. A later scan replays the persisted audit without a second
effect. `Loop 5b` applies the same guarantee to malformed provider output.

Provider failures are currently surfaced through the scheduler result and runtime
logs rather than a separate persisted `FAILED_CLOSED` audit record; that is an
observability follow-up, not a progression-safety gap.

## Test results

- **Tested:** focused autonomy tests — `node --experimental-strip-types --test tests/autonomyCore.test.ts tests/autonomyLoop.test.ts` — **33 pass, 0 fail**.
- **Typechecked:** `npm run typecheck` — **exit 0**.
- **Tested:** full suite — `npm test` — **175 total, 172 pass, 0 fail, 3 skipped**. The three skipped tests are existing live Gemini diagnostics.
- **Built:** `npm run build` — **exit 0**. Vite emitted only the existing large-chunk warning.
- **Diff hygiene:** scoped `git diff --check` is clean after integration.

## R01–R20 red-team matrix

| Check | Result |
|---|---|
| R01 duplicate scheduler run | PASS |
| R02 duplicate event delivery | PASS |
| R03 concurrent duplicate delivery | PASS |
| R04 event before learner progression | PASS |
| R05 workflow completion after event creation | PASS |
| R06 provider timeout | PASS: safe error/retry mode |
| R07 malformed provider output | PASS: shared schema boundary |
| R08 low confidence | PASS: deterministic `ESCALATE` |
| R09 missing state | PASS: fail closed |
| R10 wrong learner/workflow isolation | PASS |
| R11 stale workflow version/timestamp | PASS |
| R12 retry after provider failure | PASS |
| R13 repeated autonomy cycles | PASS: new state timestamp yields new identity |
| R14 scheduler restart | PASS |
| R15 provider implementation swap | PASS |
| R16 same production decision contract | PASS: `IAutonomyReasoner` |
| R17 Vertex unavailable | PASS for local path; live Vertex not run |
| R18 no Gemini API key | PASS for deterministic local path |
| R19 Firestore cloud unavailable | PASS for local repository path |
| R20 local E2E without cloud | PASS |

Echo was requested as an independent OpenCode worker, but OpenCode failed before
reading the repository with `Unexpected server error` (`err_f9caf657`). No result
was attributed to Echo. LUNA performed the compensating adversarial review and
found/fixed the shared provider validation and inactive-workflow gaps before the
final test run.

## Live and cloud status

- **LOCAL DOMAIN E2E:** PASS.
- **LOCAL PROVIDER-INDEPENDENT E2E:** PASS.
- **LIVE GEMINI API:** `SKIPPED_NO_KEY`.
- **FIRESTORE EMULATOR:** `NOT_RUN`; local memory adapter was sufficient and no
  emulator was configured.
- **VERTEX LIVE:** `PENDING_AUTH`.
- **PRODUCTION CLOUD EVENT PRODUCER:** `NOT_DEPLOYED`.
- **PRODUCTION-VERIFIED:** not claimed.

## Remaining notes

1. A future cloud-proof mission may wire Cloud Scheduler/Cloud Run, Vertex and
   Firestore against real credentials; that is explicitly outside V1.1.
2. Persisted `FAILED_CLOSED` audit records for provider/schema failures would
   improve observability; the current path remains retry-safe and does not mutate
   progression.
3. Distributed reservation before a provider call could reduce duplicate model
   calls across independent processes; persisted effects remain idempotent.

## Final acceptance statement

TRAZO’s autonomy loop is now end-to-end testable without Vertex or production
Google Cloud authentication. A stalled learner can be detected automatically, a
`learner_stalled` event wakes the canonical autonomy runtime, a
provider-independent boundary produces a typed decision, deterministic
application logic validates it, intervention/escalation/no-op is persisted and
audited, stale events are rejected, and replay does not duplicate effects.

This report does not claim production cloud autonomy is verified.
