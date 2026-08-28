---
title: 'Complete the multi-resume Resume Edit workflow'
type: 'feature'
created: '2026-08-27'
status: 'in-review'
baseline_commit: '2a998e1'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-8-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-select-experience-project-folder.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Resume Edit still has a global, implicit profile-led state. It does not guide a new user through a profile and one locally documented Experience/Project folder, cannot isolate or delete resume workspaces, and shows Coach output in place of the resume preview.

**Approach:** Finish the approved local-only workflow from migration 0025: make each resume workspace independently selectable and deletable, make onboarding explicitly profile-plus-folder-first, require review approval before preview generation, and present the generated Coach/preview split while retaining the current bounded evidence agent and tokenless LM Studio loopback.

## Boundaries & Constraints

**Always:** Preserve existing uncommitted changes. A browser folder choice is a bounded allowlisted snapshot, never an uploaded filesystem path or retained raw source. Send it only through the existing evidence-documentation agent after explicit local-AI consent. Treat all resulting evidence as unreviewed until individual approval; no reviewable generated preview is available without approved evidence. Scope mutable profile, evidence, material-draft, template-selection, and generated-preview state to one active resume workspace. Switch without combining records. Permanent deletion must make workspace payload data unrecoverable to the app, reclaim its storage, and append only non-sensitive metadata to the deletion audit history. Keep LM Studio strictly `127.0.0.1`, tokenless, and free of authorization headers. Settings and unavailable states must name the actual missing prerequisite; link to AI setup only when AI is the missing requirement. Keep keyboard focus visibly clear.

**Ask First:** Changing the existing evidence documentation policy/budgets, restoring deleted data, adding cloud/LAN providers, turning a folder snapshot into a native filesystem integration, or exporting a generated resume.

**Never:** Discard unrelated dirty work; store raw folder bytes, paths, prompts, tokens, or model diagnostics in normal UI/audit data; silently create a preview, approve claims, or delete a workspace; retain a recoverable payload after permanent deletion; use a token field, secret reference, or `Authorization` header for either local-model path.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|---------------------------|----------------|
| First workspace | No active workspace | User creates/names one and completes basic profile plus one bounded folder snapshot | Explain the next required onboarding step; no generated preview |
| Folder documentation | Safe folder selected and consented | Existing agent returns proposed evidence artifacts in the active workspace | Reject unsafe, oversized, mismatched, or empty snapshots before agent invocation |
| Evidence gate | Evidence remains proposed/unreviewed | Coach/preview stays unavailable and points to evidence review | Individual approval is required; rejected evidence is not eligible |
| Ready generation | Saved profile, approved evidence, configured loopback AI | Coach is left and reviewable generated preview is right | Show a truthful error and preserve all source state on model failure |
| Workspace switch/delete | More than one workspace; deletion confirmed | Switches isolated state, or permanently erases selected payload while retaining metadata-only audit | Never allow implicit delete; block stale/missing workspace requests safely |
| AI unavailable | Missing/invalid LM Studio setup | Explain setup as the missing prerequisite and show an underlined Settings link | Do not show token entry or send authorization headers |

</frozen-after-approval>

## Code Map

- `src/persistence/migrations/0025_resume_workspaces.sql` — workspace schema starting point.
- `src/persistence/*repository*.ts`, `src/domain/resume-generation/*` — current global profile/evidence/material state and audit boundaries.
- `src/app/actions.ts`, `src/app/resume-workspace.tsx`, `src/app/evidence-library.tsx` — mutations and Resume/Evidence user flows.
- `src/app/resume-coach.tsx`, `src/app/local-model-settings.tsx`, `src/app/globals.css` — generated layout, availability copy, and focus treatment.
- `src/adapters/local-model/*`, `src/adapters/evidence-documenter/*` — loopback model calls.
- `tests/*.test.ts` — unit and source-contract coverage.

## Tasks & Acceptance

**Execution:**
- [ ] Persistence/domain — extend the 0025 migration and repositories so workspace creation, active switching, isolated state ownership, permanent cascade cleanup, storage reclamation, and metadata-only deletion audit are transactional and stale-safe.
- [ ] Evidence/documentation — bind the existing bounded browser snapshot and documentation-agent result to its active workspace; remove legacy server-path/documenter routes and every token/authorization-header dependency.
- [ ] Resume actions and UI — implement workspace switch/create and explicit permanent-delete confirmation; make onboarding profile then one documented folder, then individual evidence approval, then generation/preview availability.
- [ ] Coach/preview and Settings UI — render generated state with Coach left and reviewable preview right, accurately distinguish profile/folder/review/AI prerequisites, retain underlined AI setup only where applicable, and repair visible keyboard focus.
- [ ] Tests — add migration/domain/action/UI contract coverage for all matrix cases and update stale token-era assertions.

**Acceptance Criteria:**
- Given a new workspace, when its profile is unsaved or no folder has been documented, then Resume Edit guides the user through those two onboarding requirements before Coach is offered.
- Given a folder snapshot, when it contains unsafe or over-budget files, then the server rejects it before any documentation-model request and does not retain source bytes/paths.
- Given proposed evidence, when no individual item is approved, then no reviewable generated preview can be produced.
- Given two workspaces, when the active one changes, then profile/evidence/draft/preview state does not cross into the other workspace.
- Given confirmed permanent deletion, when it succeeds, then the workspace payload and private artifacts are gone, reclaimable storage is reported truthfully, and only metadata audit history remains.
- Given missing local AI, when Resume Edit is shown, then the copy identifies local AI and links underlined text to Settings; given another prerequisite is missing, it does not misleadingly offer that setup link.
- Given any local-model request, when it is sent, then it targets loopback without an API token or authorization header.

## Design Notes

The existing profile-led state uses global singleton pointers and immutable tables. Workspace isolation is therefore a data-model migration, not merely a UI selector; deletion must deliberately remove workspace-owned records and files before recording an audit event that contains only identifiers/timestamps/outcome metadata.

## Verification

**Commands:**
- `npm run typecheck` — expected: no TypeScript errors.
- `npm test` — expected: all existing and new workflow tests pass.
- `npm run lint` — expected: no lint errors.
- `npm run build` — expected: production build succeeds.
