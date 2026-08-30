# TRAZO — Onboarding & World Entry Experience Research V1

**Scope:** Deep Product / UX / Motion Research  
**Status:** Canonical Design Research Specification  
**Mode:** Read-Only / Architecture & UX Grounding  
**Author:** AGY (Lead Systems Architect & Product Orchestrator)  
**Red Team Audit:** Muse Spark 1.2 Contributor Free (`opencode/muse-spark-1.2-contributor-free`)  

---

## 1. Current Product Truth

Before defining any visual or motion evolution, the research is strictly grounded in the verified reality of the TRAZO codebase:

### 1.1 Existing Components & Interaction Boundaries
- **`IdentityEntry` (`src/components/IdentityEntry.tsx`):** Renders a single name input within `ProductRouteFrame`. Writes directly to `/api/v1/profiles` via `POST` (`{ displayName }`). It currently frames the moment as *"Paso 01: Inicio de ruta · Identidad"* with a placeholder `TrazzSlot`.
- **`RoleGateway` (`src/components/RoleGateway.tsx`):** Offers a binary choice between `learner` ("02A: Ejecuta misiones, entrega trabajo real...") and `coach` ("02B: Define qué cuenta como buen trabajo..."). Persists via `PATCH /api/v1/profiles/:userId/role`.
- **`LearnerQuickSetup` (`src/components/LearnerQuickSetup.tsx`):** Examines the DAG of Chapter 1 (`course.chapters[0]`). If a fork exists, it derives the real target mission titles as branch options (`03A`, `03B`). Persists exclusively `preferredRouteId` via `PATCH /api/v1/implementations/:id/learner-setup`. It does **not** ask for dormant fields (goal, pacing, background).
- **`LearnerRouteReady` (`src/components/LearnerRouteReady.tsx`):** Minimal boundary screen showing *"Tu ruta está lista"* with the chosen corridor name and an *"Entrar al mapa →"* button.
- **`QuestMap` (`src/components/QuestMap.tsx`):** Built on `@xyflow/react` (React Flow). Contains nodes (`QuestNode`, `JunctionNode`, `TerritoryNode`), SVG edges (`QuestEdge` with `smoothSplineThroughVia`), and viewport overlays for `CompanionAvatar` and `MapControls`.
- **`CompanionAvatar` (`src/components/CompanionAvatar.tsx`):** Represents Trazz as a physical SVG cartographer token living on the map canvas. Features states: `idle`, `attention`, `thinking`, `moving`, `verified`. Does **not** speak as a floating chatbot; communicates through contextual wayfinding pills and an anchored modal panel on tap.

### 1.2 Frozen Design Tokens & Visual Grammar
- **Typography:** `Anton` (`--trazo-font-display`) for high-consequence titles and wordmark; `Geist` (`--trazo-font-ui`) for controls, body copy, and labels. Line-height display `0.90–0.96`.
- **Color Grammar:** `Ink` (`#1A2119`) as environmental mass and structural containment; `Paper` (`#F3EEE2`) as focused work surface; `Cobalt/Indigo` (`#2625B7`) as scarce signal for active selection, route, and verified state; `Stone` (`#969181`) for locked and future context.
- **Form Language:** Asymmetric corners `13px 3px 13px 3px` (`--trazo-radius-edge`) and `3px 13px 3px 13px` (`--trazo-radius-edge-alt`). Structural borders `2px` / `3px`.

---

## 2. External Pattern Research

We examined real-world interaction patterns from leading consumer and learning applications, separating verified product behavior from product design interpretations and TRAZO hypotheses.

### 2.1 Duolingo (Learning Path & Onboarding)
- **Verified Product Behavior:** Duolingo abandoned its historical branching "tree" in favor of a strictly linear "snake path" to eliminate decision fatigue. Onboarding uses a conversational multi-step flow (goal, daily commitment, placement test). The mascot Duo actively narrates and reacts on almost every screen.
- **What Problem It Solves:** Maximizes Daily Active Usage (DAU) and minimizes cognitive drop-off for casual language habit formation.
- **Why It Does NOT Transfer to TRAZO:** TRAZO is a professional mastery platform centered on real-world deliverable evidence and branching trajectories. A linear, candy-colored snake path with an over-narrating mascot destroys the cartographic mental model, trivializes professional rigor, and violates Rule 1 (Erradicación de AI-Slop / Duolingo imitation).

### 2.2 Quizlet (Role Segmentation & Instant TTV)
- **Verified Product Behavior:** Prompts an immediate binary role segmentation (Teacher vs Student) during setup. Drops the user into an outcome-oriented workspace where empty states immediately present two giant high-contrast action cards ("Search sets" vs "Create a set").
- **What Problem It Solves:** Achieves minimal Time-to-Value (TTV) by segmenting "job-to-be-done" (creator vs consumer) without questionnaire bloat.
- **Transferability to TRAZO:** Highly transferable to Stage 2 (Role Choice). A clean, consequential bifurcation between Learner (demonstrating work) and Coach (calibrating standards) respects user time. However, TRAZO replaces the flat document grid with an active cartographic world.

### 2.3 Astra AI / Interactive Exam Prep
- **Verified Product Behavior:** Uses conversational assessment cards to segment user roles (student, teacher, parent) and claims to construct a tailored study path via rapid multiple-choice prompts.
- **What Problem It Solves:** Lowers user anxiety around curriculum planning by projecting adaptive intelligence.
- **Why It Does NOT Transfer to TRAZO:** Many AI apps rely on "generative AI theater" (e.g., spinning purple loaders: *"✨ Generating your custom path with AI..."*). In TRAZO, `Build AI ≠ Product AI` (`docs/AI_RUNTIME_CONTRACT.md`). The curriculum is derived deterministically from the coach's canonical DAG, not hallucinated on the fly.

