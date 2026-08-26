---
baseline_commit: b2bb2a3475d68e20e1a6af42ea2324fe347df115
---

# Story 3.2: Assess Captured Opportunity Fit with Local AI

Status: done

## Story

As Adrian,
I want an evidence-grounded local AI assessment of a captured opportunity and a clear way to act on it,
so that I can make an informed personal decision.

## Acceptance Criteria

1. Given a confirmed immutable Captured Opportunity revision, selected approved evidence, the saved Candidate Profile, designated Resume.pdf template, and explicit per-request consent, when Adrian selects **Assess fit**, then the app makes one bounded request through the shared `LocalModelGateway` to the configured loopback local model. It sends only that exact input projection; it performs no URL fetch, cloud fallback, tool/MCP invocation, automatic retry, or hiring/interview/offer prediction.
2. Given a valid local-model response, when the assessment completes, then the app validates every selected-evidence index and captured-description excerpt offset before one transaction persists a private immutable assessment pinned to the captured revision/digest, selected evidence revisions/digests, profile/template digests, model/configuration fingerprint, prompt/schema version, exact input fingerprint, structured strengths/gaps/uncertainty, provenance, and UTC time. Identical immutable inputs reuse the cached assessment without another inference; any changed input requires new consent. Invalid/unavailable output creates no partial assessment or audit row.
3. Given an assessment, when Adrian opens **Fit explanation**, then it renders distinct readable sections for AI-grounded strengths, gaps/uncertainty, evidence links, and short user-provided captured-posting excerpts. It clearly describes the result as local AI decision support rather than a hiring prediction. Deterministic Unknown/stale and explicit seniority, location, and work-style disclosures remain visibly separate safety context and are never treated as favorable semantic fit.
4. Given a displayed strength, gap, or excerpt, when Adrian inspects its provenance, then the app names the exact selected approved evidence revision and/or the validated excerpt from the pinned captured revision. It may offer the original user-provided HTTPS URL only as attribution; it never claims the pasted text was fetched, verified, current, or retrieved from that URL.
5. Given any calculated assessment, when Adrian records whether to pursue it or assigns personal priority, then that local decision is append-only, separately versioned/audited, linked to the inspected assessment, and cannot alter the assessment, evidence, profile, template, or captured opportunity. A stale submission fails safely while preserving the displayed state for review.
6. Given Adrian selects **Open original page**, when the handoff is rendered or activated, then it labels the validated destination host, opens only the stored HTTPS URL in a new browsing context, and says that any submission occurs outside this workspace with no prefilled/transmitted data. It performs no fetch, automation, application submission, credential use, polling, or retry. Keyboard, screen-reader, narrow-viewport, missing-data, and malformed-data states remain safe and usable.

## Tasks / Subtasks

- [x] Add a bounded `opportunity-assessment` contract to the shared LocalModelGateway (AC: 1, 2)
  - [x] Keep `resume-coach` behavior intact while adding a distinct capability, request/response schema, consent/input fingerprint, prompt schema version, strict character bounds, 30-second timeout, and one loopback request with `stream: false`, `store: false`, and no tools/MCP.
  - [x] Validate model output as untrusted: evidence indices must refer only to the submitted selected evidence; captured excerpt offsets must be bounded and resolve against the exact immutable copied description; reject hiring predictions and invalid/oversized output.
  - [x] Add focused gateway tests for allowed request shape, timeout/unavailable response, invalid references/offsets, and the no-retry/cache-ready behavior.

- [x] Persist immutable AI assessments and independent personal decisions (AC: 2, 5)
  - [x] Add forward-only migration `0022_*` and register it. Preserve the legacy deterministic `0018_fit_assessments` rows untouched. Create immutable, capture-revision-backed assessment and evidence/provenance joins plus append-only Pursue/Priority decisions with optimistic concurrency.
  - [x] Add domain commands/repositories that build the exact input projection from the confirmed capture, saved profile, designated template, and user-selected approved evidence; check the exact cache fingerprint before inference; validate before a single persistence transaction; and write metadata-only audit events.
  - [x] Keep assessments and decisions immutable. Reject stale, mismatched, corrupt, or unavailable state safely and never log description text, evidence text, prompts, responses, sensitive URLs, or raw form payloads.

- [x] Add the Fit explanation and decision flow to the Opportunity Library (AC: 3, 4, 5, 6)
  - [x] Extend the safe opportunity-library projection only with identity and assessment/decision summaries needed to select an item. Keep copied descriptions, full revision history, and raw digests off list cards.
  - [x] Add an explicit, accessible detail surface with selected-evidence controls, readable consent disclosure, Assess fit action/status, cached-or-new Fit explanation, provenance labels, deterministic safety disclosures, and decision controls.
  - [x] Preserve Jobs search/capture states and its local-only wording. Do not restore legacy discovery, refresh, source-record, fetch, iframe, or automation UI. Use the stored original page URL only for the labelled `target="_blank" rel="noreferrer"` handoff.

- [x] Prove privacy, integrity, caching, decisions, accessibility, and regressions (AC: 1-6)
  - [x] Add isolated SQLite/domain tests for exact-input caching, immutable persisted snapshots, malformed response rejection without partial writes, pinned provenance, deterministic safety disclosures, independent decision histories, and optimistic-concurrency rejection.
  - [x] Add UI-source tests for consent, local-AI/non-predictive wording, fit sections/provenance, safe external handoff, status/error hooks, and absence of fetch/iframe/automation/legacy discovery controls.
- [x] Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and `git diff --check`.

### Review Findings

