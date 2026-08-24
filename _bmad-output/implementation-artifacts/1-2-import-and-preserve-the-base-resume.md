---
baseline_commit: NO_VCS
---

# Story 1.2: Import and preserve the Base Resume

Status: done

## Story

As Adrian, I want to import my existing LaTeX resume as a protected Base Resume, so that tailoring never damages my original source or formatting.

## Acceptance Criteria

1. Import `resume.tex` plus supported companion source/output files; record immutable source metadata, SHA-256 digest, UTC import time, and private relative storage location.
2. Candidate Profile visibly presents each Base Resume as read-only and distinct from future Drafts and Material Versions.
3. A malformed, unreadable, or duplicate import leaves existing Base Resumes unchanged, identifies only the affected filename, provides a safe next action, and writes metadata-only audit output.
4. File-selection state, validation errors, and read-only state are programmatically exposed and keyboard-operable.

## Tasks / Subtasks

- [x] 1. Add immutable Base Resume persistence (AC: 1, 3)
  - [x] Add migration `0003_base_resume.sql`; never edit applied migrations 0001/0002.
  - [x] Create `base_resumes` and imported-file records using UUIDv7, UTC timestamps, SHA-256 digests, relative private storage locations, and constraints preventing mutable replacement.
  - [x] Register the checked-in SQL migration as the single runtime source and add repository queries/inserts only; no update/delete path.

- [x] 2. Implement a server-only, transactional import command (AC: 1, 3)
  - [x] Require exactly one readable `.tex` primary file and accept a conservative documented companion allowlist; reject directories, missing files, duplicate primary digests, and unsupported/oversized inputs with safe errors.
  - [x] Hash and stage copies beneath private app-data; never move, alter, parse, compile, or overwrite the root `resume.tex`.
  - [x] Commit database metadata plus a metadata-only audit event in one command; clean only newly staged temporary data on failure and preserve existing imports.

- [x] 3. Add the Candidate Profile import/read-only UI (AC: 2, 4)
  - [x] Use a labeled file selector and explicit Import action through a server action. Show selected filenames, safe validation feedback, and a polite status region.
  - [x] Render imported Base Resume metadata as `Read-only Base Resume`, clearly separate from unavailable Drafts and Material Versions; provide no edit/delete controls.
  - [x] Do not display absolute paths, resume text, content bytes, digests, tokens, or raw errors.

- [x] 4. Test import integrity and accessibility (AC: 1-4)
  - [x] Test digest/metadata persistence, copied bytes, relative path storage, and unchanged source input.
  - [x] Test duplicate, malformed, missing/unreadable, unsupported, and staged-copy failure paths; existing rows/files must survive.
  - [x] Test audit records contain IDs/digests/outcome only, and UI renders labels, error association, status text, and keyboard-operable controls.
  - [x] Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`.

### Review Findings

- [x] [Review][Patch] Configure a bounded Server Action upload limit and reject file count/size before reading upload bytes [next.config.ts:3; src/app/actions.ts:26]
- [x] [Review][Patch] Associate Base Resume validation errors with the file selector programmatically [src/app/base-resume-importer.tsx:18]
- [x] [Review][Patch] Identify the offending filename for every malformed or unsupported selection [src/domain/base-resume/import-base-resume.ts:25]
- [x] [Review][Patch] Enforce exact SHA-256 values and traversal-free private storage locations in the Base Resume schema [src/persistence/migrations/0003_base_resume.sql:4]
- [x] [Review][Patch] Prevent companion records from being appended after a Base Resume import is finalized [src/persistence/migrations/0003_base_resume.sql:9]
- [x] [Review][Patch] Normalize concurrent duplicate-primary failures to the duplicate safe-error contract [src/domain/base-resume/import-base-resume.ts:66]
- [x] [Review][Patch] Preserve a safe recovery state when the existing Base Resume database cannot be read [src/domain/base-resume/list-base-resumes.ts:11]
- [x] [Review][Patch] Refresh the read-only Base Resume list after a successful import [src/app/actions.ts:30]
- [x] [Review][Patch] Ensure staging cleanup cannot mask the original import failure or its audit event [src/domain/base-resume/import-base-resume.ts:77]

## Developer Guardrails

- AD-1, AD-4, AD-7, and AD-10 are binding. Keep all filesystem/SQLite access server-side and local; no network, AI, TeX execution, evidence extraction, or Google work.
- Base Resume content is immutable at both schema/repository and UI boundaries. Story 1.3 alone handles evidence extraction/review; Stories 4.x alone create drafts/materials.
- Store only relative private locations in SQLite/audit, never absolute paths or raw content. Audit action/outcome/entity UUID/content digest only; preserve the strict audit key/digest validation introduced in Story 1.1.
- Use existing conventions: `@/` imports, checked-in SQL migrations loaded by `src/persistence/migrations.ts`, `DatabaseSync`, UUIDv7 from `createUuidV7`, ISO UTC, and safe errors (`code`, `summary`, `safeNextAction`, affected IDs).
- Update, do not replace: `src/app/page.tsx`, `src/app/actions.ts`, `src/files/app-data.ts`, `src/persistence/migrations.ts`, and audit action typing. Add narrow base-resume domain/repository/UI modules and tests.
- Preserve Story 1.1's explicit user action -> domain command -> SQLite transaction -> audit -> render flow and its Windows-account/full-disk-encryption disclosure.

## References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 1, Story 1.2]
- [Source: `_bmad-output/specs/spec-personal-job-discovery-and-application-materials-tool/SPEC.md` — CAP-1, CAP-2, CAP-16; Constraints]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-Resume-2026-08-07/ARCHITECTURE-SPINE.md` — AD-1, AD-4, AD-7, AD-10; Consistency Conventions]
- [Source: `_bmad-output/implementation-artifacts/1-1-start-a-private-local-workspace.md` — completed implementation and review learnings]

