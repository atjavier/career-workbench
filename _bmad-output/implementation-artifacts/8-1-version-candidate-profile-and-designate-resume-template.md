---
baseline_commit: b2bb2a3475d68e20e1a6af42ea2324fe347df115
---

# Story 8.1: Version Candidate Profile and designate Resume template

Status: done

## Story

As Adrian,
I want my required candidate profile details versioned and `Resume.pdf` protected as the designated visual template,
so that later resume generation can rely on trusted, recoverable inputs without changing the prior Current Base Resume history.

## Acceptance Criteria

1. **Migration 0021 establishes the Profile-led Resume schema without damaging existing workspace history.**
   - Add and register `0021_resume_profile_materials.sql` after migration `0020` in the explicit migration list.
   - Its schema satisfies the finalized contract: `candidate_profiles`, `candidate_profile_revisions`, `resume_template_sources`, `local_model_configuration_revisions`, `resume_generation_state`, `material_drafts`, `material_draft_evidence`, `material_draft_claims`, `material_claim_support`, `material_draft_handoffs`, and `material_versions`, including their foreign keys, indexes, check constraints, and immutability/lineage triggers.
   - The migration creates only the durable structures and safe backfill metadata required by the contract. It does **not** parse, transform, overwrite, copy, or designate legacy Current Base Resume bytes as the new template.
   - A pre-0021 workspace migrates atomically through `applyMigrations`; legacy current-base-resume rows, audit records, historical PDFs, and their integrity constraints remain readable and unchanged.

2. **Candidate profile saves create append-only, validated revisions.**
   - A profile revision requires first name, last name, email, phone, school, program, and graduation year. Middle name, GWA, Latin honors, LinkedIn URL, and GitHub URL are optional and normalized according to the contract.
   - Invalid, incomplete, malformed, stale, or non-linear updates return a safe `WorkspaceError` with field-specific remediation and create no revision.
   - A successful save canonicalizes the payload, computes the required digest, creates a UUIDv7 profile/revision record when needed, and appends a new revision rather than updating or deleting prior revisions. Parent revision lineage is same-profile and linear.
   - `resume_generation_state.active_profile_revision_id` may advance only through compare-and-swap semantics. A stale expected selection is rejected; a successful selection cannot rewrite a prior profile revision or any evidence/material/template data.

3. **`Resume.pdf` is bootstrapped and served only as a verified, immutable designated template.**
   - Bootstrap treats repository `Resume.pdf` as the bundled source, stages it under the private app-data root, verifies the expected PDF type, byte count, and SHA-256 digest, atomically promotes it to a safe template-owned path, then records it and designates it in one SQLite transaction/CAS operation.
   - Only a `bundled` source in `verified` state is designable in this story. Source path input is never accepted from a request, form, or query parameter; private paths are relative, containment-checked, and protected from symlink/path traversal escapes.
   - The bootstrap is idempotent and recovery-safe: interrupted staging is cleaned up, a mismatch fails closed, and neither a missing/bad bundled file nor a failed verification silently falls back to a legacy Current Base Resume.
   - The PDF read path revalidates the designated template against its stored integrity metadata immediately before returning an inline, private PDF response. It never exposes a file-system path or accepts an arbitrary template identifier.

4. **Current Base Resume remains preserved as read-only legacy history.**
   - Existing list/read/PDF-history behavior stays available for legacy records and keeps its existing byte/digest/path safeguards.
   - After 0021, legacy Current Base Resume write commands/actions cannot create or alter a current resume, revision, approval, or primary designation. They return a safe history-only/transition result instead of mutating legacy data.
   - This story does not remove legacy tables/files or retrofit legacy data into profile revisions, template bytes, material drafts, claim support, or generation state.

