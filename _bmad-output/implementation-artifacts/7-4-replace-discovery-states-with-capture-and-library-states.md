---
baseline_commit: cf93cd8
context:
  - '{project-root}/_bmad-output/planning-artifacts/epics.md'
  - '{project-root}/_bmad-output/planning-artifacts/prds/prd-Resume-2026-08-06/prd.md'
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-Resume-2026-08-07/ARCHITECTURE-SPINE.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-Resume-2026-08-06/EXPERIENCE.md'
  - '{project-root}/_bmad-output/implementation-artifacts/7-1-reframe-jobs-as-an-opportunity-library.md'
  - '{project-root}/_bmad-output/implementation-artifacts/7-2-capture-an-opportunity-from-user-provided-content.md'
  - '{project-root}/_bmad-output/implementation-artifacts/7-3-confirm-and-preserve-captured-opportunity-details.md'
---

# Story 7.4: Replace Discovery States with Capture and Library States

Status: done

## Story

As Adrian,
I want every saved-role workflow to be clear and local-first,
so that I never mistake pasted content for an automatically retrieved listing.

## Acceptance Criteria

1. **Captured Opportunity terminology.** Given a Jobs, Opportunity Detail, Applied, or Resume Coach view refers to a role, when it renders, then it uses **Captured Opportunity** / local-library language and never claims that the app opened, fetched, verified, refreshed, crawled, parsed remotely, or retrieved the source URL.
2. **No reachable discovery-only active state.** Given a legacy discovery-only control or state is reachable in active UI, when Epic 7 is complete, then it is removed or replaced with an appropriate capture/library path without weakening privacy, provenance, accessibility, or explicit outbound handoff.
3. **Preserve the manual boundary.** The only forward role intake is explicit URL-plus-copied-description capture, local structuring, and explicit confirmation. URL attribution is an outbound handoff only; no network request, browser automation, source adapter, refresh, credentials, AI, or background behavior participates.
4. **Accessible local-first recovery.** At 320 CSS px/400% zoom and with keyboard/screen-reader use, capture/library, Applied, and legacy-safe error states retain labels, focus, live status, text-plus-non-colour meaning, associated errors, and a reachable safe next action.

## Tasks / Subtasks

- [x] **Task 1: Inventory and replace active retrieval-era role states (AC: 1-3)**
  - [x] Trace the active Jobs composition (`src/app/page.tsx`, `src/app/job-listings.tsx`, `src/app/opportunity-capture.tsx`) plus active role references in Applications, Resume, and Career Assistant routes/components.
  - [x] Replace user-facing **Job Listing**, source/refresh/freshness/result, and retrieved-posting claims with truthful Captured Opportunity, copied-details, capture-date, local-fit, or explicit external-handoff language as appropriate.
  - [x] Remove or reroute reachable discovery-only controls/state from the active product flow. Preserve historical Epic 2 modules, migrations, audit history, and direct legacy routes; do not delete them merely because they are no longer advertised.
  - [x] Ensure an active role state is backed by the captured-opportunity projection rather than legacy `job_listings` wherever the view promises an Opportunity Library record. Do not migrate historical source records into captured revisions.

- [x] **Task 2: Complete local library and downstream handoff integration (AC: 1-3)**
  - [x] Make the post-confirmation success path and All opportunities/Applied views truthfully expose saved Captured Opportunities, their local fields, capture date, attribution, and explicit outbound handoff without technical IDs or raw copied text in the scan path.
  - [x] Keep duplicate suggestions non-destructive and human-readable; both records remain intact. Do not revive legacy duplicate overrides for captured Opportunities.
  - [x] Update active Fit/Resume Coach/Application entry points only as needed to accept a Captured Opportunity context. Do not implement Fit calculation, Resume Coach generation, Applied persistence, or application submission beyond an honest unavailable/next-step state when their later story is not implemented.

