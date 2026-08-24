---
baseline_commit: 380c24d
---

# Story 2.4: Inspect Normalized Job Listings

Status: done

## Story

As Adrian,
I want to browse normalized listings and inspect probable duplicates,
so that I can review opportunities without losing source context.

## Product decision and scope boundary

Story 2.4 owns local Job Listing inspection: retained source records, normalization, probable-duplicate grouping, manual import, and the Jobs surface. It consumes the persisted Refresh Run/outcome boundary created in Story 2.3; it must not turn it into a generic retrieval pipeline.

The seeded catalog is currently manual-browser-handoff, disabled, and zero-budget. No live source adapter exists. Therefore, the usable ingestion path at delivery is an explicit local manual import with required source attribution. It must make **zero** network requests and must not enable a source, call an adapter, automate a browser, crawl, scrape, proxy, reuse credentials, or bypass access controls. A future exact policy-gated adapter may pass source-permitted results through a narrow validated seam, but this story must not implement that adapter or a generic `fetch(url)` path.

Every retained source record and its attribution survives normalization and duplicate handling. A duplicate group is a review aid, never a license to delete, overwrite, or silently merge source records. Do not implement Fit Labels, fit assessment/detail explanation, save-to-application behavior, application handoff/prefill/submission, or automated retrieval; those belong to later stories.

## Acceptance Criteria

1. **Inspectable normalized listing fields**

   **Given** a completed or partial Refresh Run with retained permitted results, or an explicit manual import
   **When** listings are displayed
   **Then** every listing visibly presents title, company, work style/location when known, source, original URL, and Freshness; each unavailable value is rendered literally as `Unknown` rather than inferred.

   **And** Freshness identifies available posted date, first-seen and last-verified/observed timestamps, plus stale or unknown state where applicable; storage uses UTC ISO-8601 and the UI renders timestamps in local time.

   **And** incomplete, malformed, inaccessible, or partial-source data preserves its permitted source link/attribution and uncertainty. Successful listings remain visible alongside failed/blocked/throttled refresh outcomes; a first-use empty state must not imply that retrieval happened.

2. **Duplicate provenance, override, and recovery**

   **Given** probable duplicates
   **When** Adrian opens a duplicate group
   **Then** all retained source records remain individually inspectable, including source attribution, original URL, relevant observation/Freshness data, and exact source-configuration revision provenance.

   **When** Adrian changes a probable grouping
   **Then** the UI states the specific effect and requires explicit confirmation; cancel/Escape makes no change and restores focus to the invoking control.

   **And** an applied override is local, metadata-audited, attributable, and reversible where feasible. Reversal restores the prior grouping without deleting source records or fabricating a new source result.

3. **Truthful manual browser-handoff import**

   **Given** a source is a browser-handoff/manual-import source
   **When** Adrian explicitly adds a listing through the local form
   **Then** source selection/attribution and original URL are required and preserved, the listing is normalized locally, and no automated crawling, browser automation, network request, adapter invocation, credential access, proxy, retry, or source-policy change occurs.

   **And** invalid, stale, disabled, or inconsistent source/revision input is rejected safely at the command and persistence boundaries, preserving existing listings/groups and giving a source-compatible manual recovery path.

## Tasks / Subtasks

- [x] 1. Add constrained Job Listing, retained Source Record, and duplicate-decision persistence (AC: 1-3)
  - [x] Add `src/persistence/migrations/0016_job_listings.sql` and append it to `src/persistence/migrations.ts`; do not alter applied migrations.
  - [x] Model normalized Job Listings and immutable retained source records. Each source record must link to the exact `source_id`, immutable `source_configuration_revision_id`, and optional `refresh_run_id`; retain only data permitted by that revision's retention rule.
  - [x] Add a non-destructive grouping/decision model. Store confirmed duplicate overrides and reversal history as explicit decisions; do not delete, overwrite, or make a source record uninspectable.
  - [x] Enforce UUIDv7 identifiers, UTC ISO-8601 timestamps, bounded field lengths, controlled state/transition constraints, valid source/revision ownership, and digest shape in SQLite—not only in TypeScript.

