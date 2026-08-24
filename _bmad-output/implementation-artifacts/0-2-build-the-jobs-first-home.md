---
baseline_commit: 380c24dbc8a9b3dc6cc70a235da0888b7cb447db
---

# Story 0.2: Build the Jobs-first Home

Status: done

## Story

As Adrian,
I want to discover and compare job postings from the first screen,
so that the application immediately helps me make progress toward a role.

## Acceptance Criteria

1. Given Adrian opens Jobs, when the page loads, then the primary focus is a labelled search bar and job-results workspace—not technical configuration or manual-import forms.
2. Given saved listings exist, when Adrian views Jobs, then each scan-friendly card clearly presents title, company, location, work style, Fit Label, Freshness, source, and the next relevant action. Missing location/work style/source facts are stated as `Unknown`; a Fit Label is decision support, never a hiring prediction.
3. Given Adrian enters a search or selects filters, when results update, then the active query, selected filters, result count, and clear/reset affordance are visible and results update without persistence, network activity, refresh, or server action.
4. Given no result is visible, when the result state renders, then it truthfully distinguishes: first use/no saved listings; a completed or partial refresh with no retained listings; and saved listings that do not match the current search/filter. The latter retains the active controls and offers an explicit recovery path.
5. Given Adrian needs source configuration, manual import, or refresh controls, when he chooses to access them, then they remain reachable and keyboard-operable without competing with the primary Jobs workflow. No control may imply automatic retrieval, scheduling, polling, retry, source activation, crawling, or browser automation.
6. Given keyboard, screen-reader, zoom, or narrow-viewport use, when Adrian searches, filters, opens a source link, inspects provenance, calculates fit, or changes a duplicate group, then focus, labels, visible state, logical reading order, and existing safe recovery behavior remain operable. Existing local-first listing, fit, provenance, and duplicate behavior must remain intact.

## Tasks / Subtasks

- [x] Create the Jobs search/results workspace in the existing Jobs surface (AC: 1, 3, 4)
  - [x] Extend `src/app/job-listings.tsx`; retain it as the client component that owns presentational filter state and existing `useActionState(jobListingsAction, ...)` mutations.
  - [x] Place a visible, labelled search input and a results-toolbar before any manual-import form. Search only the already loaded local view; use a case-insensitive match over human-visible listing fields (title, company, work style, location, and retained source names).
  - [x] Add keyboard-native, non-color-only fit filters: All, Strong fit, and Potential fit. Define deterministic derived `filteredListings`; never persist filters, mutate listings, alter a Fit Assessment, or call a Server Action for filtering.
  - [x] Add a polite result summary that names the active query/filter and the number of matching listings, plus an explicit Clear filters action when any filter is active.
  - [x] Preserve the existing first-use and completed/partial-refresh-empty copy. Add a separate filtered-empty state only when local saved listings exist but `filteredListings` is empty; retain controls and link to Search Preferences, Permitted Sources, and Source Refresh as appropriate.
- [x] Rebuild listing rows as polished, scan-friendly Job cards (AC: 2, 6)
  - [x] Reuse the current `JobListing` and `JobListingsView` read contracts from `src/domain/discovery/job-listings.ts`; do not duplicate, reshape, or persist another listing representation.
  - [x] Make title and company the visual anchor. Expose location, work style, Fit Label or `Not calculated`, Freshness, source attribution, and a next action in every card without hover-only content.
  - [x] Keep all known values truthful: `Unknown` remains visible for unavailable data, timestamps render in local time, and Fit Label confidence/definition stays factual and non-predictive. Do not infer or fabricate missing facts.
  - [x] Provide a deliberate, labelled original-source/application handoff link that identifies the destination host, opens safely in a new tab, and states that submission happens outside this workspace. Keep verbose source revisions, retained records, and duplicate provenance in accessible progressive disclosure.
  - [x] Preserve existing Calculate fit, duplicate confirmation/reversal, Escape/cancel, focus restoration, source-record, and safe-error behavior. Do not change the immutable domain/audit/persistence contracts.
