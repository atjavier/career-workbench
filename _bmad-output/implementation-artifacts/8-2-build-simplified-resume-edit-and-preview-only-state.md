---
baseline_commit: b2bb2a3475d68e20e1a6af42ea2324fe347df115
---

# Story 8.2: Build simplified Resume Edit and preview-only state

Status: done

## Story

As Adrian,
I want a compact Resume page,
so that I can manage my profile and inspect the visual template without developer-facing controls.

## Acceptance Criteria

1. **Compact profile-led Resume Edit**
   - Given I open **Resume > Edit** before a resume has been generated, when the page loads, then it shows only Profile details and the Resume Coach availability/consent state. The designated `Resume.pdf` remains private format memory for future generation and is not previewed or linked from this state.
   - The profile form includes First Name, optional Middle Name, Last Name, email, phone number, school, degree/program, expected or graduation year, optional GWA, optional Latin honors, optional LinkedIn URL, and optional GitHub URL. Labels remain visible; optional fields are not shown as defects.
   - **Save details** calls the Story 8.1 append-only Candidate Profile command with the selected profile identity and current selection revision for CAS. A successful save appends a new revision and reports **Details saved**. Invalid/stale saves create no revision, keep submitted form values, show a focusable error summary before the form with field-associated plain-language errors, and expose no revision IDs, digests, audit terms, or storage details.
   - Education inputs retain visible labels and their current validation/accessibility behavior. Before a valid save, the status is **Save details to generate**.

2. **Truthful pre-generation Coach state**
   - Given no LocalModelGateway/configuration/consent request exists in this story, when I view Resume Edit, then the Coach surface says: “Local AI is not ready. You can still save your profile details.” and offers exactly one recovery action: **Set up local AI** to `/settings`.
   - Profile save remains usable while local AI is unavailable. The page contains no template preview, prompt input, chat transcript, model request, consent fingerprint, selected-material/opportunity state, proposal, retry, material draft/handoff, renderer, export, cloud/substitute generation, endpoint/token/model diagnostics, or implied data transfer.

3. **Protected Resume.pdf template memory**
   - Given the bundled template is designated, when I open Resume Edit before generation, then the UI does not render an iframe, template preview, or download link. The application retains only the verified private template snapshot for future AI generation.
   - The template is a fixed format reference, never an editable profile preview, a generated draft, or a claim of layout fidelity. No client-supplied template ID, path, source URL, or legacy Current Base Resume PDF is used.
   - A future generated resume PDF—not the template—will be the previewed output. The pre-generation UI never exposes template paths/digests or silently substitutes a legacy/current-base-resume source.

4. **Legacy-editor removal and responsive accessibility**
   - The active `/resume` experience removes manual resume-section textareas, review/warnings/proposed-change cards, Evidence and Skills cards/chips, current-base-resume importer/history/approval controls, direct evidence-update actions, version/export controls, raw internal identifiers, source counts, audit language, and technical diagnostics.
   - Legacy `current_base_resume_*` tables/files/read/PDF routes and history-only write guard remain untouched; only the active Resume composition stops rendering their UI. **Experience & Projects** remains a distinct, reachable Resume mini-tab/source area and is not duplicated in Edit.
   - On desktop, the unavailable Coach occupies a clearly labelled left pane and Profile occupies the right pane. At 320 CSS px and 400% zoom, the order is Coach/unavailable state then Profile; fields are one column, actions remain visible and keyboard reachable, and focus indicators remain visible.

## Tasks / Subtasks