- [x] 2. Implement narrow domain and repository boundaries (AC: 1-3)
  - [x] Create `src/persistence/job-listings-repository.ts` with parameterized, narrow create/read/list/group/override/reverse operations. Reading must not acquire `BEGIN IMMEDIATE` or mutate state.
  - [x] Create `src/domain/discovery/job-listings.ts`. Mutations follow: explicit UI action -> domain validation -> `BEGIN IMMEDIATE` SQLite transaction -> repository work -> metadata-only audit -> commit/rollback -> close. On every failure, preserve prior committed listings, groups, and audits; emit no false-success audit.
  - [x] Define an intentionally bounded, validated optional ingestion seam from an exact future source adapter result into retained source records. Update `src/adapters/sources/source-adapter.ts` and `src/domain/discovery/refresh-runs.ts` only as needed. Do not add a live adapter, generic HTTP client, generic URL fetch, queue, scheduler, or retry behavior.
  - [x] Manual import validates the current source/revision at command time, requires source attribution plus original URL, and performs no external work. Do not trust browser-supplied enabled/policy/revision state.

- [x] 3. Keep audit, errors, and provenance safe (AC: 1-3)
  - [x] Extend `src/audit/audit-event.ts` and `src/domain/workspace/types.ts` narrowly for listing import/normalization and duplicate override/reversal. Use entity IDs, action/outcome, UTC time, and SHA-256 digests only.
  - [x] Never place source URLs, listing text, policy details, request/response bodies, headers, cookies, credentials, tokens, or raw errors in audits or logs. Source URL/attribution may be policy-permitted product data for the inspection UI, but is never audit payload.
  - [x] Reuse `toSafeWorkspaceError` and existing recovery wording. Validate persisted records when read so malformed/stale data cannot be presented as a valid listing.

- [x] 4. Add an accessible Jobs inspection and manual-import surface (AC: 1-3)
  - [x] Add `src/app/job-listings.tsx`, following the existing `useActionState` form pattern. Include a truthful empty state that routes to Search Preferences, Permitted Sources, and manual import without claiming a refresh occurred.
  - [x] Add focused Server Actions to `src/app/actions.ts`; accept only validated IDs/form values, call the domain command, map errors safely, and call `revalidatePath("/")` only after a state change.
  - [x] Update `src/app/page.tsx` to independently load/render Jobs and add `#job-listings` navigation while preserving Search Preferences, Permitted Sources, Source Refresh, Resume & Evidence Library, and Data & Storage.
  - [x] Render required listing fields at all breakpoints. A narrow layout may stack records, but must not hide title, company, work style/location, source, original URL, Freshness, Unknown state, duplicate inspection, or recovery action. Use `globals.css` only for necessary reflow/focus-safe layout changes.
  - [x] Use genuine labels and native keyboard-operable controls; add visible focus, `aria-invalid`/`aria-describedby` for invalid form data, `role="status"` with polite announcements for completion/state updates, non-color-only state, and a consequence-specific confirmation dialog for duplicate overrides.

