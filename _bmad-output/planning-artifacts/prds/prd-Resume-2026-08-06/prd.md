---
title: "Personal Job Discovery and Application Materials Tool"
status: final
created: 2026-08-06
updated: 2026-08-06
source_brief: "../../briefs/brief-Resume-2026-08-06/brief.md"
---

# PRD: Personal Job Discovery and Application Materials Tool

## 0. Document Purpose

This PRD defines a private, Philippines-first web MVP for Adrian Javier, a fresh Computer Science graduate, to discover eligible entry-level software roles and prepare truthful, ATS-friendly application materials. It is the product contract for UX, architecture, and delivery planning. `addendum.md` records technical choices that architecture must resolve; it does not change the product constraints in this document.

## 1. Vision and Product Principles

Finding first roles currently requires repeatedly searching changing sources, interpreting vague requirements, tracking applications across tools, and rewriting a resume without overstating experience. The product creates one private workspace that connects an approved candidate record, eligible Job Listings, evidence-based fit guidance, tailored draft materials, and an owned Google Sheets Tracker.

It is a decision-support and drafting tool, never an autonomous applicant. A Fit Label says how the available evidence aligns with a Job Listing; it is not a prediction of interview or hiring outcomes. The user retains the final decision, document edits, export, and application submission.

- Truth before optimization: no unsupported or inferred candidate claims.
- Human approval before export or application: drafts are reviewable and editable; the Base Resume is immutable.
- Source respect: retrieval is user-triggered and limited to allowed sources and access paths.
- ATS readability without gaming: use conventional, readable structure and relevant supported language; never deceive parsers.
- Private by default: candidate and application data are used only for this personal workflow.

## 2. Target User and Journeys

### 2.1 Jobs to Be Done

- Find fresh-graduate software-engineering opportunities in the Philippines without losing hours to broad, stale, or duplicate results.
- Understand exactly why a role is a good, partial, or aspirational match before investing effort.
- Produce role-relevant application materials without fabricating experience or damaging the Base Resume.
- Maintain a reliable history of applications, follow-ups, and multiple interview rounds in a tool the user controls.

### 2.2 Non-Users (MVP)

- Recruiters, agencies, hiring teams, and multi-user career-coaching organizations.
- Candidates seeking automatic applications, mass outreach, or misleading ATS optimization.
- Candidates whose search requires automated access to sources that do not permit it.

### 2.3 Key User Journeys

- **UJ-1. Adrian refreshes a targeted search.** Adrian opens the authenticated web workspace, confirms Philippines-first role and work-style preferences, and selects **Refresh now**. The system retrieves only enabled Permitted Sources, normalizes valid results, and shows Freshness, duplicate handling, Fit Label, and source link. Adrian can immediately filter to Strong fit and Potential fit roles; source failures remain visible without blocking other sources.

- **UJ-2. Adrian decides whether to pursue a listing.** From a Job Listing, Adrian reads the source posting, Fit Explanation, candidate evidence, gaps, seniority signals, work-style/location alignment, and Freshness. He saves it to the Tracker or opens the original application link. The product makes no hiring prediction and never submits a form.

- **UJ-3. Adrian tailors materials truthfully.** Adrian selects a saved Job Listing and generates a Tailored Resume and Cover Letter Draft. Each candidate-facing claim is traceable to Verified Candidate Evidence and relevant wording is traceable to the Job Listing. He reviews and edits a Draft, resolves any flagged unsupported content, then exports PDF and editable source as new Material Versions while the Base Resume remains unchanged.

- **UJ-4. Adrian maintains the application record.** After authorizing Google, Adrian saves a job, updates its Application Stage, schedules a Follow-up, and records multiple Interview Rounds. The system synchronizes these records to the Google Sheets Tracker and displays clear recovery guidance if access or synchronization fails.

## 3. Glossary

