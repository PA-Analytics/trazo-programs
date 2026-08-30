# TRAZO Visual V2 — Entry Flow

Status: ready for implementation review  
Scope: entry experience only  
Last reviewed: 2026-08-29

## Purpose

This record defines the Visual V2 migration for the first-run and return experience. It keeps the existing identity, progression, methodology, evaluation and persistence contracts authoritative while bringing entry screens into the same product family as the saved-route portal.

The work is intentionally page-by-page. The return portal is the visual source of truth; it is not being replaced by a new onboarding shell.

## Frozen visual principles

- Ink is the environmental mass for return, navigation and entry decisions.
- Paper/mineral surfaces are reserved for focused work, selected choices and readable content.
- Cobalt is a scarce signal for current action, selection, route and verified state.
- Anton carries identity and consequential headings; Geist carries controls, labels and body copy.
- Structural borders, flat offsets and asymmetric corners carry the material language. Gradients, glow, glass, ambient dashboards and decorative map elements are out of scope.
- A scene has one dominant decision. Real controls stay large, focusable and understandable without color alone.
- Any companion slot remains optional and semantically empty until the production Trazz asset is available.

## Entry sequence

1. Return / login / saved-route portal.
2. Name / identity entry.
3. Role decision: coach or learner.
4. Branch into the existing learner or coach flow.

The first page, implemented by `ProfileSelection` and `ProfileReturnRoute`, remains mostly frozen. New screens reuse its grammar rather than copying its exact two-column composition or artwork.

## Learner branch

The current backend supports one consequential first-run learner choice: `preferredRouteId`. `LearnerQuickSetup` derives the real branch options from the first chapter and sends only that canonical ID to the existing learner-setup endpoint.

The learner experience therefore uses one meaningful question, large route choices, an explicit selected state and a single continue action. It does not ask for dormant fields such as goal or available time merely to create a longer onboarding form.

After the choice is persisted, `LearnerRouteReady` marks the boundary between setup and the map. The map then reveals the existing territory, edges and nodes in sequence:

1. faint world structure;
2. the selected corridor;
3. actual nodes in deterministic order;
4. focus on the first actionable mission;
5. a short outward reveal of branches;
6. return to that first mission and hand over control.

This sequence runs on the existing `QuestMap` / React Flow viewport. It is a presentation of persisted graph structure, not a loading simulation or a new map renderer. It lasts approximately 6.25 seconds, can be skipped, and completes immediately for `prefers-reduced-motion`.

## Coach branch

The coach does not receive the learner route questionnaire. The current honest coach flow is a four-scene setup:

1. transformation context / result;
2. evidence types;
3. source of examples for calibration;
4. judgment boundary before entering `CreatorCalibrationView`.

These scenes write only the fields already supported by `UserProfile.coachSetup`. They do not imply course importing, graph authoring, learner rosters or a coach dashboard that the repository does not currently provide.

## First-map cinematic

The entry choreography uses focus → reveal world → return to focus. The first actionable mission is identified from the real `progress` map, not from a fabricated recommendation. During the focused beat, the interface presents the concise contextual cue “Aquí comienza todo.” alongside the mission title already present in the methodology.

The learner can skip the sequence at any time. Camera motion uses `fitView` and `setCenter` on the current React Flow instance; no rotation, teleporting, black bars, particle effects or fake AI-generation state is introduced.

## Trazz integration hooks

- `TrazzSlot` remains a clean, non-authoritative placement hook on identity, role and coach entry scenes.
- The entry experience is complete without a mascot asset.
- The existing map companion remains responsible for current map interactions; this migration does not introduce a new mascot animation system.
- Future Trazz states can occupy the identity, role, onboarding and first-map waypoints once the isolated production asset is available.

## Deferred work

- Replace route slots with the approved isolated Trazz asset when delivered.
- Validate the 5–8 second timing with real learners and shorten it if it delays first action.
- Consider a second learner question only if a new field has a verified downstream consequence.
- Build coach authoring, methodology selection and learner-management surfaces only after their backend/product contracts exist.
- Run live-provider and production verification separately; local browser checks do not establish Firestore, Vertex or Cloud Run verification.

## Acceptance gate

A page belongs to Visual V2 when it preserves the saved-route portal’s material language, presents one dominant decision, exposes a real next action, keeps focus and narrow layouts usable, and does not invent learner state, route IDs, metrics, recommendations or AI theater.
