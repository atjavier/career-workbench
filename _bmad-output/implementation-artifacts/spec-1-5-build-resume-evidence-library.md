---
title: 'Story 1.5 - Build Resume Evidence Library'
type: 'feature'
created: '2026-08-22'
status: 'done'
review_loop_iteration: 0
baseline_commit: NO_VCS
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-22.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** Career evidence is currently scattered across project folders and cannot safely become a complete, reviewable foundation for later resume updates. The local app only imports a LaTeX Base Resume and extracts line-based facts, which does not meet the new library-first workflow.

**Approach:** Create a visible `resume-evidence/` folder beside this application. Add separate user-started Project and Experience imports that copy supported Markdown into the managed library, extract unreviewed factual candidates with heading/line provenance, and reuse individual evidence review before any fact is claim-eligible.

## Boundaries & Constraints

**Always:** Keep the library at `{project-root}/resume-evidence/`; copy rather than move or modify selected source folders; accept Markdown only in this story; recurse only during an explicit import or Refresh Library action; preserve existing SQLite/audit/privacy/accessibility invariants; retain source document/section provenance; use existing individual approve/edit/reject/remove evidence lifecycle; keep file and database access server-side and local-only.

**Ask First:** Adding PDF parsing, OCR, LM Studio use, automatic folder watching, non-Markdown support, a material renderer, or moving/deleting the existing `AgriMart`, `ARTEMIS`, `BioEvidence`, and `MetaWatt` folders.

**Never:** Do not modify migrations 0001-0005 or existing Base Resume/evidence records; do not expose absolute paths, raw filesystem errors, document bytes, digests, or audit payloads in the UI; do not upload/network, add background tasks, or make unapproved evidence usable.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
| --- | --- | --- | --- |
| Add Project | Explicit folder selection with Markdown files | Copies a bounded project subtree under `resume-evidence/projects/`, creates unreviewed evidence candidates with source heading/line provenance | Reject unsafe paths, symlinks, unsupported files, and duplicate import without changing existing library/evidence |
| Add Experience | Explicit Markdown file selection or entered Markdown content | Stores an experience document under `resume-evidence/experiences/` and creates unreviewed candidates | Require non-empty content/name; safe validation feedback and failure audit only |
| Refresh Library | Explicit action against existing managed library | Re-reads managed Markdown and adds only new/deduplicated candidates; no watcher is created | Report unavailable/unsafe files and retain prior reviewed state |
| Review evidence | Candidate from library import | Existing individual approval lifecycle makes only approved current revision claim-eligible | Stale/rejected/removed candidates remain ineligible |

</frozen-after-approval>

## Code Map

- `src/files/app-data.ts` - private-root conventions; extend only if common safe path helpers are needed.
- `src/files/evidence-library.ts` - new bounded workspace-root library paths, copy, traversal/reparse-point checks, and Markdown enumeration.
- `src/persistence/migrations/0006_evidence_library.sql` - append-only library-document/import provenance tables; preserves legacy resume/evidence tables.
- `src/persistence/evidence-library-repository.ts` - library document/import metadata and idempotency queries/inserts.
- `src/domain/evidence/evidence-commands.ts` - reuse or narrowly extend immutable unreviewed evidence creation with library provenance.
- `src/domain/evidence/evidence-library.ts` - explicit project/experience import and refresh commands.
- `src/app/actions.ts`, `src/app/page.tsx` - server actions and server-loaded view state.
- `src/app/evidence-library.tsx` - new accessible Resume & Evidence Library controls and library inventory.
- `src/audit/audit-event.ts`, `src/domain/workspace/types.ts` - allowlisted metadata-only actions and safe errors.
- `tests/evidence-library.test.ts`, `tests/evidence-library-ui.test.ts` - domain, safety, provenance, and accessibility coverage.

## Tasks & Acceptance

**Execution:**

