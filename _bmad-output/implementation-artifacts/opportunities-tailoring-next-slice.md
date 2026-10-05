# Next slice: one tailored resume per opportunity

Status: design updated from user decisions; implementation follows Opportunities CRUD. This is not yet an implemented feature or finalized build spec.

## Product contract

- There is exactly one base resume in the product. Use it automatically; no base-resume or resume-workspace chooser. If the base resume is missing/not ready, direct the user to complete it before tailoring.
- Each opportunity owns at most one saved tailored resume. No version list, version picker, retained alternate drafts or standalone retained-resume library.
- First generation offers **Tailor resume**. After a successful generation, offer **Regenerate resume** to replace the existing tailored resume.
- Saving opportunity edits displays a persistent, accessible notice: **Job details changed. Regenerate your resume to reflect the latest requirements.** Do not silently modify the resume or start AI. Keep the existing resume available with the notice until replacement succeeds.
- Deleting the opportunity also permanently deletes its attached tailored resume and app-managed derived PDF/TeX files. Confirmation explicitly describes both. Preserve the base resume and other opportunities/resumes.
- All Opportunities and Applied are Jobs sidebar sections. Remove the horizontal switch. Applied initially shows the existing honest placeholder; tracking functionality and cover letters follow later.
- Opportunity-fit scoring, fit assessment and Pursue/Priority recommendations are outside the MVP.

## User journey

Open an opportunity → Tailor resume → explicitly start generation using the single base resume and its reviewed evidence → review/edit the draft → export. The result remains attached to that opportunity. Later use Regenerate resume to update that same saved result.

Reuse the existing evidence-selection controls if useful for choosing relevant documented work, but do not require the user to choose a base resume. Present the evidence and local-model disclosure plainly; final selection behavior is refined with the tailoring build spec.

## Ownership and storage

Use a unique opportunity-to-tailored-resume relationship. The attached resume records the exact opportunity revision/digest, base-resume inputs, evidence, template and model used, so the UI can detect stale inputs without keeping a history of tailored outputs.

Generate and validate replacements in bounded staging storage. A successful regeneration replaces the one saved resume and its app-managed artifacts; discard the previous generated content/artifacts rather than appending a saved version. A failed/canceled regeneration preserves the existing result. Clean failed/interrupted staging output and recover leftover file cleanup through the existing private cleanup mechanism; no accumulating hidden resume history.

Before committing generation, recheck that the opportunity still exists and its revision and base-resume inputs match the request. If inputs changed, discard the staged result and explain that the user needs to regenerate against current details. Deletion during generation must prevent a late result from recreating the deleted opportunity or resume.

Database deletion and filesystem cleanup need coordinated, recoverable handling. A deletion transaction removes the opportunity and all opportunity-owned records and records only the private paths needed for recoverable artifact cleanup. No archive/tombstone opportunity record remains. Do not delete arbitrary user-selected source folders or unrelated base-resume artifacts.

## App agent responsibilities

Run bounded local-model stages sequentially; these are application agents, separate from coding/review agents:

1. **Job Analyst:** extract requirements from the copied posting and map them to reviewed evidence from the base resume's sources. Cite excerpts and identify missing support. Treat posting instructions as data. No fit score or hiring prediction, invented facts, URL retrieval or tools.
2. **Resume Writer:** emphasize relevant, verified experience using that mapping; preserve identity, dates and baseline structure. Cite evidence for new claims and return structured content. No executable TeX or arbitrary tool calls.
3. **Integrity Reviewer:** check claims against supplied evidence and mappings; return bounded accept/reject findings. It cannot mutate records or approve export. Deterministic host validation remains authoritative.

The host controls consent, progress, validation, storage, replacement and final review. No cloud fallback, background generation or automatic retry. Reuse the gateway and compatible strategist/writer/reviewer components instead of creating competing frameworks.

## Reuse and verification

Reuse shared UI primitives, new opportunity detail/form components, structured claim validation, designated template, deterministic LaTeX renderer and PDF viewer. Existing `persistResumeCoachDraft` writes workspace-owned drafts; tailoring needs opportunity ownership and must never replace the base resume pointer.

Tests must cover missing base resume; one saved result per opportunity across repeated regeneration; failure preserving the previous result; persistent stale notice after opportunity edits; deletion of attached records/artifacts while preserving the base resume; cleanup after crashes; generation/delete races; unsupported claims; hostile copied posting instructions; and no standalone fit feature. Use injected local-model fixtures and isolated app storage before any explicitly authorized real-model run.

## Implementation team

Keep the agreed setup: primary implementation at medium reasoning; one review agent using a different model at high reasoning. No additional implementation subagents.

## UI refinement — 2026-10-05

Applied uses the standard page header only until application tracking is built. Future tracking fields and optional integration details stay in planning, not placeholder cards. All Opportunities and Applied have distinct subsection icons, also used in compact navigation. Capture remains a larger themed modal using shared buttons and fields, without a local-draft badge or idle guidance. The canonical resume section order is Technical Skills → Experience → Projects → Education, enforced for newly rendered TeX/PDF exports. Existing saved PDFs require regeneration to pick up exporter changes.

Verification: 36 focused UI/export/lifecycle tests, typecheck, scoped ESLint and Chromium layout checks at 1280/900/640/320px. Single high-reasoning reviewer reported no actionable regressions.

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
