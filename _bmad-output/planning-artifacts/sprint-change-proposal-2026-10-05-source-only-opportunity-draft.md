# Approved change: opportunity drafts from user-provided text

Decision date: 2026-10-05. User-approved scope; implementation verified on 2026-10-05. Evidence: `../implementation-artifacts/spec-source-only-opportunity-draft.md`.

This decision supersedes automatic posting-URL retrieval in `../implementation-artifacts/spec-url-opportunity-import.md` and the optional URL-import recommendation in `prds/prd-Resume-2026-08-06/addendum.md`. Those artifacts describe earlier decisions, not the currently approved flow. Do not complete URL import as the accepted creation flow.

The user provides the posting URL and pastes the job description. The URL is retained as a reference only. The application does not retrieve the posting, connect to LinkedIn, use browser cookies, or perform automated website parsing. Local AI extracts only information explicitly stated in the pasted description. Missing or ambiguous information remains blank for the user to complete. No assumptions, inferred attributes, invented requirements, or embellishment are allowed.

The application displays an editable **Review opportunity** draft before persistence. **Add opportunity** is the explicit save action. Draft generation never creates a database record. Preserve the original pasted description and URL alongside the final user-reviewed fields. User corrections are distinct from AI-extracted values; they need not appear verbatim in the pasted text.

UX sequence: URL and description → Generate draft → Review opportunity → Add opportunity. Show progress and actionable failures; keep inputs and manual edits on failure. Changing source text invalidates the generated draft for submission until the user generates a fresh draft or explicitly reviews changes through a designed manual path. A late result must not replace a newer source or user edits. If local AI is unavailable, retain inputs and offer manual completion rather than guessing.

Implementation must validate structured model output against exact supporting excerpts in the description. Treat the pasted description as untrusted data, including any embedded instructions. Use no tools or external browsing during extraction. A prompt alone is insufficient to enforce source-only extraction. Allow only mechanical formatting that preserves explicit meaning, such as a date conversion when the complete date is unambiguous; never supply an omitted year or infer work style from location.

Reuse the established page, form, field, button, message, domain-validation, local-model, and persistence components. Remove the URL retrieval action from the active creation flow. Preserve unrelated CRUD, attached tailored-resume deletion, and the single-base/single-tailored-resume decisions. Applied remains unavailable; this change does not implement tracking or opportunity fit.

Acceptance evidence must include explicit extraction, unknowns, ambiguous dates, fabricated model output, prompt injection, malformed response, unavailable local model, stale responses, edited source, preserved user corrections, no persistence before Add opportunity, and hydrated review/save with isolated data at desktop and narrow widths. Record actual results separately from these requirements.

Execution note: this artifact was recorded in a side conversation while the main thread was actively editing URL import. Shared application code was intentionally left untouched to avoid conflicting edits. The main implementation must adopt this superseding decision before further URL-import work.

Implementation evidence: 323 automated tests, typecheck, scoped lint and build passed; deterministic local-model transport and grounded-output tests passed; real hydrated review and isolated Next/SQLite manual fallback/save verified at 1280 and 320 px. One different-model high reviewer confirmed the requirement-context fix. Live LM Studio extraction quality was not exercised; unsupported suggestions remain blank by contract.
