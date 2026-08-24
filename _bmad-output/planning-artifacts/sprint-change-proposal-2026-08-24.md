# Sprint Change Proposal — Career Workspace Experience

Date: 2026-08-24  
Project: Resume  
Change scope: Major product-experience correction

## 1. Issue Summary

The current product experience feels like a technical admin/API testing page: implementation-oriented forms, statuses, and inputs are more prominent than the career workflow Adrian is trying to complete. The user cannot immediately see the product vision or understand where jobs, applications, resume work, evidence, assistant guidance, and Google Sheets tracking belong.

The updated UX direction establishes a Jobs-first career workspace with a coherent application shell, human destination labels, progressive disclosure of technical metadata, and dedicated workspaces for applications, resume/evidence, Career Assistant, and Google Sheets.

## 2. Impact Analysis

### Epic impact

- Add foundational **Epic 0: Career Workspace Experience** before future feature work.
- Keep completed Epics 1 and 2 intact; no rollback is required.
- Epic 3 Story 3.1 is implemented and in review. Its result should be presented through the new Jobs workspace rather than treated as a standalone technical surface.
- Epic 3 Story 3.2 and later application/material/tracker stories should depend on the relevant Epic 0 shell/workspace stories.
- Existing Epics 4–6 remain valid, but their user-facing workspaces should consume the new shell and navigation.

### Artifact impact

- `DESIGN.md` and `EXPERIENCE.md` have been updated to define the Jobs-first shell and Career Assistant destination.
- `epics.md` must gain Epic 0 and seven stories.
- `sprint-status.yaml` must gain Epic 0 tracking entries and place it before the current implementation sequence.
- PRD goals remain compatible; no core product goal is removed. The change makes the existing product promise visible in the interface.
- Architecture requires no technology change. The shell is a presentation/application-layer correction that preserves the local-first modular monolith.

### Technical impact

- Add or refactor app-shell/navigation components and page-level composition.
- Reuse existing domain/persistence boundaries; do not expose database metadata as primary UI.
- Add or extend application records, tracker, assistant, and search surfaces as their existing epics are implemented.
- Preserve all existing tests and safety constraints while adding human-facing UI acceptance tests.

## 3. Recommended Approach

### Selected path: Direct adjustment with a new foundational epic

Add Epic 0 rather than rewriting completed stories or implementing a one-off visual patch. This preserves delivered backend work while establishing the experience layer that all later features depend on.

### Alternatives rejected

- **Rollback:** Not justified. The existing domain and persistence foundations are valuable and can support the improved UI.
- **PRD reduction:** Not necessary. The requested experience clarifies how the existing product goals should be presented rather than reducing MVP scope.
- **Ad-hoc quick development:** Insufficient for a cross-cutting shell and multiple workspaces because it would create inconsistent navigation and unclear dependencies.

## 4. Detailed Change Proposals

### Epic 0: Career Workspace Experience

**Goal:** Make the product feel like a polished career application centered on Jobs, with clear destinations for every major workflow.

### Story 0.1: Establish the application shell

Create consistent shell/navigation for Jobs, Applications, Resume, Evidence Library, Google Sheets, Career Assistant, and Settings. Jobs is the default destination; technical metadata is progressive disclosure; shell is responsive and accessible.

### Story 0.2: Build the Jobs-first home

Make Jobs the primary content surface with search, filters, result count, polished job cards, Fit Label/Freshness/source/location/work-style, truthful empty states, and secondary source controls.

### Story 0.3: Create the Applications workspace

Show applied roles, stages, dates, follow-ups, materials, interview rounds, and local/sync status. Keep local tracking usable when Google Sheets is unavailable.

### Story 0.4: Create the Resume and Evidence Library workspace

Separate Base Resume, editable versions, tailored materials, and evidence states. Guide project/experience-directory additions with provenance and individual review actions.

### Story 0.5: Add the Career Assistant workspace

Provide human-guided conversational workflows for adding directories, reviewing evidence proposals, and choosing explicit next actions. Assistant output remains a proposal until reviewed.

### Story 0.6: Create the Google Sheets workspace

Provide connection identity, account/scope/sheet preview, tracker status, per-item sync outcome, conflict/recovery messaging, and optional connection without blocking local tracking.

### Story 0.7: Humanize content, states, and responsive behavior

Replace technical wording with human-oriented microcopy, progressive disclosure, clear recovery, consequence-specific confirmation, responsive layouts, and accessible status/focus behavior across the shell and major surfaces.

## 5. Dependencies and Sequencing

1. Story 0.1 establishes the shell.
2. Story 0.2 uses the shell and existing Job Listing/Fit Assessment foundations.
3. Story 0.4 uses existing Epic 1 resume/evidence functionality.
4. Story 0.3 uses future Epic 5 application-domain work but can establish the workspace frame earlier.
5. Story 0.5 uses the existing evidence-documenter/local-model boundaries.
6. Story 0.6 uses future Epic 6 Google Sheets integration.
7. Story 0.7 cross-cuts all preceding stories and should be completed incrementally as each surface is built, with a final pass after the shell is in place.

## 6. Implementation Handoff

**Classification:** Major backlog reorganization with direct Developer implementation after approval.

- Product/PO: maintain Epic 0 scope and confirm navigation/workspace priorities.
- UX: maintain `DESIGN.md` and `EXPERIENCE.md`; produce screen-level decisions or mocks where layout is consequential.
- Architect: confirm shell/page composition fits the local-first modular monolith; no new infrastructure is implied.
- Developer: create stories from Epic 0, implement Story 0.1 first, preserve existing domain behavior, and add UI-focused tests alongside implementation.
- QA/reviewer: validate user journeys visually and behaviorally, not only API/domain contracts.

## 7. Success Criteria

- Opening the app immediately communicates that it is a career workspace and shows Jobs first.
- Adrian can find search, filters, and primary destinations without reading implementation details.
- Applications, Resume, Evidence Library, Career Assistant, and Google Sheets each have a clear home.
- Technical metadata remains available for trust and provenance but does not dominate the first view.
- Existing local-first safety, provenance, accessibility, and regression guarantees remain intact.
- A human reviewing the running app can understand the product vision without inspecting source code or tests.

## 8. Checklist Status

- [x] Trigger and context understood
- [x] Epic impact assessed
- [x] PRD, architecture, and UX impacts assessed
- [x] Direct adjustment, rollback, and MVP-review options evaluated
- [x] Seven Epic 0 story proposals reviewed incrementally and approved by Adrian
- [x] Final user approval of this complete proposal
- [x] Apply approved changes to `epics.md` and `sprint-status.yaml`
