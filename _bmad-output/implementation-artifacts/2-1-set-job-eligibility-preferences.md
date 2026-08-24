---
baseline_commit: NO_VCS
---

# Story 2.1: Set Job Eligibility Preferences

Status: done

## Story

As Adrian,
I want to configure my target roles, location, and work-style preferences,
so that discovery prioritizes opportunities I can realistically pursue.

## Acceptance Criteria

1. **Defaults and editable, accessible preferences**

   **Given** first use or Search Preferences
   **When** Adrian views the preference form
   **Then** it shows editable defaults for fresh-graduate, junior, associate, cadetship, and paid-training role intent; Philippines-first country; Remote first work style; and NCR priority within Hybrid and Onsite results.

   **And** the form uses real labels and keyboard-native controls, communicates validation/status programmatically, does not rely on color alone, preserves entered values on an error, and reflows without losing required content or the Save action.

2. **Versioned local save and audit**

   **Given** valid preference selections
   **When** Adrian explicitly saves them
   **Then** one bounded local SQLite transaction creates an immutable preference revision with a UUIDv7 identifier and UTC ISO-8601 timestamp, makes that revision current, and retains prior revisions.

   **And** it appends a metadata-only audit event in the same successful transaction containing only the local actor, action/outcome, entity/version ID, timestamp, and SHA-256 digest of canonical preference content—never raw preference fields or other sensitive content.

   **And** returning to Search Preferences shows the latest saved revision; first use displays the product defaults without silently writing a revision or audit event merely because the view was opened.

3. **Discovery safety and source-policy independence**

   **Given** Search Preferences is viewed or saved
   **When** the feature completes or fails
   **Then** it performs no network request, source-adapter invocation, source enablement, policy/access-method/budget/rate-limit/retention mutation, Refresh Run, browser automation, scheduler, poller, background job, background refresh, hidden retry, credential reuse, proxying, crawling, or access-control bypass.

   **And** changing country or any preference never weakens or bypasses Source Configuration policy; Story 2.2 remains the only source-configuration gate and Story 2.3 remains the only refresh capability.

4. **Bounded validation, concurrency, and recovery**

   **Given** an invalid, unsupported, stale, or failed preference save
   **When** Adrian submits the form
   **Then** the previously committed current revision and all earlier revisions remain unchanged, no successful revision/audit event is added, and the UI announces a factual error with a reachable safe next action.

   **And** role intent is non-empty and all country, work-style ordering, and NCR-priority values are bounded controlled values; arbitrary/unbounded input is rejected before persistence.

   **And** a stale save is rejected through an explicit optimistic-concurrency token rather than overwriting a newer revision.

## Tasks / Subtasks

- [x] 1. Add a local, revisioned preference persistence model (AC: 1, 2, 4)
  - [x] Create `src/persistence/migrations/0011_job_preferences.sql` with a singleton current-preferences record and append-only immutable revision history. Enforce UUIDv7 IDs, valid digest shape, controlled values, non-empty role intent, UTC timestamps, and a monotonic current revision/version.
  - [x] Add the migration, in order, to `src/persistence/migrations.ts`. Do not alter existing migrations.
  - [x] Add `src/persistence/job-preferences-repository.ts` with narrow reads/inserts/current-revision queries; do not introduce source-configuration or adapter tables in this story.

- [x] 2. Implement a bounded local domain command (AC: 1-4)
  - [x] Create `src/domain/discovery/job-preferences.ts` for defaults, canonical validation, deterministic canonical-content hashing, list/current read, and save.
  - [x] Follow the existing domain pattern: `resolveAppDataPaths` -> `openDatabase` -> `applyMigrations` -> `BEGIN IMMEDIATE` -> command/repository work -> `appendAuditEvent` -> `COMMIT`, with rollback and `database.close()` on every path.
  - [x] Require the current revision ID supplied by the UI for an existing preference record; reject mismatch with a preference-specific `WorkspaceError` and safe recovery action. Preserve prior state on every rejected or failed save.
  - [x] Do not write on first read. The defaults are a pure in-memory view until Adrian explicitly saves.
  - [x] Extend `src/domain/workspace/types.ts` only with precise preference error codes needed for invalid, stale, or unavailable state.

- [x] 3. Preserve audit and discovery-policy boundaries (AC: 2-4)
  - [x] Extend `src/audit/audit-event.ts` only for `discovery.preferences_saved` and, if failure recording is implemented, `discovery.preferences_failed`. Keep `createAuditEvent`'s metadata-only allowlist; never add raw preference payload fields.
  - [x] The success event must use the revision ID and canonical SHA-256 digest. A failure event, if recorded, must be metadata-only and must not turn a failed transaction into a partial save.
  - [x] Do not create `adapters/sources`, make `fetch` calls, mutate a source configuration, or add scheduling/retry infrastructure. Preferences are local eligibility/ranking input only.

