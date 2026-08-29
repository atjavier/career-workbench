---
baseline_commit: c285895
---

# Story 9.4: Run the Mandatory Coach Resume Interview

Status: done

## Story

As Adrian, I want a dedicated Coach Resume chat that asks focused clarification questions before resume creation, so that I can add context the repositories cannot know.

## Acceptance Criteria

1. A workspace with pending clarification tasks opens `/resume/interview`, which has the shared header and a Coach Resume interview only—never a PDF, draft preview, or split-pane editor.
2. Coach presents one saved task at a time in deterministic persisted order. It names the relevant Project or Experience and renders the category in plain language before the concise saved question.
3. A valid answer is stored against the active workspace and exact pending task, acknowledged in the chat, and atomically advances that task only after a sufficiently non-empty answer is accepted.
4. Skip and “I don’t know” complete the task as an explicit unknown. They never invent, infer, or promote an answer to a resume claim.
5. Leaving, switching, and returning restores completed/skipped history and the next pending task in the same persisted order. Workspaces never display or mutate another workspace’s tasks or responses.
6. While tasks remain, `/resume` returns the user to the interview with clear progress text. No route visit, reload, response action, or unavailable-Coach state triggers documentation, local-model work, generation, PDF compilation, or a retry.
7. Coach/model unavailability remains a recoverable UI state: saved questions, answers, progress, and the next safe action remain visible.
8. The interview is usable on narrow screens and with keyboard/screen reader: explicit labels, semantic transcript/progress, live acknowledgement/errors, disabled pending controls, visible focus, and no horizontal overflow.

## Tasks / Subtasks

- [x] Add forward-only, workspace-owned interview response persistence (AC: 3-5, 7)
  - [x] Added migration `0036` and response cascade model.
  - [x] Kept candidate answers separate from resume evidence/claims for Story 9.5.
  - [x] Extended deletion coverage.
- [x] Implement a guarded task-interview command boundary (AC: 2-5)
  - [x] Added active-workspace ordered task/response projection and atomic answer/skip commands.
  - [x] Validates pending task ownership, bounded input, and reconciles journey state.
- [x] Build the Coach Resume interview UI and action (AC: 1, 2, 3, 4, 7, 8)
  - [x] Added a `useActionState` chat-only interview component and thin server action.
- [x] Complete routing and workspace restoration (AC: 1, 5, 6, 7)
  - [x] Interview page loads workspace-scoped persisted state without model/generation work.
- [x] Add regression coverage and validate (AC: 1-8)
  - [x] Added lifecycle, cascade, and chat-only UI contract coverage.
  - [x] Passed typecheck, lint, and 176 tests.

## Dev Notes

### Current foundation and boundaries

- Story 9.3 is complete. `resume_workspace_journeys` is the authoritative durable lifecycle projection; call `reconcileResumeWorkspaceJourney` after an accepted task mutation. It fingerprints task question and status, so task state changes must be committed before reconciliation.
- `resume_clarification_tasks` from migration `0031` already has workspace/item/category/question/status but has no answer text, answer timestamp, deterministic ordinal, or response relation. Do not try to overload `resume_evidence_interpretations`: it cannot safely record task ownership or repeated candidate answers.
- Story 9.5 owns traceable clarified resume evidence, source conflict handling, and claim use. Story 9.4 records candidate interview responses only. A response must not become evidence or a model claim here.
- `interpretWorkspaceEvidence` is deterministic and only consumes curated, provenance-backed `resume-evidence.md` facts. It preserves answered/skipped task rows when re-planning; retain this behavior.
- Onboarding/documentation remains evidence intake only. Never reintroduce `resume_generation_jobs`, automatic local-model resume generation, PDF creation, or template mutation.
- The root `Resume.pdf` remains the shared general template and is untouched by this story.

### Existing code to read before editing

- `src/app/resume/interview/page.tsx`: current server page is a documentation/intake placeholder. Extend it; do not make it a client DB reader.
- `src/app/resume-workspace.tsx`: existing journey gate sends documenting/interview/recovery to `/resume/interview`. Keep it workspace-specific and use a clear explanation for pending work.
- `src/domain/resume-generation/resume-evidence-interpretation.ts`: task planner/replan rules and active-workspace guard.
- `src/domain/resume-generation/resume-workspace-journey.ts`: phase derivation/fingerprint and guarded reconciliation.
- `src/app/actions.ts`: existing server-action safe error, revalidation, and `useActionState` action-state contracts.
- `src/app/resume-coach.tsx`: legacy post-draft split editor only. It must not be coupled to the mandatory interview.
- `src/domain/resume-generation/resume-coach-commands.ts`: material-draft persistence, not interview answers.

