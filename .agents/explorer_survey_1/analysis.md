# Codebase & Quest Map Architecture Analysis

**Agent:** Explorer 1 (Codebase & Quest Map Architecture)  
**Date:** 2026-08-17  
**Working Directory:** `c:/Proyectos/acompañante de ia/.agents/explorer_survey_1`  
**Integrity Mode:** Read-Only Investigation  

---

## 1. Executive Summary

The codebase is a high-quality, typed React 19 + TypeScript single-page application and companion Node backend designed around an educational DAG (Directed Acyclic Graph) quest map powered by `@xyflow/react` (v12). 

A prototype implementation of the physical 2.5D TRAZO companion (`src/components/CompanionAvatar.tsx`, `src/hooks/useCompanionTraveler.ts`, `src/utils/companionPathSampler.ts`) already exists alongside the legacy floating bottom bar (`src/components/CompanionNextAction.tsx`). However, `CompanionAvatar` is not yet mounted inside the active React Flow viewport in `src/components/QuestMap.tsx`, and the edge traversal triggering and verified PASS transition hooks need clean integration into the main application workflow.

All tests (75/75 automated unit, policy, companion voice, and verified action tests) and TypeScript typechecks (`tsc -b --pretty false`) pass cleanly in <5.5 seconds with zero compiler warnings or runtime exceptions.

---

## 2. Codebase Structure & Directory Map

```
c:/Proyectos/acompañante de ia/
├── package.json               # Node ESM project, scripts, dependencies
├── tsconfig.json              # Solution config referencing app & node configs
├── tsconfig.app.json          # ES2022/ESNext strict TS config for src/
├── tsconfig.node.json         # Node config for server & scripts
├── vite.config.ts             # Vite bundler config with /api proxy to :3001
├── index.html                 # HTML shell loading Anton & Geist fonts, main.tsx
├── src/
│   ├── main.tsx               # Root entry, React 19 StrictMode, @xyflow CSS
│   ├── App.tsx                # Master state hub (sessions, submissions, HUD, panels)
│   ├── styles.css             # Main stylesheet + import of companion.css
│   ├── components/
│   │   ├── ChapterNavigation.tsx # 64px compact left rail for chapter navigation
│   │   ├── CompanionAvatar.tsx   # 2.5D physical mascot & anchored conversation panel
│   │   ├── CompanionNextAction.tsx # Floating bottom bar for route recommendations
│   │   ├── HudBar.tsx            # Minimal top HUD (title, session, stats, recenter)
│   │   ├── JunctionNode.tsx      # Decorative 6px branch dot waypoint node
│   │   ├── MapControls.tsx       # Floating zoom in/out and fit-view buttons
│   │   ├── MissionPanel.tsx      # Right slide-over drawer for evidence & rubrics
│   │   ├── QuestEdge.tsx         # Custom spline edge with via waypoint & styling
│   │   ├── QuestMap.tsx          # ReactFlow canvas wrapper + camera coordinator
│   │   ├── QuestNode.tsx         # Interactive quest nodes with LOD & depth styling
│   │   ├── TerritoryNode.tsx     # Cartographic territory background regions
│   │   └── icons.tsx             # Semantic SVG icons & badge indicators
│   ├── data/
│   │   └── course.ts             # Course, chapter, mission, edge, & rubric data
│   ├── domain/
│   │   ├── companion.ts          # Types for 5 states, 8-compass dirs, poses
│   │   ├── course.ts             # Domain models (Mission, Edge, Rubric, State)
│   │   ├── evaluationPolicy.ts   # Deterministic policy engine (PASS/REWORK/CLARIFY)
│   │   └── progression.ts        # Pure DAG mathematics (deriveProgress, locking)
│   ├── hooks/
│   │   └── useCompanionTraveler.ts # 60/120fps direct GPU translate3d animation loop
│   ├── presentation/
│   │   ├── labels.ts             # Display labels for node types & progress states
│   │   └── missionEvaluation.ts  # Submission state mapping & user-facing copy
│   ├── server/
│   │   ├── index.ts              # Server bootstrap with --env-file
│   │   ├── app.ts                # Native Node HTTP routing (/api/v1/*)
│   │   ├── service.ts            # Implementation & submission domain service
│   │   ├── repository.ts         # Firestore & in-memory state persistence
│   │   ├── types.ts              # DTOs and contract definitions
│   │   ├── companion/            # Gemini 3.7 next-action proposer & service
│   │   └── evaluator/            # Gemini 3.7 evidence interpreter & rubrics
│   ├── styles/
│   │   ├── companion.css         # Mascot sprite, 2.5D shadow, 8-way eyes, panel
│   │   └── trazo-tokens.css      # Design tokens (mineral paper, ink, cobalt)
│   └── utils/
│       └── companionPathSampler.ts # SVG path distance & tangent angle sampler
├── tests/                     # 16 test suites (75 passed, 3 skipped live diagnostics)
└── scripts/                   # Reliability & live calibration runner scripts
```

