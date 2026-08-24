---
stepsCompleted: [1, 2, 3, 4]
inputDocuments:
  - _bmad-output/specs/spec-personal-job-discovery-and-application-materials-tool/SPEC.md
  - _bmad-output/specs/spec-personal-job-discovery-and-application-materials-tool/acceptance-criteria.md
  - _bmad-output/planning-artifacts/prds/prd-Resume-2026-08-06/prd.md
  - _bmad-output/planning-artifacts/architecture/architecture-Resume-2026-08-07/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/ux-designs/ux-Resume-2026-08-06/DESIGN.md
  - _bmad-output/planning-artifacts/ux-designs/ux-Resume-2026-08-06/EXPERIENCE.md
---

# Personal Job Discovery and Application Materials Tool - Epic Breakdown

## Overview

This document decomposes the local-only browser MVP into implementation epics and stories. CAP-1 through CAP-16 and architecture AD-1 through AD-10 are binding.

## Requirements Inventory

### Functional Requirements

FR-1: Import Base Resume/supporting material and individually approve, edit, add, remove, or reject evidence with source reference and review state.

FR-2: Preserve Base Resume as immutable and create tailored materials as separate identifiable versions.

FR-3: Configure Philippines-first fresh-graduate role, country, work-style, and NCR preferences.

FR-4: Start a selected-source manual refresh and show source-level running/completed/partial/failed outcomes without scheduling, polling, background refresh, or automatic retry.

FR-5: Normalize listings, preserve attribution/original URL/Freshness, expose unknown fields, and group probable duplicates without deleting source records.

FR-6: Enable only source configurations with approved access method, policy metadata, rate limit, and enabled state.

FR-7: Enforce source policy/rate limits, stop blocked/throttled/disallowed sources, and retain successful results from other sources.

FR-8: Calculate visible Strong/Potential/Stretch labels from evidence, requirements, gaps, seniority, location/work style, and Freshness without hiring predictions.

FR-9: Explain each fit result with evidence links, short posting excerpts, gaps/uncertainty, seniority, location/work style, and Freshness.

FR-10: Generate traceable local drafts using only approved evidence and relevant listing language.

FR-11: Prevent fabricated/deceptive ATS content and surface detectable unsupported user edits without removing editing control.

FR-12: Require review acknowledgement and resolved blocking warnings before explicit versioned LaTeX/PDF export.

FR-13: Maintain local application stage, notes, follow-ups, attached Material Versions, and ordered Interview Rounds.

FR-14: Connect/revoke a selected or app-created Google Sheet through Desktop OAuth with Sheets scope only and verified edit access.

FR-15: Mirror tracker data idempotently to Sheets, preserve local authority on failure, and require explicit conflict reconciliation.

FR-16: Open the original application URL as an outbound handoff with no form completion or submission.

### NonFunctional Requirements

NFR-1: Run locally on `127.0.0.1`; SQLite and private OS-user app-data are authoritative, with no public deployment or product login.

NFR-2: Store OAuth and LM Studio tokens in the OS credential vault, exclude tokens/raw documents/prompts/model responses from logs, and remove local OAuth credentials on revocation.

NFR-3: Send only selected listing and approved evidence to local LM Studio after first-use/model-change disclosure; no cloud fallback, LAN serving, model tools/MCP, or automatic retry.

NFR-4: Treat all model output as untrusted until local evidence/provenance validation passes.

NFR-5: Preserve successful partial refresh data, unsaved draft edits, approved drafts, and local records through source, model, rendering, OAuth, and Sheets errors.

NFR-6: Use idempotent entity identity/revision/hash conventions and user-visible reconciliation to prevent duplicate or silently overwritten records.

NFR-7: Meet WCAG 2.2 AA intent: semantic labels, keyboard operation, visible focus, readable errors, accessible contrast, programmatic statuses, and responsive reflow.

NFR-8: Audit refresh, evidence review, fit calculation, model generation, export, Sheets, OAuth, recovery, and deletion as local append-only metadata without sensitive content.

NFR-9: Keep active data until user deletion; ordinary delete enters 30-day local trash, sensitive content can be permanently deleted after confirmation, and local backup is available only within the Windows OS-account/full-disk-encryption boundary. The MVP does not create portable or application-encrypted backup archives.

### Additional Requirements

- Implement the local-first modular monolith in architecture AD-1 through AD-10: Next.js App Router on loopback, SQLite, private app-data, policy-gated source adapters, LM Studio Qwen3.5-9B, local TeXworks rendering, Google Sheets adapter, OS vault, and audit module.
- All state mutation follows UI action → domain command → SQLite transaction → audit event → optional visible adapter attempt; adapters are never authoritative.
- Use UUIDv7, UTC ISO 8601 storage, immutable evidence/material revisions, and provenance links from claim to evidence and listing excerpt.
- Sheets uses the Applications, Materials, Follow-ups, and Interview Rounds tabs, stable UUID/revision/hash identities, user-pasted URL/ID or app-created workbook, and local-vs-Sheet reconciliation.
- `resume.tex` is the immutable Base Resume; create a matching `cover-letter.tex`; deterministic renderer escapes structured local-model content and stores source/PDF/manifests per Material Version.
- Resolve the initial permitted-source catalog and per-source policy/rate budget before enabling an adapter.
- Resolve the TeXworks compiler command/path in first-run setup before export.
- Resolve application-level encryption at rest before use on a shared or unencrypted device.

