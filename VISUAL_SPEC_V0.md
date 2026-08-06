# VISUAL SPEC V0

## 1. Core Enums & State Model

```typescript
type nodeType = 
  | 'normal'     // Standard mission node (64px x 64px)
  | 'optional'   // Secondary / optional review node (52px x 52px)
  | 'milestone'  // Chapter culmination milestone node (96px x 96px)

type progressState = 
  | 'locked'     // Unmet prerequisites; inactive entry
  | 'available'  // Prerequisites satisfied; ready to start
  | 'active'     // Work currently in progress by student
  | 'submitted'  // Evidence delivered; awaiting human or automated feedback
  | 'completed'  // Mission completed and verified

type interactionState = 
  | 'idle'       // Default neutral state on canvas
  | 'hovered'    // Cursor hovering over node
  | 'selected'   // Active node target (MissionPanel open)
  | 'focused'    // Keyboard navigation focus ring
```

> [!IMPORTANT]
> `interactionState` is strictly separated from `progressState`. The visual focus ring (`--color-focus-ring`) is reserved **exclusively** for `focused` keyboard navigation / accessibility interaction state, while `selected` uses `--color-selection-ring`. Neither is ever used to communicate `progressState`.

---

## 2. System Tokens (Abstract Visual Contract)

### 2.1 Surfaces & Fills
- `--bg-canvas`: Canvas background base surface.
- `--bg-grid-pattern`: Technical alignment grid/dots pattern.
- `--bg-chapter-rail`: Compact left navigation dock background.
- `--color-surface-locked`: Low-contrast desaturated fill for locked nodes.
- `--color-surface-available`: Balanced interactive fill for available nodes.
- `--color-surface-active`: Solid accent fill for active in-progress nodes.
- `--color-surface-submitted`: Distinct warm fill for submitted nodes.
- `--color-surface-completed`: Solid success fill for completed nodes.

### 2.2 Borders & Strokes
- `--color-border-locked`: Desaturated muted border stroke.
- `--color-border-available`: Primary accent border stroke.
- `--color-border-active`: High-contrast active border stroke.
- `--color-border-submitted`: Review/warning tint border stroke.
- `--color-border-completed`: Success tint border stroke.
- `--color-selection-ring`: Dedicated outline stroke for `selected` interaction state.
- `--color-focus-ring`: Dedicated outline stroke reserved exclusively for `focused` keyboard navigation / accessibility state.

### 2.3 Connectors (Edges)
- `--color-edge-locked`: Desaturated stroke for locked paths.
- `--color-edge-available`: Solid primary stroke for unlocked/available paths.
- `--color-edge-completed`: Solid success stroke for completed paths.

---

## 3. Node Geometry & Sizing Specification

### 3.1 `normal` Node
- **Dimensions**: `64px × 64px`
- **Geometry**: Squircle / Rounded rect (`border-radius: 8px`)
- **Icon Size**: `24px × 24px` (Centered)
- **Title Label**: Positioned bottom-centered below node (`margin-top: 8px`), max width `120px`, 2-line clamp.

### 3.2 `optional` Node
- **Dimensions**: `52px × 52px` (Smaller relative footprint)
- **Geometry**: Chamfered / Octagonal clip-path (`polygon(15% 0, 85% 0, 100% 15%, 100% 85%, 85% 100%, 15% 100%, 0 85%, 0 15%)`)
- **Stroke**: Dashed stroke (`stroke-dasharray: 4 4`)
- **Icon Size**: `20px × 20px`

### 3.3 `milestone` Node
- **Dimensions**: `96px × 96px` (Prominent structural scale)
- **Geometry**: Hexagonal badge (`polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)`)
- **Frame**: Double concentric stroke frame
- **Icon Size**: `36px × 36px`

---

## 4. `progressState` Visual Encoding (No Canvas Badges)

Nodal canvas states are encoded exclusively through border, fill, icon, and structural treatment. Permanent text badges/pills (such as "DISPONIBLE", "EN CURSO", "COMPLETADO") are **forbidden on the canvas nodes**. State names are displayed textually only inside tooltips and `MissionPanel`.

| `progressState` | Border Stroke | Fill Opacity & Surface | Icon Token | Structural Cue |
| :--- | :--- | :--- | :--- | :--- |
| `locked` | 1.5px solid `--color-border-locked` | 30% `--color-surface-locked` | Padlock icon (`lock`) at 40% opacity | Dashed incoming edge |
| `available` | 2px solid `--color-border-available` | 60% `--color-surface-available` | Quest start icon (`play`/`pin`) | Solid incoming edge |
| `active` | 2.5px solid `--color-border-active` | 100% `--color-surface-active` | Tool/work icon (`work`) | Solid incoming & highlight stroke |
| `submitted` | 2px solid `--color-border-submitted` | 75% `--color-surface-submitted` | Review/clock icon (`document-check`) | Solid incoming edge |
| `completed` | 2px solid `--color-border-completed` | 100% `--color-surface-completed` | Bold checkmark (`check-bold`) | Solid completed outgoing edge |

---

## 5. `interactionState` Visual Encoding

