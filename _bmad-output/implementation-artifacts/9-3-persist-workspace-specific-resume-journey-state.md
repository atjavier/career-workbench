---
baseline_commit: c285895
---

# Story 9.3: Persist Workspace-Specific Resume Journey State

Status: done

## Story

As Adrian, I want every resume workspace to retain its own evidence, Coach Resume interview progress, and generation state, so that I can switch among resumes without losing work or mixing their details.

## Acceptance Criteria

1. A workspace has exactly one durable journey record with a stable ID and workspace-owned phase, next action, and revision/timestamps whenever intake, evidence interpretation, tasks, answers, generation readiness, or a draft changes.
2. Switching workspaces restores only that workspace's profile revision, documented imports/evidence, interpretations, tasks, answers, and latest eligible draft.
3. The selector truthfully shows each workspace's saved journey state and always permits selection, including onboarding, interview, preview-ready, and recoverable states.
4. Adding a newly documented or materially changed item re-enters clarification only for that workspace/new item; answered or skipped unrelated tasks remain unchanged.
5. Returning to a workspace restores its next required action without regenerating a resume.
6. Permanent deletion removes all journey-owned state with the workspace, leaving only existing metadata-only deletion audit history; late background work cannot update another workspace.

## Tasks / Subtasks

- [x] Add a forward-only workspace-journey persistence model (AC: 1, 6)
  - [x] Added migration `0033` with one-to-one cascade ownership, UUIDv7 ID, bounded phase/next-action state, monotonic revision, and timestamps.
  - [x] Kept it metadata-only: no raw folder paths, source trees, prompts, model output, or answer bodies.
  - [x] Added typed repository/read/reconciliation models guarded by the originally active workspace ID.
- [x] Reconcile authoritative intake, tasks, and drafts into the journey state (AC: 1, 4, 5)
  - [x] Derive phase/next action from workspace-owned intake, pending tasks, and `resume_workspace_drafts`; do not treat journey state as a competing evidence source.
  - [x] Preserve answered/skipped tasks and existing unrelated task history when pending tasks are reconciled for newly added evidence.
  - [x] Do not create a draft, invoke the local model, or compile a PDF as part of reconciliation or a page visit.
- [x] Expose workspace-specific lifecycle summaries and state-aware routing (AC: 2, 3, 5)
  - [x] Extended the workspace read model and picker with truthful per-workspace lifecycle labels backed by persisted/derived state.
  - [x] Route only the active workspace according to its own journey state while retaining the selector on recoverable/intake/interview views.
  - [x] Preserved the active workspace and ownership checks during selection; drafts and evidence remain workspace-joined.
- [x] Add lifecycle, isolation, and deletion regression coverage (AC: 1-6)
  - [x] Tested multiple workspaces, profile restoration, interpretation re-entry, switch guards, and cascade deletion.
  - [x] Updated lifecycle UI behavior without restoring automatic generation.
  - [x] Ran `npm run typecheck`, `npm run lint`, and `npm test -- --runInBand`.

## Dev Notes

### Architecture and current-state guardrails

- `resume_workspace_state.revision_number` is global selector optimistic-concurrency state, not a per-workspace journey revision. Keep it for selection and add a separate journey revision only to the new durable journey row.
- Existing ownership is established through `resume_workspace_profiles`, `resume_workspace_evidence`, `resume_workspace_imports`, and `resume_workspace_drafts`. Never query global `material_drafts`, evidence, or profiles as a workspace projection.
- `resume_evidence_intakes` is one row per workspace. It represents the original intake attempt; do not silently add a second row for later evidence. This story owns journey-state reconciliation, not the future add-folder flow UI.
- Story 9.2 already parses only provenance-backed `resume-evidence.md` facts, preserves explicit unknowns, reconciles **pending** tasks, and leaves answered/skipped tasks intact. Reuse this behavior.
- No automatic resume generation may be reintroduced. Story 9.6 owns generation and Story 9.7 owns the final split Coach/PDF workspace.
- A workspace switch/deletion guard must fail closed. `documentResumeEvidenceFolder` and `interpretWorkspaceEvidence` already require the originating workspace to remain active before persistence; journey writes need the same rule.
- Workspace permanent deletion manually removes immutable child records and uses cascade tables. Include the journey table in deletion assertions, but do not weaken immutable triggers or delete the shared root `Resume.pdf` template.