---

## 3. Configuration, Build, & Test Pipeline

### 3.1 Dependencies
* **Runtime (`dependencies`):**
  * `@xyflow/react`: `latest` (React Flow v12)
  * `react` & `react-dom`: `latest` (React 19)
  * `@google/genai`: `^2.17.1` (Gemini 3.7 Flash SDK)
  * `@google-cloud/firestore`: `^9.0.0` (Firestore persistence)
  * `@types/node`: `^26.2.0`
* **Development (`devDependencies`):**
  * `vite`: `latest`
  * `@vitejs/plugin-react`: `latest`
  * `typescript`: `latest`
  * `@playwright/test`: `^1.62.1`

### 3.2 Key npm Scripts
| Script | Command | Purpose | Verification Status |
| :--- | :--- | :--- | :--- |
| `npm run typecheck` | `tsc -b --pretty false` | Strict TypeScript check | Exited code `0` (clean) |
| `npm test` | `node --experimental-strip-types --test tests/*.test.ts` | Node native test runner | 75 passed, 0 failed, 3 skipped |
| `npm run dev` | `vite` | Starts Vite dev server (port 5173) | Proxies `/api` -> `localhost:3001` |
| `npm run server` | `node --env-file=.env --experimental-strip-types src/server/index.ts` | Starts backend API (port 3001) | Functional |
| `npm run build` | `tsc -b && vite build` | Typechecks and produces dist bundle | Fully supported |

---

## 4. React Flow (@xyflow/react) Integration Map

### 4.1 Architecture & Component Hierarchy
* **Context Wrapper:** `QuestMap` mounts `<ReactFlowProvider>` around `QuestMapCanvas`.
* **Flow Instance:** Captured via `onInit={setInstance}` as `ReactFlowInstance<MapNode, QuestFlowEdge>`.
* **State Management:** Unidirectional props down, callback events up. `App.tsx` owns top-level state (`implementationState`, `progress`, `evaluationStateByMissionId`, `selectedMissionId`, `recommendedMissionId`). Pure graph derivation runs via `deriveMissionProgress(activeChapter.missions, completedMissionIds)`.

### 4.2 Custom Node Types (`nodeTypes`)
1. **`quest` (`QuestNode.tsx`):**
   * **Roles & Sizing:** `normal` (88px), `optional` (72px chamfered octagonal), `milestone` (160px hexagonal badge), with entry/convergence roles at 104px.
   * **Handles:** Target handle at `Position.Left`, Source handle at `Position.Right`. Both `isConnectable={false}`.
   * **Level of Detail (LOD):** Connected to `useViewport().zoom`:
     * `standard` (`zoom >= 0.62`): Shows icon, badge, full title, subtitle, cues, destination rings.
     * `overview` (`0.42 <= zoom < 0.62`): Hides labels/subtitles, preserves shape, icon, and progress fill/stroke.
     * `far` (`zoom < 0.42`): Simplified geometric color-coded glyphs.
   * **State Attributes:** `data-progress` (`locked` | `available` | `active` | `submitted` | `completed`), `data-evaluation` (`evaluating` | `rework` | `clarify` | `pass`), `data-recommended` (`true`/`false`), `data-selected` (`true`/`false`).
   * **Interactive Elements:** Rendered as `<button type="button" className="quest-node-button nodrag nopan">` with full keyboard focus (`aria-label`, `aria-describedby="mission-tooltip-..."`).
2. **`junction` (`JunctionNode.tsx`):**
   * Decorative 6px waypoint dot (`branch-junction`) placed at bifurcation points (e.g., `(x: 320, y: 428)`). `selectable: false`, `draggable: false`, `zIndex: 4`.
3. **`territory` (`TerritoryNode.tsx`):**
   * Cartographic background regions (`Taller` workshop: 820x730, `Campo` field: 550x460, `Mercado` market: 280x310) with SVG topographic contour lines. `selectable: false`, `draggable: false`, `zIndex: 0`, `pointer-events: none`.

