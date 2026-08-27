# Code & Architecture Anti-Slop Checklist

Validar rigurosamente el código TypeScript/React frente a esta lista:

### 1. Comentarios Redundantes
- ❌ **Prohibido:** Comentarios que solo repiten el nombre de la función, variable o tag JSX.
  - *Mal:* `// render the submit button` antes de `<button type="submit">`.
  - *Mal:* `// interface for user props` antes de `interface UserProps`.
  - *Permitido:* Comentarios que explican decisiones arquitectónicas no obvias, límites de invariantes o razones de negocio complejas.

### 2. Wrappers Vacíos y Sobre-Abstracción
- ❌ **Prohibido:** Crear componentes que solo envuelven otro componente sin aplicar lógica, transformación o estilo diferenciado.
- ❌ **Prohibido:** Crear "helpers" o abstracciones prematuras antes de que al menos **dos consumidores independientes** lo requieran activamente (**Regla de los 2 Consumidores**).

### 3. Una Skill / Función, Una Responsabilidad
- Toda función o hook debe resolver un solo problema técnico atómico.
- Separar estrictamente la presentación UI de la lógica de evaluación y persistencia en backend.

### 4. Determinismo sobre Probabilismo
- Las consecuencias de estado (progreso, desbloqueo de misiones, veredictos) residen exclusivamente en código determinista (`src/domain/evaluationPolicy.ts`, `src/domain/progression.ts`).
- La IA propone e interpreta; el código determinista valida y transiciona.
