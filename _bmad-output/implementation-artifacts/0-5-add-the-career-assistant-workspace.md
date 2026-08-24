---
baseline_commit: 380c24dbc8a9b3dc6cc70a235da0888b7cb447db
---

# Story 0.5: Add the Career Assistant Workspace

Status: done

## Story

As Adrian,
I want guided help for organizing projects and evidence,
so that I can complete complex resume tasks without navigating technical workflows.

## Acceptance Criteria

1. **Given** Adrian opens Career Assistant, **when** the page loads, **then** it uses the shared shell with Career Assistant active, one logical page heading, a human explanation of the assistant’s purpose, and clear starting actions. It feels like a guided local workspace—not a chatbot, API test surface, or autonomous application agent.

2. **Given** Adrian wants to add project evidence, **when** he starts the workflow, **then** before any inspection it identifies the selected local directory, the bounded readable-Markdown file/subfolder scope and relevant metadata scope, that the source is never changed, that any local-model transfer requires the existing explicit disclosure, and that the output will be unreviewed proposals requiring individual review. Cancel changes nothing.

3. **Given** Adrian explicitly starts inspection with the required disclosure, **when** the existing local documenter returns proposal data, **then** the workspace labels every item as an unverified proposal; shows its permitted source references and unknowns without raw diagnostics; and provides individual inspect, accept, edit, reject, and cancel paths. Accepting or editing creates unreviewed evidence only; it must direct Adrian to separate Evidence Review before an item can support a resume or fit assessment.

4. **Given** Career Assistant has no selected folder, cannot inspect a folder, finds no usable evidence, is cancelled, or has partial available results, **when** that state is shown, **then** it gives a plain-language explanation and a safe next action. Existing returned proposals/local state remain available when an operation fails; the UI must not fabricate a partial result or silently discard work.

5. **Given** keyboard, screen-reader, zoom, or narrow-viewport use, **when** Adrian moves through the assistant, makes a selection, reviews proposals, or recovers from a state, **then** native labelled controls, visible focus, non-color status labels, real action feedback, readable error/recovery copy, and single-column reflow preserve every required disclosure and decision control.

6. **Given** this Career Assistant is implemented, **when** its source and behavior are inspected, **then** it introduces no watcher, timer, polling, automatic scan/retry/mutation, browser File System Access API, OAuth, remote-model/cloud fallback, application submission, automatic fact verification/approval, new migration/repository/domain command, or client-side authoritative data state. It does not expose absolute local paths, IDs, digests, prompts, raw model responses, credentials, tokens, audit payloads, or diagnostics in primary UI.

## Tasks / Subtasks

- [x] Establish a dedicated Career Assistant route and preserve route ownership (AC: 1, 5, 6)
  - [x] Add `src/app/career-assistant/page.tsx` as a server route using `ApplicationShell active="Career Assistant"`, with `export const dynamic = "force-dynamic"`, one `h1`, and a focused server-composed assistant workspace.
  - [x] Remove `career-assistant` only from `src/app/[section]/page.tsx` placeholder titles and `generateStaticParams`; retain the generic Google Sheets and Settings placeholder behavior.
  - [x] Do not change `src/app/application-shell.tsx` navigation unless a genuine regression is found: it already owns the Career Assistant destination and active navigation semantics.

- [x] Compose a guided assistant surface over existing evidence-documenter capabilities (AC: 1-4, 6)
  - [x] Add a narrow server composition component (for example `src/app/career-assistant-workspace.tsx`) that independently safe-loads only the data needed for assistant guidance, especially `listDocumenterProposals()`, and exposes only `{ summary, safeNextAction }` for a read failure. A failure in one local view must not hide another available assistant state.
  - [x] Add a focused client presentation component (for example `src/app/career-assistant.tsx`) only for local form/status interaction. It must not become a second data authority, invoke model code in the browser, or create a new action dispatcher.
  - [x] Reuse `evidenceLibraryAction`’s existing `document-for-resume` and `resolve-document-proposal` commands, `documentFolderForResume`, `resolveDocumenterProposal`, and `StoredDocumenterProposal`; do not copy their persistence, validation, audit, or proposal-decision behavior.
  - [x] Present the first-use/no-folder state with clear starts such as “Add project evidence” and “Review existing proposals,” with an honest route to `/evidence` for library-wide work. Do not imply that a directory is selected or that an inspection has occurred until Adrian explicitly submits it.

