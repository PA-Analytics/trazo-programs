# AUTONOMY CORE V1 REPORT

## 1. Executive result

**AUTONOMY CORE V1: PASS WITH NOTES**

El backend ya puede recibir un evento externo `learner_stalled` sin un nuevo mensaje del learner, reconstruir el estado persistido, recuperar artefactos y memoria consecuencial acotada, razonar mediante el runtime canónico de Gemini, validar una decisión `INTERVENE | ESCALATE | NO_OP` y persistir un audit/action record idempotente.

La aceptación no es `Production-Verified`: no se ejecutaron Vertex AI ni Firestore reales en este cierre y no existe todavía un scheduler/productor automático de eventos. La superficie implementada es el receptor externo y el caso de uso ejecutable.

## 2. Architecture before

- `ImplementationState` era la autoridad persistente de progreso, artefactos, misión activa y configuración del learner.
- `ImplementationService` era el dueño de las transiciones legales y de la creación de artefactos tras `PASS`.
- `CanonicalGeminiRuntime` era la única frontera de Gemini.
- `CompanionService` podía proponer una misión disponible, pero no tenía una ejecución autónoma persistente.
- No existían eventos de stalled learner, memoria consecuencial tipada, decisiones `INTERVENE | ESCALATE | NO_OP` ni audit records autónomos.
- La serialización existente era por proceso mediante `ImplementationService.runExclusive`; no era un lock distribuido.

## 3. Architecture after

La nueva frontera es:

```text
POST /api/v1/events/learner-stalled
        ↓
AutonomyService.handleStalledLearner()
        ↓
ImplementationRepository → ImplementationState
        ↓
freshness + course/version + legal mission checks
        ↓
bounded durable context + consequentialMemory
        ↓
GeminiAutonomyReasoner → CanonicalGeminiRuntime
        ↓
validateAutonomyDecision + deterministic policy
        ↓
INTERVENE | ESCALATE | NO_OP
        ↓
IAutonomyAuditRepository.createIfAbsent()
        ↓
AutonomyAuditRecord
```

Archivos principales:

- `src/server/autonomy/types.ts`: contratos de evento, contexto, decisión y audit.
- `src/server/autonomy/schema.ts`: validación runtime, límites de tamaño y filtro de instrucciones inseguras.
- `src/server/autonomy/prompts.ts`: prompt acotado con estado delimitado como datos no confiables.
- `src/server/autonomy/geminiReasoner.ts`: llamada exclusiva al runtime Gemini canónico y retry transitorio.
- `src/server/autonomy/autonomyService.ts`: caso de uso, política, aislamiento, freshness, legalidad e idempotencia.
- `src/server/repository.ts`: repositorios Firestore, archivo y memoria; Firestore usa transacción `createIfAbsent`.
- `src/server/app.ts` / `src/server/index.ts`: rutas y wiring del servicio.

La autonomía no escribe `completedMissionIds`, `activeMissionId` ni artefactos canónicos. Las acciones `GUIDANCE` y `HUMAN_REVIEW` quedan persistidas en el audit; la memoria consecuencial del learner se lee desde `ImplementationState` y no se fabrica a partir del chat.

## 4. Autonomous execution sequence

1. Un productor externo envía `eventId`, `implementationId`, `courseId`, `courseVersion` y `observedStateUpdatedAt`.
2. La ruta exige esos campos en HTTP y requiere `TRAZO_AUTONOMY_EVENT_TOKEN` en producción.
3. `AutonomyService` deriva una clave estable (`idempotencyKey` o `eventId`) y consulta replay.
4. Carga `ImplementationState` desde el repositorio autoritativo.
5. Rechaza estado ausente, curso distinto, learner distinto, versión incompatible, timestamp inválido, misión inexistente o misión bloqueada.
6. Deriva progreso determinista y construye contexto con misión, misiones disponibles, completados, setup, artefactos verificados y memoria consecuencial acotada.
7. Gemini devuelve JSON estructurado.
8. El esquema valida decisión, confianza, target permitido y límites de contenido; la política convierte confianza baja o target ilegal en `ESCALATE`/fallo cerrado.
9. Se persiste un `AutonomyAuditRecord` con snapshot de estado, decisión, razón, confianza, acción y correlación.
10. `createIfAbsent` hace que replay/concurrencia converjan en un único efecto persistido.

## 5. Durable state

La verdad de workflow sigue siendo `ImplementationState` en Firestore/archivo/memoria según el backend configurado. Se añadió `consequentialMemory?: ConsequentialLearnerMemory[]`, limitado al contexto recuperado a las últimas 10 entradas.

El audit autónomo vive en la colección/archivo `autonomy_audits`. Es trazabilidad y resultado de acción, no una autoridad paralela de progresión.

