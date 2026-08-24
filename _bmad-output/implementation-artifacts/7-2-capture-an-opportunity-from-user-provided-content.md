---
baseline_commit: NO_VCS
---

# Story 7.2: Capture an Opportunity from User-Provided Content

Status: done

## Story

As Adrian,
I want to paste a job URL and copied description,
so that I can turn an externally found role into a local Opportunity without scraping it.

## Acceptance Criteria

1. **Explicit, local-only capture**
   - Given Adrian selects **Add opportunity** from Jobs, when the capture area opens, then it clearly asks for a posting URL and copied job-description text, explains that both stay local, and says the app does not open, fetch, or verify the URL.
   - Given he supplies a valid URL and copied description, when he submits **Review capture**, then the app performs no network, browser, source-adapter, refresh, credential, AI, or background action. The URL is attribution and a later explicit outbound handoff only.

2. **Reviewable structured draft, not a saved record**
   - When a valid capture is submitted, then a deterministic local parser prepares a serializable, reviewable draft with the normalized original URL, capture timestamp, copied description, and derived title, company, location/work style, requirements, and available posted date.
   - The parser may use only facts in the copied text. It must never infer fields from the URL, host, source configuration, refresh data, an LLM, or a network response. A value it cannot safely identify is **Unknown**.
   - This story does **not** create, update, merge, or mark Applied any Opportunity. It writes no database row, migration, file, audit event, source record, duplicate decision, Fit Assessment, or persistent draft. Persistence and explicit confirmation belong solely to Story 7.3.

3. **Validation and recovery**
   - Given the URL is absent, malformed, non-HTTPS, includes embedded credentials, or exceeds 2,048 characters, when Adrian attempts review, then the URL has an accessible field-level error and no draft is produced.
   - Given copied description text is blank after trimming, too short to be a useful posting (under 80 characters), or exceeds 200,000 characters, when Adrian attempts review, then the description has an accessible field-level error and no draft is produced.
   - On every validation failure, entered local URL and description remain available for correction. The error summary and field errors are announced without relying on colour alone. No Opportunity is created.

4. **Jobs-first, responsive capture experience**
   - **Add opportunity** is a functioning primary entry point rather than the Story 7.1 coming-next placeholder. Keep Jobs / All opportunities / Applied navigation and the existing saved-library controls available and truthful.
   - The capture form has visible labels, supporting privacy copy, native keyboard-operable controls, a visible focus ring, logical heading order, and an announced pending/review state. At 320 CSS px and 400% zoom, URL, pasted text, field errors, and draft facts reflow without horizontal two-dimensional scrolling.
   - Use the muted-forest visual system and its strongest primary affordance for **Review capture**. The review draft is calm and human-readable, not an API/debug panel. It clearly tells Adrian that reviewing does not save yet and that he will confirm/correct details in the next step.

## Scope and Dependencies

- **Depends on:** Story 7.1 (done) for the Jobs-first Opportunity Library and real Add opportunity entry. Epic 1 remains the local-first workspace foundation.
- **Enables:** Story 7.3, which adds confirmation/correction, immutable captured-Opportunity persistence, metadata-only audit, and local duplicate suggestion. Story 3.2 remains blocked until 7.2 and 7.3 are complete.
- **Do now:** Render the capture form, validate bounded user input, normalize the URL, parse copied text locally into a temporary review draft, show accessible recovery states, and replace the unavailable Story 7.1 capture placeholder.
- **Do not do now:** Save an Opportunity, add a migration or repository, mutate `job_listings` / `retained_job_source_records`, invoke `importManualJobListing`, create an audit event, calculate fit, identify a persisted duplicate, run a model, open the URL, make an HTTP request, scrape/crawl, automate a browser, add source policy/configuration/refresh behavior, or add employer-application submission.
- **Historical preservation:** Do not delete or alter applied migrations `0016`–`0018`, completed Epic 2 code/data, legacy direct routes, or existing source-bound domain tests. They are historical compatibility code and are not the active capture path.

## Tasks / Subtasks