5. **Repository, domain, and audit boundaries are explicit.**
   - SQLite access stays in persistence repositories; validation, canonicalization, selection, bootstrap orchestration, compatibility decisions, and safe errors stay in domain/files modules; route handlers remain thin Node-runtime adapters.
   - Successful profile save and successful template designation emit metadata-only audit events with the exact actions `resume.profile_saved` and `resume.template_designated`. Audit payloads contain IDs, revisions, origin/state, and digests/counts only—never resume/profile content, paths, credentials, prompts, or model output.
   - LocalModelGateway/LM Studio calls, model configuration writes, consent persistence, chat UI, material-draft creation, rendering, and export are not implemented in this story. Their tables exist only because migration 0021 is the complete schema baseline; their operational behavior belongs to Stories 8.3–8.4.

6. **Regression and acceptance coverage proves the boundary.**
   - Tests cover clean migration, migration from legacy fixtures, repeat migration/bootstrap, all profile validation failures, revision immutability/lineage, selection CAS conflict, template happy path, integrity mismatch, staging recovery, path/symlink rejection, no-legacy-fallback, private PDF headers, audit metadata hygiene, and disabled legacy writes.
   - Existing Current Base Resume persistence, integrity, and PDF route tests remain green. No UI redesign is required here; Story 8.2 consumes the new profile/template read model.

## Tasks / Subtasks

- [x] 1. Add the durable migration baseline (AC: 1, 4)
  - [x] Create `src/persistence/migrations/0021_resume_profile_materials.sql` and register it as the next entry in `src/persistence/migrations.ts`; do not introduce an ORM or a second migration runner.
  - [x] Implement the contract tables, foreign keys, indexes, allowed-value checks, singleton `resume_generation_state` row, and database-level append-only/selection/lineage guards described in `data-contract.md`.
  - [x] Backfill only safe legacy **metadata candidates** where specified by the architecture. Do not read or move legacy PDF bytes during the migration, and do not set a legacy record as `designated_template_id`.
  - [x] Preserve migrations `0008`/`0009` and every legacy Current Base Resume table/trigger exactly; 0021 must be additive and transaction-safe under the existing `BEGIN IMMEDIATE` runner.

- [x] 2. Implement profile repositories and commands (AC: 2, 5)
  - [x] Add `src/persistence/candidate-profile-repository.ts` using the existing typed repository/database conventions. Keep SQL, row mapping, revision insert/read, and compare-and-swap selection operations here.
  - [x] Add `src/domain/resume-generation/candidate-profile-commands.ts` for field validation, canonicalization, SHA-256 canonical-content digesting, UUIDv7 allocation, append-only revision orchestration, and safe errors.
  - [x] Extend `SafeWorkspaceErrorCode` only with user-safe profile/template/legacy-transition codes needed by the public action/route boundary. Do not leak internal paths, SQL, content, or credentials in error summaries or next actions.
  - [x] Do not add profile editing UI or local-model behavior; expose only server/domain operations that Story 8.2 can consume.

- [x] 3. Implement protected template bootstrap, repository, and PDF read primitive (AC: 3, 5)
  - [x] Add `src/persistence/resume-template-repository.ts` for template metadata, verified designation eligibility, and atomic expected-selection updates. It must not read arbitrary file paths.
  - [x] Add `src/files/resume-template.ts`, adapting—not duplicating—the safe staging, containment, lstat/symlink, byte-count, digest, and cleanup patterns in `src/files/current-base-resume.ts`.
  - [x] Add `src/domain/resume-generation/resume-template-commands.ts` to orchestrate the fixed bundled `Resume.pdf` bootstrap, verification, transaction/CAS designation, audit emission, and verified designated-template read. Store template bytes under a template-owned private relative path such as `resume-templates/<template-id>/Resume.pdf`, with staging under a template-owned `.staging` directory.
  - [x] Add a thin Node runtime route for the designated template PDF (no caller-provided path or template ID). Follow the existing PDF route’s private, non-cacheable inline response headers and copy the verified bytes before response construction. Do not fetch this route from a Server Component; call the domain reader directly where server rendering needs the data.