### UX Design Requirements

UX-DR1: Implement the supplied sober document-oriented design tokens for surfaces, ink, semantic status colors, typography, spacing, radius, and visible focus; status color never carries meaning alone.

UX-DR2: Provide responsive primary navigation and tables/stacked records without hiding required title, company, Fit Label, Freshness, source, provenance, status, or actions.

UX-DR3: Implement manual refresh and source outcome controls with visible selected scope, timestamp, state, recovery action, and partial-result preservation.

UX-DR4: Implement listing rows, duplicate groups, and Job Listing detail with readable source attribution, unknown values, Freshness, and inspectable duplicate evidence.

UX-DR5: Implement a Fit Explanation panel with matched evidence, gaps/uncertainty, seniority, location/work style, Freshness, short source language, and non-predictive definition.

UX-DR6: Implement evidence-review rows that distinguish extracted/user-entered facts and expose individual approve/edit/add/remove/reject actions.

UX-DR7: Implement draft claim/provenance inspection, anchored blocking claim warnings, and a review sequence from summary through repair to export.

UX-DR8: Implement explicit approval/export controls that explain blocked state and require renewed acknowledgement after material edit.

UX-DR9: Implement grouped application-record editing for stage, notes, follow-ups, Material Versions, and keyboard-operable ordered Interview Rounds.

UX-DR10: Implement Google connection/sync status with account/sheet identity, last attempt/outcome, entity error, local/remote data consequence, and recovery action.

UX-DR11: Implement confirmation dialogs for authorization, revocation, export, discard, deletion, and duplicate override; cancel leaves data unchanged and restores focus.

UX-DR12: Implement first-use/empty/loading/partial/error/recovery states described in the UX contract without implying background work or fabricating data.

UX-DR13: Implement accessible status announcements, descriptive provenance links, programmatically associated validation errors, contained modal focus, and 24px targets or spacing exception.

UX-DR14: Ensure draft editor, filters, tables, source links, OAuth entry, and recovery actions work without a pointer and reflow without loss at magnification.

UX-DR15: Present the product as a Jobs-first career workspace with a coherent application shell, human-oriented navigation, progressive disclosure of technical metadata, dedicated Applications/Resume/Evidence/Career Assistant/Google Sheets destinations, and accessible responsive behavior.

### FR Coverage Map

FR-1: Epic 1 - Private career evidence workspace.

FR-2: Epic 1 - Private career evidence workspace.

FR-3: Epic 2 - Compliant job discovery.

FR-4: Epic 2 - Compliant job discovery.

FR-5: Epic 2 - Compliant job discovery.

FR-6: Epic 2 - Compliant job discovery.

FR-7: Epic 2 - Compliant job discovery.

FR-8: Epic 3 - Evidence-based role decisions.

FR-9: Epic 3 - Evidence-based role decisions.

FR-10: Epic 4 - Truthful tailored application materials.

FR-11: Epic 4 - Truthful tailored application materials.

FR-12: Epic 4 - Truthful tailored application materials.

FR-13: Epic 5 - Local application tracking.

FR-14: Epic 6 - Google Sheets tracker mirroring.

FR-15: Epic 6 - Google Sheets tracker mirroring.

FR-16: Epic 3 - Evidence-based role decisions.

## Epic List

### Epic 0: Career Workspace Experience

Adrian experiences the product as a polished career workspace: Jobs is the primary home, and every major workflow has a clear, human-oriented destination instead of appearing as a technical/admin surface.

**UX requirements covered:** UX-DR1, UX-DR2, UX-DR12, UX-DR13, UX-DR14, UX-DR15

### Epic 1: Private career evidence workspace

Adrian can manage a reviewed resume-evidence library, an editable versioned Current Base Resume, and local data/recovery.

**FRs covered:** FR-1, FR-2

### Epic 2: Compliant job discovery

Adrian can set preferences and manually discover eligible roles from permitted sources.

**FRs covered:** FR-3, FR-4, FR-5, FR-6, FR-7

### Epic 3: Evidence-based role decisions

Adrian can understand a role’s fit, save it, and deliberately continue on the employer’s site.

**FRs covered:** FR-8, FR-9, FR-16

### Epic 4: Truthful tailored application materials

Adrian can create, inspect, approve, and export provenance-backed resumes and cover letters.

**FRs covered:** FR-10, FR-11, FR-12

### Epic 5: Local application tracking

