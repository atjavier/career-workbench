---
baseline_commit: c285895
---

# Story 9.5: Preserve Clarified Resume Evidence

Status: done

## Story

As Adrian, I want my Coach Resume answers to become traceable evidence for the relevant Project or Experience, so that the final resume can use my clarified context without mistaking it for a model guess.

## Acceptance Criteria

1. Accepted answers persist the exact answer, task, category, workspace, item identity, timestamp, and explicit candidate-provided provenance as workspace-owned local data.
2. Clarified purpose, workflow, ownership, contribution, collaboration, outcome, metric, deployment, or date can later support a claim alongside its original documented evidence, without replacing the original evidence.
3. A direct conflict between an accepted answer and documented evidence is surfaced for review; neither value silently wins or becomes an eligible claim without review.
4. Metrics and outcomes remain candidate-provided context verbatim. The system never calculate, strengthen, or infer a larger claim from them.
5. A skipped task remains an explicit unknown and never produces clarified evidence or a substitute claim.
6. Newly planned tasks leave prior answers attached only to their original item; they cannot support a different item or workspace.
7. Deleting a workspace cascade-removes clarified evidence and its links while retaining only the existing metadata-only deletion audit history.

## Tasks / Subtasks

- [x] Add a forward-only clarified-evidence schema (AC: 1, 5, 7)
  - [x] Store immutable candidate-provided answer records derived only from answered task responses, with task/item/workspace identity, bounded verbatim text, and a clear provenance label.
  - [x] Store workspace-owned links from clarification evidence to its documented-item context; cascade every payload row from the workspace and never put answer text in an audit event.
- [x] Build deterministic clarification-evidence promotion and conflict detection (AC: 2-6)
  - [x] Promote only an accepted `answered` task response inside the same transaction that completes its task; skipped responses create no claim-ready evidence.
  - [x] Read candidates through workspace, item-key, task, and response joins; never let a response support another workspace or item.
  - [x] Preserve documented facts and candidate clarification separately; record only conservative direct conflicts for review instead of overwriting either source.
  - [x] Keep candidate metrics/outcomes verbatim and classified as candidate-provided context, not calculated impact.
- [x] Expose a safe, reviewable clarified-evidence projection (AC: 1, 3-6)
  - [x] Extend the interview/domain projection with source, item, category, response disposition, and review-needed conflict state without exposing IDs, raw paths, prompts, or model diagnostics in UI.
  - [x] Keep the interview chat-only and do not invoke a model, generation, PDF compilation, or automatic retry.
- [x] Add migration, ownership, conflict, and deletion regression coverage (AC: 1-7)
  - [x] Cover answer vs skip, workspace/item isolation, exact metric preservation, direct conflict review state, task re-planning, response/evidence cascade deletion, and switched/deleted workspace safety.
  - [x] Ran `npm run typecheck`, `npm run lint`, and `npm test -- --runInBand`.

## Dev Notes

### Current foundation and boundaries

- Story 9.2 owns documentation interpretation and task planning. It reads only provenance-backed `resume-evidence.md` E-block facts. Never promote `resume-bullet-candidates.md`, raw source folders, architecture/setup files, or a model response as clarification evidence.
- Story 9.4 owns answer/skip persistence in `resume_clarification_task_responses`. Build on it; do not change its meaning, replace its exact answer text, or make the client responsible for ownership validation.
- Story 9.6 owns generation. This story supplies an attributable local evidence projection only. It must not create a draft, call LM Studio, compile TeX/PDF, or add a preview.
- A candidate answer is a distinct evidence source. It may support a later claim only together with the item/task provenance; it does not make an unverified metric externally measured or a plausible inference factual.
- `resume_evidence_interpretations` has documented facts/context/unknowns/contradictions. Do not overload it with candidate answer text: use a dedicated forward-only table, with explicit source type/provenance.
- All workspace mutations must re-read the active workspace within `BEGIN IMMEDIATE`; a switch or deletion fails closed and writes nothing elsewhere.

### Likely implementation map

- NEW: `src/persistence/migrations/0037_resume_clarified_evidence.sql` and migration registration/legacy fixture guard.
- UPDATE: `src/domain/resume-generation/resume-clarification-interview.ts` to promote an accepted answer atomically and expose a safe review projection.
- NEW/UPDATE: a small clarified-evidence domain reader/parser if separation keeps the interview command focused.
- UPDATE: `src/app/actions.ts` and `src/app/resume-interview.tsx` only if the safe persisted review state needs rendering; retain the single-column interview with no preview.
- UPDATE tests: `tests/resume-evidence-interpretation.test.ts`, `tests/workspace.test.ts`, and `tests/resume-profile-ui.test.ts` as appropriate.

