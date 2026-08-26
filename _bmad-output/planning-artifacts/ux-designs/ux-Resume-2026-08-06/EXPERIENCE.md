---
name: Personal Job Discovery and Application Materials Tool
status: final
sources:
  - ../../prds/prd-Resume-2026-08-06/prd.md
updated: 2026-08-26
---

# Personal Job Discovery and Application Materials Tool — Experience Spine

Responsive, private single-user web UX. `DESIGN.md` is the visual identity reference; this spine owns behavior. The spines win on conflict with future mocks or imports. The experience is a Jobs-first career workspace, not an API/debug console.

## Foundation

The product serves Adrian Javier, a fresh Computer Science graduate, in a Philippines-first search for entry-level software roles. It is a Jobs-first career workspace—not an API or admin console. It is decision support and drafting, not an autonomous applicant: every retrieval is manual, every candidate fact is reviewed before use, every export follows review, and every application handoff occurs outside the product. [ASSUMPTION] The web workspace is responsive, with desktop/laptop as the primary detailed-review surface and phone support for inspection and simple record updates. No UI system is specified.

### Application shell

Every view uses a consistent product shell with clear navigation and human destination labels. Primary tabs are **Jobs**, **Applications**, **Resume**, **Evidence Library**, **Google Sheets**, **Career Assistant**, and **Settings**. The dark premium header shows the active destination, a text-first local/remote connection status that links to details, and visible keyboard focus. On narrow viewports, a labelled native compact-navigation control exposes the current destination, supports keyboard and Escape, restores focus to its trigger, and preserves unsaved-edit protection. Technical details such as revision IDs, digests, and source policy metadata are progressive disclosure, not the first visual layer.

Before first AI transmission, the product shows the provider/model category, exact candidate fields/attachments and Job Listing text proposed for transfer, retention setting, and generation cost/estimate when available. Training/improvement use requires a separate, recorded, optional opt-in that defaults off; it is never bundled with generation or Google authorization. Adrian may revise the selection or draft locally instead. Budget-cap exceedance requires explicit confirmation or blocks the request. Data actions do not automatically retry.

## CV Builder Reference Update

Every workspace uses the dark premium `{colors.header}` shell and warm `{colors.primary}` affirmative-action treatment defined in `DESIGN.md`. This changes visual consistency only: Jobs stays first, actions stay explicit, and privacy/accessibility/status language stays text-first. Resume uses a labelled stepper and, where a readable preview exists, a responsive editor-and-preview composition with a visible local revision/time state. Warm primary styling is not used for destructive commitments.

## Inspiration & Anti-patterns

Adopt the CV Builder reference's calm premium header, warm affirmative actions, guided Resume steps, rounded evidence/skill chips, and legible editor-plus-preview composition. Do not copy its presentation in a way that creates fake progress, opaque AI behavior, automatic evidence approval, hidden technical truth, or decorative controls that obscure review, privacy, or consequence. The UX spine wins over a visual reference whenever they conflict.

## Information Architecture

| Surface | Reached from | Purpose / requirement coverage |
|---|---|---|
| Workspace home / Jobs | App open, primary navigation | Search bar, filters, result count, Job Listings, Fit Label, Freshness, source status, and explicit **Refresh now**. This is the default product home. FR-3, FR-4, FR-5, FR-8. |
| Refresh results | **Refresh now** | Selected-source run, running/completed/partial/failed outcomes, timestamps, and retained successful results. FR-4, FR-7. |
| Search preferences | Primary navigation / Jobs | Eligibility, role intent, country, work-style, and NCR preference. FR-3. |
| Permitted Sources | Search preferences | Allowed source configuration, review metadata, enabled state, and access/rate-limit status. FR-6, FR-7. |
| Job Listing detail | Job row | Source posting, Fit Explanation, candidate evidence, gaps, seniority, work-style/location, Freshness, dedupe details, save, and original application handoff. FR-5, FR-8, FR-9, FR-16. |
| Resume & Evidence Library | Primary navigation | PDF-derived Current Base Resume, Add Project, Add Experience, optional Document for Resume, evidence review states, and approved evidence. FR-1, FR-2. |
| Resume guided editor | Resume | A labelled stepper leads through resume sections. On desktop it pairs explicit editing with a read-only preview; it preserves the source-PDF and version boundary. |
| Draft workspace | Saved Job Listing / generate action | Tailored Resume and Cover Letter Draft generation, edit, provenance inspection, claim warnings, and approval/export. FR-10, FR-11, FR-12. |
| Material Versions | Draft workspace / saved record | Immutable output history and Base Resume/Candidate Profile provenance. FR-2, FR-12. |
| Application record / Tracker | Saved Job Listing / primary navigation | Application Stage, notes, Follow-ups, ordered Interview Rounds, Material Versions, and Google Sheets sync state. FR-13, FR-15. |
| Google Sheets connection | Tracker | OAuth disclosure/authorization, sheet selection or creation, edit-access verification, revocation, and recovery. FR-14, FR-15. |
| Career Assistant | Primary navigation / contextual help entry | Guided, local project-evidence workflow that explains and routes; it does not silently mutate records, alter source folders, verify claims automatically, or submit applications. Before access it identifies the exact selected folder and bounded file/subfolder and metadata scope. |
| AI and privacy settings | Primary navigation | AI disclosure, feature disablement, usage limit, and cost visibility. NFR-3, NFR-5, NFR-6, NFR-8. |
| Data & storage | Primary navigation / destructive-action recovery | Data classes, storage/recovery-copy status, export, delete, sign-out protection, and Google-disconnect retention explanation. [ASSUMPTION] Final retention policy is unresolved. |

Every stated product need maps to an IA surface. No product screen replaces an original source application form. [ASSUMPTION] Navigation labels and exact responsive breakpoints remain implementation decisions.

### Functional Requirement Traceability

