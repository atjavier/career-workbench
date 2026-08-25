---
baseline_commit: NO_VCS
---

# Story 7.3: Confirm and Preserve Captured Opportunity Details

Status: done

## Story

As Adrian,
I want to verify the fields derived from my pasted posting,
so that fit and Resume Coach use information I trust.

## Acceptance Criteria

1. **Explicit confirmation creates the first durable Opportunity revision**
   - Given a valid local capture draft from Story 7.2, when Adrian confirms or corrects title, company, location, work style, requirements, and an available posted date, then the app persists one immutable Captured Opportunity revision in local SQLite.
   - The revision retains the normalized user-provided original URL, copied description, capture timestamp, confirmed fields, and `Unknown` values. It records one metadata-only audit event; the audit contains neither copied text nor URL.
   - No URL is fetched, opened, verified, scraped, crawled, passed to an adapter, or submitted to an employer. No source configuration, refresh, credential, AI, or background behavior participates.

2. **Truthful confirmation and recovery**
   - The review surface presents human-labelled editable fields and makes **Confirm and save opportunity** an explicit action. It states that the original page is attribution only and that the saved record remains local.
   - Invalid or stale/failed confirmation preserves Adrian’s entered correction values, gives accessible field-level errors and a polite status/safe-next-action message, and writes no partial Opportunity, revision, duplicate decision, or audit event.
   - Confirmed requirements are bounded, plain text values; unsupported/blank values become `Unknown` only where the user intentionally leaves a field unknown. Do not invent facts or silently replace a user correction with parser output.

3. **Immutable local provenance**
   - Add a new forward-only migration after `0018` for captured Opportunity identity, immutable revisions, and non-destructive duplicate suggestions. Do not edit historical migrations `0016`–`0018` or reuse `job_listings` / `retained_job_source_records`.
   - Every captured revision has UUIDv7 identity, UTC timestamps, SHA-256 content digest, bounded values, foreign keys, and database triggers that reject update/delete. The repository validates stored rows before exposing them.
   - A saved Opportunity is readable through a new captured-opportunity domain projection for later Jobs, Fit, Resume Coach, and Applied work; do not migrate the active Jobs listing view to it until Story 7.4 unless the minimum post-save success view requires it.

4. **Local duplicate suggestion, never a merge**
   - Given a newly confirmed Opportunity has the same normalized title and company as an existing captured Opportunity, when confirmation completes, then the app records/shows a local probable-duplicate suggestion that identifies both saved records without exposing technical IDs.
   - Both records and all revisions remain intact. There is no automatic deduplication, merge, deletion, source-record mutation, or use of legacy duplicate overrides. Resolution controls are deferred; this story only preserves the suggestion truthfully.

5. **Accessible, responsive Jobs flow**
   - The capture review transitions from **Review capture** to editable confirmation without a modal, forced navigation, technical/debug output, or loss of keyboard context. On success it identifies the saved local Opportunity and offers a clear return to **All opportunities**.
   - Labels, help/error associations, visible focus, pending state, semantic buttons, non-colour feedback, and 320px/400% reflow remain intact. Use the existing muted-forest system and keep capture/confirmation facts stacked on narrow screens.

## Scope and Dependencies

- **Depends on:** Story 7.2 (done) capture draft and Story 7.1 (done) Jobs shell.
- **Enables:** Story 7.4’s library-state replacement and revised Epic 3 fit provenance. Story 3.2 remains blocked until this story is done.
- **Do now:** Durable captured-opportunity schema/repository/domain command, metadata-only audit action, local duplicate suggestion, confirmation form/action, and tests.
- **Do not do now:** URL retrieval, source configuration/refresh, legacy listing migration, automatic merge, duplicate-resolution controls, Fit calculation, Resume Coach tailoring, Applied state, Google Sheets, cloud/local AI, employer submission, or any network request.

## Tasks / Subtasks

- [x] **Task 1: Add immutable Captured Opportunity persistence (AC: 1, 3, 4)**
  - [x] Add migration `0019_captured_opportunities.sql` and register it in `src/persistence/migrations.ts`. Create separate identity, revision, and duplicate-suggestion tables with UUIDv7/UTC/SHA-256/bounded checks, foreign keys, indexes, and immutable update/delete triggers.
  - [x] Store the copied description only in the revision table; never audit it. Store original URL/capture time/user-confirmed fields in the revision, and preserve `Unknown` rather than using null to hide a missing fact.
  - [x] Add `src/persistence/captured-opportunities-repository.ts` with insert/list/read helpers and strict stored-row validation. No direct SQL from React or action modules.

