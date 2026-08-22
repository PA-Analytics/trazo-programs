# TRAZO Multi-Agent Architecture & Team Playbook

Este repositorio opera bajo una arquitectura de **Equipo Multi-Agente Agnóstico del Proveedor**. Cualquier asistente o entorno de desarrollo (Google Antigravity, OpenAI Codex, OpenCode, Cursor o scripts CLI) que interactúe con este código debe regirse por las reglas permanentes, heurísticas y contratos canónicos definidos en este documento.

---

## 1. Reglas Permanentes de Operación (Invariantes)

Estas 7 reglas son la constitución innegociable de desarrollo en TRAZO y aplican a todos los modelos, agentes y herramientas.

### 1. Las Fronteras Canónicas Superan la Reinvención
Antes de crear un nuevo runtime, ruta de persistencia, evaluador, modelo de identidad, almacén de artefactos o autoridad arquitectónica equivalente:
- Inspecciona la implementación y el contrato canónico existente.
- Consume esa ruta cuando satisfaga el requerimiento.
- Si no puede satisfacerlo, reporta la limitación explícitamente.
- **Nunca** crees silenciosamente una implementación paralela con autoridad sobre el estado.

### 2. Build AI ≠ Product AI
Los sistemas y herramientas de IA utilizados para construir, auditar o revisar TRAZO son estrictamente independientes de las capacidades de IA desplegadas dentro del producto final. Una instrucción de construcción como *"usa Gemini"* o *"usa Codex"* no autoriza la creación ni modificación del runtime de IA de producto. Cualquier cambio en Product AI debe solicitarse explícitamente y respetar [`docs/AI_RUNTIME_CONTRACT.md`](docs/AI_RUNTIME_CONTRACT.md).

### 3. Interpretación Probabilística, Integridad Determinista
Los modelos LLM pueden interpretar ambigüedad, evaluar evidencia contra rúbricas, procesar lenguaje y producir feedback/orientación. El código determinista de TRAZO es el único dueño de las consecuencias estructurales:
- Aplicación de veredictos de política ([`src/domain/evaluationPolicy.ts`](src/domain/evaluationPolicy.ts)).
- Transiciones legales y verificación de prerrequisitos ([`src/domain/progression.ts`](src/domain/progression.ts)).
- Completado de misiones, desbloqueos en el grafo y progresión.

### 4. El Estado de Dominio Autoritativo Vive en el Backend
El estado canónico de progresión y dominio reside exclusivamente en el estado backend persistente ([`src/server/repository.ts`](src/server/repository.ts) / Firestore). El estado de frontend, estado de navegador y el historial de conversación controlan legítimamente aspectos de UX y presentación (ej. perfil activo, visualización del mapa), pero **no** establecen de forma independiente la verdad de la progresión.

### 5. Un No-PASS No Puede Avanzar la Progresión
Los resultados de `REWORK`, `CLARIFY`, `HUMAN_REVIEW`, `AMBIGUOUS`, `SYSTEM_ERROR` o fallos de runtime/proveedor pueden persistir la realidad ocurrida (intento de entrega, evidencia cruda, feedback devuelto, marcas de tiempo, conversación, traza de decisión e información de error). Sin embargo, **nunca** deben:
- Completar la misión.
- Desbloquear rutas o misiones posteriores.
- Evadir prerrequisitos.
- Representar al alumno como completado.
- Crear artefactos canónicos posteriores ([`docs/PROGRESSION_ARTIFACT_CONTRACT.md`](docs/PROGRESSION_ARTIFACT_CONTRACT.md)).
`PASS` es el único disparador de progresión consecuencial.

### 6. La Incertidumbre Debe Emerger, No Inventarse
Cuando los requerimientos, evidencia, identificadores, esquemas, arquitectura o significado semántico sean genuinamente insuficientes: **clarifica, pregunta, reporta o detén la ejecución**. Nunca inventes:
- Reglas de negocio o comportamiento de proveedores.
- IDs de misión o criterios de rúbrica inexistentes.
- Evidencia no provista o significado para texto basura / corrupto.
- Arquitectura ausente.
Esta regla aplica tanto al comportamiento de agentes de código como a la lógica del producto.

### 7. Las Declaraciones de Verificación Deben Coincidir con la Evidencia
Los reportes de progreso y cierre de tareas deben distinguir estrictamente qué fue verificado utilizando el vocabulario estándar:
- **`Implemented`:** Código o cambio escrito; no implica validación ejecutada.
- **`Typechecked`:** Validación estática/tipos ejecutada con éxito (`npm run typecheck` / `tsc -b`).
- **`Tested`:** Pruebas automatizadas ejecutadas con éxito (`npm test`). Reportar la suite o tests ejecutados.
- **`Live-Local-Verified`:** Comportamiento ejecutado localmente contra las dependencias externas reales relevantes para la tarea (ej. Vertex AI ADC, Firestore).
- **`Production-Verified`:** Comportamiento observado directamente contra la superficie de producción desplegada (Cloud Run).
- **`Unverified`:** Superficie o reclamo no ejecutado o imposible de verificar en el entorno actual.
Nunca infieras verificación de Firestore a partir de Vertex, verificación visual a partir de pruebas unitarias, o verificación de producción a partir de una compilación local.

---

## 2. Heurísticas Operativas (Juicio de Agente)

A diferencia de los invariantes, estas directrices admiten adaptación justificada:

