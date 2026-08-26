# Epic 8 Context: Profile-led Resume Generation

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Replace the active manual Current Base Resume experience with a private, profile-led workflow: versioned candidate details, a digest-pinned read-only `Resume.pdf` visual template, and explicitly consented local Coach requests that create separate, reviewable material drafts. This protects historical records and the source PDF while giving Adrian a simpler, trustworthy path to prepare tailored resume content without cloud transmission, hidden data use, automatic export, or unsupported claims.

## Stories

- Story 8.1: Version Candidate Profile and designate Resume template
- Story 8.2: Build simplified Resume Edit and preview-only state
- Story 8.3: Provide safe local Resume Coach requests
- Story 8.4: Hand off structured material drafts for review

## Requirements & Constraints

- Required profile data is first name, last name, email, phone number, and education comprising school, degree/program, and expected or graduation year. Middle name, GWA, Latin honors, LinkedIn URL, and GitHub URL are optional. Generation is unavailable until a valid profile revision is saved.
- Preserve all retained Current Base Resume sources, drafts, proposals, and versions as read-only history. Do not transform reconstructed legacy text into generated material, delete it, or let legacy write paths create new profile-led drafts or versions.
- `Resume.pdf` is an immutable style reference, never an editable resume, generated draft, or proof that generated content matches the template. Verify its private byte copy and SHA-256 digest before preview; pin the template digest on every draft and later version.
- Coach generation requires an exact saved profile revision, individually selected reviewed Experience & Projects evidence revisions, an optional Captured Opportunity revision, a configured local model, and one explicit per-request consent. A changed profile, evidence selection, opportunity, template, configuration, or user request invalidates consent.
- Send only the consented snapshots and user request to local LM Studio. Never fetch an opportunity URL, read arbitrary folders, use cloud or LAN services, tools/MCP, automatic retry, or a fallback generation path.
- Model output is bounded structured JSON only; it cannot author PDF, HTML, or TeX. Reject a response as a whole if it is malformed, exceeds bounds, fails the selection echo, or contains a claim without resolvable support from selected approved evidence. Do not persist partial output.
- A generated result remains a separate pending Material Draft. **Use as draft** creates one review handoff; it never approves claims, changes the template, creates a Material Version, renders, exports, or submits a resume. Claim validation, review acknowledgement, rendering, approval, and export remain explicit downstream gates.
- Use append-only local records and metadata-only audit events. Keep raw documents, prompts, model responses, credentials, tokens, filesystem paths, and adapter diagnostics out of logs and normal UI.

## Technical Decisions

- Keep the local-first modular-monolith boundary: Next.js binds only to `127.0.0.1`; SQLite and private OS-user app data are authoritative. State mutations use the domain-command, SQLite-transaction, append-only-audit pattern. Coach requests validate and obtain the response before the persistence transaction.
- Add forward-only migration `0021_resume_profile_materials` after `0020_captured_opportunity_url_constraint`. It introduces immutable candidate profile revisions, resume template sources, local-model configuration revisions, material drafts, selected-evidence joins, normalized claims/support joins, draft handoffs, and future material versions. `resume_generation_state` is the only mutable singleton pointer and uses compare-and-swap revision updates.
- Candidate revisions use UUIDv7, canonical content/digests, timestamps, linear per-profile parentage, and insert-only enforcement. Template source records retain origin, filename, digest, byte size, private relative path, optional legacy-source link, and are immutable.
- Only an explicit bundled-template bootstrap may stage, hash, validate, atomically publish, record, and designate the first `Resume.pdf` template. Startup and bootstrap recovery clean abandoned staging files and fail closed if the designated template copy or digest is missing; never choose a replacement automatically.
- The sole Coach adapter is server-side `LocalModelGateway` using LM Studio native REST v1 at fixed `http://127.0.0.1:1234/api/v1/chat`. It retrieves the required token solely through an OS-vault reference, verifies a Settings-validated exact model identifier, sends `store: false`, omits `previous_response_id`, rejects response IDs, and never exposes the token. The legacy OpenAI-compatible Evidence Documenter is not a Coach path.
- The same-origin PDF route serves only verified designated template bytes with inline PDF headers and an open/download fallback; it accepts no path or source URL. New Resume Edit routes/actions use Profile-led repositories only; legacy manual-editor writes are disabled with a safe history response.

## UX & Interaction Patterns

- Resume > Edit contains only a compact Profile details form, Resume Coach or its unavailable state, and a labelled read-only native template preview. Remove manual section editors, Current Base Resume controls, warning/provenance and evidence/skill cards, version history/approval controls, raw identifiers, and technical status from this screen.
- On desktop, use labelled Profile & Resume Coach and Resume template panes. At narrow widths and 400% zoom, stack profile, Coach/unavailable state, then template in one column with no horizontal scrolling. Preserve the shared muted-forest visual system, semantic labels, visible focus, text-backed status, and 24px target/accessibility intent.
- Save details is the profile form's clear action; field errors use plain-language, programmatically associated messages and a linked summary. Profile state clearly says whether details are saved or must be saved before generation.
- The template stays visibly read-only and is independent of profile typing or Coach output. Its frame has a precise title, keyboard entry/exit, an announced failure state, a visible open/download fallback, and an accessible template description when the PDF cannot be meaningfully read.
- Coach readiness names missing prerequisites and links to profile save, reviewed-material selection, or AI setup. The consent panel identifies LM Studio on this device, the configured model family, exact selected categories, named reviewed materials, and optional tailoring opportunity in plain language, while hiding IDs, digests, tokens, prompts, and diagnostics.
- During generation, preserve typed/profile state, mark the Coach busy, keep focus stable, prevent and explain duplicate submission, and announce completion or failure without replaying the transcript. If AI is unavailable, retain usable profile/template access and offer only **Set up local AI**; no manual-editor or substitute-generation fallback appears.
- Present generated content accessibly before enabling **Use as draft**. **Keep current** does not change a draft; each generation remains a separate pending draft. The visible handoff confirms that the template remains unchanged and directs Adrian to review the draft.

## Cross-Story Dependencies

- Establish the immutable profile, template, migration, and current-selection foundation before replacing the Resume Edit UI; the simplified UI must consume only the new Profile-led state.
- Coach requests depend on a saved valid profile, verified designated template, reviewed Experience & Projects evidence, and an optional confirmed Captured Opportunity. A selected opportunity remains session-scoped and is clearable before generation.
- Draft handoff depends on the Coach's validated, provenance-complete Material Draft. It connects to Epic 4's existing truthful claim-review, material-version approval, rendering, and export gates, which remain outside Resume Edit.
- Epic 1 retains ownership of reviewed Experience & Projects evidence and legacy-history preservation. Epic 7 supplies optional Captured Opportunity revisions; neither may be silently fetched or broadened into ambient Coach input.
