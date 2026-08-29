---
baseline_commit: c285895
---

# Story 9.1: Redefine Onboarding as Evidence Intake

Status: done

## Story

As Adrian,
I want initial submission to save my profile and chosen Project/Experience folders without creating a resume,
so that the system can first understand my documented work and identify meaningful gaps.

## Acceptance Criteria

1. **Given** valid initial profile details and one or more selected local folders, **when** onboarding is finalized, **then** the workspace is created/selected, the profile is saved, and only bounded folder documentation and evidence interpretation begin.
2. **Given** documentation completes, **when** the workspace has interpreted evidence, **then** onboarding has created no material draft, PDF preview, TeX compilation, or resume-generation job.
3. **Given** a workspace is deleted or switched while documentation runs, **when** background work completes, **then** it cannot add evidence, interpretation, tasks, or a draft to another workspace.
4. **Given** a folder interpretation is empty, incomplete, or fails, **when** onboarding finishes, **then** the profile/workspace remain available in an accessible, recoverable intake state; no fallback resume is generated.
5. **Given** onboarding succeeds, **when** its redirect occurs, **then** it opens the dedicated Coach Resume interview route rather than the split Coach/PDF page.

## Scope and Delivery Boundary

- Story 9.1 changes the intake boundary. It must remove automatic resume draft generation and PDF compilation from onboarding.
- Preserve the current safety invariant: a background task may write only to the workspace that started it and must stop when that workspace/job has been deleted.
- Create the durable minimum state required to distinguish intake pending/running/ready/failed and to route a workspace safely. Story 9.3 expands this into the complete workspace journey model; do not duplicate or pre-implement Stories 9.2, 9.4–9.7.
- The Story 9.1 interview route is a header-and-recovery shell only. It must contain no PDF preview, material draft controls, or Coach question workflow; Story 9.4 owns the actual interview UI.
- Keep source-folder paths and raw source content in the in-memory background input only. Durable records must contain metadata/status, not local paths or source content.
- `Resume.pdf` remains the shared immutable general visual template. Onboarding must neither generate a draft with it nor delete it.

## Tasks / Subtasks

- [x] Introduce durable intake state and its read/write domain boundary (AC: 1, 2, 4)
  - [x] Added a forward-only migration after `0029_resume_generation_jobs.sql`.
  - [x] Stored workspace-owned status, safe message, timestamps, and no paths/content with cascade deletion.
  - [x] Added typed intake commands/read model and safe completion/failure handling.
  - [x] Preserved metadata-only deletion audit semantics.
- [x] Replace onboarding's generation path with bounded intake documentation (AC: 1–4)
  - [x] Onboarding now schedules only the intake documentation runner.
  - [x] Onboarding no longer bootstraps a template or invokes draft/PDF generation.
  - [x] Disabled the legacy direct generation route; the intake runner keeps expected-workspace persistence guards.
  - [x] Retained the workspace/profile on a recoverable intake failure.
- [x] Route intake workspaces away from the final split view (AC: 4, 5)
  - [x] Added dynamic `/resume/interview` header-and-recovery shell.
  - [x] Changed onboarding success navigation to `/resume/interview`.
  - [x] Redirected active intake workspaces away from Coach/PDF preview.
  - [x] Reworded onboarding around evidence preparation and clarification.
- [x] Add focused regression coverage (AC: 1–5)
  - [x] Updated UI contract coverage for the intake handoff and non-generative copy.
  - [x] Preserved full regression coverage for deletion/workspace ownership safeguards.

### Review Findings

- [x] [Review][Patch] Recover failed or stalled evidence intake [src/app/resume/interview/page.tsx:11] — Failed intake now keeps the workspace picker available for a truthful switch, deletion, or a new intake.
- [x] [Review][Patch] Avoid stranding a workspace before intake creation [src/app/actions.ts:107] — Consent is validated before workspace/profile creation.
- [x] [Review][Patch] Make intake execution single-attempt-safe [src/domain/resume-generation/resume-evidence-intake.ts:16] — Atomic queued-to-running claim prevents duplicate runners; already documented folders are tolerated.
- [x] [Review][Patch] Add behavioral lifecycle and deletion coverage [tests/workspace.test.ts:60] — Workspace deletion now directly asserts evidence-intake cascade cleanup.

## Dev Notes

### Current implementation to change