- [x] 5. Prove source-policy, data-integrity, and UI behavior (AC: 1-3)
  - [x] Add `tests/job-listings.test.ts`: explicit attributed manual import with zero network/adapter/browser activity; exact current source/revision validation; required Unknown normalization; UUIDv7/UTC/digest and metadata-only audit behavior; retention enforcement; immutable inspectable source records; duplicate detection uncertainty; confirmed override/reversal; stale/concurrent/persistence-failure preservation; and completed/partial bounded-ingestion seam behavior.
  - [x] Add `tests/job-listings-ui.test.ts`: required fields/`Unknown`, local-time Freshness, first-use vs partial-result states, accessible source records and duplicate confirmation/cancel/reversal, labels, keyboard interaction, live status, focus return, non-color-only status, reflow-safe records, and manual-import recovery.
  - [x] Assert absence of scheduler, timer/poller, automatic/hidden retry, crawling, generic fetch, browser automation, credential use/reuse, proxy, redirect escape, access-control bypass, external application submission, and unauthorised network work.
  - [x] Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`.

### Review Findings

- [x] [Review][Patch] Reject retained listings from unusable adapter outcomes [src/domain/discovery/refresh-runs.ts:41] — `failed`, `blocked`, and non-HTTP `throttled` adapter results now discard listings before persistence.
- [x] [Review][Patch] Make refresh listing persistence source-consistent and failure-safe [src/domain/discovery/refresh-runs.ts:96] — adapter listings are validated and persisted with the matching source outcome in one transaction.
- [x] [Review][Patch] Enforce bounded adapter-result volume [src/domain/discovery/refresh-runs.ts:41] — bounded listing validation rejects oversized adapter result sets before persistence.
- [x] [Review][Patch] Bind retrieval-source records to the matching permitted Refresh Run [src/domain/discovery/job-listings.ts:28] — retrieval imports verify exact source/revision and completed/partial outcome provenance, with a matching SQLite trigger.
- [x] [Review][Patch] Harden Job Listing persistence and read boundaries [src/persistence/migrations/0016_job_listings.sql:1] — SQLite constraints and strict repository mapping now enforce bounded fields, UTC timestamps, safe URLs, UUIDs, and digests.
- [x] [Review][Patch] Serialize and preserve duplicate-override history [src/domain/discovery/job-listings.ts:29] — one active override, current-group checks, stale reversal rejection, and immutable decision fields are enforced.
- [x] [Review][Patch] Display exact source-revision provenance [src/app/job-listings.tsx:33] — retained source records now render the immutable revision identifier.
- [x] [Review][Patch] Implement accessible duplicate confirmation semantics [src/app/job-listings.tsx:12] — the confirmation supports Escape, Cancel, dialog semantics, and invoker focus restoration.
- [x] [Review][Patch] Distinguish first use from an empty completed or partial refresh [src/app/job-listings.tsx:31] — Jobs now receives refresh outcomes and explains empty completed/partial results truthfully.

## Dev Notes

### Architecture and data guardrails

- Keep the local-first modular monolith: Next.js is loopback-only (`127.0.0.1`); SQLite in private OS-user app-data is authoritative. External work is allowed only in a direct user action. [Source: `ARCHITECTURE-SPINE.md` — AD-1, AD-5]
- Story 2.3 owns immutable Refresh Runs and source outcomes, not listings. Reuse it as an input boundary but do not repurpose its tables or make adapters authoritative. `SourceAdapterResult` currently has no listing payload, so any future seam must be small, source-specific, validated, and policy-gated. [Source: `src/domain/discovery/refresh-runs.ts`; `src/adapters/sources/source-adapter.ts`]
- Source configuration revisions are immutable and current-pointer integrity is database-enforced. Bind imported/retained data to the exact revision used, enforce the recorded retention rule, and re-check current data at command time. [Source: `src/domain/discovery/source-configurations.ts`; `src/persistence/source-configurations-repository.ts`]
- All IDs are UUIDv7. Store timestamps in UTC ISO-8601; display local time. Use parameterized statements and existing transaction/open/close patterns. Node's built-in `node:sqlite` `DatabaseSync` is the installed persistence mechanism; do not introduce a driver. [Source: `package.json`; [Node SQLite documentation](https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html)]

### Existing patterns and preservation requirements

- Preserve the current source-refresh panel and its no-enabled-source behavior. It stays explicit-confirmation-only and must never auto-refresh. [Source: `src/app/source-refresh.tsx`; `2-3-run-a-bounded-source-refresh.md`]
- Existing Actions use Server Actions, `WorkspaceActionState`, `try/catch`, `toSafeWorkspaceError`, and `revalidatePath("/")` after mutations. Existing client components use `useActionState`, native controls, accessible error association, polite status, and pending-disabled submissions. Reuse these patterns. [Source: `src/app/actions.ts`; `src/app/permitted-sources.tsx`; [Next.js mutation documentation](https://nextjs.org/docs/app/getting-started/mutating-data)]
- Audit validation has a deliberately narrow allowlist. Never relax it for listing content or source data. [Source: `src/audit/audit-event.ts`]
- Recent refresh review fixes are a warning against superficial domain-only validation: validate at persistence and read boundaries, preserve earlier successful data when later work fails, and make externally visible status truthful. [Source: Git commits `dfa146a`, `380c24d`]

### UX and product integrity

- The Jobs empty state must distinguish “no listings yet” from “a completed/partial refresh yielded no matches.” In both cases, preserve any known source outcomes and offer an explicit safe next action. Do not fabricate result counts or freshness. [Source: `EXPERIENCE.md` — State Patterns, UJ-1]
- A duplicate group must visibly retain each source record; source attribution can be subordinate visually but cannot be hidden or hover-only. Overrides need a confirmation that names the change, no-op cancellation, and feasible undo/reversal. [Source: `EXPERIENCE.md` — Component Patterns, Interaction Primitives]
- The UX blueprint mentions a Fit Label on eventual listing rows, but fit calculation is Story 3. Do not add a fabricated/predictive label in 2.4; omit it or explicitly show that assessment is not yet available if the shared layout requires a slot.

### File structure plan

- New: `src/persistence/migrations/0016_job_listings.sql`, `src/persistence/job-listings-repository.ts`, `src/domain/discovery/job-listings.ts`, `src/app/job-listings.tsx`, `tests/job-listings.test.ts`, `tests/job-listings-ui.test.ts`.
- Update only as necessary: `src/persistence/migrations.ts`, `src/app/actions.ts`, `src/app/page.tsx`, `src/audit/audit-event.ts`, `src/domain/workspace/types.ts`, `src/adapters/sources/source-adapter.ts`, `src/domain/discovery/refresh-runs.ts`, and `src/app/globals.css`.
- Do not change source policy configuration/migrations, seed a source, add dependencies, enable retrieval, or modify existing migration files.

### Previous Story Intelligence

- Story 2.3 established an empty production adapter registry and persisted source outcomes incrementally. Its review repairs require robust finalization, runtime validation of adapter identity/result shape, source identity in history, and concurrency-safe source budgets. Carry the same failure-preservation and persistence-invariant discipline into listing/duplicate writes. [Source: `2-3-run-a-bounded-source-refresh.md` — Review Findings]
- The prior story's verification baseline was `npm test`, typecheck, lint, and build. Maintain the full suite, not only focused unit tests. [Source: `2-3-run-a-bounded-source-refresh.md` — Completion Notes]

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 2, Story 2.4]
- [Source: `_bmad-output/planning-artifacts/prds/prd-Resume-2026-08-06/prd.md` — Job Listing/Freshness model, FR-5, source rules, NFRs, errors, MVP exclusions, unresolved dedupe/freshness decisions]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-Resume-2026-08-07/ARCHITECTURE-SPINE.md` — AD-1, AD-5, AD-10, consistency conventions, structural seed]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-Resume-2026-08-06/EXPERIENCE.md` — Listing row, duplicate group, states, accessibility floor, UJ-1]
- [Source: `_bmad-output/implementation-artifacts/2-2-approve-permitted-discovery-sources.md`; `_bmad-output/implementation-artifacts/2-3-run-a-bounded-source-refresh.md`]
- [Source: `_bmad-output/implementation-artifacts/epic-1-retro-2026-08-23.md` — Epic 2 policy/bounded-operation/recovery test commitment]

## Dev Agent Record

### Agent Model Used

GPT-5.6 Codex

### Debug Log References

- Comprehensive analysis completed across epics, PRD, architecture, UX, current source/persistence/UI/test code, Story 2.3, recent Git history, and current Node/Next documentation.
- Quality check applied: the guide names implementation seams, database invariants, scope exclusions, accessible states, safe audit boundaries, and testable non-behavior—not merely the acceptance criteria.

### Completion Notes List

- 2026-08-23: Ultimate context engine analysis completed - comprehensive developer guide created.
- 2026-08-23: Implemented local Job Listings with immutable retained source records, explicit manual import, inspected probable duplicates, reversible local overrides, and a bounded future-adapter ingestion seam. Verified 68 tests plus typecheck, lint, and production build.
- 2026-08-23: Addressed code-review findings — 9 patch items resolved. Re-ran 68 tests, typecheck, lint, and production build successfully.

### File List

- `src/persistence/migrations/0016_job_listings.sql`
- `src/persistence/migrations.ts`
- `src/persistence/job-listings-repository.ts`
- `src/domain/discovery/job-listings.ts`
- `src/domain/discovery/refresh-runs.ts`
- `src/adapters/sources/source-adapter.ts`
- `src/domain/workspace/types.ts`
- `src/audit/audit-event.ts`
- `src/app/job-listings.tsx`
- `src/app/actions.ts`
- `src/app/page.tsx`
- `src/app/globals.css`
- `tests/job-listings.test.ts`
- `tests/job-listings-ui.test.ts`

## Change Log

- 2026-08-23: Implemented Story 2.4 Job Listings; added safe local ingestion, provenance-preserving duplicate management, accessible UI, and coverage.
- 2026-08-24: Superseded for forward MVP by Epic 7 Manual Opportunity Workspace. This completed historical implementation is retained; new work must use explicit URL plus copied-description capture and must not extend refresh, source configuration, or adapter behavior.