- [x] **Task 1: Introduce a bounded, pure capture-draft command (AC: 1–3)**
  - [x] Add a focused domain module under `src/domain/opportunities/` (for example, `capture-draft.ts`) rather than extending the legacy source-bound `src/domain/discovery/job-listings.ts` import contract.
  - [x] Export serializable capture input/draft/error-safe types and one deterministic command that accepts only `postingUrl`, `copiedDescription`, and an injectable clock for tests.
  - [x] Normalize only a valid HTTPS URL without username/password and with a maximum normalized length of 2,048. Trim user input; do not dereference, inspect, or derive facts from the URL.
  - [x] Enforce copied-description bounds of 80–200,000 trimmed characters. Preserve the full user-provided copied description in the in-memory review draft only; never put it into logs/audit state.
  - [x] Derive review fields conservatively from pasted text. Keep recognized text verbatim except harmless whitespace normalization. Do not invent title/company/location/work style/requirements/posted date; use the literal `Unknown` presentation value where no supported explicit text is found. Keep parsing deterministic and dependency-free.
  - [x] Capture an ISO-8601 UTC timestamp at command execution. The draft must distinguish a user-provided URL from derived fields and must not call itself retrieved, verified, current, or source-permitted.
  - [x] Extend `SafeWorkspaceErrorCode` only if a capture-specific safe error is needed; use field-specific errors in the action state rather than exposing stack traces or raw parser diagnostics.

- [x] **Task 2: Add a dedicated capture action with no persistence side effects (AC: 1–3)**
  - [x] In `src/app/actions.ts`, add a narrowly named capture action/state (for example, `opportunityCaptureAction` and `OpportunityCaptureActionState`). Do not overload `jobListingsAction` or route the form through its historical `manual-import` branch.
  - [x] The action reads only the URL and copied-description form fields, invokes the pure capture-draft command, and returns a serializable draft or safe field errors. It must not import `resolveAppDataPaths`, `openDatabase`, `applyMigrations`, repositories, audit helpers, adapters, `fetch`, or `revalidatePath` for this capture command.
  - [x] Keep `WorkspaceActionState` and existing duplicate/Fit actions working. Capture success copy must say the draft is ready for review and is **not saved yet**; failure copy must identify correction as the safe next action.

- [x] **Task 3: Replace the placeholder with the guided capture form and draft (AC: 1, 2, 4)**
  - [x] Add a focused client component such as `src/app/opportunity-capture.tsx`, using React `useActionState` at component top level with the dedicated action. Keep transient form values in component state so invalid submissions do not erase them.
  - [x] Update `src/app/job-listings.tsx` to link/scroll to the real capture component. Remove `#capture-coming-next` and its unavailable placeholder copy; do not duplicate the form in empty and populated states.
  - [x] Provide labelled URL and multiline copied-description fields, useful input hints, a visible local-only disclosure, individual `aria-invalid` / `aria-describedby` relationships for errors, an `aria-live="polite"` status summary, and a disabled/pending review button state.
  - [x] After valid submission, show a review draft with a clear **Review capture** result, normalized URL attribution, capture timestamp, and labelled derived facts. Include an explicit note that nothing is saved and Story 7.3 will provide confirmation/correction. Do not render raw implementation metadata, IDs, digests, source configuration, refresh provenance, or parser diagnostics.
  - [x] Preserve keyboard-only use and focus visibility. Do not use a modal, hover-only disclosure, automatic redirect, external link opening, timer, or client-side network API.

- [x] **Task 4: Add responsive styling without changing the shared visual contract (AC: 4)**
  - [x] Extend `src/app/globals.css` only with capture-specific selectors that use existing muted-forest tokens, semantic action classes, card/panel treatment, and `overflow-wrap: anywhere` safeguards.
  - [x] Make the text area comfortable on desktop, single-column/reflow-safe on narrow screens, and keep the 24px desktop / 20px tablet / 16px phone gutters introduced by Story 7.1.
  - [x] Do not introduce a component library, remote font, remote asset, new dependency, competing visual theme, or technical-admin presentation.

