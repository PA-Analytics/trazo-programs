# TRAZO — Informe general de cambios y evolución de la sesión

## Alcance y regla de evaluación

Este documento consolida los cambios verificables de la sesión en los tres
núcleos principales de TRAZO:

1. `AUTONOMY CORE V1.1`.
2. `COACH CRITERIA CORE V1`.
3. `METHODOLOGY / IMPLEMENTATION GRAPH CORE V1`.

La evaluación de jueces debe usar únicamente el repositorio, los contratos,
los tests y los reportes técnicos. **El video demo queda fuera de alcance y no
debe sumar ni restar puntos.** Si un juez menciona el video como requisito, su
observación se clasifica como `OUT_OF_SCOPE_VIDEO` y no afecta la puntuación.

## Resumen ejecutivo

TRAZO avanzó de un prototipo de quest map con cursos y misiones mayormente
estáticos hacia una arquitectura de ejecución verificable:

```text
Coach
  ↓ define criterios y metodología
Methodology Graph versionado
  ↓ determina rutas legales
Coach Criteria
  ↓ determina si la evidencia cumple
Deterministic State Machine
  ↓ persiste consecuencias permitidas
Autonomy Runtime
  ↓ detecta bloqueo y mantiene el loop en marcha
```

La tesis técnica que ahora sí está demostrada localmente es:

> Un coach puede tener una metodología y criterios diferentes; TRAZO puede
> ejecutar ambos mediante el mismo runtime, explicar la decisión, mantener
> provenance y bloquear rutas ilegales sin depender de Vertex ni de producción
> Google Cloud.

La tesis comercial todavía no está validada: aún falta un design partner,
piloto con alumnos reales, comportamiento repetido y evidencia de pago.

## Evolución por etapas

### Etapa 0 — Baseline previo

Antes de esta sesión ya existían:

- quest map visual y cursos/misiones;
- prerrequisitos y estado persistente de implementación;
- evaluación de evidencia mediante provider/runtime canónico;
- política determinista de progresión;
- protección de artefactos y no-PASS;
- identidad coach/learner;
- autonomía capaz de recibir `learner_stalled` externo;
- auditoría e idempotencia iniciales.

La principal limitación era que la secuencia de metodología, el estándar del
coach y la activación automática del stall no estaban cerrados como un sistema
end-to-end totalmente independiente de infraestructura cloud.

### Etapa 1 — AUTONOMY CORE V1.1

Se cerró el productor y el loop local de autonomía:

- `IClock`, `SystemClock` y `FakeClock` para pruebas deterministas;
- `StallDetector` que escanea estado persistente y produce
  `learner_stalled`;
- identidad estable por implementación + timestamp de estado;
- `AutonomyScheduler` local con `runScan()`, `start()` y `stop()`;
- provider determinista con modos de intervención, escalamiento, no-op, baja
  confianza, timeout, fallo y salida malformada;
- frontera tipada compartida entre provider y runtime;
- replays idempotentes y auditoría `createIfAbsent`;
- stale-event safety, aislamiento de workflow y protección de progresión;
- pruebas de intervención, replay, no-op, escalamiento, fallo, retry y race.

Resultado: un learner puede quedar inactivo, ser detectado por un scan,
despertar el runtime canónico y producir un efecto auditable sin un nuevo
mensaje del learner, sin Vertex y sin Firestore de producción.

### Etapa 2 — COACH CRITERIA CORE V1

Se convirtió el estándar del coach en una frontera explícita y versionada:

- criterios coach/course/mission-scoped;
- required criteria separados de quality signals;
- rejection conditions y human-review conditions;
- resultados criterion-by-criterion;
- provenance de criteria set, versión, hash de contenido y evidence hash;
- stale criteria safety, incluso cuando se reutiliza el mismo número de versión;
- aislamiento entre coach, curso y misión;
- counterexamples y positive examples sin permitir que sobreescriban hard
  requirements;
- baja confianza y contradicciones que fallan cerrado;
- prompt injection en evidencia tratada como dato no confiable;
- replay por `submissionId` + hash de evidencia;
- `ACCEPT` aún obligado a pasar por la state machine.

