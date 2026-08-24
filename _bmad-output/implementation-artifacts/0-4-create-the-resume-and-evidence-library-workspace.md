---
baseline_commit: 380c24dbc8a9b3dc6cc70a235da0888b7cb447db
---

# Story 0.4: Create the Resume and Evidence Library Workspace

Status: done

## Story

As Adrian,
I want a clear place to manage my resume and supporting evidence,
so that I can strengthen my materials without losing provenance.

## Acceptance Criteria

1. Given Adrian opens Resume, when the page loads, then Current Base Resume, editable resume drafts/versions, and tailored materials are clearly separated. Tailored materials are truthfully marked unavailable until Epic 4 supplies them; no draft, version, export, or history may be fabricated.
2. Given Adrian opens Evidence Library, when the page loads, then approved, ready-for-review (unreviewed), not-using (rejected), and removed evidence states are understandable in plain language without database/revision terminology as the primary explanation. The underlying state and claim-eligibility behavior remain unchanged.
3. Given Adrian starts Add Project, Add Experience, Refresh Library, or optional Document for Resume, when the workflow begins, then it explains the bounded Markdown inspection, that selected source material stays unchanged and managed copies are local, and that resulting evidence is proposed/unreviewed pending individual review. No watcher, background scan, automatic retry, or network retrieval is introduced.
4. Given evidence or a Current Base Resume change is proposed or reviewed, when Adrian decides, then source document/section, extracted versus user-entered origin, proposal unknowns where applicable, and individual approve/edit/reject/remove actions remain visible at the decision point. Accepted/edited documenter output remains unreviewed until separately approved.
5. Given keyboard, screen-reader, zoom, or narrow-viewport use, when Adrian moves between Resume and Evidence Library, reviews data, or starts an explicit action, then both dedicated routes retain the shared shell, a single logical page heading, native labelled controls, visible focus, readable status/recovery, and reflow without hiding essential content.
6. Given Adrian uses the Resume workspace, when he progresses through resume sections or reviews a proposed change, then a labelled guided stepper, evidence/skill chips, and revision-aware local editor-and-preview composition make the current section, support, warnings, and next action visible without hiding provenance or individual review controls.
7. Given the Resume workspace is narrow or its preview cannot safely render, when Adrian reviews it, then an in-flow named review summary/warning count and labelled jumps reach Editor, Preview, Warnings, and Provenance before the workspace stacks; a safe local text/failure view preserves edits, never executes document content or loads remote assets, and never uses silent AI/cloud fallback.

## Tasks / Subtasks

- [x] Create dedicated Resume and Evidence Library routes and remove their placeholder collisions (AC: 1, 2, 5)
  - [x] Add `src/app/resume/page.tsx` and `src/app/evidence/page.tsx`, each using `ApplicationShell` with the correct active destination and a single `h1`.
  - [x] Add server-composed workspace components (for example `resume-workspace.tsx` and `evidence-library-workspace.tsx`) that load existing domain views and safely isolate read errors as `{ summary, safeNextAction }`; do not add a client-side data authority.
  - [x] Exclude `/resume` and `/evidence` from `src/app/[section]/page.tsx` titles and `generateStaticParams`, while retaining valid generic placeholders for the remaining destinations.
  - [x] Remove the full Resume & Evidence workflow from `src/app/page.tsx` only after the equivalent controls are reachable from the dedicated routes. Keep Jobs focused on listings and secondary setup; do not duplicate active forms across routes.

- [x] Build the Resume workspace around existing immutable/source and editable concepts (AC: 1, 4, 5)
  - [x] Reuse `CurrentBaseResume`, `BaseResumeImporter`/legacy history, and their existing server-side list commands. Clearly distinguish: retained source PDF/history, Current Base Resume editable structured draft and approved versions, and future Tailored Materials.
  - [x] Preserve the established fact that editing a draft never overwrites its source PDF and that legacy Base Resume imports are retained history—not the active editable Current Base Resume.
  - [x] Show tailored materials as a calm, truthful unavailable state with a human explanation and no invented Material Version/export control. Do not implement Epic 4 drafting, rendering, AI, or export behavior.
  - [x] Keep evidence-backed Current Base Resume proposals individually actionable and visibly separate from version approval. Do not bypass explicit approval, optimistic revision checks, or provenance links.

