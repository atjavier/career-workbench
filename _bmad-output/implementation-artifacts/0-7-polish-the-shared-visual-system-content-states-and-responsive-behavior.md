---
baseline_commit: 380c24dbc8a9b3dc6cc70a235da0888b7cb447db
---

# Story 0.7: Polish the Shared Visual System, Content States, and Responsive Behavior

Status: done

## Story

As Adrian,
I want the application to explain actions and outcomes in plain language,
so that I always understand what happened and what I can do next.

## Acceptance Criteria

1. **Given** any page or action, **when** status, error, empty, loading, or recovery content appears, **then** it uses human-oriented language and identifies the next action.

2. **Given** technical metadata exists, **when** Adrian needs it, **then** it is available through progressive disclosure without dominating the primary workflow.

3. **Given** desktop, tablet, phone, keyboard, zoom, or screen-reader use, **when** Adrian navigates the app, **then** content, focus, controls, and status remain usable at 320 CSS px and 400% zoom; Jobs and Applications retain all required information as labelled cards without unjustified two-dimensional scrolling.

4. **Given** the application shell and major surfaces, **when** visual review occurs, **then** the UI reads as one coherent product rather than unrelated technical panels, using the dark premium header, AA-compliant warm affirmative actions, evidence/skill chips where useful, and a distinct danger treatment for irreversible actions.

5. **Given** the integrated workspaces are validated, **when** visual and regression testing runs, **then** contrast, keyboard/screen-reader paths, compact navigation, long values, stale-preview/warning flow, and no network/automatic scan/fallback regressions are covered.

## Tasks / Subtasks

- [x] Implement an accessible compact primary navigation without changing route ownership (AC: 3, 4, 5)
  - [x] Preserve `ApplicationShell`, Jobs-first destination order, the skip link, `aria-current="page"`, and all existing route hrefs in `src/app/application-shell.tsx`.
  - [x] Add a small, explicitly labelled compact-navigation control for narrow viewports. It must expose the current destination, reveal every primary destination, work with keyboard and touch, close on Escape, and restore focus to its trigger when closed. Prefer a narrowly scoped client component (for example `src/app/compact-navigation.tsx`) rather than converting unrelated workspace state into client state.
  - [x] Keep the full primary navigation visible on larger screens. Do not add a router, change URLs, auto-navigate, or discard/overwrite an editing state. If no shared unsaved-edit registry exists, preserve current page/form state simply by avoiding navigation side effects.
  - [x] Style the compact control and menu in `src/app/globals.css` with a visible, unobscured focus indicator, text label, 24 CSS-pixel minimum target or valid spacing equivalent, and a single-column reading order at the existing narrow breakpoint.

- [x] Normalize the shared visual and action hierarchy across major existing surfaces (AC: 2, 4, 5)
  - [x] Extend the existing token/class system in `src/app/globals.css`; do not create a parallel design system or add dependencies. Retain the dark premium header, warm `#F59E4A` affirmative background with dark `#201126` foreground, panel/chip vocabulary, and verified accessible link/focus colors on every surface.
  - [x] Add reusable semantic action/status classes for neutral, affirmative, and danger actions. Danger styling and accompanying copy must distinguish irreversible/rejection choices from ordinary forward actions; color is supplemental to text, never the only cue.
  - [x] Apply the danger treatment only to existing consequential controls, without changing their native form/action/hidden-input semantics: resume proposal reject, evidence reject/remove, Career Assistant proposal reject, duplicate reversal where destructive, and permanent-delete/irreversible Data & Storage confirmation. Do not make cancel, ordinary edit, or local navigation look destructive.
  - [x] Keep evidence/skill chips compact, text-forward, and wrapping. Keep Jobs listing cards, Applications future fields, Resume/Evidence panels, Assistant proposals, Sheets fields, and home secondary regions visually consistent through existing panel/card patterns rather than dashboard-like technical framing.
  - [x] Move technical identifiers that currently dominate a primary resume/version row (including evidence support revision IDs) behind native progressive disclosure such as `details/summary`, while retaining the human filename, revision, time, and evidence meaning in the main flow. Preserve existing Jobs source-record disclosure and do not expose tokens, absolute paths, prompts, raw diagnostics, audit payloads, or credentials.