- [x] 4. Add the Search Preferences UI and Server Action (AC: 1-4)
  - [x] Add `jobPreferencesAction` to `src/app/actions.ts`: parse only expected form fields, call the domain command, revalidate `/` after success, and map failures through `toSafeWorkspaceError`.
  - [x] Create `src/app/job-preferences.tsx` as a client component using the established `useActionState` pattern. Include labelled native inputs, current-revision token, `aria-invalid`/`aria-describedby`, `role="status"`, `aria-live="polite"`, a disabled pending Save button, and visible safe-next-action text.
  - [x] Update `src/app/page.tsx` to load/render preferences and add a primary navigation anchor for Search Preferences. First use/no data must truthfully say that no source is enabled or refreshed here; it must direct users to Permitted Sources without implying discovery occurred.
  - [x] Reuse the existing global style primitives. Touch `src/app/globals.css` only if a small responsive layout change is truly necessary.

- [x] 5. Prove behavior with adversarial tests (AC: 1-4)
  - [x] Add `tests/job-preferences.test.ts` for exact first-use defaults; no-write/no-audit first read; save/reload; append-only history; UUIDv7, UTC timestamp, and hash-only audit metadata; invalid input; stale/concurrent save; and rollback/preservation after simulated persistence failure.
  - [x] Assert viewing and saving never call a network API, source adapter, refresh/run path, scheduler, poller, background worker, retry, or source-policy/budget/access-method mutation.
  - [x] Add `tests/job-preferences-ui.test.ts` to inspect labels and all required default controls, status/error/recovery semantics, keyboard-native Save controls, value preservation expectations, and absence of Refresh/enable-source controls.
  - [x] Run the full regression suite: `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`.

### Review Findings

- [x] [Review][Patch] Avoid taking a write lock for a read-only preference load [src/domain/discovery/job-preferences.ts:41] — `listJobPreferences()` now opens/applies migrations then reads without `BEGIN IMMEDIATE`, avoiding an unnecessary read-path write lock.
- [x] [Review][Patch] Validate persisted preference arrays before rendering [src/domain/discovery/job-preferences.ts:37] — stored JSON is parsed and passed through the controlled-value validator; invalid persisted content becomes a `JOB_PREFERENCES_UNAVAILABLE` error with recovery guidance instead of reaching the UI.

## Dev Notes

### Architecture and scope guardrails

- This application is a local-first modular monolith: Next.js App Router on `127.0.0.1`, SQLite, and private OS-user app-data are authoritative. No product sign-in/public deployment is in scope.
- Follow the mandatory mutation sequence: explicit UI action -> domain command -> SQLite transaction -> append-only metadata audit event -> optional visible adapter. This story has **no adapter step**.
- AD-5 makes source policy stricter than user preference. A preference must never activate, modify, or create a permitted source. The unresolved permitted-source catalog/request-budget decision blocks Stories 2.2 and 2.3, not this story.
- Use immutable revision rows plus a current pointer/current-record revision. Do not overwrite preference history. Prefer an explicit `expectedRevisionId` over last-write-wins behavior.
- Treat all form input as untrusted. Use small controlled enums/arrays for role intents, country, work-style priority, and NCR hybrid/onsite preference. Validate size, duplication, and allowed values before opening/committing a mutation.
- Recovery is part of the feature: errors use `WorkspaceError(code, summary, safeNextAction, affectedEntityIds?)`; preserve the last committed preference revision and leave the form editable.

### Existing code to preserve

- `src/app/page.tsx` is a dynamic server component that gathers feature state then renders panels. Add the new state without weakening the Resume & Evidence Library or Data & Storage error isolation.
- `src/app/actions.ts` uses Server Actions, `WorkspaceActionState`, `try/catch`, `toSafeWorkspaceError`, and `revalidatePath("/")`. Match that contract; do not expose database details or internal exceptions.
- `src/persistence/database.ts` applies migrations one at a time inside `BEGIN IMMEDIATE` with rollback. Add a new ordered migration only; never edit historical schema migrations.
- `src/audit/audit-event.ts` already enforces UUIDv7 entity IDs, SHA-256 `contentHash`, and a forbidden-sensitive-key policy. Retain that boundary; add only narrow action-union members.
- Existing UI components (`src/app/evidence-library.tsx`, `src/app/current-base-resume.tsx`) use `useActionState`, real labels, native controls, `role="status"`, and `aria-live="polite"`. Reuse this pattern and the existing CSS primitives rather than adding a UI library.

### Technology requirements