- **Application Stage** — User-controlled lifecycle state for a saved opportunity (for example: Interested, Preparing, Applied, Interviewing, Offer, Rejected, Withdrawn). It is not an employer-system status.
- **Base Resume** — The original user resume retained as a protected source; it is never overwritten by the product.
- **Candidate Profile** — User-reviewed record of Verified Candidate Evidence derived from the Base Resume and other user-provided materials.
- **Fit Explanation** — Evidence and reasoning supporting a Fit Label, including matches, gaps, seniority, work-style/location, and Freshness. It is not a hiring prediction.
- **Fit Label** — Strong fit, Potential fit, or Stretch classification for a Job Listing.
- **Freshness** — Displayed time signals for a Job Listing: source-posted date when available, first-seen time, last-verified time, and stale/unknown state.
- **Google Sheets Tracker** — User-owned spreadsheet connected through user-authorized Google OAuth and used to mirror Job Listings, Material Versions, Application Stages, Follow-ups, and Interview Rounds.
- **Interview Round** — One ordered interview event or stage associated with a saved Job Listing.
- **Job Listing** — A normalized representation of an opportunity retrieved from a Permitted Source, retaining source attribution and original application URL.
- **Material Version** — Immutable saved version of a Tailored Resume or Cover Letter Draft, including provenance and exported files.
- **Permitted Source** — A company career source, permitted feed, or user-configured platform search URL whose access method is approved by the user and complies with its terms, rate limits, and restrictions.
- **Verified Candidate Evidence** — A user-reviewed factual statement from the Candidate Profile that is eligible for use in generated materials.

## 4. Features and Functional Requirements

### 4.1 Candidate Profile and Evidence Control

**Description:** The system builds a reviewable Candidate Profile from the Base Resume and user-supplied project or experience materials. Only explicitly reviewed evidence can support a generated claim. Realizes UJ-2 and UJ-3.

#### FR-1: Review candidate profile

The user can import the Base Resume and supported materials, inspect extracted Candidate Profile fields and evidence, then approve, edit, add, or remove individual Verified Candidate Evidence before it is used.

**Acceptance criteria:**

- Evidence records retain source document/section reference and user review state.
- Unreviewed or rejected content cannot be represented as candidate fact in a Draft.
- The product clearly distinguishes user-entered facts from extracted facts.

#### FR-2: Preserve base resume

The system preserves the Base Resume as read-only source content and creates Tailored Resume output only as a separate Material Version.

**Acceptance criteria:**

- Editing a Draft never changes the Base Resume.
- The user can identify which Base Resume and Candidate Profile evidence informed each Material Version.

### 4.2 Search Preferences and Manual Job Discovery

**Description:** The user manages a Philippines-first discovery query for fresh-graduate software-engineering roles. Remote roles are prioritized, followed by hybrid and onsite roles in NCR. Manual refresh is the only MVP retrieval trigger. Realizes UJ-1.

#### FR-3: Configure eligibility and preferences

The user can set and revise search preferences for junior/associate software-engineering roles, cadetships, paid training programs, country, work style, and NCR preference for hybrid/onsite roles.

**Acceptance criteria:**

- Default role intent includes fresh-graduate, junior, associate, cadetship, and paid-training pathways.
- Default geographic preference is Philippines-first; Remote ranks ahead of Hybrid and Onsite, and NCR is favored within Hybrid/Onsite results.
- Country is configurable without changing the source-permission rules.

#### FR-4: Run manual refresh

The user can explicitly start a refresh for selected Permitted Sources; the product does not schedule, poll, crawl, or otherwise refresh in the background.

**Acceptance criteria:**

- Refresh starts only after direct user action and identifies the sources included.
- The UI shows running, completed, partial, and failed source outcomes with timestamps.
- No scheduled refresh control, background worker, or automatic retry is enabled in MVP.

#### FR-5: Normalize and deduplicate listings

The system normalizes retrieved eligible listings and identifies probable duplicates while preserving source attribution and original URLs.

**Acceptance criteria:**

- Each displayed Job Listing includes title, company, work-style/location when available, source, original application URL, and Freshness.
- Probable duplicates are grouped or marked; users can inspect retained source records and override a mistaken grouping.
- Missing or ambiguous source fields are displayed as unknown rather than fabricated.

### 4.3 Source Integration Guardrails