- [x] Demote configuration and import controls without removing capability (AC: 1, 5)
  - [x] Move the manual-import form behind a clearly labelled, keyboard-native secondary disclosure or bounded setup area in `JobListings`; keep its form fields, validation, disabled rationale, and `jobListingsAction` command contract unchanged.
  - [x] Keep Search Preferences, Permitted Sources, and Source Refresh reachable from their existing anchors/contextual links, but do not move their data loading, perform automatic refresh, or collapse useful recovery messaging.
  - [x] Ensure empty-state links point to valid retained anchors: `#search-preferences`, `#permitted-sources`, and `#source-refresh`.
- [x] Apply the approved visual, responsive, and accessibility contract (AC: 1, 2, 6)
  - [x] Extend `src/app/globals.css` using the existing approved tokens from Story 0.1 (`--surface-base`, `--surface-raised`, `--border`, `--accent`, `--focus-ring`) and `system-ui`; do not add a UI library or a competing design system.
  - [x] Use bordered cards with title/company prominence and distinct Fit, Freshness, source, location/work-style, and action regions. Preserve readable wrapping and the existing 24px target/focus-ring baseline at narrow widths and zoom.
  - [x] Use semantic form labels, native controls, `aria-live="polite"` only for the changing results summary/status, and headings/list semantics. Do not announce every keystroke as an error, steal focus, or rely on color alone.
  - [x] Keep technical revision IDs, digests, source-record details, and duplicate provenance behind `details` or other on-demand disclosure; never expose credentials, paths, prompts, tokens, or raw error diagnostics.
