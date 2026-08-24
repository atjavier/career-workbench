---
baseline_commit: NO_VCS
---

# Story 1.7: Document Project for Resume

Status: done

## Story

As Adrian, I want to optionally analyze a selected project/document folder with my local model, so that I can add standardized proposed evidence without altering the original project.

## Acceptance Criteria

1. Given Document for Resume is chosen from Add Project and Adrian confirms the disclosure, only the selected folder's permitted Markdown content is sent to the configured loopback LM Studio model; no other workspace content, upload, retry, cloud fallback, tool use, or background processing occurs.
2. Given a successful response, the app creates reviewable, unapproved resume-evidence proposals containing a factual candidate, source reference(s), and explicit unknowns. It never writes a source folder, `resume-evidence/`, or an evidence record until individual review accepts it.
3. Given an unavailable/malformed/oversized model response, cancellation, invalid folder, disclosure rejection, or unsafe input, no proposal/evidence/library state changes; errors are actionable and all audit records are metadata-only.
4. Given a proposed item is accepted, edited, or rejected, the decision is individual, stale-safe, append-only, auditable, and accepted factual text enters the existing evidence-review pathway as unreviewed evidence. Only subsequently approved evidence can support claims.
5. The accessible Resume & Evidence Library UI identifies the selected folder, local model disclosure, source-folder non-mutation, proposal state, individual controls, cancel path, and terminal status without showing absolute paths, prompts, raw content, response diagnostics, tokens, credentials, or audit payloads.

## Tasks / Subtasks

- [x] 1. Add append-only documenter proposal persistence and safe contracts (AC: 2-4)
  - [x] Add migration, repository, domain types, UUIDv7/timestamp/digest constraints, immutable triggers, and metadata-only audit actions.
  - [x] Keep proposals distinct from `evidence_revisions`; preserve existing evidence and library tables.
- [x] 2. Implement restricted selected-folder collection and loopback adapter (AC: 1, 3)
  - [x] Reuse safe Markdown-only traversal/bounds/UTF-8/reparse-point protections from `src/files/evidence-library.ts`; never expose absolute paths.
  - [x] Add server-only `adapters/evidence-documenter` using native `fetch`, fixed `127.0.0.1` OpenAI-compatible LM Studio endpoint, configured `LM_STUDIO_MODEL`/optional token, bounded timeout/body, no retries or fallback.
  - [x] Require explicit disclosure confirmation before collection or model invocation; validate untrusted model JSON into bounded factual candidates, source-relative references, and unknowns.
- [x] 3. Add proposal generation and individual review commands (AC: 2-4)
  - [x] Generate idempotent proposal sets for one selected folder; audit IDs/digests/outcomes only.
  - [x] Resolve one proposal at a time with optimistic revision IDs; accepted/edited text creates unreviewed evidence through existing evidence commands without bypassing approval.
- [x] 4. Extend Resume & Evidence Library UI and server actions (AC: 1-5)
  - [x] Add optional Document for Resume branch to Add Project with source-directory input, disclosure checkbox, explicit start and cancel controls, accessible feedback, and no path/raw-model disclosure.
  - [x] Render proposed items with source references/unknowns and native approve/edit/reject controls; retain existing manual Add Project, Add Experience, and Refresh behavior.
- [x] 5. Verify privacy, provenance, failures, and accessibility (AC: 1-5)
  - [x] Add adapter/domain tests using a stubbed loopback fetch: consent gate, URL enforcement, bounded request/response, no retry, safe failure, no raw audit data, and selected-folder-only Markdown collection.
  - [x] Test immutable/stale proposal decisions, accepted evidence remains unreviewed/ineligible, rejected/cancelled/failed flows leave state unchanged, and source folders stay byte-for-byte unchanged.
  - [x] Test labels, disclosure, cancel, keyboard-native review controls, associated errors/status, and absence of sensitive UI output. Run test, typecheck, lint, build.

### Review Findings