### Conflict and evidence rules

- A direct conflict is an explicit inverse or incompatible concrete fact about the same item/category. Prefer conservative false negatives to labeling merely different detail as a contradiction.
- Preserve both source texts, references, timestamps, and provenance. A conflict is a review signal, not an automatic rejection or resolution.
- Candidate metrics/outcomes must remain exact bounded text. Do not parse numbers into new performance claims, calculate deltas, append qualifiers, or claim external adoption/deployment.
- Skips explicitly preserve the gap through the existing task response but create no clarified evidence record.

### Next.js and UX rules

- Pages stay Server Components; client components receive only serializable safe projections. Server Actions are POST-reachable and must validate FormData plus active workspace/task ownership in the domain layer.
- Revalidate `/resume/interview` and `/resume` after a successful relevant mutation. Do not redirect/revalidate into generation as a side effect of an answer.
- Use the existing shared shell, ordered transcript, labels, live status, visible focus, and `formNoValidate` explicit-unknown control. Do not display database IDs, paths, digests, raw answer logs, or model state.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 9.5]
- [Source: _bmad-output/implementation-artifacts/9-2-interpret-evidence-and-plan-clarification-tasks.md]
- [Source: _bmad-output/implementation-artifacts/9-3-persist-workspace-specific-resume-journey-state.md]
- [Source: _bmad-output/implementation-artifacts/9-4-run-the-mandatory-coach-resume-interview.md]
- [Source: src/persistence/migrations/0031_resume_evidence_interpretations.sql]
- [Source: src/persistence/migrations/0036_resume_clarification_task_responses.sql]
- [Source: src/domain/resume-generation/resume-evidence-interpretation.ts]
- [Source: src/domain/resume-generation/resume-clarification-interview.ts]

## Dev Agent Record

### Completion Notes List

- Added workspace-owned clarified evidence and conflict records with cascade deletion, exact candidate text, and explicit candidate-interview provenance.
- Integrated atomic promotion into the accepted-answer command; skips remain task-level explicit unknowns without clarified evidence.
- Added a conservative direct-inverse conflict signal to the persisted interview transcript without triggering model work or resume generation.
- Added regression coverage for exact preservation, conflict visibility, skip behavior, and workspace deletion.
- Completed adversarial, edge-case, and acceptance review; strengthened direct-conflict reconciliation in both evidence/answer ordering directions and retained conflicts on the interview surface after the final answer.
- Final validation passed: `npm run typecheck`, `npm run lint`, and `npm test -- --runInBand` (177 passing).

### Review Findings

- [x] [Review][Patch] Preserve the candidate's exact bounded answer while validating nonblank content separately. [src/domain/resume-generation/resume-clarification-interview.ts]
- [x] [Review][Patch] Detect conservative, unambiguous inverse assertions despite pronouns or contracted negatives. [src/domain/resume-generation/resume-clarified-evidence.ts]
- [x] [Review][Patch] Reconcile prior clarifications if documented direct facts arrive later for the same item. [src/domain/resume-generation/resume-evidence-interpretation.ts]
- [x] [Review][Patch] Keep a final conflict visible on the interview route and identify answers as candidate-provided. [src/app/resume/interview/page.tsx]
- [x] [Review][Patch] Do not record migration 0037 as applied in an intentionally schema-less legacy fixture. [src/persistence/database.ts]

### File List

- _bmad-output/implementation-artifacts/9-5-preserve-clarified-resume-evidence.md
- src/persistence/migrations/0037_resume_clarified_evidence.sql
- src/persistence/migrations.ts
- src/persistence/database.ts
- src/domain/resume-generation/resume-clarified-evidence.ts
- src/domain/resume-generation/resume-clarification-interview.ts
- src/domain/resume-generation/resume-evidence-interpretation.ts
- src/app/resume-interview.tsx
- src/app/resume/interview/page.tsx
- tests/resume-evidence-interpretation.test.ts
- tests/resume-profile-ui.test.ts
- tests/workspace.test.ts

## Change Log

- 2026-08-29: Created implementation-ready Story 9.5 from Epic 9 and the completed clarification interview foundation.
- 2026-08-29: Implemented clarified evidence preservation and validation; ready for review.
- 2026-08-29: Completed adversarial review fixes and final validation; story marked done.