- [x] Build the Evidence Library workspace with human states and explicit local workflows (AC: 2, 3, 4, 5)
  - [x] Reuse `EvidenceLibrary`, `EvidenceReview`, `listEvidenceLibrary`, `listStoredEvidence`, and documenter proposal listing/actions. Do not add migrations, repositories, duplicate evidence objects, or new action dispatchers.
  - [x] Add a concise lifecycle legend/labels translating the visible states: `unreviewed` → `Ready for review`; `approved` → `Approved`; `rejected` → `Not using`; `removed` → `Removed`. Preserve the underlying states and make clear only approved evidence can support future materials.
  - [x] Ensure Add Project, Add Experience, Refresh Library, and optional Document for Resume keep explicit, labelled, keyboard-native controls and explain: inspected content is bounded Markdown; selected folders/files are never changed; managed copies stay local; results require individual review. Document for Resume must preserve its disclosure confirmation, cancellation without mutation, proposal-only outcome, and individual accept/edit/reject choices.
  - [x] At every evidence/proposal decision, preserve source document/section, origin, and appropriate proposal source/unknown information with the individual review controls. Keep source paths, IDs, digests, parser/model diagnostics, prompts, raw response, credentials, and audit metadata out of the primary UI.

- [x] Apply visual, responsive, and accessibility polish without changing domain behavior (AC: 1-5)
  - [x] Extend `src/app/globals.css` minimally using the existing token system and single-column inspection patterns. Use scan-friendly cards/panels, `overflow-wrap: anywhere`, and responsive stacking at the established 40rem breakpoint.
  - [x] Preserve native form labels, `aria-invalid`/`aria-describedby` error associations, visible focus, non-color lifecycle text, and existing `role="status" aria-live="polite"` action feedback. Static explanatory content must not generate artificial live announcements.
  - [x] Keep technical provenance available only at the review point or behind progressive disclosure; never show absolute local paths, raw document bytes, content digests, credentials, tokens, or raw diagnostics.

- [x] Add the approved CV Builder-inspired Resume review patterns without changing domain behavior (AC: 6, 7)
  - [x] Add a labelled native guided stepper with a linear keyboard path that never discards unsaved edits, plus evidence/skill chips that retain their source, lifecycle state, and individual review action.
  - [x] Compose the current editable Resume view with a read-only, local revision-aware preview on wide screens. Mark stale or unsaved preview state clearly and invalidate acknowledgement when the reviewed revision changes; do not create export/approval capability ahead of Epic 4.
  - [x] On narrow layouts, put a named review summary/warning count before editing and add labelled jumps to Editor, Preview, Warnings, and Provenance. Stack the editor and preview without a sticky element covering focus.
  - [x] Treat preview rendering as local, non-executing, and non-authoritative: no scripts, remote assets, telemetry, folder scan, or AI/cloud fallback. Preserve edits and show a safe text/failure view when rendering is unavailable.

