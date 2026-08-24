---
baseline_commit: NO_VCS
---

# Story 7.1: Reframe Jobs as an Opportunity Library

Status: done

## Story

As Adrian,
I want Jobs to show opportunities I have saved,
so that the product is honest about what it knows and I can quickly continue my job search.

## Acceptance Criteria

1. **Empty Opportunity Library**
   - Given Jobs opens with no saved Opportunities, when Adrian views the page, then it explains that saved opportunities appear here and offers **Add opportunity** as the primary action.
   - The active Jobs experience does not show Refresh, source selection, permitted-source setup, source outcomes, or a claimed external result count.

2. **Saved Opportunity Library**
   - Given saved Opportunities exist, when Adrian searches, filters, or opens **All opportunities** / **Applied**, then every control operates only on local records.
   - All opportunities retains a scan-friendly view of title, company, location, work style, capture date, calculated Fit Label when available, and original-URL attribution. Missing values render as **Unknown**; never infer or invent a value.
   - Search, compact filters, result count, and sorting are local-only. A filter-zero state preserves controls and offers **Clear filters**.

3. **Truthful external boundary**
   - The URL is attribution and an explicit outbound handoff only. The UI never says the product opened, fetched, parsed, verified, refreshed, crawled, or retrieved the URL or posting.
   - An original-page link names its host, opens only after an explicit click, uses `target="_blank"` and `rel="noreferrer"`, and states that applying/submitting happens outside the workspace with no prefill or submission.

4. **Jobs-first navigation and responsive access**
   - Jobs has the local sub-tabs **All opportunities** (default) and **Applied**. Applied remains subordinate to Jobs; do not restore a standalone Applications primary destination.
   - The primary shell presents only Jobs, Resume, and Settings. Preserve existing direct routes for legacy workspaces; do not delete their pages or historical backend/domain work.
   - The full-bleed header remains independent of body gutters. Apply the selected muted-forest system and wider canvas (up to 1440px; 24px desktop, 20px tablet, 16px phone gutters).
   - At 320 CSS px / 400% zoom, controls, result status, essential card facts, and actions reflow without horizontal two-dimensional scrolling. Semantic navigation, selected-state text/non-colour cue, labelled controls, visible focus, keyboard operation, and polite result announcements remain available.

## Scope and Dependencies

- **Depends on:** Epic 1 local evidence/base-resume foundation. Existing local `listJobListings()` may provide a temporary read-only compatibility projection.
- **Enables:** Story 7.2 capture, Story 7.3 confirmation/immutable captured revisions, then revised Epic 3 fit work. Story 3.2 remains blocked until 7.2 and 7.3.
- **Do now:** Reframe the active Jobs shell, its read projection, local search/filter/All opportunities view, applied entry point, and visual system.
- **Do not do now:** URL/content capture, parsing, field validation, a network request, browser automation, a source adapter, source configuration, refresh runs, a migration, immutable opportunity revisions, duplicate suggestions, or AI/Resume Coach changes. Those belong to later stories.
- **Historical preservation:** Epic 2's source configuration, refresh, and listing persistence remain intact as historical code/data. Do not delete applied migrations, audit history, domain modules, or direct legacy routes. Do not expose their discovery provenance in the active Jobs experience.

## Tasks / Subtasks

- [x] **Task 1: Simplify the Jobs composition and navigation (AC: 1, 4)**
  - [x] Update `src/app/application-shell.tsx` destination projection to Jobs, Resume, and Settings only; use human-facing Jobs copy such as “Review saved opportunities.”
  - [x] Keep `CompactNavigation` behaviour intact: labelled trigger, Escape close, focus return, and unsaved-edit protection. Update its destination inputs/tests only as required.
  - [x] Update `src/app/page.tsx` so it loads and renders the local Jobs library only. Remove active page imports/renders/anchors for `JobPreferences`, `PermittedSources`, `SourceRefresh`, source configuration state, and refresh-run state.
  - [x] Preserve `ApplicationShell`, `WorkspaceStatus`, truthful local failure/recovery messaging, and Data & Storage. Do not delete the source/refresh components or domain code.
  - [x] Keep legacy `/applications`, `/evidence`, `/google-sheets`, and `/career-assistant` routes functional for direct navigation, but no longer advertise them as primary destinations.