**Description:** The product uses a source allowlist and source-specific rules. It must not bypass terms, authentication barriers, rate limits, robots restrictions, or technical access controls. Realizes UJ-1.

#### FR-6: Manage permitted sources

The user can enable company-career sources, permitted feeds, and user-configured platform search URLs only after the product records a valid, allowed integration mode for that source.

**Acceptance criteria:**

- Each source configuration records source type, source URL, allowed access method, rate-limit policy, last permission review, and enabled state.
- A source cannot be enabled when its integration mode is unknown, disallowed, or requires bypassing access controls.
- User-configured platform URLs are used only as configured search entry points; the product does not expand them into unauthorized crawling.

#### FR-7: Enforce access and rate limits

The system applies source-specific terms, rate limits, authentication requirements, and access restrictions before and during retrieval.

**Acceptance criteria:**

- A blocked, throttled, or disallowed source is stopped and reported with the safe next action.
- Credentials or session data are never collected or replayed to evade source restrictions.
- Failed sources do not invalidate listings already retrieved from other Permitted Sources.

### 4.4 Evidence-Based Fit Guidance

**Description:** The product labels each Job Listing as Strong fit, Potential fit, or Stretch based on documented alignment and clearly tells the user why. Labels help prioritization, not outcome prediction. Realizes UJ-1 and UJ-2.

#### FR-8: Calculate transparent fit labels

The system assigns a Fit Label using job requirements and Candidate Profile evidence, gaps, seniority signals, work-style/location alignment, and Freshness.

**Acceptance criteria:**

- Strong fit denotes substantial supported alignment and no disqualifying known gap; Potential fit denotes meaningful alignment with material gaps or uncertainty; Stretch denotes significant evidence, seniority, or location mismatch. These definitions are visible in-product.
- A label is never presented as likelihood of interview, offer, or hiring.
- Unknown or stale data lowers confidence or is disclosed; it does not become assumed fit.

#### FR-9: Explain fit evidence

The user can view a Fit Explanation that separates matched evidence, missing/uncertain requirements, seniority signals, location/work-style rationale, Freshness, and source-posting language.

**Acceptance criteria:**

- Every matched candidate fact links to Verified Candidate Evidence.
- Every summarized requirement links to or quotes only a short relevant portion of the Job Listing and its source link.
- The user can save the Job Listing despite a Potential fit or Stretch label.

### 4.5 Truthful Tailored Materials

**Description:** The product drafts ATS-friendly Tailored Resumes and Cover Letters for a chosen Job Listing, using only Verified Candidate Evidence and relevant Job Listing language. The user must review and may edit before export. Realizes UJ-3.

#### FR-10: Generate traceable drafts

The user can request a Tailored Resume and Cover Letter Draft for a Job Listing; each generated candidate claim must be supported by Verified Candidate Evidence.

**Acceptance criteria:**

- The system blocks or flags unsupported candidate claims before the Draft is ready for export.
- Relevant Job Listing terminology may be used only where it accurately describes supported evidence.
- Each generated element records its evidence and Job Listing provenance sufficient for user review.

#### FR-11: Enforce ATS-safe drafting rules

The system creates readable, conventional application materials and prevents deceptive optimization techniques.

**Acceptance criteria:**

- Drafts contain no fabricated claims, keyword stuffing, hidden text, invisible characters, or content intended to deceive an ATS or recruiter.
- The system does not promise ATS parsing, interview selection, or hiring outcomes.
- Warnings identify unsupported edits made by the user when detectable, but the user retains editing control.

#### FR-12: Review, version, and export materials

The user can review and edit a Draft, then explicitly export separate PDF and editable-source files as a Material Version.

**Acceptance criteria:**

- Export is unavailable until the user sees the Draft and any blocking claim warnings are resolved or removed.
- Every export produces a new Material Version; previous versions remain identifiable.
- PDF and editable-source exports reflect the approved Draft and do not overwrite the Base Resume.

### 4.6 Application Tracking and Google Sheets

**Description:** The product keeps an internal application record and mirrors it to a user-owned Google Sheets Tracker after explicit OAuth authorization. Realizes UJ-2 and UJ-4.