- `src/app/actions.ts` `resumeOnboardingAction` currently creates a workspace/profile, bootstraps the template, starts `resume_generation_jobs`, and schedules `runResumeGenerationJob`. This is the primary behavior to replace.
- `src/domain/resume-generation/resume-generation-runner.ts` documents folders but then calls `generateBaseResumeAction` and `compileResumeDraftPdf`; remove that generation half for intake work.
- `src/app/api/resume-generation/route.ts` is an alternate direct entrypoint into the old generation runner. It must be retired, guarded, or renamed/re-scoped so it cannot violate this story's no-automatic-generation rule.
- `src/domain/evidence/evidence-library.ts` already validates `expectedWorkspaceId` against the active workspace at persistence. Reuse that guard; do not bypass it.
- `src/app/resume-onboarding.tsx` keeps selected local paths only in client memory and posts them once. Preserve that privacy property.
- `src/app/resume-workspace.tsx` currently treats every active workspace as the split Coach/preview workspace and reads generation job/draft state. It needs state-aware routing/empty handling.

### Data and safety requirements

- Use a new migration registered in `src/persistence/migrations.ts`; applied migrations `0025`–`0029` are immutable.
- Workspace-owned state must reference `resume_workspaces(id) ON DELETE CASCADE`; no new record may be shared across workspaces.
- Existing runner behavior is an essential regression guard: load the job/work item before work, re-check it before each expensive folder operation, and persist via the originating `workspaceId`.
- Preserve the documented evidence import guard and existing permanent-delete cleanup. Add the new intake table to test assertions.
- Never persist selected local folder paths, raw repository contents, prompt text, model output, or detailed failure payloads in the intake state/audit record.

### UI and Next.js requirements

- This project uses Next.js 16.3 App Router. A nested `app/resume/interview/page.tsx` creates `/resume/interview`; it is wrapped by the root layout and must render inside `ApplicationShell` just like `/resume`.
- Client components must invoke the existing server action through `useActionState`/`startTransition`; server actions must continue to validate all input and workspace ownership.
- Keep the selected-workspace picker usable. It may expose a plain-language intake status only when backed by durable state; Story 9.3 owns the full lifecycle selector.
- Interview-shell content must be keyboard/screen-reader usable and announce failure/recovery through the existing status patterns. No iframe or PDF preview is allowed on this route.

### Testing requirements

- Run `npm run typecheck`, `npm run lint`, and `npm test -- --runInBand` after changes.
- Extend existing workspace/evidence race tests rather than replacing the stale-workspace guard.
- Update stale UI expectations in `tests/resume-profile-ui.test.ts`, `tests/resume-evidence-workspace-ui.test.ts`, and `tests/material-draft-ui.test.ts`; add tests for the new route/intake states.
- Use database tests to prove the absence of drafts/jobs after onboarding, not just UI text assertions.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 9.1: Redefine Onboarding as Evidence Intake]
- [Source: src/app/actions.ts#resumeOnboardingAction]
- [Source: src/domain/resume-generation/resume-generation-runner.ts#runResumeGenerationJob]
- [Source: src/domain/evidence/evidence-library.ts#documentResumeEvidenceFolder]
- [Source: src/persistence/migrations/0025_resume_workspaces.sql]
- [Source: src/persistence/migrations/0029_resume_generation_jobs.sql]
- [Source: node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md]
- [Source: node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md]

## Dev Agent Record

### Agent Model Used

GPT-5.6

### Debug Log References

- Story preparation inspected the current onboarding, runner, evidence, workspace, migration, and App Router boundaries.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Replaced automatic onboarding generation with a workspace-owned evidence-intake runner and recoverable intake state.
- Added the interview handoff shell and blocked the former direct generation endpoint.
- Validation passed: typecheck, lint, and 169 tests.
- Code review fixes: recovery surface, pre-create consent validation, atomic intake claim, and intake deletion assertion.

### File List

- _bmad-output/implementation-artifacts/9-1-redefine-onboarding-as-evidence-intake.md
- src/persistence/migrations/0030_resume_evidence_intake.sql
- src/persistence/migrations.ts
- src/domain/resume-generation/resume-evidence-intake.ts
- src/app/actions.ts
- src/app/resume-onboarding.tsx
- src/app/resume/interview/page.tsx
- src/app/resume-workspace.tsx
- src/app/api/resume-generation/route.ts
- tests/resume-profile-ui.test.ts
- tests/resume-evidence-workspace-ui.test.ts
- tests/material-draft-ui.test.ts

## Change Log

- 2026-08-28: Implemented evidence-intake-only onboarding and marked ready for review.
