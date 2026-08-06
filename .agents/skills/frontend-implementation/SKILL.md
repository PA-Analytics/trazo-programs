---
name: frontend-implementation
description: Convierte especificaciones UX y visuales aprobadas en una implementación React TypeScript mantenible basada en mapas de quests.
---

# Purpose

Preparar y, cuando llegue el momento, implementar una interfaz de quest maps con datos separados de presentación y APIs internas claras.

# When to use

Activar después de que UX y dirección visual estén aprobadas, al diseñar componentes, modelos de datos, nodos, edges, estado o rendimiento.

# Required context to read

- Leer la especificación UX aprobada y `DESIGN.md`.
- Consultar `references/react-rules.md`, `xyflow-nodes.md`, `xyflow-edges.md` y `xyflow-layout.md` según el cambio.
- TODO: enrich from verified upstream source sobre documentación oficial de xyflow.

# Workflow

1. Convertir el modelo conceptual en tipos de dominio independientes de UI.
2. Definir APIs pequeñas para mapa, navegación y panel de misión.
3. Implementar componentes pequeños y custom nodes/edges.
4. Mantener estado explícito y transiciones previsibles.
5. Probar ramas, convergencias, estados y viewport en tamaños relevantes.
6. Verificar accesibilidad y rendimiento antes de entregar.

# Hard rules

- Tecnología objetivo futura: React, TypeScript y `@xyflow/react`.
- No hardcodear cursos concretos ni mezclar datos con presentación.
- Priorizar componentes pequeños, composición y APIs internas estables.
- Diseñar para embed-friendly y rendimiento razonable.
- Usar `QuestMap`, `QuestNode`, `QuestEdge`, `ChapterNavigation` y `MissionPanel` como conceptos, no como obligación de crear archivos concretos.
- No implementar sin especificación aprobada.

# Deliverable / expected output

Código organizado, tipado y verificable que respete UX, dirección visual y accesibilidad, con decisiones técnicas documentadas cuando sea necesario.

# References by task

- React y TypeScript: `references/react-rules.md`.
- Nodos: `references/xyflow-nodes.md`.
- Edges: `references/xyflow-edges.md`.
- Layout y viewport: `references/xyflow-layout.md`.