| Requirement | Primary experience surface/pattern |
|---|---|
| **FR-1: Review candidate profile** | Candidate Profile & evidence; evidence review row |
| **FR-2: Preserve base resume** | Candidate Profile & evidence; Draft workspace; Material Versions |
| **FR-3: Configure eligibility and preferences** | Search preferences |
| **FR-4: Run manual refresh** | Workspace home / Jobs; Refresh results; manual refresh control |
| **FR-5: Normalize and deduplicate listings** | Workspace home / Jobs; Job Listing detail; duplicate group |
| **FR-6: Manage permitted sources** | Permitted Sources |
| **FR-7: Enforce access and rate limits** | Refresh results; source outcome row |
| **FR-8: Calculate transparent fit labels** | Workspace home / Jobs; Job Listing detail; Fit Explanation |
| **FR-9: Explain fit evidence** | Job Listing detail; Fit Explanation |
| **FR-10: Generate traceable drafts** | Draft workspace; draft claim/provenance view |
| **FR-11: Enforce ATS-safe drafting rules** | Draft workspace; blocking claim warning |
| **FR-12: Review, version, and export materials** | Draft workspace; approval and export controls; Material Versions |
| **FR-13: Save and manage application records** | Application record / Tracker; application record editor |
| **FR-14: Authorize Google Sheets** | Google Sheets connection |
| **FR-15: Synchronize tracker data** | Application record / Tracker; Google connection and sync status |
| **FR-16: Open original application link** | Job Listing detail; outbound handoff primitive |

## Voice and Tone

Microcopy is direct, factual, and non-predictive. Brand posture lives in `DESIGN.md.Brand & Style`.

| Do | Don't |
|---|---|
| “Refresh started for 3 selected sources.” | “We’ll keep searching for you.” |
| “Potential fit: meaningful alignment, with material gaps or uncertainty.” | “You have a good chance of getting this role.” |
| “This claim needs approved evidence before export.” | “This looks questionable.” |
| “Sync failed for 1 interview round. Your local record is unchanged.” | “Something went wrong.” |
| “Continue on the employer’s site. Submission happens outside this workspace.” | “Apply now” without the handoff boundary. |

Unknowns are named as unknown; failures say what was affected and the safe next action. No gamification, urgency, or assurances about ATS, interviews, offers, or hiring.

## Component Patterns

Behavioral rules; visual specs live in `DESIGN.md.Components`.

| Component | Use | Behavioral rules |
|---|---|---|
| Manual refresh control | Jobs | Opens source selection or confirms selected sources; only a direct user action starts a bounded refresh. It identifies included sources. No schedule, polling, automatic retry, or background refresh control in MVP. |
| button-primary | All surfaces | Starts only the named affirmative/forward commitment. Keyboard activation matches pointer activation; unavailable controls retain an explanatory reason and reachable repair path. Delete, revoke, discard, and other irreversible actions use the distinct danger treatment and state the effect. |
| panel | All surfaces | Groups a bounded task with a programmatic heading and reading order of status, content, then action. At reflow it stacks without hiding required detail or controls. |
| Guided Resume stepper | Resume | Shows labelled sections and the current position. Keyboard users have native controls and retain a linear alternative; navigation never silently discards unsaved edits. |
| Evidence / skill chip | Resume / Evidence Library | Summarizes a skill or evidence category without hiding its source, state, or individual review action. |
| Resume Coach | Resume | The sole left-pane working interface gathers intent conversationally and returns employer-screening/resume-specialist guidance plus named, reviewable proposals. It shows selected job context and the exact material proposed for transfer before any AI request. Accepting one proposal is explicit; Keep current and a local/manual route remain reachable. It never claims a hiring decision, silently rewrites the resume, approves claims, exports, or submits. |
| Local draft status chip | Resume preview | States the local draft's review status in words, for example Ready to review, Needs review, or Preview out of date. It is not a hiring, export, or synchronization claim and it never relies on color alone. |
| Resume editor and preview | Resume | On large screens, Resume Coach and a read-only preview sit side by side with a visible local revision/time state. The preview changes only after an explicit proposal acceptance. Unsaved or stale previews are marked and invalidate review acknowledgement. On narrow screens, a programmatically named review summary and warning count precede Coach; labelled jumps reach Coach, Preview, Warnings, and Provenance before the layout stacks in that order. Preview is not an export or approval action, executes no document content, loads no remote assets/telemetry, and never silently uses AI/cloud fallback. A safe local text/failure view preserves edits when preview rendering is unavailable. |
| Career Assistant workflow | Career Assistant | States first use, no folder selected, disclosure/selection, inspecting, no evidence found, inaccessible folder, cancelled, partial result, and recovery. Before inspection it names the exact folder, bounded read scope, and non-mutation guarantee; cancel changes nothing. Output is unreviewed proposal content with individual approve/edit/reject actions. Local/manual processing is the default; any future non-local transfer needs fresh explicit consent and cannot silently fall back. |
| Source outcome row | Refresh results / Permitted Sources | Announces running, completed, partial, failed, blocked, throttled, or disallowed state with timestamp and source-specific safe next action. One source failure does not remove results from others. |
| Listing row | Jobs | Always exposes title, company, work-style/location when available, source, original application URL, Freshness, and Fit Label; missing fields state “Unknown.” Filters include Strong fit and Potential fit. |
| Duplicate group | Jobs / Job Listing detail | Shows retained source records; user may inspect and override a probable grouping. It never silently deletes attribution. |
| Fit Explanation | Job Listing detail | Separates matched evidence, missing/uncertain requirements, seniority signals, work-style/location rationale, Freshness, and short source-posting language. Each matched claim links to its Verified Candidate Evidence. Each requirement links to a relevant short posting excerpt and the original posting source. |
| Evidence review row | Candidate Profile & evidence | Gives source document/section, extracted vs user-entered origin, and review state. Approve, edit, add, remove, or reject are individual actions. Unreviewed/rejected items cannot support a Draft. |
| Draft claim/provenance view | Draft workspace | Every generated element exposes candidate-evidence and Job Listing provenance sufficient for review. Relevant job wording is allowed only when accurately supported. |
| Blocking claim warning | Draft workspace | Blocks export-ready status; routes to remove the claim or correct Candidate Profile evidence. Detectable unsupported user edits warn without removing editing control. |
| Approval and export controls | Draft workspace | The review summary states claim count, unresolved warnings, and provenance links. After reviewing that accessible summary, Adrian explicitly acknowledges review; material edits require acknowledgement again. Export controls stay unavailable until acknowledgement and warning resolution/removal. Explicit export creates a new Material Version in PDF and editable source; it never changes the Base Resume. [ASSUMPTION] Exact editable-source format is undecided. |
| Application record editor | Application record / Tracker | User saves a listing, selects Application Stage, adds notes/Follow-ups, attaches versions, and records multiple ordered Interview Rounds. Changes never submit or alter an employer portal. |
| Google connection and sync status | Google Sheets connection / Tracker | Before OAuth, a review step names the Google account, least-privilege scope, spreadsheet and worksheet, data categories/columns (including whether notes are mirrored), and create/update behavior. Sensitive notes default local-only until included explicitly. Reconfirm account, sheet, scope, or schema changes. It then shows edit-access result, last attempt, outcome, and entity-level errors. Revoke disconnects future access, preserves local data, distinguishes local deletion from remote retention, names unsynchronized changes, and offers reauthorization. |
| Confirmation dialog | Any consequential action | States the specific authorization, revocation, export, discard, or duplicate-grouping effect before commitment. Escape/cancel leaves data unchanged; focus returns to its invoking control. |

