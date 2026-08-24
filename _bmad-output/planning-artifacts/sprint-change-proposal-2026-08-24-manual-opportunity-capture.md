# Sprint Change Proposal — Manual Opportunity Capture

**Status:** approved  
**Date:** 2026-08-24  
**Scope:** major product replan

**Approval:** User approved the recommended Manual Opportunity Capture replan on 2026-08-24.

## 1. Issue Summary

The product was planned as a compliant, permitted-source job-discovery workspace. Review of the intended major job platforms established that broad automated retrieval is not a reliable MVP foundation: their terms can prohibit or require explicit approval for automated access. The practical user workflow is therefore to find a role externally, then save it into the private workspace.

## 2. Recommended Approach

Adopt **manual opportunity capture** as the MVP's sole job-intake path:

`Find externally → Add opportunity → paste posting URL and copied description → confirm locally structured details → fit → Resume Coach → external application handoff → Applied tracking`

The app must not fetch or parse a supplied URL by default. The URL is attribution and an outbound handoff. Any future company/ATS API, feed, or explicitly reviewed source adapter is a post-MVP enhancement, not a prerequisite.

## 3. Artifact Changes

### PRD

- Replace source discovery requirements FR-3 through FR-7 with manual opportunity capture, local structuring/confirmation, saved-opportunity library behavior, attribution, and optional duplicate review.
- Remove manual refresh, permitted-source configuration, source-policy setup, rate-limit enforcement, and source-outcome states from MVP scope.
- Preserve FR-8 through FR-16, changing their input from a retrieved Job Listing to a manually captured Opportunity where necessary.
- Replace the source-integration section with manual-capture boundaries: no automatic URL retrieval; copied text is user-provided; URL attribution is retained; incomplete details are marked Unknown.
- Defer approved company/ATS feeds and APIs to post-MVP.

### UX

- Keep **Jobs** as the primary destination but turn its first surface into an Opportunity Library with **Add opportunity** as the primary action.
- Replace **Browse / Refresh / source filters** with **All opportunities / Applied**, text search across saved records, and simple status/fit filters.
- Add a capture flow for URL + copied description, local extraction, an explicit confirmation screen, and error states for incomplete pasted content.
- Keep Job Detail, Resume Coach, Experience & Projects, Settings, and Google Sheets-in-Applied; update wording from retrieved listing to captured opportunity.
- Retire discovery-only UI states and mockups after the replacement visual references exist.

### Architecture

- Replace AD-5 Policy-gated discovery with a Manual Opportunity Capture boundary: explicit user input; local parsing; no background/URL retrieval; attribution and capture timestamp; immutable capture revision; optional duplicate suggestion.
- Preserve the local-first, evidence, provenance, export, Sheets, and outbound-handoff architecture decisions.

### Epics and Stories

- Preserve completed Epic 0 and Epic 2 stories as historical completed work; do not delete or rewrite their implementation history.
- Mark their source-discovery behavior as superseded for future work.
- Add **Epic 7: Manual Opportunity Workspace**:
  - **7.1 Reframe Jobs as an Opportunity Library**
  - **7.2 Capture an Opportunity from User-Provided Content**
  - **7.3 Confirm, Revise, and Preserve Captured Opportunity Details**
  - **7.4 Replace Discovery UX States with Capture and Library States**
- Update Epic 3 onward to consume a Captured Opportunity rather than a retrieved Job Listing. Story 3.2 must wait for Epic 7; Story 3.1 requires review against the revised opportunity model before it can be accepted.

### Sprint Status

- Add Epic 7 and Stories 7.1–7.4 as `backlog`.
- Keep completed stories as `done` but add an action item documenting supersession of discovery behavior.
- Keep Epic 3 in progress; flag Story 3.1 for revised-model review and hold Story 3.2 until Epic 7's capture model is available.

## 4. Impact and Risks

| Area | Impact |
|---|---|
| MVP scope | Reduced integration complexity; stronger dependable core workflow |
| Existing implementation | Completed discovery UI/domain work remains in history but must not be extended as the primary flow |
| Data model | Add immutable user-supplied capture revision and capture metadata; preserve existing listing-compatible provenance where possible |
| UX | Material Jobs-home replacement; other workspace flows remain intact |
| Risk | Medium: requires clear migration/empty-state behavior and revised fit input contracts |

## 5. Implementation Handoff

**Classification:** Major — PRD, UX, architecture, and backlog replan.

1. Update UX and PRD contracts.
2. Update architecture decision AD-5.
3. Update `epics.md`, affected story files, and `sprint-status.yaml`.
4. Create Story 7.1; implement Epic 7 in order before continuing Story 3.2.

## 6. Approval

Approval authorizes the contract and planning updates above. It does not authorize automatic retrieval, scraping, browser automation, or application submission.