- [x] **Task 2: Implement confirmation and duplicate-suggestion domain commands (AC: 1–4)**
  - [x] Add `src/domain/opportunities/captured-opportunities.ts` to validate a confirmed draft, allocate UUIDv7 IDs, digest the immutable revision, write the identity/revision/suggestion in one `BEGIN IMMEDIATE` transaction, and append `opportunity.captured` metadata-only audit action.
  - [x] Validate all client-submitted confirmation fields server-side using Story 7.2 bounds plus explicit bounds for editable values. Preserve corrections on failure and return safe `OPPORTUNITY_*` errors; do not trust hidden form values without validation.
  - [x] Derive a duplicate key only from normalized confirmed title + company. Record a probable suggestion when another captured Opportunity shares it; retain both records/revisions and never invoke legacy `applyDuplicateOverride`.
  - [x] Add the audit action union in `src/audit/audit-event.ts` and verify its hash includes metadata only—not URL, copied description, or confirmed field content.

- [x] **Task 3: Extend the capture UI with editable confirmation (AC: 1, 2, 5)**
  - [x] Refactor `src/app/opportunity-capture.tsx` so a current review draft presents labelled editable title/company/location/work-style/requirements/posted-date inputs plus explicit **Confirm and save opportunity** action. Keep URL and copied description as attribution/provenance, not editable source claims.
  - [x] Add a dedicated `opportunityConfirmationAction` and serializable action state in `src/app/actions.ts`; it calls only the new domain command, revalidates the local Jobs path after a successful transaction, and returns field-safe errors/success. Keep the Story 7.2 draft action no-write.
  - [x] Preserve edits after any action error. Announce status politely, disable confirmation during pending work, and prevent double submission. On success, show a human-facing local saved state and non-technical duplicate-suggestion message if applicable.
  - [x] Add only required confirmation/responsive selectors to `src/app/globals.css`; retain existing muted-forest tokens and narrow-screen stacking.