- `idle`: Default rendering based on `progressState`.
- `hovered`: Node scales to `scale(1.05)` over `150ms ease-out`. Connected edges brighten. Contextual tooltip opens after `200ms`.
- `selected`: Canvas displays `2px` offset outline using `--color-selection-ring`. Camera smoothly pans if required to keep node visible outside `MissionPanel`.
- `focused`: Keyboard navigation focus ring (`2px` outline `--color-focus-ring`). Reserved exclusively for keyboard navigation / accessibility.

---

## 6. Canvas & Screen Architecture

### 6.1 Spatial Layout
- **Left Dock (Secondary Chapter Navigation)**: Compact vertical rail inspired by FTB Quests (`width: 56px - 64px`). Displays chapter icon tabs. **Must not look like a SaaS sidebar** (no text trees or nested menus).
- **HUD Bar**: Minimal top bar (`height: 48px`). Contains chapter title, completion counter (`X / Y`), and camera re-center button.
- **Canvas**: Defined as **all remaining viewport space** after the compact left rail and top HUD bar.
- **MissionPanel**:
  - `width: clamp(360px, 32vw, 460px)`
  - Overlay drawer sliding in from the right edge.
  - Does not compress the map container. Upon selection, the canvas smoothly adjusts camera offset to ensure the selected node remains centered within the unobstructed canvas area.

---

## 7. Topology Coordinates & Grid Layout (Chapter 1)

Grid Base Unit: `16px`. Anchor Origin: `(X: 100px, Y: 300px)`

- **N01 Premisa**: `(X: 100px, Y: 300px)` | `nodeType: 'normal'`
- **N02 Estructura Directa (Rama A)**: `(X: 280px, Y: 220px)` | `nodeType: 'normal'`
- **N03 Estructura Narrativa (Rama B)**: `(X: 280px, Y: 380px)` | `nodeType: 'normal'`
- **N04 Revisión Opcional**: `(X: 440px, Y: 460px)` | `nodeType: 'optional'` *(Positioned downstream off N03)*
- **N05 Ensamble (Convergencia)**: `(X: 600px, Y: 300px)` | `nodeType: 'normal'`
- **N06 Publicación**: `(X: 780px, Y: 300px)` | `nodeType: 'normal'`
- **N07 Registro de Señales**: `(X: 960px, Y: 300px)` | `nodeType: 'normal'`
- **N08 Análisis**: `(X: 1140px, Y: 300px)` | `nodeType: 'normal'`
- **N09 Hito Primera Pieza en Mercado**: `(X: 1340px, Y: 284px)` | `nodeType: 'milestone'`

---

## 8. Branching & Convergence Logic Rules

- **Branching (N01 → N02 / N03)**:
  - Completing `N01` sets both `N02` and `N03` to `progressState: 'available'`.
  - Splitting junction dot (`6px`) at `(X: 220px, Y: 300px)`.

- **Convergence (N02 / N03 / N04 → N05)**:
  - Unlocking rule for `N05`: `requiresAny: [N02, N03]`
  - Completing either `N02` **OR** `N03` immediately transitions `N05` from `locked` to `available`.
  - The alternate unchosen route is **not** a requirement and remains `available` for optional exploration.
  - `N04` is connected downstream from `N03` as an optional review quest and **never blocks `N05`**.

- **Edge Appearance**:
  - Path geometry: Orthogonal 90° lines with `6px` rounded corners.
  - `locked` edge: 2px stroke, `stroke-dasharray: 6 6`, `--color-edge-locked`.
  - `available` / `active` edge: 2.5px solid stroke, `--color-edge-available`.
  - `completed` edge: 3px solid stroke, `--color-edge-completed`.
  - `N04` optional connectors: 2px dashed stroke (`stroke-dasharray: 4 4`).

---

## 9. Level of Detail (LOD) & Camera Rules

- **Zoom Limits**: `minZoom: 0.4`, `maxZoom: 1.5`
- Internal node IDs (such as `N01`, `N02`) are system keys and are **not** displayed as primary labels to students.

- **Zoom > 0.8× (Standard View)**: Node rendering includes icon, state styling, and short mission title text below node.
- **Zoom 0.5× - 0.8× (Overview View)**: Mission title text hides. Node rendering preserves icon, shape geometry, and `progressState` stroke/fill colors.
- **Zoom < 0.5× (Far Bird's Eye, down to minZoom 0.4×)**: Map displays simplified geometric shapes and color-coded state nodes for fast macro-progression assessment.

---

## 10. Motion Rules (Significant Changes Only)

1. **Mission Completion**: Node surface fill animates over `300ms ease`. Outgoing edge stroke fills over `400ms ease`.
2. **Node Unlocking**: Newly unlocked node transitions from `locked` to `available` with a subtle scale pop (`1.0 → 1.08 → 1.0`) over `250ms`.
3. **MissionPanel Drawer**:
   - Open: `transform: translateX(100%) -> translateX(0)` in `250ms` (`cubic-bezier(0.16, 1, 0.3, 1)`).
   - Close: `transform: translateX(0) -> translateX(100%)` in `200ms` (`cubic-bezier(0.7, 0, 0.84, 0)`).
4. **Reduced Motion**: `@media (prefers-reduced-motion: reduce)` replaces all scale/slide motion with standard `150ms` opacity cross-fades.
