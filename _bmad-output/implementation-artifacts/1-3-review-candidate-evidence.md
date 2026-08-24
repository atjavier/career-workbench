---
baseline_commit: NO_VCS
---

# Story 1.3: Review candidate evidence

Status: done

## Story

As Adrian, I want to review individual extracted and user-entered facts, so that only truthful, supported evidence is eligible for future fit and material claims.

## Acceptance Criteria

1. Given an imported Base Resume or supporting material, when facts are extracted or added manually, each immutable evidence revision identifies origin, source document/section, factual text, revision, and review state.
2. Given an unreviewed evidence record, when Adrian individually approves, edits, rejects, removes, or adds it, the action is auditable and each content or state change creates a new immutable revision.
3. Given unreviewed, rejected, removed, or superseded evidence, when a later module asks for claim-eligible facts, the canonical query excludes it; only current approved revisions are returned.
4. The Candidate Profile evidence UI renders extracted and user-entered origin, source/section, revision, state, actions, and validation feedback as text; all controls are keyboard-operable and errors are programmatically associated.

## Tasks / Subtasks

- [x] 1. Add append-only evidence persistence and canonical eligibility query (AC: 1-3)
  - [x] Add checked-in migration `0004_evidence.sql`; do not change 0001-0003. Create stable evidence identities and immutable revisions with UUIDv7 IDs, UTC timestamps, source provenance, revision lineage, digest, and enum/check constraints.
  - [x] Add database triggers rejecting update/delete of evidence revisions and repository queries for current revisions plus `listClaimEligibleEvidence`; it must return only current approved revisions.
  - [x] Use `removed` as a retained lifecycle state, never physical delete. Reject stale mutation requests using the expected current revision ID.

- [x] 2. Implement server-only individual evidence commands (AC: 1-3)
  - [x] Add deterministic local extraction from the copied `.tex` Base Resume only: produce unreviewed candidates with exact source filename and line/section locator; do not modify, compile, or parse the root `resume.tex`, use AI, network, TeX, adapters, or background work.
  - [x] Add manual evidence, approve, edit, reject, and remove commands. Manual entries require factual text and a non-sensitive source reference/section; edits and all state changes append successors rather than updating rows.
  - [x] Keep the mutation path UI action -> domain command -> one SQLite transaction -> metadata-only audit -> rendered state. Extend strict audit action typing and safe errors; audit IDs/action/outcome/digest only, never factual text, source text, paths, or diagnostics.

- [x] 3. Build accessible individual evidence review in Candidate Profile (AC: 1, 2, 4)
  - [x] Preserve the read-only Base Resume list and its no-path/no-digest disclosure. Add empty/no-Base-Resume/recovery guidance without fabricating extracted facts.
  - [x] Add explicit Extract facts and Add evidence actions. Render each evidence item with text labels for Extracted/User-entered origin, source and section, revision, state, factual text, and individual Approve/Edit/Reject/Remove actions; do not add bulk actions.
  - [x] Use native labelled controls, `aria-invalid`/`aria-describedby` for manual/add-edit validation, polite status announcements, visible focus, and keyboard operation. Revalidate the Candidate Profile after a successful action; never rely on color alone.

