---
baseline_commit: 380c24dbc8a9b3dc6cc70a235da0888b7cb447db
---

# Story 0.3: Create the Applications Workspace

Status: done

## Story

As Adrian,
I want to see every role I have applied to in one place,
so that I can track progress and follow-ups without reconstructing it manually.

## Acceptance Criteria

1. Given Adrian opens Applications, when the page loads, then it is a dedicated, human-oriented Applications workspace inside the shared application shell—not the generic destination placeholder. When application records are available, each applied-role row/card shows company, application stage, applied date, next follow-up, and linked materials. Until the future application-record domain exists, it truthfully presents the empty foundation state rather than fabricating roles or tracking data.
2. Given an application has interviews, when Adrian opens it after the future tracking domain supplies data, then ordered interview rounds, dates, status, outcome, notes, and next action are easy to inspect. This story creates no application, interview, or follow-up persistence, mutation, or fake sample data; Stories 5.1 and 5.2 own that capability.
3. Given Google Sheets is unavailable or disconnected, when Adrian uses Applications, then the workspace makes clear that local tracking is independent, displays an honest connection/sync status and recovery destination, and never implies a connection, authorization, or sync occurred. This story does not implement OAuth, a Sheets adapter, polling, retries, or sync; Story 0.6 and Epic 6 own those capabilities.
4. Given no applications exist, when the page loads, then it explains the state in plain language, identifies Jobs as the next place to choose a role to pursue, and provides an accessible route back to Jobs.
5. Given keyboard, screen-reader, zoom, or narrow-viewport use, when Adrian navigates the workspace or follows its Jobs/Google Sheets handoffs, then the shared navigation remains intact, headings and status are understandable, controls have visible focus and adequate targets, content reflows without horizontal scrolling, and technical implementation details do not dominate the primary view.

## Tasks / Subtasks

- [x] Replace the generic Applications placeholder with a dedicated route and workspace frame (AC: 1, 4, 5)
  - [x] Add `src/app/applications/page.tsx` as the explicit `/applications` App Router page. Reuse `ApplicationShell active="Applications"`; retain Jobs as the first navigation destination and do not alter the other workspace destinations.
  - [x] Remove `/applications` from the dynamic `[section]` route's generated static parameters/destination map so the dynamic placeholder cannot claim the dedicated route. Preserve valid dynamic placeholder routing for the remaining non-Jobs destinations.
  - [x] Add a small presentational component only if it improves readability (for example, `src/app/applications.tsx`). Keep it server-rendered unless client interaction is actually required; do not add a UI library, data-fetching layer, Server Action, timer, browser automation, or network request.
  - [x] Make the visual hierarchy read as an application tracker: page title, short human explanation, a quiet workspace summary/status, and an applications-list area. Do not promote database, API, migration, revision, or sync implementation terms into the first view.

- [x] Build the truthful local-first empty workspace and future-data seams (AC: 1, 2, 4)
  - [x] Because no `ApplicationRecord`, follow-up, interview-round, or material-link read model exists yet, render a clear empty state such as “No applications to track yet,” explain that roles will appear here once Adrian chooses to track them, and provide a prominent native `Link` back to `/` labelled in human terms (for example, “Browse Jobs”). Do not create demo roles, dates, stages, notes, or interview history merely to fill the screen.
  - [x] Reserve the list/detail information architecture in labels and layout only: applied role/company, Stage, Applied, Next follow-up, Materials, and interview history. It must remain clear these appear when local tracking becomes available; do not invent a second domain contract or persistence representation to make them render now.
  - [x] Do not implement “Save application,” stage editing, notes, material attachment, follow-up scheduling, interview editing/reordering, application submission, or any employer-portal interaction. Those are explicitly owned by Stories 5.1 and 5.2 and must use the existing local-first domain/persistence/audit conventions when implemented.
  - [x] Keep the visual treatment polished and calm: use the Story 0.1 token system and Story 0.2 card/layout patterns where appropriate, with scan-friendly grouping and clear next action rather than an API-test form.

