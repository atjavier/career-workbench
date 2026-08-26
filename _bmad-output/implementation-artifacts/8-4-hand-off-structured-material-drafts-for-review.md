---
baseline_commit: b2bb2a3475d68e20e1a6af42ea2324fe347df115
---

# Story 8.4: Hand off structured material drafts for review

Status: done

## Story

As Adrian,
I want each Coach response stored as a separate draft,
so that I can review claims before any resume output is created.

## Acceptance Criteria

1. Given one successful, explicitly consented Resume Coach request, when its bounded response has passed the existing gateway validation, then the app persists one separate immutable `Material Draft` with its full readable structured content and pins the exact Candidate Profile revision/digest, designated template source/digest, every selected approved Evidence revision/digest, and the optional selected Captured Opportunity revision/digest. Any invalid, unsupported, unselected, stale, or malformed input/claim rejects the entire result without a partial draft, handoff, Material Version, or sensitive audit payload.
2. Given a generated Material Draft, when Adrian reads the proposal in Resume Coach or the review destination, then he can read all generated sections, normalized claims, their readable approved-evidence support, and unknowns before **Use as draft** is available. The UI names the draft as local AI guidance, never a hiring prediction or rendered resume, and keeps template/profile/evidence records unchanged.
3. Given Adrian selects **Use as draft** for an existing immutable Material Draft, when the handoff succeeds, then one immutable `material_draft_handoffs` record with destination `review` and one metadata-only `resume.material_draft_handed_off` audit event are created. The UI announces that `Resume.pdf` is unchanged and exposes **Review draft**. A repeated, stale, malformed, missing, or concurrent handoff fails safely and creates no extra handoff or audit event.
4. Given a draft reaches the review destination, when it renders, then it is a read-only local review projection of the pinned draft/provenance with explicit state that claim approval/resolution, Material Version creation, deterministic rendering, and export remain downstream gates. It must not mutate the draft/template/profile/evidence, create a Material Version, render a PDF, export a file, fetch a URL, call the model, retry, or reveal IDs, digests, paths, prompts, tokens, raw adapter diagnostics, or operational audit content.
5. Given keyboard, screen-reader, or narrow/400%-zoom use, when generation completes or a handoff is attempted, then proposal content precedes the action, status/failure is announced without rereading the transcript, duplicate submission is prevented, focus remains predictable, and Resume Edit retains its Profile-led layout with no legacy manual-editor, approval, export, or template-mutation controls.

## Tasks / Subtasks

- [x] 1. Extend the existing Coach-to-draft contract with exact optional-opportunity provenance (AC: 1, 2)
  - [x] Reuse `src/adapters/local-model/local-model-gateway.ts`, `resumeCoachAction`, and `persistResumeCoachDraft`; do not add a second model request, schema, endpoint, migration, or persistence aggregate.
  - [x] Add an explicit optional Captured Opportunity selection to the Resume Coach input. Treat the browser-supplied identity as hostile: validate it server-side, re-read only the current immutable local revision, bind its digest into the Coach request/consent fingerprint, and persist its exact revision/digest. A cleared/absent selection persists `NULL`; never fetch, infer, or read an opportunity URL.
  - [x] Preserve the current one-use consent rule: changing request text, selected evidence, optional opportunity, profile/template/model configuration, or consent state invalidates consent before network I/O. Keep the one fixed loopback request outside an open SQLite transaction, with no retry/fallback/tools/MCP/cloud path.
  - [x] Return the persisted draft ID through the safe Coach action state only after the successful draft transaction. Keep raw private request/response/provenance data out of action errors, status copy, and audit records.

- [x] 2. Add local read and idempotent review-handoff commands (AC: 1, 3, 4)
  - [x] Extend `src/persistence/material-draft-repository.ts` with typed, bounded read projections for a draft's structured content, claims, approved-evidence support, and handoff state. Keep SQL in the repository and never expose raw `node:sqlite` rows to UI code.
  - [x] Add `src/domain/resume-generation/material-draft-commands.ts` for trusted draft read and `handOffMaterialDraft`. Validate UUIDv7 input, re-read immutable records server-side, and reject missing/corrupt/unresolved drafts with safe workspace errors.
  - [x] In one `BEGIN IMMEDIATE` transaction, confirm every persisted claim has non-empty approved support, reject an existing handoff, insert exactly one fixed `destination='review'` handoff, append the metadata-only audit event, and commit. Translate both pre-existing and unique-constraint race failures into a safe duplicate/review-state outcome without leaking SQLite text.
  - [x] Do not alter `0021_resume_profile_materials.sql`: its immutable drafts, claim-support, handoff, and future Material Version schema are already the required contract. Do not create a Material Version, approval/claim-resolution result, renderer metadata, PDF, editable source, or export in this story.

