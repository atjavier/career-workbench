---
title: 'Component-driven Opportunities CRUD'
type: 'feature'
created: '2026-10-04'
updated: '2026-10-04'
status: 'done'
route: 'dispatch'
baseline_commit: 'fbebb9cb1cd12f216acf9fca6c5ef36c439c4355'
review_loop_iteration: 0
context: ['{project-root}/AGENTS.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Saved opportunities lack complete details, editing and deletion. The horizontal All Opportunities/Applied navigation is outdated, and opportunity-fit assessment is outside the MVP.

**Approach:** Build component-driven Opportunities CRUD, move All Opportunities and Applied into the Jobs sidebar, and remove fit assessment from the active product flow. Implement actual database deletion of the opportunity and its revisions, not hiding, archiving or tombstones. Job tailoring follows as a separate slice.

## Boundaries & Constraints

**Always:** Follow AGENTS.md: inspect existing components, reuse or extend them, extract repeated UI and migrate its usages. Preserve the olive theme, responsive layouts, accessible forms, keyboard/focus behavior and explicit pending/error/success states. Use local domain commands, repositories, optimistic concurrency and forward-only migrations. Preserve existing dirty work; no commits or production-data mutation during tests.

**Never:** Fetch URLs, scrape, automatically invoke AI, change the base resume, or include opportunity-fit scores, explanations, evidence-selection assessment controls, Pursue/Priority decisions or automatic fit calculations in the MVP. Retain historical fit modules for later iterations, but disconnect their reads/actions from active opportunity screens.

Jobs sidebar sections are **All Opportunities** (`/`) and **Applied** (`/applications`), with correct active states in desktop and compact navigation. Remove the horizontal switch entirely. Applied reuses the existing honest tracking-unavailable page; no new tracking engine or Google Sheets work is included.

Deletion requires confirmation, removes the root, every capture revision, duplicate suggestions referencing either side, and related legacy fit/decision records in one transaction. No hidden opportunity rows, archive copies or deletion flags remain after commit. Preserve unrelated jobs, evidence, profiles and base resumes. Delete attached tailored material drafts/versions, joins, editable-TeX artifacts and app-managed PDF/TeX files as well; confirmation must explicitly name the attached resume. Never delete the base resume. Use durable cleanup for files so failures cannot orphan storage silently. Audit identifiers/hashes only, without storing copied job content.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Capture | URL and copied description | Review/confirmation saves one opportunity | Invalid fields retained; no partial write |
| Details | Saved ID | Role facts, requirements, copied description, attribution, edit/delete actions | Missing/deleted ID returns not-found |
| Edit | Valid fields, expected revision | Append revision under same root; if a tailored resume exists, persistently recommend regeneration | Validation retains values with field errors |
| Conflict | Stale revision submitted | Reject edit/delete; retain newer changes | Refresh guidance; no partial write |
| Delete | Current revision, explicit confirmation | Physically remove opportunity, revisions, attached tailored resume and job-bound records | Unconfirmed/canceled operation changes nothing |
| Failure | Dependency cleanup/write fails | Entire deletion rolled back | Safe error; opportunity remains readable |
| Search | No matches or final job deleted | Accurate count and clear-search/empty-library action | No phantom cards |
| Navigation | All Opportunities/Applied link | Corresponding route and selected sidebar section | Applied clearly states tracking is unavailable |
| Fit removed | Any MVP opportunity screen | No fit score, explanation, calculation or related AI call | Legacy backend retained for later work |

</frozen-after-approval>

## Code Map

- `src/components/common/` — Button, WorkspaceContainer, ContentCard, PageHeader and EmptyStateCard already exist.
- `src/components/jobs/` — capture/search/cards; `opportunity-subnav.tsx` owns obsolete horizontal navigation.
- `src/domain/opportunities/captured-opportunities.ts`, `src/persistence/captured-opportunities-repository.ts` — reusable validation, capture projection and revision storage. Root duplicate keys are capture-time values; editing needs latest-revision matching.
- `src/persistence/migrations/0019_captured_opportunities.sql`, `0021_resume_profile_materials.sql`, `0022_ai_opportunity_assessments.sql`, `0024_captured_fit_assessments.sql` — foreign keys and immutable-delete triggers block naive DELETE; change via new migration only.
- `src/app/page.tsx`, `src/app/actions.ts` — current fit reads/action entry points; remove from active MVP flow.
- `src/app/applications/page.tsx`, `src/components/pro/applications.tsx`, `src/components/common/application-shell.tsx` — existing Applied placeholder and section selection.

## Tasks & Acceptance

**Execution:**
- [x] `src/persistence/migrations/0047_opportunity_lifecycle.sql`, `src/persistence/migrations.ts`, `src/persistence/captured-opportunities-repository.ts` — register deletion-capable lifecycle, deterministic revision ordering/current duplicate matching and transactional dependency cleanup; preserve update immutability. Permit scoped cascading deletion of opportunity-owned materials while preserving base-resume ownership and unrelated records.
- [x] `src/domain/opportunities/captured-opportunities.ts`, `src/domain/workspace/types.ts` — validated detail/update/confirmed hard-delete commands with expected revision checks, regeneration recommendation and rollback.
- [x] `src/domain/opportunities/opportunity-material-cleanup.ts`, `src/persistence/material-draft-repository.ts` — collect only materials tied to the deleted opportunity revisions; remove dependent joins/versions/TeX storage, reusing the existing private-file cleanup queue where compatible.
- [x] `src/app/actions.ts`, `src/app/opportunities/[opportunityId]/page.tsx` — thin mutations, linkable detail route, safe errors and route revalidation.
- [x] `src/components/jobs/opportunity-fields.tsx`, `opportunity-details.tsx`, `opportunity-editor.tsx`, `opportunity-delete-dialog.tsx`, `opportunity-capture.tsx` — reusable fields/details/editor/confirmation using existing primitives; migrate matching capture fields to shared components.
- [x] `src/components/jobs/job-listings.tsx`, `opportunity-card.tsx`, `src/app/page.tsx`, `src/app/globals.css` — simplify library cards, use company initials, retain capture/search, remove horizontal tabs and all fit UI/data loading.
- [x] `src/components/common/application-shell.tsx`, `workspace-sidebar.tsx`, `src/app/applications/page.tsx`, `src/components/pro/applications.tsx` — show All Opportunities/Applied beneath Jobs, honor activeSubItem for both, and keep Applied wording honest and focused.
- [x] `tests/tailored-resume.test.ts`, component/browser tests and affected existing tests — cover matrix, hard-deletion row counts, attached-resume deletion with base-resume preservation, file cleanup, foreign_key_check, migration from populated legacy schema, rollback/conflicts, no fit invocation, sidebar routes and keyboard flows using isolated data.

**Acceptance Criteria:**
- Given a confirmed deletion, when querying storage, then no opportunity root/revision, attached tailored material or job-bound legacy fit/decision record remains; app-managed artifacts are removed/recoverably queued for cleanup, and unrelated/base-resume records remain unchanged.
- Given Jobs navigation, when opening All Opportunities or Applied, then Jobs and the corresponding subsection are selected with no horizontal switch.
- Given an attached tailored resume, when opportunity edits are saved, then a persistent notice recommends regeneration without changing the resume or starting AI automatically.
- Given repeated forms/facts/actions, when inspecting implementation, then suitable existing/shared components own those patterns.
- Given 1280/900/640/320px screens, when using library/details/editor, then controls fit and keyboard focus remains visible.

## Implementation Notes

- User approved implementation on 2026-10-04, with primary implementation at medium and one high-reasoning reviewer. Implement directly here per that explicit team constraint. Preserve the pre-existing dirty tree.

## Spec Change Log

- 2026-10-04: User replaced soft deletion with physical database deletion, requested both Jobs sidebar subsections, and deferred opportunity fit entirely. Removed stale-fit recalculation scope; added FK/trigger cleanup investigation and a draft-dependency question.

- 2026-10-04: User resolved deletion dependency: delete the opportunity together with its attached tailored resume. Tailoring uses the one base resume automatically, retains one tailored resume per opportunity, and replaces it on regeneration. Opportunity edits recommend regeneration. Removed the resolved Open Questions section.

## Review Triage Log

| Finding | Verdict | Resolution |
|---|---|---|
| Same-millisecond revisions can be selected in arbitrary UUID order | medium | Verified: UUID suffixes are random. Fixed inside the serialized update transaction with a persisted timestamp strictly later than the preceding revision. Regression test freezes the system clock backwards and verifies every update immediately becomes current. High-reasoning reviewer confirmed the fix. |

## Design Notes

Use BEGIN IMMEDIATE and expected latest revision checks. Deletion must handle existing foreign keys and immutable-delete guards atomically, without disabling database integrity globally or deleting unrelated records. Verify actual row absence rather than library filtering. Keep detail pages readable with long copied descriptions and no fit controls.

## Verification

- `npm run typecheck`, `npm test`, `npm run build` — success, including matrix/dependency coverage.
- Chromium fixture — responsive layout, edit validation, delete/cancel/rollback feedback, pending/focus behavior and Jobs sidebar selection; fixture storage only.

## Completion Evidence

- 2026-10-05: `npm test`: 314 passed; typecheck, scoped ESLint and production build passed. Build reports the three pre-existing dynamic-filesystem tracing warnings.
- Isolated SQLite tests cover physical deletion, base/unrelated-job preservation, legacy job draft/PDF cleanup, rollback/guard restoration, stale writes, failed replacement, one-result storage, review-gated export and loopback-only stage transport.
- Chromium fixture covers responsive cards and tailoring content at 1280/900/640/320px. This is a static layout check; hydrated form pending/focus behavior has not been exercised end to end.
- Local model and compiler behavior were injected for deterministic lifecycle tests. No live LM Studio generation was run; actual output quality remains a manual check with the configured local model.
- One existing GPT-6 Luna high reviewer used per user preference. One verified ordering finding fixed and rechecked; no other actionable finding reported.
- No local commit: the shared tree includes unrelated pre-existing modifications and a staged deletion. These were preserved.

## Follow-up: task-oriented feedback — 2026-10-05

See spec-opportunity-actions-and-helpful-empty-states.md for the BMAD follow-up. Capture labels now distinguish Review details (no database write) from Add opportunity (explicit save). Applied has a truthful empty state with a useful navigation link; tracking remains unimplemented. README and current PRD/UX addenda document CRUD, ownership, regeneration and deferred fit.

## Superseding Add opportunity flow — 2026-10-05

The user reported that the modal displayed review-success text without visible review fields. The previous copy-only correction did not establish that the interaction worked. The current implementation replaces that modal and its staged review interaction with `/opportunities/new`. Every job field is visible immediately. Required inputs are title, company, posting URL and job description; optional location, work style, posted date and requirements are stored as Unknown when blank. One explicit Add opportunity action validates and persists a job, then opens its detail page with success feedback. Errors retain entered values, identify the invalid field and focus the error summary. Cancel returns to All Opportunities without a database write. No URL retrieval or AI request occurs when adding a job.

Internal historic table/command names may still use captured-opportunity terminology; active product labels use Add opportunity and saved jobs. Applied still has its honest empty state and Browse opportunities link. The horizontal-card list remains a design recommendation awaiting user selection.

Verification must include live browser submission against an isolated database; source/SSR checks alone cannot establish that a multi-step form works. See spec-opportunity-actions-and-helpful-empty-states.md for execution evidence.