### Likely files

- NEW: `src/persistence/migrations/0033_resume_workspace_journeys.sql`
- UPDATE: `src/persistence/migrations.ts`
- NEW: `src/domain/resume-generation/resume-workspace-journey.ts`
- UPDATE: `src/domain/resume-generation/resume-evidence-intake.ts`
- UPDATE: `src/domain/resume-generation/resume-evidence-interpretation.ts`
- UPDATE: `src/domain/resume-generation/resume-workspace-commands.ts`
- UPDATE: `src/app/resume-workspace-picker.tsx`
- UPDATE: `src/app/resume-workspace.tsx`, `src/app/resume/interview/page.tsx`
- UPDATE/NEW tests: `tests/workspace.test.ts`, `tests/resume-evidence-interpretation.test.ts`, and relevant resume UI contract tests.

### Next.js requirements

- Read the relevant Next 16.3 App Router documentation in `node_modules/next/dist/docs/` before touching pages or server actions.
- Preserve server-component reads and client picker mutations through the existing `useActionState` / server-action pattern. Labels must be accessible text, not inferred client-only state.

### Testing requirements

- Use `apply_patch` for all edits.
- Add a migration-forward compatibility test if the new migration alters an existing schema.
- Run `npm run typecheck`, `npm run lint`, and `npm test -- --runInBand` after changes.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 9.3]
- [Source: _bmad-output/implementation-artifacts/9-1-redefine-onboarding-as-evidence-intake.md]
- [Source: _bmad-output/implementation-artifacts/9-2-interpret-evidence-and-plan-clarification-tasks.md]
- [Source: src/persistence/migrations/0025_resume_workspaces.sql]
- [Source: src/domain/resume-generation/resume-workspace-commands.ts]
- [Source: src/domain/resume-generation/resume-evidence-intake.ts]

## Dev Agent Record

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Added the persistent workspace-journey schema, guarded reconciler, creation/profile/intake synchronization, and truthful workspace selector labels.
- Validation passed: typecheck, lint, and the full test suite.
- Adversarial review closed stale-draft eligibility, migration reconciliation, documented-item deletion, legacy import workspace guards, and initial-generation interview bypasses.

### Review Findings

- [x] [Review][Patch] Use current-draft eligibility for journey preview state [src/domain/resume-generation/resume-workspace-journey.ts:20]
- [x] [Review][Patch] Reconcile migrated workspace state and task-set revisions before projecting the selector [src/domain/resume-generation/resume-workspace-commands.ts:38]
- [x] [Review][Patch] Re-enter interpretation after every supported workspace-owned documentation import [src/app/actions.ts:494]
- [x] [Review][Patch] Prevent initial resume generation from bypassing the required Coach lifecycle step [src/app/actions.ts:159]
- [x] [Review][Patch] Remove deleted item projections and bind legacy imports to their original workspace [src/domain/evidence/evidence-library.ts:80]
- [x] [Review][Patch] Permit a terminal evidence intake to restart while retaining one workspace-owned intake row [src/domain/resume-generation/resume-evidence-intake.ts:15]

### File List

- _bmad-output/implementation-artifacts/9-3-persist-workspace-specific-resume-journey-state.md
- src/persistence/migrations/0033_resume_workspace_journeys.sql
- src/persistence/migrations.ts
- src/persistence/database.ts
- src/persistence/resume-workspace-journey-repository.ts
- src/domain/resume-generation/resume-workspace-journey.ts
- src/domain/resume-generation/resume-workspace-commands.ts
- src/domain/resume-generation/candidate-profile-commands.ts
- src/domain/resume-generation/resume-evidence-intake.ts
- src/app/actions.ts
- src/app/resume-workspace-picker.tsx
- src/app/resume-workspace.tsx
- src/app/resume/interview/page.tsx
- tests/workspace.test.ts

## Change Log

- 2026-08-28: Created implementation-ready Story 9.3 from Epic 9 requirements and current workspace lifecycle constraints.
- 2026-08-29: Began durable journey-state implementation and validated the first lifecycle slice.
- 2026-08-29: Completed lifecycle reconciliation, workspace-specific restoration, and full verification; ready for review.
- 2026-08-29: Completed adversarial review fixes and final validation; story marked done.
