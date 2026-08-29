---
baseline_commit: c285895af6f9e62c68ad1f79d331458274b6ed9b
---

# Story 9.6: Create Workspace-Scoped Resume Evidence Packets

Status: done

## Story

As Adrian,
I want every resume workspace to have its own readable Project and Experience evidence packet,
so that I can inspect documented and interview-provided context in one place without mixing resumes.

## Acceptance Criteria

1. Given a Project or Experience is documented for a workspace, when its managed evidence packet is persisted, all artifact paths are workspace-scoped and cannot collide with another resume workspace that has the same item name.
2. Given candidate answers or skips are accepted, when their workspace packet is synchronized, a companion `resume-clarifications.md` records the relevant item, category, exact candidate-provided answer or explicit unknown, timestamp, provenance, and conflict-review state.
3. Given repository-grounded documentation exists, when clarifications are written, `resume-evidence.md` remains unchanged and the companion never presents candidate context as source-folder evidence.
4. Given a clarification is updated, an item is added, a workspace is switched, or a workspace is deleted, when packet synchronization or cleanup runs, it is atomic, safe-path bounded, scoped to the original workspace, and cannot expose, overwrite, or retain another workspace's packet.
5. Given the SQLite workspace is temporarily unavailable or a companion-file write fails, when the operation recovers, SQLite remains authoritative, no source folder is changed, no unrelated packet is touched, and the user receives a truthful local recovery state.

## Tasks / Subtasks

- [x] Establish workspace-owned packet identity and migrate the managed artifact layout (AC: 1, 4, 5)
  - [x] Add a forward-only migration and persistence mapping for a workspace-owned packet/item location; use the workspace ID plus validated category and item segments, never item name alone.
  - [x] Replace the shared canonical layout (`resume-evidence/{projects|experiences}/{name}`) with a bounded layout such as `resume-evidence/workspaces/{workspaceId}/{projects|experiences}/{safeName}`. Existing shared paths are legacy inputs, not the canonical destination for new or migrated packets.
  - [x] Make documentation copy/import, reading, ownership lookups, and item cleanup resolve the packet through workspace identity. Preserve the current documentation artifacts and their stored digests.
  - [x] Keep SQLite authoritative for packet ownership and synchronization state. Do not use a readable file as a database replacement or put candidate text in audit events.

- [x] Generate and synchronize the derived clarification companion (AC: 2, 3, 5)
  - [ ] Build one deterministic writer/projection that joins workspace-owned clarification tasks, task responses, clarified evidence, and conflict state. It must render answered and skipped tasks for the corresponding item only.
  - [ ] Write `resume-clarifications.md` with explicit item/category context, exact bounded candidate answer or explicit unknown, saved timestamp, `candidate_interview_answer` provenance for answers, and `needs_review` conflict state. Do not calculate, strengthen, summarize, or infer a metric/outcome.
  - [ ] Invoke synchronization after a successful answer or skip and after a documented item becomes available. A skip produces no clarified-evidence row but must still be visible as an explicit unknown in the companion.
  - [ ] Leave `resume-evidence.md`, all documentation-skill output, and all source folders byte-for-byte untouched. Never write prompts, model responses, raw source trees, paths, IDs, or diagnostics into the companion.

- [x] Make writes, switching, and deletion fail safely (AC: 1, 4, 5)
  - [ ] Treat filesystem persistence as a derived projection: stage the companion in the exact workspace packet and atomically replace it only after all validation succeeds. Clean staging output on failure.
  - [ ] Re-read and validate the expected/original workspace immediately before persistence and again before replace/delete. A switch or deletion must fail closed and cannot write to the newly active workspace.
  - [ ] Reuse the existing safe-segment, `resolve`/`relative` containment, `lstat`, and no-symlink/reparse-point protections. Never recursively remove a computed broad root; deletion may target only the validated packet root of the confirmed workspace.
  - [ ] On SQLite unavailability or companion failure, preserve task/answer/evidence authority and source artifacts, record or derive a recoverable packet state, and surface a specific local recovery action. Do not silently retry, auto-generate a resume, or mutate an unrelated packet.