Adrian can maintain stages, notes, follow-ups, interview rounds, and attached Material Versions locally.

**FRs covered:** FR-13

### Epic 6: Google Sheets tracker mirroring

Adrian can explicitly connect and reconcile a user-owned Sheets mirror without losing local authority.

**FRs covered:** FR-14, FR-15

## Epic 0: Career Workspace Experience

Adrian can use a coherent Jobs-first application shell to discover roles, track applications, manage resume evidence, receive guided assistance, and understand Google Sheets synchronization.

### Story 0.1: Establish the application shell

As Adrian,
I want a coherent application shell with clear navigation,
so that the product feels like one career workspace rather than a collection of technical pages.

**Acceptance Criteria:**

**Given** Adrian opens the app
**When** the workspace loads
**Then** Jobs is the default destination.

**Given** the primary navigation
**When** Adrian selects a destination
**Then** the shell provides clear tabs for Jobs, Applications, Resume, Evidence Library, Google Sheets, Career Assistant, and Settings.

**Given** any screen
**When** it renders
**Then** it uses a consistent header, page title, navigation state, content hierarchy, and responsive layout.

**Given** technical metadata such as revision IDs, digests, or source-policy details
**When** Adrian needs to inspect it
**Then** it is progressively disclosed rather than presented as primary content.

**Given** keyboard, screen-reader, or narrow-viewport use
**When** Adrian navigates
**Then** the shell remains operable and understandable.

### Story 0.2: Build the Jobs-first home

As Adrian,
I want to discover and compare job postings from the first screen,
so that the application immediately helps me make progress toward a role.

**Acceptance Criteria:**

**Given** Adrian opens Jobs
**When** the page loads
**Then** the primary focus is a search bar and job-results workspace, not technical configuration forms.

**Given** saved listings exist
**When** Adrian views Jobs
**Then** each card clearly presents title, company, location, work style, Fit Label, Freshness, source, and the next relevant action.

**Given** Adrian enters a search or selects filters
**When** results update
**Then** the active query, filters, result count, and empty state are clear.

**Given** no results match
**When** the result state renders
**Then** it distinguishes first use, no saved listings, and no matches for the current search/filter.

**Given** Adrian needs source configuration or refresh controls
**When** he wants them
**Then** they are available without competing with the primary Jobs workflow.

### Story 0.3: Create the Applications workspace

As Adrian,
I want to see every role I have applied to in one place,
so that I can track progress and follow-ups without reconstructing it manually.

**Acceptance Criteria:**

**Given** Adrian opens Applications
**When** the page loads
**Then** it shows applied roles with company, application stage, applied date, next follow-up, and linked materials.

**Given** an application has interviews
**When** Adrian opens it
**Then** ordered interview rounds, dates, status, outcome, notes, and next action are easy to inspect.

**Given** Google Sheets is unavailable or disconnected
**When** Adrian uses Applications
**Then** local tracking remains usable and sync state/recovery is visible.

**Given** no applications exist
**When** the page loads
**Then** it explains the empty state and routes Adrian back to Jobs.

### Story 0.4: Create the Resume and Evidence Library workspace

As Adrian,
I want a clear place to manage my resume and supporting evidence,
so that I can strengthen my materials without losing provenance.

**Acceptance Criteria:**

**Given** Adrian opens Resume
**When** the page loads
**Then** the Current Base Resume, editable versions, and tailored materials are clearly separated.

**Given** Adrian opens Evidence Library
**When** the page loads
**Then** approved, unreviewed, rejected, and removed evidence states are understandable without technical database language.

**Given** Adrian adds a project or experience directory
**When** the workflow starts
**Then** the app explains what will be inspected, what remains unchanged, and what evidence may be proposed.

**Given** evidence is proposed or edited
**When** Adrian reviews it
**Then** source references and individual review actions are visible at the point of decision.

**Given** Adrian works on Resume
**When** he moves through resume sections or reviews a change
**Then** a labelled guided stepper, evidence/skill chips, and a revision-aware local editor-and-preview workspace make the next action and review state clear without hiding provenance or individual actions.

**Given** a Resume preview cannot safely render or Adrian uses a narrow viewport
**When** he reviews the resume
**Then** the app preserves edits, shows a safe text/failure view when needed, and provides an accessible review summary and labelled jumps to Editor, Preview, Warnings, and Provenance before stacking the workspace.

### Story 0.5: Add the Career Assistant workspace

As Adrian,
I want guided help for organizing projects and evidence,
so that I can complete complex resume tasks without navigating technical workflows.

**Acceptance Criteria:**

**Given** Adrian opens Career Assistant
**When** the page loads
**Then** it explains the assistant’s purpose in human terms and offers clear starting actions.

**Given** Adrian wants to add project evidence
**When** he chooses that workflow
**Then** the assistant names the selected local directory, bounded inspection scope, non-mutation guarantee, and review process before any explicit inspection begins.