#### FR-13: Save and manage application records

The user can save a Job Listing, select an Application Stage, add notes, set Follow-ups, attach Material Versions, and record ordered Interview Rounds.

**Acceptance criteria:**

- One saved Job Listing can have multiple Interview Rounds with date, type/stage, outcome/status, notes, and next action.
- Follow-ups include date, status, and notes and remain associated with the saved Job Listing.
- Application changes are user initiated; the product never submits an application or changes an employer portal.

#### FR-14: Authorize Google Sheets

The user can authorize Google OAuth, choose or create a Google Sheets Tracker they own or can edit, view the requested permission scope, and revoke the connection.

**Acceptance criteria:**

- OAuth uses the minimum Google permissions needed to create/read/update the selected tracker and does not request broader Google data access.
- The system verifies edit access before first synchronization and identifies the selected spreadsheet.
- Revocation disconnects future access, reports unsynchronized changes, and offers a reauthorization path without losing local records.

#### FR-15: Synchronize tracker data

The system writes Job Listing data, Fit Explanation summary, Material Versions, Application Stages, Follow-ups, and Interview Rounds to the Google Sheets Tracker in a stable, user-readable structure.

**Acceptance criteria:**

- Synchronization records last attempted time, outcome, and a row/entity-level error when applicable.
- Repeated synchronization does not silently duplicate the same logical Job Listing, Material Version, Follow-up, or Interview Round.
- A Google Sheets error leaves local data intact and provides retry/reconnect guidance.

### 4.7 Original Application Handoff

#### FR-16: Open original application link

The user can open the original Job Listing application URL from the workspace after reviewing the listing or materials.

**Acceptance criteria:**

- The handoff opens the source URL and makes clear that application submission occurs outside the product.
- The product neither completes nor submits source application forms.

## 5. Source Integration Rules

- Allowed inputs are company career pages with permitted access, permitted feeds, and user-configured platform search URLs with permitted access.
- Each enabled source needs a maintained approval record covering terms, allowed mechanism, authentication boundary, rate limit, and failure behavior.
- The product must honor source limits and restrictions as stricter than any user preference. It must not use scraping, automation, credential reuse, browser automation, proxying, or access-control circumvention where the source forbids it.
- Refreshes are manual only. A user action may run a bounded source request; it cannot establish recurring retrieval.
- Retain source attribution and original URL for every Job Listing. If the posting is removed or inaccessible, preserve the last permitted metadata and mark its Freshness accordingly.
- Source-rule changes or permission uncertainty disable the source pending review rather than attempting a fallback that changes the access method.

## 6. Data Model

| Entity | Required data | Relationships / integrity rules |
|---|---|---|
| Candidate Profile | profile fields, review status, updated time | Contains Verified Candidate Evidence; owned by one user. |
| Verified Candidate Evidence | fact text, evidence type, source reference, review state | Belongs to one Candidate Profile; only approved evidence supports generated claims. |
| Base Resume | source file metadata, imported time, immutable content/version | One or more may be retained; never overwritten. |
| Source Configuration | type, URL, allowed access mode, terms/rate-limit metadata, enabled state | Governs retrieval for Source Records. |
| Source Record | raw permitted listing reference, retrieval time, source attribution | Maps to one normalized Job Listing; retention must respect source rules. |
| Job Listing | title, company, details, work style/location, original URL, Freshness, dedupe key | May have many Source Records, Material Versions, Follow-ups, and Interview Rounds. |
| Fit Assessment | Fit Label, explanation, evidence links, gap/seniority/location/freshness details, calculated time | Belongs to a Job Listing and Candidate Profile version; never a hiring prediction. |
| Material Version | type, draft/edit content, export references, provenance, created time | Belongs to one Job Listing; references Base Resume and evidence versions. |
| Application Record | Application Stage, notes, saved time, external application URL | One per saved Job Listing per user; references tracker row identity. |
| Follow-up | due date, completion state, notes | Belongs to an Application Record. |
| Interview Round | ordinal, date, stage/type, status/outcome, notes, next action | Belongs to an Application Record; many allowed. |
| Google Connection | OAuth authorization state, selected spreadsheet ID, granted scopes, sync state | One user connection; credentials are protected and revocable. |