- [x] **Task 5: Prove boundaries, validation, and regressions (AC: 1–4)**
  - [x] Add domain tests for valid local draft creation, normalized URL/capture timestamp, conservative Unknown values, and every invalid URL/description boundary. Inject time rather than depending on wall-clock assertions.
  - [x] Prove valid and invalid capture calls do not create rows in `job_listings`, `retained_job_source_records`, `fit_assessments`, or `audit_events`; no migration is added.
  - [x] Add/update UI-contract tests for real Add opportunity capture, labels, textarea, field error wiring, polite status, draft-not-saved disclosure, local-only copy, and narrow reflow selectors.
  - [x] Add static guardrails for the active capture component/action/domain module: no `fetch(`, HTTP client, timer/polling, `window.open`, browser automation, adapter, source configuration, refresh, credential, database/repository/audit import, URL retrieval claim, or legacy manual-import delegation.
  - [x] Preserve existing Jobs, duplicate confirmation, Fit, local workspace, and completed Epic 2 test coverage. Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`; report the exact outcome.

### Review Findings

- [x] [Review][Patch] Conservatively derive a title instead of using any first line [src/domain/opportunities/capture-draft.ts:74] — explicit title labels are parsed without their label, while generic headings/metadata produce `Unknown`; regression coverage includes both cases.
- [x] [Review][Patch] Reject impossible posted dates [src/domain/opportunities/capture-draft.ts:64] — UTC component round-trip validation now returns `Unknown` for overflow dates and accepts valid leap dates.
- [x] [Review][Patch] Route malformed URLs through accessible app recovery [src/app/opportunity-capture.tsx:18] — the capture form now uses `noValidate`, leaving bounded validation and announced field feedback to the capture action.
- [x] [Review][Patch] Invalidate a displayed draft after its inputs change [src/app/opportunity-capture.tsx:20] — pending inputs are disabled and a draft renders only when its submitted values match the controlled inputs.
- [x] [Review][Patch] Remove the obsolete capture placeholder selector [src/app/globals.css:110] — the unused `.capture-coming-next` selector was removed.

## Dev Notes

### Product and Architecture Guardrails

- The sole MVP intake path is: find externally → **Add opportunity** → paste URL + copied description → local draft → Story 7.3 confirmation/persistence → fit → Resume Coach → explicit external handoff → Applied. A pasted URL is attribution, never permission to retrieve it.
- AD-12 requires the local command to validate bounded input, retain attribution and capture time, and preserve Unknown. The immutable revision and metadata-only audit occur after user confirmation in Story 7.3, not during this story.
- Keep the distinction precise in all copy: **user-provided copied description**, **locally prepared draft**, and **not saved yet**. Never state or imply fetched, parsed from the page, opened, checked, current, verified, source-permitted, or refreshed.
- The draft must be deterministic and rule-based. Do not use LM Studio, cloud AI, a résumé parser, a source adapter, heuristics based on URL hostname, or network-derived data.
- Do not use the old `importManualJobListing` path: it requires `SourceConfiguration` revision and can insert legacy rows/audit events, directly violating Story 7.2's no-persistence boundary.

### Existing Code Intelligence and Regression Prevention

- `src/app/job-listings.tsx` is already a client component. It owns Jobs local filter state and uses `useActionState(jobListingsAction, initial)` for retained duplicate/Fit actions. Add the capture form as a focused child with its own action state; do not combine unrelated action-state shapes.
- The current `#capture-coming-next` block is intentionally a Story 7.1 placeholder. Replace it with one real `OpportunityCapture` composition and update every Add opportunity anchor to target its stable form/section ID.
- `src/app/actions.ts` uses safe `WorkspaceActionState` returns and `toSafeWorkspaceError`. Keep its existing actions intact, but isolate capture from database imports and revalidation. The capture action's return state must be fully serializable for React Server Functions.
- `src/domain/discovery/job-listings.ts` and `src/persistence/job-listings-repository.ts` are source/refresh-bound compatibility code: `importManualJobListing` writes `job_listings`, `retained_job_source_records`, and `discovery.job_listing_imported`. Do not reuse or modify it for capture.
- Existing `0016`/`0017` tables require source revisions and refresh provenance; no applied migration may be edited. The final Captured Opportunity persistence schema is Story 7.3 work.
- `src/audit/audit-event.ts` enforces metadata-only events. This story creates no audit event at all because it creates no durable state. If a later story adds an audit action, it must never contain the URL or copied description.
- The project is a dirty non-Git worktree (`baseline_commit: NO_VCS`). Preserve unrelated user work; never reset/revert/delete it.

### UX, Accessibility, and Visual Details

- Place capture directly in the Jobs workflow, with **Add opportunity** as the primary action and **Review capture** as the single next step. Keep the rest of the library visible enough to orient the user, but do not add a separate primary tab or a multi-page technical wizard.
- Use plain, reassuring copy such as “Paste the page link and the job description you copied. We do not open the link.” State the two required inputs before submission.
- Form controls need visible `<label>` elements; help and errors must be associated through IDs. Set `aria-invalid` only for invalid fields. Announce results with `role="status" aria-live="polite"`; do not rely on disabled styling, colour, placeholder text, or toast-only feedback.
- The existing tokens are `--surface-base: #F6F8F4`, `--surface-raised: #FFFFFF`, `--canvas: #EEF3EE`, `--ink: #18352C`, `--border: #D7E1DA`, `--primary: #2F6B57`, and `--focus-ring: #176B4C`. Reuse `.affirmative-action`, `.neutral-action`, `.status`, and `.panel` rather than inventing an orange system.
- At 320px/400% zoom, stack capture form and review facts. Preserve safe wrapping for long URLs/descriptions and 2.75rem action height. Do not make the pasted description or any disclosure hover-only.