- **Mínimo Útil de Agentes:** Usa el menor número de agentes que aporten valor significativamente distinto.
  - *Tarea rutinaria/acotada:* Orquestador solo.
  - *Construcción compleja:* Orquestador + opcionalmente un segundo constructor acotado.
  - *Cierre consecuencial:* Opcionalmente un revisor independiente de otra familia de modelo/proveedor.
  - *4+ agentes:* Requiere justificación explícita. Nunca generes enjambres de revisores redundantes para fabricar consenso artificial.
- **Pase Adversarial Acotado:** Aplica un desafío adversarial cuando la decisión sea costosa, arquitectónica, ligada a seguridad/estado o difícil de revertir. Omítelo cuando el valor esperado sea bajo.
- **Investigación Dirigida:** Sigue el bucle: *hipótesis $\rightarrow$ desafío adversarial $\rightarrow$ identificar incertidumbre crítica $\rightarrow$ investigar esa incertidumbre $\rightarrow$ actualizar decisión*. No ejecutes búsquedas amplias por defecto si la evidencia en el repositorio es suficiente.
- **Verificación de Proveedor en Vivo:** Usa mocks y dependencias en memoria durante la iteración rápida. Ejecuta proveedores reales en hitos de cierre o cuando el comportamiento del proveedor sea el núcleo de la tarea.
- **Verificación Visual Semántica:** Los cambios de UI/layout requieren renderizado e inspección visual. Las tareas puramente de backend o dominio no requieren capturas.
- **Disciplina de Abstracción:** Prefiere implementaciones concretas. Crea una abstracción únicamente cuando elimine duplicación comprobada o proteja una frontera arquitectónica real.

---

## 3. Dirección Visual y Diseño

El desarrollo de interfaz debe seguir la gramática del sistema de diseño de TRAZO y preservar la jerarquía visual semántica. Las reglas visuales, paleta y anti-patrones residen canónicamente en:
- [`DESIGN.md`](DESIGN.md)
- [`docs/brand/BRAND_SYSTEM.md`](docs/brand/BRAND_SYSTEM.md)
- [`docs/brand/ANTI_PATTERNS.md`](docs/brand/ANTI_PATTERNS.md)

---

## 4. Contratos Canónicos del Repositorio

1. **AI Runtime Contract:** [`docs/AI_RUNTIME_CONTRACT.md`](docs/AI_RUNTIME_CONTRACT.md) — Único runtime canónico de Gemini/Vertex (`src/server/ai/runtime.ts`), protocolo de validación ADC y manejo de fallos.
2. **Progression & Artifact Contract:** [`docs/PROGRESSION_ARTIFACT_CONTRACT.md`](docs/PROGRESSION_ARTIFACT_CONTRACT.md) — Ciclo de vida de artefactos canónicos, producción exclusiva en `PASS` y consumo downstream.

---

## 5. Matriz de Roles y Proveedores (Pipeline)

La asignación de perfiles y modelos se gestiona en [`.pipeline/config.json`](.pipeline/config.json) y el router [`.pipeline/audit.py`](.pipeline/audit.py).

| Rol / Especialista | Propósito Principal |
| :--- | :--- |
| **👑 0. Orquestador / Integrador** | Analiza requerimientos, toma decisiones finales, integra cambios y lidera la construcción. |
| **💻 1. Bounded Builder** | Implementa componentes o módulos acotados respetando contratos existentes. |
| **🛡️ 2. Red Team / Auditor Independiente** | Audita código y arquitectura desde una familia de modelo independiente para evitar sesgo de confirmación. |
| **🧪 3. Tester / QA** | Ejecuta suites de tests, verifica tipos y evalúa cobertura funcional. |

### ⚠️ Nota Operativa: Stdin en Windows
Los CLIs de `codex exec` y `opencode run` leen de `stdin` por defecto. Al invocarlos desde PowerShell/scripts:
- En PowerShell: canalizar cierre de entrada (`echo "" | codex exec ...` / `echo "" | opencode run ...`).
- En Python: pasar `input=""` y `shell=True` en `subprocess.run()`.
- En general: usar el router automatizado `python .pipeline/audit.py --role <planner|red_team|tester|all> --prompt "..."`.

---

## 6. Plantilla Compacta de Tarea (Task-Spec Template)

Para tareas complejas, utiliza esta estructura compacta. Las secciones irrelevantes (ej. Look & Feel en backend) pueden omitirse libremente:

```markdown
# TASK: [Título descriptivo]

## ROLE
[Constructor / Arquitecto / Auditor + frontera de autoridad]

## GOAL
[Resultado atómico deseado y criterios de aceptación]

## NON-GOALS
[Qué NO se debe construir, modificar ni tocar]

## CONTEXT
[Archivos relevantes y contratos canónicos por referencia]

## BUILD AI
[Modelo/herramienta de asistencia en construcción o revisión]

## PRODUCT AI
[NONE o especificación canónica vía src/server/ai/runtime.ts]

## INVARIANTS
[Restricciones específicas de la tarea más allá de los invariantes heredados]

## LOOK & FEEL
[Opcional: solo si aplica trabajo visual; referenciar DESIGN.md]

## DELIVERABLES
[Archivos concretos a crear o modificar]

## VALIDATION
[Nivel de verificación objetivo y comandos a ejecutar]

## REVIEW
[Opcional: especificar si requiere auditoría de modelo independiente]

## STOP
[Condición de parada y reporte]
```
