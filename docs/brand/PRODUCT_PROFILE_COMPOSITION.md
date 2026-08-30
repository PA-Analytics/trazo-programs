# TRAZO — Product profile composition

## Status

Working visual baseline for product entry screens. The profile-selection page is the reference implementation; this document captures its reusable composition, not a requirement to clone its copy or artwork on every tab.

Source implementation:

- `src/components/ProfileSwitcher.tsx`
- `src/components/ProfileReturnRoute.tsx`
- `src/styles/setup-calibration.css`
- `src/styles/trazo-tokens.css`

## Core composition

The screen has two deliberate jobs:

1. The left column establishes identity and orientation.
2. The right column presents the real decision and its available actions.

On desktop, both jobs live inside one dark ink frame. The left side is editorial and spacious; the right side is operational and denser. A thin vertical divider separates the two reading modes. The composition should feel like a field guide with a decision surface, not a dashboard.

### Frame

- Full viewport field: `--trazo-ink` (`#141A16`) with `--trazo-paper` text.
- Main frame: `width: min(100%, 1200px)`.
- Frame padding: `clamp(32px, 5vw, 72px)`.
- Main border: `3px solid var(--trazo-paper)`.
- Flat cobalt offset: `10px 10px 0 var(--trazo-indigo)`.
- The offset is structural and graphic; do not replace it with a diffuse shadow or glow.
- Desktop columns: `minmax(270px, 0.82fr)` and `minmax(0, 1.18fr)`.
- Column gap: `clamp(40px, 7vw, 96px)`.
- Left column right divider: one hairline at roughly 36% paper opacity.

### Reading order

Left column:

1. TRAZO wordmark.
2. Small section eyebrow.
3. Large three-line display statement.
4. One sentence of orientation copy.
5. Optional contextual companion visual.

Right column:

1. Stage index in UI type.
2. One concise decision heading in display type.
3. Divider.
4. Ordered decision rows.
5. Action group separated by another divider.

Keep one dominant display statement per column. Do not add a second hero, metrics block, decorative badge, or competing panel.

## Typography

TRAZO uses two voices only:

### Display / character

- `var(--trazo-font-display)` → `Anton, "Arial Narrow", sans-serif`.
- Weight `400`; the condensed form supplies the visual density.
- Uppercase for major identity, chapter, mission and decision headings.
- Typical line-height: `0.88`–`0.94`.
- Use negative tracking with restraint: the profile identity uses approximately `-0.045em`; the right decision heading uses approximately `-0.02em`.
- Do not use this face for paragraphs, metadata, buttons, or dense controls.

### UI / body / controls

- `var(--trazo-font-ui)` → `Geist, ui-sans-serif, system-ui, sans-serif`.
- Body copy uses regular or medium weight and approximately `1.5` line-height.
- Eyebrows, indexes, row metadata and actions use semibold/bold weights with short labels.
- Use uppercase only for purposeful indexes, states and action labels; never turn a paragraph into microcopy.
- Do not add a third typeface. `Geist Mono` is reserved for genuinely technical data.

## Color language

The screen is intentionally limited to mineral paper, ink and cobalt, with stone for secondary information.

| Role | Token | Use |
|---|---|---|
| Ink | `--trazo-ink` / `#141A16` | Full frame, dark rows, primary structure |
| Paper | `--trazo-paper` / `#F1F1EC` | Text, active row, borders and contrast |
| Cobalt | `--trazo-indigo` / `#3657FF` | Active selection, structural offset and next action |
| Soft cobalt | `--trazo-indigo-soft` / `#5E77FF` | Secondary emphasis on dark surfaces |
| Stone | `--trazo-stone` / `#8E938B` | Muted metadata, future/secondary information |

Cobalt is a signal, not an ambient fill. If everything is cobalt, nothing indicates the next decision. Avoid purple gradients, glow, ambient blue backgrounds and invented progress indicators.

## Decision rows

The profile rows are interactive buttons, not generic content cards. Their visual treatment communicates selection and action:

- Dark row: paper mixed into ink at low opacity, visible paper border, asymmetric TRAZO radius, minimum height `106px` on desktop.
- Layout: waypoint, identity, optional active-state label and next action.
- Hover: a restrained `translateX(4px)` plus stronger border contrast; no lift, glow or animated shine.
- Focus: `3px` cobalt outline with a visible offset; never remove it.
- Active row: paper background, ink text, paper border and a flat cobalt offset of `8px 8px`.
- Active waypoint: cobalt circular marker with paper text; inactive waypoint: ink body with paper/stone border.
- The action label is always explicit: `Continuar` for the active profile, `Retomar` for another saved profile.

The row must remain a real button with keyboard behavior and an accessible name. Do not reproduce the shape as a non-interactive card.

## Buttons and action hierarchy

### Primary action

`Crear una ruta` is a solid filled rectangular button with rounded corners: cobalt background (`var(--trazo-indigo)`), paper text (`var(--trazo-paper)`) and standard radius (`var(--trazo-radius-sm)`). It is primary because it initiates a new route.

The action keeps a minimum touch height of `44px`.

## Companion visual

The current page uses `ProfileReturnRoute` as a controlled visual slot for `trazo-pensando-derecha.png`:

- It is contextual artwork, not a route, metric or state authority.
- It is `aria-hidden` with an empty alternative because the real profile choices remain available as accessible controls on the right.
- Desktop image height: `160px`; mobile image height: `150px`.
- The image is visually offset left to compensate for transparent source margins (`-38px` desktop, `-30px` mobile).
- The wrapper hides overflow so the illustration cannot create horizontal scroll.
- Use a companion visual only when it supports orientation or tone. Do not copy it into every tab as decoration.

If a future tab has a real route or state to communicate, use the route/node grammar instead of substituting an illustration for product meaning.

## Responsive behavior

At `680px` and below:

- Collapse to one column.
- Replace the left column's vertical divider with a bottom divider.
- Reduce frame padding to `28px 24px 30px` and offset to `6px 6px` cobalt.
- Keep the identity statement large but constrained to the viewport.
- Keep the companion contained within its slot and preserve the full character silhouette.
- Stack or wrap actions without reducing the `44px` touch target.
- Confirm `scrollWidth === clientWidth`; no horizontal scroll is acceptable.

## What carries to other tabs

Carry these decisions across product screens:

- ink/paper/cobalt material language;
- Anton for identity and important headings;
- Geist for all operational reading and controls;
- one dominant idea per block;
- visible structural borders and purposeful dividers;
- asymmetric or deliberately restrained geometry;
- cobalt reserved for current action, selection, progress or unlock;
- active state expressed through color plus shape, scale, border or position;
- real actions presented as controls, not decorative cards;
- motion only when state changes, always respecting reduced motion.

Do not carry these elements blindly:

- the exact profile copy;
- the two-column split when the task needs a single operational column;
- the mascot image;
- the profile-specific active-row shadow;
- large editorial whitespace when it harms task completion.

## Anti-slop gate

Before approving a new tab against this baseline, check:

- Does the layout clarify where the user is and what to do next?
- Is the dominant display type earning its space?
- Are buttons visibly actionable and keyboard-focusable?
- Does cobalt identify a real action or state?
- Are borders and offsets structural rather than decorative effects?
- Are cards organizing a real decision instead of multiplying containers?
- Is there any gradient, glow, pill, fake metric, ambient map or decorative AI trope?
- Does the screen stay legible at mobile width without horizontal overflow?

