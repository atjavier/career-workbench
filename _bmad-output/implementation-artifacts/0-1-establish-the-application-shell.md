---
baseline_commit: 380c24dbc8a9b3dc6cc70a235da0888b7cb447db
---

# Story 0.1: Establish the Application Shell

Status: done

## Story

As Adrian,
I want a coherent application shell with clear navigation,
so that the product feels like one career workspace rather than a collection of technical pages.

## Acceptance Criteria

1. Given Adrian opens the app, when the workspace loads, then Jobs is the default destination and the first visual hierarchy communicates a career workspace rather than an API/admin console.
2. Given the primary navigation, when Adrian selects a destination, then the shell provides clear human-facing tabs/links for Jobs, Applications, Resume, Evidence Library, Google Sheets, Career Assistant, and Settings, with the current destination visibly identified.
3. Given any current or placeholder destination, when it renders, then it uses a consistent shell with product identity, navigation, page title/subtitle, main content region, and an accessible status/help region.
4. Given technical metadata such as revision IDs, digests, source-policy details, or implementation statuses, when Adrian needs to inspect it, then it is progressively disclosed rather than presented as the primary content layer.
5. Given keyboard, screen-reader, zoom, narrow-viewport, and reduced-motion use, when Adrian navigates, then the shell remains operable, readable, and understandable without relying on hover, color alone, or pointer-only controls.
6. Given existing feature panels and actions, when the shell is introduced, then existing local-first behavior, server actions, error/recovery messaging, anchor destinations, and regression behavior remain intact.

## Tasks / Subtasks

- [x] Establish the shared application shell and route/navigation contract (AC: 1-3)
  - [x] Add or refactor the App Router layout/navigation composition so shared shell chrome persists across future routes; keep `src/app/layout.tsx` as the root document boundary.
  - [x] Create a reusable shell/navigation component under `src/app/` with human labels, active/current state, keyboard-native links, and responsive desktop/mobile behavior.
  - [x] Make Jobs the home destination while providing honest placeholder destinations for Applications, Resume, Evidence Library, Google Sheets, Career Assistant, and Settings until their feature stories land.
  - [x] Use `next/link` for internal navigation and route/page structure compatible with App Router layouts; do not implement custom client-side routing.
- [x] Recompose the current home experience around the shell (AC: 1, 3, 4, 6)
  - [x] Preserve existing Jobs, Resume/Evidence, preferences, source, refresh, and Data & Storage behavior while changing their presentation hierarchy.
  - [x] Move Search Preferences, Permitted Sources, Source Refresh, and Data & Storage into Settings or clearly secondary contextual destinations without deleting their working controls.
  - [x] Keep technical details (IDs, digests, policy metadata, audit/provenance details) behind details/secondary views; primary copy should describe user goals and outcomes.
  - [x] Ensure the first viewport presents Jobs-oriented identity and a clear next action rather than a stack of unrelated panels.
- [x] Apply the approved visual/interaction contract (AC: 1-5)
  - [x] Use tokens from `_bmad-output/planning-artifacts/ux-designs/ux-Resume-2026-08-06/DESIGN.md` and behaviors from `EXPERIENCE.md`; do not invent a competing visual system.
  - [x] Preserve readable contrast, visible focus, semantic landmarks, 24px minimum targets or spacing exception, and non-color-only active/error states.
  - [x] Provide a skip link or equivalent keyboard bypass, one clear navigation landmark, one main landmark, and an accessible current-page announcement.
  - [x] Keep responsive navigation usable at narrow widths without hiding destinations or making the current location ambiguous.