- [x] Add focused regression and UI-contract verification (AC: 1-6)
  - [x] Extend `tests/job-listings-ui.test.ts` to assert the labelled search/filter controls, active result summary, clear action, all three empty-state distinctions, card-required fields, safe outbound handoff, keyboard-native/progressive disclosure structure, and absence of retrieval/timer/network APIs.
  - [x] Add pure helper/unit coverage only if filter logic is extracted from the client component; cover query normalization, source-name matching, Strong/Potential filters, and no-match behavior without mutating the input view.
  - [x] Preserve existing job-listing, fit-assessment, source-refresh, shell, and action tests. Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`.

### Review Findings

- [x] [Review][Patch] Listing-load errors are misrepresented as an empty Jobs state [src/app/job-listings.tsx:29] — fixed by rendering the read error and safe next action as the primary Jobs state.
- [x] [Review][Patch] Card source handoff can point to a different listing [src/app/job-listings.tsx:52] — fixed by retaining `jobListingId` on public source records and selecting the card’s own source record for its handoff.
- [x] [Review][Patch] Duplicate confirmation loses and does not contain keyboard focus [src/app/job-listings.tsx:28] — fixed by using an inline confirmation that retains its invoking button, exposes `aria-expanded`, and restores focus on Cancel/Escape without false modal semantics.
- [x] [Review][Patch] Long unbroken card values can overflow at narrow widths [src/app/globals.css:65] — fixed with `overflow-wrap: anywhere` on cards.
- [x] [Review][Patch] UI-contract tests do not protect all required empty states or live interactions [tests/job-listings-ui.test.ts:12] — fixed with coverage for all empty-state copy, error precedence, source ownership, inline confirmation semantics, and narrow reflow.

## Dev Notes

### Product intent and scope

This is the presentation-layer follow-up to Story 0.1. Jobs must now feel like the entry point to a career workspace: browse/search/filter saved local postings first, then reveal setup/import/refresh choices when Adrian needs them. It is not a discovery-adapter, search-engine, application-submission, tracker, or full job-detail story.

Do not wait for or reimplement Epic 2/3 domain work. The app already has normalized local listings, manual import, source records, bounded refresh outcomes, duplicate controls, and versioned Fit Assessments. Recompose and filter that existing local read view only.

### Architecture and safety guardrails

- Preserve the local-first modular monolith: App UI → domain query/command → SQLite authority. No public deployment/product login, client network calls, browser automation, polling, timers, background jobs, auto-refresh, auto-retry, or source activation.
- `listJobListings()` is read-only and `jobListingsAction` is the sole existing mutation boundary for manual import, fit calculation, duplicate separation, and duplicate reversal. A search/filter interaction must not invoke a Server Action, write a revision/audit row, or call `revalidatePath`.
- Keep current source-policy rules: initial sources are manual-browser handoffs with disabled/zero-budget access. A visible `Refresh now`/Source Refresh entry must remain an explicit, bounded user action and must name outcomes/recovery truthfully.
- Keep listing/source attribution, duplicate grouping, fit snapshots, revisions, and audits immutable. Use current local-time display of UTC ISO timestamps; never invent unknown facts or frame Fit Label as interview/offer/hiring likelihood.
- Preserve page-level error isolation in `src/app/page.tsx`. Job-listing read failure must retain its factual summary and safe-next-action state; filtering must not hide that error.

### Existing implementation to extend, not replace

- `src/app/page.tsx` independently loads `listJobListings`, job preferences, source configurations, and refresh runs, then passes them to `JobListings` inside `ApplicationShell active="Jobs"`. Jobs now leads the page; retain that hierarchy and all existing anchors.
- `src/app/job-listings.tsx` is a client component using `useActionState(jobListingsAction, initial)`, `useRef`, and local React state for duplicate confirmation. Extend this component rather than adding a parallel Jobs page or API route.
- `src/domain/discovery/job-listings.ts` exports `JobListingsView` and `JobListing`. The view already normalizes absent work style/location to `Unknown`, groups retained source records, attaches an optional immutable fit snapshot, and does not retrieve network data. Reuse it exactly.
- `src/app/actions.ts` accepts only `manual-import`, `calculate-fit`, `separate-duplicate`, and `reverse-duplicate` for `jobListingsAction`. Do not add a `search`, `filter`, `refresh`, or retrieval command.
- `src/app/application-shell.tsx` owns the Jobs shell, skip link, primary navigation, main landmark, and focus baseline. Do not create another navigation system inside Jobs.
- `src/app/globals.css` already contains UX token values and responsive shell styles after Story 0.1. Extend those tokens/classes instead of hard-coded colors or third-party styling.

### UX and interaction requirements

- Primary first layer: Jobs title → labelled search and filters → result count → cards/empty state. Manual import and source setup are secondary, but never removed.
- Cards always make title/company, location/work style, Fit Label, Freshness, source, and next action readable. Unknown values are named `Unknown`. Fit confidence and no-fit state must use factual text, not prediction language.
- Filter behavior: All/Strong fit/Potential fit plus text search. `Stretch` remains visible under All and text search but has no separate filter in this story. Filters are UI-only and resettable.
- Empty-state decision table:

| Condition | Required message/action |
| --- | --- |
| `hasListings === false`, no completed/partial run | No saved listings; do not imply a retrieval happened; route to preferences, permitted sources, or manual import. |
| `hasListings === false`, completed/partial run exists | Retain truthful refresh outcome; explain no listings were retained and route to Source Refresh recovery/manual import. |
| `hasListings === true`, `filteredListings.length === 0` | Explain current query/filter matched no saved listings; show active controls/count and provide Clear filters plus preference/source/explicit-refresh recovery. |

- Original application/source links are deliberate external handoffs: label with destination host, use `target="_blank" rel="noreferrer"`, and state that submission is outside the workspace with no prefill/transmission.
- Accessibility floor: native inputs/buttons/details, logical heading/list order, visible `--focus-ring`, readable AA contrast, 24px targets or spacing exception, no hover-only required content, no color-only state, and reflow without hiding card facts/actions.

### Testing and quality gates

Follow the repository’s Node test style: `node --import tsx --test tests/*.test.ts`, source/UI contract assertions via `node:test` and `readFile`, and domain tests for pure behavior. No new dependency is needed.

Run all gates after implementation:

```text
npm test
npm run typecheck
npm run lint
npm run build
```

### Previous story intelligence

Story 0.1 established `ApplicationShell`, responsive navigation, visible focus token, Jobs-first composition, and honest placeholders. Its review found and fixed missing placeholder shell coverage, setup-first ordering, weak focus contrast, token drift, fully expanded technical storage metadata, and overly shallow shell tests. Do not repeat those failures: retain the shell, put Jobs controls before setup/import panels, use approved tokens, progressively disclose technical provenance, and add meaningful contract coverage.

### Current stack and current Next.js guidance

- Keep the pinned stack: Next.js `16.3.0`, React `19.2.3`, TypeScript `5.9.3`, Node `>=24.18.0`, and no new UI dependency.
- Next.js App Router pages/layouts are Server Components by default; client filtering belongs inside the existing client `JobListings` component. If a future route needs URL-backed query state, Next.js 16 requires awaiting `searchParams`; this story does not require URL persistence. [Source: Next.js App Router layouts/pages](https://nextjs.org/docs/app/getting-started/layouts-and-pages), [Source: Next.js 16 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16)

### Scope boundaries

Do not implement a new retrieval adapter, full job detail route, application tracking, Google Sheets connection, Career Assistant, new fit rubric, remote search, user authentication, analytics, or automated application submission. Preserve original source handoff only.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Epic 0: Career Workspace Experience`]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-Resume-2026-08-06/EXPERIENCE.md#Information Architecture`, `#Component Patterns`, `#State Patterns`, `#Accessibility Floor`]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-Resume-2026-08-06/DESIGN.md#Colors`, `#Layout & Spacing`, `#Components`]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-Resume-2026-08-07/ARCHITECTURE-SPINE.md#AD-1 — Local-only ownership`, `#AD-3 — Evidence-first fit assessment`, `#AD-5 — Policy-gated discovery`, `#Consistency conventions`]
- [Source: `_bmad-output/planning-artifacts/prds/prd-Resume-2026-08-06/prd.md#FR-3`, `#FR-5`, `#FR-8`, `#FR-9`]
- [Source: `src/app/page.tsx`, `src/app/job-listings.tsx`, `src/app/actions.ts`, `src/domain/discovery/job-listings.ts`, `tests/job-listings-ui.test.ts`]
- [Source: `_bmad-output/implementation-artifacts/0-1-establish-the-application-shell.md`]

## Dev Agent Record

### Agent Model Used

GPT-5.6

### Debug Log References

- Analyzed Epic 0, UX design/experience spines, architecture/PRD constraints, current Jobs domain/UI/action code, Story 0.1 completion/review learnings, test conventions, and current Next.js App Router documentation.

### Implementation Plan

- Keep search and fit filtering as derived client state in `JobListings`; no persistence, retrieval, or action command is introduced.
- Reuse the existing read model and mutation forms while moving manual import into a secondary native disclosure.
- Present listing cards with required information first and source-record provenance on demand.

### Completion Notes List

- Added local saved-job search, All/Strong/Potential fit filters, an active result summary, clear action, and distinct no-listings/no-matches states.
- Rebuilt listings into responsive cards with factual fit/Freshness/source details and an explicit, safe outside-workspace source handoff.
- Kept manual import and existing source/refresh recovery paths available in secondary disclosures and anchors; no retrieval or persistence behavior was added.
- Added Jobs-home UI contract coverage. Full regression passed: 78 tests, typecheck, lint, and production build.

- Ultimate context engine analysis completed — comprehensive developer guide created.

### File List

- `_bmad-output/implementation-artifacts/0-2-build-the-jobs-first-home.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `src/app/job-listings.tsx`
- `src/app/globals.css`
- `src/domain/discovery/job-listings.ts`
- `tests/job-listings-ui.test.ts`
- `tests/job-listings.test.ts`

### Change Log

- 2026-08-24: Implemented Jobs-first local search, filters, result states, job cards, and secondary manual import.
- 2026-08-24: Resolved five code-review findings for Jobs error truthfulness, card source ownership, confirmation accessibility, responsive reflow, and contract coverage.

- 2026-08-24: Created implementation-ready Story 0.2 context for the Jobs-first home workspace.
