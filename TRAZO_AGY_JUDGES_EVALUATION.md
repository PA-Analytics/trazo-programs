# TRAZO — Evaluación de jueces AGY

## Regla de evaluación

Los jueces calificaron únicamente el repositorio actual, los tests, los
contratos y los reportes técnicos. El video demo fue declarado explícitamente:

```text
OUT_OF_SCOPE_VIDEO
VIDEO=EXCLUDED_NO_DEDUCTION
```

Ningún juez podía solicitarlo, evaluarlo o descontar puntos por su ausencia.

La rúbrica común fue de 100 puntos, adaptada por especialidad:

- seguridad determinista y state safety;
- provider independence y E2E local;
- metodología graph/versioning/isolation;
- Coach Criteria y provenance;
- regresiones, tests, typecheck y build;
- claridad del producto y honestidad sobre límites.

## Resultados

| Juez | Especialidad | Score | Veredicto | Video |
|---|---|---:|---|---|
| AGY-TECH | arquitectura técnica | **98/100** | PASS WITH NOTES | excluido, sin deducción |
| AGY-PRODUCT | producto y metodología | **98/100** | PASS WITH NOTES | excluido, sin deducción |
| AGY-SKEPTIC | aceptación adversarial | **100/100** | PASS | excluido, sin deducción |
| **Promedio** | — | **98.7/100** | PASS WITH NOTES | no evaluado |

## AGY-TECH — 98/100

Fortalezas principales:

- frontera determinista que separa interpretación LLM de consecuencias;
- E2E local sin Vertex ni cloud;
- metodología versionada y con hash;
- criteria fingerprint y stale safety;
- prompt injection y no-PASS protection;
- autonomía idempotente y fail-closed.

Notas sin bloqueo:

- `runExclusive` y stores locales no sustituyen la prueba de locking/CAS
  distribuido en Cloud Run/Firestore;
- provider failure todavía se observa principalmente por logs/resultados del
  scheduler y no por una cola dead-letter auditada separada;
- falta validar comercialmente con un design partner.

## AGY-PRODUCT — 98/100

Confirmó que la tesis de producto ya está expresada en el núcleo ejecutable:

- el mismo evidence puede producir PASS o CLARIFY bajo distintos coaches;
- `MethodologyGraph` es un primitive ejecutable, no documentación decorativa;
- stall detection despierta autonomía sin chat;
- el state engine impide unlocks no autorizados;
- la metodología y criteria quedan aisladas y versionadas.

Notas sin bloqueo:

- no existe todavía coach authoring UI;
- los legacy packs permanecen como adapters/fixtures de compatibilidad;
- cloud orchestration y multi-instance Firestore quedan para cloud proof;
- adopción, retención y willingness-to-pay siguen sin validar.

## AGY-SKEPTIC — 100/100

No encontró P0 ni P1. Los P2 reportados fueron backlog explícito:

- reducir directorios/perfiles locales cuando corresponda;
- persistir `FAILED_CLOSED` como telemetría dedicada;
- retirar legacy static fixtures después de una migración explícita.

Confirmó:

- `ACCEPT` no bypassa policy/state machine;
- locked missions son rechazadas en los entry points principales;
- replay, stale state y provider failures están cubiertos;
- coach/course/mission isolation y version provenance están presentes;
- tests, typecheck y build están verdes;
- cloud y video no se presentaron como evidencia falsa.

## Síntesis de los jueces

La puntuación alta corresponde a la calidad del núcleo técnico verificable. No
equivale a product-market fit. Los tres jueces coincidieron en que el siguiente
experimento con mayor retorno es:

```text
1 coach real
1 módulo real
5–8 misiones
cohorte pequeña
medir evidencia, regreso, correcciones, bloqueos y pago
```

No recomendaron construir primero una authoring UI completa ni desplegar cloud
antes de validar el comportamiento real.

## Estado de ejecución

- tres agentes AGY ejecutados en paralelo;
- modo read-only por instrucción;
- no editaron, no hicieron commit y no desplegaron;
- modelo: Gemini 3.7 Flash High;
- working tree preservado.