- [x] 4. Preserve legacy behavior while closing legacy write paths (AC: 1, 4, 5)
  - [x] Keep `src/persistence/current-base-resume-repository.ts`, `src/files/current-base-resume.ts`, and current legacy read/PDF routes intact for historical access.
  - [x] Change only the legacy write command/action dispatch necessary to prevent post-0021 manual Current Base Resume mutations. Use a safe, user-facing transition/history-only response; do not delete UI in this story (Story 8.2 replaces it).
  - [x] Extend `src/audit/audit-event.ts` with the two exact resume actions and emit them only after the associated transaction succeeds. Reuse its metadata allow-list/forbidden-content discipline.

- [x] 5. Add focused acceptance and regression tests (AC: 1-6)
  - [x] Add repository/domain/file/route tests adjacent to the existing `tests/current-base-resume.test.ts` conventions using Node’s built-in test runner, temporary app-data roots, and `finally` cleanup.
  - [x] Test a database migrated through `0020` before applying 0021; assert untouched legacy rows/PDF history and a null new-template designation until verified bundled bootstrap succeeds.
  - [x] Test each required/optional profile field and malformed URL/contact/year case; assert no invalid revision is written. Test revision append-only behavior, cross-profile parent rejection, direct-update/delete trigger rejection, digest determinism, and selection CAS conflict.
  - [x] Test first/repeated bootstrap, staged-interruption cleanup, wrong type/byte/digest rejection, missing source, unverified-source rejection, containment and symlink rejection, no legacy fallback, verified-read digest check, and the exact response privacy/security headers.
  - [x] Test both audit actions for metadata-only payloads and assert prohibited content/path keys are rejected. Test each legacy write command returns the safe transition outcome and writes no legacy rows.
  - [x] Run the targeted test files plus the existing Current Base Resume suite, TypeScript/lint checks available in `package.json`, and `git diff --check` before moving the story to review.

### Review Findings

- [x] [Review][Patch] Refuse symlinked template staging paths before cleanup, staging, or promotion [src/files/resume-template.ts:51] — a symlinked `resume-templates/.staging` parent can redirect recursive cleanup or writes outside private app data.
- [x] [Review][Patch] Make first bundled-template bootstrap convergent under concurrent requests [src/domain/resume-generation/resume-template-commands.ts:30] — two cold starts can both insert and designate different bundled rows because the migration has no single-bundled-source guard.
- [x] [Review][Patch] Preserve every valid legacy Current Base Resume row during 0021 backfill [src/persistence/migrations/0021_resume_profile_materials.sql:119] — the legacy table permits source IDs and filenames that the new template-candidate row currently rejects, so an otherwise valid legacy workspace can fail to migrate.
- [x] [Review][Patch] Enforce approved evidence at draft and claim-support insert boundaries [src/persistence/migrations/0021_resume_profile_materials.sql:79] — immutable foreign keys alone permit unreviewed, rejected, or removed evidence revisions to support a future draft.
- [x] [Review][Patch] Complete the migration’s revision-level draft/version provenance contract [src/persistence/migrations/0021_resume_profile_materials.sql:62] — material drafts must pin captured opportunity revisions and referenced digest values; material versions also need accepted/content/provenance and nullable renderer/export metadata required by AD-13.
- [x] [Review][Patch] Protect the resume-generation singleton from deletion [src/persistence/migrations/0021_resume_profile_materials.sql:53] — it has a CAS update trigger but no delete guard, allowing the only selection record to be removed.
- [x] [Review][Patch] Require at least seven digits in a phone number [src/domain/resume-generation/candidate-profile-commands.ts:48] — the current length check accepts punctuation-heavy values containing a single digit as an immutable active profile revision.
- [x] [Review][Patch] Return the selected profile revision rather than the profile’s latest revision [src/domain/resume-generation/candidate-profile-commands.ts:80] — `resume_generation_state.active_profile_revision_id` can identify a historical revision, but the reader currently returns a different latest revision for the same profile.

## Dev Notes

### Source of truth and scope boundary