## 6. Memory

La memoria es explícita y tipada: `artifact`, `decision`, `guidance`, `escalation` o `milestone`, con resumen, misión origen y timestamp. El reasoner recibe esa memoria y artefactos verificados; no recibe historial de chat ni `event.context` arbitrario.

La captura/edición de nuevas decisiones del learner todavía no tiene una ruta de producto dedicada. En este V1 la memoria existente se consume de forma segura; la alimentación completa de memoria es un riesgo pendiente.

## 7. Model boundary

Gemini decide únicamente entre `INTERVENE`, `ESCALATE` y `NO_OP`, con razón, confianza, guidance opcional y target opcional. Se utiliza `CanonicalGeminiRuntime`; no se crea otro cliente Google ni se permite tool calling arbitrario.

El contenido recuperado se etiqueta como `<durable_state>` y como datos no confiables. El resultado se trata como no confiable hasta pasar validación determinista.

## 8. Deterministic boundary

Gemini no puede:

- completar misiones;
- desbloquear nodos;
- crear o modificar artefactos canónicos;
- cambiar `ImplementationState` arbitrariamente;
- apuntar a una misión bloqueada o inexistente.

La progresión sigue dependiendo exclusivamente de `ImplementationService` y de `PASS` en la evaluación de evidencia.

## 9. Idempotency strategy

- La clave efectiva es `idempotencyKey || eventId`.
- El ID del audit es determinista y estable para esa clave.
- La cola `runExclusive` evita duplicados dentro de una instancia.
- `createIfAbsent` evita dos audits efectivos en memoria/archivo y usa transacción Firestore para el documento determinista.
- Un replay con la misma clave dirigido a otra implementación se rechaza por conflicto de scope.
- Dos instancias pueden repetir razonamiento antes de ganar la reserva distribuida; el efecto persistido converge a un único audit. La eliminación de esa duplicación de llamadas LLM requiere una reserva/outbox distribuida previa al razonamiento y queda fuera de este cierre.

## 10. Failure recovery

- Estado ausente, curso incorrecto, versión incompatible, timestamp inválido y misión bloqueada: fallo cerrado sin llamada al modelo.
- JSON o schema inválido: error recuperable sin mutación de progreso.
- Timeout/provider failure transitorio: retry acotado en `GeminiAutonomyReasoner`; el reintento del evento no encuentra un audit de éxito y puede intentarlo de nuevo.
- Baja confianza: `ESCALATE`, nunca intervención directa.
- Fallo guardando el audit: no se modifica `ImplementationState`; el evento puede reintentarse.

Limitación: los intentos fallidos de provider/schema todavía no producen un audit `FAILED_CLOSED` persistido. El estado queda consistente, pero la trazabilidad de fallos de modelo depende de logs/HTTP y es un follow-up de observabilidad.

## 11. HITL

`ESCALATE` persiste `actionType: HUMAN_REVIEW` y `escalation.reason`. No se dispara un canal externo todavía; el registro queda preparado para que un operador o integración posterior lo consuma.

## 12. Observability

Un audit exitoso o no-op conserva:

- `eventId` e `idempotencyKey`;
- `implementationId`, `courseId`, `courseVersion`;
- `correlationId` cuando el productor lo envía;
- `sourceEvent`, `actionType`, `decision`, `policyReason`, `confidence`;
- `observedStateUpdatedAt`;
- snapshot acotado de estado y memoria;
- `createdAt` y `executedAt`.

No se persiste el chat bruto ni el `context` arbitrario del evento.

## 13. Adversarial evaluation matrix