- [x] 3. Present the full proposal and handoff/review flow accessibly (AC: 2, 3, 4, 5)
  - [x] Update `src/app/resume-coach.tsx` and `src/app/actions.ts` so a successful Coach response renders full sections, claims, readable approved-evidence labels, and unknowns before **Use as draft** is enabled. **Keep current** must leave all draft/handoff state unchanged.
  - [x] Add a distinct handoff action using only the draft ID, call `revalidatePath('/resume')` only after success, announce that the template is unchanged, and expose a safe **Review draft** navigation target. No UI action may send draft content/provenance back to the server as authority.
  - [x] Add a read-only review destination under `src/app/resume/drafts/[draftId]/` and a focused review component. In Next.js 16, use the current async dynamic-params convention and a Server Component to load the safe local projection; render a recovery state for unavailable/malformed drafts. Do not make this a generated-PDF preview or an export/approval surface.
  - [x] Preserve Resume Edit's existing compact Profile + Coach layout, keyboard-visible controls, `aria-busy` generation behavior, polite atomic status, failed-prompt preservation, and narrow single-column reflow. Add only scoped styling necessary for proposal, handoff, and review states.

- [x] 4. Prove provenance, safety, and regression behavior (AC: 1-5)
  - [x] Extend `tests/resume-coach-draft.test.ts` to cover profile/template/evidence/optional-opportunity snapshot integrity, immutable full-content read projection, claim support, successful handoff, repeated handoff, concurrent unique-handoff protection, metadata-only audit, and proof that no Material Version is created.
  - [x] Extend gateway and action tests for optional-opportunity consent invalidation, selected-revision validation, invalid/missing/stale input rejection before network access, one-request/no-retry behavior, and no partial draft/handoff/audit result on failure.
  - [x] Add focused review/UI coverage for full proposal-before-handoff ordering, **Use as draft**/**Keep current**/**Review draft** states, template-unchanged/status messaging, keyboard/status hooks, narrow-layout source contract, and absence of PDF rendering/export/manual-editor/cloud/fetch/tool/MCP/automation paths.
  - [x] Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and `git diff --check`. Do not mark any task complete until every acceptance criterion and test is demonstrably satisfied.

### Review Findings

- [x] [Review][Patch] Require every declared claim-support reference to ground the claim in its selected evidence [src/adapters/local-model/local-model-gateway.ts:57]
- [x] [Review][Patch] Recompute and verify persisted draft content/provenance integrity before read or handoff [src/domain/resume-generation/material-draft-commands.ts:17]
- [x] [Review][Patch] Restrict the review route to drafts that completed the explicit review handoff [src/app/resume/drafts/[draftId]/page.tsx:9]
- [x] [Review][Patch] Bind consent to exact profile, template, evidence, and opportunity revision identities as well as their digests [src/adapters/local-model/local-model-gateway.ts:30]

## Dev Notes

### Scope and implementation boundary

