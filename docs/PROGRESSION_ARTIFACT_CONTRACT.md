# TRAZO PROGRESSION & ARTIFACT CONTRACT

## 1. Purpose & Scope

This contract defines the canonical lifecycle of verified deliverables (artifacts) across the TRAZO mission directed acyclic graph (DAG). It prevents state corruption, parallel artifact stores, and unauthorized progression mutations.

## 2. Canonical Artifact vs. Raw Submission

- **Raw Submission / Evidence:** Ephemeral learner input (e.g. text draft or URL) submitted for mission evaluation. It may contain partial, unverified, or non-compliant content.
- **Canonical Artifact (`ImplementationArtifact<T>`):** A structured, immutable payload generated and persisted exclusively upon a deterministic `PASS` verdict. Downstream missions consume canonical artifacts as verified ground truth.

```typescript
export interface ImplementationArtifact<T = unknown> {
  key: string
  sourceMissionId: string
  value: T
  createdAt: string
  updatedAt: string
}
```

## 3. Authoritative Lifecycle & Mutation Boundary

1. **Sole Authoritative Creator:** [`src/server/service.ts`](../src/server/service.ts) (`ImplementationService`) is the sole domain authority permitted to create canonical artifacts.
2. **Strict PASS Prerequisite:** Canonical artifacts are produced **only** when `interactionType === 'EVIDENCE_SUBMISSION'` AND `policyVerdict === 'PASS'`.
3. **Idempotency & Immutability:** Once a canonical artifact is created for a mission key, subsequent submissions or conversations on that completed mission preserve the existing canonical artifact without overwriting it.
4. **Zero Mutation on Non-PASS:** Verdicts of `REWORK`, `CLARIFY`, `HUMAN_REVIEW`, `AMBIGUOUS`, or system/provider errors may record interaction history, but **must never** create or mutate canonical artifacts.

## 4. Downstream Artifact Consumption

1. **Explicit Declaration:** Missions declare artifact dependencies via `consumesArtifacts: string[]` in [`src/data/course.ts`](../src/data/course.ts).
2. **Context Injection:** When a learner acts on a mission, `ImplementationService` resolves required upstream artifacts from `ImplementationState.artifacts` and injects them into the evaluation context.
3. **Fail-Closed Verification:** If any declared artifact in `consumesArtifacts` is missing from the learner's state, `ImplementationService` fails closed and rejects evaluation before invoking the LLM interpreter.

## 5. Prohibited Practices

- ❌ **No Client-Side Synthesis:** The frontend (`@xyflow/react` canvas, popovers, forms) must never synthesize or persist canonical artifacts.
- ❌ **No Ad-Hoc Secondary Stores:** Artifacts live exclusively inside `ImplementationState.artifacts` in the authoritative repository (Cloud Firestore / Memory). No `localStorage` caching or uncontracted Firestore subcollections may act as a source of truth.
- ❌ **No Unverified Downstream Chaining:** A mission cannot consume an artifact unless that artifact was produced by an upstream ancestor mission verified through deterministic policy.