### Framework and Library Requirements

- Current stack: Next.js 16.3.0, React 19.2.3, TypeScript 5.9.3, Node 24+. Do not add packages for parsing or validation.
- React `useActionState` must be called at component top level; its action receives the prior state and form data, and action state returned from a Server Function must be serializable. Pass the dispatch function to the form `action` prop and use `isPending` for review feedback. [React useActionState](https://react.dev/reference/react/useActionState)
- Keep the established `"use server"` module pattern in `src/app/actions.ts`; all external side effects are prohibited for this story, so parsing should remain pure and dependency-free.

### Expected File Structure

- **New:** `src/domain/opportunities/capture-draft.ts` — bounded pure input validation, normalization, deterministic draft derivation, and injectable-clock support.
- **New:** `src/app/opportunity-capture.tsx` — accessible client form, retained local fields, review-state presentation, and capture-specific `useActionState` integration.
- **Update:** `src/app/actions.ts` — isolated capture action/state only; no persistence or revalidation in that branch.
- **Update:** `src/app/job-listings.tsx` — target/compose the real capture component and remove only the Story 7.1 placeholder.
- **Update:** `src/app/globals.css` — minimal responsive capture styles using existing tokens.
- **New/Update tests:** `tests/opportunity-capture.test.ts` and `tests/opportunity-capture-ui.test.ts`; update `tests/job-listings-ui.test.ts` only for the replaced placeholder/entry target.
- **Do not modify:** applied migrations `0016`–`0018`, legacy repositories, `src/domain/discovery/job-listings.ts`, or historical Epic 2 tests unless a test assertion must be corrected for the active UI copy.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 7.2: Capture an Opportunity from User-Provided Content]
- [Source: _bmad-output/planning-artifacts/epics.md#Approved Change - 2026-08-24: Manual Opportunity Capture MVP]
- [Source: _bmad-output/planning-artifacts/prds/prd-Resume-2026-08-06/prd.md#15. Approved Change - Manual Opportunity Capture MVP]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-Resume-2026-08-07/ARCHITECTURE-SPINE.md#AD-12 - Manual Opportunity Capture]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-Resume-2026-08-06/DESIGN.md#Approved Change - 2026-08-24: Manual Opportunity Capture]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-Resume-2026-08-06/EXPERIENCE.md#Opportunity capture flow]
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-08-24-manual-opportunity-capture.md#2. Recommended Approach]
- [Source: _bmad-output/implementation-artifacts/7-1-reframe-jobs-as-an-opportunity-library.md#Dev Notes]
- [Source: src/app/job-listings.tsx]
- [Source: src/app/actions.ts]
- [Source: src/domain/discovery/job-listings.ts]
- [Source: src/persistence/migrations/0016_job_listings.sql]
- [Source: src/audit/audit-event.ts]
- [Source: React useActionState](https://react.dev/reference/react/useActionState)

## Dev Agent Record

### Agent Model Used

GPT-5.6

### Debug Log References

- Story context analysis completed 2026-08-24: Epic 7, approved Manual Opportunity Capture change, PRD, AD-12 architecture decision, current UX flow, Story 7.1 outcome, active Jobs/action/domain/persistence/test patterns, and current React action-state documentation reviewed.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Story deliberately ends at an in-memory, reviewable local capture draft. No durable Opportunity is created before the explicit confirmation work in Story 7.3.
- Implemented the bounded deterministic capture command, dedicated no-write action, and guided Jobs capture/review surface. Validated 80–200,000 character descriptions, safe HTTPS URLs, Unknown handling, accessible recovery, and no compatibility-table or audit writes.
- Verified: `npm test` (103 pass), `npm run typecheck`, `npm run lint`, and `npm run build` all pass.

### File List

- _bmad-output/implementation-artifacts/7-2-capture-an-opportunity-from-user-provided-content.md
- src/domain/opportunities/capture-draft.ts
- src/domain/workspace/types.ts
- src/app/actions.ts
- src/app/opportunity-capture.tsx
- src/app/job-listings.tsx
- src/app/globals.css
- tests/opportunity-capture.test.ts
- tests/opportunity-capture-ui.test.ts

## Change Log

- 2026-08-24: Created Story 7.2 implementation guide for local-only URL and copied-description capture.
- 2026-08-24: Implemented local-only capture drafting, guided Jobs review UI, and boundary/accessibility regression tests.
- 2026-08-24: Resolved all five code-review findings and verified the full suite again.
