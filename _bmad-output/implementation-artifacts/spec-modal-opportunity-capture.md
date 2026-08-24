---
title: 'Move manual opportunity capture into a compact modal workflow'
type: 'refactor'
created: '2026-08-25'
status: 'done'
review_loop_iteration: 0
baseline_commit: '380c24dbc8a9b3dc6cc70a235da0888b7cb447db'
context:
  - 'AGENTS.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-Resume-2026-08-06/DESIGN.md'
  - '_bmad-output/implementation-artifacts/spec-align-story-7-jobs-capture-mockups.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The always-visible Opportunity Library capture fields occupy too much of the Jobs page and dilute the scan-first composition from the approved Browse mockup. The URL and copied-role-details inputs should be compact, intentional entry work rather than a page-length form.

**Approach:** Make **Add opportunity** open a native modal dialog centered at roughly half the desktop application width. Inside it, arrange **Original posting URL** above **Copied role details**, retain the current review/confirmation progression, and return focus predictably to the trigger on a safe close.

## Boundaries & Constraints

**Always:** Keep capture, review, confirmation, validation, pending states, local-only assurances, source attribution, `useActionState`, and server-action inputs/outcomes unchanged. Use the existing muted-forest tokens and Browse-style surfaces. The dialog must be keyboard-operable: labelled, focus-contained by the native dialog, Escape/cancel closable only when no request is pending, and visibly closable with a button.

**Ask First:** Changing capture validation thresholds, what fields are collected, review/save semantics, persisted opportunity behavior, or the visual system outside Story 7.1–7.3.

**Never:** Add Bootstrap or another UI dependency, reintroduce retrieval/URL fetching, add browser automation, discard entered values without an explicit user close, or touch unrelated dirty-worktree files.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Open capture | User activates Add opportunity | A modal opens with URL first, role details below, and focus on the dialog’s first control. | N/A |
| Invalid review | URL or role details fail existing validation | Modal stays open with existing field-specific error and announced status. | No draft or persisted opportunity is created. |
| Close capture | User selects Close or presses Escape while idle | Modal closes, focus returns to its trigger, and entered draft text remains until intentionally changed. | Closing is unavailable while a request is pending. |
| Review draft | Valid capture returns a review draft | Dialog keeps the review and explicit local save flow within the same bounded surface. | Existing safe action feedback remains visible. |

</frozen-after-approval>

## Code Map

- `src/app/job-listings.tsx` — owns the Jobs primary trigger and must open the capture dialog from All opportunities and Applied.
- `src/app/opportunity-capture.tsx` — owns controlled capture values and the review/save action states; becomes the native dialog content.
- `src/app/globals.css` — defines compact dialog dimensions, vertical field order, responsive reflow, backdrop, and existing visual tokens.
- `tests/job-listings-ui.test.ts` — guards modal trigger availability across Jobs views and local-only behavior.
- `tests/opportunity-capture-ui.test.ts` — guards accessible dialog markup, field order, close/pending rules, and unchanged server-action form contract.

## Tasks & Acceptance

**Execution:**

- [x] `src/app/job-listings.tsx`, `src/app/opportunity-capture.tsx` — connect the existing Add opportunity controls to one native dialog, preserve focus ownership and capture state, and place the existing entry/review flow inside it.
- [x] `src/app/globals.css` — replace the page-wide capture grid with a vertically ordered, half-width desktop dialog that stacks at narrow widths and preserves readable errors/statuses.
- [x] `tests/job-listings-ui.test.ts`, `tests/opportunity-capture-ui.test.ts` — add static regression checks for semantic dialog controls, modal composition, and the prohibited-retrieval contract.

**Acceptance Criteria:**

- Given Jobs on desktop, when Add opportunity is activated from All opportunities or Applied, then one labelled dialog opens at approximately half the application width with URL above role details.
- Given the dialog is open, when the user presses Escape or selects its close control while idle, then it closes and focus returns to the same Add opportunity trigger without silently losing typed values.
- Given validation fails or review/save is pending, when the action completes or remains in flight, then field errors/status stay in the dialog and closing is appropriately blocked while pending.
- Given a valid capture, when Review capture and Confirm and save opportunity are used, then their current local-only, explicit two-stage behavior is unchanged.

## Spec Change Log

## Design Notes

Use the native HTML `dialog` pattern as the standard modal primitive. It supplies the expected focus and Escape behavior without importing a UI framework.

```text
Add opportunity → compact dialog
                 Original posting URL
                 Copied role details
                 Review capture → editable review → explicit local save
```

## Verification

**Commands:**

- `npm test` — expected: all existing and modal-contract tests pass.
- `npm run typecheck` — expected: TypeScript completes without errors.
- `npm run lint` — expected: lint completes without errors.
- `npm run build` — expected: production build completes without errors.

**Manual checks (if no CLI):**

- Inspect dialog opening, focus return, Escape, validation, review, and narrow-screen layout at 320px and desktop widths.

## Suggested Review Order

**Modal interaction**

- Owns trigger state and reliably restores focus to the originating control.
  [`job-listings.tsx:31`](../../src/app/job-listings.tsx#L31)

- Uses native dialog semantics while retaining local draft, validation, and save flow.
  [`opportunity-capture.tsx:9`](../../src/app/opportunity-capture.tsx#L9)

- Blocks unsafe cancellation and duplicate saves only while actions are progressing.
  [`opportunity-capture.tsx:22`](../../src/app/opportunity-capture.tsx#L22)

**Responsive visual treatment**

- Defines a half-width forest-token dialog, backdrop, compact fields, and responsive widths.
  [`globals.css:234`](../../src/app/globals.css#L234)

**Regression coverage**

- Guards modal availability from both Jobs views and focus restoration.
  [`job-listings-ui.test.ts:46`](../../tests/job-listings-ui.test.ts#L46)

- Guards native dialog accessibility, field order, and compact responsive composition.
  [`opportunity-capture-ui.test.ts:25`](../../tests/opportunity-capture-ui.test.ts#L25)