## 7. Cross-Cutting Non-Functional Requirements

### 7.1 Privacy and Security

- **NFR-1:** Candidate Profile, application history, exported materials, OAuth tokens, and source configuration are private to the authenticated user; access requires secure authentication and encrypted transport.
- **NFR-2:** OAuth tokens are stored and handled securely, scoped minimally, never displayed in logs, and removed or rendered unusable on revocation.
- **NFR-3:** The system minimizes collection and sharing: only data needed for a selected action is sent to Google or an AI provider, with user-visible disclosure before first use of each integration.
- **NFR-4:** Operational logs must exclude resume content, full access tokens, and sensitive AI prompts/responses by default.

### 7.2 AI Privacy and Cost Controls

- **NFR-5:** Before AI drafting or analysis, the product discloses the provider/model category, data transmitted, retention/training setting if available, and how the user can disable the feature.
- **NFR-6:** The user can set a budget or usage limit and see per-generation usage/cost estimate or actual cost when available; requests that exceed the configured cap require explicit confirmation or are blocked.
- **NFR-7:** AI output is treated as untrusted draft content and passes evidence/provenance validation before display as export-ready.
- **NFR-8:** The product must not use candidate data to train models or improve a provider service unless the user has explicitly opted in and the provider supports that setting.

### 7.3 Reliability, Performance, and Accessibility

- **NFR-9:** A manual refresh provides per-source progress and an actionable result for every selected source, including partial success.
- **NFR-10:** Create, edit, export, and tracker actions prevent duplicate writes through idempotency or user-visible conflict resolution.
- **NFR-11:** Material review and export flows support keyboard navigation, visible focus, semantic labels, readable error messages, and accessible contrast at a minimum consistent with WCAG 2.2 AA intent.
- **NFR-12:** The system preserves unsaved user edits locally until the user discards them or an explicit recovery flow is completed.

### 7.4 Auditability

- **NFR-13:** The product records provenance for fit assessments, generated claims, Material Versions, source retrieval, and Google Sheets synchronization sufficient to explain user-visible outcomes.
- **NFR-14:** Audit information supports user understanding and troubleshooting; it is not shared with employers or used to imply a hiring prediction.

## 8. Error States and Recovery

| Situation | Required product behavior |
|---|---|
| Source terms or allowed access mode cannot be verified | Disable the source, explain that it cannot be used, retain no new unpermitted data, and offer permitted sources. |
| Rate-limited, blocked, or access-restricted source | Stop requests for that source, show source-specific status and retry guidance consistent with its policy; do not bypass controls. |
| Partial refresh | Show successful listings with source-level failures and last known Freshness; allow a later manual refresh. |
| Malformed, incomplete, or duplicate listing | Preserve source link and unknown fields, mark uncertainty, and let the user inspect or override the duplicate grouping. |
| Missing candidate evidence or unsupported AI claim | Flag/block the claim from export-ready status, point to the missing evidence, and permit removal or user-profile correction. |
| AI provider unavailable, privacy setting incompatible, or budget cap exceeded | Do not send or retry data automatically; retain the user context locally and explain how to retry, change settings, or draft manually. |
| Google OAuth denied, expired, revoked, or insufficient | Keep local application data, report the failed scope/connection state, and offer reauthorization or a different spreadsheet. |
| Google Sheets conflict or write failure | Preserve local authoritative change, report affected entities, and offer a safe retry/reconciliation rather than silent overwrite. |
| Export render failure | Preserve the approved Draft and Material Version metadata, identify failed format, and allow retry after correction. |

## 9. MVP Scope and Explicit Exclusions

### 9.1 In Scope

- Private single-user web workspace; reviewed Candidate Profile and evidence provenance.
- Manual discovery from Permitted Sources only; normalization, deduplication, Freshness, and transparent Fit Labels.
- Philippines-first fresh-graduate software-engineering focus; remote-first and NCR preference for hybrid/onsite.
- ATS-friendly Tailored Resume and Cover Letter Drafts, user review/edit, versioning, and PDF/editable-source export.
- User-authorized Google OAuth and Google Sheets Tracker for job, material, stage, follow-up, and multi-round interview data.