### 4.3 Custom Edge Types (`edgeTypes`)
* **`quest` (`QuestEdge.tsx`):**
  * Supports smooth spline through intermediate `via` waypoints via `smoothSplineThroughVia(sourceX, sourceY, targetX, targetY, via)` (dual cubic Bezier curves) or standard `getBezierPath({ curvature: 0.34 })`.
  * Data attributes for styling: `data-progress` (`locked` | `available` | `completed`), `data-route` (`future` | `immediate` | `traveled`), `data-optional`, `data-highlighted`, `data-destination`.

### 4.4 Coordinate System & Spatial Layout (Chapter 1)
* **Coordinate Space:** Top-left origin Cartesian pixels:
  * `N01` Premisa: `(110, 380)` (Entry node)
  * `branch-01` Junction: `(320, 428)`
  * `N02` Estructura Directa (Branch A): `(420, 155)`
  * `N03` Estructura Narrativa (Branch B): `(455, 485)`
  * `N04` Revisión Opcional: `(640, 690)`
  * `N05` Ensamble (Convergence): `(740, 365)`
  * `N06` Publicación: `(920, 220)`
  * `N07` Registro de Señales: `(1080, 395)`
  * `N08` Análisis: `(1235, 225)`
  * `N09` Primera Pieza en Mercado: `(1420, 70)` (Milestone destination)
* **Camera Coordinate Offset:** When a node is selected, `QuestMapCanvas` computes:
  ```ts
  const mapWidth = mapContainerRef.current.clientWidth
  const panelWidth = Math.min(460, Math.max(360, mapWidth * 0.32))
  const centerX = mission.position.x + size / 2 + panelWidth / (2 * zoom)
  const centerY = mission.position.y + size / 2
  instance.setCenter(centerX, centerY, { zoom, duration: reducedMotion ? 0 : 250 })
  ```
  This centers the selected node in the visible canvas space left of the drawer.

---

## 5. TRAZO Companion Layer & Kinematics Architecture

### 5.1 The 5 Visual States
1. **`IDLE`:** Sits beside the active mission node (`data-state="idle"`). Torso breathes gently via `@keyframes trazo-idle-breathe` (3.4s loop, 1.5px vertical breath).
2. **`ATTENTION`:** Activated when clarification is needed or a route recommendation is ready (`data-state="attention"`). Antenna tip shifts to cobalt (`--trazo-action`), pill cue appears ("Tengo una duda" / "Vamos por aquí") without forcing the panel open.
3. **`THINKING`:** Activated during async AI evaluation/next-action query (`data-state="thinking"`). Antenna sweeps ±12° via `@keyframes trazo-thinking-antenna` (1.2s alternating).
4. **`MOVING`:** Activated during real-time edge traversal (`data-state="moving"`). Sprints along SVG curve with 4px step bobbing, shadow scale oscillation, and dynamic 8-way gaze orientation.
5. **`VERIFIED` (Modo TRAZO):** Activated upon verified evidence submission `PASS` (`data-state="verified"`). Outer halo illuminates with cobalt glow (`--trazo-action`), torso surface tint activates, antenna glows.

### 5.2 Kinematics & Path Sampling Engine
* **`CompanionPathSampler` (`src/utils/companionPathSampler.ts`):**
  * Wraps an off-screen SVG `<path d="...">`.
  * Computes total length with `pathElement.getTotalLength()`.
  * Samples point `p1 = getPointAtLength(d)` and look-ahead tangent `p2 = getPointAtLength(d + 1.5)`.
  * Derives angle `rad = Math.atan2(p2.y - p1.y, p2.x - p1.x)` and quantizes into 8 compass sectors: `['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE']`.
* **`useCompanionTraveler` (`src/hooks/useCompanionTraveler.ts`):**
  * Runs a pure `requestAnimationFrame` loop decoupled from React state tree.
  * Direct GPU manipulation: `containerRef.current.style.transform = translate3d(x, y - bobbing, 0)`.
  * Updates `dataset.direction` (driving CSS eye pupil offsets) and dynamic `zIndex = Math.floor(y / 10) + 10`.
  * Modulates the `.trazo-companion-shadow` scale (`1 - bobbing / 20`) and opacity (`0.45 * scale`).
  * Instant teleportation when `prefers-reduced-motion: reduce` is active.