- [x] Communicate Sheets state and recovery without implementing integration (AC: 3, 5)
  - [x] Add an accessible, plain-language local-tracking/sync status region. State only facts supported now: Google Sheets has not been connected from this workspace and a future connection is optional; local application tracking will not depend on Sheets.
  - [x] Link to `/google-sheets` with a clear destination label so Adrian can inspect or set up the future tracker connection. Do not render a connected account, granted scope, spreadsheet, worksheet, last-sync time, queued change, or success/failure result without real data.
  - [x] Make recovery language actionable but bounded: direct Adrian to the Google Sheets workspace instead of auto-retrying or hiding a failure. Never expose credentials, tokens, local file paths, raw error diagnostics, prompts, notes, or material content.

- [x] Apply the approved responsive and accessibility contract (AC: 5)
  - [x] Use semantic landmarks and heading order: the `ApplicationShell` main landmark contains a single page `h1`, appropriately nested sections, and a labelled status/summary. Use `role="status"` / `aria-live="polite"` only for genuinely changing status in future interactive work; static initial copy does not need artificial announcements.
  - [x] Use native links/buttons only for their matching navigation/action purposes. Preserve visible `:focus-visible` treatment from the approved shell, logical tab order, descriptive link text, non-color-only state communication, and at least the existing 24px target baseline.
  - [x] Extend `src/app/globals.css` minimally using existing tokens (`--surface-base`, `--surface-raised`, `--border`, `--accent`, `--focus-ring`) and `system-ui`. At narrow widths/200% zoom, stacked content must remain readable, long labels must wrap (`overflow-wrap: anywhere` where needed), and no essential controls or state may be hover-only.
  - [x] Keep technical metadata behind `details` or omit it until it has a real user purpose. The primary view must communicate a career workspace, not a tracker/API test harness.

