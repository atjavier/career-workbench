# PRD Addendum: Architecture Decision Register

This addendum captures technical choices deferred by the PRD. They are not approved designs and must be resolved without violating the PRD's privacy, source-compliance, truthfulness, manual-refresh, and human-review requirements.

## A. Source adapters and compliance registry

Architecture must define an allowlist-backed source registry, a documented approval workflow, and the adapter boundary for company-career sources, permitted feeds, and user-configured platform search URLs. It must specify how terms, rate limits, robots/access rules, authentication requirements, field mappings, and source changes are reviewed. An adapter must fail closed when permission is uncertain.

## B. Fit assessment implementation

Decide whether Fit Labels are implemented by deterministic rules, constrained model-assisted extraction plus deterministic labeling, or another auditable approach. The design must retain the factors and candidate/posting evidence behind every label, account for unknowns and staleness, and prohibit conversion into a hiring prediction.

## C. AI processing and cost boundary

Choose an AI provider and model after confirming data-retention, training, regional processing, security, and cost capabilities. Define minimal prompt payloads, redaction/minimization, no-training default, per-request accounting, monthly/user caps, timeout and retry behavior, and how evidence validation prevents a model output from becoming a candidate claim without support.

## D. Google OAuth and Sheets synchronization

Select the OAuth client architecture and minimum scopes. Decide how tokens are encrypted, how spreadsheet selection/creation works, the normalized sheet/table layout, stable entity keys, write idempotency, conflict handling for user edits in Sheets, and recovery after expired/revoked access. The spreadsheet must remain understandable and useful to the user without the product.

## E. Document editing and exports

Choose the editable-source format and document-generation path. Validate that templates remain ATS-readable, semantic content survives edits, exported PDF matches the approved Draft, and versions are immutable. The solution must not write to the Base Resume and must preserve material provenance.

## F. Private deployment and retention

Decide authentication model, data store, encrypted fields, retention/deletion interface, backups, and recovery. The user should be able to understand what data is retained locally versus shared with Google and the selected AI provider.

## Current opportunity UX — 2026-10-05

This update supersedes conflicting earlier fit, version-history and application-tracking descriptions. Opportunity CRUD is implemented: review supplied posting text, explicitly Add opportunity, view/edit saved details with revision conflict checks, and permanently delete the opportunity plus its attached tailored output. Review details prepares editable fields without saving; Add opportunity performs persistence. Use short progress, error and success messages that describe the user's task.

Jobs has All Opportunities and Applied sidebar subsections. Applied tracking is not implemented; display one honest empty-state message and Browse opportunities link. Do not show roadmap cards or imply that saving an opportunity marks it applied. Once tracking is implemented, the empty state must reflect actual applied-job storage.

One base resume is selected automatically; each opportunity owns one current tailored result. Successful regeneration replaces that result; failure preserves it. Job edits recommend regeneration. Deletion removes the attached output while retaining the base resume. Fit assessment is deferred.

Design recommendation, awaiting user selection: a compact list of horizontal opportunity cards with role/company first, location/work style and dates beneath, and one View opportunity action. Retain search and Add opportunity in the header; stack fields on narrow screens. Lists support scanning and comparison as the library grows; the evidence grid remains appropriate for distinct project/experience collections. Do not change the opportunity layout solely from this recommendation.

## Superseding Add opportunity flow — 2026-10-05

The user reported that the modal displayed review-success text without visible review fields. The previous copy-only correction did not establish that the interaction worked. The current implementation replaces that modal and its staged review interaction with `/opportunities/new`. Every job field is visible immediately. Required inputs are title, company, posting URL and job description; optional location, work style, posted date and requirements are stored as Unknown when blank. One explicit Add opportunity action validates and persists a job, then opens its detail page with success feedback. Errors retain entered values, identify the invalid field and focus the error summary. Cancel returns to All Opportunities without a database write. No URL retrieval or AI request occurs when adding a job.

Internal historic table/command names may still use captured-opportunity terminology; active product labels use Add opportunity and saved jobs. Applied still has its honest empty state and Browse opportunities link. The horizontal-card list remains a design recommendation awaiting user selection.

Verification must include live browser submission against an isolated database; source/SSR checks alone cannot establish that a multi-step form works. See spec-opportunity-actions-and-helpful-empty-states.md for execution evidence.

## Paste-first refinement — 2026-10-05

The Add opportunity page places URL and description first. Pasting description extracts explicitly recognizable fields through the shared bounded plain-text parser. It fills blank or previously auto-filled fields while preserving manual corrections. Requirements become one item per line; valid posted dates are converted for the date input. All details stay visible and editable; unknown fields are visibly Unknown or blank, never fabricated. One Add opportunity submission saves; errors retain values. The library, Add opportunity and Applied headers have short descriptions. Similar saved jobs remain separate and appear as a duplicate notice with a comparison link.

This is plain-text assistance, not general semantic AI extraction or URL retrieval. Proposed next improvement: explicit local AI extraction of the supplied description with structured validation and source excerpts, followed by optional Import from link that retrieves a public posting and fills the same editable fields. It must use bounded public-HTTPS fetching, validate redirect/address destinations, omit user credentials/cookies, extract job-specific structured data when available, and offer pasted-description fallback when retrieval fails. No automatic background retrieval or silent saving; source text and the original URL remain attached. URL-only import requires a separately documented/tested implementation and explicit user action.


## Approved source-only creation change — 2026-10-05

