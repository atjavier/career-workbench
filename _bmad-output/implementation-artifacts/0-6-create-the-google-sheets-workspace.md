---
baseline_commit: 380c24dbc8a9b3dc6cc70a235da0888b7cb447db
---

# Story 0.6: Create the Google Sheets Workspace

Status: done

## Story

As Adrian,
I want a clear tracker connection area,
so that I understand what is mirrored to Google Sheets and whether synchronization is healthy.

## Acceptance Criteria

1. **Given** Adrian opens Google Sheets, **when** the page loads, **then** it clearly shows connection state, selected account, spreadsheet, worksheet, granted scope, and last sync outcome.

2. **Given** Adrian connects Google Sheets, **when** authorization begins, **then** the app previews the account, requested permissions, target sheet, and data categories before commitment.

3. **Given** a sync fails, conflicts, or permissions change, **when** the result is shown, **then** affected records, local preservation behavior, and safe recovery action are clear.

4. **Given** no connection exists, **when** Adrian opens the workspace, **then** local tracking remains available and connection is optional.

5. **Given** the shared visual system renders Google Sheets, **when** Adrian views a connection or sync outcome on any viewport, **then** it reuses the accessible dark shell, affirmative/danger action hierarchy, human-readable state, and responsive record rules without changing local authority, consent, or reconciliation behavior.

## Tasks / Subtasks

- [x] Establish the dedicated Google Sheets route and retain placeholder ownership correctly (AC: 1, 4, 5)
  - [x] Add `src/app/google-sheets/page.tsx` using `ApplicationShell active="Google Sheets"`, one logical `h1`, and `export const dynamic = "force-dynamic"` so the later connection-status capability has a fresh route boundary.
  - [x] Remove `google-sheets` only from `src/app/[section]/page.tsx` titles and `generateStaticParams`; retain the generic Settings placeholder and all existing dedicated routes.
  - [x] Keep the existing shared navigation untouched unless a genuine regression is found. Google Sheets is already a primary destination; do not restore a redundant Google Sheets link in Applications.

- [x] Build a truthful local-first tracker-status workspace (AC: 1, 3, 4)
  - [x] Add a small server-composed `src/app/google-sheets-workspace.tsx` (and a presentation component only if interaction-free rendering cannot remain simple) that renders the canonical disconnected state: **Not connected**, **Not selected** account/spreadsheet/worksheet, **No Google permission granted**, and **No sync has run**.
  - [x] Explain in human terms that the tracker is optional and that Applications/local tracking remain usable on this device without a Google connection. Provide an ordinary route back to `/applications` or Jobs; do not make an external request.
  - [x] Include a clearly labelled, non-fabricated recovery/readiness panel: a future access, write, permission, or divergence issue will identify the affected local record, preserve the local value, and offer the appropriate explicit retry, reconnect, or reconciliation choice. Do not invent an account, spreadsheet, worksheet, affected record, last attempt, successful sync, conflict, or remote-access result.
  - [x] If this presentation later receives a safe read failure, preserve any known local view and render a plain recovery message rather than incorrectly claiming there is no connection or no tracker data.

- [x] Make the pre-connection consent contract visible without starting authorization (AC: 2, 4, 5)
  - [x] Add a semantic “What you will review before connecting” panel that explicitly states that connection is not available in this story and that no Google authorization has begun.
  - [x] Describe the planned review inputs before a future explicit connection: chosen Google account; the Sheets-only permission; a user-owned tracker created by the app or a pasted spreadsheet URL/ID; target worksheet; verified edit access; and create/update behavior.
  - [x] Name the intended mirrored categories in readable language—applications, material versions, follow-ups, and interview rounds—and state that sensitive notes remain local unless Adrian later chooses to include them.
  - [x] Do not render a working Connect, Sync, Revoke, Retry, or Reconcile control. A disabled control alone is not sufficient explanation; present an honest unavailable/review-later state and keep local work reachable.

- [x] Preserve Epic 6 integration and local-authority boundaries (AC: 1-4)
  - [x] Do not add Google OAuth, a Google SDK/API client, `fetch`, a tracker adapter, an OS vault integration, tokens/credentials, migrations, repositories, Server Actions, connection/revocation persistence, actual sheet selection, schema creation, sync, retry queue, polling, timers, automatic retry, or conflict/reconciliation behavior.
  - [x] Do not expose account identifiers, spreadsheet IDs/URLs, access tokens, credential values, raw diagnostics, audit metadata, or fake remote data. Keep the actual FR-14/FR-15 work for Epic 6 Stories 6.1–6.3.
  - [x] Preserve local SQLite/application-tracker authority: Google Sheets is only a future explicit user-owned mirror; a remote result must never silently overwrite or become a second authority.

