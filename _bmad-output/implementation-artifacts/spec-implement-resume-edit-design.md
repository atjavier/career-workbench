---
title: 'Implement the approved Resume Edit design'
type: 'feature'
created: '2026-08-25'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'd6b6343e988b1b4241bf116a96f3d33739e9273d'
context:
  - '_bmad-output/planning-artifacts/ux-designs/ux-Resume-2026-08-06/DESIGN.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-Resume-2026-08-06/EXPERIENCE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The implemented `/resume` workspace is a generic, stacked technical editor and visibly diverges from the approved `key-resume-edit.html` mock. It buries the local preview and mixes source, review, version, and legacy-history concerns into competing panels.

**Approach:** Recompose the existing, functional Current Base Resume workflow into the approved Browse-consistent Resume Edit hierarchy: page heading, local revision context, visual view tabs, review notice, and one responsive two-pane editor/review workspace. Keep current server actions, provenance, append-only draft/version behavior, and local-only preview intact; introduce no simulated Coach/AI behavior.

## Boundaries & Constraints

**Always:** Use the established Jobs Browse visual system (full-width forest header, 1440px content width, 24px desktop/16px narrow gutters, muted-forest tokens, restrained raised surfaces). Make the Base Resume visibly read-only; retain labelled PDF import, real save/propose/resolve/approve actions, unsaved-edit approval protection, evidence links, safe action feedback, retained versions, and the local text-preview boundary. The primary split workspace must be keyboard-accessible, preserve logical review → editor → preview → warnings/provenance order, reflow to a single column at 820px and remain usable at 440px/400% zoom.

**Ask First:** Adding an actual conversational Coach, AI/provider transfer, job-context selection, exports, persistence beyond existing local draft/version actions, or a functional Experience & Projects destination.

**Never:** Do not fabricate Coach messages, proposals, save timestamps, selected-job context, readiness, AI use, or data transfer. Do not change the resume domain/action contracts, delete or overwrite source data, add network calls/telemetry, create a standalone legacy workspace, or implement Experience & Projects/Settings in this scope.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Imported draft | Draft and optional proposals are available | Browse-aligned Resume Edit header, review notice, editor/review pane, read-only live local preview, evidence decisions, and version approval remain available | Existing safe action status remains visible and announced |
| No imported draft | No Current Base Resume exists | Same page hierarchy with a clearly labelled PDF-import entry point and an honest empty preview state | Preserve PDF-only validation/error and safe next action |
| Unsaved local edit | User changes a structured draft field | Preview reflects the local edit and approval stays unavailable until Save draft revision succeeds | Clearly state that the preview is unsaved; do not discard edits |
| Narrow/zoomed view | Width ≤820px or 440px/400% | Coach/editor then preview become a single linear flow; actions and long text wrap without horizontal scrolling | Keep review jumps, provenance, warning count, and non-destructive larger-screen guidance reachable |

</frozen-after-approval>

## Code Map

- `src/app/resume-workspace.tsx` — server composition and top-level Resume Edit visual hierarchy.
- `src/app/current-base-resume.tsx` — client-side import, draft editing, preview, evidence proposal decisions, and version approval.
- `src/app/globals.css` — canonical theme plus Resume Edit-specific layout, surfaces, responsive behavior, and focus-safe controls.
- `tests/resume-evidence-workspace-ui.test.ts` — route/workspace visual and local-first regression assertions.
- `tests/current-base-resume.test.ts` — action-control, accessibility, provenance, and immutability UI assertions.

## Tasks & Acceptance