The approved `sprint-change-proposal-2026-10-05-source-only-opportunity-draft.md` supersedes URL import and automatic heuristic filling in the active Add opportunity page. URL plus pasted description → Generate draft with configured local AI → editable Review opportunity → explicit Add opportunity. The URL is retained only as reference and never retrieved. Validate every suggestion against exact source lines and conservative field context; missing, contradictory or ambiguous facts stay blank. No assumed year, inferred work style, fabricated requirement or embedded instruction execution. Preserve original source and user corrections. Source changes invalidate submission; late responses are discarded. Offer explicit manual review/completion when local AI fails, with inputs intact. Draft generation creates no opportunity records. Existing CRUD, physical deletion of attached tailored resume and single-base/single-tailored constraints remain. Applied tracking and opportunity fit remain unavailable. Implementation evidence is recorded in `spec-source-only-opportunity-draft.md`; this addendum records the approved behavior, not model quality claims.


## Approved description-centered generation and deletion convention — 2026-10-05

Supersedes the separate extracted-requirements review UI: generate one editable, source-grounded formatted description with headings/bullets, plus role/company and optional metadata. Role titles use Title Case (Backend Developer), preserving common acronyms, rather than programming PascalCase. Original source stays separately stored and collapsed; description organization may remove exact duplicate lines but cannot invent facts, omit source content, or reclassify benefits as requirements. Use source-section boundaries to validate AI organization and source-preserving fallback for incomplete/unsupported output. No repeated requirements card on details. Save the final user-reviewed description with its opportunity revision, and physically delete it with the job and attached tailored resume. If original text changes during edit, refresh unchanged formatting and preserve an explicitly edited replacement. Delete uses shared Dialog/Button Cancel/Delete convention matching Profile/Evidence, not typed DELETE. Missing facts, manual completion, source invalidation and explicit Add persistence continue. Verification is recorded in spec-refined-opportunity-description.md.


## Approved direct creation — 2026-10-05

Supersedes the pre-save Generate draft → Review opportunity approval requirement in the source-only and refined-description decisions. URL + pasted description → Add opportunity → local AI formatting/extraction + save → details page. The submit is the authorization to save; no additional approval screen. Preserve source-only grounding, readable role Title Case, original source, reference-only URL, optional unknowns, editable saved details and standard deletion. If required role/company is missing or AI fails, retain inputs and create no partial record; offer missing-field/manual completion and direct resubmit. Manual completion uses source-preserving formatting without local AI. Disable fields during the request so submitted source stays stable. Evidence recorded in spec-direct-formatted-opportunity-creation.md; earlier draft approval references are historical.


## Approved explicit identity recovery — 2026-10-05

Direct creation recognizes uniquely stated role sentences (including “We are seeking a highly skilled backend developer to join our team”) and standalone corporate names even when AI omits the fields or returns incomplete excerpts. The entire paste is sent unchanged. Contradictory identity remains blank; unrelated role mentions, requirements and inferred employer names cannot fill required fields. This supersedes dependence on AI-proposed identity while retaining source-only grounding and direct Add behavior.

Company extraction and missing-company recovery require an explicit employer label or numeric corporate footer; an unanchored corporate-looking line alone may be a call to action and requires completion.


## Approved Job Opportunity Reader — 2026-10-05

Create a dedicated stateless application Job Opportunity Reader agent following existing full agent-card conventions. It reads the entire paste, distinguishes advertised role/hiring employer from incidental mentions, returns cited facts and source-preserving description organization. Host evidence validation must recognize position summaries and About-employer prose/headings, including Junior Automation Developer / Regal Rexnord. This supersedes the earlier label/numeric-footer-only company validation and hiring-sentence-only role restriction. No inferred unknowns, external retrieval, agent persistence or draft approval. Reuse single Add and manual recovery. One bounded focused retry may address unresolved required identity. Implementation/evidence in spec-job-opportunity-reader-agent.md.


## Approved automatic reader with general evidence contract — 2026-10-05

Supersedes manual missing-field completion, heuristic identity recovery and posting-specific role/company grammar checks in earlier opportunity decisions. Only URL + pasted description + Add are shown during creation. A dedicated named Job Opportunity Reader interprets the full posting; host validates response shape, bounds and source citations rather than imposing sentence or job-name patterns. One focused retry may recover missing identity. Genuinely missing metadata remains Unknown in existing storage; no follow-up details form. Unavailable/malformed AI retains inputs for retry and saves nothing. Edit saved details remains deliberate. Shared resume prompts belong in adapters/local-model; domain retains application data/contracts. Audit findings and broader recommendations are documented separately from implemented changes.


## Approved audit follow-ups — 2026-10-05

User approved completing the remaining repository audit findings. Requirements and acceptance are recorded in implementation-artifacts/spec-codebase-audit-followups.md: dynamic persona-based AI clarification planning, forward flexible-category database upgrade preserving dependent history, application orchestration layer and feature adapters/actions, standalone production startup, and verified feature naming/dead-code cleanup. Earlier deferred dispositions are superseded by this approval; implementation status awaits verification.


## Implemented audit follow-ups — 2026-10-05

Dynamic clarification questions now come from selected local AI (Engineering Manager for experience; Principal/Staff Engineer for projects), with flexible2–3word categories, complete documented context/answers, source/history guards and preserved in-progress interviews. Supplied role/dates are candidate context, not synthetic fixed-category tasks. Read evidence again retries question planning from saved documents, retaining input/history and avoiding duplicate imports; folder failures are not silently marked complete. Forward0049 upgrades installed category constraints atomically while preserving dependent history. Adapter-consuming services moved into application; feature gateways/actions retain caller APIs. npm/Electron standalone launchers explicitly separate writable evidence roots from runtime assets. Current details and verification live in implementation-artifacts/spec-codebase-audit-followups.md and docs/application-ai-agents.md. This supersedes initial audit-deferred dispositions.