### 9.2 Out of Scope for MVP

- Background scheduling, alerts, polling, and automatic refreshes.
- Any source collection that violates source terms, rate limits, authentication boundaries, robots/access restrictions, or other technical controls.
- Automated application submission, autofill, recruiter outreach, or account automation.
- Hiring, interview, salary, or ATS-outcome prediction and any guarantee of selection.
- Fabricated claims, keyword stuffing, hidden/invisible text, or deceptive ATS techniques.
- Multi-user collaboration, recruiter-facing portals, or public candidate profiles.
- Broad country expansion, application-outcome analytics, reusable application-question libraries, and employer research (deferred beyond MVP).

## 10. Success Metrics

- **SM-1: Eligible discovery usefulness.** At least 80% of user-saved listings from a manual refresh are judged eligible or worth reviewing by the user. Validates FR-3 through FR-9.
- **SM-2: Material workflow completion.** The user can move from selected Job Listing to reviewed, exported Tailored Resume and Cover Letter Draft in one session without unsupported claims reaching export. Validates FR-10 through FR-12.
- **SM-3: Tracker integrity.** 100% of user-verified test records synchronize to the Google Sheets Tracker with correct Job Listing, Material Version, Application Stage, Follow-up, and Interview Round associations. Validates FR-13 through FR-15.
- **SM-4: Personal utility.** After four weeks of use, the user reports the workspace reduces job-search or tailoring effort versus the prior manual process. Measurement method and threshold are an architecture/planning follow-up.

**Counter-metrics**

- **SM-C1: Source-compliance incidents.** Target: zero attempts to use a disallowed access method. Counterbalances discovery volume.
- **SM-C2: Unsupported export claims.** Target: zero known unsupported candidate claims in exported materials. Counterbalances material completion speed.
- **SM-C3: Unintended AI spend.** Target: zero generations exceeding an approved user budget without confirmation. Counterbalances AI usage.

**Measurement note:** Numeric targets, evaluation period, and event instrumentation are not supplied in the brief. Before a pilot, the product owner must define the observation window and the denominator for SM-1 (all saved Job Listings in the window, with an explicit user usefulness rating); SM-4 must use an agreed effort baseline and post-use comparison.

## 11. Architecture Decisions Required

The following are intentionally unresolved and must be decided before implementation; none authorizes relaxing the requirements above.

1. Which initial company-career sources, feeds, and platform URL patterns have documented permitted access; what source adapter and review process will enforce this.
2. Candidate Profile schema, evidence-review UX, and deterministic claim-provenance validation method.
3. AI provider/model, data-processing agreement/retention settings, opt-out mechanism, prompt minimization, and cost-metering source.
4. OAuth client type, minimum Google scopes, token storage/encryption, selected-sheet ownership model, sync direction, and conflict-resolution policy.
5. Editable-source format and rendering pipeline that reliably produces both editable output and ATS-friendly PDF.
6. Authentication/session design, data storage location and retention/deletion controls, and backup/recovery expectations for a private single-user product.
7. Exact Fit Label scoring/rules, uncertainty thresholds, Freshness decay, deduplication strategy, and user override/audit design. The implementation must produce the three published labels consistently from the factors in FR-8 and expose those factors in FR-9.

## 12. Open Questions

1. What initial Permitted Sources have written or otherwise verifiable permission for the proposed integration approach?
2. What first-party metrics instrumentation, evaluation window, and target values should govern SM-1 and SM-4 during the MVP pilot?
3. Which editable-source format best meets the user's editing needs while preserving ATS readability on PDF export?
4. What data-retention period and deletion/export experience does the user require for local records, source content, and AI-provider processing?

## 13. Assumptions Index