- [x] Apply polished, accessible responsive presentation (AC: 1-5)
  - [x] Extend `src/app/globals.css` minimally using the existing premium dark shell, panel/status vocabulary, visible focus treatment, readable contrast, and `overflow-wrap: anywhere`. Use the warm orange primary treatment only when a real affirmative action exists; do not imply a connection action currently works.
  - [x] Use semantic headings, labelled definition/value pairs, a persistent polite `role="status"` region only for live/action feedback, and non-color text labels for disconnected/unavailable/recovery states. Static guidance is not an artificial live announcement.
  - [x] Keep all information and route controls keyboard reachable with native controls and visible focus. At 320 CSS px / 400% zoom, connection fields and readiness/recovery cards must reflow into an ordered labelled single-column layout without hover-only information.

- [x] Add focused regression/UI-contract coverage and validate (AC: 1-5)
  - [x] Add `tests/google-sheets-workspace-ui.test.ts` covering dedicated route/shared-shell ownership, placeholder exclusion while Settings remains generic, dynamic route configuration, human disconnected values, optional local tracking, and no fabricated remote identity/outcome.
  - [x] Cover the pre-authorization review disclosure (account, least-privilege Sheets scope, target workbook/worksheet, categories, local-only notes, edit verification) and the honest future failure/recovery contract.
  - [x] Assert semantic headings/status and responsive CSS contract markers. Add static bans for `fetch(`, Google OAuth/API/SDK calls, token/credential handling, `setInterval`, `setTimeout`, polling, automatic retry/sync, and fake success claims in the Epic 0 workspace.
  - [x] Update existing shell/placeholder tests only where route ownership needs protection. Preserve Jobs, Applications, Resume, Evidence Library, Career Assistant, domain, and current generic Settings coverage.
  - [x] Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`; verify the production build contains `/google-sheets` as dynamic.

### Review Findings

- [x] [Review][Patch] Do not imply application editing currently exists [src/app/google-sheets-workspace.tsx:17]
- [x] [Review][Patch] Meet link and focus-indicator contrast requirements on light Sheets panels [src/app/globals.css:10]

## Dev Notes

### Product intent and scope

This story replaces the technical generic Google Sheets placeholder with a calm tracker workspace. It must help Adrian understand the future connection and its boundaries while being completely honest: Google Sheets has not yet been authorized, connected, or synchronized in the product.

The apparent tension in the Epic 0 acceptance criteria is deliberate. The finished UI must make the full connection/status contract understandable, but **must not simulate a live integration**. In this story, all fields render the canonical no-connection state and all failure/recovery material is educational readiness copy. Epic 6 owns real account selection, OAuth, edit-access verification, mirroring, sync outcomes, revocation, and reconciliation.

### Exact current-code context

- `src/app/application-shell.tsx` already owns the Google Sheets navigation tab, Jobs-first ordering, skip link, and active navigation semantics. Reuse it with `active="Google Sheets"`.
- `src/app/[section]/page.tsx` currently owns only a generic `google-sheets` placeholder. A dedicated static segment wins routing, but remove that segment from its placeholder/static params as Resume, Evidence, and Career Assistant did. Keep the generic Settings route.
- No Google-related domain module, adapter, migration, repository, Server Action, SDK, or package dependency currently exists. `src/app/actions.ts` has no Sheets action; do not add one or add `/google-sheets` to revalidation without a genuine mutation-backed state.
- `src/app/applications.tsx` already communicates that Sheets is optional and deliberately contains no direct Google Sheets link. Preserve that choice.
- Follow the focused server-route and source-contract-test conventions from `src/app/career-assistant/page.tsx`, `src/app/career-assistant-workspace.tsx`, `tests/career-assistant-workspace-ui.test.ts`, and the existing Applications UI tests.

### Architecture and privacy guardrails

- Google Sheets is a future **explicit, user-owned mirror**. Local application tracking remains authoritative and survives authorization, access, network, write, and reconciliation failures.
- The future design uses desktop OAuth with a loopback callback and the sole Sheets scope `https://www.googleapis.com/auth/spreadsheets`; no email, profile, or Drive scope. Tokens belong solely in the OS credential vault and must never reach UI, logs, or audits. This is architecture context only—not implementation authorization for Story 0.6.
- A future connection review must disclose selected account, sheet/worksheet, exact categories, note opt-in, create/update behavior, and edit-access verification before data transfer. Reconfirm material changes.
- Future synchronization is explicit and user-visible. It uses stable local identity/revision metadata, preserves queued local failures, and requires user-confirmed reconciliation; it never silently overwrites local or remote data or duplicates a logical record.
- Do not reveal sensitive user information or technical internals in status text. Say “Not selected” or “No sync has run,” not fake IDs, URLs, timestamped outcomes, tokens, endpoints, or diagnostic messages.

### Required UI states

| State | Required current-story rendering |
| --- | --- |
| No connection | The only live state: connection not connected; account/workbook/worksheet not selected; no permission and no sync have run. Explain local tracking remains available and optional. |
| Before connecting | A non-interactive review checklist for what a later explicit authorization will disclose. State that authorization is not available yet. |
| Future denied/expired/insufficient access | Explain that a future implementation retains local records and will offer explicit reconnection/reauthorization—do not claim this happened. |
| Future write failure/conflict | Explain that a future implementation will name affected records, preserve local values, and offer retry/reconnect/reconciliation—do not construct a fake record or conflict. |
| Read/composition failure | Preserve known values, show a safe plain-language recovery action, and never collapse uncertainty into a definite “not connected” assertion. |