- [x] Make current content states truthful, useful, and recovery-oriented (AC: 1, 2, 4, 5)
  - [x] Audit only states already reachable in Jobs, Applications, Resume/Evidence, Career Assistant, Google Sheets, Data & Storage, preferences, permitted sources, and refresh. Keep or improve direct factual wording: what happened, what remains local/intact, any affected entity/source when actually known, and the safe next action.
  - [x] Preserve the established error-over-empty rule: a read/action failure must not render a definite empty/no-results/no-connection state. Retain available successful local sections and do not fabricate a partial, connected, completed, or editable result.
  - [x] Keep static guidance out of live regions. Existing action outcomes may use one polite status announcement; only blocking errors may use assertive alert semantics. Do not add repeated loading announcements, fake progress/counts, timers, automatic retries, automatic scans, or background activity.
  - [x] Retain the Resume stale/unsaved preview, warnings, safe text-only preview boundary, review-summary, and acknowledgement protections exactly. This story verifies and styles them; it must not rebuild the resume state machine or approval semantics.
  - [x] Keep every unverified proposal visibly unverified, every unavailable future integration clearly unavailable, and missing values named `Unknown` where the existing data contract uses that label. Remove technical/admin phrasing from primary copy only when an equally precise human explanation remains.

- [x] Complete responsive card, overflow, and focus behavior (AC: 3, 4, 5)
  - [x] At `max-width: 40rem` / 320 CSS px, explicitly stack Job Listing facts and Applications labelled fields into one-column label/value cards. Preserve Jobs title/company, location/work style, Fit Label, Freshness, source, filters, result count, status, and actions; preserve all Applications future-field labels and its Jobs handoff.
  - [x] Apply resilient long-value rules (`min-width: 0` and `overflow-wrap: anywhere` or an equivalent safe break rule) to shared cards, panels, forms, details, code/metadata disclosure, links, URLs, filenames, source text, and status/recovery text. Do not truncate or hide material facts just to avoid overflow.
  - [x] Ensure focus is still visible when the header is compact, content is stacked, a `details` disclosure is open, or a confirmation control has focus. No required information, warning, recovery action, or record action may be hover-only or obscured by sticky content.
  - [x] Do not introduce an unjustified horizontally scrolling table/data region. If a future dense record requires one, defer it with a documented field-to-card alternative rather than adding it in this polish story.

