---
title: 'Clear opportunity actions and helpful empty states'
type: 'bugfix'
created: '2026-10-05'
status: 'done'
route: 'oneshot'
baseline_commit: 'fbebb9cb1cd12f216acf9fca6c5ef36c439c4355'
---
<frozen-after-approval>
## Intent
Replace the broken modal review flow with a dedicated Add opportunity page. Put the posting URL and description first; pasting description fills recognizable job fields to reduce copying and manual entry. Show all fields and preserve manual corrections. One Add opportunity submit persists the record. Use task-oriented labels, short header descriptions and useful empty-state messages/navigation. Document the limitations of plain-text extraction and propose local AI extraction and explicit URL import as subsequent enhancements, rather than promising retrieval in this form. Preserve validation/input on failure, duplicate feedback and base-resume ownership. Keep BMAD artifacts and docs synchronized. The compact-list layout remains a recommendation.
</frozen-after-approval>
## Implementation Notes
- Small reversible UI/copy/documentation correction with no unresolved intent gaps, migrations or runtime data mutation; BMAD oneshot route. Existing dirty tree and primary medium/one high reviewer arrangement already authorized in this conversation; preserve unrelated/staged changes.
- Reuse PageHeader and EmptyStateCard. Keep capture validation, explicit confirmation, pending locks and safe errors unchanged. Actual CRUD is implemented in captured-opportunities.ts; tracking is still unavailable.
- Update README, current UX/PRD addenda, existing CRUD/tailoring completion artifacts, and AGENTS.md guidance on HCI, documentation and BMAD.

- 2026-10-05 user renegotiation: review-success text appeared without visible details. Replace the two-step flow outright rather than asserting an unverified modal fix. New route /opportunities/new composes existing shared form fields and page primitives; create action calls existing validated domain CRUD and redirects to the saved detail only after commit.
- Add browser verification against an isolated live Next application, including all fields visible, failed submit retains input and valid submit persists/navigates. No production app data or local AI requests.

- 2026-10-05 latest steering: URL/description first, plain-text auto-fill on paste, optional-fields defaults, preserved manual overrides, short page descriptions. URL-only retrieval is a proposed future explicit action; no network import is implemented. Shared parser code performs bounded extraction; unidentified values remain Unknown for correction.

## Verification evidence
- 2026-10-05: production build and typecheck pass; scoped ESLint passes. The build retains three existing dynamic-filesystem tracing warnings.
- 28 affected domain/UI tests pass. Earlier full suite (before paste/duplicate additions): 313 passed; later focused checks cover the additions.
- Live Chromium against isolated local app data verifies all eight inputs are visible; short-description rejection retains title, URL and description with field error; a description paste fills company/location/work style/date; final submit commits exactly one opportunity and revision, then navigates to its saved detail with success status.
- Chromium static layout checks pass at 1280/900/640/320px for the full-page add form and existing shared layouts. No production data or local model requests used.
- Existing primary medium implementation and one high reviewer used; preserve the unrelated dirty tree and staged files. No commit created.

## Review Triage Log
- medium, patch: new create action lost probable-duplicate feedback. Verified the domain recorded suggestions but the redirect exposed only success. Added a persistent suggestion read and a comparison link on detail; isolated test verifies the existing job ID and notice disappearance after related deletion.
- medium, patch: URL field omitted retrieval disclosure. Verified it presented an attribution URL without clarifying behavior. Added brief field help that the form does not retrieve the posting.

- medium, patch: auto-fill treated a manually cleared optional field as an empty candidate and overwrote it on a later paste. Added independent user-touched tracking, including clears; live fixture verifies clear-then-paste retention.
- medium, patch: Applied subtitle implied tracking existed while the empty state said it was unavailable. Changed header to truthful availability; body now offers useful existing tasks. High reviewer rechecked fixes and reported no unresolved issue.

- Final live Chromium check passes after review fixes: paste fills metadata, intentional field clears survive another paste, invalid submissions retain inputs, and Add opportunity persists once and navigates to the detail page. Final production build/typecheck/scoped lint pass; no unresolved review findings. URL import and semantic local-AI extraction remain proposals, not shipped capabilities.
