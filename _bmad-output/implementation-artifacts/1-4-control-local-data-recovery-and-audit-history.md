---
baseline_commit: NO_VCS
---

# Story 1.4: Control local data, recovery, and audit history

Status: done

## Story

As Adrian, I want to inspect, back up, restore, and delete my local career-data artifacts through the workspace, so that I remain in control of records and can recover from mistakes.

## Acceptance Criteria

1. **Data & Storage inventory.** Given local records, files, or audit events exist, when Adrian opens Data & Storage, then it identifies each implemented data class, its non-sensitive local/recovery location category, storage usage, and connected-service consequence. It never renders absolute paths, raw files, digests, tokens, credentials, or database diagnostics. Empty and unavailable states state the truth and give a safe next action.
2. **Local backup.** Given Adrian explicitly requests a backup, when it succeeds, then the selected workspace scope is copied only under private app-data, the UI reports what it includes and its non-portable local-only boundary, and it truthfully says protection relies on the Windows OS account and full-disk encryption. It creates no cloud upload, application encryption, portable archive, or overwrite. Source data remains unchanged on failure.
3. **Recoverable ordinary deletion.** Given Adrian deletes a non-sensitive local activity-history export, when the confirmation names the target, recovery deadline, and dependency/connected-service consequences, then confirmation moves it to local trash for exactly 30 days; cancellation changes nothing. It disappears from the active list, remains restorable until expiry, and never mutates a Base Resume, its imported files, or evidence revisions.
4. **Restore and expiry.** Given an ordinary artifact is in trash before its UTC expiry, when Adrian restores it, then it returns to active storage with identity and digest intact and writes a metadata-only audit event. Restore is unavailable after expiry or if it would overwrite an active artifact; an explicit user-triggered cleanup may remove expired trash. No scheduler, background purge, or fabricated completion state is permitted.
5. **Sensitive permanent deletion.** Given Adrian deletes a local backup (a sensitive artifact), when its confirmation states the irreversible local effect and that no connected/remote service is changed, then explicit confirmation permanently deletes only that backup. Cancellation or failure leaves the backup recoverable/unchanged and gives safe recovery guidance. Base Resumes are never eligible for either deletion path.
6. **Activity history.** Given backup, export, trash, restore, cleanup, or permanent deletion occurs, when Adrian views or exports activity history, then it is append-only and metadata-only: UUIDv7 event/entity IDs, UTC storage time rendered locally, local actor, action, outcome, and allowed hash. It excludes raw career content, filenames/paths, prompts, model output, OAuth/LM tokens, credentials, and raw diagnostics.
7. **Accessible, local mutation contract.** Every mutation follows UI action -> server/domain command -> SQLite transaction -> metadata-only audit -> revalidated render, without network calls or background work. Confirmation controls are semantic and keyboard-operable, retain/correct focus on cancel or outcome, associate errors programmatically, and announce each terminal outcome once.

## Tasks / Subtasks

- [x] 1. Add lifecycle metadata and private file handling (AC: 1-5)
  - [x] Add migration `0005_data_lifecycle.sql`; never alter migrations `0001`–`0004`. Persist only UUIDv7 IDs, UTC timestamps, relative app-data locations, data class, byte size, digest, lifecycle state, deleted/expiry timestamps, permitted lineage IDs, monotonic `local_revision`, and `updated_at`. Add constraints/triggers that prevent a trash record from targeting `base_resumes`, `base_resume_files`, `evidence_records`, or `evidence_revisions`. In the new migration, also reject `UPDATE` and `DELETE` on `audit_events` so its append-only contract is database-enforced.
  - [x] Add `src/files/data-lifecycle.ts` for controlled `backups/`, `activity-history-exports/`, staging, and `trash/` locations under `resolveAppDataPaths().root`. Reject traversal/absolute paths, collisions, expired/invalid records, and unsafe overwrite. Use staging plus atomic rename where available; compensate safely if filesystem/SQLite work cannot finish together.
  - [x] Add repository-only queries/inserts for storage inventory, managed artifact lifecycle, and recovery eligibility. Do not let React/client code access filesystem or SQLite.

