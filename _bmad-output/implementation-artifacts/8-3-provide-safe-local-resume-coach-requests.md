---
baseline_commit: b2bb2a3475d68e20e1a6af42ea2324fe347df115
---

# Story 8.3: Provide Safe Local Resume Coach Requests

Status: done

## Story

As Adrian,
I want to explicitly request grounded guidance from my local model,
so that Resume Coach and later opportunity assessment can help without sending my information to a cloud provider.

## Acceptance Criteria

1. A request requires the exact selected Candidate Profile revision, reviewed Experience and Projects material, optional Captured Opportunity revision, a visible per-request disclosure, and explicit one-use consent. Any changed selection or request invalidates consent.
2. `LocalModelGateway` makes one stateless loopback-only request to validated LM Studio configuration. It has no cloud provider, tool/MCP capability, network target other than fixed loopback, automatic retry, fallback, or prompt/response logging.
3. The gateway validates a bounded task-specific JSON schema and rejects malformed, timed-out, unavailable, unsupported, or incomplete responses as a safe error with no partial persisted result.
4. Resume Coach availability, consent, busy, unavailable, error, and response states are keyboard- and screen-reader-accessible. The unavailable state leaves Profile details and the immutable template experience usable.
5. The gateway is a shared boundary, not a shared prompt: Resume Coach and the later AI-Grounded Opportunity Assessment each use a distinct versioned request/response schema, input fingerprint, validation path, cache policy, and audit action.

## Tasks / Subtasks

- [x] Establish validated local-model configuration and loopback-only gateway (AC: 1-3, 5)
  - [x] Read the exact local model identifier from process environment configuration and persist at most a non-secret model/configuration fingerprint. The current loopback-only setup sends no API token.
  - [x] Implement `adapters/local-model/LocalModelGateway` with a fixed `127.0.0.1:1234` target, bounded timeout/payload/output, `store: false`, no tools/integrations, no previous response state, and one request per explicit action.
  - [x] Define and validate a versioned Resume Coach JSON schema. Reject unknown fields/control characters, unselected evidence, mismatched consent echoes, unsupported claims, and over-limit content before persistence.

- [x] Implement consent, request, and safe state handling (AC: 1-4)
  - [x] Build the exact input selection/read model from saved profile, approved Experience and Projects material, optional captured opportunity, template digest, configuration fingerprint, and user request.
  - [x] Calculate a one-use consent fingerprint; revalidate it at the command boundary before network access. Keep the external request outside an open SQLite transaction.
  - [x] Add explicit accessible Resume Coach disclosure, request action, busy/unavailable/error states, and a safe response projection. Do not add manual resume editing or treat model output as a PDF/template change.
  - [x] Append metadata-only audit events for request, success/failure, and persisted draft metadata; never audit raw prompt, response, evidence, URL, or credential content.

- [x] Preserve a reusable assessment contract without implementing Jobs assessment UI (AC: 2, 3, 5)
  - [x] Make task-schema validation and request fingerprints capability-specific so Story 3.2 can add an assessment contract without reusing Coach prompts/responses or duplicating network/security controls.
  - [x] Document the extension seam and test that unsupported capability/schema combinations fail closed.

- [x] Test and validate the local-only boundary (AC: 1-5)
  - [x] Add isolated domain/repository/gateway tests for configuration validation, consent invalidation, allowed loopback target, single-call/no-retry behavior, timeout/malformed-response failure, metadata-only audit, and no partial draft.
  - [x] Add UI-source tests for disclosure, accessible status/error behavior, unavailable preservation, and absence of cloud/fallback/tools/MCP/legacy editor behavior.
  - [x] Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and `git diff --check`.

## Dev Notes

### Non-Negotiable Boundaries

- Reuse the architecture's `LocalModelGateway` contract in `src/adapters/local-model/`; do not use the Evidence Documenter as a compatibility shortcut.
- The gateway is server-side and stateless. It may read the configured local model identifier and call `fetch` only; it may not access repositories, files, browser state, arbitrary URLs, tokens, tools, or MCP.
- A local model response is untrusted. Resume Coach output becomes only a reviewable draft in the downstream Story 8.4 flow; it never approves claims, changes `Resume.pdf`, renders a PDF, or exports materials.
- Story 3.2 will reuse this secure transport boundary for AI opportunity assessment, but it needs its own schema, request fingerprint, output validation, immutable cache, and audit action. Do not implement the Jobs UI in this story.

### Existing Patterns

