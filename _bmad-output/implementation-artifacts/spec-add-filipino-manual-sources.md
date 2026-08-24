---
title: 'Add Filipino Manual Discovery Sources'
type: 'feature'
created: '2026-08-23'
status: 'done'
baseline_commit: 'NO_VCS'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/2-2-approve-permitted-discovery-sources.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The initial Permitted Sources catalog contains five general job platforms, but it omits several platforms commonly used by Filipino job seekers: Kalibrr, PhilJobNet, and OnlineJobs.ph. Adrian wants these available in the app alongside the existing manual-only sources.

**Approach:** Seed those three sources as additional manual-browser-only records and surface them in the local source policy view. They will be saved as approved manual paths with zero application requests; this adds useful browser handoffs without authorizing collection from any website.

## Boundaries & Constraints

**Always:** Preserve the five existing source records; add Kalibrr, PhilJobNet, and OnlineJobs.ph exactly once for new and existing local databases; use a new ordered migration rather than changing the already-released `0012` migration; make all three manual-browser-only with disabled retrieval, zero request budget/rate limit, no integration-fetched content, and stop/manual-import guidance; update the default catalog, truthful UI copy, and tests; retain all local-only, policy, audit, accessibility, concurrency, and recovery rules from Story 2.2.

**Ask First:** Adding any automatic retrieval, API key, external request, partner integration, browser extension, scraping behavior, or a source beyond the three named platforms.

**Never:** Modify historical migration `0012`; infer external API permission; make a network request; create an adapter, refresh, scheduler, retry, crawler, credential store, or automated page reader; expose source URL or policy text through audit metadata.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| New local workspace | Migrations run for the first time | Eight named manual-only sources appear, including Kalibrr, PhilJobNet, and OnlineJobs.ph | No audit event or external request is created by seeding. |
| Existing workspace | Migration `0012` already applied, `0013` pending | Exactly the three new source records are added once; existing records remain unchanged | Re-running migrations stays idempotent. |
| Source selection | User views Permitted Sources | UI identifies all eight baseline sources as manual-only and says none is enabled for retrieval | Normal browser page/manual import remains the recovery route. |
</frozen-after-approval>

## Code Map

- `src/persistence/migrations/0012_source_configurations.sql` — existing baseline migration; immutable and must remain unchanged.
- `src/persistence/migrations.ts` — ordered migration registry.
- `src/domain/discovery/source-configurations.ts` — authoritative in-memory default catalog and source-policy validation.
- `src/app/permitted-sources.tsx` — visible manual-source explanation.
- `tests/source-configurations.test.ts` — local source persistence and safety coverage.
- `tests/source-configurations-ui.test.ts` — static accessibility/copy guardrails.

## Tasks & Acceptance

**Execution:**

- [x] `src/persistence/migrations/0013_filipino_manual_sources.sql` — seed Kalibrr, PhilJobNet, and OnlineJobs.ph as immutable, disabled manual-browser source revisions and current pointers; use unique stable UUIDv7 identifiers and metadata-only local values.
- [x] `src/persistence/migrations.ts` — register migration `0013_filipino_manual_sources` after `0012_source_configurations`.
- [x] `src/domain/discovery/source-configurations.ts` — extend `defaultSourceConfigurations` with the three matching manual source records.
- [x] `src/app/permitted-sources.tsx` — update the introductory source list so it truthfully names all eight manual-only sources.
- [x] `tests/source-configurations.test.ts` and `tests/source-configurations-ui.test.ts` — prove the eight-source baseline, new names, zero retrieval settings, migration idempotence, and absence of retrieval controls.

**Acceptance Criteria:**

- Given a new local workspace, when Permitted Sources loads, then it lists the existing five sources plus Kalibrr, PhilJobNet, and OnlineJobs.ph as eight disabled manual-only sources with zero app request budget/rate limit.
- Given an existing database where `0012_source_configurations` is already applied, when `0013_filipino_manual_sources` runs, then it adds exactly the three new records without editing existing revisions or producing audit events.
- Given any normal list or save action, when the feature completes or fails, then it makes no network request, automated retrieval attempt, browser automation, scheduler, retry, adapter invocation, credential access, or policy bypass.

## Spec Change Log

## Design Notes

The catalog is migration-seeded because default source configuration must be visible in the persisted local workspace and survive app restarts. A new migration is necessary: editing `0012` would leave already-created user databases without the newly selected platforms and would rewrite released history.

## Verification

**Commands:**

- `npm test` — expected: all existing and updated source-configuration tests pass.
- `npm run typecheck` — expected: no TypeScript errors.
- `npm run lint` — expected: no lint errors.
- `npm run build` — expected: production build succeeds.

## Suggested Review Order

**Safe catalog migration**

- Adds the three Filipino-focused manual entries without altering released migration history. [`0013_filipino_manual_sources.sql:1`](../../src/persistence/migrations/0013_filipino_manual_sources.sql#L1)
- Registers the upgrade after the original source catalog. [`migrations.ts:19`](../../src/persistence/migrations.ts#L19)

**Policy and UI safety**

- Keeps the in-memory fallback catalog aligned with persisted source records. [`source-configurations.ts:22`](../../src/domain/discovery/source-configurations.ts#L22)
- Derives displayed status from saved records and preserves zero manual limits on submission. [`permitted-sources.tsx:17`](../../src/app/permitted-sources.tsx#L17)

**Regression proof**

- Covers fresh and upgrade migrations, idempotence, safety, and canonical digests. [`source-configurations.test.ts:16`](../../tests/source-configurations.test.ts#L16)
- Keeps accessibility and source-name coverage aligned with the dynamic UI. [`source-configurations-ui.test.ts:5`](../../tests/source-configurations-ui.test.ts#L5)