- [x] Make the explicit project-evidence workflow transparent and individually reviewable (AC: 2-4, 6)
  - [x] Before the submit control, show the selected directory value, bounded scope (readable Markdown files in the selected folder and permitted subfolders only), non-mutation guarantee, local-model disclosure, proposal-only outcome, and separate Evidence Review consequence. Use the existing plain text directory-input convention; do not add a browser directory picker or File System Access API.
  - [x] Keep the existing required `localModelDisclosure` confirmation. Explain that the selected bounded Markdown is sent only to the configured local LM Studio service, no source file is changed, and no cloud/remote fallback is available. Do not display model endpoint, model prompt, raw response, token, or credentials.
  - [x] Give actual proposal results a human “Ready for your review”/proposal label, source references and named unknowns, plus native individual accept, edit, and reject actions using the persisted expected revision ID. An accepted/edited item remains “Ready for review” evidence and must link to `/evidence#evidence-heading`; it is not verified or claim eligible yet.
  - [x] Make cancellation a client-only reset that changes no persisted data, returns focus/reading order naturally to the workflow, and reports “cancelled before inspection started” through the existing action-status pattern. Never treat cancel as a domain decision.
  - [x] Treat loading as an honest pending state (for example, “Inspecting the selected local folder…”), without timers, fabricated progress, or claims that all files were processed. If a future or existing command cannot yield an actual partial result, show failure/recovery while retaining previously returned proposals rather than inventing a partial-result record.

- [x] Preserve local-first mutation and revalidation boundaries (AC: 3, 4, 6)
  - [x] Extend the existing `revalidateCareerWorkspaces()` helper in `src/app/actions.ts` to include `/career-assistant`, so actions already reachable from this route return a fresh server render. Do not add a second Server Action or alter domain semantics.
  - [x] Preserve the established boundary: explicit native form action → existing Server Action → domain command → SQLite transaction → metadata-only append-only audit → revalidated render. Preserve idempotence, stale-decision checks, proposal validation, and source-folder non-mutation in `src/domain/evidence/evidence-documenter.ts`.
  - [x] Do not alter persistence migrations/repositories, evidence review eligibility, local model adapter transport/bounds, source adapters, Jobs/Applications behavior, Google Sheets behavior, or future Epic 4/5/6 scope.

- [x] Apply polished accessible responsive guidance without technical/admin framing (AC: 1, 5, 6)
  - [x] Extend `src/app/globals.css` minimally using the established dark premium shell, warm orange affirmative action, panel/card tokens, visible focus treatment, `overflow-wrap: anywhere`, and the existing `40rem` single-column breakpoint. Warm primary styling is only for the named forward action, never for reject/cancel/destructive choices.
  - [x] Use semantic headings and a scan-friendly order: purpose and status; guided starting action; pre-inspection disclosure; returned proposals; recovery/next action. Static disclosure must not use an artificial live region; action outcome/error feedback must use the existing `role="status" aria-live="polite"` pattern.
  - [x] Preserve native labels, associated validation errors, keyboard activation, sufficient contrast, and no hover-only or pointer-only requirement. At 320 CSS px / 400% zoom, disclosures, folder value, provenance/unknowns, and individual decisions must wrap and remain reachable.