- Profile/template selection and CAS state: `src/domain/resume-generation/`, `src/persistence/*resume*repository.ts`, migration `0021_resume_profile_materials.sql`.
- Error and audit conventions: `src/domain/workspace/types.ts`, `src/audit/audit-event.ts`, `src/persistence/workspace-repository.ts`.
- Server action/cache pattern: `src/app/actions.ts`; use explicit `revalidatePath` only after a successful local mutation.
- Current Resume experience: `src/app/resume-workspace.tsx` and `src/app/resume-profile-form.tsx`. Preserve its simplified Profile + Coach layout and immutable-template behavior.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Story 8.3: Provide safe local Resume Coach requests`]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-Resume-2026-08-07/ARCHITECTURE-SPINE.md#AD-2`, `#AD-13`, `#LocalModelGateway contract`, `#AD-15`]
- [Source: `_bmad-output/planning-artifacts/prds/prd-Resume-2026-08-06/prd.md#16. Approved Change - Profile-led Resume Generation`, `#17. Approved Change - AI-Grounded Opportunity Assessment`]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-Resume-2026-08-06/DESIGN.md#Approved Change - 2026-08-25: Profile-led Resume Workspace`, `#Approved Change - 2026-08-25: AI-Grounded Fit Assessment`]

## Dev Agent Record

### Agent Model Used

GPT-5.6

### Debug Log References

- Created after the approved AI-Grounded Opportunity Assessment replan.
- 2026-08-25: Implemented and tested the tokenless loopback-only gateway and accessible temporary Coach response path.

### Completion Notes List

- Comprehensive implementation context created; story is ready for development.
- `LocalModelGateway` now validates a bounded Coach JSON response, one-use consent fingerprint, evidence references, and one-request/no-retry loopback behavior.
- Resume displays a consented Coach request form only when `LM_STUDIO_MODEL` is configured; unavailable local AI preserves Profile details.
- Resume Coach request failures now append only a profile-revision ID and consent fingerprint to the local audit trail; temporary responses remain unpersisted until the review-draft story.
- Selected approved evidence is now shown and consented per request; response persistence creates immutable material drafts with claim-to-evidence provenance.

### File List

- `_bmad-output/implementation-artifacts/8-3-provide-safe-local-resume-coach-requests.md`
- `src/adapters/local-model/local-model-gateway.ts`
- `src/app/resume-coach.tsx`
- `src/app/resume-workspace.tsx`
- `src/app/actions.ts`
- `src/audit/audit-event.ts`
- `src/domain/workspace/types.ts`
- `src/domain/resume-generation/resume-coach-commands.ts`
- `src/persistence/material-draft-repository.ts`
- `tests/local-model-gateway.test.ts`
- `tests/resume-coach-draft.test.ts`
- `tests/resume-profile-ui.test.ts`
- `tests/resume-evidence-workspace-ui.test.ts`

## Change Log

- 2026-08-25: Completed Story 8.3 with a tokenless, loopback-only Coach request, explicit material selection, immutable evidence-provenance drafts, and capability-specific validation. Full validation is green.

### Review Findings

- [x] [Review][Decision] Resolve the unavailable-template contract conflict — decided: Story 8.2 governs; retain the immutable template as private pre-generation format memory, with no preview or fallback until generated-output work.
- [x] [Review][Decision] Resolve the local-model configuration authority — decided: retain the tokenless `LM_STUDIO_MODEL` environment configuration. Align the higher-level contract to this approved local setup; do not introduce the conflicting Settings/vault configuration revision in Story 8.3.
- [x] [Review][Patch] Bind consent to the exact disclosed input and consume it once [src/app/resume-coach.tsx:11; src/app/actions.ts:57]
- [x] [Review][Patch] Send the approved Coach profile snapshot [src/app/actions.ts:59; src/adapters/local-model/local-model-gateway.ts:10]
- [x] [Review][Patch] Fail closed on unknown or unsafe model-response fields [src/adapters/local-model/local-model-gateway.ts:35]
- [x] [Review][Patch] Reject claims without verifiable selected-evidence support [src/adapters/local-model/local-model-gateway.ts:39; src/domain/resume-generation/resume-coach-commands.ts:19]
- [x] [Review][Patch] Bound transport input before parsing [src/adapters/local-model/local-model-gateway.ts:51]
- [x] [Review][Patch] Announce the busy Coach state accessibly [src/app/resume-coach.tsx:11]
- [x] [Review][Patch] Record the request audit event before network I/O [src/app/actions.ts:68]
