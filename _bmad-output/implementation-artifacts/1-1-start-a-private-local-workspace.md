---
baseline_commit: NO_VCS
---

# Story 1.1: Start a private local workspace

Status: done

## Story

As Adrian,
I want to launch the workspace locally and understand its storage-protection posture,
so that I know my career data is not exposed by a public service.

## Acceptance Criteria

1. **Loopback-only workspace**
   - **Given** the app is launched on Adrian's computer
   - **When** he opens the workspace
   - **Then** it is reachable only through `127.0.0.1` and does not provide public hosting or a product sign-in route.

2. **Private local authority**
   - **Given** first use on a device
   - **When** the workspace initializes its local data area
   - **Then** it creates or validates the private app-data location and SQLite authority without transmitting career data externally.

3. **Accurate storage-protection disclosure**
   - **Given** the storage-protection setup
   - **When** Adrian reviews it
   - **Then** the UI states that the OS account is the current access boundary and identifies application-level encryption at rest as required before use on a shared or unencrypted device.

4. **Accessible initialization outcome and audit**
   - **Given** any local initialization event
   - **When** it succeeds or fails
   - **Then** the UI provides an accessible status/recovery message and the audit log records metadata only.

## Scope and blocking decision

- This story establishes the local application shell, private storage initialization, SQLite migration/audit foundation, and first-use disclosure. It does **not** import `resume.tex`, extract evidence, implement deletion/backup, connect Google/LM Studio, retrieve jobs, or add a product sign-in flow.
- `decision-local-encryption-at-rest` is open and blocks use with real career data. Before declaring this story implemented, record the selected posture in the project decision record: protection boundary, whether application-level encryption is used, key-storage/recovery implications, and the exact UI wording. Until then, never represent the database or files as encrypted.
- `resume.tex` at the workspace root is the immutable input for Story 1.2. Do not move, modify, import, or copy it in this story.

## Tasks / Subtasks

- [x] 1. Establish a local-only Next.js application shell (AC: 1)
  - [x] Create a TypeScript Next.js 16.3.0 App Router project using Node.js 24.18.0 LTS and the `src/` layout from the architecture seed.
  - [x] Provide local development/start commands that explicitly bind to `127.0.0.1`; reject or document no supported `0.0.0.0`/LAN/public-host mode.
  - [x] Create a minimal workspace shell with Candidate Profile/Evidence and Data & Storage navigation. Do not expose a sign-in route, account model, or hosted deployment configuration.
  - [x] Add the sober document-oriented visual foundation: semantic headings, visible keyboard focus, sufficient contrast, and responsive reflow. Do not make color the only status signal.

- [x] 2. Implement the private local-data boundary and database bootstrap (AC: 2)
  - [x] Add server-only app-data resolution under the current OS user's private data location; create and validate the app directory without placing app data in the repository, browser storage, or a public/static directory.
  - [x] Add SQLite initialization, mandatory migrations, and a small workspace metadata record. Use UUIDv7 for entity IDs and UTC ISO 8601 timestamps.
  - [x] Make initialization idempotent: repeated launches validate the same workspace/database without overwriting user data.
  - [x] Ensure this path performs no external network call, adapter call, cloud write, scheduler, or background work.

- [x] 3. Add domain command, error, and audit foundations (AC: 4)
  - [x] Implement the initialization path as UI action -> domain command -> SQLite transaction -> append-only audit event -> rendered current local state.
  - [x] Define the shared safe error contract: `code`, `summary`, `safe_next_action`, and affected entity/source IDs. Do not expose app-data paths, raw error stacks, or sensitive content in the UI.
  - [x] Store audit metadata only: UTC timestamp, local actor, entity/version IDs where applicable, action/outcome, and content hash where applicable. Never store resume/document text, prompts, model responses, tokens, credentials, or absolute sensitive paths.

- [x] 4. Build the first-use storage-protection and outcome UI (AC: 3, 4)
  - [x] Show the current protection boundary truthfully: private local app data protected by the OS account; no claim of application-level encryption until the decision is closed and implementation supports it.
  - [x] State that application-level encryption at rest is required before use on a shared or unencrypted device, and give a safe next action rather than allowing a misleading "protected" state.
  - [x] Provide a persistent, programmatic status region for initialization success/failure. Use `role=status`/an equivalent polite live region for ordinary results; associate failures with an explicit recovery action and retain keyboard access.
  - [x] In the empty Candidate Profile state, direct Adrian to the future Base Resume/material import and evidence review flow without treating lack of evidence as a deficiency. Those actions remain unavailable/explained until Stories 1.2 and 1.3.

- [x] 5. Test and verify the local foundation (AC: 1-4)
  - [x] Unit-test app-data resolution/validation, idempotent initialization, migration application, and audit-event redaction.
  - [x] Add an integration test that initializes a temporary private data root, persists workspace metadata plus an initialization audit event, and verifies a second initialization preserves it.
  - [x] Add UI/accessibility coverage for semantic navigation, visible status text, keyboard reachability, and success/failure/recovery announcements.
  - [x] Add command/config coverage proving loopback binding and absence of product-auth/public-host behavior. Run lint, typecheck, test, and production build explicitly; Next.js 16 does not run lint automatically during `next build`.