- [x] 2. Implement local-only commands and audit projection (AC: 2-6)
  - [x] Add server-only Data & Storage commands for: create an app-private workspace backup; create a metadata-only activity-history export; trash/restore an activity-history export; permanently delete a backup; and explicitly clean expired trash. Each mutable command accepts the expected current artifact ID and `local_revision`, rejects stale confirmation safely, and increments the revision/`updated_at` on transition. Classify command targets in code—never accept a client-provided permanence or data-class string.
  - [x] A backup may contain workspace database/file copies but stays under private app-data. It must not be downloadable, encrypted by the application, uploaded, synced, or called portable. It must never overwrite an existing backup; failures preserve active data and staged artifacts are cleaned or remain safely recoverable.
  - [x] Extend the strict `AuditEventInput` action allowlist and reuse `createAuditEvent`/`appendAuditEvent`. Successful and failed lifecycle attempts write only allowed metadata; do not bypass the audit factory. Export history from a safe projection, not raw `audit_events`/database rows.
  - [x] Add narrow `WorkspaceError` codes and safe errors for unavailable storage, stale/expired recovery, invalid confirmation, unsupported target, collision, and lifecycle failure. Never expose a filesystem path, SQL error, content, or stack.

- [x] 3. Build Data & Storage inspection and accessible confirmations (AC: 1-7)
  - [x] Replace the current static Data & Storage panel with server-loaded inventory, managed-backup/activity-export lists, trash/recovery status, and safe unavailable-data rendering. Show location as categories such as “Private local app data” and “Local trash,” not paths.
  - [x] Preserve the current truthful protection disclosure. State that local backups rely on the Windows OS account/full-disk encryption, stay on this device, are not application-encrypted, and do not affect any future Google/other remote copy.
  - [x] Add explicit create backup/export, restore, delete-to-trash, permanent delete, and cleanup controls. Confirmation must bind the exact current artifact ID/revision and disclose local/recovery/remote consequences. Use native labelled controls and a focus-contained dialog or equivalent; Escape/Cancel make no change and restore focus to the invoker.
  - [x] Use `useActionState`, `aria-invalid`, `aria-describedby`, polite `role="status"` results, assertive blocking errors only, visible focus, and responsive stacked records. Do not use hover-only or color-only state/action meaning.