- [x] Replace the active Resume composition with Profile-led data (AC: 1, 2, 3, 4)
  - [x] In `src/app/resume-workspace.tsx`, replace Current Base Resume/base-resume/evidence loading, review band, history/importer, and manual-editor composition with `readCandidateProfileState()` and a purpose-named Profile-led Resume Edit surface.
  - [x] Do not render `CurrentBaseResume`, `BaseResumeImporter`, legacy PDF URLs, current-base-resume source/draft/proposal/version data, or evidence lists from `/resume`.
  - [x] Keep the page dynamic and preserve the shared `ApplicationShell`. Turn the disabled **Experience & Projects — Coming soon** control into an explicit, truthful path to the existing evidence workspace; do not duplicate that workspace inside Edit.
  - [x] Do not fetch PDF bytes in the Server Component. Consume the fixed route only through the preview iframe/fallback; its existing route owns explicit bootstrap, verified-byte delivery, and safe 404 behavior.

- [x] Add the narrow Profile form action and client form (AC: 1, 4)
  - [x] Add `saveCandidateProfileAction` in `src/app/actions.ts` using the existing action-state convention. Adapt `FormData` 1:1 to `CandidateProfileInput`, pass `profileId` and `expectedStateRevisionNumber`, call `saveCandidateProfile`, normalize `WorkspaceError` through `toSafeWorkspaceError`, and `revalidatePath("/resume")` on success.
  - [x] Create a purpose-named client component (for example `src/app/resume-profile-form.tsx`) that uses React `useActionState`, preserves submitted values on failure, disables only duplicate save while pending, and renders the saved/not-saved status without implementation identifiers.
  - [x] Render semantic labels, required indicators, and the compact desktop grid / narrow single-column order. Associate server field errors with controls via `aria-invalid` and `aria-describedby`; focus the error summary or first invalid control after an invalid submission.
  - [x] Keep Story 8.1 domain/repository/migration logic as the authority. Do not add a schema change, profile-update path, or client-side UUID/digest/CAS logic.

- [x] Build the pre-generation Coach state and retain template memory (AC: 2, 3, 4)
  - [x] Create focused components or clearly bounded markup for the Profile & Resume Coach pane. Keep the designated template private for future generation without rendering a template pane. Use user-facing terms only: no internal IDs, schema/state names, audit records, filenames, diagnostics, or model configuration values.
  - [x] For this story, render only the truthful unavailable Coach message and one `/settings` recovery link. Do not reuse the Evidence Documenter as a Coach, call fetch, add any LocalModelGateway/configuration/consent behavior, or create material records.
  - [x] Do not render `/api/resume-template/pdf`, an iframe, or a template download link before a resume has been generated. Retain the identifier-free verified template route and immutable snapshots for future AI generation; never fall back to `/api/current-base-resume/.../pdf`.

- [x] Align the visual system and responsive behavior (AC: 1, 4)
  - [x] Modify `src/app/globals.css` to replace the active manual-editor surface with the approved muted-forest visual system: wide balanced split, raised white workspace card, soft preview backing/paper, restrained shadow, compact field grid, forest primary action, and existing visible focus token.
  - [x] Preserve the shared shell’s 31 px page-title scale, 24 px desktop / 16 px phone gutters, 15 px workspace text scale, existing color tokens, and single-column reflow at the established narrow breakpoint. Remove only styles that are active solely for retired Resume Edit cards; do not disrupt retained legacy route/test presentation outside `/resume`.

- [x] Add focused regression coverage and validate (AC: 1, 2, 3, 4)
  - [x] Add `tests/resume-profile-ui.test.ts` (or an equivalently focused test) for fields, optional values, saved/not-saved state, server-action error mapping, linked error summary, stale-save recovery, and absence of developer-facing/legacy manual-editor controls.
  - [x] Assert the unavailable Coach shows only the Settings recovery path and introduces no local-model/network/request/draft behavior.
  - [x] Assert the template iframe and visible fallback use the fixed no-identifier `/api/resume-template/pdf` route; no legacy PDF path, filesystem path, digest, or automatic legacy fallback appears. Preserve route header/verified-byte tests in `tests/resume-profile-template.test.ts`.
  - [x] Update only obsolete Resume UI expectations in `tests/resume-evidence-workspace-ui.test.ts`, `tests/current-base-resume.test.ts`, `tests/shared-visual-polish-ui.test.ts`, and any directly related UI suite. Keep legacy persistence/history/PDF compatibility tests intact.
  - [x] Include source-level accessibility/reflow assertions for labels, error association, live status, visible fallback, desktop split, and narrow single-column layout. Run `npx tsc --noEmit`, `npm test`, `npm run lint`, `npm run build`, and `git diff --check` before moving the story to review.