### 2.4 Brilliant.org (Interactive Demonstration vs Passive Declaration)
- **Verified Product Behavior:** Rather than asking users to self-rate their proficiency on a 1-5 scale, Brilliant presents an immediate interactive visual puzzle or dilemma.
- **What Problem It Solves:** Eliminates Dunning-Kruger self-reporting bias and gives immediate feedback through action.
- **Transferability to TRAZO:** Deeply aligned with TRAZO's ethos (*"Trabajo real, verificable"*). If questions are asked in Stage 3, they should be concrete scenario choices rather than abstract self-rating sliders.

### 2.5 Finch / Headspace (Physical Mascot Restraint & Mindful Transitions)
- **Verified Product Behavior:** Finch anchors the experience with a companion pet that reacts with micro-movements (squish, eye direction) rather than long modal speeches. Headspace uses deliberate, grounded pacing (visual breathing room) to transition users between states.
- **Transferability to TRAZO:** Grounds Trazz's physical presence. Trazz is a silent cartographer whose gaze, compass orientation, and settled posture orient attention rather than interrupting the user.

---

## 3. Stage 1 — Name / Identity Entry (10 Hypotheses)

| ID | Concept | User Moment | Why It Could Work | Reference / Evidence | What Makes It TRAZO | Complexity | Risk | What To Test | Trazz Role |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **S1-H01** | **Cartographic Ledger Inscription** | User arrives at a clean Ink/Paper ledger with a massive Anton prompt: *"¿Cómo te inscribes en esta ruta?"*. Types name directly on a solid 2px ink baseline. | Gives entry the physical weight of signing an expedition ledger rather than submitting a web form. | *Verified Behavior:* Editorial sign-in sheets; *Interpretation:* Tactile baseline focus. | Anton typography + 2px ink line + zero chrome. | LOW | User expects a standard input box. | Input completion speed vs form perception. | **OPTIONAL:** Sits quietly on origin waypoint. |
| **S1-H02** | **The Traveler's Compass Tag** | Mineral badge docked at bottom-left stamping user name live; background shows a faint geometric horizon of Chapter 1. | Connects user identity immediately to spatial territory. | *Verified Behavior:* Game character tags (Elden Ring, Metroid); *Interpretation:* HUD badge. | Mineral surface (`#EBE5D6`) with 13px/3px asymmetric cut. | MEDIUM | Background outline might feel like decorative slop if disconnected from real DAG. | Visual distraction vs spatial grounding. | **OPTIONAL:** Positioned beside the badge. |
| **S1-H03** | **Poster-Scale Dynamic Header** | Keystrokes dynamically populate a giant Anton poster title: *"AQUÍ COMIENZA LA RUTA DE [NOMBRE]"*. Enter auto-advances. | High emotional punch; turns identity into a bold editorial manifesto. | *Verified Behavior:* Interactive editorial typography (Pitch, Stripe Press). | Anton display scale `clamp(2.5rem, 8vw, 4.5rem)` in pure Ink. | LOW | Long names may cause layout shift or text wrapping bugs. | Dynamic font scaling on 15+ character names. | **ABSENT:** Focus remains 100% on typography. |
| **S1-H04** | **Embedded Waypoint 01** | Name field rendered directly inside Node 01 of the proto-map graph. | Fuses identity and first waypoint into a single visual node. | *Interpretation:* Spatial canvas onboarding. | Uses React Flow node geometry. | HIGH | **Canonical violation:** Confuses user identity with progression state (Rule 4). | Node drag/zoom interference during typing. | **ESSENTIAL:** Stands inside the node. |
| **S1-H05** | **Field Notebook Cover** | Skeuomorphic notebook cover where user writes their name on an ink label before the book opens. | Nostalgic explorer feeling. | *Verified Behavior:* Moleskine Digital, Red Dead journal. | Ink label + Paper texture. | HIGH | **AI-Slop & Skeuomorphism:** Clashes with TRAZO modern editorial DNA. | Visual heaviness and slow transition. | **OPTIONAL:** Appears as cover emblem. |
| **S1-H06** | **Conversational Trazz Dialogue** | Trazz appears with a speech balloon: *"¡Hola! ¿Cómo te llamas para preparar tu mapa?"*. | Friendly, mascot-driven introduction. | *Verified Behavior:* Duolingo onboarding, Character.ai. | Trazz mascot asset. | MEDIUM | **Duolingo clone & Chatbot anti-pattern:** Violates `DESIGN.md` hard rules. | Irritation from verbose mascot text. | **ESSENTIAL (Negative):** Talks actively. |
| **S1-H07** | **Two-Beat Echo Acknowledgement** | Clean single input; upon typing, a deterministic Geist subtitle echoes below: *"Tu ruta se anclará a este nombre"*. Enter key advances. | Zero friction, zero ambiguity; immediate confirmation of consequence. | *Verified Behavior:* Minimalist CLI/form design (Linear, Vercel). | High-contrast Geist UI + subtle cobalt focus border. | LOW | Feels like a standard form if typography lacks contrast. | Time-to-advance and keyboard navigation flow. | **OPTIONAL:** Reacts with a single subtle blink. |
| **S1-H08** | **Spatial Split — Manifesto & Inscription** | Left 50% displays immutable course promise; right 50% holds the high-contrast single name field. | Contextualizes why identity matters before asking for it. | *Verified Behavior:* Substack reader onboarding, editorial split-screens. | Two-column asymmetric layout with paper-on-ink contrast. | LOW | Reduced readability on narrow mobile viewports. | Responsive stacking behavior below 768px. | **ABSENT:** Keeps scene austere and serious. |
| **S1-H09** | **Zero-Click Horizon Gaze** | Fullscreen ink canvas with glowing cobalt particles that coalesce around the name input. | Atmospheric, cinematic mood. | *Interpretation:* Sci-fi SaaS template. | Cobalt particle canvas. | HIGH | **AI-Slop Cliché:** Particle meshes and dark glowing gradients are explicitly banned. | GPU battery drain and visual noise. | **OPTIONAL:** Floats in particle field. |
| **S1-H10** | **Physical Seal Imprint** | Name input followed by an explicit "Estampar Identidad" button that animates a mechanical ink stamp. | Tactile satisfaction of sealing a document. | *Verified Behavior:* Notary stamps, game quest sign-offs. | Ink seal geometry with 3px border. | MEDIUM | Adds unnecessary friction for a basic text entry. | Bounce rate on multi-click submission. | **OPTIONAL:** Acts as the stamp applicator. |