- [x] 4. Verify integrity, safety, and accessibility (AC: 1-7)
  - [x] Add lifecycle/domain tests using temporary app-data roots: inventory and safe audit projection; backup stays private/collision-safe; export/trash/restore preserves digest and exact 30-day UTC eligibility; expired restore is blocked; cleanup is explicit and idempotent; permanent backup delete requires confirmed scoped target; competing/stale confirmations are rejected without mutation.
  - [x] Prove Base Resume rows/files and evidence revisions are unchanged by every Data & Storage action, and no command produces a network request, public path, portable archive, or application-encrypted artifact.
  - [x] Assert audit successes/failures have only the allowlisted fields and exclude content, filenames/paths, prompts, responses, tokens, credentials, and diagnostics. Prove database-level audit `UPDATE`/`DELETE` attempts fail while lifecycle events remain insertable. Verify a filesystem or transaction failure preserves active/recoverable state and returns a safe error.
  - [x] Add UI static/component tests for textual local/recovery/remote consequences, storage usage, confirmation disclosure, keyboard-native controls, focus-safe cancel, associated errors, and status announcements. Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`.

### Review Findings

- [x] [Review][Patch] Submit the intended command for each artifact confirmation [src/app/data-storage.tsx:15]
- [x] [Review][Patch] Create a SQLite-consistent backup instead of copying the live database file [src/files/data-lifecycle.ts:10]
- [x] [Review][Patch] Preserve recoverability when filesystem and lifecycle transactions fail or race [src/domain/data-storage/data-storage.ts:32]
- [x] [Review][Patch] Reject destination collisions before creating, trashing, or restoring artifacts [src/files/data-lifecycle.ts:9]
- [x] [Review][Patch] Reject symlink or junction traversal beneath managed artifact directories [src/files/data-lifecycle.ts:8]
- [x] [Review][Patch] Do not offer Restore for expired trash items [src/app/data-storage.tsx:16]
- [x] [Review][Patch] Provide cancellation, focus-safe confirmation behavior, and assertive blocking errors [src/app/data-storage.tsx:8]
- [x] [Review][Patch] Include a validated affected artifact ID in failure audit events [src/app/actions.ts:76]
- [x] [Review][Patch] Verify backup integrity before permanent deletion [src/domain/data-storage/data-storage.ts:36]
- [x] [Review][Patch] Exclude expired payloads from active storage usage and artifact controls [src/persistence/data-lifecycle-repository.ts:11]

## Developer Guardrails

- **AD-1, AD-7, and AD-10 are binding.** This is local-only server-side Node/SQLite work. Do not add login, public routes, cloud storage, telemetry, networking, Google/LM Studio integration, TeX work, a scheduler, or background cleanup.
- **Preserve immutable source truth.** `base_resumes`, `base_resume_files`, evidence records, and evidence revisions must never be moved, trashed, restored, updated, or deleted. Story 1.3 `removed` evidence stays an immutable lifecycle revision, not trash. Do not add a generic destructive-record API.
- **The supported delete targets are deliberately narrow.** Metadata-only activity-history export is the ordinary recoverable artifact. Local backup is sensitive and may be permanently deleted only after a specific confirmation. Future drafts/material versions may become dependencies later; show “not available/not configured” truthfully today rather than fabricating them.
- **Backups are not encryption work.** Keep all backup data under private app-data. Do not introduce password/key handling, encryption libraries, ZIP/7z archives, browser download, removable-drive target selection, or cloud sync. Warn if a future user-directed copy/export can leave the device.
- **Filesystem and SQLite consistency.** Follow the established migration/repository boundary. Mutable managed artifacts use monotonically increasing `local_revision` and `updated_at`; every confirmation submits the expected revision and stale requests fail safely. Stage files beneath app-data, validate digest/relative path before mutations, then reconcile with a single `BEGIN IMMEDIATE` transaction and metadata audit. If a cross-boundary step fails, preserve the original and a recoverable record; never report success prematurely.
- **Audit remains metadata-only and append-only.** Extend the typed union in `src/audit/audit-event.ts`; add database triggers in migration 0005 that reject audit-row update/delete. Do not write action text, artifact names, paths, raw audit rows, backup bytes, career content, credentials, prompts, responses, or error diagnostics. Display and export a safe projection only.
- **Existing conventions are mandatory.** Use `@/` imports; `resolveAppDataPaths`; `DatabaseSync`; checked-in migration registration; `createUuidV7`; UTC ISO strings; `WorkspaceError`; server actions with `revalidatePath("/")`; `node:test` temporary roots; and safe list-state behavior where only `ENOENT` becomes empty.

### Expected Files

```text
src/persistence/migrations/0005_data_lifecycle.sql  # new lifecycle schema only
src/persistence/migrations.ts                        # register migration only
src/persistence/data-lifecycle-repository.ts         # inventory/lifecycle persistence
src/files/data-lifecycle.ts                           # private staging, backup, trash, restore utilities
src/domain/data-storage/                              # commands and safe read models
src/audit/audit-event.ts                              # strict lifecycle audit action allowlist
src/domain/workspace/types.ts                         # lifecycle safe-error codes
src/app/actions.ts                                   # server actions only
src/app/page.tsx                                     # server-loaded Data & Storage state
src/app/data-storage.tsx                             # accessible inventory/actions/confirmations
tests/data-storage.test.ts                           # lifecycle, integrity, audit tests
tests/data-storage-ui.test.ts                        # accessibility/static UI tests
```

### Previous Story Intelligence

- Story 1.3 is complete after adversarial remediation. It uses append-only evidence revisions, strict audit-action typing, server action revalidation, safe unavailable-data states, UUIDv7/UTC IDs, and Node `node:test` temporary app-data fixtures. Extend these patterns instead of replacing them.
- Its review fixes establish important regressions to avoid: reject UNC/device/URI/traversal paths before rendering; associate every validation error with its control; do not conflate missing storage with an empty list; keep removed evidence terminal; and audit failure attempts with metadata only.
- `src/files/app-data.ts` is the sole private-root authority. Current `Data & Storage` in `src/app/page.tsx` is only a protection disclosure, so Story 1.4 adds functionality beneath it without disturbing Candidate Profile/Base Resume behavior.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 1, Story 1.4; NFR-8/9; UX-DR11–14]
- [Source: `_bmad-output/specs/spec-personal-job-discovery-and-application-materials-tool/SPEC.md` — CAP-16]
- [Source: `_bmad-output/specs/spec-personal-job-discovery-and-application-materials-tool/acceptance-criteria.md` — CAP-16]
- [Source: `docs/decisions/ADR-0001-local-encryption-at-rest.md` — protected-device, non-portable backup decision]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-Resume-2026-08-07/ARCHITECTURE-SPINE.md` — AD-1, AD-7, AD-10; Consistency Conventions]
- [Source: `_bmad-output/implementation-artifacts/1-3-review-candidate-evidence.md` — completed conventions and review remediation]
- [Source: Node.js SQLite documentation — `DatabaseSync` file-backed databases and explicit synchronous operations: https://nodejs.org/api/sqlite.html]

## Dev Agent Record

### Agent Model Used

GPT-5.6-Codex

### Debug Log References

### Completion Notes List

- Ultimate context engine analysis completed — comprehensive developer guide created from the revised product decision, architecture, UX, completed Story 1.3, current source tree, and official Node SQLite documentation.
- Implemented private managed-artifact lifecycle storage, local database backups, metadata-only history exports, 30-day export trash/restore, explicit cleanup, and confirmed backup deletion without touching Base Resumes or evidence.
- Added append-only audit database triggers, safe audit projection, stale revision protection, path/digest validation, accessible Data & Storage controls, and safe unavailable-data rendering.
- Validation passed: `npm test` (20 passing), `npm run typecheck`, `npm run lint`, and `npm run build`.
- Resolved all ten Story 1.4 code-review findings: isolated confirmation forms, SQLite backup/integrity verification, collision and reparse-point guards, safer lifecycle moves, expiry handling, accessible cancellation/status, per-artifact failure audit, and expired-usage exclusion.

### File List

- `_bmad-output/implementation-artifacts/1-4-control-local-data-recovery-and-audit-history.md` (created)
- `src/persistence/migrations/0005_data_lifecycle.sql` (created)
- `src/persistence/migrations.ts` (modified)
- `src/persistence/data-lifecycle-repository.ts` (created)
- `src/files/data-lifecycle.ts` (created)
- `src/domain/data-storage/data-storage.ts` (created)
- `src/audit/audit-event.ts` (modified)
- `src/domain/workspace/types.ts` (modified)
- `src/app/actions.ts` (modified)
- `src/app/page.tsx` (modified)
- `src/app/data-storage.tsx` (created)
- `tests/data-storage.test.ts` (created)
- `tests/data-storage-ui.test.ts` (created)

## Change Log

- 2026-08-09: Created Story 1.4 implementation context and marked ready for development.
- 2026-08-09: Implemented Story 1.4 local lifecycle controls and moved it to review.
- 2026-08-09: Resolved Story 1.4 code-review findings and moved it to done.