- [x] `src/persistence/migrations/0006_evidence_library.sql`, `src/persistence/migrations.ts`, `src/persistence/evidence-library-repository.ts` -- add append-only managed-library metadata, source identity/digest deduplication, and repository queries without changing legacy tables.
- [x] `src/files/evidence-library.ts`, `src/domain/evidence/evidence-library.ts` -- implement explicit bounded Markdown project/experience import and refresh; copy only into the workspace-root library, reject traversal/reparse points and preserve original inputs.
- [x] `src/domain/evidence/evidence-commands.ts`, `src/audit/audit-event.ts`, `src/domain/workspace/types.ts` -- create unreviewed immutable candidates with library file/heading/line provenance and metadata-only success/failure audits.
- [x] `src/app/evidence-library.tsx`, `src/app/actions.ts`, `src/app/page.tsx`, `src/app/globals.css` -- present accessible Add Project, Add Experience, and Refresh Library actions plus inventory/recovery states; retain existing evidence-review controls.
- [x] `tests/evidence-library.test.ts`, `tests/evidence-library-ui.test.ts` -- cover the I/O matrix, provenance, duplicate/stale safety, no source mutation, no watcher/network behavior, labels, associated errors, keyboard-native controls, and status announcements.

**Acceptance Criteria:**

- Given approved evidence-library content, when a later consumer asks for claim-eligible evidence, then it receives only current approved revisions through the existing canonical query.
- Given an existing source project folder, when it is added, then its original files remain byte-for-byte unchanged and any managed copy is beneath `resume-evidence/`.
- Given an unsupported or unsafe selection, when import is attempted, then the library, reviewed evidence, and source folder remain unchanged and the user receives a safe next action.

## Design Notes

The workspace-root library is intentionally visible and user-managed. SQLite stores relative library paths and metadata only; the UI displays document category/name and never a local absolute path. Story 1.5 does not parse PDFs or call AI: those belong to Stories 1.6 and 1.7 after this durable evidence contract is working.

## Verification

**Commands:**

- `npm test` -- expected: all existing and new Node tests pass.
- `npm run typecheck` -- expected: no TypeScript errors.
- `npm run lint` -- expected: no lint errors.
- `npm run build` -- expected: production build succeeds.

### Review Findings

- [x] [Review][Patch] Reject a managed-library folder as an Add Project source, because importing `resume-evidence/` (or a child) creates the destination inside the selected source and mutates it. [src/files/evidence-library.ts:26]
- [x] [Review][Patch] Deduplicate the same project source regardless of the user-selected library name; the current source identity is derived only from that name, so the same folder can be copied and candidate evidence created repeatedly under different names. [src/domain/evidence/evidence-library.ts:22]
- [x] [Review][Patch] Skip an existing empty `projects` or `experiences` category during managed-library enumeration so an empty category does not make Refresh Library and inventory unavailable. [src/files/evidence-library.ts:41]
- [x] [Review][Patch] Enforce the 2 MB Markdown limit for entered Experience text before encoding or writing it, matching the file-import bound. [src/files/evidence-library.ts:34]
- [x] [Review][Patch] Parse fenced Markdown blocks with matching delimiter character and minimum delimiter length, so malformed or mixed fences cannot create evidence candidates from code-block content. [src/domain/evidence/evidence-library.ts:16]
- [x] [Review][Patch] Close the source-file symlink time-of-check/time-of-use gap between validation and reading, so a swapped source entry cannot import content outside the selected project folder. [src/files/evidence-library.ts:21]

## Suggested Review Order

**User flow and review safety**

- Starts every library mutation through one explicit, accessible action surface.
  [`evidence-library.tsx:8`](../../src/app/evidence-library.tsx#L8)

- Keeps server actions local and converts failures to safe feedback.
  [`actions.ts:64`](../../src/app/actions.ts#L64)

**Bounded managed-library import**

- Captures strict UTF-8 bytes once, protects paths, and atomically copies only Markdown.
  [`evidence-library.ts:19`](../../src/files/evidence-library.ts#L19)

- Persists unreviewed provenance candidates and cleans copies after failed persistence.
  [`evidence-library.ts:20`](../../src/domain/evidence/evidence-library.ts#L20)

**Immutable provenance and recovery**

- Adds library-document and import metadata without changing prior evidence tables.
  [`0006_evidence_library.sql:1`](../../src/persistence/migrations/0006_evidence_library.sql#L1)

- Supports Windows-valid library names while retaining traversal protections.
  [`0007_evidence_library_windows_paths.sql:1`](../../src/persistence/migrations/0007_evidence_library_windows_paths.sql#L1)

**Regression coverage**

- Exercises imports, safety failures, cleanup, refresh, concurrency, and evidence eligibility.
  [`evidence-library.test.ts:1`](../../tests/evidence-library.test.ts#L1)

- Checks labels, keyboard-native controls, and status feedback in the new UI.
  [`evidence-library-ui.test.ts:5`](../../tests/evidence-library-ui.test.ts#L5)