- [x] Add focused regression/UI-contract coverage and validate (AC: 1-6)
  - [x] Add `tests/career-assistant-workspace-ui.test.ts` covering dedicated-route/shared-shell ownership, placeholder exclusion, dynamic local render, human purpose/starting actions, selected-directory scope/non-mutation/disclosure copy before inspection, proposal/unverified wording, individual action/cancel semantics, all required recovery states, and responsive/accessibility contract markers.
  - [x] Update `tests/application-shell-ui.test.ts` and/or `tests/resume-evidence-workspace-ui.test.ts` only as needed to protect the dedicated Career Assistant route while retaining the generic placeholder checks for Google Sheets and Settings.
  - [x] Extend existing focused Evidence Library/documenter UI tests only if the shared proposal component semantics intentionally change. Preserve existing domain tests for disclosure, idempotence, immutable proposals, stale decisions, unreviewed accepted evidence, and metadata-only audit behavior.
  - [x] Add static guard assertions that assistant presentation/workspace code introduces no `fetch(`, `setInterval`, `setTimeout`, `watch(`, OAuth, File System Access API, automatic scan/retry, remote/cloud fallback, sensitive model/audit output, or duplicate action/domain implementation.
  - [x] Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`. Verify `/career-assistant` is dynamic on the production build and retain the current Jobs, Applications, Resume, Evidence Library, documenter, and shell regressions.

### Review Findings

- [x] [Review][Patch] Do not echo an absolute selected local folder path in the disclosure [src/app/career-assistant.tsx:23]
- [x] [Review][Patch] Make cancellation status truthful and preserve completed/error action feedback [src/app/career-assistant.tsx:25]
- [x] [Review][Patch] Do not render a definite empty proposal state when the proposal read failed [src/app/career-assistant-workspace.tsx:9]
- [x] [Review][Patch] Keep the inline local-model disclosure checkbox normally sized [src/app/globals.css:21]
- [x] [Review][Patch] Replace mojibake characters in Assistant UI copy [src/app/career-assistant.tsx:24]
- [x] [Review][Patch] Label every proposal card explicitly as unverified [src/app/career-assistant.tsx:31]
- [x] [Review][Defer] Bound recursive Markdown traversal for arbitrary selected folders [src/files/evidence-library.ts:20] — deferred, pre-existing
- [x] [Review][Defer] Do not audit expected stale proposal decisions as documenter failures [src/app/actions.ts:211] — deferred, pre-existing

## Dev Notes

### Product intent and scope

This story makes Career Assistant a helpful, deliberate front door to the already implemented local project-evidence workflow. It must feel like a calm guide that explains what Adrian can do next, not a blank “chatbot” screen or a technical form/API console.

The assistant guides and routes. It does not autonomously inspect folders, alter sources, verify claims, approve evidence, generate application materials, submit applications, or access remote/cloud services. Its model-assisted path is explicitly local, scoped, opt-in, and proposal-only.

### Exact reuse requirements

- `src/app/application-shell.tsx` already provides the Career Assistant tab. Keep Jobs first and use `ApplicationShell active="Career Assistant"`.
- `src/app/evidence-library.tsx` and `evidenceLibraryAction` already own the explicit local documenter submission, disclosure, cancel message, proposal status, and individual persisted decision mechanics. Reuse or carefully extract that presentation behavior; do not duplicate a competing authority.
- `src/domain/evidence/evidence-documenter.ts` is the authoritative workflow: it gates on disclosure, calls bounded `enumerateMarkdown`, validates model output, stores idempotent immutable proposals, records metadata-only audit events, and converts accepted/edited proposals to **unreviewed** evidence. Do not weaken any of those checks.
- `src/adapters/evidence-documenter/lm-studio-documenter.ts` is server-only, loopback-bound, bounded, and non-retrying. Never import it into a client component or disclose its implementation details in the primary UI.
- `src/app/evidence-review.tsx` remains the canonical location for separate evidence approval. Link users to it rather than duplicating its review state machine.
- Follow Story 0.4’s dedicated-route and safe-read composition patterns in `src/app/resume/page.tsx`, `src/app/evidence/page.tsx`, `src/app/resume-workspace.tsx`, and `src/app/evidence-library-workspace.tsx`.

### Architecture and safety guardrails

- Local-first modular-monolith rule: explicit UI action → existing server action → domain command → one SQLite transaction → append-only metadata audit → revalidated render. Adapters are not authoritative.
- The selected original folder is read-only. The application may only create managed local copies through existing explicit domain behavior; do not add watching, background scans, hidden retries, or automatic evidence creation.
- Proposal content is untrusted. Never label it “verified,” “approved,” or claim eligible. Its source/unknowns and individual decision controls must remain visible at its decision point. Separate Evidence Review approval is still required.
- Failures must be bounded and truthful. Do not claim “partial” unless the command actually returned partial data. Retain prior proposals and give a safe next action instead of erasing state.
- Never surface absolute paths, source IDs, content digests, raw document bytes, prompts, raw model output, token/cost values, endpoint URLs, credentials, or audit metadata in primary UI.
- Do not introduce dependencies. This project is Next.js 16.3, React 19.2, TypeScript strict, Node test with `tsx`, and ESLint. Use the existing App Router, server action, CSS, and native form patterns.

### Route and state design

`/career-assistant` currently belongs to `src/app/[section]/page.tsx`. A static `src/app/career-assistant/page.tsx` must take precedence and the dynamic placeholder must stop generating that segment, as Resume/Evidence did in Story 0.4. Because the workspace displays mutation-backed local state, export `dynamic = "force-dynamic"`; current Next App Router documentation confirms that this makes the route render on request. [Next.js Route Segment Config](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config)

Implement these truthful states in the guidance/presentation layer:

| State | Required meaning and recovery |
|---|---|
| First use / no folder | Explain that no local folder has been selected. Offer the explicit project-evidence start and Evidence Library link. |
| Disclosure / selection | Echo the directory value supplied in the labelled field; state bounded readable Markdown and permitted subfolders, no source mutation, local-only model transfer after consent, proposal-only result. |
| Inspecting | Pending-only text; no fake percent/count, timer, background process, or automatic retry. |
| No usable evidence | Use the existing safe domain error; explain that no proposal was created and direct Adrian to review readable Markdown or try another folder. |
| Inaccessible folder | Use the safe error summary/next action from the existing action; keep existing proposals visible. |
| Cancelled | Client-side cancellation before inspection; no mutation and a clear restart path. |
| Returned / partial available results | Render only actual persisted proposals; name unknowns and individual actions. If an action fails after previous results, retain them and show an error/recovery status rather than fabricating a partial run. |

### Previous-story intelligence

Story 0.4 established the premium visual system and has completed its review fixes. Carry these lessons forward:

- Revalidate every dedicated route that renders mutation-backed local data.
- Block or invalidate acknowledgements when local state is stale/unsaved; do not make a later approval path misleading.
- Provenance and a direct review action must sit at the decision point, not behind opaque IDs.
- Independently safe-load local sections so one failure does not blank the entire workspace.
- Keyboard guidance must have accurate current state; use native interactions and no lost unsaved state.
- Explain bounded Markdown inspection and the unreviewed consequence *before* the explicit workflow begins.
- Guard contrast after global visual updates and cover meaningful UI states in source-contract tests.

### Files expected to change

- New: `src/app/career-assistant/page.tsx`, a small `src/app/career-assistant-workspace.tsx`, likely a focused client presentation component, and `tests/career-assistant-workspace-ui.test.ts`.
- Update: `src/app/[section]/page.tsx`, `src/app/actions.ts` (only the existing revalidation helper), `src/app/globals.css` (minimal assistant/responsive styling), and only focused existing shell/evidence UI tests required by route or shared presentation changes.
- Do not change: database migrations/repositories, evidence-documenter/evidence domain semantics, audit shape, local model adapter, source discovery, Google Sheets, or future material/application features.

### Validation commands

```powershell
npm test
npm run typecheck
npm run lint
npm run build
```

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Story 0.5: Add the Career Assistant workspace`]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-Resume-2026-08-06/EXPERIENCE.md#Application shell`]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-Resume-2026-08-06/EXPERIENCE.md#Information Architecture`]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-Resume-2026-08-06/EXPERIENCE.md#Component Patterns`]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-Resume-2026-08-07/ARCHITECTURE-SPINE.md#Architecture Decisions`]
- [Source: `_bmad-output/implementation-artifacts/0-4-create-the-resume-and-evidence-library-workspace.md#Prior-story and review lessons`]
- [Source: `src/app/evidence-library.tsx`, `src/app/actions.ts`, `src/domain/evidence/evidence-documenter.ts`, `src/app/evidence-library-workspace.tsx`]

