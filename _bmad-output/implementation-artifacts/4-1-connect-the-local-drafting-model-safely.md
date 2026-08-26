---
baseline_commit: b2bb2a3475d68e20e1a6af42ea2324fe347df115
---

# Story 4.1: Connect the local drafting model safely

Status: review

## Story

As Adrian,
I want to configure and verify the one local LM Studio model boundary,
so that every future tailored-material request stays on this computer and fails safely when it is not ready.

## Acceptance Criteria

1. **Given** Adrian opens **Settings > Local AI** or follows **Set up local AI** from an unavailable Resume Coach, **when** he deliberately verifies a Qwen3.5-9B model, **then** the server validates only the fixed loopback LM Studio native model-list endpoint, requires the selected exact model identifier to be a locally available loaded LLM, and saves one immutable configuration revision with the fixed endpoint, the exact model identifier, the readable `Qwen3.5-9B` label, an OS-vault secret reference, and a SHA-256 configuration digest. The model identifier, token, secret reference, endpoint diagnostics, IDs, and digest never appear in Resume Edit, action state, errors, or audit payloads.

2. **Given** Adrian supplies an LM Studio API token while saving verified settings, **when** validation and persistence succeed or fail, **then** the token is handled server-side only, written only to the current Windows Credential Manager through the `OsVault` adapter, and is never stored in SQLite, `LM_STUDIO_*` environment variables, client props, form/action return values, logs, or audit events. Missing, unreadable, or invalid vault material prevents all model network I/O. A failed database save removes a newly staged vault entry; a failed model verification creates no configuration revision, selection, draft, assessment, or audit event.

3. **Given** a valid configuration is current, **when** Resume Coach or AI-grounded opportunity assessment receives an explicit, consented request, **then** both use the existing single server-side, stateless `LocalModelGateway`, pin that exact configuration revision and digest into their own capability-specific fingerprints, and send exactly one bounded request to the fixed loopback native LM Studio chat endpoint with server-resolved vault authentication. The gateway never accepts a browser-configured host, port, model, token, or request body as authority; it has no cloud/LAN target, CORS exposure, arbitrary URL/file access, tools, MCP/integrations, response chaining/stateful conversation, automatic model loading, fallback, or automatic retry.

4. **Given** Adrian views a ready Coach or a configuration has changed, **when** the consent panel is rendered or any profile, template, reviewed material, optional Captured Opportunity, request text, or model configuration changes, **then** the panel names LM Studio on this device, the readable Qwen3.5-9B model, and the exact selected local data categories/material labels before a single explicit request. Consent is invalidated before network I/O by every such change. Existing pending and cached assessment behavior must never be reused under a changed configuration fingerprint.

5. **Given** Settings verification, vault access, the local model, or a bounded response is unavailable, unsafe, malformed, timed out, oversized, or stateful, **when** Adrian tries to configure, generate, or assess, **then** the operation creates no partial configuration, Coach consent use, draft, handoff, Material Version, assessment, rendering, export, or sensitive audit data. Profile details, the immutable template, typed request, selected material, and prior accepted draft remain usable; the UI provides one accessible Settings/manual-drafting recovery path without a cloud or manual-editor fallback.

6. **Given** keyboard, screen-reader, or 320 CSS px/400% zoom use, **when** Adrian configures Local AI or encounters ready, verifying, unavailable, success, or failure states, **then** the form has labels and linked errors, visible focus, concise atomic polite status, duplicate-submit prevention, predictable focus, and single-column reflow. Resume Edit retains its compact Profile-led layout and contains only a plain **Set up local AI** recovery link—never settings diagnostics or a secret field.

## Tasks / Subtasks