## State Patterns

| State | Surface | Treatment |
|---|---|---|
| First use / no listings | Jobs | Route to Search preferences and Permitted Sources; do not imply any retrieval has occurred. |
| Successful refresh / filter with no results | Jobs / Refresh results | Distinguish this from first use: retain selected filters and completed source outcomes, state that no eligible listings matched this run or filter, and offer preference/source review or a later explicit refresh. |
| Cold load | All data-bearing surfaces | Reserve the expected record structure while data loads and announce loading state; do not display stale data as current or block navigation without an explanation. [ASSUMPTION] Exact loading treatment is a UI-system decision. |
| No Candidate Profile evidence | Candidate Profile & evidence | Explain that only approved evidence can support a Draft; route to Base Resume/material import and individual review without treating absence as a candidate deficiency. |
| No saved records or Material Versions | Application record / Tracker / Material Versions | Explain the record is empty and route to a Job Listing; never fabricate a tracker row or version history. |
| No Google connection | Application record / Tracker | Keep local tracking available; offer the explicit Google authorization path without blocking save, stage, Follow-up, or Interview Round changes. |
| Refresh running | Refresh results | Per-source progress and selected sources remain visible; user can leave and return without an implied background schedule. [ASSUMPTION] Whether a started bounded request may finish after navigation is an implementation decision. |
| Partial refresh | Refresh results / Jobs | Show successful listings, failed source outcomes, and last known Freshness; permit a later manual refresh. |
| Source blocked/throttled/disallowed | Source outcome row | Stop that source, explain restriction and source-compatible retry guidance; no bypass, credential collection, or alternate access method. |
| Incomplete, malformed, or ambiguous listing | Listing / detail | Preserve source link, mark unavailable details as unknown, and make duplicate uncertainty inspectable. |
| Fit uncertainty or stale data | Job Listing detail | Disclose Freshness/uncertainty in the Fit Explanation; never assume fit or show a hiring likelihood. |
| No approved evidence / unsupported claim | Candidate Profile & evidence / Draft workspace | Identify the missing evidence; prevent export-ready state; retain editable draft context and route to removal or profile correction. |
| AI unavailable, privacy-incompatible, or budget-capped | Draft workspace | Do not transmit or retry automatically; keep user context locally and explain manual drafting, settings change, or explicit retry path. |
| Unsaved draft edit | Draft workspace | Preserve locally until user discards or completes explicit recovery. [ASSUMPTION] Autosave cadence and conflict UI are not specified. |
| Export render failure | Draft workspace / Material Versions | Preserve approved Draft and version metadata, identify failed format, allow correction and retry. |
| OAuth denied, expired, revoked, or insufficient | Google Sheets connection | Keep local records, name connection/scope state, offer reauthorization or different spreadsheet. |
| Sheets write failure or conflict | Tracker | Preserve local authoritative change, name affected entities, provide retry/reconnect/reconciliation; never silently overwrite or duplicate. [ASSUMPTION] Exact conflict-resolution policy is unresolved. |
| Data export, deletion, or sign-out | Data & storage | Name affected data classes, local recovery-copy and remote-Sheets consequences, and whether reauthentication is required. Confirm destructive actions; after sign-out, recovery data is inaccessible until the same authenticated account returns. [ASSUMPTION] Final retention periods and deletion mechanics remain unresolved. |

## Interaction Primitives

- Click/tap activates an explicit labeled action; keyboard activation works for the same control.
- Opening the original application URL is a deliberate outbound handoff labeled with its destination host. It states that the destination's privacy terms apply, submission occurs outside the workspace, and no Candidate Profile or materials are prefilled or transmitted. On return, Adrian explicitly records an Application Stage; the tool never infers submission.
- Destructive or consequential actions—discarding edits, revoking Google access, overriding duplicate grouping, and export—require a confirmation that states the effect. [ASSUMPTION] The PRD does not prescribe whether every duplicate override needs confirmation; retain an undo/recovery path where implementation permits.
- Tables have responsive alternatives that preserve required content and actions; hover is never the sole way to reveal provenance, errors, or controls.
- **Banned:** scheduled refresh, polling, background retrieval, automatic retry of data actions, employer account automation, autonomous application submission, deceptive ATS techniques, and claims/predictions of hiring outcomes.

## Accessibility Floor

- Meet WCAG 2.2 AA intent: semantic labels, readable errors, visible focus, keyboard navigation, and accessible contrast (visual token intent in `DESIGN.md`).
- A screen reader receives each control’s action and state, including refresh source outcome, Fit Label plus non-predictive definition, evidence review state, export block reason, and Sheets sync outcome.
- A persistent programmatic status region announces refresh/sync start and terminal or partial outcomes once. Per-source/entity detail is available on demand; assertive announcements are reserved for blocking errors. Focus moves only when Adrian explicitly requests the affected results or recovery view.
- Provenance links have descriptive labels identifying whether they open Verified Candidate Evidence or the Job Listing source excerpt/link.
- Validation errors are programmatically associated with affected claims/fields and announced without relying on color or position.
- Focus order follows the review sequence: summary → evidence/provenance → issue → repair action → export/next action. Modal focus is contained and restores to its invoker.
- Interactive targets are at least 24 by 24 CSS pixels or meet the WCAG spacing exception. Focus indicators have sufficient contrast/area and remain unobscured by sticky navigation, dialogs, or toasts. Ordered Interview Rounds provide keyboard-operable **Move up** and **Move down** controls; dense tables preserve labeled actions and logical reading order at zoom.
- Draft editor, source links, filters, tables/stacked records, OAuth flow entry, and recovery actions remain operable without a pointer; content reflows without loss at magnification/reduced viewport.

## Responsive & Platform

