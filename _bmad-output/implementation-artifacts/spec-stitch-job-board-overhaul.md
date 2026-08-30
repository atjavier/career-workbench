---
title: 'Stitch Job Board Workspace Visual Overhaul'
type: 'refactor'
created: '2026-08-31'
status: 'done'
baseline_commit: 'cd5bef4'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The current Job Board UI lacks the polished visual hierarchy, tactile company logo tiles, and refined bento grid cards present in the Stitch reference prototype (`job-board-serene-flow.html`).

**Approach:** Overhaul the Job Board layout and OpportunityCard components to mirror `job-board-serene-flow.html` 1:1 — introducing the 48px square company badge, prominent title hierarchy, pill tags, and serene action buttons while strictly preserving all existing accessibility contracts, capture modal triggers, and 193 automated tests.

## Boundaries & Constraints

**Always:**
- Keep all existing accessibility attributes (`role="status"`, `aria-live="polite"`, `aria-labelledby`, `tabIndex`, native focus management).
- Preserve all opportunity library data and explicit outbound handoff rules (`target="_blank"`, `rel="noreferrer"`, submission notice).
- Ensure all 193 automated test assertions in `tests/job-listings-ui.test.ts` and `tests/shared-visual-polish-ui.test.ts` pass cleanly.

**Ask First:**
- Any changes that alter the underlying data schema of `CapturedOpportunityLibraryItem` or modify backend persistence.

**Never:**
- Introduce external CSS frameworks or CDN scripts; all styles must be native CSS in `src/app/globals.css`.
- Remove or break keyboard accessibility for the Opportunity Capture dialog or Search filter.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Active Opportunities with search | User enters search term | Displays matching count and filters bento cards with highlight | Shows clear-search button; polite aria-live announcement |
| Empty captured opportunities | No saved opportunities | Bento empty-state card with dashed Serene Blue border and Add Opportunity CTA | Add Opportunity opens focus-safe capture modal |
| Applied tab selected | User clicks Applied tab | Displays honest local status that applied tracking is a later workflow | Retains subnavigation and return to All opportunities |
| Fit assessment active | Opportunity has saved fit | Renders local fit status badge alongside OpportunityAssessment action | Preserves local-only decision support boundary |

</frozen-after-approval>

## Code Map

- `src/app/job-listings.tsx` -- Main Job Board component rendering search input, subnavigation, bento grid, and `OpportunityCard`.
- `src/app/globals.css` -- Style rules for `.jobs-workspace`, `.jobs-workspace-header`, `.job-listing-list`, `.job-listing`, `.company-logo-badge`, and `.job-listing-facts`.
- `tests/job-listings-ui.test.ts` -- Contract test verifying tokens, outbound links, search input, and responsive grid layout.

## Tasks & Acceptance

**Execution:**
- [x] `src/app/job-listings.tsx` -- Update `OpportunityCard` and header markup -- Add company logo tile, refine typography hierarchy, and style search input with leading search icon.
- [x] `src/app/globals.css` -- Update Job Board CSS -- Implement Serene Professional bento grid, tactile ambient shadows (`card-ambient`), tag pills, and clean footer divider matching `job-board-serene-flow.html`.
- [x] `tests/job-listings-ui.test.ts` -- Verify UI contracts -- Ensure all regex assertions and test tokens pass without regression.

**Acceptance Criteria:**
- Given a user on the Job Board page, when viewing captured opportunities, then opportunities are presented in a responsive bento grid with 48px company icon badges, company overline, bold job title, and fact pills matching `job-board-serene-flow.html`.
- Given a user on desktop (≥ 48rem), when viewing the opportunity list, then cards render in an auto-fill bento grid with ambient shadow elevation (`box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05)`) and smooth hover lift.
- Given any screen size, when resizing, then cards wrap cleanly with zero horizontal overflow and full accessibility compliance.

## Spec Change Log

_None._

## Design Notes

The Stitch export `job-board-serene-flow.html` defines:
```html
<article class="bg-surface-container-lowest rounded-2xl p-6 card-ambient flex flex-col h-full cursor-pointer relative group border-none">
  <div class="flex justify-between items-start mb-stack-sm">
    <div class="flex items-center gap-3">
      <div class="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center">
        <span class="material-symbols-outlined text-serene-blue text-2xl">database</span>
      </div>
      <div>
        <p class="text-label-md font-label-md text-secondary uppercase tracking-wider mb-0.5">TechFlow Inc.</p>
        <h3 class="text-headline-sm font-headline-sm text-slate-deep font-bold">Senior Frontend Engineer</h3>
      </div>
    </div>
    ...
```
In our implementation, we adapt this into native CSS classes in `globals.css` using our design tokens, mapping `<div className="company-logo-badge">` to a 48px container with Serene Blue icon, keeping the semantic `<time>` badge and facts definition list.

## Verification

**Commands:**
- `npm run typecheck` -- expected: TypeScript compiles with 0 errors
- `npm run lint` -- expected: ESLint passes with 0 warnings or errors
- `npm test` -- expected: All 194 test suites pass cleanly
- `npm run build` -- expected: Next.js production build succeeds

## Suggested Review Order

**UI Structure & Accessibility**

- Top action bar layout with search input ref and capture triggers
  [`job-listings.tsx:31`](../../src/app/job-listings.tsx#L31)

- Bento opportunity card with 48px company logo badge, title block, and outbound link
  [`job-listings.tsx:105`](../../src/app/job-listings.tsx#L105)

**Styling & Design Tokens**

- Serene action bar, pill tabs, and search input styling
  [`globals.css:4053`](../../src/app/globals.css#L4053)

- Bento card ambient elevation, tactile hover lift, and tag pills
  [`globals.css:4270`](../../src/app/globals.css#L4270)

**Verification & Quality Assurance**

- UI test asserting company badges, search refs, and host parsing
  [`job-listings-ui.test.ts:116`](../../tests/job-listings-ui.test.ts#L116)