**Given** the assistant proposes evidence
**When** results are returned
**Then** Adrian can inspect, approve, edit, reject, or cancel each proposal individually.

**Given** assistant output is shown
**When** Adrian reviews it
**Then** it is clearly labeled as a proposal and never presented as verified fact automatically.

**Given** Career Assistant has no selected folder, cannot inspect a folder, finds no evidence, is cancelled, or returns partial results
**When** its state appears
**Then** Adrian receives plain-language explanation and a safe next action; no remote-model fallback, automatic scan, or automatic mutation occurs.

### Story 0.6: Create the Google Sheets workspace

As Adrian,
I want a clear tracker connection area,
so that I understand what is mirrored to Google Sheets and whether synchronization is healthy.

**Acceptance Criteria:**

**Given** Adrian opens Google Sheets
**When** the page loads
**Then** it clearly shows connection state, selected account, spreadsheet, worksheet, granted scope, and last sync outcome.

**Given** Adrian connects Google Sheets
**When** authorization begins
**Then** the app previews the account, requested permissions, target sheet, and data categories before commitment.

**Given** a sync fails, conflicts, or permissions change
**When** the result is shown
**Then** affected records, local preservation behavior, and safe recovery action are clear.

**Given** no connection exists
**When** Adrian opens the workspace
**Then** local tracking remains available and connection is optional.

**Given** the shared visual system renders Google Sheets
**When** Adrian views a connection or sync outcome on any viewport
**Then** it reuses the accessible dark shell, affirmative/danger action hierarchy, human-readable state, and responsive record rules without changing local authority, consent, or reconciliation behavior.

### Story 0.7: Polish the shared visual system, content, states, and responsive behavior

As Adrian,
I want the application to explain actions and outcomes in plain language,
so that I always understand what happened and what I can do next.

**Acceptance Criteria:**

**Given** any page or action
**When** status, error, empty, loading, or recovery content appears
**Then** it uses human-oriented language and identifies the next action.

**Given** technical metadata exists
**When** Adrian needs it
**Then** it is available through progressive disclosure without dominating the primary workflow.

**Given** desktop, tablet, phone, keyboard, zoom, or screen-reader use
**When** Adrian navigates the app
**Then** content, focus, controls, and status remain usable at 320 CSS px and 400% zoom; Jobs and Applications retain all required information as labelled cards without unjustified two-dimensional scrolling.

**Given** the application shell and major surfaces
**When** visual review occurs
**Then** the UI reads as one coherent product rather than unrelated technical panels, using the dark premium header, AA-compliant warm affirmative actions, evidence/skill chips where useful, and a distinct danger treatment for irreversible actions.

**Given** the integrated workspaces are validated
**When** visual and regression testing runs
**Then** contrast, keyboard/screen-reader paths, compact navigation, long values, stale-preview/warning flow, and no network/automatic scan/fallback regressions are covered.

## Epic 1: Private career evidence workspace

Adrian can manage a protected Base Resume, review candidate evidence, and control local data/recovery.

### Story 1.1: Start a private local workspace

As Adrian,
I want to launch the workspace locally and understand its storage-protection posture,
So that I know my career data is not exposed by a public service.

**Acceptance Criteria:**

**Given** the app is launched on Adrian’s computer
**When** he opens the workspace
**Then** it is reachable only through `127.0.0.1` and does not provide public hosting or a product sign-in route.

**Given** first use on a device
**When** the workspace initializes its local data area
**Then** it creates or validates the private app-data location and SQLite authority without transmitting career data externally.

**Given** the storage-protection setup
**When** Adrian reviews it
**Then** the UI states that the OS account is the current access boundary and identifies application-level encryption at rest as required before use on a shared or unencrypted device.

**Given** any local initialization event
**When** it succeeds or fails
**Then** the UI provides an accessible status/recovery message and the audit log records metadata only.

### Story 1.2: Import and preserve the Base Resume

As Adrian,
I want to import my existing LaTeX resume as a protected Base Resume,
So that tailoring never damages my original source or formatting.

**Acceptance Criteria:**

**Given** the local workspace is available
**When** Adrian imports `resume.tex` and its supported companion output/source files
**Then** the app records immutable source metadata, a content digest, import time, and its private local location.

**Given** an imported Base Resume
**When** Adrian views it in Candidate Profile
**Then** it is visibly read-only and distinct from drafts and Material Versions.

**Given** a malformed, unreadable, or duplicate source import
**When** Adrian attempts the import
**Then** the app preserves existing Base Resumes, explains the affected file and safe next action, and records metadata-only audit output.

**Given** the import UI
**When** it is used with keyboard or a screen reader
**Then** file-selection state, validation errors, and the read-only status are programmatically available.

### Story 1.3: Review candidate evidence

As Adrian,
I want to review individual extracted and user-entered facts,
So that only truthful, supported evidence is eligible for future fit and material claims.

**Acceptance Criteria:**

