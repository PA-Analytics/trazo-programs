# TRAZO — Tokens

Valores extraídos de `app/globals.css`, `app/layout.tsx` y componentes de la landing. Los nombres `--lime` y `--stone` son históricos; este documento usa nombres portables.

## Color

| Tipo | Token | Valor | Uso actual | Significado |
|---|---|---|---|---|
| Raw | `--trazo-paper` | `#F3EEE2` | `--paper`, fondo, texto sobre tinta | campo de lectura, papel cálido |
| Raw | `--trazo-ink` | `#1A2119` | `--ink`, texto, bordes, paneles | estructura y trabajo activo |
| Raw | `--trazo-surface` | `#EBE5D6` | `--surface`, paneles | superficie secundaria |
| Raw | `--trazo-surface-2` | `#E0D9C7` | `--surface-2`, footers de marcos | separación auxiliar |
| Raw | `--trazo-indigo` | `#2625B7` | `--lime`, CTA, ruta y nodos | acción, progreso, selección, desbloqueo |
| Raw | `--trazo-indigo-soft` | `#4646D7` | `--lime-soft` | énfasis índigo suavizado |
| Raw | `--trazo-stone` | `#969181` | `--stone`, bloqueado y baja prioridad | futuro, bloqueo o contexto secundario |
| Raw | `--trazo-line` | `#D0C8B6` | `--line`, divisores secundarios | estructura de baja intensidad |
| Semantic | `--trazo-bg` | `var(--trazo-paper)` | fondo principal | base de lectura |
| Semantic | `--trazo-action` | `var(--trazo-indigo)` | CTA y acción primaria | siguiente acción |
| Semantic | `--trazo-progress` | `var(--trazo-indigo)` | rutas completadas y progreso | avance verificable |
| Semantic | `--trazo-selected` | `var(--trazo-ink)` | nodo activo/panel actual | atención operativa |
| Semantic | `--trazo-locked` | `var(--trazo-stone)` | rutas y nodos bloqueados | dependencia futura |
| Semantic | `--trazo-border` | `var(--trazo-ink)` | bordes principales | contención estructural |
| Semantic | `--trazo-muted` | `var(--trazo-stone)` | texto secundario (en código también `#686558`) | menor prioridad |
| Semantic | `--trazo-focus` | `var(--trazo-indigo)` | focus-visible de 3px | orientación accesible |

Nota: `--muted-foreground` actual es `rgb(104 101 88)` / `#686558`, distinto de `--stone`. Mantener esa diferencia cuando el contraste textual lo exija.

## Tipografía

| Tipo | Token | Valor | Uso |
|---|---|---|---|
| Semantic | `--trazo-font-display` | `Anton, "Arial Narrow", sans-serif` | headlines, nombres de misión, wordmark |
| Semantic | `--trazo-font-ui` | `Geist, ui-sans-serif, system-ui, sans-serif` | body, UI, nav, botones, labels |

Escala observada: hero `clamp(2.8rem, 13vw, 3.2rem)` → `4.8rem`; headings `2.25rem` → `3.55rem`; display secundario `1.5rem` → `3rem`; body `1rem` → `1.125rem`; UI `0.875rem`–`1rem`; auxiliar `0.75rem`. Line-height display `0.90`–`0.96`; body `leading-relaxed` (`1.625`); labels cerca de normal. Tracking display `0.005em`; no crear tracking general adicional.

## Espacio, bordes y forma

| Tipo | Token | Valor | Uso |
|---|---|---|---|
| Raw | `--trazo-border-width` | `2px` | marcos y controles principales |
| Raw | `--trazo-border-width-strong` | `3px` | marco protagonista del hero |
| Raw | `--trazo-border-width-hairline` | `1px` | divisores y líneas secundarias |
| Raw | `--trazo-radius-sm` | `3px` | esquina corta de `.edge` |
| Raw | `--trazo-radius-md` | `13px` | esquina larga de `.edge` |
| Semantic | `--trazo-radius-edge` | `13px 3px 13px 3px` | CTA/piezas alternadas |
| Semantic | `--trazo-radius-edge-alt` | `3px 13px 3px 13px` | marcos y paneles |
| Raw | `--trazo-space-unit` | `4px` | base inferida de utilidades Tailwind |
| Semantic | `--trazo-content-max` | `72rem` | `max-w-6xl` |
| Semantic | `--trazo-section-y` | `5rem` → `7rem` | `py-20` → `md:py-28` |
| Semantic | `--trazo-content-x` | `1.5rem` | `px-6` dominante; hero móvil usa `1rem` |

## Motion

| Token | Valor observado | Uso |
|---|---|---|
| `--trazo-motion-fast` | `300ms` | cambio de color de nav/CTA |
| `--trazo-motion-reveal` | `500–800ms` | entradas de secciones y hero |
| `--trazo-motion-route` | `3.8s linear infinite` | trazo animado del mapa |
| `--trazo-motion-pulse` | `2.4s infinite` | pulso del nodo activo |
| `--trazo-ease-standard` | cubic-bezier derivado de `ease` | reveals del hero |

La regla global de reduced motion reduce animation/transition a `0.001ms`.
