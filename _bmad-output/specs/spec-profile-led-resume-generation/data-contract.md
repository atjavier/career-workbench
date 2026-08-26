# Data and Migration Contract

Implements AD-13 and AD-14. All identifiers are UUIDv7; timestamps are UTC ISO 8601; digests are `sha256:<64 lowercase hex>`; immutable records reject `UPDATE` and `DELETE`.

## Migration `0021_resume_profile_materials`

The existing migration runner applies one SQL file plus its `schema_migrations` record inside `BEGIN IMMEDIATE`. `0021` is database-only DDL/backfill and registers after `0020_captured_opportunity_url_constraint`.

| Object | Contract |
| --- | --- |
| `candidate_profiles` | Immutable aggregate root: `id`, `created_at`. |
| `candidate_profile_revisions` | `id`, `profile_id`, linear `revision_number`, `parent_revision_id`, required profile fields, optional profile fields, canonical content/digest, `created_at`. A trigger permits a parent only from the same profile at `revision_number - 1`. |
| `resume_template_sources` | `id`, `origin` (`bundled` or `legacy_current_base_resume`), filename, digest, byte size, private relative location, optional `legacy_source_id`, `created_at`. A bundled location is below `resume-templates/`; a legacy candidate refers to an existing immutable legacy source. |
| `local_model_configuration_revisions` | `id`, fixed loopback endpoint, exact validated model identifier, Qwen3.5-9B display label, OS-vault secret reference, fingerprint/digest, `created_at`. No token column. |
| `resume_generation_state` | One mutable singleton with nullable current profile, designated template, current configuration, `revision_number`, and `updated_at`. Every mutation uses compare-and-swap on `revision_number`. Template re-designation affects only future drafts. |
| `material_drafts` | `id`, `kind = resume`, profile FK/digest, template FK/digest, optional opportunity FK/digest, private request text/digest, validated content JSON, content/provenance digests, `created_at`. |
| `material_draft_evidence` | Immutable draft-to-approved-evidence join. The command selects current reviewed Experience & Projects evidence; insert rejects any non-approved revision. |
| `material_draft_claims` | Immutable normalized claim rows with a unique ordinal per draft. |
| `material_claim_support` | Immutable claim-to-approved-evidence joins. A review command blocks a claim without support. |
| `material_draft_handoffs` | One immutable **Use as draft** record per pending draft with review-flow destination. |
| `material_versions` | Future immutable review/export record with source-draft FK and explicit profile/template/opportunity digest snapshots. Resume Edit does not create it. |

## Profile validation

Required fields: first name, last name, email, phone number, school, degree/program, and expected/graduation year. Optional fields: middle name, GWA, Latin honors, LinkedIn URL, and GitHub URL. Required strings are trimmed, non-empty, bounded plain text; email and supplied URLs have syntactic validation; no optional field is treated as a defect when absent. A failed save creates no revision and returns field-specific errors plus a focusable error summary.

## Template bootstrap and preview

`0021` backfills template-candidate metadata from `current_base_resume_sources` only. It does not parse, copy, transform, or designate legacy reconstructed draft text.

An explicit bootstrap stages repository `Resume.pdf` below `resume-templates/.staging/<template-id>`, verifies type/size/digest, atomically renames it to `resume-templates/<template-id>/Resume.pdf`, then inserts the bundled row and singleton designation in one database transaction. Startup/bootstrap recovery removes abandoned staging paths. A missing or digest-mismatched designated copy leaves the template unavailable; it never selects a legacy candidate or another file automatically.

The PDF route receives no filesystem path or source URL. It re-verifies designated bytes, serves inline same-origin PDF content, and provides a visible open/download fallback. A draft, profile, or generated response never changes its response bytes.

## Legacy compatibility

`current_base_resume_*` tables, files, and existing versions remain retained history. After `0021`, legacy Current Base Resume write actions/routes return a safe history-only result and cannot create Profile-led drafts, handoffs, versions, renders, or exports. Tests must demonstrate that every legacy row/file survives upgrade and that no new legacy manual edit succeeds.