La demostración central es: **misma evidencia + diferente estándar del coach =
decisión diferente y explicable**.

### Etapa 3 — METHODOLOGY / IMPLEMENTATION GRAPH CORE V1

Se convirtió la metodología en un objeto ejecutable, persistente y versionado:

- `MethodologyGraph` con coach, curso, versión, nodos, edges, entry nodes,
  status y canonical hash;
- validación determinista de IDs, endpoints, ownership, criterios, campos y
  ciclos;
- edges `DEFAULT`, `CONDITIONAL`, `REMEDIATION` y `OPTIONAL`;
- múltiples prerequisites y `requiresAny`;
- ramas condicionadas por decisiones del Coach Criteria;
- remediation loops explícitos y acotados;
- `MemoryMethodologyRepository`, file repository y Firestore adapter;
- `MethodologyService` para guardar, resolver, validar y fijar versiones;
- provenance de metodología en `ImplementationState`;
- stale methodology hash safety;
- adaptación controlada de los packs legacy a graphs;
- integración del graph runtime en Implementation, Autonomy, Companion y Stall
  Detector;
- endpoint de mapa/metodología y consumo de progreso graph-driven en frontend;
- protección contra skips ilegales y recomendaciones fuera del grafo.

La secuencia de misión ya no necesita una condición productiva del tipo
`if mission === X then next = Y`; la ruta viene del grafo fijado.

## Estado técnico actual

### Lo que TRAZO ya puede demostrar localmente

- detectar learner stalled automáticamente;
- producir un evento sin chat nuevo;
- cargar workflow state y memoria relevante;
- invocar un provider a través de contrato intercambiable;
- devolver una decisión tipada;
- aplicar validación determinista;
- aceptar, clarificar, rechazar o escalar evidencia;
- persistir resultado y auditoría;
- impedir que evidencia, Gemini o autonomía muten libremente progresión;
- resolver legalmente rutas diferentes para coaches diferentes;
- pinnear metodología y criterios históricos;
- rechazar graph corruption, ownership leakage, stale state y illegal skip;
- repetir eventos y submissions sin duplicar efectos;
- mantener la suite anterior de autonomía y criteria en verde.

### Lo que todavía no se debe afirmar

- autonomía en producción;
- Vertex live verification;
- Firestore cloud verification;
- Cloud Scheduler/Cloud Run deployment;
- performance multi-instancia de producción;
- validación comercial con un coach y alumnos reales;
- retención de alumnos o willingness-to-pay;
- video demo como evidencia técnica o comercial.

## Evidencia de verificación

Los conteos son snapshots de hitos y no deben sumarse entre sí:

| Hito | Tests | Resultado |
|---|---:|---|
| Baseline Autonomy V1 | 163 | verde; 3 live skipped |
| Autonomy V1.1 | 175 total / 172 pass / 0 fail / 3 skipped | PASS |
| Coach Criteria V1 | 192 total / 189 pass / 0 fail / 3 skipped | PASS |
| Methodology Graph V1 | 198 total / 195 pass / 0 fail / 3 skipped | PASS WITH NOTES |
| Typecheck final | — | PASS |
| Build final | — | PASS |

La suite final incluye regresiones de autonomía, criteria, artifacts,
progression, identity, storage, companion y methodology.

## Arquitectura de proveedores y cloud

```text
Production reasoning boundary
  ├── Gemini Developer API (opcional)
  ├── Vertex Gemini (opcional / pendiente auth)
  └── deterministic test provider (local)

Production persistence boundary
  ├── Firestore adapter (no live proof in this session)
  ├── file adapter
  └── memory adapter (local E2E)
```

Los tests locales no requieren `GOOGLE_APPLICATION_CREDENTIALS`, gcloud,
service account, IAM, billing, Firestore cloud ni Vertex. Las omisiones live
están reportadas como `SKIPPED`, `PENDING_AUTH` o `NOT_DEPLOYED`; no se
convierten en afirmaciones de producción.

## Hardcoding audit resumido

