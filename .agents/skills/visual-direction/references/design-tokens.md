# Design tokens — TRAZO

Tokens canónicos definidos en `docs/brand/TOKENS.md` y `docs/brand/trazo-tokens.css`:

### 1. Paleta de Color

| Token Semántico | Valor Hex | Uso Principal |
| :--- | :--- | :--- |
| `--paper` | `#F3EEE2` | Fondo principal cálido (papel cartográfico). |
| `--ink` | `#1A2119` | Tipografía principal, bordes estructurales, fondos de paneles activos. |
| `--surface` | `#EBE5D6` | Paneles secundarios, contenedores y contraste suave. |
| `--surface-2` | `#E0D9C7` | Separadores y zonas auxiliares. |
| `--lime` (Cobalto/Azul TRAZO) | `#2625B7` | **Único acento saturado:** rutas activas, CTAs principales, progreso y desbloqueos. |
| `--lime-soft` | `#4646D7` | Variantes de énfasis cuando se requiere contraste suave. |
| `--stone` | `#969181` | Estados bloqueados, líneas futuras y contenido auxiliar de baja prioridad. |
| `--line` | `#D0C8B6` | Divisores y estructura secundaria (1px). |

### 2. Tipografía

- **Display:** `Anton, sans-serif` (uppercase forzado, `letter-spacing: -0.01em`, `line-height: 0.9–0.95`).
- **Body & UI:** `Geist, sans-serif` (legibilidad, pesos regular 400 y medium 500).
- **Code / Technical:** `Geist Mono, monospace` (solo hashes, IDs y datos técnicos).

### 3. Geometría y Esquinas Asimétricas

- **Bordes:** `2px solid var(--ink)` (protagonistas pueden usar `3px`).
- **Radios asimétricos:**
  - `.edge`: `13px 3px 13px 3px`
  - `.edge-alt`: `3px 13px 3px 13px`
- **Textura cartográfica:** `.paper-grid` (puntos al 6% de tinta, paso de 22px).

### 4. Semántica de Estados

- **PASS / Verificado:** Trazo y nodo azul continuo (`#2625B7`), checkmark claro.
- **ACTIVE / Siguiente:** Borde de tinta de 2px con pulso o centro azul.
- **BLOCKED / Futuro:** Borde discontinuo en `--stone` acompañado siempre de texto o prerrequisito explícito.

