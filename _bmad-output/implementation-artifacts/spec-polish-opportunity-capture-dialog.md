---
title: 'Center and visually refine the Opportunity Capture dialog'
type: 'bugfix'
created: '2026-08-25'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'NO_VCS'
context:
  - 'AGENTS.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-Resume-2026-08-06/DESIGN.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-Resume-2026-08-06/EXPERIENCE.md'
  - '_bmad-output/implementation-artifacts/spec-modal-opportunity-capture.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The native Opportunity Capture dialog is visibly off-center because its CSS overrides browser dialog centering. Its spacing, field proportions, and header treatment also feel like an inherited page form instead of the polished Browse-style workspace surface.

**Approach:** Apply the finalized UX dialog contract to the existing native modal: reliably center a compact desktop surface, give its header, fields, action, backdrop, and review area a deliberate visual hierarchy, and retain the current local-only capture behavior unchanged.

## Boundaries & Constraints

**Always:** Limit the work to Story 7.1–7.3 capture presentation. Preserve the native dialog, focus restoration, Escape/pending behavior, `useActionState` forms, validations, local-only copy, review fields, and explicit save flow. Inherit the canonical Browse mock’s muted-forest tokens and use the UX-specified 640px desktop / 16px mobile-inset dialog geometry.

**Ask First:** Changing capture inputs, validation thresholds, review/save outcomes, persisted opportunity behavior, or global visual rules outside the dialog.

**Never:** Add a UI dependency, create a new mockup, restore automated retrieval, alter unrelated dirty-worktree files, or use visual tricks that break keyboard access or zoom reflow.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Open on desktop | User activates Add opportunity | Dialog is centered in the viewport at 640px maximum width, with a quiet forest backdrop. | Available viewport bounds prevent clipping. |
| Open on narrow screen | Viewport is below desktop width | Dialog uses near-full width with 16px inset, a single column, and visible controls. | Content scrolls within the bounded dialog rather than horizontally. |
| Review long copied details | Role-details text exceeds the compact entry field | Entry textarea remains compact and vertically resizable; existing validation and review stage remain available. | No text is truncated or discarded. |
</frozen-after-approval>

## Code Map

- `src/app/globals.css` — owns the native dialog’s centering, dimensions, visual hierarchy, and responsive reflow.
- `tests/opportunity-capture-ui.test.ts` — guards the UX contract’s geometry and presentation tokens without altering behavioral tests.

## Tasks & Acceptance

**Execution:**

- [x] `src/app/globals.css` — replace the zero-margin page-form treatment with an auto-centered, 640px, 15px-radius dialog; refine header, local-draft status, entry field, action, confirmation, backdrop, and mobile rules using existing Browse tokens.
- [x] `tests/opportunity-capture-ui.test.ts` — assert the centered geometry, compact field height, polished surface tokens, and narrow-screen inset contract.

**Acceptance Criteria:**

- Given a desktop Jobs view, when Add opportunity opens the dialog, then it is visibly centered and reads as a single elevated Browse-style task surface.
- Given the entry stage, when its URL and role-details controls render, then URL remains above a compact, resizable role-details field and the forward action is visually intentional rather than page-form sized.
- Given a viewport below the desktop breakpoint, when the dialog opens, then it retains a 16px viewport inset, one-column layout, and reachable close/action controls without horizontal overflow.
- Given capture and confirmation behavior before the visual correction, when users perform it afterward, then local-only review, validation, pending safeguards, save, and focus behavior remain unchanged.

## Spec Change Log

## Design Notes

```text
viewport center
  └─ 640px raised dialog / #F8FBF8 / 15px radius
       header + compact local status + Close
       URL
       compact resizable role details
       Review capture
```

## Verification

**Commands:**

- `npm run typecheck` — expected: TypeScript completes without errors.
- `npm run lint` — expected: lint completes without errors.
- `npm test` — expected: all UI and domain regression tests pass.
- `npm run build` — expected: production build completes successfully.

**Manual checks (if no CLI):**

- Open capture at desktop and 320px widths; confirm viewport centering/inset, field proportions, focus return, Escape, and text retention.

## Suggested Review Order

**Centered task surface**

- Restores native-dialog centering with the exact 640px desktop cap and bounded viewport geometry.
  [`globals.css:234`](../../src/app/globals.css#L234)

- Keeps the dialog title and reachable close control present while longer review content scrolls.
  [`globals.css:241`](../../src/app/globals.css#L241)

**Compact, accessible entry controls**

- Makes dismissal comfortably targetable and strengthens local-status contrast on the soft surface.
  [`globals.css:244`](../../src/app/globals.css#L244)

- Limits entry-stage height while retaining vertical resizing for long copied role details.
  [`globals.css:253`](../../src/app/globals.css#L253)

- Preserves a 16px mobile viewport inset and single-column modal composition.
  [`globals.css:298`](../../src/app/globals.css#L298)

**Regression coverage**

- Guards centered geometry, compact input rules, and the responsive dialog contract.
  [`opportunity-capture-ui.test.ts:25`](../../tests/opportunity-capture-ui.test.ts#L25)

- Keeps the Jobs visual-frame test aligned with the refined dialog width.
  [`job-listings-ui.test.ts:38`](../../tests/job-listings-ui.test.ts#L38)