**Given** an imported Base Resume or supporting material
**When** candidate facts are extracted or Adrian adds one manually
**Then** each evidence record identifies its origin, source document/section, factual text, revision, and review state.

**Given** an unreviewed evidence record
**When** Adrian approves, edits, rejects, removes, or adds evidence
**Then** the action is individual, auditable, and produces a new immutable revision where content changes.

**Given** evidence is unreviewed or rejected
**When** any later module requests claim-eligible facts
**Then** that evidence is excluded.

**Given** the evidence-review interface
**When** it renders extracted versus user-entered facts
**Then** the distinction, state, action, and validation feedback do not rely on color alone and are keyboard-operable.

### Story 1.4: Control local data, recovery, and audit history

As Adrian,
I want to inspect, export, restore, and delete my local career data through the workspace,
So that I remain in control of sensitive records and can recover from mistakes.

**Acceptance Criteria:**

**Given** local records, files, or audit events exist
**When** Adrian opens Data & Storage
**Then** it identifies each data class, local/recovery location, storage usage, and connected-service consequence.

**Given** Adrian deletes a non-sensitive item
**When** he confirms deletion after seeing dependent drafts/material versions
**Then** it moves to a local trash recoverable for 30 days and never mutates the Base Resume.

**Given** Adrian requests backup, permanent deletion, or activity-history export
**When** the action completes
**Then** backup remains local to the protected device and states that it relies on the Windows OS-account/full-disk-encryption boundary; sensitive content effects are explicit, and audit output excludes OAuth tokens, prompts, and model responses.

### Story 1.5: Build Resume Evidence Library

As Adrian,
I want to add and review project and experience evidence in one managed library,
So that later base-resume updates and tailored resumes can accurately use my factual record.

**Acceptance Criteria:**

**Given** the local workspace is available
**When** Adrian adds a project or experience
**Then** the UI offers separate explicit actions, records source and review provenance, and does not silently scan or modify selected folders.

**Given** Adrian adds Markdown project or experience documents
**When** the app explicitly imports them into `resume-evidence/`
**Then** it preserves source file/section provenance, creates unreviewed evidence candidates, leaves original selected folders unchanged, and requires individual approval before any fact can support later work.

**Given** a directory contains unsupported, unsafe, unreadable, or duplicate content
**When** Adrian attempts an explicit import or refresh
**Then** existing library/evidence state is preserved, the affected item receives safe recovery guidance, and the app never silently scans or watches directories.

### Story 1.6: Parse and Version Current Base Resume

As Adrian,
I want to parse a readable PDF into an editable, versioned current base resume,
So that tailored materials start from a curated professional narrative without overwriting historical sources.

**Acceptance Criteria:**

**Given** a readable PDF selected as the current resume source
**When** it is imported or updated
**Then** a local parser derives a structured editable draft; unreadable/scanned PDFs preserve the existing state and receive accessible recovery guidance.

**Given** approved evidence and an editable base-resume draft
**When** Adrian explicitly updates the Current Base Resume
**Then** the app proposes evidence-backed changes for individual review and creates a retained new version only after approval.

**Given** a later tailored Material Version
**When** it is inspected
**Then** it identifies the exact Current Base Resume version and approved evidence revisions that supported it.

### Story 1.7: Document Project for Resume

As Adrian,
I want to optionally analyze a selected project/document folder with my local model,
So that I can add standardized proposed evidence without altering the original project.

**Acceptance Criteria:**

**Given** Adrian chooses Document for Resume from Add Project
**When** he selects a folder and explicitly confirms the local-model disclosure
**Then** the app processes only that selection, proposes standardized evidence with source references and unknowns, keeps the original folder unchanged, and requires review before persistence.

### Story 1.8: Create Resume Evidence Documenter Skill

As Adrian,
I want a reusable Codex skill based on `bmad-document-project`,
So that I can document project folders into the same resume-evidence format outside the application.

**Acceptance Criteria:**

**Given** a project/document folder
**When** the skill is invoked
**Then** it uses evidence-first brownfield inspection and produces the approved project overview, resume evidence, and factual bullet-candidate Markdown without altering the source folder.

## Epic 2: Compliant job discovery

Adrian can set preferences and manually discover eligible roles from permitted sources.

### Story 2.1: Set job eligibility preferences

As Adrian,
I want to configure my target roles, location, and work-style preferences,
So that discovery prioritizes opportunities I can realistically pursue.

**Acceptance Criteria:**

**Given** first use or Search Preferences
**When** Adrian views defaults
**Then** fresh-graduate, junior, associate, cadetship, paid-training, Philippines-first, remote-first, and NCR hybrid/onsite priorities are shown and editable.

**Given** Adrian changes a preference
**When** he saves it
**Then** the local preference revision is retained, auditable, and does not weaken any source-policy rule.

### Story 2.2: Approve permitted discovery sources

As Adrian,
I want to configure sources only after their allowed access method is recorded,
So that job discovery remains compliant with source policy.

