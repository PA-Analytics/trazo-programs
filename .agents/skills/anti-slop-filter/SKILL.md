---
name: anti-slop-filter
description: Ejecuta la validación final (Fase 5 del bucle continuo) contra clichés de diseño, AI-slop en código, sobre-promesas de producto y violaciones de tokens de TRAZO.
---

# Purpose

Actuar como la compuerta final de calidad técnica y estética antes de fusionar o dar por completada una tarea, erradicando AI-slop visual, código inflado y afirmaciones no respaldadas.

# When to use

- Al finalizar una implementación de frontend o backend (Fase 5 del bucle continuo).
- Antes de emitir un commit, PR o reporte de finalización.
- Al auditar un componente o vista para verificar alineación con `docs/brand/` y `DESIGN.md`.

# Required context to read

- Leer `docs/brand/ANTI_PATTERNS.md` y `docs/brand/BRAND_SYSTEM.md`.
- Leer `docs/brand/COMPONENT_RULES.md` y `docs/brand/TOKENS.md`.
- Consultar `references/ui-anti-slop.md`, `references/code-anti-slop.md` y `references/copy-truth-gate.md`.

# Workflow

1. **Revisión de UI & Visuales:**
   - Validar paleta contra la regla 60-30-10 (`--paper`, `--ink`, `--lime`).
   - Verificar bordes (2px tinta), esquinas asimétricas (`.edge`/`.edge-alt`), ausencia de `rounded-xl` y eliminación de degradados/sparkles.
   - Confirmar contraste APCA y touch targets mínimos de 44px.
2. **Revisión de Código & Arquitectura:**
   - Eliminar comentarios redundantes o descriptivos de lo obvio.
   - Eliminar wrappers vacíos y helpers prematuros que no cumplan la Regla de los 2 Consumidores.
3. **Revisión de Verdad de Producto (Copy Truth Gate):**
   - Asegurar que no existan promesas de IA infladas, métricas inventadas o componentes con estado simulado que no conecte con el dominio backend.
4. **Veredicto:**
   - Emitir veredicto binario: `PASS` o `REJECT` con lista de correcciones exactas.

# Hard rules

- Cero gradientes morado/violeta sobre fondos oscuros.
- Cero badges o píldoras con emojis o "✨ AI-Powered".
- Cero comentarios obvios en el código.
- Cero complacencia: reportar violaciones de forma directa y cuantificada.

# Deliverable / expected output

Veredicto del gatekeeper anti-slop (`PASS` / `REJECT`) con hallazgos categorizados por UI, Código o Copy.