---

## 4. Stage 2 — Role Choice (10 Hypotheses)

| ID | Concept | User Moment | Why It Could Work | Reference / Evidence | What Makes It TRAZO | Complexity | Risk | What To Test | Trazz Role |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **S2-H01** | **Dual Monolith Route Slabs** | Two massive vertical architectural cards (Ink & Paper) with action verbs: *"Recorrer la ruta"* (Alumno) vs *"Trazar el camino"* (Coach). | Gives the decision architectural gravity; frames roles as actions, not static labels. | *Verified Behavior:* The Verge split features, Stripe Atlas portal. | Anton headers + 13px/3px asymmetric card borders. | LOW | Equal visual weight might give too much prominence to Coach (minority role). | Click-through balance and selection clarity. | **ABSENT:** Keeps decision dignified and clean. |
| **S2-H02** | **Interactive SVG Junction Fork** | A visual branch diagram; hovering Left extends a cobalt learner path; hovering Right extends an amber/stone coach path. | Teaches the DAG mental model before entering the map. | *Verified Behavior:* Git branching visualizers, interactive flowcharts. | React Flow spline math (`smoothSplineThroughVia`). | MEDIUM | Hover-only interactions fail on mobile and accessibility screen-readers. | Keyboard focus + ARIA radio-group behavior. | **OPTIONAL:** Sits at the fork junction. |
| **S2-H03** | **Asymmetric Split / Learner-First** | Learner is the dominant card (80% visual mass); Coach is a quiet, architectural secondary link at the bottom. | Optimizes for the 90%+ majority while keeping coach access transparent. | *Verified Behavior:* MasterClass, Coursera role flows. | Asymmetric editorial layout; scarce Cobalt focus on Learner. | LOW | Coaches might feel demoted if link is too discreet. | Discoverability for genuine creators. | **OPTIONAL:** Positioned on the learner card. |
| **S2-H04** | **Trazz Waypoint Director** | Trazz stands at a physical signpost between the cards; turns his compass and eyes toward the hovered option. | Adds charming physical life without speaking words. | *Verified Behavior:* Finch companion reactions, Mario Kart character select. | Vector Trazz compass dial + eye tracking. | MEDIUM | **Character Overuse:** Hover listeners can feel gimmicky if overdone. | Mouse tracking performance on low-end devices. | **ESSENTIAL:** Acts as the physical pivot. |
| **S2-H05** | **Deliverable Outcome Cards** | Cards framed strictly by output: *"Demostrar habilidad con trabajo real"* vs *"Definir criterios y calibrar rúbricas"*. | Anchors choice in TRAZO's evaluation philosophy (`PROGRESSION_ARTIFACT_CONTRACT`). | *Verified Behavior:* Outcome-based SaaS pricing/onboarding. | Geist UI typography with crisp deliverable badges. | LOW | Copy may be slightly abstract for a first-time visitor. | Comprehension of "calibración" vs "entrega". | **ABSENT:** Focus is 100% on clear copy. |
| **S2-H06** | **Tactile Perspective Switcher** | A physical toggle switch at the top that switches the live preview between Learner Map and Coach Calibration View. | Lets users preview what each role actually does before committing. | *Verified Behavior:* Figma mode switches, Retool mode toggles. | Mineral toggle switch with mechanical offset shadow. | HIGH | High implementation cost (rendering two complex sub-views in setup). | Overwhelming cognitive load during onboarding. | **ABSENT:** Avoids interface bloat. |
| **S2-H07** | **Scenario Intent Matcher** | Two real-world 1-sentence statements: *"Tengo un proyecto real para validar paso a paso"* vs *"Creo metodologías para evaluar a otros"*. | Connects directly to user intent without technical jargon. | *Verified Behavior:* Typeform conversational logic, Quizlet setup. | Editorial quote layout with bold bullet nodes. | LOW | Text-heavy if translations or mobile wraps occur. | Reading time vs immediate click speed. | **ABSENT:** Keeps focus on intent. |
| **S2-H08** | **Gamified Role Pedestal** | 3D-style isometric pedestals representing "The Explorer" and "The Architect" with floating badges. | Video game character selection aesthetic. | *Verified Behavior:* RPG class selection screens. | Isometric 3D rendering. | HIGH | **Gamification Soup:** Trivializes professional education; violates design rules. | Extreme brand mismatch and slow asset loading. | **ESSENTIAL (Negative):** Dances on pedestal. |
| **S2-H09** | **Single-Path Learner Default** | The flow assumes Learner by default (*"Configurando tu recorrido..."*); provides a discreet header link: *"Acceso para Coaches"*. | Completely removes onboarding friction for 90% of users. | *Verified Behavior:* Notion, Duolingo single-track starts. | Clean single-card container with minimal header exit. | LOW | Accidental wrong role assignments for course creators. | Frequency of coaches switching back via profile. | **OPTIONAL:** Sits alongside the route preview. |
| **S2-H10** | **Interactive Quadrant Portals** | Two glowing portal cards on a dark canvas that zoom the camera into either universe. | Immersive, spatial entrance. | *Interpretation:* WebGL agency portfolio demo. | WebGL canvas with camera zoom-in. | HIGH | **AI-Slop & Excessive Motion:** Sci-fi portal trope completely alien to TRAZO. | Severe disorientation and performance lag. | **OPTIONAL:** Floats between portals. |

