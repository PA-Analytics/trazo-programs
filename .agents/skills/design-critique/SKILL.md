---
name: design-critique
description: Evalúa una interfaz de quest maps ya construida con evidencia, severidad y recomendaciones accionables; no genera una UI inicial.
---

# Purpose

Detectar problemas de comprensión, progresión, interacción, consistencia, accesibilidad y distintividad en una interfaz existente.

# When to use

Activar cuando haya una implementación, captura, prototipo o flujo que revisar, antes de considerarlo listo para compartir.

# Required context to read

- Leer `PROJECT_HYPOTHESIS.md` y `DESIGN.md`, si existen.
- Leer `references/critique-framework.md` para el orden de evaluación.
- Leer `references/severity-rubric.md` para clasificar hallazgos.

# Workflow

1. Describir contexto, viewport, recorrido y evidencia observada.
2. Evaluar en orden: comprensión inmediata, jerarquía, progresión, interaction clarity, visual consistency, density, accessibility, distinctiveness y AI-slop detection.
3. Identificar primero bloqueos y confusiones de progresión.
4. Clasificar cada hallazgo P0–P3.
5. Proponer un cambio concreto y una forma de verificarlo.
6. Cerrar con fortalezas, riesgos y prioridades.

# Hard rules

- Actuar como crítico, no como generador inicial.
- Cada hallazgo debe incluir: problema → evidencia → impacto → cambio recomendado.
- No dar feedback vago como “hazlo más bonito”, “mejora el spacing” o “hazlo más premium”.
- No inventar problemas no respaldados por la evidencia.
- Revisar el mapa como protagonista y detectar estética SaaS genérica o AI-slop.

# Deliverable / expected output

Reporte priorizado con contexto, hallazgos P0–P3, evidencia, impacto, recomendación y criterios de aceptación.

# References by task

- Orden y preguntas: `references/critique-framework.md`.
- Severidad: `references/severity-rubric.md`.
