# TRAZO visual grammar — landing → product

Status: implementation brief for the hackathon-critical product path.

The landing remains the visual source of truth. This brief translates its grammar into product density without coupling repositories or changing domain behavior.

## Transfer rules

### Editorial hierarchy

**Landing pattern:** Anton carries one dominant idea per section; Geist carries explanation and controls.  
**Why it feels like TRAZO:** the page reads like an editorial route, not a SaaS dashboard.  
**Current product gap:** some operational surfaces have the right font but weak focal hierarchy.  
**Product application:** reserve Anton for chapter, mission, profile-journey and consequential-state titles; keep forms, metadata and controls in Geist.

### Ink as semantic mass

**Landing pattern:** the current step is an ink object, not a neutral card with a colored ring.  
**Why it feels like TRAZO:** importance gains physical weight.  
**Current product gap:** the authoritative active mission is still rendered as merely available.  
**Product application:** map the backend active mission to the visual `active` state; use ink fill, paper icon and cobalt core while selection stays an external ring.

### Cobalt as a scarce signal

**Landing pattern:** cobalt marks route, action and consequential progress.  
**Why it feels like TRAZO:** the accent retains meaning.  
**Current product gap:** cobalt appears as persistent header chrome and generic selection emphasis.  
**Product application:** reserve cobalt for CTA, traveled/immediate route, active core, focus and verified consequence.

### Verification is not selection

**Landing pattern:** verified work uses a pale periwinkle surface, cobalt frame/check and restrained consequence shadow.  
**Why it feels like TRAZO:** verification reads as a resolved product event.  
**Current product gap:** completed nodes are mostly solid cobalt and profile selection borrows a similar ring.  
**Product application:** completed/verified receives the periwinkle treatment; selected remains ink containment plus a separate cobalt focus cue.

### Route before card

**Landing pattern:** curves, waypoints and changing line styles explain sequence.  
**Why it feels like TRAZO:** progression is spatial rather than a stack of tasks.  
**Current product gap:** future edges and territory contours are too faint at normal zoom.  
**Product application:** strengthen dependency paths, preserve curved branching, and differentiate traveled, immediate and future routes through weight plus dash pattern.

### Paper, ink and physicality

**Landing pattern:** opaque paper surfaces, visible ink frames and compact depth create tactile objects.  
**Why it feels like TRAZO:** the interface feels handled, not glassy or floating.  
**Current product gap:** onboarding and creator surfaces use repeated neutral containers with low structural contrast.  
**Product application:** use ink rules, asymmetric corners and controlled offset depth only on focal task objects.

### Controlled asymmetry

**Landing pattern:** offset cards and staggered route stages create rhythm without losing scanability.  
**Why it feels like TRAZO:** the composition avoids dashboard uniformity.  
**Current product gap:** profile selection is a conventional vertical radio list.  
**Product application:** turn profiles into saved-route entries connected by a visible track; the active profile gains position and ink mass, not the verified effect.

### Micro-labels explain state

**Landing pattern:** short uppercase labels introduce a real role such as action, validation or next step.  
**Why it feels like TRAZO:** labels orient rather than decorate.  
**Current product gap:** several labels name containers rather than consequences.  
**Product application:** use labels for current, evidence, verification and unlock; remove ornamental micro-label behavior.

### Motion follows consequence

**Landing pattern:** routes trace, nodes activate and verified work resolves.  
**Why it feels like TRAZO:** motion explains change.  
**Current product gap:** active-state motion cannot run because active state is not represented on the node.  
**Product application:** animate only route activation, active entry, panel entrance and verified resolution; honor reduced motion.

## Product audit priorities

### P0

- Main map: authoritative active state is visually absent; future dependencies are too faint; profile controls collide with the HUD.
- Mission/verified action: action, evidence, verification and unlock need an explicit visual sequence; verified styling must be unique.

### P1

- Profile selection: functional but visually equivalent to a generic list of selectable cards.
- Companion: belongs on the route but its open state currently reads as an empty floating utility.
- Creator calibration: correct editorial heading, but task sections need clearer ink structure and state hierarchy.
- Learner setup: repeated radio cards need a stronger route/progression spine.

### P2

- Loading and error surfaces retain some inline styles and generic centered-card composition.
- Far-zoom labels and territory decoration need final polish after the demo-critical path.

## Implementation boundary

- Presentation may derive an active visual state from `ImplementationState.activeMissionId`.
- Domain progression, evaluation policy, artifacts, persistence, identity roles and AI runtime remain unchanged.
- No source, dependency or generated file in the landing repository may be modified.