| Context | Behavior |
|---|---|
| Desktop/laptop [ASSUMPTION: primary] | Supports side-by-side reading where it improves evidence-to-claim comparison; tables may show all required listing/tracker fields. |
| Tablet | Retains inspection and editing; supporting detail collapses below the primary record without removing provenance or status. |
| Phone [supported] | Uses labelled stacked records and sequential evidence review. Jobs and Applications preserve required fields, filters, sort, result count, status, and actions as label/value cards at 320 CSS px and 400% zoom. Resume shows its named review summary/warning count before editing and provides labelled jumps to Editor, Preview, Warnings, and Provenance. Editing, acknowledgement, and export are available only when this full review path is operable; otherwise the app preserves the local draft and offers an explicit, non-destructive continue-on-larger-screen path. |

## Product-Specific Integrity Rules

- The Base Resume is visibly read-only. A Tailored Resume, Cover Letter Draft, and Material Version always identify themselves as separate artifacts and reveal which Base Resume and Candidate Profile evidence informed them.
- Fit labels follow the published meanings: Strong fit = substantial supported alignment and no disqualifying known gap; Potential fit = meaningful alignment with material gaps or uncertainty; Stretch = significant evidence, seniority, or location mismatch. Exact scoring, uncertainty thresholds, Freshness decay, and override/audit behavior are [ASSUMPTION: unresolved architecture decisions].
- A Job Listing can be saved regardless of whether its Fit Label is Potential fit or Stretch.
- Google Sheets is a user-owned mirror. Local data stays intact through connection, access, or write failures; repeated sync must not silently duplicate a logical Job Listing, Material Version, Follow-up, or Interview Round.
- Candidate and application data are private to the authenticated user. OAuth tokens are never displayed; first-use disclosure precedes data sent to an AI provider or Google.
- Data & storage presents each data class, local/recovery and connected-service location, export/delete effect, and post-revocation behavior. Retention periods, final deletion mechanics, and recovery-copy lifetime are release blockers until the open policy decision is resolved; this surface must not imply they are already defined.

## Key Flows

### UJ-1. Adrian refreshes a targeted search.

1. Adrian opens the authenticated workspace and reviews Philippines-first role and work-style preferences.
2. He selects **Refresh now** and sees the selected Permitted Sources before starting.
3. The bounded manual refresh begins; per-source rows show progress and timestamps.
4. Completed sources contribute normalized Job Listings; incomplete fields say “Unknown,” and probable duplicates retain inspectable source records.
5. A source is blocked, throttled, or fails; that row states the safe next action while successful listings remain available.
6. Adrian filters to Strong fit or Potential fit and scans Fit Label, Freshness, source, and location/work-style.
7. **Climax:** The result surface makes the completed/partial outcome and source-level evidence visible together, so Adrian can choose a listing without mistaking a partial refresh for a complete search.

### UJ-2. Adrian decides whether to pursue a listing.

1. Adrian opens a Job Listing from the filtered results.
2. He reads the original posting context, Fit Label definition, and Fit Explanation.
3. He traces every match to Verified Candidate Evidence and each summarized requirement to a short source-posting excerpt/link.
4. He considers visible gaps, seniority signals, work-style/location alignment, and Freshness, including unknown or stale information.
5. He saves the listing despite a Potential fit or Stretch label, or opens the original application link.
6. **Climax:** Before committing time, Adrian can state exactly what is supported, missing, and uncertain; the interface never converts that explanation into a hiring prediction.

Failure: the source posting is no longer available â†’ preserve last permitted metadata, mark Freshness accordingly, and keep the limitation visible rather than inventing or extending source data.

### UJ-3. Adrian tailors materials truthfully.

1. Adrian selects a saved Job Listing and requests a Tailored Resume and Cover Letter Draft after reviewing the AI privacy/cost disclosure, exact data-transfer preview, separate optional training/improvement setting, and any applicable budget gate.
2. The Draft workspace presents each candidate-facing claim with Verified Candidate Evidence and relevant Job Listing provenance.
3. He reviews and edits the Draft; a detectable unsupported edit or generated claim becomes a blocking warning linked to removal or evidence/profile correction.
4. He verifies the Base Resume is unchanged and the draft is a separate artifact.
5. Once he has completed the accessible review summary and resolved or removed blocking warnings, he explicitly acknowledges review and approves export.
6. He exports PDF and editable source; each becomes a new identifiable Material Version without overwriting prior versions or the Base Resume.
7. **Climax:** The export confirmation names the new version and provenance, giving Adrian a truthful, review-approved artifact rather than an opaque AI output.

Failure: AI is unavailable, a privacy setting is incompatible, the budget cap is exceeded, or a format fails to render â†’ do not retry or transmit automatically; preserve context/approved Draft metadata and offer the specified retry, settings, manual-draft, or format-correction route.

### UJ-4. Adrian maintains the application record.

1. Adrian reviews the Google account, minimum scope, spreadsheet/worksheet, and the exact data categories to mirror (with notes local-only by default), then authorizes Google and chooses or creates a Google Sheets Tracker he owns or can edit.
2. The product verifies edit access to the selected spreadsheet and worksheet, then displays the verified account, spreadsheet, and worksheet.
3. He saves a job, sets its Application Stage, adds notes and a Follow-up, attaches Material Versions, and records ordered Interview Rounds.
4. For each user-initiated tracker change, the tracker displays the sync attempt, outcome, and timestamp while the change is being mirrored.
5. A permission, access, conflict, or write failure identifies affected entities; local changes remain intact and Adrian can retry, reconnect, or reconcile.
6. He may revoke the connection; future access stops, unsynchronized changes are surfaced, and reauthorization remains available.
7. **Climax:** Adrian can trust the local application record and see exactly whether its user-owned Google Sheets mirror reflects each change.

## Approved Change — 2026-08-24: Calm Jobs-first Workspace

This approved change supersedes any conflicting earlier navigation, standalone-workspace, dark-header, or warm-orange direction in this document. It is a UX simplification, not a removal of backend/domain capability: existing local-first, provenance, review, revision, audit, consent, and accessibility requirements remain in force even when they are not present in the primary workflow.

### Product posture

- The experience is a calm, muted-forest career workspace. It should feel like a familiar job-search product, not a technical dashboard or API test harness. Use familiar LinkedIn, JobStreet, Bossjob, and Indeed conventions when they reduce cognitive load.
- Prioritize the jobseeker's immediate decision and next action. Do not expose a raw backend record, implementation status, identifier, revision hash, policy payload, or integration capability merely because it exists. Make technical truth reachable through clearly named Details, status, or review disclosure when it affects a decision.
- Product-facing read projections are preferred: `JobCard`, `JobDetail`, `AppliedJob`, `ResumeWorkspace`, and `SheetConnectionStatus`. They keep domain behavior and local SQLite authority behind simple, task-shaped UI.