- [x] [Review][Patch] Reject mixed unsafe model source references [src/adapters/evidence-documenter/lm-studio-documenter.ts:15]
- [x] [Review][Patch] Reject empty model proposal responses rather than persisting a permanent empty proposal set [src/adapters/evidence-documenter/lm-studio-documenter.ts:37]
- [x] [Review][Patch] Require an explicit bounded unknowns value for every proposal [src/adapters/evidence-documenter/lm-studio-documenter.ts:16]
- [x] [Review][Patch] Deduplicate normalized proposals before the unique digest constraint is written [src/domain/evidence/evidence-documenter.ts:28]
- [x] [Review][Patch] Bound serialized unknowns before database persistence [src/domain/evidence/evidence-documenter.ts:18]
- [x] [Review][Patch] Recompute proposal content digests at the domain trust boundary [src/domain/evidence/evidence-documenter.ts:18]
- [x] [Review][Patch] Record documenter-specific metadata-only failure audits [src/domain/evidence/evidence-documenter.ts:29]
- [x] [Review][Patch] Surface documenter proposal read failures through accessible recovery feedback [src/app/page.tsx:23]
- [x] [Review][Patch] Route accepted and edited proposals through the shared evidence-command policy [src/domain/evidence/evidence-documenter.ts:32]
- [x] [Review][Patch] Make cancellation/rejection controls operable and status-visible [src/app/evidence-library.tsx:14]

## Dev Notes

- This is optional and user-started. Do not create the reusable `resume-evidence-documenter` Codex skill here; that is Story 1.8.
- Model configuration is server environment only: `LM_STUDIO_MODEL` is required; endpoint is fixed to loopback `http://127.0.0.1:1234/v1/chat/completions`; `LM_STUDIO_API_TOKEN` is optional and must never reach browser/audit/storage. If unavailable, fail safely with setup guidance.
- Use a typed source-directory field consistent with current Add Project. No browser directory upload or watcher is in scope.
- Treat model output as untrusted. Do not persist raw prompt/response; persist only normalized proposal fields and their digests. Proposed source references must be relative to the selected folder and safe.
- Do not call `refreshEvidenceLibrary` or create a partial managed library as part of documentation. Original selected folders remain read-only.
- Reuse `WorkspaceError`, `createAuditEvent`, `createUuidV7`, `applyMigrations`, `revalidatePath('/')`, `useActionState`, and current individual evidence review patterns.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` - Story 1.7]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-Resume-2026-08-07/ARCHITECTURE-SPINE.md` - approved change]
- [Source: `_bmad-output/planning-artifacts/prds/prd-Resume-2026-08-06/prd.md` - approved change]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-Resume-2026-08-06/EXPERIENCE.md` - approved change]
- [Source: `src/files/evidence-library.ts` - safe Markdown traversal]
- [Source: `src/domain/evidence/evidence-commands.ts` - append-only evidence review]

## Dev Agent Record

### Completion Notes List

- 2026-08-22: Comprehensive implementation context created from approved product, architecture, UX, and Story 1.6 patterns.
- 2026-08-23: Added immutable documenter proposal sets and per-proposal decision records. Accepted or edited decisions atomically create ordinary unreviewed evidence; rejected decisions create no evidence.
- 2026-08-23: Reused bounded Markdown traversal and added a fixed loopback LM Studio gateway with explicit consent, request/response limits, no retry/fallback, and metadata-only auditing.
- 2026-08-23: Preserved manual Add Project, Add Experience, and Refresh flows; added persisted accessible proposal review controls and dedicated privacy, provenance, and stale-decision tests.
- 2026-08-23: Code review resolved all ten findings: hardened model-response validation and bounds, unified accepted evidence creation with existing command policy, corrected documenter failure auditing, and improved proposal recovery/cancellation controls.

### Debug Log

- `npm run typecheck` (pass), `npm run lint` (pass), `npm test` (37 passing), `npm run build` (pass) on 2026-08-23.

### File List

- src/persistence/migrations/0010_evidence_documenter_proposals.sql
- src/persistence/migrations.ts
- src/persistence/evidence-documenter-repository.ts
- src/domain/evidence/evidence-documenter.ts
- src/domain/evidence/evidence-commands.ts
- src/adapters/evidence-documenter/lm-studio-documenter.ts
- src/audit/audit-event.ts
- src/domain/workspace/types.ts
- src/app/actions.ts
- src/app/evidence-library.tsx
- src/app/page.tsx
- tests/evidence-documenter.test.ts
- tests/evidence-documenter-adapter.test.ts

## Change Log

- 2026-08-23: Implemented persistent, append-only Document for Resume proposals, individual stale-safe decisions, metadata-only audits, and privacy/accessibility test coverage; marked ready for review.
- 2026-08-23: Code review completed; all ten findings fixed and all validation checks passed.