---

## 3. Stage 3 — Learner Questions (10 Hypotheses)

| ID | Concept | User Moment | Why It Could Work | Reference / Evidence | What Makes It TRAZO | Complexity | Risk | What To Test | Trazz Role |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **S3-H01** | **Single Consequential Branch Fork** | Exactly 1 question: choose the track/focus for Chapter 1 (derived directly from real DAG forks, e.g. *"Ruta A: Caso Rápido"* vs *"Ruta B: Proyecto Propio"*). | 100% actionable; persists `preferredRouteId`; zero dormant fields; zero fake personalization. | *Verified Behavior:* TRAZO current `LearnerQuickSetup.tsx` implementation. | Connects directly to `deriveCorridor()` in progression engine. | LOW | Only works if Chapter 1 actually contains a branch fork. | Selection speed and corridor satisfaction. | **OPTIONAL:** Points compass toward selection. |
| **S3-H02** | **Two-Beat Context: Stage + Track** | Q1: *"¿Tienes ya un proyecto en marcha?"* (Idea / Borrador / Avanzado); Q2: *"Elige el enfoque de tu primera entrega"*. | Provides initial scaffolding calibration while setting the corridor. | *Verified Behavior:* Astra AI onboarding, Reforge diagnostic setup. | Two sequential scenes with strict single-decision focus. | MEDIUM | Asking 2 questions increases drop-off if Q1 has no immediate consequence. | Completion rate vs 1-question flow. | **OPTIONAL:** Nods on Q1 completion. |
| **S3-H03** | **Pace & Intensity Dial** | 1 question asking desired pace: *"Modo Intenso (entrega directa)"* vs *"Modo Guiado (paso a paso)"*. | Gives users control over pacing and feedback depth. | *Verified Behavior:* Duolingo daily goal setting, Headspace pacing. | Tactile mineral slider with cobalt ticks. | MEDIUM | **Product-Semantic Invention:** TRAZO backend has no `pace` field (Rule 1 / Rule 6). | User expects automated scheduling that doesn't exist. | **ABSENT:** Avoids fake promises. |
| **S3-H04** | **Execution Dilemma Cards** | 1 question: *"¿Cómo aprendes mejor?"* Card 1: *"Construyo rápido y corrijo"* vs Card 2: *"Planifico a fondo antes de entregar"*. | Frames learning style as an active methodology preference. | *Verified Behavior:* Myers-Briggs/Quizlet persona questions. | High-contrast editorial dilemma cards. | LOW | **Fake Personalization:** Learning style quizzes are scientifically debunked and produce no graph consequence. | Frustration when no adaptation occurs. | **ABSENT:** Avoids quiz tropes. |
| **S3-H05** | **Visual Milestone Goal Picker** | Displays 3 real milestone nodes from the program and asks: *"¿Cuál es el hito que más te urge verificar?"*. | Gives the learner a clear visual north star in the territory. | *Verified Behavior:* Fitness app goal selection (Strava, Nike Run Club). | Renders actual milestone node titles and icons from DAG. | MEDIUM | Selecting a distant milestone might confuse prerequisite order. | Comprehension that prerequisites must still be completed. | **OPTIONAL:** Sits next to selected milestone. |
| **S3-H06** | **Initial Evidence Status Check** | 1 question: *"¿Qué material traes para tu primera misión?"* (Idea en mente / Notas y bocetos / Documento estructurado). | Calibrates what evidence prompt helper text to display in Mission 01. | *Verified Behavior:* Professional design critique intake forms. | Direct mapping to mission evidence input state. | LOW | Must not block entry if user brings nothing. | Effect on Mission 01 submission rate. | **OPTIONAL:** Settles into thinking pose. |
| **S3-H07** | **Uncertainty & Support Thermometer** | Visual slider measuring desired companion guidance from *"Autonomía alta"* to *"Orientación continua"*. | Manages user expectation of AI companion intervention frequency. | *Verified Behavior:* AI coding assistant autonomy sliders. | Custom vertical range input with cobalt fill. | MEDIUM | **Violates Build AI ≠ Product AI:** Promises prompt-level adjustments not in canonical runtime. | Disappointment if companion behavior remains standard. | **ABSENT:** Keeps companion deterministic. |
| **S3-H08** | **5-Question Diagnostic Assessment** | 5 short multiple-choice knowledge questions to calculate a starting score and place user on map. | Ensures proper skill placement. | *Verified Behavior:* Duolingo placement test, Khan Academy pre-test. | Quiz interface with progress bar. | HIGH | **Severe Friction & Rule 5 Violation:** Takes 8+ minutes; passes non-evidence answers; destroys entry momentum. | Massive drop-off (>40%) during onboarding. | **OPTIONAL:** Acts as exam proctor. |
| **S3-H09** | **Single-Tap Route Choice + Instant Skip** | Single route branch selector with a prominent secondary button: *"Decidiré dentro del mapa"*. | Guarantees user agency; prevents setup abandonment if user is undecided. | *Verified Behavior:* Figma template picker ("Start from scratch"). | Asymmetric button pair with clear primary/secondary hierarchy. | LOW | Many users might skip, leading to default corridor selection. | Skip rate vs active selection rate. | **OPTIONAL:** Observes quietly. |
| **S3-H10** | **Mad-Libs Goal Statement Builder** | Interactive sentence with inline dropdowns: *"Vengo a TRAZO para validar mi [Producto/Estrategia] en [2 semanas/1 mes]"*. | Engaging, playful syntax construction. | *Verified Behavior:* Notion template onboarding, Substack goals. | Inline select inputs within Anton display typography. | MEDIUM | **Generic SaaS pattern:** Low parsing utility for backend; feels gimmicky for serious professionals. | Completion friction on mobile virtual keyboards. | **ABSENT:** Keeps copy dignified. |