### Navigation and information architecture

The full-width header is deliberately independent of the content container's margins. Its only primary destinations are:

| Destination | Nested view | What Adrian sees first | Where supporting capability lives |
|---|---|---|---|
| **Jobs** | **Browse** | Familiar search field, compact filters, result count, scan-friendly job cards/rows, and an obvious listing-detail route. | Search preferences, permitted sources, source outcomes, fit rationale, freshness, and dedupe remain contextual or progressively disclosed. |
| **Jobs** | **Applied** | Applied roles, stage, next follow-up, interview progress, and an empty state that routes to Browse. See [Applied mock](mockups/key-jobs-applied.html). | Google Sheets tracker link, connection state, authorization, sync status, and recovery live here; local tracking never depends on Sheets. |
| **Resume** | **Edit** | A desktop split workspace: editable controls/actions on one side and a read-only local preview on the other. | Provenance, warnings, material versions, and export review remain available in the edit flow rather than competing for top-level space. |
| **Resume** | **Experience & Projects** | Conventional experience/project management and reviewable skill/evidence chips. See [Experience & Projects collection mock](mockups/key-resume-experience-projects-collection.html). | Add project, add experience, local folder selection, optional document-for-resume workflow, and individual evidence review live here. It is deliberately local-directories-only; no online or GitHub import is offered. |
| **Settings** | Privacy, AI, data | Plain-language controls for consequential preferences and storage. See [Settings mock](mockups/key-settings.html). | Data lifecycle, provider disclosure, budget, disablement, export, deletion, and recovery are available without taking space from task workflows. |

There is no standalone Applications, Evidence Library, Google Sheets, or Career Assistant destination. Existing capabilities map into the surfaces above. Experience & Projects accepts only selected local directories; no remote-GitHub import, clone, or fetch control is offered.

Desktop content uses a deliberately wider, more modern reading canvas: up to 1440 CSS px with 24 CSS-px side gutters, reducing the earlier boxed-in feel while keeping job cards and resume prose legible. Tablet and phone gutters contract to 20 and 16 CSS px respectively. The header stays full-width and is never aligned to the content container. Sleekness comes from clear hierarchy, thin dividers, restrained surfaces, and fewer competing panels—not decorative effects or hidden controls.

### Browse and listing-detail behavior

- Browse starts with a conventional job-search layout: search, compact filters, result count, and simple listing cards/rows whose essential scan fields are title, company, location/work style, freshness, source, and Fit Label. Missing information says “Unknown.” See [Jobs Browse mock](mockups/key-jobs-browse.html).
- Filter complexity, source configuration, detailed fit evidence, duplicate records, and technical metadata stay out of the initial scan path. They remain reachable without hiding a material limitation or ambiguity.
- Selecting a listing opens a detail view that helps Adrian decide whether to pursue it: a readable posting summary, supported fit explanation, important gaps/uncertainty, and the deliberate original-site handoff. **Use as resume context** is the contextual entry point for Resume Coach; it opens Resume with that listing visibly selected. See [Job Detail mock](mockups/key-job-detail.html).
- Resume Coach is an integrated guidance conversation, not an autonomous assistant. It combines an employer-screening perspective with a resume-specialist perspective to explain relevance, gaps, clarity, and ATS-safe improvements. It never claims to be the employer, predict hiring, silently change content, approve claims, export, or submit an application. Before any AI transfer, show the exact transfer preview, provider/model category, retention setting, cost/estimate where available, separate optional training opt-in, and a local/manual alternative. Each proposed change stays reviewable with provenance and blocking-claim rules before it can affect an export.

### Applied behavior

- **Applied** is a sub-tab within Jobs, not a separate product area. It favors a simple stage-oriented list/card view over an admin tracker: role/company, stage, next follow-up, interview progress, and the most useful material version. See [Applied mock](mockups/key-jobs-applied.html).
- Saving a listing, changing stage, recording notes/follow-ups/interview rounds, and attaching material versions remain explicit local actions. No action submits an employer application or changes an employer portal.
- The Google Sheets connection is a secondary tracker utility inside Applied. Its disconnected state must be truthful, non-blocking, and local-first. Before OAuth or sync, disclose account, least-privilege scope, spreadsheet/worksheet, mirrored data categories, and create/update behavior. Failures preserve local records and name affected entities plus the safe next action.

### Resume behavior

- **Edit** uses a vertical half-screen desktop composition: the left pane is Resume Coach only, while the right pane is a local read-only preview. The Coach gathers intent conversationally instead of exposing professional-summary, skill, or experience forms. Its first message names any selected job context and the exact materials it can inspect. A proposed change identifies the affected content and shows **Accept** and **Keep current** controls; the preview changes only after an explicit acceptance. The source Base Resume remains visibly read-only; tailored drafts and material versions remain separate artifacts. See [Resume Edit mock](mockups/key-resume-edit.html).
- On phone or narrow layouts, it becomes a named, linear stack with an accessible review summary and warning count before Coach, plus labelled jumps to Coach, Preview, Warnings, and Provenance. The app preserves edits and offers a non-destructive continue-on-larger-screen path if full review/export cannot be performed safely.
- **Experience & Projects** is the conventional name for the former Evidence Library. Evidence and skills are summarized with chips but each source, origin, review state, and approve/edit/reject action remains accessible. It accepts only selected local project directories: folder inspection names the exact selected folder, bounded local scope, and non-mutation guarantee; cancel changes nothing. No online repository input is presented. See [Experience & Projects mock](mockups/key-resume-projects.html).

### Shared interaction and accessibility rules

- Keep one obvious forward action per bounded task. Secondary actions, filters, advanced options, provenance, and technical metadata are discoverable but visually quieter.
- Maintain WCAG 2.2 AA intent, clear semantic labels, visible focus, keyboard operation, Escape/focus return for overlays/navigation, truthful live-status announcements, 24 by 24 CSS-pixel target minimum or spacing exception, and reflow without loss at 320 CSS px and 400% zoom.
- Muted forest styling must not communicate state by color alone. Warnings, disconnected status, unavailable actions, and destructive consequences require explicit text and a reachable repair path.

## Open Questions

1. Which initial Permitted Sources, integration modes, rate-limit policies, and retry guidance will be available?
2. What Candidate Profile schema and deterministic claim-provenance validation will define review detail and repair actions?
3. Which AI provider/model, disclosure content, opt-out, and cost-metering behavior will be used?
4. What editable-source format and rendering pipeline will make the review/export experience reliable?
5. What Google Sheets sync direction and conflict-resolution policy, OAuth client type, minimum scopes, and selected-sheet ownership model apply?
6. What authentication, retention/deletion/export, backup, and recovery expectations shape settings and error recovery?

