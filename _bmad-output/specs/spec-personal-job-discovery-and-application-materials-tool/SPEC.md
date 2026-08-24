---
id: SPEC-personal-job-discovery-and-application-materials-tool
companions:
  - acceptance-criteria.md
  - ../../planning-artifacts/architecture/architecture-Resume-2026-08-07/ARCHITECTURE-SPINE.md
  - ../../planning-artifacts/ux-designs/ux-Resume-2026-08-06/DESIGN.md
  - ../../planning-artifacts/ux-designs/ux-Resume-2026-08-06/EXPERIENCE.md
sources:
  - ../../planning-artifacts/prds/prd-Resume-2026-08-06/prd.md
---

# Personal Job Discovery and Application Materials Tool

## Why

Adrian needs a private, Philippines-first workspace to discover eligible entry-level software roles, understand evidence-backed fit, create truthful tailored materials, and track applications without surrendering ownership or automating applications. The local-only MVP makes the computer, rather than a hosted service, the authority for this sensitive career data.

## Capabilities

- **CAP-1**
  - **intent:** User can import materials and individually review candidate evidence before it is usable as fact.
  - **success:** Only approved evidence with source reference and review state can support a claim.
- **CAP-2**
  - **intent:** User can retain a protected Base Resume while creating separate tailored materials.
  - **success:** No draft or export changes the Base Resume, and each Material Version identifies its inputs.
- **CAP-3**
  - **intent:** User can set Philippines-first entry-level job preferences.
  - **success:** Default pathways and work-style ranking are applied without changing source permissions.
- **CAP-4**
  - **intent:** User can explicitly refresh selected permitted sources.
  - **success:** Each bounded run shows selected-source outcomes and never creates scheduled, polling, or automatic-retry work.
- **CAP-5**
  - **intent:** User can inspect normalized job listings and probable duplicates.
  - **success:** Attribution, source URL, freshness, unknown fields, and retained duplicate records remain inspectable.
- **CAP-6**
  - **intent:** User can enable only policy-compliant discovery sources.
  - **success:** An enabled source has an approved method and policy/rate metadata; all others remain browser handoffs or manual imports.
- **CAP-7**
  - **intent:** User can receive a transparent evidence-based fit assessment.
  - **success:** Strong, Potential, or Stretch reflects versioned inputs and never predicts hiring outcomes.
- **CAP-8**
  - **intent:** User can inspect the support and gaps behind a fit assessment.
  - **success:** Each match links to approved evidence and each requirement summary links to a short posting excerpt and source.
- **CAP-9**
  - **intent:** User can request a local AI draft for a selected role.
  - **success:** LM Studio receives only the selected listing and approved evidence after the local-data disclosure.
- **CAP-10**
  - **intent:** User can review and edit truthful, ATS-readable drafts.
  - **success:** Unsupported generated or detectable edited claims block export while preserving editing control.
- **CAP-11**
  - **intent:** User can explicitly approve and export tailored resume and cover-letter versions.
  - **success:** Each approval creates a new immutable LaTeX and PDF Material Version with provenance.
- **CAP-12**
  - **intent:** User can maintain an application record for saved listings.
  - **success:** Stage, notes, follow-ups, attached materials, and ordered interview rounds remain local-authoritative.
- **CAP-13**
  - **intent:** User can connect a tracker spreadsheet they create or explicitly identify.
  - **success:** Desktop OAuth requests only Sheets scope, verifies edit access, stores tokens in the OS vault, and supports revocation.
- **CAP-14**
  - **intent:** User can mirror tracker data to Google Sheets without losing local authority.
  - **success:** Stable IDs/revisions/hashes prevent duplicate writes; failed and conflicting changes remain locally recoverable and require explicit reconciliation.
- **CAP-15**
  - **intent:** User can open an original application destination from a listing.
  - **success:** The destination is identified and the product neither prefills nor submits employer forms.
- **CAP-16**
  - **intent:** User can manage local records, recovery, and activity history.
  - **success:** The UI supports scoped export, deletion, restore, local backup protected by the device's OS-account/full-disk-encryption boundary, and metadata-only audit history.

## Constraints

- The local-only browser MVP and architecture AD-1 through AD-10 are binding; `ARCHITECTURE-SPINE.md` is required reading for every implementation consumer.
- The app binds to `127.0.0.1`; SQLite and private app-data are authoritative; the OS account is the access boundary. There is no public deployment or product login.
- Retrieval is user-started, source-policy-gated, rate-limited, and bounded. No background retrieval, credential reuse, access-control bypass, or unauthorized scraping is allowed.
- Approved evidence is the sole basis for candidate claims. No export occurs before explicit review acknowledgement and resolution/removal of blocking warnings.
- Qwen3.5-9B through local LM Studio is the sole drafting provider. No cloud AI fallback, LAN model serving, model tools/MCP, or automatic retry is allowed.
- `resume.tex` is immutable; a matching cover-letter LaTeX template and the local TeXworks toolchain produce versioned source and PDF exports.
- Google Sheets is a user-owned mirror, not a second authority. Desktop loopback OAuth requests only Sheets scope; notes remain local unless individually opted in.

## Non-goals

- Public hosting, multi-user collaboration, coaching service workflows, or a product sign-in system.
- Scheduled discovery, crawling beyond an approved source boundary, automated retries, or any employer-account/application-form automation.
- Cloud AI, misleading ATS tactics, keyword stuffing, hidden content, hiring predictions, mass outreach, or automatic application submission.
- Treating a manually edited Google Sheet as an authoritative database.

## Success signal

- Adrian can manually refresh permitted sources, select a role, inspect every fit match and gap, produce a reviewed LaTeX/PDF resume and cover letter, and open the employer application link without any unsupported claim or automated submission.
- After a local tracker change, Adrian can see whether the selected Google Sheet mirrors it, recover from a failed/conflicting sync without losing local data, and export/delete/restore sensitive records from the UI.

## Open Questions

- Which initial source catalog, approval records, and per-source request budgets will be enabled?
- Is OS-account protection sufficient, or must the local database/files also use application-level encryption on the target device?

## Approved Change - 2026-08-22: Resume Evidence Library and PDF Base Resume

This section supersedes the earlier immutable `resume.tex` and TeXworks statements in this SPEC.

- The user-managed `resume-evidence/` directory is the single recursive library root for reviewed resume evidence. It holds Markdown evidence for projects and experiences; original project/document folders are read-only inputs and are never modified by the product.
- The Current Base Resume begins from a user-selected, locally parsed, text-readable PDF and is represented as an editable structured draft. Explicit approval creates a new retained base-resume version; it never overwrites a prior source or version.
- **Add Project** and **Add Experience** are separate user-started actions. The optional **Document for Resume** project flow uses the configured local model to propose standardized evidence from one selected folder; review is required before any proposal is stored or can support a claim.
- The exact structured-material rendering/export technology is now an implementation decision. It must create accessible, ATS-readable PDF and editable-source Material Versions without TeXworks, retain provenance, and require explicit approval.
