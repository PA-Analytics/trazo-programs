# TRAZO — Typography

TRAZO tiene dos voces tipográficas. La landing carga ambas con `next/font/google` en `app/layout.tsx`.

## A. Condensed display

**Familia:** Anton. Fallback: `"Arial Narrow", sans-serif`. Peso disponible y usado: `400`. Aunque el archivo CSS declara `font-weight: 400`, la propia forma condensada aporta la densidad.

**Usar en:** H1/H2, nombres de misión, títulos de capítulo, hitos, wordmark y una afirmación principal de sección. La landing aplica uppercase globalmente a `.font-display` y tracking `0.005em`.

**No usar en:** párrafos, metadata, formularios, navegación densa, botones repetidos, estados, evidencia o microcopy.

### Escala observada

| Rol | Móvil | Desktop | Line-height |
|---|---:|---:|---:|
| Hero display | `2.8rem`–`3.2rem` | `4.8rem` | `0.90` |
| Section display | `2.25rem` | `3.55rem` | `0.92` |
| Mission/subtitle display | `1.5rem`–`1.875rem` | `2.25rem`–`3rem` | `0.94`–`0.96` |

## B. Sans UI/body

**Familia:** Geist. Fallback: `ui-sans-serif, system-ui, sans-serif`. Pesos observados: regular, medium (`500`), semibold (`600`).

**Usar en:** body, navegación, botones, links, labels, evidencia, feedback, formularios, estados y texto auxiliar. Body: `1rem` móvil → `1.125rem` desktop, generalmente `leading-relaxed`. UI: `0.875rem`–`1rem`; auxiliar: `0.75rem`.

**No usar:** tracking amplio como decoración, párrafos en uppercase o labels ilegibles de 11px.

## Reglas de composición

- Una sola idea display dominante por bloque.
- Mantener el display corto; el detalle vive en Geist.
- Uppercase está permitido para el display y estados muy puntuales, no para microtextos en serie.
- No añadir una tercera familia. `Geist Mono` aparece hoy en dos labels de `difference-section`; es una inconsistencia, no una voz recomendada.
- Prohibido el monospace decorativo, el tracking exagerado y el uppercase microtext excesivo.
- En producto, display puede vivir en chapter titles, milestone labels y large section identity; UI/body debe cubrir botones, metadata, navegación, forms, evidencia y dense navigation.