## Dev Agent Record

### Agent Model Used

GPT-5.6

### Debug Log References

- Comprehensive context analysis completed across Epic 0, UX, PRD/architecture constraints, Story 0.4 review lessons, current evidence-documenter implementation, tests, and Next.js route guidance.
- Added source-contract tests first; all four failed until the dedicated route and guided Assistant composition existed.
- Final validation passed: `npm test` (90 tests), `npm run typecheck`, `npm run lint`, and `npm run build`.
- Code-review patches passed the full quality gate again: `npm test` (90 tests), `npm run typecheck`, `npm run lint`, and `npm run build`.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Scope is deliberately limited to guided Career Assistant route/composition and reuse of the existing local proposal workflow; no new AI, persistence, or evidence-domain behavior is authorized.
- Added a dedicated dynamic Career Assistant route with transparent scoped local-model disclosure, proposal-only individual decisions, cancellation, recovery guidance, and Evidence Review handoff.
- Extended the existing career-workspace revalidation helper so proposal actions refresh the Assistant route without a second action dispatcher.
- Review hardening now masks a selected folder to its name, keeps action errors truthful after cancellation, distinguishes proposal-read failure from an empty queue, and labels each proposal as unverified.

### File List

- `_bmad-output/implementation-artifacts/0-5-add-the-career-assistant-workspace.md` (new story context)
- `src/app/career-assistant/page.tsx` (new dedicated shared-shell route)
- `src/app/career-assistant-workspace.tsx` (new safe server composition)
- `src/app/career-assistant.tsx` (new guided local proposal workflow)
- `src/app/[section]/page.tsx` (modified placeholder route ownership)
- `src/app/actions.ts` (modified Career Assistant revalidation)
- `src/app/globals.css` (modified responsive Assistant presentation)
- `tests/career-assistant-workspace-ui.test.ts` (new UI-contract coverage)
- `tests/application-shell-ui.test.ts` (modified checkbox styling regression assertion)

## Change Log

- 2026-08-24: Created Story 0.5 implementation context for the local-first Career Assistant workspace.
- 2026-08-24: Implemented the dedicated guided Career Assistant workspace and completed its full validation gate.
- 2026-08-24: Addressed six Story 0.5 code-review findings; two pre-existing evidence-documenter safeguards were deferred.

## Story Completion Status

- Status set to `done` after code review.