**Execution:**
- [x] `src/app/resume-workspace.tsx` — replace the generic Resume heading/stacked auxiliary panels with the mock-aligned page head, inactive future view indicator, review notice, and a concise progressively disclosed history/version area — make the real edit workflow the visual focus.
- [x] `src/app/current-base-resume.tsx` — arrange existing import/edit/proposal/version controls as the left review/editor pane and the existing preview as the right paper-like pane; preserve every current action field/command and make copy distinguish manual, evidence-backed review from an unimplemented Coach.
- [x] `src/app/globals.css` — add scoped Resume Edit styles that match the established Browse geometry and polish, including an 820px stacked layout and 440px full-width actions without regressing Jobs.
- [x] `tests/resume-evidence-workspace-ui.test.ts` and `tests/current-base-resume.test.ts` — update/add static assertions for the approved page hierarchy, two-pane responsive CSS, truthful local/manual wording, and retained action/a11y safeguards.

**Acceptance Criteria:**
- Given an imported Current Base Resume, when `/resume` loads, then it closely follows `key-resume-edit.html`’s heading, review band, split workspace, and paper preview while using only real current data.
- Given a change to a draft field, when the user has not saved it, then the local preview reflects it and Current Base Resume version approval remains disabled with a clear explanation.
- Given an evidence-backed open proposal, when the user accepts, edits, or keeps the current wording, then the existing explicit resolve action and evidence provenance remain available; no change is automatic.
- Given no imported resume or a safe action error, when `/resume` loads, then import/error recovery remains visible within the refined layout.
- Given a narrow screen, when the workspace reflows, then no two-dimensional scrolling or hidden primary action is required and preview/provenance remain reachable.

## Spec Change Log

## Design Notes

The approved mock is the visual reference, but its sample chat and claim of a ready local draft are illustrative. The implementation should use its calm split-pane rhythm—not false functionality. A present but unavailable Experience & Projects tab may be visually subdued and must not navigate to an unfinished or legacy page.

## Verification

**Commands:**
- `npm run test` — expected: all existing and updated Node test suites pass.
- `npm run lint` — expected: no lint errors.
- `npm run typecheck` — expected: no TypeScript errors.
- `npm run build` — expected: production build succeeds.

**Manual checks (if no CLI):**
- Inspect `/resume` at desktop, 820px, and 440px/400% zoom; confirm the mock-aligned visual hierarchy, visible focus, linear narrow flow, and truthful local/manual copy.

## Suggested Review Order

**Resume entry and hierarchy**

- Establishes the mock-aligned page hierarchy while keeping incomplete views visibly unavailable.
  [resume-workspace.tsx:27](../../src/app/resume-workspace.tsx#L27)

- Keeps the review band truthful for both imported and first-use resume states.
  [resume-workspace.tsx:32](../../src/app/resume-workspace.tsx#L32)

**Local review workspace**

- Preserves manual saving and immutable-source context inside the new left review pane.
  [current-base-resume.tsx:35](../../src/app/current-base-resume.tsx#L35)

- Keeps first use in the same split composition with PDF import and an honest empty preview.
  [current-base-resume.tsx:53](../../src/app/current-base-resume.tsx#L53)

- Retains evidence decisions, provenance, and explicit version approval below the focused workspace.
  [current-base-resume.tsx:45](../../src/app/current-base-resume.tsx#L45)

**Visual system and responsive behavior**

- Applies the canonical page head, view-tab, review-band, and split-surface styling.
  [globals.css:314](../../src/app/globals.css#L314)

- Gives the local preview its paper treatment and keeps follow-up review surfaces quiet.
  [globals.css:335](../../src/app/globals.css#L335)

- Stacks panes and contracts gutters safely for tablet, phone, and zoomed layouts.
  [globals.css:372](../../src/app/globals.css#L372)

**Regression coverage and deferred scope**

- Locks the refined hierarchy, local-only safeguards, and responsive split workspace into static UI checks.
  [resume-evidence-workspace-ui.test.ts:20](../../tests/resume-evidence-workspace-ui.test.ts#L20)

- Preserves accessible import and evidence/version safeguards through the visual refactor.
  [current-base-resume.test.ts:74](../../tests/current-base-resume.test.ts#L74)

- Records Experience & Projects and Settings as deliberately separate future UI scopes.
  [deferred-work.md:3](deferred-work.md#L3)