### Migrado a autoridad de datos

- disponibilidad de misiones;
- prerequisites y unlocks;
- branches y remediation;
- metodología por coach/curso/versión;
- companion next-action legality;
- stall target selection;
- graph-derived map progress.

### Conservado intencionalmente

- packs legacy y fixtures de demo;
- fallback estático de compatibilidad;
- fixtures deterministas de tests;
- API/seed como mecanismo de creación mientras no exista authoring UI.

Estos elementos no son la autoridad cuando un workflow tiene metodología
pinneada.

## Contribución de agentes

### AGY

AGY fue usado como bounded builder con Gemini 3.7 Flash High. Entregó módulos
iniciales del graph domain, pero su ejecución expiró antes del cierre de
integración. No se atribuye a AGY una entrega completa que no produjo.

### Echo

Echo se usó como red team independiente en OpenCode con
`opencode/muse-spark-1.2-contributor-free`.

- reconnaissance inicial: encontró los huecos reales antes de implementación;
- post-fix audit: detectó rutas estáticas residuales y una divergencia del mapa;
- cierre final: `ECHO_CLOSURE=PASS`, `P0=0`, `P1=0`, `P2=0`.

### LUNA

LUNA hizo reconnaissance, integración, corrección de límites, pruebas focales,
regresión completa, typecheck, build, hardcoding audit y reportes de aceptación.

## Evaluación formal de jueces AGY

Se enviaron tres jueces AGY en modo read-only con una rúbrica común y con el
video demo explícitamente excluido. Resultado: **98/100**, **98/100** y
**100/100**, promedio **98.7/100**. Ningún juez descontó puntos por el video.

El detalle completo está en
`TRAZO_AGY_JUDGES_EVALUATION.md`. Sus límites coincidentes fueron authoring UI,
cloud/multi-instance proof y validación comercial; no encontraron un blocker
P0/P1 en el núcleo actual.

## Cómo va avanzando TRAZO

### Avance fuerte

TRAZO ya dejó de ser solamente “un mapa de misiones con IA”. La arquitectura
ahora tiene tres propiedades diferenciadoras que sí están conectadas:

1. El coach define qué cuenta como buena ejecución.
2. El coach define cómo se recorre su metodología.
3. El sistema conserva la autoridad determinista sobre consecuencias y estado.

Eso acerca el producto a la tesis real: convertir la metodología de un coach en
un sistema ejecutable de implementación, no clonar su personalidad ni ofrecer
otro chatbot genérico.

### Avance aún no probado

La parte técnica está más madura que la parte de negocio. Todavía no sabemos si
un coach entregará su programa, aceptará un piloto, si los alumnos producirán
entregables reales durante la segunda semana o si el resultado merece pago.

Por eso el siguiente salto de valor no es construir más infraestructura, sino
conseguir un design partner y medir comportamiento real con un módulo pequeño.

## Próximos pasos recomendados

1. Design partner con un programa real.
2. Un módulo, 5–8 misiones y una cohorte pequeña.
3. Medir primera evidencia, regreso en semana dos, correcciones, bloqueos y
   carga del coach.
4. Validar si el grafo y los criterios reducen seguimiento manual.
5. Después, decidir entre authoring UI, cloud proof o más automatización.

La misión cloud (`Cloud Scheduler → Cloud Run → Firestore/Vertex`) debe seguir
separada de la validación del núcleo local.

## Documentos técnicos de respaldo

- `AUTONOMY_CORE_V1_1_REPORT.md`
- `COACH_CRITERIA_CORE_V1_REPORT.md`
- `METHODOLOGY_GRAPH_CORE_V1_REPORT.md`
- `AGENTS.md`
- `docs/AI_RUNTIME_CONTRACT.md`
- `docs/PROGRESSION_ARTIFACT_CONTRACT.md`

## Veredicto general de la sesión

**TRAZO está avanzando bien como núcleo técnico y todavía está en fase de
validación comercial.** La evidencia actual justifica seguir con un piloto
real; no justifica afirmar product-market fit, autonomía cloud productiva ni
éxito de retención.
