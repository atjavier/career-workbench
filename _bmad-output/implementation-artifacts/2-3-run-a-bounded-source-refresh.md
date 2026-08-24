---
baseline_commit: NO_VCS
---

# Story 2.3: Run a Bounded Source Refresh

Status: done

## Story

As Adrian,
I want to explicitly refresh selected sources,
so that I can see current eligible listings without background retrieval.

## Product decision and scope boundary

The current seeded catalog contains eight disabled `manual-browser-handoff` sources: LinkedIn Jobs, JobStreet Philippines, Bossjob Philippines, Indeed Philippines, Glassdoor, Kalibrr, PhilJobNet, and OnlineJobs.ph. Their request budget and rate limit are zero. **None is permitted to make an app retrieval request.**

Therefore, this story implements a truthful Refresh surface and bounded-run engine, but does not add a live platform scraper, browser automation, or generic URL fetcher. With the baseline catalog, Refresh must explain that no enabled retrieval source is available, route Adrian to Permitted Sources and browser handoff/manual import, make zero network requests, and create no successful Refresh Run/audit event.

A later saved source configuration is eligible only when its current revision is enabled, policy-approved and fresh, uses `official-api`, `published-feed`, or `policy-reviewed-html`, has positive bounded request/rate values, **and** has an exact compatible adapter in a finite local allowlist. Never infer an adapter from a user-provided URL or dynamically use `fetch` as a crawler. An otherwise eligible configuration with no allowlisted adapter ends as `blocked`, using its recorded failure guidance, with zero requests.

Story 2.3 owns Refresh Run and per-source outcome metadata. Story 2.4 owns normalized Job Listing inspection, duplicate grouping, and listing UI; do not introduce those tables or screens here. Retain only data the selected source's retention rule permits, and never put retrieved bodies, URLs, policy text, headers, cookies, or credentials in audit/log output.

## Acceptance Criteria

1. **Explicit, bounded refresh scope**

   **Given** one or more enabled permitted sources with compatible allowlisted adapters
   **When** Adrian selects Refresh now, reviews the selected source scope, and confirms it
   **Then** exactly one user-started bounded Refresh Run is created and the UI shows its selected sources and per-source `running`, `completed`, `partial`, `failed`, `blocked`, or `throttled` outcome with UTC timestamps rendered in Adrian's local time.

   **And** the UI uses native keyboard-operable selection and confirmation controls, real labels, visible focus, programmatically announced start/terminal/partial status, and responsive reflow without hiding source, status, timestamp, scope, or recovery action.

2. **No-source and policy gate**

   **Given** the current initial manual-browser-only catalog, no selected source, a disabled/manual source, stale or policy-uncertain revision, or a configuration without an exact compatible adapter
   **When** Adrian opens or attempts Refresh
   **Then** no unauthorized network, browser automation, adapter invocation, credential access, or Refresh Run success occurs; the UI states the factual reason and exposes the recorded source-compatible failure guidance or Permitted Sources/browser-handoff/manual-import path.

   **And** Refresh re-reads the current source configuration/revision at command time; it never trusts browser-supplied source metadata, a stale revision, or a previously rendered enabled state.

3. **Source-bounded execution and isolation**

   **Given** a confirmed scope of current eligible sources
   **When** the Refresh Run invokes an adapter
   **Then** each adapter receives only its source's immutable current revision, approved method, request budget, rate limit, and action-scoped cancellation/deadline contract, and cannot change method, expand scope, follow an unapproved host redirect, acquire/reuse credentials, proxy traffic, or bypass access controls.

   **And** enforce both the total per-run request budget and per-minute rate before every attempt. There is no scheduler, polling, background work, crawl expansion, hidden retry, or automatic retry. Use the installed Node runtime facilities; add no HTTP dependency.