- [x] Add an integrated UI-contract regression matrix and validate (AC: 1-5)
  - [x] Add or extend focused Node source-contract tests (a dedicated `tests/shared-visual-polish-ui.test.ts` is appropriate if it prevents duplicated assertions). Cover shell destination order, compact-control label/current destination/Escape/focus-return contract, existing full navigation, and no route changes.
  - [x] Cover semantic action hierarchy and contrast token use: dark header, warm affirmative foreground, distinct danger selector/text, accessible link/focus tokens on light panels, and non-color state labels. Do not make tests depend on incidental styling whitespace.
  - [x] Cover the representative state matrix: Jobs no-listings/no-match/error and long record values; Applications empty/local-first handoff and labelled narrow fields; Resume stale preview/warnings/provenance disclosure; Evidence/Assistant unverified/rejection/recovery; Sheets disconnected/future-recovery copy; and Data & Storage consequential confirmations.
  - [x] Assert responsive CSS markers for explicit one-column Jobs/Applications card reflow, long-value resilience, and compact navigation. Protect native labels, `aria-current`, status/alert semantics, links, existing form actions, and the dedicated route/placeholder boundaries.
  - [x] Keep static safety guards across presentation code: no `fetch(`, polling, timers, watcher/File System Access APIs, automatic refresh/scan/retry, OAuth implementation, remote/cloud or AI fallback, fabricated records, duplicate data authority, or changed persistence/domain behavior.
  - [x] Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`. Manually inspect the major routes at 320 CSS px / 400% zoom with keyboard navigation before review; include the result in the Story 0.7 completion record.

### Review Findings

- [x] [Review][Patch] Announce the compact navigation’s current destination and open/close action to screen readers [src/app/compact-navigation.tsx:14]
- [x] [Review][Patch] Close an open compact menu when its narrow layout is no longer active [src/app/compact-navigation.tsx:8]

## Dev Notes

### Product intent and scope

Story 0.7 is the final Epic 0 integration and polish pass. Its job is to make the current Jobs-first product read as one calm, human-oriented Career Workspace. It standardizes presentation and verifies real interaction paths; it does **not** add tracking, Sheets authorization/sync, data mutations, new adapters, automatic work, or a redesign of individual workspace workflows.

The polish must never hide important truth to look more polished. A user should see whether something is local, unavailable, unverified, stale, unresolved, or failed before they can act. Technical detail may be inspectable, but never displaces the decision-relevant human summary.

### Dependencies and sequencing

- Story 0.1–0.3 and 0.5–0.6 are done. Story 0.4 is still recorded as `review`; complete or reconcile that review before starting implementation so the Resume/Evidence visual baseline is stable.
- Story 0.7 follows the workspace stories and should not reopen their domain scope. It may make narrow presentation/CSS/test changes to their existing components where an acceptance criterion requires cross-app consistency.
- Epic 3 Story 3.1 is independently in review; do not alter its fit domain, persistence, or presentation unless a focused regression proves a shared CSS change broke it.

### Current implementation map

| Area | Current implementation | Required Story 0.7 change / preservation |
| --- | --- | --- |
| Shared shell | `src/app/application-shell.tsx` has a dark header, seven link tabs, skip link, and active state; narrow CSS currently turns tabs into a two-column grid. | Add only a compact narrow-navigation composition; preserve all labels, links, skip link, active semantics, and larger-screen navigation. |
| Shared CSS | `src/app/globals.css` owns tokens, focus, header, panels, cards/chips, and the `40rem` responsive breakpoint. | Extend it minimally with compact nav, semantic action/status classes, explicit Jobs/Applications stacks, long-value resilience, and accessible focus/contrast. Preserve existing selectors that UI-contract tests already protect. |
| Jobs | `src/app/page.tsx` keeps Jobs first; `src/app/job-listings.tsx` has search/filter/result/empty/error/provenance and card semantics. | Preserve manual-only/local safety and existing no-match/error distinctions. Add explicit narrow fact-card reflow and shared visual treatment only. |
| Applications | `src/app/applications.tsx` remains a truthful non-editable/future-state workspace with local-first wording and a Jobs handoff. | Do not claim application editing exists. Preserve fields and make their narrow labelled-card layout explicit. |
| Resume | `src/app/current-base-resume.tsx` owns unsaved/stale preview acknowledgement, warnings, safe local text preview, and inline version identifiers. | Preserve its client/form state. Apply danger class to reject and move revision identifiers to disclosure without changing evidence provenance or decisions. |
| Evidence / Assistant / Storage | `src/app/evidence-review.tsx`, `evidence-library.tsx`, `career-assistant.tsx`, and `data-storage.tsx` own existing Server Action/native form workflows. | Apply semantic danger/neutral classes and human copy only. Keep commands, hidden values, IDs, confirmations, cancellation, focus return, `aria-live`, and privacy boundaries unchanged. |
| Sheets | `src/app/google-sheets-workspace.tsx` is a presentation-only honest disconnected workspace. | Retain no OAuth, no network, no sync, no fake connection state; harmonize only shared styling/status treatment. |

### Architecture and safety guardrails

- This is UI-only polish inside the local-first modular monolith. Preserve the existing action boundary: explicit UI action -> existing Server Action -> domain command -> one SQLite transaction -> metadata-only audit -> revalidated render. Do not duplicate a client-side authority or action dispatcher.
- Do not add database migrations, repositories, domain commands, new dependencies, source adapters, OAuth, credential/vault code, `fetch`, timers, polling, watcher APIs, browser directory access, automatic retry/scan/refresh, cloud/remote model fallback, exports, or fabricated records.
- Maintain AD-1 local-only ownership, AD-4 evidence/claim review gates, AD-5 manual policy-gated discovery, AD-6 local-authoritative future Sheets mirror, AD-10 metadata-only audit, and AD-11 local/non-executing preview and directory-workflow boundaries.
- Keep sources, provenance, source-policy metadata, local file references, and raw internal values out of primary UI. Do not broaden the two deferred Story 0.5 issues (recursive Markdown bounds and stale proposal audit classification).

### Accessibility and interaction contract

- Use native semantic controls and labels. A compact nav must have a programmatic label, identify the current destination, be operable with keyboard, close on Escape, and return focus to the trigger. Do not simulate a menu with non-semantic clickable containers.
- Preserve visible focus with a contrast-valid ring on light panels and the dark header. The current deep-orange `#B44700` token was selected in Story 0.6 review because it contrasts on both surfaces; do not regress it without a documented contrast-safe replacement and updated tests.
- Warm affirmative buttons use `#F59E4A` with dark `#201126` foreground. Irreversible actions require distinct danger styling **and** an explicit effect label. Disabled/unavailable styling cannot be the sole explanation.
- At 320 CSS px / 400% zoom, follow natural document order; no sticky element may conceal focus. Long values remain readable/selectable. Use text status in addition to shape/color; do not create focusable loading placeholders or repeatedly announced content.