- [x] **Task 2: Rebuild the active Jobs read surface as a local Opportunity Library (AC: 1, 2, 3)**
  - [x] Refactor `src/app/job-listings.tsx` into the product-facing Opportunity Library read projection. It may consume existing `JobListingsView` only as temporary compatibility data; do not extend `importManualJobListing` or its source-bound contract.
  - [x] Replace source/refresh/listing-result copy with Opportunity language. Use page and section labels such as **Your opportunities**, **All opportunities**, **Applied**, **Search opportunities**, and **Add opportunity**.
  - [x] Make **Add opportunity** a real, safe forward entry point only. Until Story 7.2 implements capture, it must not show a fake working capture form or claim that a URL was handled. It may use a clearly labelled unavailable/coming-next state with an explanatory, non-deceptive message.
  - [x] Implement All opportunities as the default selected sub-tab and Applied as the Jobs-subordinate entry. Preserve the selected state semantically (`aria-selected` or the appropriate native pattern) and visibly beyond colour.
  - [x] Keep search and Fit filtering entirely client/local. Add only compact, useful filters that can be backed by current local data; do not add fake source, freshness, or remote filters. Include an honest `role="status" aria-live="polite"` result summary and Clear filters.
  - [x] Card facts must be labelled and readable: title/company anchor, location, work style, capture date, Fit Label/explanation when present, and original URL attribution. For compatibility listings, do not label `firstSeenAt` as a remote observation; if displayed as a temporary capture/saved date, wording must remain truthful. Do not show source configuration revisions, source name, retained source record count, Refresh Run, first-seen/last-observed freshness, IDs, digests, or audit diagnostics in the scan path.
  - [x] Preserve the existing explicit external handoff safety, calculate-fit action where supported by existing data, and accessible duplicate-confirmation Escape/focus-return behaviour. Rename related user-facing copy to avoid discovery claims; leave immutable capture revisions and new duplicate-suggestion behaviour to Story 7.3.

- [x] **Task 3: Apply the approved visual system and responsive layout (AC: 4)**
  - [x] Update `src/app/globals.css` relevant shell and Jobs selectors to the approved muted-forest tokens: base `#F6F8F4`, raised `#FFFFFF`, subtle `#EEF3EE`, ink `#18352C`, border `#D7E1DA`, header `#173B2D`, primary `#2F6B57`, active `#E3EFE8`, focus `#176B4C`.
  - [x] Replace orange/purple UI assumptions only in shared/surface styles affected by this story. Do not introduce a new component library or decorative visual effects.
  - [x] Ensure the header spans the viewport independently of `.workspace-shell`; expand content to the approved responsive width/gutters.
  - [x] Keep card lists vertical and scan-friendly. Retain safe wrapping (`overflow-wrap: anywhere`) for long URLs/text and stack record facts/controls for narrow viewports.

