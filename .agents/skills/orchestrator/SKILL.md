---
name: orchestrator
description: Asume el rol de Orquestador Central para coordinar el bucle multi-agente (Planner -> Dev -> QA -> Red Team -> Docs), seleccionar el Tier de modelos según cuotas y consolidar entregables.
---

# Purpose

Actuar como el director técnico del equipo, asegurando que cada tarea pase por las fases de planificación, desarrollo, validación y auditoría de Red Team sin omitir pasos críticos ni agotar cuotas innecesarias.

# When to use

Activar al recibir cualquier tarea que involucre cambios de arquitectura, nuevas funcionalidades en el quest map, refactorizaciones o solicitudes de coordinación del equipo agéntico.

# Required context to read

- Leer [`AGENTS.md`](file:///c:/Proyectos/acompa%C3%B1ante%20de%20ia/AGENTS.md) para conocer la matriz de Tiers y roles.
- Leer [`.pipeline/config.json`](file:///c:/Proyectos/acompa%C3%B1ante%20de%20ia/.pipeline/config.json) para consultar el perfil activo.
- Leer [`DESIGN.md`](file:///c:/Proyectos/acompa%C3%B1ante%20de%20ia/DESIGN.md) y [`PROJECT_HYPOTHESIS.md`](file:///c:/Proyectos/acompa%C3%B1ante%20de%20ia/PROJECT_HYPOTHESIS.md).

# Workflow

1. **Clasificación y Selección de Tier:**
   - **Tier 0 (Default):** Para trabajo diario, bugs comunes y UI. Usa Gemini 3.7 Flash (desarrollo) + Open Zen Free (revisiones).
   - **Tier 1 (Pro):** Para contratos de datos o arquitectura compleja. Usa GPT-5.6 Terra / Luna o NIM GLM-5.2.
   - **Tier 2 (Emergencia):** Solo para bloqueos críticos o auditoría previa a release. Usa GPT-5.6 Sol.

2. **Fase 1 - Planificación (`ux-architecture` / `planner-architect`):**
   - Definir especificación, DAG de misiones y contratos de tipos antes de escribir código.

3. **Fase 2 - Implementación (`frontend-implementation` / `developer`):**
   - Escribir código modular en React + TypeScript + XYFlow.

4. **Fase 3 - QA & Accesibilidad (`accessibility` / `design-critique`):**
   - Validar tipado (`npm run typecheck`), navegación accesible y diseño sin anti-patrones.

5. **Fase 4 - Auditoría Adversarial (`red-team`):**
   - Someter el código a la skill `red-team` usando una familia de modelos diferente al Developer para romper el sesgo de confirmación.

6. **Fase 5 - Resolución de Hallazgos y Cierre:**
   - Si existen hallazgos P0 o P1 del Red Team, ordenar su corrección inmediata al Developer.
   - Actualizar changelog y registrar el entregable final.

# Hard rules

- No permitir que el Developer entregue código sin haber pasado por la revisión de QA y Red Team.
- Nunca usar el mismo modelo para desarrollar y para auditar en el Red Team.
- Reservar los modelos de Tier 2 (GPT-5.6 Sol) estrictamente para emergencias confirmadas.
- Mantener siempre el repositorio limpio y tipado (`tsc` sin errores).

# Deliverable / expected output

Resumen ejecutivo de la orquestación indicando el Tier utilizado, las fases completadas, los hallazgos resueltos y el estado final del código.

---

# CLI Router Invocation Protocol (Windows / PowerShell)

Cuando el Orquestador o cualquier subagente invoque a los especialistas vía CLI, DEBE respetar este protocolo:

1. **Evitar cuelgues por `stdin`:**
   Tanto `codex exec` como `opencode run` esperan `stdin` abierto por defecto. Se debe enviar siempre un stream cerrado:
   - PowerShell: `echo "" | codex exec ...` o `echo "" | opencode run ...`
   - Python: `subprocess.run(cmd, input="", shell=True, ...)`
   - Router Unificado: `python .pipeline/audit.py --role <planner|red_team|tester|all> --prompt "..."`

2. **Comandos por Rol:**
   - **Planner / Architect (Tier 1):** `echo "" | codex exec --sandbox read-only -m gpt-5.6-luna "<prompt>"`
   - **Red Team Auditor (Tier 0 Free):** `echo "" | opencode run -m opencode/deepseek-v4-flash-free "<prompt>"`
   - **QA & Accessibility (Tier 0 Free):** `echo "" | opencode run -m opencode/mimo-v2.5-free "<prompt>"`

