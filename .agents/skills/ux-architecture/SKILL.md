---
name: ux-architecture
description: Define la estructura, progresión e interacción de un producto educativo basado en quest maps antes de escribir UI.
---

# Purpose

Convertir la intención del producto en especificaciones UX claras para cursos, capítulos, mapas, misiones y dependencias.

# When to use

Activar al decidir la arquitectura de información, la progresión, la estructura de un quest map o el comportamiento de una nueva vista.

# Required context to read

- Leer `PROJECT_HYPOTHESIS.md` antes de proponer arquitectura, si existe.
- Leer `references/quest-grammar.md`, `state-model.md` e `information-architecture.md` según el alcance.

# Workflow

1. Identificar objetivo, usuario y resultado de aprendizaje.
2. Modelar Course → Chapter → Quest Map → Mission → Evidence → Completion → Unlock.
3. Dibujar el DAG: ramas, convergencias, hitos y posibles dead ends.
4. Definir qué se ve primero y qué aparece mediante progressive disclosure.
5. Especificar estados, bloqueos, razones y próximos desbloqueos.
6. Entregar una especificación verificable, sin implementar React.

# Hard rules

- El mapa debe responder inmediatamente dónde estoy, qué puedo hacer, qué está bloqueado, por qué y qué desbloqueo después.
- No inventar funcionalidades fuera de la hipótesis del proyecto.
- No convertir el mapa en una lista plana ni ocultar dependencias esenciales.
- Evitar dead ends sin explicación o ruta de recuperación.
- Separar misiones principales, secundarias, entregables y hitos.
- Esta skill produce UX specs; no crea componentes ni código.

# Deliverable / expected output

Un documento con estructura de navegación, modelo de nodos y estados, reglas de progresión, comportamiento de detalle y casos límite.

# References by task

- Gramática y dependencias: `references/quest-grammar.md`.
- Estados y transiciones: `references/state-model.md`.
- Jerarquía y disclosure: `references/information-architecture.md`.