### Review Findings

- [x] [Review][Patch] Generate UUIDv7 for the authoritative workspace ID [src/domain/workspace/initialize-workspace.ts:21]
- [x] [Review][Patch] Make singleton workspace creation atomic across concurrent first launches [src/domain/workspace/initialize-workspace.ts:19]
- [x] [Review][Patch] Record a metadata-only initialization failure outcome and expose a keyboard-operable recovery action [src/domain/workspace/initialize-workspace.ts:39]
- [x] [Review][Patch] Do not mutate SQLite or append validation audits merely by rendering the page [src/app/page.tsx:12]
- [x] [Review][Patch] Implement the required safe-error `summary` field and normalize filesystem creation failures [src/domain/workspace/types.ts:24]
- [x] [Review][Patch] Reject empty app-data roots so SQLite cannot be created in the current repository [src/files/app-data.ts:19]
- [x] [Review][Patch] Strictly validate audit-event keys, generated fields, and digest values before persistence [src/audit/audit-event.ts:43]
- [x] [Review][Patch] Eliminate divergence between the checked-in SQL migration and the migration executed at runtime [src/persistence/migrations.ts:4]
- [x] [Review][Patch] Add rendered UI/accessibility and actual-startup regression coverage rather than source-text assertions [tests/local-startup.test.ts:5]

## Developer Guardrails

### Architecture compliance

- **AD-1 is binding:** the app is a local-first modular monolith. Bind only to `127.0.0.1`; SQLite and private OS-user app-data are authoritative. There is no product login, public deployment, cloud-storage dependency, unauthenticated network access, or background service.
- **AD-7 is binding:** preserve active data until user deletion. Full trash, restoration, permanent deletion, and local backup user flows belong to Story 1.4, but the storage layout must not preclude them. Backups stay on the protected device and rely on the Windows OS-account/full-disk-encryption boundary; no portable or application-encrypted archive is in MVP scope.
- **AD-10 is binding:** audit events are local, append-only metadata. Raw content, OAuth/LM Studio tokens, prompts, model responses, credentials, and secret-bearing diagnostics must never enter audit/log payloads.
- Use the architecture mutation convention exactly. Adapters are never authoritative; this story should not create any external adapter.
- The local-only decision in AD-1 and the SPEC supersede older PRD/UX references to an “authenticated workspace.” Do not add application authentication; the OS user account and loopback binding are the MVP boundary.

### Security and privacy requirements

- Browser/client code must never own direct filesystem or SQLite access. Keep storage, database, audit, and initialization logic server-side Node code.
- Do not rely on browser-only storage as the authority. Do not add Supabase, telemetry, analytics, remote error reporting, cloud backups, or external fonts/assets that transmit user data.
- Do not log absolute private paths, exception stacks, database contents, or configuration secrets. Convert operational failures to the safe error contract before rendering or auditing.
- The encryption-at-rest decision is unresolved. The only permitted current statement is the OS-account access boundary plus the shared/unencrypted-device warning; do not silently enable a weak or unverifiable substitute.

### UX and accessibility requirements

- Use labeled controls and programmatic headings. Panels read in the order: heading, status, content, action.
- Every status includes text and is not color-only. Maintain visible focus and keyboard operation; no hover-only information or actions.
- First-use/no-evidence is informative and routes to the later import/review workflow. Do not fabricate profile data or imply background processing.
- Follow WCAG 2.2 AA intent: semantic labels, readable errors, accessible contrast, status announcements, responsive reflow, and a 24px target or the spacing exception.

### File structure requirements

The repository currently has no application scaffold; all implementation files for this story are new. Keep the architecture seed and avoid touching the root resume artifacts.

```text
src/
  app/                       # App Router layout, workspace shell, first-use UI
  domain/workspace/          # initialization command and types
  persistence/               # SQLite connection, repository, migrations
  files/                     # private app-data resolution and validation
  audit/                     # append-only metadata event and repository
```

Expected initial files (exact names may vary only when preserving this responsibility boundary):

- `package.json`, `tsconfig.json`, Next/TypeScript/ESLint configuration, and explicit local start scripts.
- `src/app/layout.tsx`, `src/app/page.tsx`, and global styles for the accessible workspace shell.
- `src/domain/workspace/initialize-workspace.ts` and types.
- `src/files/app-data.ts`.
- `src/persistence/database.ts`, `src/persistence/migrations/0001_workspace.sql`, and workspace/audit repositories.
- `src/audit/audit-event.ts` plus tests colocated or in the project’s chosen test directory.

Do not create source adapters, LM Studio/Google/TeX integrations, resume import code, evidence extraction, or a public API in this story.

### Library and framework requirements

