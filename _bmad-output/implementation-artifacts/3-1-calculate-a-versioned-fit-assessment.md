---
baseline_commit: 380c24dbc8a9b3dc6cc70a235da0888b7cb447db
---

# Story 3.1: Calculate a Versioned Fit Assessment

Status: done

## Story

As Adrian,
I want a deterministic fit label for a job listing,
so that I can prioritize roles from supported evidence rather than a hiring prediction.

## Acceptance Criteria

1. Given a normalized Job Listing and approved Candidate Profile evidence revisions, when Adrian explicitly calculates fit, then the system persists an immutable Fit Assessment containing snapshots of the listing and retained source provenance, the exact approved evidence revision IDs/content, the applicable job-preference revision, the deterministic ruleset/version, factor outcomes, Fit Label, confidence/Freshness disclosures, and UTC calculation time.
2. Given assessed factors, when the label is displayed, Strong means substantial supported alignment with no known disqualifier; Potential means meaningful alignment with a material gap or uncertainty; Stretch means a significant evidence, seniority, location, or work-style mismatch.
3. Given unknown or stale listing, preference, or evidence inputs, when fit is calculated, then the result lowers confidence and/or explicitly discloses the unknown/stale factor and never treats missing information as favorable.
4. Calculating fit never mutates the Job Listing, retained Source Records, Candidate Evidence revisions, or preference revisions; repeated calculation creates a new versioned result (or is idempotent only when the complete input snapshot and ruleset digest are identical).
5. Fit assessment language is evidence-based and non-predictive: it must not claim likelihood of interview, offer, hiring, or employer intent. Personal Pursue/Priority state is independent of the calculated label.

## Tasks / Subtasks

- [x] Define the Fit Assessment domain contract and explicit v1 ruleset (AC 1-5)
  - [x] Model factor outcomes for requirements/evidence alignment, gaps, seniority, location, work style, and listing Freshness, including `unknown`/`stale` states.
  - [x] Choose deterministic, documented thresholds for material/significant gaps and required vs preferred signals; encode a ruleset ID/version and SHA-256 digest so future changes cannot rewrite historical results.
  - [x] Validate that only approved, immutable evidence revisions and the current preference revision are eligible inputs.
- [x] Add SQLite migration and repository for immutable Fit Assessments (AC 1, 4)
  - [x] Store canonical JSON snapshots and factor outcomes, label, confidence, freshness/disclosure data, ruleset metadata, and calculated UTC timestamp with UUIDv7 ID.
  - [x] Enforce foreign keys/constraints and immutability using the established migration/repository patterns; preserve source-record attribution in the listing snapshot.
  - [x] Add bounded reads for the latest assessment and historical versions without exposing mutable internals.
- [x] Implement the deterministic calculation use case (AC 1-5)
  - [x] Load listing, approved evidence revisions, and preference revision through repositories; fail safely for missing/invalid inputs rather than assuming fit.
  - [x] Persist the assessment in one transaction and append a metadata-only audit event (no resume text or full job content in operational logs).
  - [x] Keep calculation separate from Story 3.2’s detailed explanation, Pursue/Priority decision, and employer-site handoff.
- [x] Add the minimal listing/profile presentation needed to trigger and inspect the result (AC 2, 3, 5)
  - [x] Use text labels with adjacent definitions and accessible status announcements; use “Unknown” for missing listing fields and do not use probability-like color treatment.
  - [x] Preserve existing listing/source inspection, duplicate-group behavior, and empty/error/recovery states.