- [x] 1. Activate the immutable local-model configuration contract (AC: 1, 2, 4, 5)
  - [x] Reuse `local_model_configuration_revisions` and the `resume_generation_state.current_model_configuration_revision_id` CAS pointer already provided by migration `0021`; do **not** alter the applied migration or reintroduce an environment-backed source of truth.
  - [x] Add a typed `local-model-configuration-repository` and narrow domain command that create/read immutable configuration revisions, canonical digest, current-selection CAS update, and safe public readiness projection. Keep SQL inside the repository and return no secret reference, exact identifier, endpoint diagnostic, or raw row to UI code.
  - [x] Add a server-only `OsVault` interface plus a Windows Credential Manager implementation using `@napi-rs/keyring` (current researched release `1.3.0`) and an in-memory fake for unit tests. Generate an opaque per-configuration vault reference; never derive it from a token or put it in SQLite-visible/UI state. Pin the dependency and verify its Windows/Node 24 packaging before relying on it.
  - [x] Implement a deliberately submitted Settings verification flow: validate the strict literal loopback target, use the proposed token only in memory to call native `GET /api/v1/models`, require an exact Qwen3.5-9B LLM identifier with a loaded instance, then stage the vault entry and atomically persist/select the configuration. Compensate by deleting only the newly staged entry if the SQLite transaction fails; never download, load, unload, probe arbitrary endpoints, or retry.

- [x] 2. Converge the existing shared gateway and consumers on pinned configuration (AC: 1-5)
  - [x] Extend—not replace—`src/adapters/local-model/local-model-gateway.ts`. Remove the `LM_STUDIO_MODEL` configuration authority and legacy OpenAI-compatible Coach transport; resolve only a trusted current configuration plus server-side vault token passed by the domain boundary. The gateway remains stateless, has one `fetch`, 30-second abort, strict byte/character bounds, capability-specific schemas/fingerprints, and no repository/file/browser access.
  - [x] Use LM Studio's current documented native REST v1 contract: native v1 is recommended, `GET /api/v1/models` lists local models, and `POST /api/v1/chat` is stateful and exposes MCP-related capabilities by default. Before coding, read the current official request/response documentation and explicitly opt out of state/MCP/integrations; reject a response ID or any stateful/tool/integration signal. Do not carry over OpenAI-only fields merely by name—prove the native request uses the documented stateless controls while preserving this app's `store: false`/no-response-chaining invariant where supported.
  - [x] Update Resume Coach and `ai-opportunity-assessment` command/action preparation to re-read the current configuration server-side, bind configuration revision ID plus digest to consent/cache fingerprints, and invalidate/reject stale consent/cache before network I/O. Preserve exact profile/template/evidence/optional-opportunity snapshot validation, request-before-network audit ordering, request-outside-transaction behavior, and isolated Coach versus assessment schemas/prompts/validators/audit actions.
  - [x] Do not create a second gateway, model SDK, generation endpoint, draft aggregate, material migration, renderer, PDF, approval, export, legacy Current Base Resume write path, listing fetch, or browser automation. The old Evidence Documenter adapter is not a Coach compatibility path and remains outside this story.

- [x] 3. Deliver bounded Settings recovery and private UI states (AC: 1, 4-6)
  - [x] Add `/settings` and a scoped Local AI settings component using the existing application shell; it may disclose LM Studio-on-this-device and the readable model family, but not secret values, exact model ID, raw endpoint/adapter diagnostics, internal IDs, digests, prompts, responses, or audit records.
  - [x] Update `resume-workspace.tsx` and `resume-coach.tsx` to use the safe readiness projection. In an unavailable state, retain Profile/template access and expose a keyboard-operable **Set up local AI** link to Settings; do not add a manual editor, cloud fallback, substitute generation flow, or technical form to Resume Edit.
  - [x] Preserve the existing `useActionState` form pattern: validate all FormData as hostile, return only safe summary/recovery state, revalidate only after a successful mutation, retain typed request/selection on failure, and keep consent reset, `aria-busy`, polite atomic status, focus, duplicate prevention, and narrow single-column layout intact.