- Keep the installed stack: Node.js `>=24.18.0`, TypeScript 5.9.3, Next.js 16.3.0, React 19.2.3, and `node:sqlite`. No dependency or framework upgrade is authorized for this story.
- Current Next.js guidance supports this existing form pattern: a client component can submit to a Server Action with `useActionState`, receive `FormData` after the previous state, and expose pending/error feedback. Continue the project’s established pattern. [Source: Next.js Forms guide, last updated 2026-02-27]

### Project Structure Notes

- New discovery work belongs under `src/domain/discovery/`; keep persistence queries under `src/persistence/`, UI under `src/app/`, and schema evolution under `src/persistence/migrations/`.
- Expected new files: `0011_job_preferences.sql`, `job-preferences-repository.ts`, `job-preferences.ts`, `job-preferences.tsx`, `job-preferences.test.ts`, and `job-preferences-ui.test.ts`.
- Expected updates: `migrations.ts`, `workspace/types.ts`, `audit-event.ts`, `actions.ts`, `page.tsx`, and possibly `globals.css` only for a minimal, necessary responsive adjustment.
- There is no Git repository/history available (`baseline_commit: NO_VCS`); do not claim commit-derived intelligence.

### Testing requirements from the Epic 1 retrospective

- Do not settle for happy-path tests. Prove the safety contract with invalid input, stale/concurrent update, simulated persistence failure, and no-side-effect assertions.
- Explicitly test that first view and save are bounded local operations: no unauthorized access, source-policy mutation, background retrieval, hidden retry, network call, adapter invocation, scheduler, poller, or credential reuse.
- Test recovery behavior: failed saves roll back fully, retain the previous revision, emit only permitted metadata (if a failure audit is recorded), and present an accessible corrective action.
- Retain regression coverage for existing workspace initialization, resume/evidence library, Current Base Resume, and Data & Storage behavior.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` - Epic 2 and Story 2.1]
- [Source: `_bmad-output/planning-artifacts/prds/prd-Resume-2026-08-06/prd.md` - FR-3, FR-4, source integration rules, recovery matrix, and MVP exclusions]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-Resume-2026-08-07/ARCHITECTURE-SPINE.md` - AD-1, AD-5, AD-10, consistency conventions, structural seed]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-Resume-2026-08-06/EXPERIENCE.md` - Search Preferences IA and first-use/recovery behavior]
- [Source: `_bmad-output/implementation-artifacts/epic-1-retro-2026-08-23.md` - Epic 2 source-policy, bounded-operation, and recovery commitments]
- [Source: `src/app/actions.ts`, `src/app/page.tsx`, `src/persistence/database.ts`, `src/audit/audit-event.ts` - existing implementation patterns]
- [Source: [Next.js Forms guide](https://nextjs.org/docs/app/guides/forms) - Server Action and `useActionState` pattern]

## Dev Agent Record

### Agent Model Used

GPT-5.6 Codex

### Debug Log References

- Artifact/context analysis: Epic 2 requirements, PRD, architecture spine, UX contract, Epic 1 retrospective, current code, and tests.
- Technology check: official Next.js Forms guidance (2026-02-27).

### Completion Notes List

- 2026-08-23: Ultimate context engine analysis completed - comprehensive developer guide created.
- Epic 1 retrospective commitments are explicit acceptance criteria and adversarial test requirements for discovery safety, bounded local operations, and recovery.
- 2026-08-23: Implemented local, append-only Search Preferences revisions with optimistic concurrency, metadata-only SHA-256 audit events, and no source/refresh adapter behavior.
- 2026-08-23: Added accessible Search Preferences UI and server action. Verified first-use defaults, save/reload, invalid/stale rejection, rollback on simulated persistence failure, local-only guardrails, typecheck, lint, 43 tests, and production build.
- 2026-08-23: Code review resolved two medium findings: read-only preference loads avoid immediate write locks, and invalid persisted preference data now returns a recoverable unavailable state. Full validation passed with 45 tests.

### File List

- _bmad-output/implementation-artifacts/2-1-set-job-eligibility-preferences.md
- src/persistence/migrations/0011_job_preferences.sql
- src/persistence/migrations.ts
- src/persistence/job-preferences-repository.ts
- src/domain/discovery/job-preferences.ts
- src/domain/workspace/types.ts
- src/audit/audit-event.ts
- src/app/actions.ts
- src/app/job-preferences.tsx
- src/app/page.tsx
- tests/job-preferences.test.ts
- tests/job-preferences-ui.test.ts

## Change Log

- 2026-08-23: Created implementation-ready Story 2.1 context; status set to ready-for-dev.
- 2026-08-23: Implemented Story 2.1 Search Preferences; all tasks complete and status set to review.
- 2026-08-23: Code review resolved 2 findings; Story 2.1 status set to done.

## Next Workflow Handoff

Use the BMad development-story workflow next. Copy/paste:

```text
$bmad-dev-story _bmad-output/implementation-artifacts/2-1-set-job-eligibility-preferences.md
```