| Test | Expected | Actual | Result | Evidence |
|---|---|---|---|---|
| T01 normal stalled learner | una intervención persistida, sin progresión | guidance audit + progreso intacto | PASS | `tests/autonomyCore.test.ts` |
| T02 duplicate event | replay sin segunda acción | mismo audit, `modelCallMade: false` | PASS | `tests/autonomyCore.test.ts` |
| T03 concurrent same instance | un efecto | un audit y una llamada en cola local | PASS | `tests/autonomyCore.test.ts` |
| T04 resolved blocker | `NO_OP` | misión completada produce no-op | PASS | `tests/autonomyCore.test.ts` |
| T05 low confidence | escalar/no-op | `ESCALATE` bajo 0.70 | PASS | `tests/autonomyCore.test.ts` |
| T06 missing workflow | fail closed | implementación inexistente rechazada | PASS | `tests/autonomyCore.test.ts` |
| T07 stale version | sin mutación | mismatch rechazado; freshness HTTP requerido | PASS WITH NOTE | `tests/autonomyCore.test.ts` |
| T08 malformed output | recoverable, sin progreso | JSON inválido rechazado | PASS WITH NOTE | `tests/autonomyCore.test.ts` |
| T09 provider timeout/failure | estado consistente | error sin mutación | PASS WITH NOTE | `tests/autonomyCore.test.ts` |
| T10 retry after provider failure | retry seguro | segundo intento puede completar | PASS | `tests/autonomyCore.test.ts` |
| T11 illegal transition | rechazo determinista | target ilegal escala; misión bloqueada falla cerrado | PASS | `tests/autonomyCore.test.ts` |
| T12 consequential memory | contexto adaptado | memoria y artefactos llegan sin chat | PASS | `tests/autonomyCore.test.ts` |
| T13 irrelevant chat | no progreso inventado | `event.context` no entra al reasoner | PASS | `tests/autonomyCore.test.ts` |
| T14 completed milestone | no regresión | completados conservados | PASS | `tests/autonomyCore.test.ts` |
| T15 wrong learner/workflow | aislamiento | mismatch y colisión de clave rechazados | PASS WITH NOTE | `tests/autonomyCore.test.ts` |
| T16 repeated execution | estado estable | replay estable, audit determinista | PASS | `tests/autonomyCore.test.ts` |
| T17 partial audit persistence | retry-safe | no se escribe estado antes del audit; retry funciona | PASS WITH NOTE | `tests/autonomyCore.test.ts` |
| T18 concurrent learner mutation | stale decision no pisa verdad | timestamp anterior produce `NO_OP` | PASS | `tests/autonomyCore.test.ts` |

Adicionalmente se verificaron dos instancias del servicio convergiendo en un solo audit, autenticación de la ruta en producción y build completo.

## 14. Worker contributions

**AGY:** implementó el núcleo backend, contratos de decisión, reasoner Gemini, repositorios, rutas, wiring y la primera suite T01–T18.

**ECHO:** no pudo iniciar con `opencode/muse-spark-1.2-free` ni con el modelo OpenCode configurado; ambos intentos terminaron con error del servidor del proveedor. No se atribuyen hallazgos a Echo.

**LUNA:** inspeccionó el repositorio y los contratos canónicos, rechazó la primera aceptación por riesgos de auth/idempotencia/target, aplicó reparaciones, añadió pruebas de instancias separadas, colisión de claves, target bloqueado y autenticación, y ejecutó la aceptación final.

**Red Team independiente:** Codex/OpenAI ejecutó una auditoría solo lectura y reprodujo duplicación entre instancias, replay cross-implementation y target bloqueado por fallback. Es evidencia adversarial independiente de AGY.

## 15. Verification evidence

- **Implemented:** `src/server/autonomy/*`, wiring y contratos relacionados.
- **Typechecked:** `npm run typecheck` — exit 0.
- **Tested:** `npm test` — 163 passed, 3 skipped (diagnósticos live existentes).
- **Tested:** `node --experimental-strip-types --test tests/autonomyCore.test.ts` — 24 passed.
- **Built:** `npm run build` — exit 0; Vite emitió únicamente warning de tamaño de chunk.
- **Live-Local-Verified:** no ejecutado contra Vertex AI/Firestore en este cierre.
- **Production-Verified:** no ejecutado.

## 16. Remaining risks

1. Falta un productor scheduler/queue que detecte y emita `learner_stalled`; el endpoint ya está listo para ese evento.
2. En desarrollo/no-producción la ruta de demo no exige token; debe permanecer fuera de exposición pública.
3. Firestore evita el doble efecto persistido, pero dos instancias pueden duplicar llamadas LLM antes de `createIfAbsent`.
4. Los fallos de provider/schema no crean aún audit `FAILED_CLOSED` persistido.
5. La memoria consecuencial puede consumirse, pero todavía no hay un flujo de producto dedicado para registrar decisiones del learner.
6. No hay verificación live de ADC/Vertex ni Firestore en esta ejecución.

## 17. Demo path

Con backend local y `NODE_ENV` distinto de producción:

1. Crear una implementación mediante `POST /api/v1/implementations`.
2. Guardar el `id`, `courseId`, `courseVersion` y `updatedAt` devueltos.
3. Simular que el learner se estancó sin enviar chat.
4. Enviar `POST /api/v1/events/learner-stalled` con `eventId`, `implementationId`, `courseId`, `courseVersion`, `observedStateUpdatedAt` y `stalledMissionId: N01`.
5. Observar la respuesta `INTERVENE`, `ESCALATE` o `NO_OP` y su `audit` asociado en `.data/autonomy-audits.json` cuando se usa file storage.
6. Reenviar exactamente el mismo evento y comprobar `modelCallMade: false` y el mismo audit.
7. Consultar `GET /api/v1/implementations/:id` para verificar que `completedMissionIds` no cambió por autonomía.