### State-copy rules

| State | Required wording behavior |
| --- | --- |
| First use / empty | Say what does not exist yet and name the next useful local action or destination. |
| No match | State that the active search/filter produced no saved listings; preserve query/filter context and give a clear/reset path. |
| Error / unavailable | State the affected workspace/source when known, preserve valid local content, and show the existing safe next action. Never replace an error with an empty state. |
| Local / disconnected / future capability | Clearly distinguish a current local view from unavailable future tracking, Sheets, or sync behavior. Never promise editing, authorization, or a completed sync that does not exist. |
| Unverified proposal / stale preview / warning | Keep the item and consequence at the decision point; provide its separate review, save, repair, or acknowledgement path. |
| Consequential action | Name the real effect before commit; cancellation/neutral navigation stays visually neutral. |

### Testing and validation requirements

- Tests use Node's `node:test` through `node --import tsx --test tests/*.test.ts`; existing UI tests inspect source contracts. Follow the concise `node:assert/strict` and `readFile` pattern.
- Start with failing source-contract tests for compact nav, responsive card/long-value markers, action classes, progressive disclosure, and representative state copy. Then implement the minimal changes needed to make them pass.
- Existing static tests intentionally ban unsafe terms/APIs. Do not weaken or remove them to make this story pass. Update expectations only where Story 0.7 deliberately corrects a truthful/accessible visual token or label.
- Run the complete suite, TypeScript check, ESLint, and production build after the focused tests. Verify that dedicated dynamic routes remain present and `/settings` remains the generic placeholder route.
- Manual validation is mandatory because source-contract tests cannot prove visual reflow: keyboard-only compact navigation; 320 CSS px/400% zoom; a long job title/URL; a long evidence/source value; Resume unsaved preview plus warning; a Sheets disconnected view; and a Data & Storage confirmation escape/cancel path.

### Files expected to change

- New (only if needed): `src/app/compact-navigation.tsx` and/or `tests/shared-visual-polish-ui.test.ts`.
- Update: `src/app/application-shell.tsx`, `src/app/globals.css`, `src/app/page.tsx`, `src/app/job-listings.tsx`, `src/app/applications.tsx`, `src/app/current-base-resume.tsx`, `src/app/evidence-review.tsx`, `src/app/evidence-library.tsx`, `src/app/career-assistant.tsx`, `src/app/data-storage.tsx`, and focused existing UI-contract tests.
- Do not change: `src/app/actions.ts` behavior, domain/persistence/adapters/files/audit code, migrations, package dependencies, source retrieval behavior, local model transport, Sheets/OAuth code, or completed workflow semantics.

### Validation commands