---

## 4. Stage 4 — Map Generation + World Entry (10 Hypotheses)

| ID | Concept | User Moment | Why It Could Work | Reference / Evidence | What Makes It TRAZO | Complexity | Risk | What To Test | Trazz Role |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **S4-H01** | **Blueprint Inscription (Wide → Corridor → Focus)** | Camera starts in wide view of Chapter 1 territory; active corridor illuminates in Cobalt; camera smoothly zooms into Mission 01; cue appears: *"Aquí comienza todo"*. | Establishes spatial mental map of whole world before zeroing in on immediate action. | *Verified Behavior:* Game map reveals (Civilization, Elden Ring map fragments). | Native React Flow `fitView` to `setCenter` coordinates. | MEDIUM | Zoom animation may trigger motion discomfort if duration > 1.2s. | Camera timing (target: 700ms smooth cubic-bezier). | **ESSENTIAL:** Stands waiting at Mission 01. |
| **S4-H02** | **Origin Ignition (Local → Branch Expansion → Recenter)** | Camera starts tightly centered on Mission 01; surrounding branches draw outward for 1.5s; camera returns to Mission 01. | Keeps initial focus narrow, then provides quick reassurance of broader territory. | *Verified Behavior:* Metroidvania mini-map reveals. | Dynamic edge stroke-dashoffset animation. | HIGH | **Disorientation risk:** Expanding outward then snapping back causes visual whiplash. | Mental map retention and nausea reports. | **OPTIONAL:** Travels outward with edges. |
| **S4-H03** | **Trazz the Traveling Cartographer** | Trazz physically travels along the SVG spline from Origin to Mission 01, unrolling the cobalt line behind him like tape. | Charming physical choreography; turns edge drawing into a narrative journey. | *Verified Behavior:* Mario World map transitions, Finch travel animations. | SVG path interpolation via `useCompanionTraveler`. | HIGH | **Character Overuse & Delay:** Takes 3+ seconds to watch mascot walk before user can interact. | Time-to-first-click frustration. | **ESSENTIAL:** Protagonist of the animation. |
| **S4-H04** | **Topographic Layer Materialization** | Territory regions render faintly (0.4s), structural edges draw smoothly (0.8s), nodes stamp into place (1.2s); camera settles on Mission 01. | Mimics the physical creation of a cartographic map; highly systematic, zero gimmicks. | *Verified Behavior:* Architectural CAD layer unrolling, cartography software. | CSS staggered animations (`--entry-delay`) on React Flow nodes. | MEDIUM | Staggered delays must not block keyboard focus if user wants immediate control. | Frame rate during simultaneous SVG renders. | **OPTIONAL:** Materializes alongside Node 01. |
| **S4-H05** | **The Two-Breath Cinematic** | Breath 1: Tight focus on Mission 01. Breath 2: Pulls back wide to show all branches. Breath 3: Returns to Mission 01 and enables controls. | Highly cinematic, dramatic sense of scale. | *Verified Behavior:* AAA video game cutscene-to-gameplay handoffs (Zelda TotK). | Multi-stage React Flow camera panning sequence. | HIGH | **Excessive Motion:** Multiple camera pans in 6 seconds feel like a forced video rather than software. | User drop-off and skip button spamming. | **ABSENT:** Camera is the protagonist. |
| **S4-H06** | **Particle Ink Forge (Generative AI simulation)** | Glowing particles swirl over a dark canvas with a progress bar: *"Generando tu ruta con IA..."* before snapping into a map. | Visual spectacle simulating real-time generation. | *Interpretation:* SaaS marketing templates 2023. | Canvas WebGL particle simulation. | HIGH | **Flagrant AI-Slop:** Fakes AI generation; purple glowing particles; completely violates Rule 1 & Rule 2. | Immediate loss of product trust and severe GPU lag. | **ABSENT:** Banned from this concept. |
| **S4-H07** | **Focal Corridor Beam** | Chosen corridor renders in crisp Cobalt while alternative branches appear as faint stone ghost paths; camera glides directly to Mission 01. | Extreme visual clarity; highlights the chosen path without hiding the rest of the world. | *Verified Behavior:* FTB Quests progression trees, pathfinding visualizers. | Edge data-tier styling (`data-corridor`, `data-dimmed`). | LOW | Ghost paths must have sufficient APCA contrast to remain legible. | Contrast ratios on calibrated displays. | **OPTIONAL:** Sits on the active corridor node. |
| **S4-H08** | **Train Station Tracking Shot** | Camera pans horizontally across Nodes 03, 02, 01 in reverse sequence like a train arriving at a station, stopping firmly at Node 01. | Novel visual arrival metaphor. | *Verified Behavior:* Side-scrolling adventure game introductions. | Horizontal `setViewport` panning. | MEDIUM | **DAG Semantics Inversion:** Panning backwards along a directed graph confuses the progression direction. | User directional orientation. | **ABSENT:** Avoids confusing directionality. |
| **S4-H09** | **Tactile Stamp Sequence** | Nodes drop into the canvas with subtle mechanical sound/haptic bounce; prompt appears: *"Aquí comienza todo"*; control handed over. | Delightful physical tactile feedback; grounds digital nodes in physical weight. | *Verified Behavior:* Nintendo Switch UI audio-haptic cues, Panic Playdate. | CSS spring physics on node drop + web audio micro-click. | MEDIUM | Mechanical sound must be muted by default or respect system volume. | Accessibility of non-visual state cues. | **OPTIONAL:** Lands gently on the node. |
| **S4-H10** | **Zero-Motion Instant Anchor** | Entire map renders instantly at 100%; camera centers on Mission 01 without animation; pulsating cobalt halo indicates first action. | Instantaneous, high-efficiency, fully accessible; zero motion sickness. | *Verified Behavior:* Linear app view loads, high-density professional dashboards. | Static viewport fit + CSS pulsating halo on Node 01. | LOW | May lack emotional ceremony for new users seeking a transition feeling. | Emotional satisfaction vs efficiency preference. | **OPTIONAL:** Sits static with attention halo. |