## Approved Change - 2026-08-22: Resume & Evidence Library UX

- The Resume & Evidence Library screen provides separate **Add Project**, **Add Experience**, **Refresh Library**, **Import PDF**, and **Update Base Resume** actions. No passive scan/watch state is shown because none exists.
- **Document for Resume** is an optional Add Project branch. It clearly identifies the selected folder, local-model disclosure, proposed-evidence state, source-folder non-mutation guarantee, individual review controls, and a cancel path that changes nothing.
- PDF import shows parse success, a safe unreadable/scanned-PDF error, and a structured editable draft separate from the original file. Update Base Resume presents an accessible change set with evidence provenance and individual approve/edit/reject controls.

## Approved Change - 2026-08-24: Manual Opportunity Workspace

This change supersedes every conflicting discovery, refresh, Permitted Sources, source-outcome, and automatic-retrieval rule above. The MVP does not retrieve a supplied URL or scrape a site. It is a local Opportunity Workspace for roles Adrian finds elsewhere.

### Opportunity capture flow

1. Adrian finds a role externally and selects **Add opportunity**.
2. He supplies the posting URL and copied job-description text. The URL is required attribution and an outbound handoff; the copied text is explicit user-provided input.
3. The app structures title, company, location/work style, requirements, and any available posted date locally. Missing values remain **Unknown**.
4. Adrian reviews and corrects the structured capture before saving it as an immutable captured Opportunity revision.
5. The saved Opportunity appears in **Jobs - All opportunities**. He can search/filter his saved records, calculate fit, use it as Resume Coach context, open the original page, and mark it Applied.

### Navigation and states

- **Jobs** contains **All opportunities** and **Applied**; its primary action is **Add opportunity**. There is no Browse feed or Refresh control.
- Search, filters, result counts, Fit Labels, and cards operate on locally saved Opportunities only.
- First use says that no opportunities have been saved and routes to capture. An incomplete capture preserves already entered local input, identifies missing URL or copied description, and offers correction. A duplicate candidate is a review prompt based on saved local records; it never deletes or silently merges an Opportunity.
- The app never promises that it opened, fetched, parsed, or verified the supplied URL. A user explicitly opens the URL outside the workspace when ready to apply.
- Applied, Resume Coach, Experience & Projects, Google Sheets-in-Applied, Settings, provenance, privacy disclosure, and accessibility requirements remain unchanged except that they refer to a captured Opportunity rather than a retrieved Job Listing.

### Deferred integration boundary

Approved company/ATS APIs, feeds, or policy-reviewed source adapters are post-MVP enhancements. If later approved, they enter through an explicit source-specific capture path and must not change the manual capture default or silently retrieve a URL.

## Approved Change - 2026-08-25: Final Opportunity Library Layout

**All opportunities is a library, not Browse.** The initial experience is not search-first and never presents empty listing/filter chrome. It opens with a short library orientation and one primary **Add opportunity** action. Selecting it reveals the capture card in the same page context; there is no modal, forced navigation, or change of keyboard context.

The capture card has two explicit stages. **Capture details** contains only Original page URL and copied role details; copy says the URL is attribution only, nothing is opened, and no role is saved. **Review capture** keeps the provenance strip and exposes labelled editable title, company, location, work style, requirements, and posted-date fields. **Unknown** remains visible and editable as a truthful value. **Confirm and save opportunity** is the one forward action and names the local save consequence.

After confirmation, status names the saved role and company, gives a non-technical probable-duplicate message when applicable, and offers **Return to All opportunities**. The saved-record region appears only after at least one opportunity exists. Its search, filters, and cards operate solely on saved local data and must not imitate retrieved job-result rows. At 320px and 400% zoom, both card stages and saved records use one column; the confirmation action follows all editable fields and status directly below it. The flow uses the shared visual grammar of [Jobs Browse mock](mockups/key-jobs-browse.html); its content behavior remains manual capture, not retrieval.

## Approved Change - 2026-08-25: Opportunity Capture Dialog Behavior

**Add opportunity** opens one centered native dialog from either Jobs view. Initial focus moves to **Original posting URL**; `Escape` and **Close** dismiss only while no capture or save action is pending, preserve entered text, and restore focus to the invoking **Add opportunity** control. The dialog is the only active capture layer; review and confirmation remain inside it rather than opening nested dialogs.

The entry stage is deliberately compact: URL, copied role details, then **Review capture**. A valid review reveals the existing editable structured-details stage below the entry state without changing the local-only, attribution-only, or explicit-save contract. A successful save disables repeat confirmation, announces the result, and retains the existing return path to **All opportunities**. At narrow widths and 400% zoom, the dialog reflows to a single column with no hidden close path, clipped status, or horizontal scrolling. This supersedes the earlier same-page capture-card behavior in favor of a bounded dialog, while preserving all manual Opportunity Library semantics.

## Approved Change - 2026-08-25: Simplified Resume Edit

This change supersedes every conflicting Resume Edit rule above. It changes the Resume working model from a manual structured-draft editor to a **profile-led local-LLM generation workspace**. It does not alter the local-first, explicit-action, immutable-source, provenance, accessibility, or truthful-claim requirements.

### Information architecture

| Surface | Reached from | Purpose |
|---|---|---|
| **Resume > Edit** | Resume navigation; **Use as resume context** from a captured opportunity | Collect basic personal details, show the immutable `Resume.pdf` template, and converse with the local Resume Coach. It is the only place to request resume generation. |
| **Profile details** | Resume > Edit | First Name, optional Middle Name, Last Name, email, phone number, education, GWA, optional Latin honors, optional LinkedIn URL, and optional GitHub URL. The profile is the user-entered source for generated identity/contact/education content. |
| **Resume template preview** | Resume > Edit | Read-only native view of the immutable local `Resume.pdf`. It is a style/template reference, not an editable draft or a live rendering of chat output. |
| **Experience & Projects** | Resume mini-tab | Existing selected local project/experience material and individual evidence review. It remains the source material the local model may use after review; it is not repeated in Edit. |
| **AI settings** | Settings | Local model setup/status. It is the recovery destination for an unavailable local model; no endpoint, token, or diagnostic enters Resume Edit. |

### Resume Edit behavior