```powershell
npm test
npm run typecheck
npm run lint
npm run build
```

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Story 0.7: Polish the shared visual system, content, states, and responsive behavior`]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-24-cv-builder-visual-system.md#4.3 Shared dark shell and responsive Job/Application records`]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-24-cv-builder-visual-system.md#4.6 Scope preservation and validation handoff`]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-Resume-2026-08-06/DESIGN.md#Colors`]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-Resume-2026-08-06/DESIGN.md#Layout & Spacing`]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-Resume-2026-08-06/DESIGN.md#Components`]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-Resume-2026-08-06/EXPERIENCE.md#Application shell`]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-Resume-2026-08-06/EXPERIENCE.md#Voice and Tone`]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-Resume-2026-08-06/EXPERIENCE.md#Accessibility Floor`]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-Resume-2026-08-06/review-accessibility.md#Exit criteria`]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-Resume-2026-08-07/ARCHITECTURE-SPINE.md#AD-1`, `#AD-4`, `#AD-5`, `#AD-6`, `#AD-10`, `#AD-11`]
- [Source: `src/app/application-shell.tsx`, `src/app/globals.css`, `src/app/current-base-resume.tsx`, `src/app/applications.tsx`, `src/app/job-listings.tsx`]
- [Source: `_bmad-output/implementation-artifacts/0-6-create-the-google-sheets-workspace.md#Review Findings`]

## Dev Agent Record

### Agent Model Used

GPT-5.6

### Debug Log References

- Comprehensive context analysis completed across Epic 0, all relevant UX/architecture guidance, Story 0.6 code review lessons, current source patterns, and focused test conventions.
- Official Next.js documentation research was attempted; the documentation endpoints returned an unsupported Markdown content type. Existing project framework/version and local patterns are sufficient; no library upgrade or external integration is authorized.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Scope is deliberately limited to shared presentation, accessibility, responsive behavior, truthful content states, and regression coverage; no domain or integration work is authorized.
- Story 0.4 review completion is a recommended prerequisite to stabilize Resume/Evidence behavior before this final Epic 0 polish pass.
- Added a narrowly scoped, keyboard-operable compact navigation that preserves every Jobs-first route, names the current destination, closes with Escape, and restores focus to its trigger.
- Added shared affirmative, neutral, and danger action treatments; applied them only to existing consequential controls while preserving all native form commands and confirmation flows.
- Added progressive disclosure for retained evidence revision identifiers, explicit narrow card stacking, and resilient long-value wrapping without altering domain or persistence behavior.
- Added `tests/shared-visual-polish-ui.test.ts`. Automated validation passed: `npm test` (97/97), `npm run typecheck`, `npm run lint`, and `npm run build`; all major local routes returned HTTP 200.
- Checkpoint review approved the manual 320 CSS px / 400% zoom keyboard inspection: compact navigation, Jobs/Application reflow, Resume disclosure, Sheets disconnected state, and consequential confirmations were accepted.

### File List

- `_bmad-output/implementation-artifacts/0-7-polish-the-shared-visual-system-content-states-and-responsive-behavior.md` (new story context)
- `src/app/compact-navigation.tsx` (new compact primary navigation)
- `src/app/application-shell.tsx` (compact navigation composition)
- `src/app/globals.css` (semantic actions, compact navigation, reflow, overflow, focus)
- `src/app/job-listings.tsx` (semantic action hierarchy)
- `src/app/current-base-resume.tsx` (danger actions and disclosed technical support identifiers)
- `src/app/evidence-review.tsx` (semantic evidence decisions)
- `src/app/career-assistant.tsx` (semantic proposal decisions)
- `src/app/data-storage.tsx` (semantic consequential confirmations)
- `tests/shared-visual-polish-ui.test.ts` (shared UI-contract regression matrix)

## Change Log

- 2026-08-24: Created Story 0.7 implementation context for the cross-app Career Workspace visual, content-state, responsive, and accessibility polish pass.
- 2026-08-24: Implemented shared visual and responsive polish; checkpoint review approved and story moved to review.
- 2026-08-24: Addressed code review findings for compact navigation accessibility and breakpoint-state cleanup; story moved to done.

## Story Completion Status

- Status set to `done` after code review fixes and validation.