---

## 5. Muse Red Team Audit Summary

We submitted all 40 hypotheses to an adversarial evaluation executed by **Muse Spark 1.2 Contributor Free** via OpenCode Zen CLI. Muse evaluated every concept against 15 strict slop, friction, and identity vectors.

### 5.1 Key Findings & Verdict Distribution
- **Total KEEP:** 14 hypotheses
- **Total KEEP_WITH_REPAIR:** 6 hypotheses
- **Total WEAK:** 8 hypotheses
- **Total KILL:** 12 hypotheses

### 5.2 Why Concepts Were Killed
1. **AI-Slop & Generative Theater (S4-H06, S1-H09, S2-H10):** Swirling particle storms, glowing sci-fi portals, and fake *"Generando tu mapa con IA..."* progress bars were flagged as anti-patterns that destroy credibility and drain GPU resources.
2. **Duolingo Imitation & Gamification Soup (S2-H08, S1-H06, S3-H08):** 3D pedestals, over-narrating chatbot mascots, and 5-question placement quizzes were eliminated for infantilizing professional mastery and adding unacceptable conversion friction.
3. **Product-Semantic Invention (S3-H03, S3-H04, S3-H07):** Quizzes promising "learning styles", "intensity dials", or "companion autonomy levels" were killed because no such fields exist in TRAZO's backend or evaluation contracts.

---

## 6. Finalists Selection (Top 3 per Stage)

Following the Red Team audit and AGY synthesis, here are the 12 selected finalists across the four stages:

### 6.1 Stage 1 — Name / Identity Entry

#### Finalist 1 (Top 1): S1-H01 — Cartographic Ledger Inscription
- **Why It Survived:** Combines massive Anton editorial presence with a single 2px ink baseline. Zero SaaS wizard chrome. High dignity.
- **What We Would Actually Build:** An austere full-height Ink/Paper layout with Anton headline *"¿Cómo te inscribes en esta ruta?"*, auto-focused input field, and Enter-to-advance trigger.
- **What We Would Not Build:** No audio synthesizer, no skeuomorphic paper textures, no multi-field forms.
- **Visual / Motion Character:** Flat 2px ink line, 200ms subtle focus expansion, zero layout shift.
- **Trazz Role:** **OPTIONAL** — Sits quietly at the bottom-left origin waypoint; blinks subtly upon typing.
- **Implementation Difficulty:** LOW (CSS + existing React input).
- **Primary Risk:** May feel too minimal if typography is not scaled boldly.

#### Finalist 2 (Top 2): S1-H08 — Spatial Split (Manifesto & Inscription)
- **Why It Survived:** Places the immutable course mission statement on the left, anchoring *why* the user is here before asking for their name on the right.
- **What We Would Actually Build:** A 50/50 desktop split (stacked on mobile) with paper-on-ink contrast, displaying the course promise and a large name field.
- **What We Would Not Build:** No decorative illustrations, no carousel of testimonials.
- **Visual / Motion Character:** Static editorial columns; crisp 150ms focus ring on input.
- **Trazz Role:** **ABSENT** — Keeps the scene focused purely on editorial promise and identity.
- **Implementation Difficulty:** LOW.
- **Primary Risk:** Requires graceful vertical stacking on screens narrower than 768px.

#### Finalist 3 (Top 3): S1-H07 — Two-Beat Echo Acknowledgement
- **Why It Survived:** Absolute minimum friction. Typing the name produces an immediate, deterministic sub-label confirming route anchoring.
- **What We Would Actually Build:** Single input field that reveals a muted Geist subtitle *"Tu ruta y entregas se anclarán a este nombre"* upon first keystroke.
- **What We Would Not Build:** No modal dialogues, no character balloons.
- **Visual / Motion Character:** 120ms fade-in for the confirmation subtitle.
- **Trazz Role:** **OPTIONAL** — Small vector avatar in the corner that turns gaze forward on input.
- **Implementation Difficulty:** LOW.
- **Primary Risk:** Lacks the grandeur of S1-H01 if treated as standard HTML form.

---

### 6.2 Stage 2 — Role Choice

#### Finalist 1 (Top 1): S2-H01 — Dual Monolith Route Slabs
- **Why It Survived:** Solves role selection without looking like a pricing tier. Two massive vertical monoliths with tangible action verbs (*"Recorrer la ruta"* vs *"Trazar el camino"*).
- **What We Would Actually Build:** Two full-height tactile cards using TRAZO's signature 13px/3px asymmetric borders, hover elevation, and keyboard navigation.
- **What We Would Not Build:** No feature comparison checklists, no pricing badges, no 3D icons.
- **Visual / Motion Character:** 180ms cubic-bezier lift on hover/focus; Cobalt border highlight on selection.
- **Trazz Role:** **ABSENT** — The decision is serious and architectural.
- **Implementation Difficulty:** LOW.
- **Primary Risk:** Must ensure clear hierarchy so first-time learners intuitively select the left card.