- [x] Add shell-focused verification (AC: 1-6)
  - [x] Add UI contract tests for navigation labels, Jobs default/home identity, active state, landmarks, skip/bypass behavior, placeholder honesty, and absence of API/debug-console framing.
  - [x] Verify existing feature UI tests remain valid and no existing action/domain tests are weakened.
  - [x] Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`.

### Review Findings

- [x] [Review][Patch] Placeholder destinations bypass the shared application shell [src/app/[section]/page.tsx:16] — fixed by wrapping every placeholder in `ApplicationShell` with its active destination.
- [x] [Review][Patch] Workspace setup still precedes the Jobs experience [src/app/page.tsx:48] — fixed by rendering the Jobs action and listings before workspace setup.
- [x] [Review][Patch] Focus indicator does not meet the approved accessibility contract [src/app/globals.css:25] — fixed with the approved `--focus-ring` token.
- [x] [Review][Patch] Shell styles do not adopt the approved UX token contract [src/app/globals.css:3] — fixed with approved primary, focus, border, surface, and system-typography values.
- [x] [Review][Patch] Data & Storage metadata remains fully expanded on the Jobs page [src/app/page.tsx:75] — fixed by placing the panel in an initially collapsed secondary disclosure.
- [x] [Review][Patch] Shell contract tests miss rendered route coverage [tests/application-shell-ui.test.ts:5] — fixed with placeholder shell/status and focus-token contract checks.

## Dev Notes

### Product intent

This story is the first implementation step for Epic 0. The current `src/app/page.tsx` renders every feature panel in one long technical page. The goal is not to remove delivered capability; it is to establish a recognizable career application shell so later Jobs, Applications, Resume, Evidence, Assistant, and Google Sheets stories have coherent destinations.

### Architecture guardrails

- Preserve the local-first modular monolith: Next.js App Router on `127.0.0.1`, SQLite/private app data as authority, and no public deployment or product login. The shell is presentation/routing composition only; it must not add network calls, background work, or new persistence.
- Follow the existing UI action → domain command → SQLite transaction → metadata-only audit boundary. Navigation must not trigger mutations, refreshes, adapter calls, or hidden retries.
- Preserve current page-level error isolation and safe recovery messages. A feature unavailable state must remain factual and actionable.
- Use existing TypeScript/React/Next versions and dependencies. Do not add a UI library or dependency for navigation.

### Current implementation to preserve

- `src/app/layout.tsx` currently owns the root `<html lang="en">`, metadata, and global stylesheet import. Keep it as the root layout and extend only as needed.
- `src/app/page.tsx` currently loads all feature states independently with error isolation, then renders WorkspaceStatus, preferences, sources, refresh, Jobs, Resume/Evidence, and Data & Storage. Preserve these loaders and domain calls while changing composition.
- `src/app/job-listings.tsx` is the Jobs surface and already provides local manual import, fit calculation, duplicate inspection, source attribution, and status/recovery behavior.
- `src/app/actions.ts` contains Server Actions for existing features. Navigation must use links/routes and must not call these actions implicitly.
- `src/app/globals.css` contains the current tokens/layout primitives but has a technical utility-page hierarchy. Refactor carefully toward the UX spine; retain focus, form, status, and responsive behavior.

### Recommended route strategy

Use App Router shared layout composition and `next/link` for internal navigation. A safe incremental approach is to establish the shell around the current home first, then add route pages as later Epic 0 stories land. Placeholder destinations must clearly say they are not available yet and route back to Jobs; they must not simulate data or imply backend capability that does not exist.

Official Next.js guidance confirms that shared `layout.tsx` UI persists across navigation and that `next/link` is the primary internal navigation primitive in the App Router. [Source: Next.js Layouts and Pages](https://nextjs.org/docs/app/getting-started/layouts-and-pages), [Source: Next.js Linking and Navigating](https://nextjs.org/docs/app/getting-started/linking-and-navigating)

### UX requirements

- Jobs is the primary home and should be recognizable before Adrian reads technical details.
- Primary navigation labels: Jobs, Applications, Resume, Evidence Library, Google Sheets, Career Assistant, Settings.
- Human-facing language should describe outcomes (“Review jobs”, “Track applications”, “Manage evidence”) rather than implementation (“Refresh Run”, “revision”, “audit event”) in the first layer.
- Technical metadata remains discoverable through progressive disclosure for trust/provenance but should not dominate the initial viewport.
- Use the design tokens `{colors.*}`, `{typography.*}`, `{spacing.*}`, `{rounded.*}`, and `{components.*}` from the UX DESIGN spine; EXPERIENCE owns behavior.
- Accessible landmarks: skip link, navigation label, main content, heading hierarchy, focus-visible state, active destination state, and polite status/help region.
- Responsive behavior must preserve all navigation destinations and current-page context. Do not use hover-only menus or color-only active state.

### File structure expectations

Likely new/updated files:

- `src/app/layout.tsx` — root metadata/document boundary, only if needed.
- `src/app/application-shell.tsx` or equivalent — reusable shell and primary navigation.
- `src/app/page.tsx` — Jobs-first composition and secondary/contextual feature placement.
- `src/app/globals.css` — shell layout, navigation, responsive styles, focus/active states.
- `tests/application-shell-ui.test.ts` — navigation and accessibility contract tests.

Do not create parallel navigation systems in individual feature components. Do not delete existing feature panels or their domain modules; later stories will move them into dedicated routes/workspaces.

### Testing requirements

Use the existing Node test runner/tsx UI contract-test style. Assert human-facing labels, all seven destinations, Jobs-first identity, active/current semantics, landmark/skip-link markup, placeholder honesty, no automatic action invocation, and responsive-safe structure. Run the full regression suite and build gates.

### Scope boundaries

This story establishes shell/navigation and re-composes existing content. It does not implement full Applications tracking, new search/filter behavior, Career Assistant workflows, Google OAuth/Sheets sync, or a new fit explanation. Those belong to Stories 0.2–0.7 and existing Epics 3–6.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Epic 0: Career Workspace Experience`]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-Resume-2026-08-06/DESIGN.md`]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-Resume-2026-08-06/EXPERIENCE.md#Foundation`, `#Information Architecture`, `#Accessibility Floor`]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-Resume-2026-08-07/ARCHITECTURE-SPINE.md#AD-1 — Local-only ownership`, `#Consistency conventions`]
- [Source: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`, `src/app/job-listings.tsx`]
- [Source: Next.js App Router layouts and navigation documentation](https://nextjs.org/docs/app/getting-started/layouts-and-pages)

## Dev Agent Record

### Agent Model Used

### Debug Log References

- Analyzed full sprint status; selected first backlog story `0-1-establish-the-application-shell`.
- Reviewed Epic 0 requirements, updated UX DESIGN/EXPERIENCE spines, architecture spine, current App Router files, CSS, tests, and recent Git history.
- Official Next.js App Router layout/link guidance checked on 2026-08-24.

### Completion Notes List

- Added reusable Jobs-first application shell with accessible navigation and honest placeholder routes.
- Reordered home content so job listings lead; setup controls remain available in a clearly secondary workspace section.
- Added shell UI contract tests; full regression (74 tests), typecheck, lint, and production build all pass.

### File List

- `_bmad-output/implementation-artifacts/0-1-establish-the-application-shell.md`
- `src/app/application-shell.tsx`
- `src/app/[section]/page.tsx`
- `src/app/page.tsx`
- `src/app/globals.css`
- `tests/application-shell-ui.test.ts`

### Change Log

- 2026-08-24: Created implementation-ready Story 0.1 context for the foundational Jobs-first application shell.
- 2026-08-24: Implemented the Jobs-first shell, navigation destinations, responsive accessibility contract, and home composition.