- Story 8.3 already validates the bounded Coach JSON, consumes consent, performs the sole local-model request, and persists an immutable material draft plus claim support. Extend that path; never create a second draft model, migration, generation endpoint, or model transport. `material_drafts`, `material_draft_evidence`, `material_draft_claims`, `material_claim_support`, `material_draft_handoffs`, and `material_versions` already exist in migration 0021. [Source: src/domain/resume-generation/resume-coach-commands.ts; src/persistence/migrations/0021_resume_profile_materials.sql]
- The two validation layers are intentional: gateway/domain validation must reject an ungrounded claim before draft persistence; human claim review, approval/resolution, version creation, rendering, and export remain later explicit material-review gates. Do not interpret downstream review as permission to persist unsupported claims. [Source: _bmad-output/specs/spec-profile-led-resume-generation/local-model-contract.md#Response schema; _bmad-output/planning-artifacts/epics.md#Story 8.4]
- `Resume.pdf` is immutable visual reference only. This story must never alter it, represent draft content as a rendered PDF/template match, or create an export. Legacy `current_base_resume_*` remains history-only and must not become a draft input or active UI. [Source: _bmad-output/planning-artifacts/architecture/architecture-Resume-2026-08-07/ARCHITECTURE-SPINE.md#AD-8; #AD-13]

### Required data and security behavior

- Persist/projection provenance must include exact profile revision and digest, template source and digest, sorted selected approved evidence revision/digests, and optional Captured Opportunity revision/digest. All identifiers are UUIDv7, timestamps are UTC ISO 8601, and immutable rows must remain append-only. Re-read all browser references server-side; client state is not authority. [Source: _bmad-output/specs/spec-profile-led-resume-generation/data-contract.md#Material drafts]
- The only permitted model transport remains the existing server-side tokenless `LM_STUDIO_MODEL` setup and fixed `127.0.0.1:1234/v1/chat/completions` endpoint from Story 8.3. Do not resolve older planning-language conflicts about vault/native-v1 configuration in this story. No external URL fetch, arbitrary file access, cloud/LAN serving, CORS, tools/MCP, automatic retry, or response chaining is permitted. [Source: _bmad-output/implementation-artifacts/8-3-provide-safe-local-resume-coach-requests.md#Review Findings; src/adapters/local-model/local-model-gateway.ts]
- Audit only `actor`, action, outcome, UUIDv7 entity ID, UTC timestamp, and SHA-256 content hash. Add `resume.material_draft_handed_off` to the typed allow-list; never audit request text, generated content, evidence, profile values, opportunity text/URL, template bytes, paths, tokens, or diagnostics. [Source: src/audit/audit-event.ts; _bmad-output/specs/spec-profile-led-resume-generation/local-model-contract.md#Privacy and audit]
- Next.js Server Actions receive untrusted form data. Validate action input and constrain return values to the safe UI projection; perform mutations in actions/domain commands, never during rendering. [Source: node_modules/next/dist/docs/01-app/02-guides/server-actions.md; Next.js Data Security guide]

### Existing code to extend

- `src/app/actions.ts`: Coach action currently creates a draft but discards its ID; return only the safe ID/state and add a separate handoff action.
- `src/app/resume-coach.tsx`: currently renders sections/unknowns only. It needs proposal claims/support and explicit handoff controls, while preserving `useActionState`, consent reset on changed input, `aria-busy`, and polite status behavior.
- `src/domain/resume-generation/resume-coach-commands.ts`: preserve its request-outside-transaction and immutable draft write pattern; extend snapshot inputs rather than duplicating it.
- `src/persistence/material-draft-repository.ts`: currently contains insert helpers only. Add typed read/find/insert-handoff helpers here; commands own validation, transactions, and audit.
- `src/app/resume-workspace.tsx`: passes trusted saved Profile and approved evidence context to Coach. Extend only as needed for the explicit optional local opportunity selection; do not reintroduce the legacy Resume editor.

### UX, accessibility, and recovery

- Readable proposal content must precede **Use as draft**. After success, announce that the template is unchanged and offer **Review draft**. **Keep current** changes nothing. A failed request/handoff preserves typed prompt, selected material, profile, and prior accepted draft; errors must give a safe next action without raw diagnostics. [Source: _bmad-output/planning-artifacts/ux-designs/ux-Resume-2026-08-06/EXPERIENCE.md#Approved Change - 2026-08-25: Simplified Resume Edit]
- Preserve semantic chronological Coach transcript, labelled prompt, atomic polite status, visible focus, `aria-busy` while generating, duplicate-submit prevention, and 320 CSS px/400% single-column reflow. Do not force focus through the transcript on completion/failure. [Source: _bmad-output/planning-artifacts/ux-designs/ux-Resume-2026-08-06/reviews/review-resume-edit-accessibility-2026-08-25.md]
- The review route must be read-only and local. It can show readable provenance labels but never raw IDs/digests. It must clearly say the material is not approved, rendered, or exported and route any future approval/render/export work to its downstream flow rather than inventing controls.

### Project Structure Notes

```text
MODIFY src/app/actions.ts
MODIFY src/app/resume-coach.tsx
MODIFY src/app/resume-workspace.tsx
MODIFY src/app/globals.css
MODIFY src/adapters/local-model/local-model-gateway.ts
MODIFY src/domain/resume-generation/resume-coach-commands.ts
NEW    src/domain/resume-generation/material-draft-commands.ts
MODIFY src/persistence/material-draft-repository.ts
MODIFY src/audit/audit-event.ts
MODIFY src/domain/workspace/types.ts (only if a distinct safe draft/handoff error is needed)
NEW    src/app/resume/drafts/[draftId]/page.tsx
NEW    src/app/material-draft-review.tsx
MODIFY/NEW focused tests under tests/
MODIFY _bmad-output/implementation-artifacts/sprint-status.yaml
```

- Use the existing Node 24 `node:sqlite` migration/repository pattern, Node built-in test runner (`node:test` via `tsx`), temporary app-data roots, and `finally` cleanup. Do not add a database ORM, rendering library, model SDK, router, or dependency. [Source: package.json; src/persistence/database.ts; tests/resume-coach-draft.test.ts]
- Next.js is `16.3.0` / React `19.2.3`; follow its current App Router and server-action conventions. Server Components may load local data and pass only serializable safe projections to Client Components. [Source: package.json; node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md]

### Previous Story Intelligence

- Story 8.3 is done and established the validated, local-only Coach boundary. Its review fixed one-use consent, exact selected profile snapshot, unknown-field rejection, grounded selected-evidence claims, bounded transport, accessible busy state, and request audit-before-network ordering. Preserve every one of those safeguards. [Source: _bmad-output/implementation-artifacts/8-3-provide-safe-local-resume-coach-requests.md#Review Findings]
- Existing Story 8.3 completion tests are green with `npm test`, typecheck, lint, production build, and diff check. Extend those tests rather than weakening or replacing them. [Source: _bmad-output/implementation-artifacts/8-3-provide-safe-local-resume-coach-requests.md#Completion Notes List]

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 8.4]
- [Source: _bmad-output/specs/spec-profile-led-resume-generation/SPEC.md#CAP-5]
- [Source: _bmad-output/specs/spec-profile-led-resume-generation/data-contract.md#Material drafts]
- [Source: _bmad-output/specs/spec-profile-led-resume-generation/local-model-contract.md]
- [Source: _bmad-output/specs/spec-profile-led-resume-generation/acceptance-tests.md#Handoff]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-Resume-2026-08-07/ARCHITECTURE-SPINE.md#AD-2; #AD-4; #AD-8; #AD-13]
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-08-25-resume-profile-local-llm.md#8.4]
- [Source: _bmad-output/implementation-artifacts/8-3-provide-safe-local-resume-coach-requests.md]
- [Source: src/adapters/local-model/local-model-gateway.ts]
- [Source: src/domain/resume-generation/resume-coach-commands.ts]
- [Source: src/persistence/material-draft-repository.ts]
- [Source: src/app/resume-coach.tsx]

## Dev Agent Record

### Agent Model Used

GPT-5.6 Codex

### Debug Log References

- Create-story context analysis completed 2026-08-26.
- Analyzed approved Epic 8/PRD/architecture/UX artifacts, Story 8.3, current material-draft code, Next.js 16 local documentation, and official Next.js data-security guidance.
- 2026-08-26: `npm test` (131 passing), `npm run typecheck`, `npm run lint`, `npm run build`, and `git diff --check` passed.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Story deliberately reuses Story 8.3 draft persistence and migration 0021; no duplicate model/generation path or renderer/export scope is authorized.
- Implemented optional immutable Captured Opportunity provenance in the existing single-request Coach path; the consent fingerprint and draft provenance now include its exact digest.
- Added bounded local draft projections and one-time `BEGIN IMMEDIATE` review handoff with a metadata-only audit event and safe duplicate outcome.
- Added accessible full-proposal, **Use as draft**, **Keep current**, and read-only **Review draft** states. No Material Version, rendering, export, or approval control was added.

### File List

- _bmad-output/implementation-artifacts/8-4-hand-off-structured-material-drafts-for-review.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- src/adapters/local-model/local-model-gateway.ts
- src/app/actions.ts
- src/app/globals.css
- src/app/material-draft-review.tsx
- src/app/resume-coach.tsx
- src/app/resume-workspace.tsx
- src/app/resume/drafts/[draftId]/page.tsx
- src/audit/audit-event.ts
- src/domain/resume-generation/material-draft-commands.ts
- src/domain/resume-generation/resume-coach-commands.ts
- src/domain/workspace/types.ts
- src/persistence/captured-opportunities-repository.ts
- src/persistence/material-draft-repository.ts
- tests/local-model-gateway.test.ts
- tests/material-draft-handoff.test.ts
- tests/material-draft-ui.test.ts
- tests/resume-coach-draft.test.ts

### Change Log

- 2026-08-26: Created implementation-ready Story 8.4 from the approved Epic 8 profile-led material-draft contract.
- 2026-08-26: Implemented local material-draft review handoff and marked the story ready for review.
