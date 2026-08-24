---
baseline_commit: NO_VCS
---

# Story 2.2: Approve Permitted Discovery Sources

Status: done

## Story

As Adrian,
I want to configure sources only after their allowed access method is recorded,
so that job discovery remains compliant with source policy.

## Product decision: safe initial catalog

The initial permitted-source catalog contains these **manual-browser-only** sources: LinkedIn Jobs (`https://www.linkedin.com/jobs/`), JobStreet Philippines (`https://ph.jobstreet.com/`), Bossjob Philippines (`https://bossjob.ph/`), Indeed Philippines (`https://ph.indeed.com/`), and Glassdoor (`https://www.glassdoor.com/`). Each has a zero automatic-request budget, no app rate limit because the app makes no requests, no integration-retained content, and the same failure guidance: stop and use the normal browser page or manually import a selected listing.

Current official terms prohibit or restrict automated scraping/access for these services: LinkedIn requires express permission for automated crawling; JobStreet permits automated access only through a supplied technical interface such as an API; Bossjob prohibits scraping without prior consent; Indeed prohibits automated access/extraction without express written authorization; and Glassdoor prohibits agents/scraping without express written permission. None is enabled for app retrieval.

Adrian may add a source record and enable automated retrieval only after recording a verifiable policy record, an allowed official API/published-feed/policy-reviewed-HTML method, a positive bounded request budget/rate limit, retention rule, and stop/recovery guidance. This story records and enforces that local policy; it does not contact, validate, fetch from, or automate any external site. Story 2.3 is the first and only story permitted to execute a user-started refresh, and it must still use only an enabled source's recorded method and limits.

## Acceptance Criteria

1. **Accessible source-policy record**

   **Given** the Permitted Sources view
   **When** Adrian adds or edits a source
   **Then** it requires a controlled source type, HTTPS URL, access path, policy review date and revision, request budget/rate limit, retention rule, enabled state, and factual failure guidance.

   **And** a source may use the controlled `manual-browser-handoff` path with exactly zero automatic requests; only `official-api`, `published-feed`, and `policy-reviewed-html` are retrieval methods and require positive bounded request/rate values.

   **And** each control has a real visible label, uses keyboard-native controls, exposes validation and save status programmatically, does not rely on color alone, preserves entered values after an error, and reflows without hiding required fields or the Save action.

2. **Safe default and unresolved-policy gate**

   **Given** first use of Permitted Sources
   **When** Adrian views it
   **Then** it truthfully shows the five named manual-browser sources, that no source is approved or enabled for automated retrieval, and that browser handoff/local manual import is the available path.

   **Given** the initial catalog is unresolved or a source has an unknown, incomplete, expired, or disallowed policy/access method
   **When** Adrian attempts to enable it
   **Then** the app keeps that source disabled, commits no enabled revision or success audit event, and provides the browser-handoff/manual-import recovery action.

3. **Recorded method and bounded configuration**

   **Given** a source with a complete approved record for an official API, published feed, or policy-reviewed HTML retrieval method
   **When** Adrian explicitly saves it as enabled
   **Then** one bounded local SQLite transaction creates an immutable source-configuration revision with a UUIDv7 identifier and UTC ISO-8601 timestamp, makes that revision current, retains prior revisions, and appends a metadata-only audit event in the same transaction.

   **And** the record makes the selected method, per-run request budget, and rate limit available to a future adapter without allowing a different method or a larger budget. A manual-browser record never supplies an adapter and always keeps its automatic-request budget at zero.

   **And** the audit contains only the local actor, action/outcome, entity/version ID, timestamp, and SHA-256 digest of canonical source-policy content—never the URL, policy text, credentials, cookies, headers, or retrieved content.

4. **Discovery safety and deliberately local scope**

   **Given** Permitted Sources is viewed, saved, rejected, or unavailable
   **When** the feature completes or fails
   **Then** it makes no network request; source-adapter invocation; Refresh Run; browser automation; scheduler; polling; background job; background refresh; hidden retry; crawl expansion; credential reuse; proxying; or access-control bypass.

   **And** enabling a configuration only records a local policy gate. It does not test a URL, retrieve a listing, create an adapter, open a browser, or imply that discovery occurred.

   **And** a source policy can never be weakened by Search Preferences or by free-form form input; only the three controlled approved-method values are accepted.

