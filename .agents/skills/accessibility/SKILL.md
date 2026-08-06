---
name: accessibility
description: Audita y especifica accesibilidad funcional para un quest map interactivo, incluidos teclado, estados, zoom y alternativas al grafo visual.
---

# Purpose

Hacer que la progresión y las acciones del mapa sean comprensibles y operables para personas con distintas capacidades.

# When to use

Activar al diseñar o auditar cualquier mapa, nodo, panel, control de viewport, estado de progreso o interacción animada.

# Required context to read

- Leer la especificación UX y `DESIGN.md`.
- Consultar `references/graph-accessibility.md` y `accessibility-checklist.md`.
- Revisar la skill `design-critique` cuando la auditoría forme parte de una crítica.

# Workflow

1. Enumerar tareas críticas y recorridos equivalentes sin puntero.
2. Auditar foco, teclado, nombres semánticos y descripciones del grafo.
3. Verificar que estados locked, available, active y completed tengan señales redundantes.
4. Probar selección de nodo, detalle, zoom, pan y navegación entre capítulos.
5. Revisar contraste, reduced motion y alternativa lineal o textual.
6. Registrar hallazgos reproducibles y cambios recomendados.

# Hard rules

- La accesibilidad es requisito funcional, no una capa opcional.
- No depender únicamente de color, posición, hover o movimiento.
- Todo nodo accionable necesita nombre, estado y resultado comprensibles.
- El mapa visual debe tener una alternativa navegable y equivalente.
- El foco debe ser visible y el orden de teclado coherente.
- Respetar `prefers-reduced-motion` y ofrecer controles accesibles de zoom/pan.

# Deliverable / expected output

Checklist o reporte con tareas auditadas, evidencia, severidad, bloqueos y recomendaciones verificables.

# References by task

- Grafo interactivo: `references/graph-accessibility.md`.
- Revisión general: `references/accessibility-checklist.md`.
