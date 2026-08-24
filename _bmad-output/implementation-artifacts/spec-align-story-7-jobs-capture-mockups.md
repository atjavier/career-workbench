---
title: 'Align Jobs opportunity library with the canonical Browse visual system'
type: 'refactor'
created: '2026-08-25'
status: 'done'
review_loop_iteration: 0
baseline_commit: '380c24dbc8a9b3dc6cc70a235da0888b7cb447db'
context:
  - 'AGENTS.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-Resume-2026-08-06/DESIGN.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-Resume-2026-08-06/reviews/review-visual-consistency-2026-08-25.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The implemented Jobs screens from Stories 7.1–7.3 preserve the intended local Opportunity Library behavior but visibly diverge from the approved `key-jobs-browse.html` mockup. The current generic header, nested/duplicated page hierarchy, search-first library state, and form treatment do not read as the same product design.

**Approach:** Recompose the existing Jobs, capture, review, and saved-opportunity views around the Browse mockup’s shell, spacing, tabs, primary action, and surface hierarchy. Keep every manual-only and local-first behavior already delivered by Stories 7.1–7.3.

## Boundaries & Constraints

**Always:** Use the Browse mockup’s canonical values: `#F5F7F3` canvas, `#FFFFFF` raised surface, `#EDF3EE` soft surface, `#17372B` ink, `#D6E1D8` divider, `#14382A` 70px header, `#2F7058` action, 31px page title, 24px/16px desktop/mobile gutters, 10px controls, 12px bounded workflow areas, and one restrained forest shadow. Preserve keyboard operation, focus indicators, validation/errors, status announcements, duplicate confirmation, responsive reflow, and the existing server-action contract.

**Ask First:** Changing any capture, confirmation, saved-record, fit, duplicate, storage, URL-hand-off, or application-tracking behavior; expanding the alignment beyond the Jobs surface; changing the approved mockup or introducing a new mockup.

**Never:** Reintroduce automated job retrieval, refresh controls, source configuration, browser automation, implied URL fetching, fabricated listing data, or external submission. Do not replace `useActionState` flows, change persistence/domain schemas, remove truthful local-only copy, or overwrite unrelated dirty-worktree changes.

</frozen-after-approval>

## Code Map

- `src/app/application-shell.tsx` — shared navigation markup whose brand/header hierarchy must adopt the canonical Browse shell.
- `src/app/page.tsx` — owns the Jobs page frame; remove the duplicate visual title responsibility so one page head leads the workspace.
- `src/app/job-listings.tsx` — Opportunity Library tabs, capture placement, empty/library states, and saved-record structure.
- `src/app/opportunity-capture.tsx` — existing two-stage capture/review form; retain actions and accessibility while adopting the bounded workflow composition.
- `src/app/globals.css` — canonical tokens plus responsive header, Jobs, capture, review, record, and state styling.
- `tests/job-listings-ui.test.ts` — static contract for truthful local library composition and safe listing actions.
- `tests/opportunity-capture-ui.test.ts` — static contract for the accessible no-retrieval capture/review workflow.

## Tasks & Acceptance

**Execution:**

- [x] `src/app/application-shell.tsx`, `src/app/page.tsx` — make the application shell and a single Jobs page head match the mockup’s hierarchy, active navigation treatment, local-workspace utility, dimensions, and mobile intent without changing destinations or routes.
- [x] `src/app/job-listings.tsx` — retain local filtering only when saved opportunities exist; lead the empty library with the focused capture pathway, preserve All opportunities/Applied tabs and all current record/duplicate actions, and use browse-style records rather than generic boxed data blocks.
- [x] `src/app/opportunity-capture.tsx` — keep URL and copied-text entry followed by editable review and explicit save; add semantic class hooks and concise local-only/provenance presentation needed for the reference composition, without changing action inputs or outcomes.
- [x] `src/app/globals.css` — normalize the shared tokens and implement the reference system’s header, page, tabs, action, prominent capture surface, quiet saved-record region, focus, and 320px reflow rules. Scope additions so existing non-Jobs pages retain their current behavior while inheriting safe shared-token improvements.
- [x] `tests/job-listings-ui.test.ts`, `tests/opportunity-capture-ui.test.ts` — update visual-structure assertions while retaining regression checks that prohibit retrieval, browser automation, and unsafe handoff behavior.

**Acceptance Criteria:**

- Given the Jobs route on desktop or mobile, when its layout renders, then it has one Browse-style page head beneath a 70px deep-forest shell, canonical spacing/tokens, text-underlined active Jobs navigation, and responsive 24px/16px gutters.
- Given an empty local library, when Jobs opens, then the visually dominant work surface is the local Add opportunity capture flow and no search/filter controls lead the page; saving remains an explicit two-stage review and confirmation.
- Given saved opportunities, when All opportunities renders, then search/filter tools are secondary library controls and records scan like the Browse reference while preserving truthful saved metadata, external handoff, fit, and duplicate actions.
- Given invalid capture input, a pending action, a confirmation state, or a storage/action error, when the user interacts by keyboard or at narrow width, then visible errors/status/focus and current safe recovery behavior remain available without horizontal page scrolling.

## Spec Change Log

## Design Notes

The Browse mockup is a visual grammar, not a behavioral template. Reuse its sequence—shell, page head, tabs, one prominent work surface, then quiet records—while substituting manual capture and local records for retrieval/search-feed content.

```text
Jobs page head → All opportunities / Applied tabs
               → bounded Add opportunity capture or review workflow
               → secondary saved-library tools (only when records exist)
               → scan-friendly saved records and truthful empty/error states
```

## Verification

**Commands:**

- `npm test` — expected: all static UI, domain, and persistence tests pass.
- `npm run typecheck` — expected: TypeScript completes without errors.
- `npm run lint` — expected: lint completes without errors.
- `npm run build` — expected: production build completes without errors.

**Manual checks (if no CLI):**

- Inspect Jobs at desktop, 820px, 620px, and 320px widths; confirm it resembles the approved Browse mockup while all opportunity information remains user-provided and local-first.

## Suggested Review Order

**Jobs composition**

- Establishes the single page head, capture-first library, and Applied-tab state preservation.
  [job-listings.tsx:37](../../src/app/job-listings.tsx#L37)

- Preserves the manual two-stage capture and adds the bounded workflow frame hooks.
  [opportunity-capture.tsx:15](../../src/app/opportunity-capture.tsx#L15)

**Shared visual system**

- Replaces the generic shell with the canonical Browse header and local-workspace utility.
  [application-shell.tsx:15](../../src/app/application-shell.tsx#L15)

- Removes duplicate title ownership so the Jobs component controls the visual hierarchy.
  [page.tsx:20](../../src/app/page.tsx#L20)

- Applies reference tokens, capture depth, record scanning, focus, and responsive navigation.
  [globals.css:202](../../src/app/globals.css#L202)

**Regression coverage**

- Guards the Browse visual frame, empty-library composition, and Applied capture return path.
  [job-listings-ui.test.ts:36](../../tests/job-listings-ui.test.ts#L36)

- Preserves accessible, local-only two-stage capture and review behavior.
  [opportunity-capture-ui.test.ts:6](../../tests/opportunity-capture-ui.test.ts#L6)