4. **Safe partial outcomes and recovery**

   **Given** a selected source exceeds budget, is throttled, blocked, fails, or becomes policy-uncertain
   **When** the adapter or run guard detects that condition
   **Then** it immediately stops only that source, records the factual terminal outcome and source-compatible recovery guidance, and preserves completed/partial outcomes and permitted successful data from other selected sources.

   **And** HTTP `429`/applicable `Retry-After` maps to `throttled`; authentication/authorization refusal (`401`/`403`), policy change, or policy uncertainty maps to `blocked`; no alternate access method or automatic retry is attempted.

5. **Local authority, metadata-only audit, and recoverability**

   **Given** a Refresh Run starts, succeeds partially, completes, is blocked, throttled, or fails
   **When** its local state changes
   **Then** Refresh Run/outcome identities use UUIDv7, storage uses UTC ISO-8601, and each mutation follows UI action â†’ domain command â†’ SQLite transaction â†’ metadata-only audit â†’ visible bounded adapter attempt/outcome persistence.

   **And** audit metadata is limited to actor, action/outcome, Refresh Run/source configuration revision IDs, timestamps, and SHA-256 digests; it excludes source URLs, policies, listing content, request/response bodies, headers, cookies, credentials, tokens, and raw errors.

   **And** invalid input, stale/current-revision changes, persistence failure, adapter failure, or cancellation preserves prior runs/outcomes and permitted successful results, emits no false success audit, and presents an accessible safe next action.

6. **Later inspection and non-background guarantee**

   **Given** Adrian leaves and returns after a Refresh Run terminal state
   **When** the Refresh panel reloads
   **Then** it presents the persisted scope and per-source outcomes without starting any network activity, scheduler, poller, retry, credential reuse, proxy, or access-control bypass.

## Tasks / Subtasks

- [x] 1. Add immutable Refresh Run/outcome persistence (AC: 1, 4, 5, 6)
  - [x] Add `src/persistence/migrations/0015_refresh_runs.sql`; append it to `src/persistence/migrations.ts` without modifying existing migrations.
  - [x] Model a UUIDv7 Refresh Run plus immutable per-source outcome records linked to the exact source-configuration revision. Enforce controlled statuses, UTC timestamps, safe SHA-256 digest shape, source/revision ownership, and monotonic/run-safe transitions.
  - [x] Create `src/persistence/refresh-runs-repository.ts` with narrow create/read/update-outcome operations. Do not add Job Listing, duplicate, queue, scheduler, credential, or generic fetched-content tables.

- [x] 2. Implement policy-gated bounded run orchestration (AC: 1-6)
  - [x] Create `src/domain/discovery/refresh-runs.ts`; command-time load current source revisions and validate enabled, approved, fresh, retrieval-method, budget, and rate constraints before each source is invoked.
  - [x] Define a narrow injected adapter interface and finite registry in `src/adapters/sources/`, keyed to exact approved source/method/revision. No registry entry means `blocked` and zero network. Do not create a generic `fetch(url)`, scraper, browser, proxy, or credential flow.
  - [x] Enforce per-source request accounting, per-minute rate checks, an action-scoped timeout/cancellation signal, allowed-host redirect refusal, bounded response handling, and terminal status mapping. Use native Node 24 facilities; add no packages.
  - [x] Preserve other selected sources when one source stops. Persist only source-permitted successful data and metadata required by this story; leave normalization and Job Listing presentation for Story 2.4.
  - [x] Add only focused `REFRESH_*` safe error codes to `src/domain/workspace/types.ts`.

- [x] 3. Keep refresh auditing and transaction boundaries safe (AC: 4, 5)
  - [x] Extend `src/audit/audit-event.ts` only with narrow Refresh Run start/terminal/failure actions; retain its sensitive-key allowlist and UUIDv7/SHA-256 checks.
  - [x] Follow the established local boundary: resolve app-data â†’ open database â†’ migrations â†’ transaction/repository/audit work â†’ commit/rollback/close. Reads remain read-only and do not take unnecessary `BEGIN IMMEDIATE` locks.
  - [x] Never log or audit raw source/listing/request/response/policy data, headers, cookies, credentials, tokens, or error bodies.