**Acceptance Criteria:**

**Given** the Permitted Sources view
**When** Adrian adds or edits a source
**Then** it requires type, URL, approved method, policy review date/revision, request budget/rate limit, retention rule, enabled state, and failure guidance.

**Given** the initial source catalog is unresolved or a source policy is unknown/disallowed
**When** Adrian attempts to enable it
**Then** the app keeps it disabled and identifies browser handoff/manual import as the only available path.

**Given** a source is approved for an API, feed, or policy-reviewed HTML method
**When** it is enabled
**Then** its adapter can use only that recorded method and budget.

### Story 2.3: Run a bounded source refresh

As Adrian,
I want to explicitly refresh selected sources,
So that I can see current eligible listings without background retrieval.

**Acceptance Criteria:**

**Given** one or more enabled permitted sources
**When** Adrian selects Refresh now and confirms the source scope
**Then** one bounded Refresh Run starts and shows per-source running, completed, partial, failed, blocked, or throttled status with timestamps.

**Given** a source exceeds its budget, is throttled, blocked, or becomes policy-uncertain
**When** its adapter detects the condition
**Then** that adapter stops with source-compatible guidance while other selected sources retain their successful results.

**Given** a Refresh Run ends or fails
**When** Adrian returns later
**Then** no scheduler, poller, background retry, credential reuse, proxy, or access-control bypass has been created.

### Story 2.4: Inspect normalized job listings

As Adrian,
I want to browse normalized listings and inspect probable duplicates,
So that I can review opportunities without losing source context.

**Acceptance Criteria:**

**Given** a completed or partial refresh or a manual import
**When** listings are displayed
**Then** each shows title, company, work style/location when known, source, original URL, and Freshness; missing details read Unknown.

**Given** probable duplicates
**When** Adrian opens a duplicate group
**Then** all retained source records remain inspectable and an override is explicit, confirmed, auditable, and reversible where feasible.

**Given** a site is a browser-handoff/manual-import source
**When** Adrian adds a listing
**Then** the local form preserves its source attribution and never expands that action into automated crawling.

## Epic 3: Evidence-based role decisions

Adrian can understand a role’s fit, save it, and deliberately continue on the employer’s site.

### Story 3.1: Calculate a versioned fit assessment

As Adrian,
I want a deterministic fit label for a listing,
So that I can prioritize roles from supported evidence rather than a hiring prediction.

**Acceptance Criteria:**

**Given** a Job Listing and Candidate Profile evidence revisions
**When** a fit assessment is calculated
**Then** it snapshots listing, evidence, preferences, ruleset, factor outcomes, label, confidence/Freshness, and calculation time.

**Given** assessed factors
**When** Strong, Potential, or Stretch is displayed
**Then** Strong has substantial supported alignment with no known disqualifier, Potential has meaningful alignment with a material gap/uncertainty, and Stretch has significant evidence/seniority/location mismatch.

**Given** unknown or stale information
**When** fit is calculated
**Then** it lowers confidence or remains disclosed and is never assumed favorable.

### Story 3.2: Inspect fit provenance and decide to pursue

As Adrian,
I want to inspect fit evidence and save or hand off a listing,
So that I can make an informed personal decision.

**Acceptance Criteria:**

**Given** a calculated assessment
**When** Adrian opens Fit Explanation
**Then** matched evidence, gaps/uncertainty, seniority, work-style/location, Freshness, and short posting excerpts are separate and accessible.

**Given** a matched fact or requirement summary
**When** Adrian follows its provenance link
**Then** it identifies the approved evidence revision or the relevant source excerpt/original URL.

**Given** a Potential or Stretch listing
**When** Adrian saves it, sets personal priority, or opens the original link
**Then** the personal state remains separate from the calculated label and the outbound handoff names its host and never prefills or submits an employer form.

## Epic 4: Truthful tailored application materials

Adrian can create, inspect, approve, and export provenance-backed resumes and cover letters.

### Story 4.1: Connect the local drafting model safely

As Adrian,
I want to configure and verify my local LM Studio model,
So that drafting stays on my computer and fails safely when unavailable.

**Acceptance Criteria:**

**Given** AI settings or a first draft request
**When** Adrian configures LM Studio
**Then** the app verifies a loopback-only endpoint, Qwen3.5-9B availability, and an OS-vault token without exposing the token in UI or logs.

**Given** first use or a model/endpoint change
**When** Adrian reviews generation disclosure
**Then** it shows endpoint, model, and exact selected listing/evidence data categories before an explicit generation request.

**Given** LM Studio is unavailable or unsafe configuration is detected
**When** generation is attempted
**Then** no cloud fallback or automatic retry occurs and the user receives a manual-drafting/settings recovery path.

### Story 4.2: Generate provenance-backed draft content

As Adrian,
I want a tailored draft generated from approved evidence and the selected listing,
So that I start from relevant but truthful content.