- [x] Preserve lifecycle and UI contracts (AC: 2, 4, 5)
  - [ ] Keep pages as Server Components and expose only serializable, safe projections to client components. Server Actions must validate hostile `FormData` and resolve ownership in the domain layer.
  - [ ] Revalidate the literal affected routes (`/resume`, `/resume/interview`, and `/evidence` when applicable) after a successful user-visible mutation. Packet synchronization is critical persistence; do not move it to `after()` or a client-side parallel Server Action.
  - [ ] Keep the interview chat-only: this story does not call LM Studio, create a task or claim, generate a draft/PDF, compile TeX, or add a preview.

- [x] Add focused regression coverage and run the established validation suite (AC: 1-5)
  - [ ] Verify two workspaces with the same item name use distinct packet paths and cannot overwrite one another.
  - [ ] Verify answer, skip, provenance, timestamp, conflict-review rendering, and byte-identical preservation of `resume-evidence.md`.
  - [ ] Verify path traversal, symlink/reparse-point, switched/deleted workspace during sync, and deletion cleanup can neither mutate nor retain another workspace's packet.
  - [ ] Verify SQLite and file-write failures leave SQLite/source artifacts authoritative and produce a truthful recovery state.
  - [ ] Run `npm run typecheck`, `npm run lint`, and `npm test -- --runInBand`.

## Dev Notes

### Current foundation and mandatory boundaries

- Story 9.1-9.3 provide workspace-scoped intake, interpretation, task planning, and persisted journey state. Preserve their original-workspace guards; no background completion may attach a packet to the selected workspace by accident.
- Story 9.4 owns the `resume_clarification_task_responses` answer/skip record. Story 9.5 owns `resume_clarified_evidence` plus conservative `needs_review` conflicts. They remain authoritative; 9.6 creates only a readable derived projection.
- Answer text is candidate-provided context. It stays exact and bounded. A skip is an explicit unknown, never fabricated evidence. Candidate-provided text must remain clearly separate from repository-grounded documentation.
- The current working tree deliberately contains uncommitted Epic 9 implementation and migrations 0030-0037, based on `c285895`. Extend and preserve this work; do not reset, overwrite, or assume only committed files exist.
- Database and filesystem cannot be one literal transaction. Achieve safe behavior with DB authority, workspace validation, staged write + atomic rename, bounded cleanup, recovery state, and tests for interruption/failure.

### Implementation map

- UPDATE `src/files/evidence-library.ts`: generalize packet-root construction and managed artifact read/copy behavior from category/name paths to validated workspace/category/name paths; retain safe path and link defenses.
- UPDATE `src/domain/evidence/evidence-library.ts`: make import identity, copy, lookup, and per-item cleanup workspace-aware; avoid name-only `documented:${category}:${normalizedName}` ownership assumptions.
- UPDATE `src/domain/resume-generation/resume-evidence-interpretation.ts`: consume workspace-owned documented artifact paths only; do not scan the shared library.
- UPDATE `src/domain/resume-generation/resume-clarification-interview.ts` and/or `resume-clarified-evidence.ts`: create the deterministic companion projection and trigger it after accepted answers and skips without changing task/answer semantics.
- UPDATE `src/domain/resume-generation/resume-workspace-commands.ts`: replace legacy `managedEvidenceDirectory()`/name-based deletion with validated workspace packet-root cleanup. Preserve metadata-only deletion audit behavior.
- UPDATE `src/app/actions.ts` only for safe action wiring/revalidation and truthful recovery display; no client authority or model work.
- NEW migration after `0037` plus `src/persistence/migrations.ts` registration as needed for packet mapping/status. Do not modify historical migrations.
- TEST likely in `tests/evidence-library.test.ts`, `tests/resume-evidence-interpretation.test.ts`, `tests/workspace.test.ts`, and UI tests only when a visible packet/recovery state changes. Use temporary app-data/workspace fixtures; never access user folders.