- [x] **Task 4: Prove the active UI is local-first and accessible (AC: 1–4)**
  - [x] Update `tests/application-shell-ui.test.ts` to expect only Jobs, Resume, and Settings primary destinations; retain skip-link, `aria-current`, and focus-token assertions using the muted-forest values.
  - [x] Rewrite `tests/job-listings-ui.test.ts` around the Opportunity Library: Add opportunity, All opportunities/Applied, local search/filter/result count, Unknown fields, clear-filter state, safe outbound handoff, selected semantics, live status, and keyboard duplicate confirmation where retained.
  - [x] Update `tests/shared-visual-polish-ui.test.ts` only for changed truthful Jobs copy/tokens; preserve checks for compact navigation and no network/OAuth leakage.
  - [x] Add/retain static guardrails that the active Jobs surface contains no `fetch(`, timer-based refresh, crawler/browser automation, Refresh control, permitted-source selector, source configuration, or external-results claim.
  - [x] Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`. If a check is unavailable, report the exact command and failure; do not claim success without evidence.

### Review Findings

- [x] [Review][Patch] Duplicate confirmation does not invoke the server action [src/app/job-listings.tsx:37] — the inline confirmation form now invokes `jobListingsAction`, with a regression assertion for the action-bound confirmation form.
- [x] [Review][Patch] Duplicate-group cards can open the wrong original page [src/domain/discovery/job-listings.ts:26] — each card now selects its own retained record by listing ID, with a regression assertion for that attribution.
- [x] [Review][Patch] Active Jobs actions can disclose retired source/refresh terminology [src/app/actions.ts:111] — active action feedback now uses Opportunity-focused local language; a regression test rejects retired discovery terms.
- [x] [Review][Patch] Tablet gutters skip the required 20px layout [src/app/globals.css:38] — the approved 20px tablet gutter and its test assertion are in place.

## Dev Notes

### Product and Architecture Guardrails

- The approved Manual Opportunity Capture change supersedes all earlier discovery/refresh rules for forward MVP work. User URLs are attribution/outbound handoffs, not a capability grant to retrieve them.
- The authoritative forward flow is: find externally → **Add opportunity** → URL + copied description (Story 7.2) → local structuring/confirmation (Story 7.3) → fit → Resume Coach → explicit external handoff → Applied.
- There must be no supplied-URL fetch, HTTP client, scraping, crawling, browser automation, background work, credentials, adapters, policy registry, rate budget, source selection, or silent network action.
- SQLite/local app data remains authoritative. Continue existing server-action → domain → repository → transaction → metadata-only-audit boundaries. Story 7.1 must not add direct SQL from React or a new write path.
- Fit is evidence-led decision support, never a hiring prediction. Preserve its non-predictive explanation; Story 3.1 must later consume immutable captured-opportunity revisions.
- No LM Studio, cloud AI, Google OAuth, Google Sheets sync, application submission, or employer-form prefill belongs in this story.

### Existing Code Intelligence and Regression Prevention

- `src/app/page.tsx` is currently the server Jobs home and loads preferences, sources, refresh runs, and job listings. Remove only the active discovery composition; retain safe data-storage and error handling.
- `src/app/job-listings.tsx` is a client component with `useActionState(jobListingsAction)`, local filter state, safe external host parsing, and duplicate-confirmation focus handling. Reuse these patterns instead of introducing another state/action framework.
- The present `JobListing` / `retained_job_source_records` schema requires source configuration/revision and refresh provenance. It is not the final Opportunity schema. Do not mutate already-applied migrations `0016`–`0018`, break existing domain tests, or make Story 7.1 depend on source metadata.
- Existing `calculate-fit`, duplicate override, and reversal routes are historical/local functions. Preserve working safety semantics if retained, but never expose source provenance or describe the data as refreshed/retrieved.
- The repository is a dirty user worktree. Do not reset, revert, delete unrequested work, or claim a clean baseline. Integrate with current files only.

### Framework and Implementation Notes

- Current app stack is Next.js App Router 16.3 with React 19.2 and TypeScript. Use the established `next/link`, server-action, and `useActionState` patterns; do not add dependencies for this UI reframe.
- React `useActionState` returns `[state, dispatchAction, isPending]`; keep it at component top level and preserve pending/accessible status messaging. [React `useActionState` documentation](https://react.dev/reference/react/useActionState)
- Use `next/link` for internal navigation. Use a regular explicitly clicked anchor for the external original URL, retaining `target="_blank" rel="noreferrer"`. [Next.js Link documentation](https://nextjs.org/docs/app/api-reference/components/link)

### Accessibility Details

- Use `<nav>` with a clear label for primary and Jobs sub-navigation. Give sub-tabs an appropriate keyboard-operable tab/link pattern, a programmatic selected state, and text state in addition to the active colour.
- Inputs/selects/buttons require visible labels and a `#176B4C` focus ring. Ensure 24×24 CSS-pixel targets or an equivalent spacing exception.
- Result changes announce politely. Error and unavailable states name the problem and safe next action. Do not make unavailable Add opportunity look like a working form.
- At 320 CSS px and 400% zoom: no lost actions/facts, no pointer-only path, no hover-only disclosure, and no horizontal two-dimensional scroll. Preserve `overflow-wrap: anywhere` for long text.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Approved Change - 2026-08-24: Manual Opportunity Capture MVP]
- [Source: _bmad-output/planning-artifacts/prds/prd-Resume-2026-08-06/prd.md#15. Approved Change - Manual Opportunity Capture MVP]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-Resume-2026-08-07/ARCHITECTURE-SPINE.md#AD-12 - Manual Opportunity Capture]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-Resume-2026-08-06/DESIGN.md#Approved Change - 2026-08-24: Manual Opportunity Capture]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-Resume-2026-08-06/EXPERIENCE.md#Approved Change - 2026-08-24: Manual Opportunity Workspace]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-Resume-2026-08-06/mockups/key-jobs-browse.html]
- [Source: src/app/page.tsx]
- [Source: src/app/job-listings.tsx]
- [Source: src/app/application-shell.tsx]
- [Source: tests/job-listings-ui.test.ts]
- [Source: tests/application-shell-ui.test.ts]

## Dev Agent Record

### Agent Model Used

GPT-5.6

### Debug Log References

- Story context analysis completed 2026-08-24: PRD, architecture spine, Epic 7, UX spines/mockup, current app/domain/persistence/test patterns, and current framework documentation reviewed.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Story intentionally confines itself to the Jobs shell/read-model reframe; manual capture persistence and confirmation are reserved for Stories 7.2 and 7.3.
- Reframed the active Jobs route as a local Opportunity Library with All opportunities/Applied views, local search and Fit filtering, truthful empty states, and a non-deceptive capture entry point.
- Simplified primary navigation to Jobs, Resume, and Settings; retained legacy direct routes and historical source/refresh modules without exposing them in the active Jobs workflow.
- Applied the muted-forest shell, wider layout, responsive Jobs cards, semantic state controls, visible focus, safe original-page handoff, and existing Escape/focus-return duplicate confirmation.
- Verified: `npm test` (97 pass), `npm run typecheck`, `npm run lint`, and `npm run build` all pass.
- Review follow-up: wired the duplicate confirmation action, selected each card's own original URL, removed retired discovery terms from active Jobs feedback, and added the tablet 20px gutter. Verified: `npm test` (98 pass), `npm run typecheck`, `npm run lint`, and `npm run build`.

### File List

- src/app/application-shell.tsx
- src/app/page.tsx
- src/app/job-listings.tsx
- src/app/globals.css
- src/app/actions.ts
- src/domain/discovery/job-listings.ts
- src/domain/fit/fit-assessment.ts
- src/app/[section]/page.tsx
- tests/application-shell-ui.test.ts
- tests/job-listings-ui.test.ts
- tests/shared-visual-polish-ui.test.ts
- tests/applications-workspace-ui.test.ts
- tests/google-sheets-workspace-ui.test.ts
- tests/job-preferences-ui.test.ts
- tests/resume-evidence-workspace-ui.test.ts
- tests/source-configurations-ui.test.ts
- tests/source-refresh-ui.test.ts
- _bmad-output/implementation-artifacts/7-1-reframe-jobs-as-an-opportunity-library.md

## Change Log

- 2026-08-24: Reframed the active Jobs experience as a local Opportunity Library, updated shared navigation and muted-forest styling, refreshed affected UI contracts, and verified the full suite.
- 2026-08-24: Resolved all four code-review findings and verified the full suite again.
