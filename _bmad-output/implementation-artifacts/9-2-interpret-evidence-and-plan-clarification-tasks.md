---
baseline_commit: c285895
---

# Story 9.2: Interpret Evidence and Plan Clarification Tasks

Status: done

## Story

As Adrian, I want the system to organize what each Project or Experience proves and identify only the missing details that matter for my resume, so that Coach Resume asks focused questions instead of guessing from repository files.

## Acceptance Criteria

1. Store a workspace-owned, reviewable interpretation for each documented item: direct facts, supported capabilities, contextual purpose/workflow, and explicit unknowns or contradictions.
2. Create clarification tasks only for material missing purpose, ownership, users/workflow, outcomes, metrics, deployment, collaboration, dates, or role.
3. Group tasks by documented Project/Experience and category.
4. Do not create a task for directly evidenced information.
5. Keep plausible claims as explicit unknowns/questions; never promote them to resume-ready evidence.
6. Delete interpretations/tasks with their workspace, retaining metadata-only deletion audit history.

## Tasks / Subtasks

- [x] Add forward-only, workspace-owned interpretation and clarification-task tables (AC: 1, 6)
  - [x] Preserved source/item identity, category, classification, safe bounded text, and timestamps.
  - [x] Used `ON DELETE CASCADE` without raw folder paths, source trees, prompts, or responses.
- [x] Build deterministic evidence interpretation/task planning boundary (AC: 1-5)
  - [x] Reads only provenance-backed `resume-evidence.md` facts from workspace-owned imports; never promotes candidate proposals or metadata.
  - [x] Stores direct facts, supported capability, contextual facts, explicit unknowns, and direct inverse contradictions.
  - [x] Plans idempotent grouped tasks from confirmed facts only and reconciles pending tasks without changing answered or skipped history.
  - [x] Keeps plausible impact, ownership, and metrics as questions rather than claims.
- [x] Integrate interpretation after successful evidence intake (AC: 1, 6)
  - [x] Verifies the original active workspace before persistence and writes nothing to another workspace.
  - [x] Marks a switched-workspace intake recoverably failed rather than leaving it running; does not create drafts/PDFs.
- [x] Add database and behavior tests (AC: 1-6)
  - [x] Added parser, explicit-unknown, re-planning, switched-workspace, and deletion-cascade coverage.
  - [x] Ran typecheck, lint, and full tests.

### Review Findings

- [x] [Review][Patch] Restrict persisted direct facts to valid provenance-backed E blocks and keep proposal metadata non-factual [src/domain/resume-generation/resume-evidence-interpretation.ts:31]
- [x] [Review][Patch] Plan only from confirmed facts, preserving explicit unknowns as questions [src/domain/resume-generation/resume-evidence-interpretation.ts:47]
- [x] [Review][Patch] Retain direct inverse assertions as contradictions [src/domain/resume-generation/resume-evidence-interpretation.ts:63]
- [x] [Review][Patch] Mark a switched-workspace intake failed instead of leaving it running [src/domain/resume-generation/resume-evidence-intake.ts:18]
- [x] [Review][Patch] Reconcile pending tasks without changing answered or skipped history [src/domain/resume-generation/resume-evidence-interpretation.ts:99]
- [x] [Review][Patch] Add parser, re-planning, and switched-workspace integration coverage [tests/resume-evidence-interpretation.test.ts:1]

## Dev Notes

- Build on Story 9.1's `resume_evidence_intakes` and expected-workspace guard in `documentResumeEvidenceFolder`; do not restore `resume_generation_jobs` or automatic generation.
- Reuse workspace import ownership from `resume_workspace_imports` and `evidence_library_documents`. Interpret only provenance-backed `resume-evidence.md` facts; `resume-bullet-candidates.md` remains proposal research and is never promoted to evidence. Do not re-read raw selected folders.
- Migration `0032_resume_evidence_interpretation_contradictions.sql` extends interpretation kinds without weakening existing workspace ownership or deletion rules.
- The interpretation is deterministic/local structured processing. Story 9.4 owns conversational delivery; Story 9.5 owns user answers; Story 9.6 owns model resume generation.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 9.2: Interpret Evidence and Plan Clarification Tasks]
- [Source: _bmad-output/implementation-artifacts/9-1-redefine-onboarding-as-evidence-intake.md]
- [Source: src/domain/evidence/evidence-library.ts]
- [Source: src/domain/resume-generation/resume-evidence-intake.ts]

## Dev Agent Record

### Completion Notes List

- Added workspace-owned deterministic evidence interpretations and clarification tasks after intake documentation.
- Code review fixes restrict interpretations to provenance-backed facts, preserve explicit unknowns, reconcile pending tasks, surface direct conflicts, and safely fail switched intakes.
- Validation passed: typecheck, lint, and 173 tests.

### File List

- _bmad-output/implementation-artifacts/9-2-interpret-evidence-and-plan-clarification-tasks.md
- src/persistence/migrations/0031_resume_evidence_interpretations.sql
- src/persistence/migrations/0032_resume_evidence_interpretation_contradictions.sql
- src/persistence/migrations.ts
- src/persistence/database.ts
- src/domain/resume-generation/resume-evidence-interpretation.ts
- src/domain/resume-generation/resume-evidence-intake.ts
- tests/resume-evidence-interpretation.test.ts
- tests/workspace.test.ts

## Change Log

- 2026-08-28: Implemented evidence interpretation and clarification-task planning.
- 2026-08-28: Completed code-review fixes and verification; story done.