- [ASSUMPTION] The MVP is a private, authenticated web application for one user; the brief names a web tool but does not prescribe implementation surface details.
- [ASSUMPTION] The product retains a local authoritative record even when Google Sheets is temporarily unavailable; this is necessary to meet non-destructive error recovery.
- [ASSUMPTION] Fit labels are rule/evidence-based and may include AI assistance only when their factors remain disclosed and auditable.
- [ASSUMPTION] Editable-source export format is intentionally deferred to architecture because the brief does not choose DOCX, ODT, or another format.

## 14. Approved Change - Resume Evidence Library and PDF-derived Base Resume

This section supersedes earlier statements that require an immutable LaTeX Base Resume or TeXworks-based exports.

1. **Evidence library.** `resume-evidence/` is the sole recursive application library root for reviewed Markdown evidence. It has separate project and experience entries. Existing project/document folders are selected inputs or manually organized library content; the product must not modify original selected folders.
2. **Optional documentation.** Add Project offers a user-started **Document for Resume** path. It uses the selected local model only for the selected folder, produces a reviewable resume-focused evidence draft, and never adds evidence automatically. A companion Codex skill, adapted from local `bmad-document-project`, produces the same standardized artifacts outside the app.
3. **Current Base Resume.** A user-selected, text-readable PDF is locally parsed into a structured editable draft. Explicitly approved updates create a new Current Base Resume version. Prior source and base-resume versions remain retained for Material Version provenance.
4. **Truthfulness and control.** Only approved evidence supports base-resume updates, fit, or tailored claims. The product performs no background directory watch, scan, AI run, upload, or source-folder mutation.
5. **Exports.** A later local structured-material renderer must produce conventional ATS-readable PDF plus editable source. It must not depend on `resume.tex` or TeXworks and must retain provenance and explicit export approval.

## 15. Approved Change - Manual Opportunity Capture MVP

This section supersedes conflicting portions of FR-3 through FR-7, the source-integration rules, discovery journeys, source data model, error states, MVP scope, success metrics, and open questions.

### Revised product boundary

The MVP is a private, local-first **Opportunity Workspace**. Adrian discovers roles outside the product. The product does not scrape, crawl, automate a browser, fetch a supplied URL, run a source adapter, configure permitted sources, or refresh external job feeds in the MVP.

### Revised functional requirements

- **FR-3: Capture an opportunity manually.** Adrian can create an Opportunity by supplying a posting URL and copied job-description text. The URL is retained as source attribution and an outbound handoff; copied text is explicit user-provided input.
- **FR-4: Structure and confirm captured details.** The product locally derives a reviewable draft of title, company, location/work style, requirements, and available posted date. Adrian can correct it before save. Missing values remain `Unknown`; the product never fills them from a network request.
- **FR-5: Manage saved opportunities.** Adrian can view, search, filter, update, and inspect locally saved Opportunities; an explicit duplicate suggestion preserves both records until Adrian resolves it. Capture revisions, attribution, captured timestamp, and the original URL are retained.
- **FR-6 and FR-7: Deferred.** Permitted-source configuration, automated retrieval, source policies, rate limits, refresh outcomes, and adapter controls are out of MVP scope. A future approved company/ATS feed is a separate source-specific enhancement.

FR-8 through FR-16 remain in force, with **Captured Opportunity** replacing any conflicting reference to a retrieved Job Listing or retained source result. Fit reflects approved evidence plus the user-provided captured description and its explicit unknowns; it remains non-predictive.

### Revised primary journey

Adrian finds a role externally, selects **Add opportunity**, pastes its URL and copied description, confirms the locally structured capture, then uses fit guidance and Resume Coach before deliberately opening the original URL to apply. He records the result in Applied. No product action submits an employer form.

### Revised data and safety boundary

An Opportunity has immutable captured revisions, user-provided description content, source URL, capture timestamp, confirmed fields, unknowns, and optional duplicate-decision history. The app's local database remains authoritative. It must not represent user-provided text as independently fetched, verified, current, or source-permitted content.

### Deferred enhancement

Approved company/ATS APIs, feeds, or policy-reviewed retrieval may be considered after MVP only through a separate reviewed decision. They cannot silently activate when Adrian pastes a URL and cannot replace manual capture as the reliable default.