#### Finalist 2 (Top 2): S2-H03 — Asymmetric Split (Learner-First Prominence)
- **Why It Survived:** Acknowledges real product analytics (90%+ of entries are learners). Gives 80% visual mass to Learner, with Coach as a clean secondary pathway.
- **What We Would Actually Build:** A primary wide card for Learner with direct start action, and a discreet, elegant header/footer link for Course Coaches.
- **What We Would Not Build:** No hidden dropdowns; no forced modal for coaches.
- **Visual / Motion Character:** Grounded, high-contrast single focus.
- **Trazz Role:** **OPTIONAL** — Sits on the Learner card edge.
- **Implementation Difficulty:** LOW.
- **Primary Risk:** Creators might overlook coach access if the secondary link is too subtle.

#### Finalist 3 (Top 3): S2-H05 — Deliverable Outcome Cards
- **Why It Survived:** Bypasses abstract role titles in favor of tangible outcomes (*"Demostrar habilidad con trabajo real"* vs *"Definir criterios y calibrar rúbricas"*).
- **What We Would Actually Build:** Two symmetric choice cards displaying the exact primary deliverable type associated with each path.
- **What We Would Not Build:** No generic icons or stock illustrations.
- **Visual / Motion Character:** Crisp typography with subtle mineral surface offsets.
- **Trazz Role:** **ABSENT**.
- **Implementation Difficulty:** LOW.
- **Primary Risk:** Slightly more text to read than S2-H01.

---

### 6.3 Stage 3 — Learner Questions

#### Finalist 1 (Top 1): S3-H01 — Single Consequential Branch Fork
- **Why It Survived:** 100% grounded in real codebase capability (`LearnerQuickSetup.tsx`). If Chapter 1 has a fork, user selects their corridor; if linear, screen is bypassed. Zero dormant state.
- **What We Would Actually Build:** Single-question screen displaying the 2 real branch options derived from Chapter 1's DAG, with live corridor highlight preview.
- **What We Would Not Build:** No personality questions, no fake scheduling sliders.
- **Visual / Motion Character:** 2 large radio cards with Cobalt selection dot and live preview banner.
- **Trazz Role:** **OPTIONAL** — Sits on the preview banner indicating *"Ruta seleccionada"*.
- **Implementation Difficulty:** LOW (already modeled in repo).
- **Primary Risk:** If a course has no branch in Chapter 1, this step must automatically skip to map entry without displaying an empty state.

#### Finalist 2 (Top 2): S3-H09 — Single-Tap Route Choice + Instant Skip
- **Why It Survived:** Pairs the branch choice with an explicit *"Decidiré dentro del mapa"* button, completely eliminating onboarding drop-off for undecided users.
- **What We Would Actually Build:** S3-H01 layout augmented with a secondary button that applies the default branch and immediately advances.
- **What We Would Not Build:** No multi-step confirmation modals.
- **Visual / Motion Character:** Primary Cobalt action vs Secondary underline text.
- **Trazz Role:** **OPTIONAL**.
- **Implementation Difficulty:** LOW.
- **Primary Risk:** High skip rates if the secondary button is over-emphasized.

#### Finalist 3 (Top 3): S3-H06 — Initial Evidence Status Check
- **Why It Survived:** Asks a high-information question (*"¿Qué material traes hoy?"*: Idea / Borrador / Proyecto avanzado) that directly conditions the helper prompt in Mission 01.
- **What We Would Actually Build:** 3 simple tactile pills that persist an initial context tag for the first mission panel.
- **What We Would Not Build:** No file uploaders during onboarding; no mandatory text entry.
- **Visual / Motion Character:** 3 horizontal mineral pill buttons with tactile 2px pressed states.
- **Trazz Role:** **OPTIONAL** — Adopts `thinking` state when an option is tapped.
- **Implementation Difficulty:** MEDIUM (requires passing context tag to `MissionPanel`).
- **Primary Risk:** Must never block progression if the user has no initial material.

---

### 6.4 Stage 4 — Map Generation + World Entry

#### Finalist 1 (Top 1): S4-H04 — Topographic Layer Materialization
- **Why It Survived:** The most cartographically authentic reveal. Renders territory regions first (0.4s), draws SVG edges (0.8s), stamps nodes into place (1.2s), then zooms into Mission 01.
- **What We Would Actually Build:** CSS staggered keyframes on React Flow nodes using `--entry-delay`, followed by a smooth `setCenter` camera focus on Mission 01.
- **What We Would Not Build:** No WebGL shaders, no canvas particles, no fake AI loaders.
- **Visual / Motion Character:** Crisp 1.2s total choreography; staggered node opacity/scale drops (90ms per node); smooth 600ms camera glide.
- **Trazz Role:** **ESSENTIAL** — Appears stationed on Mission 01 waypoint at the end of the camera glide, displaying the cue *"Aquí comienza todo"*.
- **Implementation Difficulty:** MEDIUM (uses existing React Flow hooks and CSS variables).
- **Primary Risk:** Must strictly disable all timers and complete immediately when `prefers-reduced-motion` is active.