- [x] [Review][Patch] Required Story 3.2 artifacts are tracked [src/app/actions.ts:23; src/persistence/migrations.ts:27] — Added the required source, migrations, tests, Resume.pdf, and PDF binary attribute to the index so the reviewed change is reproducible and whitespace validation handles PDF bytes correctly.
- [x] [Review][Patch] Persisted fit explanations survive a page refresh [src/app/page.tsx:17; src/app/job-listings.tsx:41] — The server page now loads the latest persisted assessment and decision, then passes the safe view to the Opportunity Library card.
- [x] [Review][Patch] Personal decisions submit the current optimistic-concurrency revision [src/app/opportunity-assessment.tsx:18; src/domain/fit/ai-opportunity-assessment.ts:50] — The decision form sends the latest revision ID and advances it after a successful append-only save.

## Dev Notes

### Approved Replan

The deterministic keyword-based fit calculation is superseded for the active Opportunity Library by a grounded local-AI assessment. Story 8.3 already provides the stateless `LocalModelGateway` for `resume-coach`; extend it with a distinct `opportunity-assessment` capability rather than reusing or weakening the coach contract. The configured LM Studio model is local loopback only (`127.0.0.1`), has no token, and remains unavailable when no model is configured.

The model receives only the exact immutable captured revision, selected approved evidence summaries, saved Candidate Profile, and designated template digest. Use compact bounded projections and exact SHA-256 fingerprints to keep inference fast and enable cache reuse. No network access occurs except the one request to the fixed loopback endpoint; the captured original URL is never fetched.

### Architecture, Privacy, and Integrity

- Follow AD-15: model output must be bounded JSON with strengths, gaps/uncertainty, selected-evidence index references, and validated short captured-description offsets. Treat it as untrusted and never persist unvalidated output.
- Persist a new immutable capture-backed assessment. Do not alter, reinterpret, delete, or backfill legacy `0018_fit_assessments` data. The current flow must not use `job_listings`, retained sources, refresh data, or title/keyword matching.
- AI guidance is decision support, never a prediction of hiring, interview, offer, employer intent, or an application outcome. Deterministic unknown/stale and explicit seniority/location/work-style disclosures are separate safety context, not a semantic-fit score.
- Cache only an exact fingerprint including capture revision/digest, sorted selected evidence revisions/digests, profile/template digests, model/configuration fingerprint, and prompt/schema version. Changed inputs require fresh consent.
- Pursue/Priority remains a separate append-only local decision aggregate with metadata-only audit entries. No audit event contains copied descriptions, evidence text, URLs, prompts, model responses, tokens, or form payloads.

### Existing Code and Patterns

- Reuse `src/adapters/local-model/local-model-gateway.ts`, `src/domain/opportunities/captured-opportunities.ts`, `src/persistence/captured-opportunities-repository.ts`, the profile/template repositories, existing `WorkspaceError` handling, SQLite migration conventions, `revalidatePath`, and `useActionState` controls.
- Place assessment/decision domain commands/read models in `src/domain/fit/`, SQLite repositories in `src/persistence/`, and migration `0022_*` in `src/persistence/migrations/` / registry.
- `src/app/job-listings.tsx` is the active Opportunity Library. Maintain its safe external-link/focus/search/capture behavior and compact cards.
- Story 8.4 owns using a Material Draft to generate a tailored resume. This story only assesses opportunities and records personal decisions.

### Testing Standards

Use the Node test runner with `tsx` and isolated SQLite fixtures (`mkdtemp`, `openDatabase`, `applyMigrations`). Cover both gateway contract and persistence/transaction boundaries, plus UI-source privacy/accessibility contracts. No new dependencies or package upgrades are allowed.

## Dev Agent Record

### Agent Model Used

GPT-5.6

### Debug Log References

- 2026-08-25: Story refreshed for the user-approved AI-grounded assessment replan and shared local-model gateway from Story 8.3.

### Completion Notes List

- Added a distinct loopback-only opportunity-assessment local-model contract with strict structured-output validation and no prediction language.
- Added immutable cached AI assessments, pinned assessment evidence, append-only Pursue/Priority revisions, and metadata-only audit events in migration 0022.
- Added an accessible Opportunity Library Fit explanation and explicit consent/decision controls without restoring legacy discovery or URL fetching.
- Validated with 127 passing tests, typecheck, lint, production build, and `git diff --check`.

### File List

- `_bmad-output/implementation-artifacts/3-2-inspect-fit-provenance-and-decide-to-pursue.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `src/adapters/local-model/local-model-gateway.ts`
- `src/app/actions.ts`
- `src/app/job-listings.tsx`
- `src/app/opportunity-assessment.tsx`
- `src/app/page.tsx`
- `src/audit/audit-event.ts`
- `src/domain/fit/ai-opportunity-assessment.ts`
- `src/domain/opportunities/captured-opportunities.ts`
- `src/domain/workspace/types.ts`
- `src/persistence/ai-opportunity-assessment-repository.ts`
- `src/persistence/migrations.ts`
- `src/persistence/migrations/0022_ai_opportunity_assessments.sql`
- `tests/ai-opportunity-assessment.test.ts`
- `tests/captured-opportunities.test.ts`
- `tests/job-listings-ui.test.ts`
- `tests/local-model-gateway.test.ts`

## Change Log

- 2026-08-25: Replaced the superseded deterministic-fit implementation brief with the approved local-AI opportunity assessment scope.
- 2026-08-25: Implemented the local-AI assessment, immutable cache/provenance, personal decision history, Opportunity Library controls, and regression coverage.