### 5.3 Micro-Reactions & Anchored Panel
* **Tap Reactions:** Multi-tap detection in `<350ms` bursts triggers quick humorous reactions (`¡Oye! Estoy aquí concentrado jaja`) without opening the panel.
* **Anchored Panel:** Clicking the mascot opens `<aside className="trazo-anchored-panel">` positioned directly relative to the mascot container (`top: 52px`, `left: 50%`, `translateX(-50%)`), displaying decision turns, clarification form, and recommendation actions.

---

## 6. Integration Points & Concrete Blueprint

### 6.1 Viewport Mounting in `QuestMap.tsx`
Currently, `CompanionAvatar` is imported in `QuestMap.tsx` but not rendered. To mount it inside the React Flow coordinate system:
1. In `QuestMapCanvas`, render `<CompanionAvatar>` as a direct child of the React Flow viewport container or via an inner overlay component that lives inside `.react-flow__viewport`.
2. Compute the companion's initial position next to the active node:
   ```ts
   const activeMission = chapter.missions.find(m => m.id === (activeMissionId || 'N01')) || chapter.missions[0]
   const initialPos = {
     x: activeMission.position.x + getNodeDimension(activeMission) + 16,
     y: activeMission.position.y + getNodeDimension(activeMission) / 2
   }
   ```
3. Expose the `companionRef` (`CompanionHandle`) to allow programmatic travel when moving between missions.

### 6.2 Edge Traversal on Mission Selection / Start
When a learner starts or clicks a connected mission:
1. Locate the edge connecting `currentMissionId` to `targetMissionId` in `chapter.edges`.
2. Extract the source and target node coordinates and generate the SVG path data:
   ```ts
   const sourceDim = getNodeDimension(sourceMission)
   const targetDim = getNodeDimension(targetMission)
   const sourceX = sourceMission.position.x + sourceDim
   const sourceY = sourceMission.position.y + sourceDim / 2
   const targetX = targetMission.position.x
   const targetY = targetMission.position.y + targetDim / 2
   const pathData = edge.via
     ? smoothSplineThroughVia(sourceX, sourceY, targetX, targetY, edge.via)
     : getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition: Position.Right, targetPosition: Position.Left, curvature: 0.34 })[0]
   ```
3. Call `companionRef.current?.moveToNode(pathData, targetMissionId)`.

### 6.3 Unification of Next Action Bar
Currently, `App.tsx` conditionally renders `CompanionNextAction` as a fixed bottom bar (`lines 424-432`).
* With `CompanionAvatar` mounted directly on the map, next-action reasoning, clarifications, and recommendations can be driven through the mascot's ATTENTION cue and anchored popover panel, removing visual clutter and preserving the dominance of the quest map as mandated by `DESIGN.md`.

### 6.4 Modo TRAZO & State Synchronization
* When `handleSubmitEvidence` in `App.tsx` receives `data.completed === true` (verified `PASS`):
  * Pass `isVerifiedAction={true}` down to `QuestMap` / `CompanionAvatar`.
  * Companion enters `data-state="verified"` for 3 seconds, illuminating the halo, followed by smooth traversal to the next recommended available node.

---

## 7. Anti-Slop & Design System Compliance

* **Palette Compliance (60-30-10):**
  * 60% Mineral Paper base (`--trazo-paper: #f1f1ec`)
  * 30% Ink structural borders & text (`--trazo-ink: #141a16`)
  * 10% Cobalt action signal (`--trazo-indigo / --trazo-action: #3657ff`)
* **Zero AI Cliché Elements:**
  * No purple/violet SaaS gradients.
  * No generic floating chatbot widgets with generic sparkle badges.
  * No generic spinners (custom antenna motion for async states).
  * No permanent text badges cluttering canvas nodes (state communicated by geometry, borders, fills, and semantic icon tokens).

---

## 8. Verification & Test Evidence

* **TypeScript Compilation:**
  * Command: `npm run typecheck` (`tsc -b --pretty false`)
  * Result: **0 errors, exit code 0**.
* **Automated Test Suite:**
  * Command: `npm test` (`node --experimental-strip-types --test tests/*.test.ts`)
  * Result: **75 passed, 0 failed, 3 skipped, total duration ~5.0s**.
  * Tested suites:
    * `artifactPipeline.test.ts`
    * `companionVoice.test.ts`
    * `consequentialMultiStep.test.ts`
    * `evaluator.unit.test.ts`
    * `implementationState.test.ts`
    * `missionEvaluationPresentation.test.ts`
    * `nextActionCompanion.test.ts`
    * `policyEngine.test.ts`
    * `preFreezeHardening.test.ts`
    * `unifiedCompanionConversation.test.ts`
    * `verifiedAction.e2e.test.ts`