5. **Validation, concurrency, and recovery**

   **Given** an invalid, unsupported, stale, or failed source save
   **When** Adrian submits the form
   **Then** the previous current revision and all earlier revisions remain unchanged, no successful configuration/audit event is added, and the UI announces a factual error with a reachable safe next action.

   **And** all user input is bounded before persistence: source type/access path are controlled values; URL is a bounded valid HTTPS URL; policy date is valid and not in the future; policy revision, retention rule, and failure guidance are non-empty bounded strings; manual-browser records require zero automatic requests; and retrieval records require bounded positive request-budget/rate-limit integers.

   **And** a stale save is rejected with an explicit optimistic-concurrency token rather than overwriting a newer revision.

## Tasks / Subtasks

- [x] 1. Add a local, revisioned source-configuration persistence model (AC: 1, 2, 3, 5)
  - [x] Create `src/persistence/migrations/0012_source_configurations.sql` with immutable source-configuration revisions and a current-revision pointer. Enforce UUIDv7 IDs, UTC timestamps, digest shape, valid controlled source types/access paths, HTTPS URL bounds, zero automatic requests for manual-browser sources, positive bounded request/rate values for retrieval sources, and monotonic revision numbers.
  - [x] Add the migration in order to `src/persistence/migrations.ts`; do not edit existing migrations.
  - [x] Create `src/persistence/source-configurations-repository.ts` with narrow read/insert/current-pointer operations only. Do not add adapter, queue, run, credential, or retrieved-listing tables.

- [x] 2. Implement bounded local source-policy commands (AC: 1-5)
  - [x] Create `src/domain/discovery/source-configurations.ts` for the empty first-use view, controlled validation, canonical hashing, list/current read, and save.
  - [x] Use the established command sequence: `resolveAppDataPaths` -> `openDatabase` -> `applyMigrations` -> `BEGIN IMMEDIATE` -> repository work -> `appendAuditEvent` -> `COMMIT`, with rollback and close on every mutation path. Reads must not take an unnecessary `BEGIN IMMEDIATE` write lock.
  - [x] Add only precise `SOURCE_CONFIGURATION_*` errors to `src/domain/workspace/types.ts`, including invalid, stale, unavailable, and policy-unresolved/disabled cases where needed.
  - [x] Reject an enabled save unless all required policy fields validate. Preserve the submitted values in the UI and direct incomplete or unresolved records to browser handoff/manual import.
  - [x] Never call `fetch`, create an adapter, inspect a remote policy page, or invoke browser/automation code in this module.

- [x] 3. Keep source configuration auditable but non-sensitive (AC: 2-5)
  - [x] Extend `src/audit/audit-event.ts` only with narrow source-configuration success actions and, only if needed, a metadata-only failure action. Continue using the existing allowlist and SHA-256 content digest.
  - [x] Do not place URLs, policy revisions/text, headers, cookies, credentials, request bodies, or fetched content in audit metadata.
  - [x] Seed only the reviewed manual-browser baseline: LinkedIn Jobs, JobStreet Philippines, Bossjob Philippines, Indeed Philippines, and Glassdoor. Each seed must be disabled for retrieval, use `manual-browser-handoff`, record zero app requests, retain no integration-fetched content, and provide browser/manual-import recovery. Do not seed a retrieval method or enabled adapter record.

- [x] 4. Add the Permitted Sources UI and Server Action (AC: 1-5)
  - [x] Add `sourceConfigurationAction` to `src/app/actions.ts`: parse only expected form fields, call the domain command, revalidate `/` after a successful mutation, and map errors through `toSafeWorkspaceError`.
  - [x] Create `src/app/permitted-sources.tsx` as a client component using the established `useActionState` pattern. Include labels, native fields, a current-revision token for edits, `aria-invalid`/`aria-describedby`, `role="status"`, `aria-live="polite"`, a disabled pending Save button, and visible recovery copy.
  - [x] Update `src/app/page.tsx` to load/render source configurations and add a `#permitted-sources` primary-navigation anchor. Preserve existing Search Preferences, Resume & Evidence Library, and Data & Storage isolation.
  - [x] State plainly that saving/enabling a source does not perform retrieval; browser handoff/local manual import is the recovery path for no source, unknown policy, and disallowed method.