## Dev Agent Record

### Completion Notes List

- Ultimate context engine analysis completed; comprehensive developer guide created from the full approved artifact set and completed Story 1.1.
- Implemented immutable Base Resume schema and database triggers, with UUIDv7 identifiers, UTC timestamps, SHA-256 metadata, and private relative file locations. Existing migrations remain untouched.
- Added server-only staged import handling for one `.tex` file plus `.pdf`, `.aux`, `.log`, `.out`, and `.synctex.gz` companions. It validates conservative limits, preserves source bytes, rejects duplicates, cleans new staging data on failure, and emits only metadata audit events.
- Added a keyboard-operable Candidate Profile import control with selected-file feedback, polite status updates, safe recovery guidance, and a read-only Base Resume list that omits paths, content, and digests.
- Validation passed: `npm test` (10 passing), `npm run typecheck`, `npm run lint`, and `npm run build`.
- Resolved all nine code-review findings: bounded Server Action upload handling, associated accessible errors, filename-specific validation, sealed exact-digest metadata, concurrency-safe duplicate errors, safe unavailable-data state, immediate UI refresh, and non-masking cleanup.

### Debug Log References

- Red phase: `npm test` initially failed because the Base Resume import domain module and import UI did not yet exist.
- Final verification: `npm test` (10 passing), `npm run typecheck`, `npm run lint`, and `npm run build` all pass.

### File List

- `_bmad-output/implementation-artifacts/1-2-import-and-preserve-the-base-resume.md` (created)
- `src/persistence/migrations/0003_base_resume.sql` (created)
- `src/persistence/migrations.ts` (modified)
- `src/persistence/base-resume-repository.ts` (created)
- `src/domain/base-resume/import-base-resume.ts` (created)
- `src/domain/base-resume/list-base-resumes.ts` (created)
- `src/files/app-data.ts` (modified)
- `src/audit/audit-event.ts` (modified)
- `src/domain/workspace/types.ts` (modified)
- `src/app/actions.ts` (modified)
- `src/app/base-resume-importer.tsx` (created)
- `src/app/page.tsx` (modified)
- `tests/base-resume-import.test.ts` (created)
- `tests/base-resume-ui.test.ts` (created)
- `tests/base-resume-action.test.ts` (created)
- `next.config.ts` (modified)

## Change Log

- 2026-08-08: Implemented immutable local Base Resume import, read-only Candidate Profile presentation, metadata-only audit coverage, and accessibility/integrity tests; moved to review.
- 2026-08-08: Resolved all Story 1.2 code-review findings and moved the story to done.