- [x] 4. Prove privacy, integrity, and regressions (AC: 1-6)
  - [x] Add configuration/vault domain and repository tests for fixed loopback-only discovery, model absence/not-loaded rejection, token isolation, vault failure before network, immutable UUIDv7/digest revision creation, CAS stale-selection failure, staged-vault cleanup, and configuration-change consent/cache invalidation.
  - [x] Extend `tests/local-model-gateway.test.ts`, `tests/resume-coach-draft.test.ts`, and `tests/ai-opportunity-assessment.test.ts` to prove one authenticated native request/no retry, request/header/body allowlist, no state/MCP/tool/integration/response-chain behavior, bounded timeout/malformed/oversized response rejection, no partial draft/assessment/audit, and separated capability contracts.
  - [x] Add Settings/Resume UI tests for no secrets/diagnostics in rendered/action/error/audit source, disclosure and recovery routing, accessible labels/errors/status/focus hooks, busy/duplicate behavior, and narrow-layout source contract. Preserve the completed 8.3/8.4 claim-grounding, draft integrity, handoff, read-only review, and no-render/export regressions.
  - [x] Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and `git diff --check`. Do not mark a task complete until every acceptance criterion has demonstrable coverage.

## Dev Notes

### Scope and precedence

- The original Epic 4.1 wording predates the approved Profile-led Resume change. This story is its implementation-ready replacement: it activates the already planned Settings/vault configuration contract while preserving Epic 8's completed Profile-led Coach and Material Draft work. Its inputs are Candidate Profile revision, reviewed Experience & Projects evidence, designated `Resume.pdf` template, and optional immutable Captured Opportunity—not a fetched Job Listing. [Source: _bmad-output/planning-artifacts/epics.md#Story 4.1; _bmad-output/planning-artifacts/sprint-change-proposal-2026-08-25-resume-profile-local-llm.md#Epic and story changes]
- Story 8.3 deliberately left configuration revisions inactive and used tokenless `LM_STUDIO_MODEL`; its review requires a higher-level alignment instead of silently introducing vault/settings behavior there. Story 4.1 is that explicit convergence point. Treat migration `0021`, architecture AD-2/AD-13, and this story as authority for the resulting configuration boundary; update affected Epic 8 tests and safe copy as part of the migration. [Source: _bmad-output/implementation-artifacts/8-3-provide-safe-local-resume-coach-requests.md#Review Findings; _bmad-output/planning-artifacts/architecture/architecture-Resume-2026-08-07/ARCHITECTURE-SPINE.md#AD-2; #Profile-led Resume Implementation Contract]
- Do not alter completed persistence/provenance behavior from Stories 8.1–8.4. A valid generated response remains an immutable Material Draft; claim support, review handoff, Material Version, rendering, and export remain later, explicit gates. [Source: _bmad-output/implementation-artifacts/8-4-hand-off-structured-material-drafts-for-review.md#Scope and implementation boundary]

### Privacy and integrity guardrails

- Fixed literal loopback only: `http://127.0.0.1:1234/api/v1/models` for deliberate verification and the matching native chat endpoint for explicit capabilities. Never accept a URL/host/port from the browser, config form, environment, database, or model response. Do not use `localhost` as a substitute. [Source: _bmad-output/planning-artifacts/architecture/architecture-Resume-2026-08-07/ARCHITECTURE-SPINE.md#AD-1; #AD-2]
- No raw token, vault reference, profile values, evidence, opportunity text/URL, prompt, model response, path, endpoint diagnostic, or SQLite text may reach UI/action error/audit. Audit only typed metadata (`actor`, action/outcome, UUIDv7 entity ID, SHA-256 content hash); add narrowly named configuration verification actions to the existing allow-list. [Source: src/audit/audit-event.ts; _bmad-output/specs/spec-profile-led-resume-generation/local-model-contract.md#Privacy and audit]
- Before every request, re-read current immutable data on the server and validate client IDs/selection as hostile; keep the one local fetch outside an open database transaction. If any precondition or response fails, make no partial persistence and leave user-owned local inputs intact. [Source: src/app/actions.ts; src/domain/resume-generation/resume-coach-commands.ts; node_modules/next/dist/docs/01-app/02-guides/server-actions.md#Security]

### Current implementation to extend

```text
NEW    src/adapters/os-vault/os-vault.ts (and Windows Credential Manager implementation)
NEW    src/persistence/local-model-configuration-repository.ts
NEW    src/domain/resume-generation/local-model-configuration-commands.ts
NEW    src/app/settings/page.tsx
NEW    src/app/local-model-settings.tsx
MODIFY src/adapters/local-model/local-model-gateway.ts
MODIFY src/app/actions.ts
MODIFY src/app/resume-workspace.tsx
MODIFY src/app/resume-coach.tsx
MODIFY src/domain/fit/ai-opportunity-assessment.ts
MODIFY src/domain/workspace/types.ts (only for safe configuration error codes)
MODIFY src/persistence/candidate-profile-repository.ts (only if shared state CAS helpers belong here)
MODIFY src/audit/audit-event.ts
MODIFY package.json and package-lock.json
MODIFY focused tests under tests/
```

- `0021_resume_profile_materials.sql` already supplies immutable configuration records and the singleton pointer. The migration is forward-only and must not be rewritten. Add a new migration only for a genuinely new durable invariant that cannot be represented by this schema, register it in `migrations.ts`, and prove upgrade safety. [Source: src/persistence/migrations/0021_resume_profile_materials.sql; src/persistence/migrations.ts]
- The project is Next.js 16.3.0 / React 19.2.3 / Node 24. Use a Server Component for trusted Settings/readiness loading and a narrowly scoped Client Component only for interactive form/action state. Server Actions are POST entry points: validate FormData and constrain serialized return values. [Source: package.json; node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md; node_modules/next/dist/docs/01-app/02-guides/server-actions.md]
- LM Studio's current official REST documentation recommends native `/api/v1/*`, lists models at `GET /api/v1/models`, and documents that native chat is stateful and can support MCP; this is why this story requires intentional stateless/no-MCP handling rather than assuming the old OpenAI-compatible endpoint is equivalent. [Source: LM Studio REST API, https://lmstudio.ai/docs/developer/rest; https://lmstudio.ai/docs/developer/rest/list; https://lmstudio.ai/docs/developer/rest/chat]
- `@napi-rs/keyring` 1.3.0 is a current Node-API option with built-in TypeScript declarations and a Windows binary; isolate it behind `OsVault` so unit tests never touch a real credential store and a future platform replacement does not change domain logic. [Source: @napi-rs/keyring, https://www.npmjs.com/package/%40napi-rs/keyring; https://github.com/Brooooooklyn/keyring-node]

### UX and recovery

- Settings is the designated Local AI setup/status surface. Resume Edit must show only a human recovery link; it must retain Profile and immutable-template access when unavailable and never display a secret field, endpoint diagnostics, manual editor, or fallback generation. [Source: _bmad-output/planning-artifacts/ux-designs/ux-Resume-2026-08-06/EXPERIENCE.md#Approved Change - 2026-08-25: Simplified Resume Edit]
- Preserve semantic chronological Coach output, labelled input, atomic polite state announcements, `aria-busy`, visible focus, predictable focus retention, and no horizontal scrolling at 320 CSS px/400% zoom. [Source: _bmad-output/planning-artifacts/ux-designs/ux-Resume-2026-08-06/reviews/review-resume-edit-accessibility-2026-08-25.md]

### Previous Story Intelligence

- Story 8.3 established the one-request/no-retry shared gateway, bounded capability contracts, one-use consent, validation before persistence, and request-audit-before-network ordering. Preserve these, update configuration source/fingerprints, and do not reintroduce its deprecated environment authority. [Source: _bmad-output/implementation-artifacts/8-3-provide-safe-local-resume-coach-requests.md]
- Story 8.4 tightened exact profile/template/evidence/opportunity identity binding, semantic claim-support grounding, draft integrity revalidation, and explicit review handoff. Settings work must not weaken or bypass those paths. [Source: _bmad-output/implementation-artifacts/8-4-hand-off-structured-material-drafts-for-review.md#Review Findings]

## Dev Agent Record

### Agent Model Used

GPT-5.6 Codex

### Debug Log References

- Create-story context analysis completed 2026-08-26.
- Reconciled legacy Epic 4 acceptance criteria, approved Profile-led change, architecture AD-2/AD-13, completed Stories 8.3/8.4, current source/test patterns, current Next.js 16 documentation, and current LM Studio/native-v1 and Windows-vault research.
- Verified native LM Studio v1 model-list/chat behavior and the Windows Credential Manager binding before implementation.
- Validation passed 2026-08-26: focused configuration/gateway/assessment tests; `npm test` (136 passing); `npm run typecheck`; `npm run lint`; `npm run build`; and `git diff --check` (line-ending warnings only).

### Implementation Plan

- Reuse the 0021 immutable configuration revision and singleton CAS pointer; place the token behind a server-only Windows Credential Manager adapter.
- Bind trusted configuration identity to the existing stateless native gateway and each capability fingerprint, then expose only a safe readiness projection to Settings and Resume.

### Completion Notes List

- Created an implementation-ready replacement for superseded Epic 4.1 scope.
- The story explicitly converges the existing single Coach/assessment gateway on immutable Settings/vault configuration; it authorizes no duplicate drafting, material, rendering, export, legacy-editor, cloud, or external-opportunity path.
- The existing 0021 configuration schema is reused; the story requires a safe Windows Credential Manager boundary and model-readiness verification before configuration selection.
- Implemented the Settings verification flow, immutable configuration repository/CAS selection, and `@napi-rs/keyring` 1.3.0 Windows Credential Manager adapter. Tokens, vault references, diagnostics, identifiers, and digests stay outside UI/action/audit projections.
- Reworked the shared gateway to issue one bounded, authenticated native `/api/v1/chat` request with `store: false`, no tools/integrations/chaining, and rejection of stateful, auto-load, malformed, and oversized responses.
- Resume Coach and opportunity assessment now re-read trusted configuration server-side and include its revision/digest in consent/cache fingerprints. Settings and Resume provide an accessible private recovery path.
- Added focused regression coverage for configuration, vault cleanup/CAS, native request allowlisting, stateful/oversized rejection, vault-before-network blocking, configuration cache invalidation, and private Settings/Resume UI contracts.

### File List

- _bmad-output/implementation-artifacts/4-1-connect-the-local-drafting-model-safely.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- next.config.ts
- package.json
- package-lock.json
- src/adapters/os-vault/os-vault.ts
- src/persistence/local-model-configuration-repository.ts
- src/domain/resume-generation/local-model-configuration-commands.ts
- src/adapters/local-model/local-model-gateway.ts
- src/domain/fit/ai-opportunity-assessment.ts
- src/domain/workspace/types.ts
- src/audit/audit-event.ts
- src/app/actions.ts
- src/app/resume-workspace.tsx
- src/app/resume-coach.tsx
- src/app/local-model-settings.tsx
- src/app/settings/page.tsx
- tests/local-model-configuration.test.ts
- tests/local-model-gateway.test.ts
- tests/ai-opportunity-assessment.test.ts
- tests/local-model-settings-ui.test.ts

### Change Log

- 2026-08-26: Created Story 4.1 as the explicit safe-configuration convergence for subsequent tailored-material work.
- 2026-08-26: Implemented safe native LM Studio configuration, vault-backed credentials, pinned gateway configuration, and Settings recovery; marked ready for review.