## Dev Notes

### Source of truth and scope boundary

- The Profile-led Resume contract in AD-13/AD-14 supersedes all earlier Resume Edit rules and mock details that show manual textareas, current-base-resume approval, live generated preview, warning counts, evidence cards, version controls, or proposal decisions. Story 8.2 keeps a compact profile and unavailable Coach state; the immutable template is retained as private future-AI format memory, while generated resume PDFs become the previewed output in later work. [Source: user-approved review decision, 2026-08-25]
- This is deliberately pre-Coach UI. Local model configuration/readiness probing, consent disclosure/fingerprint, selected reviewed evidence/opportunity, prompt/chat, one loopback request, response/proposal, material draft, handoff, review, renderer, and export belong to Stories 8.3–8.4. A static unavailable state is truthful; do not emulate it through the separate Evidence Documenter integration. [Source: _bmad-output/planning-artifacts/epics.md#Story 8.3; _bmad-output/specs/spec-profile-led-resume-generation/local-model-contract.md#Preconditions]
- Do not change `0021_resume_profile_materials.sql`, Profile/Template repositories, file helpers, bootstrap transaction, or the template PDF route unless a real UI integration defect proves it necessary. Story 8.1 review hardened symlink containment, concurrent bootstrap, legacy backfill, evidence/provenance guards, singleton protection, and selected-revision reads; retain all those invariants. [Source: _bmad-output/implementation-artifacts/8-1-version-candidate-profile-and-designate-resume-template.md#Review Findings]

### Existing implementation to reuse

- `readCandidateProfileState()` reads exactly the revision selected by `resume_generation_state`, not merely the latest revision. `saveCandidateProfile()` validates required values, creates a linear immutable revision, performs state CAS, and writes only metadata audit. The UI must pass hidden state/profile values only for the server action’s concurrency boundary; it must never render those values. [Source: src/domain/resume-generation/candidate-profile-commands.ts; src/persistence/candidate-profile-repository.ts]
- The identifier-free template route explicitly bootstraps `Resume.pdf`, verifies the designated bundled private copy on every delivery, sends inline/no-store/same-origin headers, and responds with a safe 404 on failure. Resume Edit must not render or link it before generation; future AI generation consumes the immutable designated snapshot without client-supplied ID/path/query data. [Source: src/app/api/resume-template/pdf/route.ts; src/domain/resume-generation/resume-template-commands.ts]
- Current `/resume` still composes `CurrentBaseResume`, `BaseResumeImporter`, legacy source/draft/proposal/version state, and evidence. This is the active obsolete surface to replace. Leave `src/app/current-base-resume.tsx`, `src/domain/current-base-resume/*`, and `/api/current-base-resume/[sourceId]/pdf` available only as history compatibility seams, never referenced by the new page. [Source: src/app/resume-workspace.tsx; _bmad-output/specs/spec-profile-led-resume-generation/data-contract.md#Legacy compatibility]
- Follow the existing client-form/action pattern: Server Actions are invoked through HTML forms and `useActionState`, receive prior state as their first argument, and return safe expected errors rather than throwing presentation details. Treat the action as reachable server-side, validate all values within the domain command, and use `revalidatePath` for read-your-own-write UI. [Source: node_modules/next/dist/docs/01-app/02-guides/forms.md; node_modules/next/dist/docs/01-app/02-guides/data-security.md; src/app/actions.ts]

### UX and accessibility guardrails

- Keep only user-relevant content in Edit. No developer-facing technical terms, raw model/endpoint details, audit/provenance internals, record IDs, source count, imports/history, text-based manual editing, evidence/skills, warnings, approvals, versions, export, or fake readiness. The immutable PDF is a style/reference, not a generated resume. [Source: _bmad-output/planning-artifacts/ux-designs/ux-Resume-2026-08-06/EXPERIENCE.md#Resume Edit behavior]
- The profile fields are compact and visibly labelled. Optional values are absent by default rather than errors. Put the error summary before the form and give it a focus target. Use field-level plain-language errors with programmatic association; do not expose raw domain error codes. [Source: _bmad-output/specs/spec-profile-led-resume-generation/data-contract.md#Profile validation; _bmad-output/planning-artifacts/ux-designs/ux-Resume-2026-08-06/EXPERIENCE.md#Validation resolutions]
- Before generation, no template helper, iframe, fallback, or template action is rendered. At 320 CSS px/400% zoom, the semantic/visual sequence is Profile → unavailable Coach; do not clip actions or hide focus. [Source: user-approved review decision, 2026-08-25]

### Project structure and regression boundaries

```text
MODIFY src/app/resume-workspace.tsx
NEW    src/app/resume-profile-form.tsx (or equivalently purpose-named Profile-led form)
MODIFY src/app/actions.ts
MODIFY src/app/globals.css
NEW    tests/resume-profile-ui.test.ts (or equivalently focused UI/action test)
MODIFY focused Resume UI test assertions only

PRESERVE src/domain/resume-generation/*
PRESERVE src/persistence/migrations/0021_resume_profile_materials.sql
PRESERVE src/files/resume-template.ts
PRESERVE src/app/api/resume-template/pdf/route.ts
PRESERVE current-base-resume persistence/files/read/PDF compatibility paths
```

- Use Node.js `>=24.18.0`, Next.js `16.3.0`, React `19.2.3`, TypeScript, the built-in Node test runner, and existing CSS—do not add packages, an ORM, or client-side PDF/model libraries. [Source: package.json; _bmad-output/planning-artifacts/architecture/architecture-Resume-2026-08-07/ARCHITECTURE-SPINE.md#Stack]
- Existing tests that name legacy UI strings become invalid only where they inspect the active Resume page. Keep their persistence, history-only write, verified legacy PDF, migration, template-byte, and UI-shell assertions that remain true. [Source: tests/current-base-resume.test.ts; tests/resume-profile-template.test.ts; tests/resume-evidence-workspace-ui.test.ts]

### Previous-story intelligence

- Story 8.1 completed with 115 passing tests. It proved migration safety and template bootstrap/idempotence, then resolved eight adversarial review findings: symlink-safe staging, concurrent bootstrap convergence, legacy rows with generated UUIDv7 candidates, approved-evidence/provenance guards, singleton delete protection, phone validation, and selected revision reads. Build on these boundaries rather than reimplementing them. [Source: _bmad-output/implementation-artifacts/8-1-version-candidate-profile-and-designate-resume-template.md#Completion Notes List]
- The working tree contains Story 8.1 changes not represented by the most recent commit. Treat the files and tests in the current workspace as the baseline; do not revert, delete, or fold unrelated dirty work into this story. [Source: git status; _bmad-output/implementation-artifacts/8-1-version-candidate-profile-and-designate-resume-template.md#File List]

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 8]
- [Source: _bmad-output/specs/spec-profile-led-resume-generation/SPEC.md]
- [Source: _bmad-output/specs/spec-profile-led-resume-generation/data-contract.md]
- [Source: _bmad-output/specs/spec-profile-led-resume-generation/acceptance-tests.md]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-Resume-2026-08-07/ARCHITECTURE-SPINE.md#AD-13]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-Resume-2026-08-07/ARCHITECTURE-SPINE.md#AD-14]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-Resume-2026-08-06/DESIGN.md]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-Resume-2026-08-06/EXPERIENCE.md#Approved Change - 2026-08-25: Simplified Resume Edit]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-Resume-2026-08-06/mockups/key-resume-edit.html]
- [Source: src/app/resume-workspace.tsx]
- [Source: src/app/actions.ts]
- [Source: src/domain/resume-generation/candidate-profile-commands.ts]
- [Source: src/domain/resume-generation/resume-template-commands.ts]
- [Source: src/app/api/resume-template/pdf/route.ts]
- [Source: tests/resume-profile-template.test.ts]

## Dev Agent Record

### Agent Model Used

GPT-5.6 Codex

### Debug Log References

- Create-story context analysis completed 2026-08-25.
- Next.js 16.3 form/server-action guidance reviewed from installed `node_modules/next/dist/docs`.
- `node --import tsx --test tests/resume-profile-ui.test.ts` passed (2 tests).
- `npx tsc --noEmit`, `npm test` (117 tests), `npm run lint`, `npm run build`, and `git diff --check` passed.

### Completion Notes List

- Ultimate context engine analysis completed — comprehensive developer guide created.
- Story scope is intentionally limited to profile save, truthful unavailable Coach state, and protected private template memory; LocalModelGateway, generated preview, and material-draft work are reserved for Stories 8.3–8.4.
- Replaced the active Current Base Resume editor with an append-only Candidate Profile form and unavailable-Coach recovery panel; retained the fixed Resume.pdf snapshot for future AI generation without pre-generation UI preview.
- Preserved legacy Current Base Resume data, PDF delivery, and history-only writes while removing their active `/resume` surface.
- Added focused UI regression coverage for field labels/errors, no-model behavior, no pre-generation template preview, and responsive layout.

### File List

- _bmad-output/implementation-artifacts/8-2-build-simplified-resume-edit-and-preview-only-state.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- .gitignore
- Resume.pdf
- src/app/actions.ts
- src/app/globals.css
- src/app/resume-profile-form.tsx
- src/app/resume-workspace.tsx
- tests/base-resume-ui.test.ts
- tests/current-base-resume.test.ts
- tests/resume-evidence-workspace-ui.test.ts
- tests/resume-profile-ui.test.ts

### Change Log

- 2026-08-25: Created implementation-ready Story 8.2 from the approved Profile-led Resume architecture, specification, and UX contract.
- 2026-08-25: Implemented Profile-led Resume Edit with saved profile details, preview-only local-AI recovery, verified template preview, and regression coverage.
- 2026-08-25: Replaced the personal Resume.pdf source with a one-page reusable visual resume template and made the project template trackable.
- 2026-08-25: Removed the Profile form education helper sentence to keep the compact form copy aligned with the approved template refresh.
- 2026-08-25: Approved a pre-generation Resume Edit without a template preview; the verified template remains private format memory for future AI generation, and generated resume PDFs become the previewed output.
- 2026-08-25: Placed the unavailable Resume Coach before Profile while preserving its muted unavailable-state color.
- 2026-08-25: Restored the desktop two-pane Resume Edit layout with Resume Coach on the left and Profile on the right; narrow layouts stack Coach before Profile.

### Review Findings

- [x] [Review][Patch] Remove the template preview from pre-generation Resume Edit [src/app/resume-workspace.tsx:21] — resolved product decision: retain the immutable, versioned `Resume.pdf` snapshot only as future AI-generation format memory; show a PDF preview only after a generated resume exists.
- [x] [Review][Patch] Bind the submitted profile identity to the active selection [src/domain/resume-generation/candidate-profile-commands.ts:66]
- [x] [Review][Patch] Do not collect an in-progress template staging directory as abandoned [src/files/resume-template.ts:103]
- [x] [Review][Patch] Re-check bundled-template freshness after designation before serving it [src/domain/resume-generation/resume-template-commands.ts:84]