- [x] 4. Add the accessible Refresh panel and Server Action (AC: 1, 2, 4, 6)
  - [x] Add `sourceRefreshAction` to `src/app/actions.ts`: accept only selected source IDs and explicit confirmation, invoke the domain command, map errors with `toSafeWorkspaceError`, and `revalidatePath("/")` only after state changes.
  - [x] Create `src/app/source-refresh.tsx` using the established `useActionState` pattern. Provide selected-scope confirmation, disabled/unavailable explanation, `role="status"`/`aria-live="polite"`, timestamped outcome rows, and per-source recovery guidance.
  - [x] Update `src/app/page.tsx` to load/render the Refresh view independently, include `#source-refresh` primary navigation, and retain existing Search Preferences, Permitted Sources, Resume & Evidence Library, and Data & Storage behavior.
  - [x] Link to Permitted Sources as recovery; do not turn `permitted-sources.tsx` into a test-connection, retrieval, or browser-automation surface. Touch `globals.css` only for a necessary accessible/reflow-safe layout adjustment.

- [x] 5. Prove policy, bounded-operation, partial-result, and regression behavior (AC: 1-6)
  - [x] Add `tests/source-refresh.test.ts` using injected fake adapters. Cover no enabled baseline/zero network; disabled/manual/stale/unknown-policy/no-compatible-adapter blocks; exact current-revision recheck; selected-scope confirmation; UUIDv7/UTC/digest-only audit; budget/rate enforcement; timeout/cancellation; 429 throttling; 401/403/policy uncertainty blocking; failed/partial/completed outcomes; cross-source isolation; re-open with zero new network; stale/concurrent and simulated persistence failure preservation.
  - [x] Assert no scheduler, timer/poller, hidden retry, generic crawl/fetch, browser automation, credential access/reuse, proxy, redirect escape, or access-control bypass. Assert no false success audit on rejected/failed paths.
  - [x] Add `tests/source-refresh-ui.test.ts` covering labels, native keyboard use, confirmation, selected-scope visibility, pending state, no-enabled-source recovery, status announcements, timestamps/outcome semantics, no-color-only state, and no automatic-refresh/retry controls.
  - [x] Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`.

### Review Findings

- [x] [Review][Patch] Enforce the refresh timeout around non-cooperative adapters — `AbortSignal.timeout()` only signals cancellation; an adapter that ignores the signal can keep the bounded refresh running indefinitely. [src/domain/discovery/refresh-runs.ts:64]
- [x] [Review][Patch] Recover from final persistence/finalization failure — failures after the initial `running` insert leave an orphaned run and a success start audit with no terminal recovery or failure audit. [src/domain/discovery/refresh-runs.ts:73-75]
- [x] [Review][Patch] Persist source outcomes incrementally — buffering all outcomes in memory loses earlier completed/partial results when a later adapter or final transaction fails. [src/domain/discovery/refresh-runs.ts:57-75]
- [x] [Review][Patch] Validate adapter identity against the selected source revision — an injected registry entry can be keyed for one source while declaring another source/revision, violating the exact adapter contract. [src/domain/discovery/refresh-runs.ts:59-60]
- [x] [Review][Patch] Validate adapter result status and recovery guidance at runtime — malformed status or empty/overlong guidance can violate SQLite constraints and strand the run in `running`. [src/domain/discovery/refresh-runs.ts:64-67]
- [x] [Review][Patch] Preserve actionable diagnostics for unexpected adapter errors — the catch-all conversion masks programmer/configuration failures as generic source failures. [src/domain/discovery/refresh-runs.ts:68-70]
- [x] [Review][Patch] Show source identity in persisted refresh outcomes — history currently shows only selected count and status, so users cannot tell which source each outcome belongs to. [src/app/source-refresh.tsx:26]
- [x] [Review][Patch] Enforce aggregate source budgets across concurrent runs — per-invocation counters allow concurrent explicit runs to each consume the full source budget. [src/domain/discovery/refresh-runs.ts:62]

## Dev Notes

### Architecture and scope guardrails

- This is a local-first modular monolith: Next.js App Router runs only on `127.0.0.1`; SQLite and private OS-user app-data are authoritative. External work is permitted only inside an explicit user action. [Source: architecture AD-1]
- AD-5 is binding: the only retrieval methods are `official-api`, `published-feed`, and `policy-reviewed-html`; refresh uses enabled policy-gated adapters, stops on throttle/block/policy uncertainty, and never schedules, retries automatically, crawls, reuses credentials, proxies, or bypasses access controls. [Source: architecture AD-5]
- An enabled configuration is a policy record, not an authorization to generically fetch its URL. The adapter registry must be finite and source-specific; there is deliberately no concrete live adapter for the present catalog.
- Follow the mutation convention exactly: UI action â†’ domain command â†’ SQLite transaction â†’ metadata-only audit â†’ optional visible bounded adapter attempt â†’ persisted outcome. Adapters are never authoritative. [Source: architecture Consistency Conventions]
- Current baseline requires the no-enabled-source path. Do not change the manual-browser sources, seed an enabled retrieval record, contact one of the eight sites, or claim a completed discovery run.

### Existing implementation patterns to preserve

- `src/domain/discovery/source-configurations.ts` already validates credential-free HTTPS URLs, controlled methods, fresh policy (within 366 days for enablement), request budget 1â€“1000, rate limit 1â€“120, immutable revisions/current pointers, and optimistic concurrency. Reuse its safe current-revision reads; do not weaken validation or change source-configuration migrations.
- `src/app/actions.ts` uses Server Actions, `WorkspaceActionState`, `try/catch`, `toSafeWorkspaceError`, and `revalidatePath("/")`. `src/app/permitted-sources.tsx` establishes `useActionState`, genuine labels, native controls, `aria-invalid`/`aria-describedby`, `role="status"`, `aria-live="polite"`, and disabled pending submission.
- `src/audit/audit-event.ts` has a narrow action union and rejects any payload field other than actor/action/outcome/entityId/contentHash. Extend narrowly; never relax the guard.
- Story 2.2's review hardening proves that persistence must enforce safety, not merely the domain layer: preserve source/revision ownership, credential-free HTTPS, and approved enabled policy at the database boundary.

### Technology and current technical information

- Keep the installed stack: Node.js `>=24.18.0`, TypeScript 5.9.3, Next.js 16.3.0, React 19.2.3, and `node:sqlite`. No dependency or framework upgrade is authorized. [Source: `package.json`]
- Native Node 24 provides `fetch` and `AbortSignal.timeout`/`AbortSignal.any`; use those only inside a future allowlisted source-specific adapter, with redirect/host and byte limits enforced. Do not add an HTTP client. [Node globals documentation](https://nodejs.org/api/globals.html)
- Keep the existing Server Action / `useActionState` structure; Next documents these mutation patterns and Server Action safeguards. [Next.js mutation documentation](https://nextjs.org/docs/app/getting-started/mutating-data)
- The policy catalog is the actual authority: its present eight sources are manual-only, disabled, and zero-budget. External terms research must not be used to retroactively enable a source; enabling a real adapter needs its own recorded, reviewable policy approval and compatible implementation.

### Project Structure Notes

- New domain code: `src/domain/discovery/refresh-runs.ts`; source integration contract/registry: `src/adapters/sources/`; persistence: `src/persistence/refresh-runs-repository.ts` and migration `0015_refresh_runs.sql`; UI: `src/app/source-refresh.tsx`; tests: `tests/source-refresh.test.ts`, `tests/source-refresh-ui.test.ts`.
- Expected updates: `src/persistence/migrations.ts`, `src/domain/workspace/types.ts`, `src/audit/audit-event.ts`, `src/app/actions.ts`, `src/app/page.tsx`, and only necessary `src/app/globals.css`/`src/app/permitted-sources.tsx` integration.
- Do not add normalization, duplicate grouping, Job Listing detail, Fit Label, job search results, or outbound application behavior; those belong to later stories.

### Testing requirements and prior-story intelligence

- The Epic 1 retrospective requires source-policy, bounded-operation, and recovery checks as acceptance criteria and adversarial testsâ€”not follow-up work.
- Story 2.2 established the testing bar: explicitly prove absence of unauthorized network/retrieval/automation/scheduling/polling/retry/credential/proxy/bypass activity; verify stale and simulated persistence failures preserve existing state; retain full workspace regressions.
- There is no Git repository/history (`git log` reports not a repository), so no commit-derived guidance exists.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` â€” Epic 2 and Story 2.3]
- [Source: `_bmad-output/planning-artifacts/prds/prd-Resume-2026-08-06/prd.md` â€” FR-4, FR-6, FR-7, NFR-5, NFR-8, MVP exclusions, and recovery requirements]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-Resume-2026-08-07/ARCHITECTURE-SPINE.md` â€” AD-1, AD-5, AD-10, consistency conventions, and structural seed]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-Resume-2026-08-06/EXPERIENCE.md` â€” Manual refresh control, source outcomes, state patterns, accessibility floor, and UJ-1]
- [Source: `_bmad-output/implementation-artifacts/2-2-approve-permitted-discovery-sources.md` â€” current source policy, implementation patterns, review fixes, and testing lessons]
- [Source: `_bmad-output/implementation-artifacts/epic-1-retro-2026-08-23.md` â€” Epic 2 source-policy/bounded-operation/recovery commitments]
- [Source: `src/domain/discovery/source-configurations.ts`, `src/persistence/source-configurations-repository.ts`, `src/persistence/migrations.ts`, `src/app/actions.ts`, `src/app/page.tsx`, `src/app/permitted-sources.tsx`, `src/audit/audit-event.ts` â€” current implementation patterns]