- [x] **Task 4: Prove immutability, local boundaries, and UX recovery (AC: 1–5)**
  - [x] Add domain/repository tests for one confirmed immutable revision, UUID/digest/audit metadata privacy, rejected writes leaving no partial rows, immutable trigger enforcement, and read projection validation.
  - [x] Cover duplicate suggestion creation with two same-title/company confirmations; prove both Opportunities and revisions remain, with no merge or legacy-table mutation.
  - [x] Update UI-contract tests for editable confirmation controls, field-error wiring, status/pending state, local-only/saved copy, non-technical duplicate message, and responsive selectors.
  - [x] Add static guardrails across the new domain/repository/action/UI modules: no `fetch(`, timers, browser automation, adapter/source/refresh imports, URL opening, AI, legacy listing import/duplicate override, or audit payload content.
  - [x] Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`.

## Dev Notes

### Architecture and Safety Guardrails

- AD-12 requires the confirmation boundary to persist an immutable Opportunity revision only after explicit user confirmation, with a metadata-only audit event. Unknown stays Unknown and duplicate suggestions are non-destructive.
- Story 7.2’s `captureOpportunityDraft` validates/derives an in-memory draft but intentionally creates no durable state. Reuse its bounded URL/description rules; do not turn its review action into a persistence shortcut.
- The old `job_listings` and `retained_job_source_records` schema requires source revision/refresh provenance. It is historical and incompatible with the manual-capture path. Do not mutate it, its repositories, or migrations `0016`–`0018`.
- Follow existing `resolveAppDataPaths` → `openDatabase` → `applyMigrations` → transaction → repository → `appendAuditEvent` patterns. All persistence belongs behind domain/repository modules, never React.
- Audit action content must be a SHA-256 digest of safe metadata only. The URL, copied posting, requirements, and user corrections must never be put in audit fields or logs.

### Existing Files to Read Before Editing

- `src/domain/opportunities/capture-draft.ts`: current serializable in-memory draft and conservative parser; preserve its local/no-network rules.
- `src/app/opportunity-capture.tsx`: controlled inputs, `useActionState`, draft-current guard, accessible descriptions, and Review capture panel; confirmation should extend this flow rather than introduce a separate application destination.
- `src/app/actions.ts`: established safe error/revalidation actions. Keep the capture action no-write and isolate confirmation from historical `jobListingsAction`.
- `src/audit/audit-event.ts`, `src/persistence/database.ts`, `src/persistence/workspace-repository.ts`, and current migrations: use their UUID/digest/transaction conventions.

### Testing and Framework Requirements

- Stack: Next.js 16.3, React 19.2, TypeScript 5.9, Node 24, `node:test` with `tsx`. No additional dependency is authorized.
- Test time/UUID-sensitive behavior deterministically where possible. Assert actual SQLite rows/triggers—not only source text—and assert that failed confirmation leaves every relevant table/audit count unchanged.
- Keep static UI guardrails plus executable domain tests. Verify all existing tests, typecheck, lint, and build after implementation.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 7.3: Confirm and Preserve Captured Opportunity Details]
- [Source: _bmad-output/planning-artifacts/prds/prd-Resume-2026-08-06/prd.md#15. Approved Change - Manual Opportunity Capture MVP]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-Resume-2026-08-07/ARCHITECTURE-SPINE.md#AD-12 - Manual Opportunity Capture]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-Resume-2026-08-06/EXPERIENCE.md#Opportunity capture flow]
- [Source: _bmad-output/implementation-artifacts/7-2-capture-an-opportunity-from-user-provided-content.md]
- [Source: src/domain/opportunities/capture-draft.ts]
- [Source: src/audit/audit-event.ts]
- [Source: src/persistence/database.ts]

## Dev Agent Record

### Agent Model Used

GPT-5.6

### Debug Log References

- Story context analysis completed 2026-08-25: Epic 7/Manual Opportunity Capture contract, AD-12, current Story 7.2 implementation/review outcomes, and persistence/audit conventions reviewed.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- This story is the explicit first durable write for the forward manual-capture model; it excludes URL retrieval and preserves duplicate candidates without merging.
- Implemented immutable local captured Opportunities, metadata-only audits, and non-destructive duplicate suggestions.
- Added editable confirmation, safe field recovery, pending protection, local saved feedback, and responsive stacking.
- Validated with `npm test` (106 passing), `npm run typecheck`, `npm run lint`, and `npm run build`.

### File List

- _bmad-output/implementation-artifacts/7-3-confirm-and-preserve-captured-opportunity-details.md
- src/persistence/migrations/0019_captured_opportunities.sql
- src/persistence/migrations.ts
- src/persistence/captured-opportunities-repository.ts
- src/domain/opportunities/captured-opportunities.ts
- src/domain/workspace/types.ts
- src/audit/audit-event.ts
- src/app/actions.ts
- src/app/opportunity-capture.tsx
- src/app/globals.css
- tests/captured-opportunities.test.ts
- tests/opportunity-capture-ui.test.ts

### Review Findings

- [x] [Review][Patch] Preserve the reviewed draft capture timestamp through confirmation [src/domain/opportunities/captured-opportunities.ts:16]
- [x] [Review][Patch] Identify both records in a probable-duplicate suggestion without exposing IDs [src/app/opportunity-capture.tsx:54]
- [x] [Review][Patch] Validate every stored identity and revision field before exposing its projection [src/persistence/captured-opportunities-repository.ts:7]
- [x] [Review][Patch] Reject requirements whose JSON representation exceeds the persisted column bound [src/domain/opportunities/captured-opportunities.ts:16]
- [x] [Review][Patch] Make the post-save return control close the modal before returning to All opportunities [src/app/opportunity-capture.tsx:54]
- [x] [Review][Patch] Reset confirmation state when reviewing another draft in the same open modal [src/app/opportunity-capture.tsx:43]
- [x] [Review][Patch] Allow valid HTTPS URLs that contain @ outside embedded credentials [src/persistence/migrations/0020_captured_opportunity_url_constraint.sql:1]

## Change Log

- 2026-08-25: Created Story 7.3 implementation guide for immutable captured-opportunity confirmation and local duplicate suggestions.
- 2026-08-25: Implemented captured-opportunity confirmation, duplicate suggestions, UI recovery, and automated coverage.
- 2026-08-25: Resolved all code-review findings and verified the forward-only workspace upgrade path.