### Accessibility and visual guidance

- Follow the dark premium header and shared workspace panels established in Epic 0. The connection-state summary must read well as labelled values before its detailed educational panels.
- Human copy should be direct and non-technical: for example, “No Google permission granted” and “Your local application tracking stays available.” Avoid diagnostic/admin language.
- Status must not rely on color. Use visible textual state, semantic headings, labels, and a meaningful route action. Do not announce static page content as though a sync occurred.
- The responsive record pattern must stack label/value fields at narrow widths, retain reading order, and keep recovery/help available without hover.

### Dependencies and sequence

- Depends on Story 0.1’s shared shell and navigation, Story 0.3’s local Applications workspace, and Story 0.7’s later app-wide visual polish. Stories 0.1–0.5 are available; Story 0.4 remains in review but supplies the shared Resume/Evidence visual pattern.
- Does **not** unblock or replace Epic 6. After this UI foundation, Epic 6.1 may introduce real authorization/identity; 6.2 may add idempotent mirror behavior; and 6.3 may add actual recovery/reconciliation.
- Do not alter completed backend/domain stories or broaden this story into Google integration implementation.

### Files expected to change

- New: `src/app/google-sheets/page.tsx`, `src/app/google-sheets-workspace.tsx`, and `tests/google-sheets-workspace-ui.test.ts`.
- Update: `src/app/[section]/page.tsx`, `src/app/globals.css`, and only focused shell/placeholder test files required to preserve route ownership.
- Do not change: `src/app/actions.ts`, migrations, repositories, tracker/evidence domain behavior, adapters, external integrations, Applications behavior, or package dependencies unless a genuine unrelated regression requires a minimal correction.

### Validation commands

```powershell
npm test
npm run typecheck
npm run lint
npm run build
```

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Story 0.6: Create the Google Sheets workspace`]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-Resume-2026-08-06/EXPERIENCE.md#Information Architecture`]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-Resume-2026-08-06/EXPERIENCE.md#Component Patterns`]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-Resume-2026-08-06/EXPERIENCE.md#State Patterns`]
- [Source: `_bmad-output/planning-artifacts/prds/prd-Resume-2026-08-06/prd.md#FR-14: Authorize Google Sheets`]
- [Source: `_bmad-output/planning-artifacts/prds/prd-Resume-2026-08-06/prd.md#FR-15: Synchronize tracker data`]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-Resume-2026-08-07/ARCHITECTURE-SPINE.md#AD-6 — Local-authoritative Sheets mirror`]
- [Source: `_bmad-output/implementation-artifacts/0-5-add-the-career-assistant-workspace.md#Previous-story intelligence`]
- [Google OAuth 2.0 for iOS & Desktop Apps](https://developers.google.com/identity/protocols/oauth2/native-app) (implementation research; authorization remains deferred to Epic 6)

## Dev Agent Record

### Agent Model Used

GPT-5.6

### Implementation Notes

- Added the focused Google Sheets UI contract test first and confirmed it failed before the route/workspace existed.
- Final validation passed: `npm test` (94 tests), `npm run typecheck`, `npm run lint`, and `npm run build`; the route report lists `/google-sheets` as dynamic and `/settings` as the remaining generic static destination.

### Debug Log References

- Story context compiled from Epic 0, current UX/PRD/architecture contracts, Story 0.5 review lessons, current route ownership, and Google’s current installed-app OAuth guidance.

### Completion Notes List

- Replaced the generic Google Sheets placeholder with a dedicated shared-shell workspace showing the honest disconnected state, optional local-work continuation, future consent review, and future recovery boundaries.
- Added responsive labelled connection/review layouts and source-contract regression coverage without adding a Google API, authorization flow, server action, remote call, or persistence behavior.

- Created implementation-ready context for a truthful Google Sheets workspace.
- Deliberately reserved real authorization, token storage, mirroring, and reconciliation for Epic 6.

### File List

- `src/app/google-sheets/page.tsx` (new dedicated shared-shell route)
- `src/app/google-sheets-workspace.tsx` (new local-first tracker-status workspace)
- `src/app/[section]/page.tsx` (removed Google Sheets generic-placeholder ownership)
- `src/app/globals.css` (responsive Google Sheets workspace presentation)
- `tests/google-sheets-workspace-ui.test.ts` (new UI-contract regression coverage)

- `_bmad-output/implementation-artifacts/0-6-create-the-google-sheets-workspace.md` (new story context)

## Change Log

- 2026-08-24: Implemented the dedicated Google Sheets workspace and completed the full validation gate.
- 2026-08-24: Resolved two code-review findings: truthful local-workspace copy and accessible link/focus contrast.

- 2026-08-24: Created Story 0.6 implementation context for the local-first Google Sheets workspace.

## Story Completion Status

- Status set to `done` after code review and two review patches passed the full validation gate.