- Use the architecture-pinned stack: Node.js 24.18.0 LTS, TypeScript 5.9.x, and Next.js App Router 16.1.x. Next.js currently requires Node.js 20.9+ and uses the App Router filesystem convention; use explicit `lint` scripts because `next build` no longer runs lint automatically. [Source: Next.js Installation, https://nextjs.org/docs/app/getting-started/installation]
- Select the SQLite driver/migration library during implementation only if it supports server-only local access, transactional migrations, and deterministic test databases. Record the choice in the implementation notes; do not introduce a remote database.
- Prefer framework-standard server/client separation and no new dependencies unless a direct requirement needs one.

### Testing requirements

- Tests must use a temporary test app-data root and test SQLite database; never use or mutate the real private data directory or `resume.tex`.
- Cover success and failure initialization paths, idempotence, migration behavior, audit redaction, and no-network/no-adapter behavior.
- Assert the status/recovery UI exposes accessible text and does not rely solely on visual color.
- Verify the local server binding in the actual startup path, not only a README claim.

## References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 1, Story 1.1; architecture and UX requirements]
- [Source: `_bmad-output/specs/spec-personal-job-discovery-and-application-materials-tool/SPEC.md` — Capabilities CAP-1, CAP-2, CAP-16; Constraints; Deferred Implementation Decisions]
- [Source: `_bmad-output/specs/spec-personal-job-discovery-and-application-materials-tool/acceptance-criteria.md` — CAP-1, CAP-2, CAP-16; Deferred Implementation Decisions]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-Resume-2026-08-07/ARCHITECTURE-SPINE.md` — AD-1, AD-7, AD-10; Consistency Conventions; Stack; Structural Seed]
- [Source: `_bmad-output/planning-artifacts/prds/prd-Resume-2026-08-06/prd.md` — §§4.1, 6, 7.1, 9]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-Resume-2026-08-06/DESIGN.md` — Components; Do and Don't]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-Resume-2026-08-06/EXPERIENCE.md` — Information Architecture; Component Patterns; State Patterns; Accessibility Floor; Product-Specific Integrity Rules]
- [Source: `_bmad-output/implementation-artifacts/sprint-plan.md` — Sprint 0 decision gate; Sprint 1, Story 1.1]
- [Source: Next.js Installation, https://nextjs.org/docs/app/getting-started/installation]

## Dev Agent Record

### Agent Model Used

GPT-5.6-Codex

### Debug Log References

- `npm test` — 5 passing tests for loopback startup, private storage/database initialization, invalid-path recovery, audit redaction, and storage disclosure.
- `npm run typecheck`, `npm run lint`, and `npm run build` — all pass with Next.js 16.3.0.
- Manual integration verification — `npm run dev` served the workspace at `http://127.0.0.1:3000` with HTTP 200 and the expected Candidate Profile and storage-protection content.
- `npm audit --omit=dev --json` — 0 production vulnerabilities after the Next.js 16.3.0 security update.

### Completion Notes List

- Ultimate context-engine analysis completed; comprehensive developer guide created.
- Validation applied: scope boundaries, local-only supersession of legacy authenticated wording, encryption decision gate, audit redaction, loopback verification, and first-use accessibility are explicit.
- Implemented the local-only Next.js workspace shell, loopback-only run scripts, private per-user app-data resolution, SQLite migrations, idempotent workspace initialization, and append-only metadata audit persistence.
- Recorded the selected personal-device encryption posture in ADR-0001. The UI names the Windows OS account and full-disk encryption boundary without claiming application-level database/file encryption.
- Updated Next.js from 16.1.x to 16.3.0 because the production audit identified high-severity fixes; final production audit reports zero vulnerabilities.

### File List

- `.gitignore` (created)
- `docs/decisions/ADR-0001-local-encryption-at-rest.md` (created)
- `eslint.config.mjs` (created)
- `next-env.d.ts` (generated)
- `next.config.ts` (created)
- `package.json` (created)
- `package-lock.json` (created)
- `scripts/build-local.mjs` (created)
- `scripts/run-local.mjs` (created)
- `src/app/globals.css` (created)
- `src/app/layout.tsx` (created)
- `src/app/page.tsx` (created)
- `src/audit/audit-event.ts` (created)
- `src/domain/workspace/initialize-workspace.ts` (created)
- `src/domain/workspace/status-message.ts` (created)
- `src/domain/workspace/types.ts` (created)
- `src/files/app-data.ts` (created)
- `src/persistence/database.ts` (created)
- `src/persistence/migrations.ts` (created)
- `src/persistence/migrations/0001_workspace.sql` (created)
- `src/persistence/workspace-repository.ts` (created)
- `tests/local-startup.test.ts` (created)
- `tests/workspace.test.ts` (created)
- `tsconfig.json` (created; Next.js added generated type include)
- `src/app/actions.ts` (created during review remediation)
- `src/app/workspace-status.tsx` (created during review remediation)
- `src/persistence/migrations/0002_workspace_singleton.sql` (created during review remediation)

## Change Log

- 2026-08-07: Implemented Story 1.1 local-only workspace foundation and moved it to review.
- 2026-08-07: Resolved nine code-review findings; UUIDv7, singleton initialization, auditable failures, explicit initialization UI, strict audit validation, and migration authority were strengthened.