- [x] **Task 3: Prove boundary, recovery, and accessibility behavior (AC: 1-4)**
  - [x] Extend domain/repository tests for captured-library projection and no partial/legacy mutation; add UI tests for terminology, local empty/error/success states, capture return focus, responsive reflow selectors, and explicit outbound handoff.
  - [x] Add static guardrails over active role-facing modules for no `fetch(`, URL opening except explicit user handoff, timers/polling, browser automation, adapters, source configuration, refresh, credentials, and AI imports.
  - [x] Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`.

### Review Findings

- [x] [Review][Patch] Keep copied role text and technical revision metadata out of the client library payload [src/domain/opportunities/captured-opportunities.ts:18]
- [x] [Review][Patch] Restore focus to a connected Jobs control after the first saved opportunity replaces the empty-state trigger [src/app/job-listings.tsx:24]
- [x] [Review][Patch] Clear a stale library search when returning after confirmation so the saved opportunity is visible [src/app/job-listings.tsx:30]
- [x] [Review][Patch] Refer to tracked roles as captured local opportunities on the reachable Applications route [src/app/applications.tsx:6]

## Dev Notes

### Authoritative forward boundary

- The PRD approved change supersedes conflicting discovery rules. The MVP is a private local-first Opportunity Workspace: Adrian finds roles externally, supplies URL and copied description, reviews local structure, explicitly confirms, then uses fit/Resume Coach and deliberately opens the original page to apply.
- A URL is retained as attribution and an outbound handoff only. Never fetch, scrape, crawl, automate a browser, configure a source, refresh a feed, invoke an adapter, use credentials, or infer user-provided content was independently verified/current.
- `captured_opportunities`, immutable `captured_opportunity_revisions`, and duplicate suggestions from Story 7.3 are the forward persistence model. `job_listings` and retained source records are historical compatibility data; never alter migrations `0016`–`0020` or merge/rewrite historical records.

### Existing implementation and regression prevention

- Preserve the Story 7.1 Jobs shell, local search/filter, Applied sub-tab, focus-safe native capture dialog, responsive muted-forest styling, safe original-page handoff, and direct legacy routes.
- Reuse `src/domain/opportunities/captured-opportunities.ts` and `src/persistence/captured-opportunities-repository.ts` for read projections. Keep persistence behind domain/repository modules; React and server action code must not use direct SQLite.
- Story 7.3 confirmation returns only safe display data. Preserve its metadata-only audit event, UUIDv7/UTC/digest constraints, immutable triggers, recovery semantics, and no-double-submit protection.
- Do not treat the old legacy Jobs view as proof that a capture was saved. The active library must render the forward captured projection, while legacy discovery pages remain historical/direct-route-safe.

### UX and accessibility

- Follow the approved Jobs Browse visual system and the current centered native capture dialog; this story does not reopen that design. Keep Actions explicit, copy truthful, and technical metadata progressive.
- Use semantic labels, visible focus, `aria-invalid`/`aria-describedby`, polite status, text-plus-non-colour state, keyboard operation, Escape/focus restoration for the dialog, and responsive stacked records at 320px/400% zoom.
- Original-page links are explicit user clicks with `target="_blank"` and `rel="noreferrer"`; name the host and state that application/submission occurs outside the workspace with no prefill.

### Scope exclusions

- Do not add automated retrieval, source configuration, source-policy/rate-limit work, a crawler, background refresh, cloud/local AI, Fit scoring rules, Resume Coach generation, Google Sheets, application submission, or durable Applied tracking. Those are historical or later-story work.
- Do not delete historical Epic 2 code/data or legacy routes. This story changes active terminology and routes, not archival preservation.

### Expected implementation areas

```text
src/app/page.tsx
src/app/job-listings.tsx
src/app/opportunity-capture.tsx
src/app/actions.ts
src/domain/opportunities/captured-opportunities.ts
src/persistence/captured-opportunities-repository.ts
src/app/[section]/page.tsx and active role-facing route components as required
tests/job-listings-ui.test.ts
tests/opportunity-capture-ui.test.ts
tests/captured-opportunities.test.ts
additional focused domain/UI tests only where coverage is missing
```

## Dev Agent Record

### Debug Log

- 2026-08-25: Browser-level inspection could not start because the local Playwright Bash host returned `E_ACCESSDENIED`; verified the existing 400 px responsive modal and stacked-card selectors through source and automated UI contracts instead.

### Completion Notes List

- 2026-08-25: Replaced the active Jobs data source with the immutable captured-opportunity projection and rendered a captured-only Opportunity Library with local search, truthful Applied future state, and explicit original-page handoff.
- 2026-08-25: Preserved the centered capture dialog and made its successful return explicitly reset the view to All opportunities before restoring focus; removed Settings discovery terminology from the active shell.
- 2026-08-25: Verified with 107 passing tests, typecheck, lint, production build, and `git diff --check`.
- 2026-08-25: Code review fixed library payload minimization, post-save focus and search recovery, and Captured Opportunity terminology on the Applications route. Verified with 107 passing tests, typecheck, lint, production build, and `git diff --check`.

- 2026-08-25: Ultimate context engine analysis completed. Story context incorporates the approved Manual Opportunity Capture MVP, Epic 7 ordering, current UX, architecture AD-12, and the completed 7.1–7.3 implementation/review learnings.

## File List

- _bmad-output/implementation-artifacts/sprint-status.yaml
- src/app/page.tsx
- src/app/job-listings.tsx
- src/app/opportunity-capture.tsx
- src/app/applications.tsx
- src/app/[section]/page.tsx
- src/domain/opportunities/captured-opportunities.ts
- tests/applications-workspace-ui.test.ts
- tests/captured-opportunities.test.ts
- tests/job-listings-ui.test.ts
- tests/opportunity-capture-ui.test.ts
- tests/shared-visual-polish-ui.test.ts
- _bmad-output/implementation-artifacts/7-4-replace-discovery-states-with-capture-and-library-states.md

## Change Log

- 2026-08-25: Replaced the active Jobs discovery listing surface with the captured Opportunity Library, preserved the manual boundary, and updated verification coverage.
- 2026-08-25: Resolved all four Story 7.4 code-review findings and verified the full suite.
- 2026-08-25: Created implementation-ready Story 7.4 context for replacing active discovery-era role states with local Captured Opportunity library states.