- Implement the Profile-led Resume foundation in AD-13/AD-14 and the adopted specification. The immutable visual template is the repository-root `Resume.pdf`; candidate content comes from versioned profile details plus later reviewed Experience & Projects material. A pre-existing Current Base Resume is historical evidence, not a generation input or replacement template. [Source: _bmad-output/planning-artifacts/architecture/architecture-Resume-2026-08-07/ARCHITECTURE-SPINE.md#AD-13; _bmad-output/specs/spec-profile-led-resume-generation/SPEC.md#Core contract]
- The migration deliberately creates the complete data contract now so later stories do not make incompatible schema changes. Do not surface or operate LocalModelGateway, credentials, consent, model settings, material drafts, claim-support records, render/export, or chat in 8.1. Story 8.3 owns local-model configuration/consent and Story 8.4 owns structured drafts/material hand-off. [Source: _bmad-output/specs/spec-profile-led-resume-generation/SPEC.md#Capabilities; _bmad-output/specs/spec-profile-led-resume-generation/data-contract.md#Scope boundary]
- Do not change the Resume Edit interface in this story. Story 8.2 replaces the manual editor with the simplified profile/template/preview state. A temporary safe message from a legacy write action is preferable to silently mutating obsolete data. [Source: _bmad-output/planning-artifacts/epics.md#Story 8.2]

### Data contract: implement exact invariants

- Profile revisions are immutable canonical snapshots. Required fields: `firstName`, `lastName`, `email`, `phone`, `school`, `program`, and `graduationYear`; optional fields: `middleName`, `gwa`, `latinHonors`, `linkedInUrl`, and `githubUrl`. Validate and normalize before writing; derive `content_digest` from canonical data, not raw form text. The profile needs a linear `parent_revision_id` chain and a `revision_number` that cannot fork or skip for one profile. [Source: _bmad-output/specs/spec-profile-led-resume-generation/data-contract.md#Candidate profile revisions]
- `resume_template_sources` must record immutable source metadata: UUIDv7 ID, origin, safe relative `storage_path`, original filename, content type, bytes, SHA-256 digest, state, and timestamps. Designation is a pointer in the singleton generation-state record. In Story 8.1 only `origin='bundled'` and `state='verified'` may be selected. Never accept an arbitrary source path, filename, origin, or selected ID from the browser. [Source: _bmad-output/specs/spec-profile-led-resume-generation/data-contract.md#Resume template source]
- Use `resume_generation_state` for the active profile/template pointers and expected-current revision token. A mutation must compare the client/server expected selection state and fail safely on mismatch. `active_profile_revision_id` and `designated_template_id` are optional initially; missing either remains a valid blocked state for later generation, never a reason to invent a fallback. [Source: _bmad-output/specs/spec-profile-led-resume-generation/data-contract.md#Resume generation state]
- Add the remaining material and local-model tables exactly as a dormant persistence boundary. They must have the integrity constraints necessary for later stories but no commands, routes, UI, or model calls in this story. [Source: _bmad-output/specs/spec-profile-led-resume-generation/data-contract.md#Structured material draft]

### Existing implementation patterns—reuse them

- The project uses Node 24’s built-in `node:sqlite` `DatabaseSync`; `src/persistence/database.ts` opens a private local database, enables foreign keys and busy timeout, and applies each registered migration inside `BEGIN IMMEDIATE`/`COMMIT` with rollback. Extend this list; do not add an ORM, a network database, another migration table, or a migration framework. [Source: src/persistence/database.ts; src/persistence/migrations.ts]
- Current Base Resume already demonstrates the required private-PDF safety model. Reuse its allow-listed relative path construction, `resolve` containment check, `lstat` rejection of symlinks, regular-file check, byte/digest verification, stage-then-rename behavior, and temporary-directory cleanup. Create template-specific helpers instead of generalizing the legacy module in a way that risks its proven behavior. [Source: src/files/current-base-resume.ts]
- Keep route handlers thin and use `runtime = "nodejs"` plus `dynamic = "force-dynamic"`. Existing PDF delivery is the header model to mirror: `content-type: application/pdf`, `content-disposition: inline`, `content-length`, `cache-control: private, no-store`, `cross-origin-resource-policy: same-origin`, and `x-content-type-options: nosniff`. Read bytes through the domain command and return a copied `ArrayBuffer`; never disclose a local path. [Source: src/app/api/current-base-resume/[sourceId]/pdf/route.ts]
- The audit helper validates UUIDv7 entity IDs and rejects sensitive payload keys. Add only action literals to its allow-list/type; pass metadata that supports recovery without storing profile values, PDF bytes, local paths, prompts, credentials, or model output. [Source: src/audit/audit-event.ts]
- Existing errors are intentionally safe `WorkspaceError` values serialized by server actions. Follow their short summary/safe-next-action style. [Source: src/domain/workspace/types.ts; src/app/actions.ts]

### Migration and compatibility sequence

1. Register and apply 0021 through the existing runner.
2. Initialize the singleton generation state with no active profile/template pointers and perform only permitted legacy metadata backfill.
3. On an explicit server-side bootstrap/use of the template primitive, stage the fixed repository `Resume.pdf` under private app data, verify bytes/digest/type, atomically promote it, insert verified metadata, designate it with CAS, then audit the committed result.
4. If verification or promotion fails, remove only the template staging artifact and leave the old history/new selection unchanged. Never use `current_base_resume` as a substitute.
5. Retain historical Current Base Resume read/list/PDF access but make legacy write command dispatch return a safe transition/history-only result after 0021.

Do not run bootstrap as a raw SQL migration, perform it during module import, or use a best-effort overwrite. SQLite metadata and promoted file bytes must agree before a template is considered available. [Source: _bmad-output/planning-artifacts/architecture/architecture-Resume-2026-08-07/ARCHITECTURE-SPINE.md#Template bootstrap and integrity]

### Project Structure Notes

Expected changes:

```text
MODIFY src/persistence/migrations.ts
NEW    src/persistence/migrations/0021_resume_profile_materials.sql
NEW    src/persistence/candidate-profile-repository.ts
NEW    src/persistence/resume-template-repository.ts
NEW    src/files/resume-template.ts
NEW    src/domain/resume-generation/candidate-profile-commands.ts
NEW    src/domain/resume-generation/resume-template-commands.ts
NEW    src/app/api/resume-template/pdf/route.ts
MODIFY src/audit/audit-event.ts
MODIFY src/domain/workspace/types.ts
MODIFY src/domain/current-base-resume/current-base-resume-commands.ts
MODIFY src/app/actions.ts
NEW/MODIFY focused tests under tests/
MODIFY _bmad-output/implementation-artifacts/sprint-status.yaml
```

- Do not replace `src/persistence/current-base-resume-repository.ts`, `src/files/current-base-resume.ts`, `src/app/api/current-base-resume/[sourceId]/pdf/route.ts`, or the current Resume Workspace components. New template/profile modules are parallel boundaries; legacy readers remain a compatibility seam.
- Repository records should be mapped to domain-owned types rather than leaking raw `node:sqlite` rows across modules. SQL belongs in repositories; filesystem checks belong in `src/files`; commands coordinate cross-boundary work; routes/actions adapt requests only.
- Keep the bundled template source fixed server-side. Its repository-root location is an implementation detail; the database and audit log store only safe relative private storage metadata and digest, never absolute paths.

### Testing notes

- Tests use Node’s built-in `node:test`/`node:assert`, temporary roots created with `mkdtemp`, and cleanup in `finally`. Follow `tests/current-base-resume.test.ts` for isolated DB/app-data fixture setup and existing migration-fixture style.
- Assert database behavior and filesystem behavior separately, then cover the domain orchestration/route header boundary. Tests must simulate stale selection and interrupted staging rather than merely unit-testing happy paths.
- Preserve the existing legacy tests as regression evidence. The new route must not expose a direct template/source identifier that allows an attacker to enumerate or request non-designated bytes.

### Technical constraints

- Runtime: Node.js `>=24.18.0`; use the already installed `node:sqlite` API. Do not add dependencies for persistence, hashing, UUIDs, PDF parsing, or model connectivity. [Source: package.json; src/persistence/database.ts]
- Framework: Next.js `16.3.0` with React `19.2.3`. Dynamic route `params` are asynchronous in the current codebase; preserve the existing route-handler convention if adding future dynamic params. [Source: package.json; src/app/api/current-base-resume/[sourceId]/pdf/route.ts]
- No external request, network access, telemetry, credential storage, LocalModelGateway implementation, or LLM request is authorized in this story. [Source: _bmad-output/specs/spec-profile-led-resume-generation/local-model-contract.md#Scope boundary]

### References

- [Source: _bmad-output/specs/spec-profile-led-resume-generation/SPEC.md]
- [Source: _bmad-output/specs/spec-profile-led-resume-generation/data-contract.md]
- [Source: _bmad-output/specs/spec-profile-led-resume-generation/acceptance-tests.md]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-Resume-2026-08-07/ARCHITECTURE-SPINE.md#AD-13]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-Resume-2026-08-07/ARCHITECTURE-SPINE.md#AD-14]
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 8]
- [Source: src/persistence/database.ts]
- [Source: src/persistence/migrations.ts]
- [Source: src/persistence/migrations/0008_current_base_resume.sql]
- [Source: src/persistence/migrations/0009_current_base_resume_integrity.sql]
- [Source: src/persistence/current-base-resume-repository.ts]
- [Source: src/files/current-base-resume.ts]
- [Source: src/domain/current-base-resume/current-base-resume-commands.ts]
- [Source: src/app/api/current-base-resume/[sourceId]/pdf/route.ts]
- [Source: src/audit/audit-event.ts]
- [Source: src/domain/workspace/types.ts]
- [Source: tests/current-base-resume.test.ts]

## Dev Agent Record

### Agent Model Used

GPT-5.6 Codex

### Debug Log References

- Create-story context analysis completed 2026-08-25.
- `npx tsc --noEmit` — passed.
- `npm test` — 115 passing tests.
- `npm run lint` — passed.
- `npm run build` — passed; includes `/api/resume-template/pdf`.
- `git diff --check` — passed.

### Completion Notes List

- Developer-ready story created from the approved Epic 8 specification and AD-13/AD-14 architecture.
- Scope intentionally excludes LocalModelGateway, consent/configuration behavior, material-draft operations, render/export, and Resume Edit UI redesign.
- Added registered migration 0021 with immutable Profile-led Resume schema, legacy metadata-only candidate backfill, and singleton state CAS guards.
- Added append-only Candidate Profile commands/repository and verified bundled-template staging, designation, audit, and private PDF delivery.
- Preserved legacy PDF/list access while blocking every Current Base Resume write command with a safe history-only result.
- Updated regression coverage for the approved legacy transition and the already-simplified legacy preview copy.
- Resolved all code-review findings: hardened template staging/cleanup against symlink escapes; converged concurrent bootstrap; preserved legacy migration rows with generated candidate UUIDv7 IDs; completed material provenance and approval guards; blocked singleton deletion; tightened phone validation; and read the exact selected profile revision.

### File List

- _bmad-output/implementation-artifacts/8-1-version-candidate-profile-and-designate-resume-template.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- src/app/api/resume-template/pdf/route.ts
- src/audit/audit-event.ts
- src/domain/current-base-resume/current-base-resume-commands.ts
- src/domain/resume-generation/candidate-profile-commands.ts
- src/domain/resume-generation/resume-template-commands.ts
- src/domain/workspace/types.ts
- src/files/resume-template.ts
- src/persistence/candidate-profile-repository.ts
- src/persistence/migrations.ts
- src/persistence/migrations/0021_resume_profile_materials.sql
- src/persistence/resume-template-repository.ts
- tests/current-base-resume.test.ts
- tests/resume-profile-template.test.ts
- tests/shared-visual-polish-ui.test.ts

### Change Log

- 2026-08-25: Implemented Profile-led Resume migration, append-only profile foundation, protected `Resume.pdf` template delivery, and legacy write transition; validated with tests, lint, type-check, and production build.
- 2026-08-25: Addressed code review findings — 8 items resolved; final validation passed with 115 tests, TypeScript, lint, production build, and diff check.