- [x] Test the domain, persistence, and UI boundaries (AC 1-5)
  - [x] Cover each label boundary, disqualifying seniority/location/work-style mismatch, required/preferred evidence, competing evidence, unknown/stale inputs, stale expected revisions, duplicate calculation, and immutability.
  - [x] Assert snapshot completeness, ruleset version/digest, audit metadata-only behavior, and no mutation of source/evidence/preference rows.
  - [x] Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`.

## Dev Notes

### Review Findings

- [x] [Review][Patch] Fit assessment is connected to immutable captured-opportunity revisions and the active Jobs UI.
- [x] [Review][Patch] Strong requires captured requirement evidence, not title/company word overlap.
- [x] [Review][Patch] Freshness is derived from the persisted calculation timestamp.
- [x] [Review][Patch] Captured-fit records and approved-evidence links have immutable database integrity checks.
- [x] [Review][Patch] Country and NCR hybrid/onsite preferences are evaluated explicitly.
- [x] [Review][Patch] Evidence snapshot size is bounded with a safe recovery error.
- [x] [Review][Patch] Latest captured-fit reads have a stable timestamp-and-ID ordering.

### Developer Context

This is the first Story 3 implementation and consumes the normalized listing and versioned preference/evidence foundations from Epics 1–2. The result is a transparent prioritization aid, never an AI score or hiring prediction. Exact thresholds were intentionally left open in the PRD; implementation must select and document a conservative v1 rubric and persist its version rather than leaving implicit heuristics.

### Architecture Compliance

- Follow AD-1 local-first modular monolith: Next App Router, SQLite authority, loopback-only app, explicit user action; no cloud/model call or background refresh.
- Follow AD-3: deterministic, versioned assessment from approved evidence, listing requirement excerpts/signals, seniority, work-style/location, and Freshness. Strong/Potential/Stretch meanings above are normative; unknown/stale lowers confidence and stays visible.
- Follow AD-4: evidence revisions and listing/source records are immutable and provenance-preserving.
- Follow AD-10: UI action → domain command → SQLite transaction → metadata-only audit event. Never log candidate text, resume content, tokens, or full job-page bodies.
- Use UUIDv7 identifiers, UTC ISO-8601 timestamps, canonical JSON, and SHA-256 digests consistent with existing code.

### Existing Code and File Structure

Likely new modules belong in `src/domain/fit/`, `src/domain/provenance/`, and `src/persistence/` (migration after `0017_job_listing_hardening.sql`). Wire actions/UI only through existing `src/app/actions.ts` and listing page patterns.

Reuse, do not duplicate:

- `src/domain/discovery/job-listings.ts`, `src/persistence/job-listings-repository.ts`, and migrations `0016`/`0017` for normalized listings and retained Source Records.
- `src/domain/discovery/job-preferences.ts` and `src/persistence/job-preferences-repository.ts` for immutable preference revisions and optimistic concurrency.
- `src/persistence/evidence-repository.ts` (`listApprovedEvidence`) and `0004_evidence.sql` for approved immutable evidence revisions.
- Existing audit types/writers and migration/test fixtures for metadata-only events, foreign keys, and immutability triggers.

Current listings do not yet expose normalized requirement or seniority fields. Add bounded, provenance-preserving signals only if required by the chosen rubric; otherwise represent them explicitly as Unknown. Do not fabricate requirements by parsing unretained page content.

### Testing Requirements

Use the established Node test runner/tsx fixtures (`mkdtemp`, `openDatabase`, `applyMigrations`). Test repository constraints and immutable snapshots directly, then domain label rules with table-driven cases. Include accessibility checks for label definitions, Unknown/stale disclosures, keyboard activation, and status announcements. Existing Epic 2 behavior must remain green.

### Scope Boundaries

Story 3.2 owns detailed fit explanation/provenance browsing, save/Pursue/Priority, and deliberate employer-site handoff. Do not add AI/LM Studio integration, automatic ranking, application submission, or mutation/override of calculated labels in this story.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Epic 3: Evidence-based role decisions`]
- [Source: `_bmad-output/planning-artifacts/prds/prd-Resume-2026-08-06/prd.md#6. Data Model`, `#11. Architecture Decisions Required`]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-Resume-2026-08-07/ARCHITECTURE-SPINE.md#AD-3 — Evidence-first fit assessment`, `#Capability → Architecture Map`]
- [Source: `_bmad-output/implementation-artifacts/2-4-inspect-normalized-job-listings.md`]
- [Source: `src/persistence/evidence-repository.ts`, `src/persistence/job-preferences-repository.ts`, `src/persistence/job-listings-repository.ts`]

### Previous Story Intelligence

Story 2.4 hardened persistence-boundary validation, source/run provenance, bounded adapter records, duplicate overrides, accessible dialogs, and distinction between empty and failed states. Preserve those patterns. Its normalized `JobListing` has title/company/work-style/location/freshness timestamps and retained source records, but no fit fields; do not retrofit fit state into the listing row.

### Git / Technology Intelligence

Recent work uses Node `>=24.18` native `node:sqlite`, TypeScript `5.9.3`, Next `16.3.0`, React `19.2.3`, and no dependency upgrades. Recent commits emphasize stale expected-revision protection, transaction-boundary validation, and failure preservation. Story 2.4 changes may be uncommitted; inspect the working tree and build on current files rather than reverting them.

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created
- Implemented deterministic `evidence-fit-v1` ruleset with Strong/Potential/Stretch labels and explicit unknown/stale confidence handling.
- Added immutable SQLite Fit Assessment snapshots, bounded repository reads, transactional calculation, and metadata-only audit events.
- Added Job Listings calculate-fit action and latest label/confidence presentation.
- Validation passed: 72 tests, typecheck, lint, and production build.

### File List

- `_bmad-output/implementation-artifacts/3-1-calculate-a-versioned-fit-assessment.md`
- `src/audit/audit-event.ts`
- `src/domain/fit/fit-assessment.ts`
- `src/domain/discovery/job-listings.ts`
- `src/domain/workspace/types.ts`
- `src/app/actions.ts`
- `src/app/job-listings.tsx`
- `src/persistence/fit-assessment-repository.ts`
- `src/persistence/migrations.ts`
- `src/persistence/migrations/0018_fit_assessments.sql`
- `tests/fit-assessment.test.ts`

## Change Log

- 2026-08-23: Implemented Story 3.1 and completed validation; status set to review.
- 2026-08-24: Manual Opportunity Capture replan approved. Before this review can be accepted, verify that Fit Assessment snapshots consume immutable Captured Opportunity revisions and user-provided description provenance rather than requiring retained source/refresh provenance. Do not extend the superseded discovery model.