### Data, safety, and audit rules

- All task and response queries must join/filter by `workspace_id`; client-supplied IDs are untrusted.
- In the mutation transaction, re-read `readActiveResumeWorkspace`, verify task workspace ownership and `status = 'pending'`, then write exactly one response and task transition. A workspace switch/deletion must write nothing.
- Cascade new records from the workspace and task. Extend the explicit deletion path/immutable-trigger handling only as necessary; preserve metadata-only audit history and never put answer text in an audit payload.
- Use a bounded response length and a concrete `WorkspaceError` with safe next action. Treat blank answer as invalid; “skip” must be an explicit disposition, not an empty answer silently accepted.
- Do not invoke a local model or retry it in this flow. “Coach unavailable” describes the local-assistance state but cannot hide saved deterministic questions or data.

### Next.js 16.3 requirements

- Local documentation read: `node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md`, `05-server-and-client-components.md`, and `04-linking-and-navigating.md`.
- Pages remain Server Components by default. Read SQLite state and route server-side; pass only a serializable interview projection to a narrowly scoped `"use client"` component.
- A Server Action is a directly POST-reachable endpoint. Validate FormData and enforce active-workspace/task authorization inside the action/domain layer; never trust hidden inputs for ownership.
- Use existing `useActionState` forms for progressive enhancement and pending state. Revalidate `/resume/interview`, `/resume`, and affected workspace pages after success; call revalidation before any redirect.

### UX and accessibility

- Use the shared `ApplicationShell`, `ResumeWorkspacePicker`, existing `panel`/status styles, and calm plain-language copy. Never expose database IDs, raw paths, digests, source trees, or model diagnostics.
- Plain-language categories: e.g. “BioEvidence — purpose”, “BioEvidence — your contribution”, or “BioEvidence — outcome and impact”; do not render raw enum keys.
- The interview page is a single responsive column. No iframe, `ResumePdfPreview`, draft controls, template controls, or side-by-side layout.
- Use an ordered/semantic transcript, visible remaining/complete progress, `<label>` for the answer input, keyboard-operable buttons, `aria-live="polite"` status, error recovery, and no automatic focus-stealing/model retry.

### Test guidance

- Add domain tests for answer, skip, invalid/duplicate/non-pending task, task ordering, reload, replan preservation, workspace switching/deletion, and response cascade.
- Add UI contract tests for the chat-only page, no preview iframe, current task/item/category/progress, accessible form/status, recovery truthfulness, and resume-route redirect while pending.
- Extend workspace isolation tests to prove one workspace cannot read/write another’s response and deletion removes responses.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-9.4]
- [Source: _bmad-output/implementation-artifacts/9-3-persist-workspace-specific-resume-journey-state.md]
- [Source: src/persistence/migrations/0031_resume_evidence_interpretations.sql]
- [Source: src/domain/resume-generation/resume-evidence-interpretation.ts]
- [Source: src/domain/resume-generation/resume-workspace-journey.ts]
- [Source: src/app/resume/interview/page.tsx]

## Dev Agent Record

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Implemented persisted workspace-owned Coach answers/skips, guarded task transitions, and chat-only interview routing.

### Review Findings

- [x] Final adversarial, edge-case, and acceptance review found no unresolved high- or medium-severity issue.
- [x] Fixed review findings: the explicit unknown control bypasses required-answer validation, saved answers are visible in the transcript, and workspace changes revalidate the interview route.
- [x] Validated with `npm run typecheck`, `npm run lint`, and `npm test -- --runInBand` (176 passing).

### File List

- _bmad-output/implementation-artifacts/9-4-run-the-mandatory-coach-resume-interview.md
- src/persistence/migrations/0036_resume_clarification_task_responses.sql
- src/persistence/migrations.ts
- src/persistence/database.ts
- src/domain/resume-generation/resume-clarification-interview.ts
- src/app/actions.ts
- src/app/resume-interview.tsx
- src/app/resume/interview/page.tsx
- tests/resume-evidence-interpretation.test.ts
- tests/resume-profile-ui.test.ts
- tests/workspace.test.ts

## Change Log

- 2026-08-29: Created implementation-ready Story 9.4 from Epic 9, completed Story 9.3, current source architecture, and local Next 16.3 guidance.
- 2026-08-29: Implemented mandatory persisted Coach Resume interview; ready for review.
- 2026-08-29: Completed code review and validation; story marked done.