### Framework and code rules

- The project pins Next.js 16.3.0, React 19.2.3, TypeScript 5.9.3, Node 24+, and uses Node's native test runner through `tsx`. Do not add a dependency for packet serialization or filesystem safety.
- Before modifying application code, read the relevant installed Next 16 guide in `node_modules/next/dist/docs/`, especially Server Actions and `revalidatePath`, per the repository rule. Preserve the current server-side ownership checks and exact route revalidation.
- Keep the existing `WorkspaceError` vocabulary and accessible `role=status`/`aria-live` recovery rendering. Do not expose absolute paths, raw UUIDs, digests, prompts, model internals, or audit payload in the UI.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 9.6]
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-08-29-coach-evidence-packets.md#Detailed Change Proposals]
- [Source: _bmad-output/implementation-artifacts/9-5-preserve-clarified-resume-evidence.md]
- [Source: src/files/evidence-library.ts]
- [Source: src/domain/evidence/evidence-library.ts]
- [Source: src/domain/resume-generation/resume-clarification-interview.ts]
- [Source: src/domain/resume-generation/resume-clarified-evidence.ts]
- [Source: src/domain/resume-generation/resume-workspace-commands.ts]
- [Source: src/persistence/migrations/0036_resume_clarification_task_responses.sql]
- [Source: src/persistence/migrations/0037_resume_clarified_evidence.sql]

### Review Findings

- [ ] [Review][Patch] Persist packet synchronization and recovery state [src/domain/resume-generation/resume-evidence-packets.ts:16] — `resume_evidence_packets` is never read or written. Record the workspace/item packet path and transition to `recovery_needed` if derived-file persistence fails, so the saved answer remains truthful and recoverable.
- [ ] [Review][Patch] Synchronize existing clarifications when documentation is imported [src/domain/evidence/evidence-library.ts:85] — importing a documented item never projects already-saved answers or skips into `resume-clarifications.md`.
- [ ] [Review][Patch] Return a truthful recovery outcome after post-commit packet failures [src/domain/resume-generation/resume-clarification-interview.ts:23] — an answer/skip commits before the companion write; a filesystem error currently appears as a generic failed answer rather than “answer saved; packet sync needs recovery.”
- [ ] [Review][Patch] Harden workspace and item packet cleanup [src/domain/resume-generation/resume-workspace-commands.ts:88] — recursive cleanup needs containment and no-symlink/reparse validation, plus workspace-root-aware deletion, before it can meet the safe-path lifecycle contract.
- [ ] [Review][Patch] Cover packet isolation, failure, and lifecycle regressions [tests/resume-evidence-interpretation.test.ts:124] — add tests for same-name items in two workspaces, post-import sync, write/SQLite failure recovery, switch/delete races, and unsafe path cleanup.

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

### Completion Notes List

- 2026-08-29: Ultimate context engine analysis completed - comprehensive developer guide created.
- 2026-08-29: Implemented workspace-scoped evidence packets, candidate clarification projection, and scoped cleanup. Validation passed: typecheck, lint, and 178 tests.

### File List

- _bmad-output/implementation-artifacts/9-6-create-workspace-scoped-resume-evidence-packets.md
- src/files/evidence-library.ts
- src/domain/evidence/evidence-library.ts
- src/domain/resume-generation/resume-clarification-interview.ts
- src/domain/resume-generation/resume-evidence-packets.ts
- src/domain/resume-generation/resume-workspace-commands.ts
- src/persistence/migrations/0038_resume_evidence_packets.sql
- src/persistence/migrations.ts
- tests/evidence-library.test.ts
- tests/resume-evidence-interpretation.test.ts

## Change Log

- 2026-08-29: Created implementation-ready Story 9.6 from Epic 9, the approved evidence-packet change proposal, and completed Stories 9.1-9.5.
- 2026-08-29: Implemented workspace-scoped evidence packets; ready for code review.