- [x] 4. Test evidence integrity, eligibility, audit, and accessibility (AC: 1-4)
  - [x] Test extraction and manual add provenance, immutable revision lineage, stale-action rejection, and that Base Resume/root input bytes remain unchanged.
  - [x] Test approve/edit/reject/remove transitions and prove the canonical eligibility query excludes unreviewed, rejected, removed, and superseded revisions.
  - [x] Test malformed provenance/text, unavailable data, and action failures retain prior data and produce safe metadata-only audit output.
  - [x] Test UI labels, origin/state text, individual keyboard controls, associated errors, and status announcements. Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`.

### Review Findings

- [x] [Review][Patch] Let the user select every imported Base Resume before extraction [src/app/evidence-review.tsx:15]
- [x] [Review][Patch] Associate add source fields and per-item edit validation errors with their controls [src/app/evidence-review.tsx:16]
- [x] [Review][Patch] Reject UNC, device, URI, and traversal-like manual provenance paths before rendering [src/domain/evidence/evidence-commands.ts:15]
- [x] [Review][Patch] Validate bounded extracted candidates and provide safe recovery when none are found [src/domain/evidence/evidence-commands.ts:27]
- [x] [Review][Patch] Enforce same-record, linear immutable evidence revision lineage in the schema [src/persistence/migrations/0004_evidence.sql:2]
- [x] [Review][Patch] Render a safe recovery state instead of an empty list when stored evidence cannot be read [src/domain/evidence/list-stored-evidence.ts:7]
- [x] [Review][Patch] Make removed evidence terminal and hide unavailable review actions [src/domain/evidence/evidence-commands.ts:20]
- [x] [Review][Patch] Append metadata-only failure audit events for failed evidence-review attempts [src/domain/evidence/evidence-commands.ts:19]

## Developer Guardrails

- AD-1, AD-4, AD-7, and AD-10 are binding. Keep filesystem and SQLite access server-side/local-only; bind loopback only. Do not add product auth, public APIs, cloud storage, telemetry, network calls, LM Studio, Google, TeX execution, or background jobs.
- Base Resume imports remain immutable. Read only the private copied `.tex` file for deterministic extraction; never move, modify, or compile the workspace-root `resume.tex`, its private import copy, or `base_resumes` records. Do not build general supporting-material import in this story.
- Evidence revisions, not mutable records, are the future provenance authority. Every later consumer must use `listClaimEligibleEvidence`, never ad-hoc UI filtering. A changed fact must reset to unreviewed and need approval again.
- Do not invent semantic/AI extraction. Use a bounded, deterministic line-oriented `.tex` candidate extractor with a truthful source locator (filename + line/section); Adrian reviews every candidate before it becomes eligible.
- Preserve the existing Story 1.1/1.2 conventions: `@/` aliases, `DatabaseSync`, checked-in SQL migrations loaded by `src/persistence/migrations.ts`, UUIDv7 from `createUuidV7`, ISO UTC, `WorkspaceError` safe contract, `createAuditEvent`, `revalidatePath("/")`, and Node `node:test` with temporary app-data roots.
- Current server-action uploads have a 16 MB request limit and preflight limit checks. Do not change Base Resume import semantics while adding evidence UI.
- UI must never display absolute paths, source bytes, digests, tokens, raw SQL/filesystem errors, or audit payloads. Keep the Windows OS-account/full-disk-encryption disclosure truthful.

### Expected Files

```text
src/persistence/migrations/0004_evidence.sql       # new immutable evidence schema
src/persistence/migrations.ts                      # register migration only
src/persistence/evidence-repository.ts             # queries/inserts only
src/domain/evidence/                                # extraction and individual commands
src/audit/audit-event.ts                            # strict evidence audit actions
src/domain/workspace/types.ts                       # evidence safe-error codes
src/app/actions.ts                                  # server actions only
src/app/page.tsx                                    # server-loaded evidence state
src/app/evidence-review.tsx                         # accessible client controls
tests/evidence.test.ts                              # integrity, eligibility, audit
tests/evidence-ui.test.ts                           # rendered accessibility contract
```

### Previous Story Intelligence

- Story 1.2 is done after review remediation. Its Base Resume schema has exact SHA-256 checks, traversal-free relative storage locations, sealed companion manifests, and no update/delete path. Reuse it; do not alter migration 0003.
- Story 1.2 added error association, server-action preflight limits, safe unavailable-data rendering, concurrent duplicate normalization, revalidation, and cleanup that preserves original failures. Extend these patterns rather than replacing them.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 1, Story 1.3]
- [Source: `_bmad-output/specs/spec-personal-job-discovery-and-application-materials-tool/SPEC.md` — CAP-1, CAP-2; Constraints]
- [Source: `_bmad-output/specs/spec-personal-job-discovery-and-application-materials-tool/acceptance-criteria.md` — CAP-1, CAP-2, CAP-10, CAP-16]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-Resume-2026-08-07/ARCHITECTURE-SPINE.md` — AD-1, AD-4, AD-7, AD-10; Consistency Conventions]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-Resume-2026-08-06/DESIGN.md` and `EXPERIENCE.md` — accessibility/state patterns]
- [Source: `_bmad-output/implementation-artifacts/1-2-import-and-preserve-the-base-resume.md` — completed local import and review learnings]
- [Source: Node.js SQLite documentation — `DatabaseSync` and transactional local persistence]
- [Source: Next.js Forms guide — Server Actions and `useActionState` validation/outcome pattern]

## Dev Agent Record

### Agent Model Used

GPT-5.6-Codex

### Debug Log References

### Completion Notes List

- Ultimate context engine analysis completed; comprehensive developer guide created from the approved product, architecture, UX, and prior-story artifacts.
- Implemented immutable evidence revisions, current approved-only eligibility, deterministic copied-Base-Resume extraction, individual audited review commands, and accessible Candidate Profile controls.
- Validation passed: `npm test` (16 passing), `npm run typecheck`, `npm run lint`, and `npm run build`.
- Resolved all eight review findings and revalidated the evidence workflow.

### File List

- `_bmad-output/implementation-artifacts/1-3-review-candidate-evidence.md` (created)
- `src/persistence/migrations/0004_evidence.sql` (created)
- `src/persistence/migrations.ts` (modified)
- `src/persistence/evidence-repository.ts` (created)
- `src/domain/evidence/evidence-commands.ts` (created)
- `src/domain/evidence/list-stored-evidence.ts` (created)
- `src/audit/audit-event.ts` (modified)
- `src/domain/workspace/types.ts` (modified)
- `src/app/actions.ts` (modified)
- `src/app/evidence-review.tsx` (created)
- `src/app/page.tsx` (modified)
- `tests/evidence.test.ts` (created)
- `tests/evidence-ui.test.ts` (created)

## Change Log

- 2026-08-08: Created Story 1.3 implementation context and marked ready for development.
- 2026-08-08: Implemented Story 1.3 evidence review and moved it to review.
- 2026-08-08: Resolved Story 1.3 review findings and moved it to done.