- [x] 5. Prove policy, bounded-operation, and recovery behavior (AC: 1-5)
  - [x] Add `tests/source-configurations.test.ts` covering empty first use/no write/no audit; valid saved/reloaded immutable revisions; UUIDv7/UTC/hash-only audits; validation for every required field; rejected unknown/disallowed policy enablement; stale/concurrent save; invalid persisted state; and rollback/preservation after simulated persistence failure.
  - [x] Assert that list/save/reject paths make no network call, adapter invocation, refresh/run call, browser action, scheduler/poller/background worker, retry, credential access, proxy, or source-policy bypass.
  - [x] Add `tests/source-configurations-ui.test.ts` covering the empty-catalog truthful state, required labels/controls, keyboard-native submission, enabled/disabled status, validation/error/recovery semantics, retained values, and the absence of Refresh/test-connection/automatic-retrieval controls.
  - [x] Run full regression verification: `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`.

### Review Findings

- [x] [Review][Patch] Enforce the approved-policy gate in SQLite, not only in the domain command [`src/persistence/migrations/0014_source_configuration_hardening.sql:10`](../../src/persistence/migrations/0014_source_configuration_hardening.sql#L10)
- [x] [Review][Patch] Prevent current-source pointers from referencing another source's revision [`src/persistence/migrations/0014_source_configuration_hardening.sql:16`](../../src/persistence/migrations/0014_source_configuration_hardening.sql#L16)
- [x] [Review][Patch] Reject impossible calendar dates and respect the local policy-review date [`src/domain/discovery/source-configurations.ts:31`](../../src/domain/discovery/source-configurations.ts#L31)
- [x] [Review][Patch] Enforce credential-free HTTPS URLs at the persistence boundary [`src/persistence/migrations/0014_source_configuration_hardening.sql:1`](../../src/persistence/migrations/0014_source_configuration_hardening.sql#L1)
- [x] [Review][Patch] Replace the five seeded placeholder digests through an immutable corrective migration [`src/persistence/migrations/0014_source_configuration_hardening.sql:28`](../../src/persistence/migrations/0014_source_configuration_hardening.sql#L28)
- [x] [Review][Patch] Clear the selected revision after a successful source save to avoid guaranteed stale resubmissions [`src/app/permitted-sources.tsx:18`](../../src/app/permitted-sources.tsx#L18)
- [x] [Review][Patch] Avoid saying every saved source is manual when the current list is empty or unavailable [`src/app/permitted-sources.tsx:19`](../../src/app/permitted-sources.tsx#L19)

## Dev Notes

### Architecture and scope guardrails

- This is a local-first modular monolith: Next.js App Router on `127.0.0.1`, SQLite, and private OS-user app-data are authoritative. There is no product login or public deployment.
- AD-5 is binding: permitted methods are only `official-api`, `published-feed`, and `policy-reviewed-html`. A future Refresh Run may use only enabled source configurations and must stop on throttle, block, or policy uncertainty. No schedules, automatic retries, crawling expansion, credential reuse, proxying, or bypasses are in scope.
- Story 2.2 is configuration only. It must not make external calls, validate a remote policy, test a connection, or create an adapter. Story 2.3 owns the first user-started retrieval attempt.
- Every mutation follows explicit UI action -> domain command -> one local SQLite transaction -> metadata-only audit event. Do not use last-write-wins; carry an expected current revision ID from the UI.
- Treat policy metadata and URLs as user data: validate and hash canonical content for audit, but never write raw source-policy fields to logs or audit events.

### Existing implementation patterns to preserve

- `src/domain/discovery/job-preferences.ts` is the immediate precedent for an immutable revision, canonical SHA-256 digest, optimistic concurrency, local-only first read, and recoverable persisted-state validation. Copy its successful structure, but do not alter it or couple source setup to Search Preferences.
- Read paths apply migrations then read without `BEGIN IMMEDIATE`; writes use the transaction boundary. The Story 2.1 review specifically corrected the inappropriate write lock on reads.
- `src/app/actions.ts` uses Server Actions with `WorkspaceActionState`, `try/catch`, `toSafeWorkspaceError`, and `revalidatePath("/")`. Reuse that contract.
- `src/app/page.tsx` is a dynamic server component that independently loads panel state. Add a Permitted Sources error boundary without weakening existing panels.
- `src/audit/audit-event.ts` enforces UUIDv7 entity IDs, SHA-256 hashes, and a sensitive-key allowlist. Extend narrowly; do not relax it.
- Existing form components use `useActionState`, genuine labels, native controls, `role="status"`, and `aria-live="polite"`. Reuse CSS primitives and add no UI library or dependency.

### Technology requirements

- Keep the installed stack: Node.js `>=24.18.0`, TypeScript 5.9.3, Next.js 16.3.0, React 19.2.3, and `node:sqlite`. No dependency or framework upgrade is authorized.
- Continue the project's existing Next.js Server Action/`useActionState` form pattern. The external technical-doc check did not introduce a change relevant to this local configuration-only story.

### Project structure notes

- New discovery domain code belongs in `src/domain/discovery/`, persistence queries in `src/persistence/`, UI in `src/app/`, and schema changes in `src/persistence/migrations/`.
- Expected new files: `0012_source_configurations.sql`, `source-configurations-repository.ts`, `source-configurations.ts`, `permitted-sources.tsx`, `source-configurations.test.ts`, and `source-configurations-ui.test.ts`.
- Expected updates: `migrations.ts`, `workspace/types.ts`, `audit-event.ts`, `actions.ts`, and `page.tsx`; touch `globals.css` only for a minimal required responsive adjustment.
- There is no Git repository/history (`baseline_commit: NO_VCS`); do not claim commit-derived intelligence.

### Testing requirements from the Epic 1 retrospective

- Safety, source policy, bounded operations, and recovery are acceptance criteria, not follow-up work. Do not settle for happy-path tests.
- Explicitly prove zero unauthorized access: no network/adapter/retrieval/automation/scheduling/polling/retry/credential/proxy/bypass behavior on every configuration path.
- Prove safe failure: invalid, unresolved, stale, and simulated persistence-failure saves preserve the previous revision, emit no success audit, retain entered values, and expose an accessible corrective path.
- Keep the full existing workspace, evidence, Current Base Resume, Data & Storage, and Job Preferences regression suite passing.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` - Epic 2 and Story 2.2]
- [Source: `_bmad-output/planning-artifacts/prds/prd-Resume-2026-08-06/prd.md` - FR-3/FR-4, source-policy rules, recovery matrix, and MVP exclusions]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-Resume-2026-08-07/ARCHITECTURE-SPINE.md` - AD-1, AD-5, AD-10 and structural seed]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-Resume-2026-08-06/EXPERIENCE.md` - Permitted Sources IA and recovery behavior]
- [Source: `_bmad-output/implementation-artifacts/epic-1-retro-2026-08-23.md` - Epic 2 source-policy, bounded-operation, and recovery commitments]
- [Source: `_bmad-output/implementation-artifacts/2-1-set-job-eligibility-preferences.md` - established local persistence, accessibility, test, and review patterns]
- [Source: `src/app/actions.ts`, `src/app/page.tsx`, `src/persistence/migrations.ts`, `src/domain/discovery/job-preferences.ts`, `src/audit/audit-event.ts` - current implementation patterns]

## Dev Agent Record

### Agent Model Used

GPT-5.6 Codex

### Debug Log References

- Context analysis: Epic 2 requirements, PRD, architecture spine, UX contract, Epic 1 retrospective, Story 2.1, and current source tree.
- Initial-catalog decision: five reviewed manual-browser sources; no automated external retrieval or enabled source is seeded.

### Completion Notes List

- 2026-08-23: Created implementation-ready Story 2.2 with five manual-browser-only initial sources and no enabled retrieval source.
- The story explicitly binds source policy, bounded local operations, and recovery behavior into acceptance criteria and adversarial tests.
- 2026-08-23: Implemented revisioned Permitted Sources, including five seeded manual-browser entries and an accessible form for manually adding company careers URLs or approved future retrieval records.
- Validation passed: `npm test` (51 tests), `npm run typecheck`, `npm run lint`, and `npm run build`.

### File List

- _bmad-output/implementation-artifacts/2-2-approve-permitted-discovery-sources.md
- src/persistence/migrations/0012_source_configurations.sql
- src/persistence/migrations.ts
- src/persistence/source-configurations-repository.ts
- src/domain/discovery/source-configurations.ts
- src/domain/workspace/types.ts
- src/audit/audit-event.ts
- src/app/actions.ts
- src/app/permitted-sources.tsx
- src/app/page.tsx
- tests/source-configurations.test.ts
- tests/source-configurations-ui.test.ts

## Change Log

- 2026-08-23: Created implementation-ready Story 2.2; status set to ready-for-dev. LinkedIn, JobStreet Philippines, Bossjob Philippines, Indeed Philippines, and Glassdoor are manual-browser-only; browser handoff/manual import is the only immediately available discovery route.
- 2026-08-23: Implemented Story 2.2 and set status to review. Added manual company-careers URL configuration with no source retrieval or browser automation.

## Next Workflow Handoff

Use the BMad development-story workflow next. Copy/paste:

```text
$bmad-dev-story _bmad-output/implementation-artifacts/2-2-approve-permitted-discovery-sources.md
```