**Acceptance Criteria:**

**Given** a saved Job Listing and approved evidence
**When** Adrian explicitly requests a resume or cover-letter draft
**Then** the local model receives only the selected listing and approved evidence and returns structured content for local validation.

**Given** generated content
**When** the app validates candidate-facing claims
**Then** every claim must link to approved evidence and relevant listing language must link to an excerpt; unsupported content is a blocking warning.

**Given** Adrian edits a draft
**When** detectable unsupported text is introduced
**Then** the app preserves editing control, anchors the warning to the content, and prevents export-ready status until repaired or removed.

### Story 4.3: Render versioned LaTeX materials

As Adrian,
I want my approved draft content placed into consistent LaTeX templates,
So that resume and cover-letter formatting remains professional and repeatable.

**Acceptance Criteria:**

**Given** first-run export setup
**When** Adrian identifies the TeXworks compiler command/path
**Then** the app validates it against `resume.tex`, records a non-secret toolchain fingerprint, and blocks rendering with actionable setup guidance if validation fails.

**Given** structured validated content
**When** a tailored resume or cover letter is rendered
**Then** the deterministic renderer escapes content into a versioned resume-template copy or matching `cover-letter.tex`; the model does not author executable TeX.

**Given** compilation fails
**When** Adrian reviews the error
**Then** the approved draft and metadata remain intact and the failure identifies the format and safe retry path.

### Story 4.4: Approve and export immutable Material Versions

As Adrian,
I want to explicitly approve and export reviewed materials,
So that every file I use is traceable and does not overwrite earlier work.

**Acceptance Criteria:**

**Given** a draft with provenance
**When** Adrian completes the accessible review summary
**Then** he can inspect claim count, provenance links, and blocking warnings before acknowledging review.

**Given** unresolved blocking warnings or an unacknowledged material edit
**When** Adrian attempts export
**Then** export controls explain why they are unavailable and route to repair or review.

**Given** an acknowledged, warning-free draft
**When** Adrian explicitly exports
**Then** a new immutable Material Version contains `.tex`, PDF, content manifest, template digest, provenance manifest, and audit metadata without overwriting Base Resume or previous versions.

## Epic 5: Local application tracking

Adrian can maintain stages, notes, follow-ups, interview rounds, and attached Material Versions locally.

### Story 5.1: Save and update a local application record

As Adrian,
I want to save a listing and maintain its application stage, notes, and attached materials,
So that my application history remains under my control.

**Acceptance Criteria:**

**Given** a Job Listing
**When** Adrian saves it
**Then** one local Application Record is created or opened without changing its Fit Label or submitting an external application.

**Given** a saved application
**When** Adrian sets stage, adds local notes, or attaches a Material Version
**Then** the local revision, timestamp, and metadata-only audit event are recorded idempotently.

**Given** the application editor
**When** it reflows or is used without a pointer
**Then** labels, current stage, notes, versions, status, and actions remain available.

### Story 5.2: Manage follow-ups and interview rounds

As Adrian,
I want to record follow-ups and ordered interview rounds,
So that I can manage my next actions and history for each application.

**Acceptance Criteria:**

**Given** a saved Application Record
**When** Adrian adds, completes, or edits a follow-up
**Then** due date, status, notes, and application association are retained locally.

**Given** an Application Record
**When** Adrian adds or changes an Interview Round
**Then** ordinal, date, type/stage, outcome/status, notes, and next action are retained; many rounds are supported.

**Given** two or more Interview Rounds
**When** Adrian reorders them
**Then** keyboard-operable Move up/Move down controls preserve a clear ordered result and audit the change.

## Epic 6: Google Sheets tracker mirroring

Adrian can explicitly connect and reconcile a user-owned Sheets mirror without losing local authority.

### Story 6.1: Authorize and identify a Sheets tracker

As Adrian,
I want to explicitly connect a spreadsheet I create or identify,
So that I can mirror records without granting unrelated Google access.

**Acceptance Criteria:**

**Given** no Google connection
**When** Adrian begins connection
**Then** the UI names the Desktop OAuth loopback flow, Sheets-only scope, selected data categories, notes default, create-versus-paste-ID behavior, and local/remote retention consequences.

**Given** Adrian authorizes Google
**When** OAuth completes, is denied, expires, or is insufficient
**Then** refresh credentials are stored only in the OS vault, local data remains intact, and clear reconnect/retry guidance is shown.

**Given** a pasted spreadsheet URL/ID or app-created tracker
**When** the app validates it
**Then** edit access is verified before sync and account/spreadsheet/worksheet identity is displayed.

### Story 6.2: Create an idempotent tracker mirror

As Adrian,
I want my local tracker entities mirrored in a stable readable Sheet structure,
So that repeated syncs do not create duplicate application history.

**Acceptance Criteria:**

**Given** verified edit access
**When** Adrian creates or initializes the tracker
**Then** Applications, Materials, Follow-ups, and Interview Rounds tabs and schema/version metadata are created or validated without altering unrelated sheet content.