- Resume Edit exposes only a compact profile form, the local Resume Coach, and the immutable template preview. It removes the manual resume-section textareas, review summary, warnings/proposed changes panel, evidence and skills panel, version history/approval, direct evidence-update action, technical status, and internal identifiers from the primary interface.
- The required profile fields are First Name, Last Name, email, phone number, and education. Middle Name, GWA, Latin honors, LinkedIn URL, and GitHub URL are optional. Validation uses field labels and direct plain-language errors; optional fields are never represented as missing defects.
- `Resume.pdf` is a fixed local visual template/reference. It is never mutated, never described as a generated draft, and never treated as proof that generated content already matches its layout. The model returns structured content only; a future deterministic renderer is responsible for creating a generated material that follows the approved template contract.
- Resume Coach is the only tailoring/generation input. It can answer questions about the resume, request missing context, and propose or generate structured content from the saved profile, a deliberately selected captured opportunity when present, and reviewed Experience & Projects material. It never reads an arbitrary folder, fetches a URL, silently sends data, edits the PDF, modifies profile fields, approves evidence, or exports/submits anything.
- Before the first generation and after local model configuration changes, show a brief plain-language local-only disclosure and the selected categories (profile, selected opportunity if any, reviewed experiences/projects). Do not show prompts, model output diagnostics, token values, endpoint details, or raw provenance in the primary conversation.
- Generated content is a separate reviewable material draft. The only primary-screen proposal controls are **Use this version** and **Keep current**. Detailed claim support, warning resolution, approval, and export occur in the later material-review flow, not as cards beside the template.

### Local AI state pattern

| State | Resume Edit treatment |
|---|---|
| **Ready** | Profile form, chat input, and one explicit generation action are available. The template remains visibly read-only. |
| **Generating** | Preserve typed chat/profile context; announce that a local draft is being prepared; prevent duplicate generation. No background retry. |
| **Unavailable** | Keep profile and template readable. Replace Coach controls with: “Local AI is not ready. You can still view your resume template.” Provide one **Set up local AI** action to Settings. No manual resume editor or fallback generation is shown. |
| **Invalid response or generation failure** | Preserve the profile and prior accepted draft; show one concise retry action after the user returns to ready state. Do not persist partial output, retry automatically, or expose technical diagnostics. |

### Accessibility and responsive behavior

- On desktop, Profile & Resume Coach and Resume template sit in two clearly labelled panes. At narrow widths or 400% zoom, order is Profile, Coach/unavailable state, then Resume template; all fields are single-column and no content/action requires horizontal scrolling.
- The chat input, generate button, proposal controls, and local-AI recovery action are keyboard operable with visible focus and announced status. The template iframe has a precise read-only title and a visible open-PDF fallback.
- Any selected opportunity context is named in plain language and can be cleared before generation. The UI never implies that profile, project, experience, or opportunity data was sent until the user invokes the explicit local generation action.

### Key flow: Adrian creates a tailored resume

1. Adrian opens **Resume > Edit** and completes the short profile form.
2. He adds or reviews his local work samples in **Experience & Projects** when needed.
3. He optionally returns from a captured opportunity with that role visibly selected.
4. He reads the immutable Resume template beside the Coach and asks a plain-language question or requests a tailored resume.
5. He confirms the local data categories and explicitly starts generation.
6. **Climax:** The Coach presents one concise proposed version; Adrian chooses **Use this version** or **Keep current** without touching the source PDF.
7. A later material-review flow handles claim support, approval, and export before any file is produced.

Failure: if local AI is unavailable, Adrian can still read the template and save profile details. The page offers **Set up local AI**; it does not offer manual resume rewriting, cloud fallback, or a false recovery path.

### Validation resolutions

- **Save before generate.** A successful **Save details** is required before any Coach model action. The profile card states either **Details saved** or **Save details to generate**. Education includes the short hint: “School, degree/program, and expected or graduation year.” On validation failure, a linked error summary precedes the form, each error is programmatically associated with its field, and focus moves to the summary or first invalid field after submission.
- **One explicit local request boundary.** Every Coach model response, including an answer to a question, is an explicit request. Before it, a compact consent panel names **LM Studio on this device (127.0.0.1)** and **Qwen3.5-9B**, then lists the exact saved profile fields, selected opportunity (if any), and individually selected reviewed experiences/projects that will be included. It refreshes whenever that input selection changes. Tokens, endpoint diagnostics, raw prompts, raw model output, and provenance identifiers remain hidden.
- **Clear readiness and selection.** The Coach names the exact missing prerequisite and links to it: save profile details, choose reviewed material, or set up local AI. Selected opportunity context is a compact **Tailoring for: [role]** row with **Change** and **Clear** controls; it is session-scoped and clears on a new session unless Adrian deliberately selects it again. The consent panel offers **Change selection** for the reviewed materials and shows their readable names, not just a count.
- **Readable proposals.** A generated proposal exposes an accessible full-content view or section summary before **Use as draft** is enabled. Choosing **Use as draft** creates a separate local material draft, announces that the template is unchanged, and shows one **Review draft** action. **Keep current** leaves the current material draft unchanged. Each new generation is a separate pending draft; no generation silently replaces an accepted draft.
- **Accessible Coach state.** The Coach has a persistently labelled prompt, semantic chronological transcript, and atomic polite updates for a completed reply or state change. During generation the region is `aria-busy`; focus remains on the initiating control/input, duplicate generation is prevented with an announced reason, and completion/failure is announced without rereading the transcript. A failed request preserves the submitted and typed prompt plus profile and prior accepted draft; **Try again** appears only when the local model is ready, otherwise **Set up local AI** is the single recovery action. Leaving Edit for Settings preserves unsaved profile values and returns focus to the invoking recovery control on return.
- **Accessible template fallback.** The template frame is constrained to its column, never introduces nested horizontal scrolling at 320 CSS px/400% zoom, and allows visible keyboard entry/exit. Its failure state is announced and retains a visible **Open or download Resume.pdf** fallback. If the PDF is not meaningfully accessible to the user’s viewer, a separate accessible template description is offered. Persistent helper copy says: “Reference only — generated drafts open in review after you choose one.”
- **Canonical precedence.** The Resume-specific component and behavior text in this section and the paired `DESIGN.md` Profile-led Resume Workspace are the only current Resume Edit contract. Earlier references to manual textareas, accepting proposals into a live preview, warning counts, version controls, evidence panels, and manual drafting are obsolete for Resume > Edit; their review/provenance safeguards move to Experience & Projects and the later material-review flow.