- [x] Add focused UI and regression verification (AC: 1-5)
  - [x] Add `tests/applications-workspace-ui.test.ts` using the repository's Node source-contract testing style. Assert a dedicated Applications route, `ApplicationShell active="Applications"`, page title/semantic empty state, Jobs handoff, optional Google Sheets handoff, and accessible human-oriented status language.
  - [x] Assert the source contains no fake application fixtures, OAuth/Sheets sync implementation, polling/timer/network API, application-submission wording, or premature tracker persistence/mutation wiring.
  - [x] Extend an existing shell route test if necessary to ensure `/applications` no longer resolves through the generic dynamic placeholder and the other destination placeholders remain available.
  - [x] Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`. Resolve failures within this story's scope and preserve completed Jobs, listing, fit, source-refresh, and shell behavior.

### Review Findings

- [x] [Review][Patch] Future interview details omit dates and statuses [src/app/applications.tsx:40]

## Dev Notes

### Product intent and scope

This is the next UX-foundation story after the shared shell and Jobs-first home. It must make Applications feel like a real destination in a career workspace while being honest about the current product state. The desired first impression is a calm, useful tracking home—clear purpose, clear next action, and visible local-first trust—not a page of technical inputs and outputs.

The workspace frame may be built before tracking data exists. It must not bypass or duplicate the future application domain just to populate the UI. In particular, no static/demo application rows, mock interview timelines, optimistic local state, SQLite migration, repository, audit action, or Server Action belongs here.

### Explicit ownership and sequencing

| Concern | Owner / dependency | Story 0.3 decision |
| --- | --- | --- |
| Dedicated Applications route, workspace hierarchy, empty state, navigation and visual/accessibility polish | Story 0.3 | Implement now. |
| Save/update a local application record; link one record to a Job Listing; application stage, notes, material versions | Story 5.1 | Do not implement or redefine. Wait for its domain read model. |
| Follow-ups and ordered interview rounds | Story 5.2 | Do not implement or fabricate. Later data must fit the information architecture established here. |
| Google Sheets authorization, mirror, reconciliation, sync outcomes | Story 0.6 / Stories 6.1–6.3 | Only provide an honest optional-connection handoff; do not implement integration. |
| Jobs listing and Fit Assessment records | Completed Stories 0.2 and existing Epics 2–3 | Preserve unchanged. Existing `JobListing` is the eventual upstream association, not an Applications record today. |

When Stories 5.1/5.2 arrive, they should supply a local-first read model to this route rather than replace the route/shell. The expected later facts are one application record per saved Job Listing, user-controlled stage, applied/saved date, linked material versions, follow-ups, and ordered interview rounds. The local store remains authoritative. Every later mutation must be explicitly user initiated and follow the established UI → domain command → one SQLite transaction → metadata-only audit event path.

### UX requirements

- Follow `ux-designs/ux-Resume-2026-08-06/DESIGN.md` and `EXPERIENCE.md`: Applications is a primary workspace, not a configuration screen; use human language, progressive disclosure, responsive stacking, and clear recovery.
- The likely future record list must be quickly scannable: role/company first, then Stage, Applied, next Follow-up, Materials; opening a record reveals ordered Interview Rounds with date, status/outcome, notes, and next action. Do not claim this data exists before it does.
- No application submission, autofill, employer portal update, scheduled reminder, background refresh, polling, automatic retry, or external side effect is allowed or implied.
- Sheets is optional. A disconnected/unavailable Sheets state must never make local tracking look blocked, even when later Epic 5 capabilities exist.
- Persisted or future technical data such as UUIDs, revisions, hashes, sync identifiers, and source records should be progressive disclosure only. Never expose secrets or raw diagnostics.

### Existing implementation context

- `src/app/[section]/page.tsx` currently provides the only Applications surface through a generic placeholder. Replace it with a dedicated static route; avoid static/dynamic route ambiguity by excluding `/applications` from that placeholder's static parameters.
- `src/app/application-shell.tsx` owns the established destinations and active-navigation treatment. Reuse it rather than introducing a second shell or nav system.
- `src/app/globals.css` already contains the approved visual tokens and focus treatment. Extend it minimally and preserve the Jobs-first styling and long-value wrapping fix.
- There is currently no application-record, follow-up, interview-round, material-version, Sheets OAuth, tracker-sync, or OS-vault module, migration, repository, or test. The latest persistence migration is `0018_fit_assessments`; do not add `0019` in this UX-frame story.
- Existing client mutation surfaces use `useActionState`, native forms, disabled pending controls, and safe `WorkspaceActionState` errors. Do not add action infrastructure merely for a static foundation page.

### Architecture / safety constraints for later handoff

Record these constraints in code comments only when a comment genuinely protects an interface; this story should not prebuild their files:

- Future `ApplicationRecord` has a one-to-one association with a saved `JobListing`; mutable records use UUIDv7, UTC ISO timestamps, monotonic local revision, and SHA-256 content digest.
- Future follow-ups and interview rounds are children of that record; interview ordering must be explicit and stable. Notes, URLs, materials, credentials, prompts, and outputs never enter metadata-only audit events.
- Future mutation failures use the shared safe error contract (`code`, user-facing summary, safe next action, affected identifiers); unsaved form work is recoverable or explicitly discardable.
- Future Sheets sync is an explicit, user-triggered optional mirror. Local data is authoritative; no silent overwrite, background polling, or automatic conflict resolution.

### Testing standards and lessons from prior reviews

- Follow the existing `node:test` / `tsx` source-contract test convention. UI tests must protect the required empty, navigation, status, responsive, and accessibility states—not merely string-match a title.
- Carry Story 0.1 lessons forward: all destinations keep the shared shell; Jobs stays first; primary content uses human language; focus and responsive behavior are non-negotiable.
- Carry Story 0.2 lessons forward: an error must outrank an empty state once data loading exists; no entity data may bleed between records; inline interactions must retain/restore focus; long content must not overflow; tests should cover meaningful state variants.
- Official Next.js guidance confirms that `app/<segment>/page.tsx` defines a route-specific App Router page and that pages/layouts are Server Components by default. Prefer that simple dedicated-page composition here. [Next.js Pages and Layouts](https://nextjs.org/docs/app/getting-started) [Next.js Linking and Navigating](https://nextjs.org/docs/app/getting-started/linking-and-navigating)

### References

- `_bmad-output/planning-artifacts/epics.md` — Epic 0, Story 0.3 acceptance criteria; existing Epics 5 and 6 ownership.
- `_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-24.md` — approved incremental sequencing: Story 0.3 can establish the workspace frame before future Epic 5 domain work.
- `_bmad-output/planning-artifacts/ux-designs/ux-Resume-2026-08-06/DESIGN.md` — application shell, jobs-first hierarchy, workspace and responsive visual guidance.
- `_bmad-output/planning-artifacts/ux-designs/ux-Resume-2026-08-06/EXPERIENCE.md` — application-tracking workflow, local-first/sync behavior, states and accessibility expectations.
- `_bmad-output/planning-artifacts/ARCHITECTURE-SPINE.md` — local-first modular-monolith and transaction/audit invariants for the later tracker domain.
- `src/app/application-shell.tsx`, `src/app/[section]/page.tsx`, `src/app/globals.css`, `tests/application-shell-ui.test.ts`, and `tests/job-listings-ui.test.ts` — implementation and test conventions to preserve.

## Story Completion Status

- Story context gathered from the Epic 0 requirements, approved course-correction, UX specifications, architecture spine, current codebase, completed Story 0.1/0.2 review lessons, and current Next.js documentation.
- Scope boundary verified: this is a ready-for-development UX foundation story; Stories 5.1/5.2 and 6.1–6.3 retain their backend/domain and Sheets responsibilities.
- Status set to `ready-for-dev`.

## Dev Agent Record

### Implementation Plan

- Add a static `/applications` page that reuses the shared shell, excluding that route from the generic placeholder's generated parameters.
- Present an honest local-first empty workspace with Jobs and optional Google Sheets handoffs; reserve the future record details only as explanatory information architecture.
- Verify the dedicated route, accessibility semantics, responsive styles, and strict no-backend/no-sync scope with source-contract tests and the full project validation suite.

### Debug Log

- `python3 _bmad/scripts/resolve_customization.py ...` could not run because `python3` is not installed; applied the workflow's documented TOML fallback. No custom override or project context file was present.
- New route/workspace contract tests failed first because the dedicated files did not yet exist; passed after implementation. One overly exact test assertion was corrected to permit the required `className` alongside its `aria-labelledby` attribute.

### Completion Notes

- Replaced the generic Applications placeholder with a static, shared-shell Applications workspace and preserved generic placeholders for the other destinations.
- Added an honest empty state, a Jobs return path, an optional Google Sheets handoff, future tracking-information labels, and responsive polished layout styles. No application-record persistence, mutation, fabricated record, OAuth, sync, timer, or network behavior was added.
- Added Applications UI contract tests. `npm test` (82 passing), `npm run typecheck`, `npm run lint`, and `npm run build` all pass; the production build confirms `/applications` is statically generated and no longer part of the dynamic placeholder route.

## File List

- `src/app/applications/page.tsx` (new)
- `src/app/applications.tsx` (new)
- `src/app/[section]/page.tsx` (modified)
- `src/app/globals.css` (modified)
- `tests/applications-workspace-ui.test.ts` (new)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified)
- `_bmad-output/implementation-artifacts/0-3-create-the-applications-workspace.md` (modified)

## Change Log

- 2026-08-24: Implemented the dedicated, local-first Applications workspace and its regression/UI-contract coverage; status moved to review.