**Given** a local entity changes and Adrian triggers its visible sync attempt or Sync now
**When** the write succeeds
**Then** stable UUID, local revision, content hash, timestamp, and row metadata identify the same logical row on repeated sync.

**Given** notes have not been individually opted into mirroring
**When** a record syncs
**Then** those notes remain local-only.

### Story 6.3: Reconcile sync failures and remote divergence

As Adrian,
I want to understand and reconcile Sheets failures or manual sheet edits,
So that I never lose my local record or silently overwrite a conflicting value.

**Acceptance Criteria:**

**Given** a Sheets write, access, or network failure
**When** sync ends
**Then** the local authoritative mutation persists, the affected entity/error/last attempt is shown, and retry/reconnect remains an explicit action.

**Given** a mirrored row differs from its prior local revision/hash
**When** the app detects divergence
**Then** it presents local-versus-Sheet values and requires Adrian to keep local or adopt the Sheet value as a new local revision before re-syncing.

**Given** Adrian revokes the connection
**When** revocation completes
**Then** the local token and sync state are removed, unsynchronized changes are identified, and the UI explains that existing remote Sheet data remains under his Google account.

## Approved Change - 2026-08-24: Manual Opportunity Capture MVP

The completed discovery work in Epic 2 remains historical implementation and must not be deleted. Its future source-configuration, refresh, and adapter behavior is superseded. The forward MVP is manual opportunity capture: user-provided URL plus copied description, local structuring and confirmation, then fit, Resume Coach, handoff, and tracking.

### Epic 7: Manual Opportunity Workspace

Adrian can save roles he finds externally and turn them into trustworthy local Opportunities without the app retrieving a website.

**Dependencies:** Epic 1 evidence/base-resume foundation. Epic 3 fit work consumes the resulting Opportunity model. Existing Epic 2 manual-import persistence may be reused only where it does not retain source-configuration or refresh requirements.

### Story 7.1: Reframe Jobs as an Opportunity Library

As Adrian,
I want Jobs to show opportunities I have saved,
So that the product is honest about what it knows and I can quickly continue my job search.

**Acceptance Criteria:**

**Given** Jobs opens with no saved Opportunities
**When** Adrian views the page
**Then** it explains that saved opportunities appear here and offers **Add opportunity** as the primary action; it does not show refresh, source selection, or a claimed external result count.

**Given** saved Opportunities exist
**When** Adrian searches, filters, or opens All opportunities / Applied
**Then** those controls operate only on local records and preserve title, company, location/work style, capture date, Fit Label when calculated, and original URL attribution.

### Story 7.2: Capture an Opportunity from User-Provided Content

As Adrian,
I want to paste a job URL and copied description,
So that I can turn an externally found role into a local Opportunity without scraping it.

**Acceptance Criteria:**

**Given** Adrian selects Add opportunity
**When** he supplies a valid URL and copied job-description text
**Then** the app performs no network, browser, source-adapter, refresh, credential, or background action.

**When** the capture is submitted
**Then** local parsing prepares a reviewable structured draft and preserves the original URL plus captured timestamp.

**Given** URL or copied description is missing/invalid
**When** validation fails
**Then** entered local content is preserved, the field-level issue is accessible, and no Opportunity is created.

### Story 7.3: Confirm and Preserve Captured Opportunity Details

As Adrian,
I want to verify the fields derived from my pasted posting,
So that fit and Resume Coach use information I trust.

**Acceptance Criteria:**

**Given** a locally structured capture draft
**When** Adrian confirms or corrects title, company, location/work style, requirements, and available posted date
**Then** the app persists an immutable captured Opportunity revision; missing data remains Unknown.

**Given** a similar saved Opportunity exists
**When** the app identifies it as a duplicate candidate
**Then** both records remain intact until Adrian explicitly resolves the suggestion.

### Story 7.4: Replace Discovery States with Capture and Library States

As Adrian,
I want every saved-role workflow to be clear and local-first,
So that I never mistake pasted content for an automatically retrieved listing.

**Acceptance Criteria:**

**Given** a Jobs, Opportunity Detail, Applied, or Resume Coach view
**When** it refers to a role
**Then** it uses Captured Opportunity language and never claims the app opened, fetched, verified, or refreshed the source URL.

**Given** an old discovery-only control or state is reachable in the active UI
**When** Epic 7 is complete
**Then** it is removed or replaced by an appropriate capture/library path without weakening privacy, provenance, accessibility, or explicit external handoff.

### Affected existing work

- **Story 3.1** must be reviewed against Captured Opportunity revisions before its review status can be accepted.
- **Story 3.2** must wait for Stories 7.2 and 7.3; it will inspect fit provenance from captured input, not retained source/refresh provenance.
- **Epics 4–6** retain their scope but consume a Captured Opportunity wherever they previously named a retrieved Job Listing.