- [x] Add focused regression/UI-contract tests and validate (AC: 1-7)
  - [x] Add route/workspace tests (for example `tests/resume-evidence-workspace-ui.test.ts`) asserting dedicated shared-shell routes, placeholder exclusion, Jobs-first relocation, separation of Resume sections, truthful tailored-material state, human evidence lifecycle language, decision-point source/action requirements, and the explicit local workflow boundaries.
  - [x] Update `tests/application-shell-ui.test.ts` to stop requiring Resume/Evidence generic-placeholder behavior and to protect the new dedicated routes; extend existing evidence/current-resume UI tests for any updated copy or semantics.
  - [x] Assert no new watcher, timer, polling, fetch/network, OAuth, automatic mutation, Material Version implementation, or sensitive-value rendering is introduced by this story; cover preview stale/failure state, keyboard stepper flow, and narrow review navigation.
  - [x] Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`; preserve completed Jobs, Applications, existing evidence, current-base-resume, source-refresh, and shell regression behavior.

### Review Findings

- [x] [Review][Patch] Revalidate the dedicated Resume and Evidence routes after mutations [src/app/actions.ts:138]
- [x] [Review][Patch] Invalidate or block version approval while the local Resume preview has unsaved edits [src/app/current-base-resume.tsx:34]
- [x] [Review][Patch] Show source document, section, origin, and a review action with Resume proposal evidence chips [src/app/current-base-resume.tsx:37]
- [x] [Review][Patch] Isolate Resume and Evidence Library read failures so one unavailable local view does not hide the rest [src/app/resume-workspace.tsx:7]
- [x] [Review][Patch] Make guided Resume steps keyboard-operable and keep the current step accurate [src/app/resume-workspace.tsx:24]
- [x] [Review][Patch] Use human lifecycle labels in each Evidence Review decision row, not raw persisted state names [src/app/evidence-review.tsx:13]
- [x] [Review][Patch] Explain bounded local Markdown inspection and the unreviewed proposal outcome before every explicit evidence workflow [src/app/evidence-library.tsx:12]
- [x] [Review][Patch] Restore readable selected Fit-filter text after the global warm-button visual update [src/app/globals.css:63]
- [x] [Review][Patch] Add visible keyboard focus for form inputs, textareas, and selects [src/app/globals.css:30]
- [x] [Review][Patch] Keep Resume jump targets clear of the sticky header [src/app/current-base-resume.tsx:34]
- [x] [Review][Patch] Replace Base Resume selector IDs with human-readable source labels [src/app/evidence-review.tsx:11]
- [x] [Review][Patch] Keep evidence revision IDs out of primary Resume version history [src/app/current-base-resume.tsx:45]
- [x] [Review][Patch] Link evidence chips to their individual Evidence Review decision row [src/app/current-base-resume.tsx:41]
- [x] [Review][Patch] Hide documenter source paths and translate raw proposal states [src/app/evidence-library.tsx:22]
- [x] [Review][Patch] Explain the Add Experience source-file/local-copy boundary before submission [src/app/evidence-library.tsx:17]

## Dev Notes

### Product intent and scope

Story 0.4 makes Resume and Evidence Library intentional product destinations rather than technical-looking controls embedded in the Jobs page or generic placeholders. It is a presentation/routing composition over completed Epic 1 capabilities—not a new evidence, resume, AI, drafting, Material Version, or storage-domain implementation.

The approved visual update adds a guided, CV Builder-inspired review surface: dark shared shell, accessible warm affirmative actions, Resume stepper, evidence/skill chips, and a responsive local editor-and-preview composition. This is still presentation work; it must not change the existing command, persistence, provenance, local-first, or explicit-consent boundaries.

### Exact existing capabilities to reuse

- `src/app/current-base-resume.tsx` + `listCurrentBaseResume()` already provide text-readable PDF import, an editable structured draft, evidence-backed proposed changes, individual proposal resolution, explicit version approval, and retained versions.
- `src/app/evidence-library.tsx` + `listEvidenceLibrary()` already provide explicit Add Project, Add Experience, Refresh Library, Document for Resume, managed inventory, and documenter-proposal review.
- `src/app/evidence-review.tsx` + `listStoredEvidence()` already provide extracted/user-entered origin, source document/section, immutable evidence revisions, and individual Edit/Approve/Reject/Remove controls.
- `src/app/base-resume-importer.tsx` + `listStoredBaseResumes()` provide retained legacy immutable import/history. It must remain visually distinct from Current Base Resume.
- Preserve current Server Actions and mutation boundary: explicit UI action → domain command → one SQLite transaction → metadata-only append-only audit → revalidated render. Do not duplicate action dispatch, repositories, migrations, or client-side authoritative state.

### Route and composition plan

`/resume` and `/evidence` currently resolve via `src/app/[section]/page.tsx`; their actual working panels live under the Jobs home in `src/app/page.tsx`. Add dedicated static routes, remove only those destination entries from the dynamic placeholder's title/parameter set, and relocate composition rather than render the same mutation forms twice. A dedicated static `app/<segment>/page.tsx` is the correct simple App Router route convention. [Next.js App Router pages and layouts](https://nextjs.org/docs/app/getting-started)

The new server composition should retain the Jobs page's existing safe-read pattern: load domain views independently, catch a typed workspace error, and pass only `summary` plus `safeNextAction` to its panel. A failure in one Resume/Evidence section must not hide available local data in another section.

### UX / truthfulness rules

- Resume hierarchy: Current Base Resume first; then editable draft/retained approved versions; then Tailored Materials as an honest unavailable state until Epic 4. Never imply a source PDF is edited in place or that material versions already exist.
- Evidence hierarchy: managed-library action/inventory, review queue/lifecycle explanation, and Document for Resume proposals. Use human lifecycle labels, but retain the source, origin, state, and individual controls necessary to make an informed decision.
- Selected project/experience folders are read-only input. The application copies permitted Markdown into its managed local library only after an explicit action; it never watches the folder, scans automatically, or changes source files.
- Documenter output is untrusted. Accepting or editing a proposal produces unreviewed evidence only; it must still be separately approved before it is claim eligible.
- Never make hiring/ATS promises, fabricate evidence/materials, introduce background processing, or expose sensitive local paths/diagnostics.

### Accessibility and responsive requirements

Use `ApplicationShell`, one route `h1`, semantically nested sections, native labelled forms/buttons/links, visible existing focus rings, and non-color-only labels. Preserve `role="status"`/`aria-live="polite"` for actual action outcomes and error recovery. At 40rem/narrow/200% zoom, show a readable single-column inspection path; long source descriptions wrap rather than overflow and no required review control becomes hover-only. At narrow/320 CSS px/400% zoom, ensure the review summary precedes the editor and labelled navigation reaches preview, warnings, and provenance; preview failure cannot lose unsaved work.

### Prior-story and review lessons

- Story 0.1: preserve the shared shell and Jobs-first primary navigation; technical details must not dominate.
- Story 0.2: error state takes precedence over empty state once data is loaded; protect long-value reflow and meaningful UI state variants in tests.
- Story 0.3: static route pages must be excluded from dynamic-placeholder params; static foundation copy must be truthful; UI-contract tests should defend route ownership and no premature integrations.

### Files expected to change

- New: `src/app/resume/page.tsx`, `src/app/evidence/page.tsx`, server-composed workspace components, `tests/resume-evidence-workspace-ui.test.ts`.
- Update: `src/app/page.tsx`, `src/app/[section]/page.tsx`, `src/app/globals.css`, `tests/application-shell-ui.test.ts`, and only the existing focused UI tests whose copy/semantics are intentionally updated.
- Do not change: persistence migrations/repositories, evidence/current-resume domain semantics, audit payload shape, source adapter behavior, Google integration, or Epic 4 material-generation/export modules.

### References

- `_bmad-output/planning-artifacts/epics.md` — Story 0.4 acceptance criteria.
- `_bmad-output/planning-artifacts/ux-designs/ux-Resume-2026-08-06/DESIGN.md` and `EXPERIENCE.md` — polished career workspace, component, local-first, responsive and accessibility rules.
- `_bmad-output/planning-artifacts/prds/prd-Resume-2026-08-06/prd.md` — FR-1/FR-2, provenance, local evidence and accessibility requirements.
- `_bmad-output/planning-artifacts/architecture/architecture-Resume-2026-08-07/ARCHITECTURE-SPINE.md` — completed Epic 1 architecture, local-only/domain/audit invariants.
- `src/app/page.tsx`, `src/app/[section]/page.tsx`, `src/app/evidence-library.tsx`, `src/app/evidence-review.tsx`, `src/app/current-base-resume.tsx`, and their existing tests — concrete reuse patterns.

## Dev Agent Record

### Debug Log

- Added UI-contract coverage first; it failed until the guided Resume stepper, local preview, review jumps, and responsive styles were implemented.
- Updated the existing shell focus-token assertion after applying the approved dark-header/warm-primary visual system.
- `npm test` passed: 86 tests.
- `npm run typecheck`, `npm run lint`, and `npm run build` passed.
- Addressed all eight review findings, including route revalidation, approval invalidation, provenance links, isolated read errors, keyboard step navigation, plain-language lifecycle labels, explicit Markdown workflow boundaries, and Fit-filter contrast.
- Final validation passed: `npm test` (86 tests), `npm run typecheck`, `npm run lint`, and `npm run build`.

### Completion Notes

- Dedicated Resume and Evidence routes compose existing server-side domain views without creating a client-side data authority.
- Resume now has guided steps, evidence/skill chips, a revision-aware local text preview, clear unsaved-preview state, review-summary/warning links, and responsive editor/preview stacking.
- The shared CSS now applies the dark premium header and accessible warm primary actions across the workspace while preserving existing action semantics.
- No watcher, network retrieval, OAuth, automatic mutation, material export, remote rendering, or cloud/AI fallback was introduced.
- Resume proposal chips now link to the individual Evidence Review decision, retaining source document/section and origin at the decision point.

## File List

- `src/app/resume/page.tsx` (new, dedicated Resume route)
- `src/app/evidence/page.tsx` (new, dedicated Evidence Library route)
- `src/app/resume-workspace.tsx` (modified, guided Resume workspace)
- `src/app/resume-stepper.tsx` (new, keyboard-operable current-step navigation)
- `src/app/evidence-library-workspace.tsx` (new, safe Evidence Library composition)
- `src/app/current-base-resume.tsx` (modified, local editor/preview and review controls)
- `src/app/[section]/page.tsx` (modified, route ownership)
- `src/app/page.tsx` (modified, Jobs-first relocation)
- `src/app/globals.css` (modified, visual system and responsive Resume layout)
- `tests/resume-evidence-workspace-ui.test.ts` (modified, workspace and local-preview contract)
- `tests/application-shell-ui.test.ts` (modified, premium-shell token contract)
- `tests/current-base-resume.test.ts` (modified, dedicated Resume composition assertions)
- `tests/base-resume-ui.test.ts` (modified, dedicated Resume composition assertions)

## Change Log

- 2026-08-24: Completed dedicated Resume and Evidence Library workspaces, including the approved CV Builder-inspired guided local Resume review experience; validated with tests, typecheck, lint, and production build.
- 2026-08-24: Addressed every Story 0.4 code-review finding and revalidated the full application quality gate.

## Story Completion Status

- Ultimate context engine analysis completed: UX, PRD, architecture, current Epic 1 implementation, Story 0.1–0.3 lessons, and current App Router guidance were evaluated.
- Scope is intentionally limited to dedicated UI composition and human-oriented presentation; existing evidence/resume domain and later material-generation work remain intact.
- Status set to `ready-for-dev`.