#### Finalist 2 (Top 2): S4-H01 — Blueprint Inscription (Wide → Corridor → Focus)
- **Why It Survived:** Teaches the macroscopic shape of the world before narrowing attention to the first actionable step.
- **What We Would Actually Build:** React Flow mounts in `fitView` showing all Chapter 1 territories; active corridor flashes Cobalt; camera glides to Mission 01.
- **What We Would Not Build:** No full-screen spinning overlays.
- **Visual / Motion Character:** 1.5s total duration; single smooth camera zoom transition.
- **Trazz Role:** **ESSENTIAL** — Sits on the target node.
- **Implementation Difficulty:** LOW (pure React Flow camera choreography).
- **Primary Risk:** Camera duration must not exceed 800ms to avoid feeling sluggish.

#### Finalist 3 (Top 3): S4-H07 / S4-H10 — Focal Corridor Beam + Instant Reduced-Motion Anchor
- **Why It Survived:** Provides the cleanest contrast hierarchy (active corridor in Cobalt, secondary branches in ghost Stone) and serves as the authoritative zero-motion fallback.
- **What We Would Actually Build:** High-contrast edge tiering (`data-corridor`, `data-dimmed`) with instant node rendering and an accessible pulsating cobalt focus ring on Node 01.
- **What We Would Not Build:** No camera movement when reduced motion is requested.
- **Visual / Motion Character:** Static high-contrast map with subtle 2.4s pulse on active node.
- **Trazz Role:** **OPTIONAL** — Static on Node 01.
- **Implementation Difficulty:** LOW.
- **Primary Risk:** Low novelty for users who desire cinematic transitions.

---

## 7. Recommended End-to-End Sequence

Here is the unified, recommended moment-by-moment flow for TRAZO Visual V2:

### Moment-by-Moment Choreography

1. **Beat 1 — The Inscription (Identity):**
   - User enters on an Ink canvas. Anton display headline: *"¿Cómo te inscribes en esta ruta?"*.
   - A single clean 2px ink line with auto-focus.
   - Keystroke confirms name in real-time. Hitting `Enter` saves to `/api/v1/profiles` and triggers a crisp 200ms wipe.

2. **Beat 2 — The Architectural Choice (Role):**
   - Two vertical monolith cards emerge in Paper surfaces:
     - Left: *"Recorrer la ruta (Alumno)"* — *Ejecuta misiones y demuestra competencia con trabajo real.*
     - Right: *"Trazar el camino (Coach)"* — *Define criterios, diseña rutas y calibra la evaluación.*
   - Clicking Learner immediately transitions forward.

3. **Beat 3 — The Branch Focus (Learner Question):**
   - Evaluates Chapter 1 DAG. If branching exists, presents the two concrete corridor alternatives (e.g. *"Ruta de Caso Práctico"* vs *"Ruta de Proyecto Propio"*).
   - Includes a discreet *"Decidiré dentro del mapa"* button.
   - Selecting a card highlights the corridor preview. Clicking *"Comenzar mi recorrido →"* saves `preferredRouteId`.
   - *(If the chapter is linear, this step is seamlessly bypassed).*

4. **Beat 4 — Topographic Materialization (Flagship Reveal):**
   - The React Flow viewport initializes with `fitView` at 100% canvas.
   - **0.0s – 0.4s:** Faint territory region backgrounds fade in at 40% opacity.
   - **0.4s – 0.8s:** The structural SVG route splines draw progressively in Stone and Cobalt.
   - **0.8s – 1.2s:** Quest nodes stamp into place with a subtle 90ms stagger and tactile 2px drop.
   - **1.2s – 1.8s:** Camera smoothly pans and zooms (`setCenter`, 600ms cubic-bezier) to frame Mission 01.
   - **1.8s – 2.5s:** Trazz settles onto the Mission 01 waypoint. A contextual Geist cue appears: *"Aquí comienza todo · [Título de Misión 01]"*.
   - **2.5s:** Introduce subtle breathing pull-back (zoom 0.94 → 0.86) to reveal immediate connected branch nodes, then instantly hand over full pan/zoom/click control to the learner.

5. **Reduced-Motion Fallback:**
   - If `prefers-reduced-motion` is detected, all timers, camera glides, and staggers are set to `0ms`. The map renders instantly centered on Mission 01 with a pulsating Cobalt focus ring.

---

## 8. What NOT to Build (Anti-Slop Boundaries)

To protect TRAZO's brand and architecture, the following patterns are strictly banned:

- ❌ **No AI-Generation Theater:** Banned purple/blue particle storms, glowing sci-fi grids, and fake *"Generando mapa con IA..."* progress bars.
- ❌ **No Chatbot Floating Windows:** Trazz must not be turned into an annoying modal chatbot interrupting the user.
- ❌ **No Skeuomorphic Kitsch:** Banned leather notebooks, wax seals, compass animations, and aged parchment textures.
- ❌ **No Debunked Personality Quizzes:** Banned 5-question learning style surveys, pace sliders, and fake diagnostic scores.
- ❌ **No Disorienting Camera Gymnastics:** Banned multi-stage camera zooms, continuous snapping back and forth, and reverse tracking shots.
- ❌ **No State Authority Violations:** Identity and onboarding answers must never fabricate progress states, fake badges, or bypass mission prerequisites.

---

## 9. Next Prototype Recommendation

1. **Step 1:** Implement the **S1-H01** Inscription and **S2-H01** Monolith cards within the existing `ProductRouteFrame` architecture.
2. **Step 2:** Refine `QuestMap.tsx`'s existing `MapEntryPhase` to follow the exact **S4-H04** 4-beat materialization timeline (bounds → edges → nodes → focus).
3. **Step 3:** Conduct usability timing tests with 5 users to verify that the total world reveal duration remains strictly under **2.5 seconds** before full control handoff.

---

```
TRAZO_WORLD_ENTRY_RESEARCH_READY
```