## Dev Agent Record

### Agent Model Used

GPT-5.6 Codex

### Debug Log References

- Comprehensive artifact, previous-story, architecture, UX, source-policy, current-code, and current-documentation analysis completed.
- No Git repository detected; no commit-derived implementation intelligence is available.
- Verification continuation: existing Story 2.3 implementation inspected; `npm test` passed all 61 tests, followed by successful `npm run typecheck`, `npm run lint`, and `npm run build`.

### Completion Notes List

- 2026-08-23: Ultimate context engine analysis completed - comprehensive developer guide created.
- The guide makes the baseline no-enabled-source behavior explicit and forbids a generic fetcher, scraper, browser automation, or newly invented live vendor integration.
- 2026-08-23: Implemented revision-linked Refresh Runs, allowlisted adapter seam, bounded request/rate enforcement, source-isolated outcomes, metadata-only auditing, no-enabled-source recovery UI, and adversarial regression coverage.
- 2026-08-23: Addressed code review findings — timeout enforcement, incremental outcome persistence, failure recovery, adapter identity/result validation, source-labeled history, and concurrent source serialization.

### File List

- _bmad-output/implementation-artifacts/2-3-run-a-bounded-source-refresh.md
- src/persistence/migrations/0015_refresh_runs.sql
- src/persistence/migrations.ts
- src/persistence/refresh-runs-repository.ts
- src/adapters/sources/source-adapter.ts
- src/domain/discovery/refresh-runs.ts
- src/domain/workspace/types.ts
- src/audit/audit-event.ts
- src/app/actions.ts
- src/app/source-refresh.tsx
- src/app/page.tsx
- tests/source-refresh.test.ts
- tests/source-refresh-ui.test.ts

## Change Log

- 2026-08-23: Created implementation-ready Story 2.3; status set to ready-for-dev.
- 2026-08-23: Implemented and verified Story 2.3; status set to review after full regression, typecheck, lint, and production build validation.

## Next Workflow Handoff

Use the BMad development-story workflow next. Copy/paste:

```text
$bmad-dev-story _bmad-output/implementation-artifacts/2-3-run-a-bounded-source-refresh.md
```
