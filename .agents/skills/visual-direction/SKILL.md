---
name: visual-direction
description: Define y protege una dirección visual distintiva para un quest map educativo, coherente con DESIGN.md y la marca del creador.
---

# Purpose

Establecer la gramática visual, jerarquía, tono y comportamiento expresivo de la experiencia sin convertirla en un dashboard SaaS.

# When to use

Activar al definir o revisar composición, tipografía, color, tokens, iconografía, bordes, nodos o motion.

# Required context to read

- Leer `PROJECT_HYPOTHESIS.md`, si existe.
- Leer `DESIGN.md` antes de proponer decisiones visuales.
- Consultar `references/visual-principles.md`, `design-tokens.md` y `anti-patterns.md` según la tarea.

# Workflow

1. Confirmar el objetivo de la pantalla y la primacía del mapa.
2. Extraer restricciones y decisiones ya fijadas en `DESIGN.md`.
3. Definir jerarquía, gramática de nodos y señales de estado.
4. Proponer tokens solo donde no exista una decisión previa.
5. Revisar contraste, densidad, motion y adaptabilidad de marca.
6. Documentar decisiones y sus razones.

# Hard rules

- FTB Quests inspira la gramática de progresión, no una copia literal ni estética infantil.
- Prohibidos: dashboard SaaS genérico, gradientes morados SaaS, glassmorphism sin propósito, cards para todo, `rounded-xl` indiscriminado, emojis como iconos, glow excesivo, KPI dominante, sidebar SaaS, chat principal, branding de AI protagonista y decoración sin función.
- El mapa domina la composición; el detalle es contextual.
- No sobrescribir tokens definidos en `DESIGN.md`.
- Los estados no pueden depender únicamente del color.

# Deliverable / expected output

Una dirección visual aplicable: composición, jerarquía, tokens, nodos, estados, iconografía y motion con justificación.

# References by task

- Principios: `references/visual-principles.md`.
- Tokens en construcción: `references/design-tokens.md`.
- Prohibiciones y señales de alerta: `references/anti-patterns.md`.