## Approved Change - 2026-08-26: Experience & Projects Collection

This change supersedes every conflicting Experience & Projects, Evidence Library, Base Resume extraction, typed-experience, file-picker, and side-review-dashboard rule above. It does not alter the immutable `Resume.pdf` template or the evidence review/provenance guardrails.

### Information architecture and collection model

| Surface / control | Behavior |
|---|---|
| **Resume > Experience & Projects** | Uses the same outer Resume mini-tabs as **Edit**. Its own inner tabs, **Projects** and **Experiences**, show only the selected category. The page is a compact collection, not a form dashboard. |
| **Collection row** | Shows the readable import name, one bounded derived summary, document count, and plain-language evidence review state. **View details** expands one row in place to show copied Markdown document names and individual evidence review entries. It is keyboard operable and retains its focus on expand/collapse. |
| **Add project folder** | Opens one explicit folder-selection flow. It imports only safe, readable Markdown recursively from the chosen local project folder; source files and folders are never changed. |
| **Add experience folder** | Uses the same explicit folder-selection flow and recursive Markdown boundary as project import, but stores the import as an Experience. Typed content and a one-file chooser are removed from the active experience flow. |
| **Evidence review** | Remains available only from an expanded collection row. Its existing individual approve, edit, reject, and remove actions retain provenance and review-state behavior. |
| **Base Resume extraction** | Removed from this surface. The immutable `Resume.pdf` remains the visual template in Resume > Edit, never an input to extract, parse, or re-import here. Legacy Base Resume history may remain retained but is not exposed in the active collection. |

### Summary and parsing contract

- [ASSUMPTION] A row summary is derived locally from the first meaningful non-heading Markdown paragraph after stripping list syntax and ignoring blank lines, fenced code, HTML comments, and front matter. It is normalized to one sentence and capped at 240 characters; it must not synthesize or embellish project facts.
- If no paragraph is present, use the first eligible factual line under the existing 5,000-character safety limit; if none exists, say **No summary found yet.** The row remains importable and reviewable.
- The parser must retain exact source document name, heading, and line number for every candidate evidence item. It must ignore fenced code, reject invalid UTF-8, reject symlinks/reparse points and unsafe paths, cap document and candidate counts, and make no network request, background scan, model call, or source-folder mutation.
- The parser must not treat every visible nonblank line as a human-facing summary. Evidence candidates stay separate from row presentation. A later structured Markdown parser may improve heading/list semantics only when it preserves these provenance, integrity, and fallback rules.

### States, interaction, and accessibility

| State | Treatment |
|---|---|
| **Empty Projects / Experiences** | Name the selected category, explain that its Markdown remains local, and provide one **Add [category] folder** action. Do not show the other category's empty state or legacy Base Resume controls. |
| **Choosing / importing** | Keep the trigger unavailable against duplicate submit, preserve the selected category and typed display name, and announce concise atomic progress. No import begins until the folder is deliberately submitted. |
| **Unreadable, unsafe, or empty folder** | Keep the collection unchanged; provide one concise error and safe next action. Do not expose an absolute path, raw adapter detail, or partial import. |
| **Imported** | Announce the imported category and document count. New evidence is plainly **Ready for review**; it is not available to Resume Coach until individually approved. |
| **Expanded details** | The trigger exposes `aria-expanded` and controls its details region. Document names and review actions follow logical reading order; collapse returns focus to its trigger. |

At 320 CSS px and 400% zoom, outer/inner tabs, the add control, collection rows, and expanded review actions reflow into one column without horizontal scrolling. Every add button, tab, expand/collapse control, and evidence review action has a visible focus indicator and accessible name. Status updates use one polite atomic region. The collection shows no local paths, IDs, digests, raw parser diagnostics, prompts, or Base Resume extraction controls.

### Key flow: Adrian adds an experience folder

1. Adrian opens **Resume > Experience & Projects** and chooses **Experiences**.
2. He selects **Add experience folder**, reads that only local Markdown will be copied, and deliberately chooses a folder.
3. The workspace validates the bounded local contents and copies eligible Markdown without changing the source.
4. **Climax:** A new Experience row appears with its derived summary, document count, and **Ready for review** state; Adrian can immediately expand it to inspect and individually review evidence.
5. Later, only approved entries become selectable for Resume Coach. `Resume.pdf` remains unchanged in Resume > Edit throughout.

Failure: an invalid, empty, oversized, linked, or unreadable folder leaves both collection and source unchanged, retains the selected tab, announces the problem, and offers a safe retry. No Base Resume extraction, cloud, manual-editor, or automatic fallback is offered.

## Approved Change - 2026-08-26: Source-folder resume documentation

### Application-native correction (2026-08-26)

The prior external-Codex handoff interpretation is superseded. Adrian selects a real Project or Experience folder in the app, gives the registered local LLM documentation skill explicit consent, and sees bounded progress and the three proposed review artifacts returned by the application agent. The UI does not ask Adrian to copy a prompt into Codex. The agent may use only its declared skills and typed local file tools; every read/write path, extension, limit, and prohibited operation is enforced by the application boundary. Import and individual evidence approval remain explicit gates.

This supersedes every rule above that treats a Project or Experience source folder as a Markdown import. Adrian selects a real working folder containing code and related project material. The active flow does not copy that source into the evidence library or make it evidence; it explicitly invokes a resume-evidence documentation skill to inspect safe local material and create three proposed/unreviewed artifacts outside the source: `project-overview.md`, `resume-evidence.md`, and `resume-bullet-candidates.md`.

The documentation skill is local, bounded, and read-only: it accepts safe textual documentation, manifest, configuration, source, and test files within an allowlist and exclusion policy; it does not follow links, read arbitrary binary/dependency/generated content, alter the source, watch folders, call a network, or approve evidence. Every retained fact is atomic, selected-folder-relative, and heading/line traceable; unknown metrics, ownership, dates, users, deployment, outcomes, and skills remain explicit unknowns. The three outputs require an explicit import and individual evidence approval before Resume Coach can use them.

The selected inner tab has one **Document project folder** or **Document experience folder** action. Its compact disclosure names the selected-folder scope, non-mutation guarantee, proposed-output consequence, and recovery path. Collection summaries are derived only from `project-overview.md` using the bounded deterministic rule; details show generated artifact names and individual review controls but never raw source paths, IDs, digests, prompts, model data, or diagnostics. `Resume.pdf` remains an immutable template in Resume > Edit and is not read, imported, or extracted here.
