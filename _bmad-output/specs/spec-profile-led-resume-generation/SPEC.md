---
id: SPEC-profile-led-resume-generation
companions:
  - data-contract.md
  - local-model-contract.md
  - acceptance-tests.md
  - ../../planning-artifacts/architecture/architecture-Resume-2026-08-07/ARCHITECTURE-SPINE.md
  - ../../planning-artifacts/ux-designs/ux-Resume-2026-08-06/DESIGN.md
  - ../../planning-artifacts/ux-designs/ux-Resume-2026-08-06/EXPERIENCE.md
sources:
  - ../../planning-artifacts/sprint-change-proposal-2026-08-25-resume-profile-local-llm.md
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for Epic 8. Architecture decisions AD-13 and AD-14 remain stable identifiers.

# Profile-led Resume Generation

## Why

The manual Current Base Resume editor does not serve the approved Resume experience. Adrian needs a compact candidate profile, an immutable `Resume.pdf` visual reference, and an explicitly local Coach that produces reviewable material without changing the template or weakening claim provenance.

## Capabilities

- **CAP-1 — Versioned candidate profile**
  - **intent:** Adrian can save personal, contact, and education details as a Candidate Profile revision for resume generation.
  - **success:** A save creates an immutable revision only when all required fields are valid; later Coach requests reference that exact revision and cannot use unsaved values.

- **CAP-2 — Immutable template and legacy preservation**
  - **intent:** Adrian can use a digest-verified `Resume.pdf` template while retaining prior Current Base Resume records as history.
  - **success:** Preview serves only the designated bundled template byte copy; migration `0021_resume_profile_materials` preserves all legacy records without converting reconstructed draft text or allowing new legacy writes.

- **CAP-3 — Useful preview-only Resume Edit**
  - **intent:** Adrian can save profile details and inspect the template when local AI is unavailable.
  - **success:** Resume Edit exposes Profile, Coach state, and native template preview/fallback only; it contains no manual resume editor, claim repair, approval, export, version, or developer-facing controls.

- **CAP-4 — Explicit private Resume Coach**
  - **intent:** Adrian can submit one deliberate Coach request using exactly selected local material.
  - **success:** Each request requires current saved profile, individually selected approved Experience & Projects evidence, optional Captured Opportunity, current local-model configuration, request-specific consent, and one visible submit action.

- **CAP-5 — Provenanced material draft handoff**
  - **intent:** Adrian can inspect a generated proposal and choose to send it to review without silently changing a resume.
  - **success:** A valid response persists as a separate immutable Material Draft with profile/template/evidence/opportunity snapshots; every candidate-facing claim has selected approved-evidence support; **Use as draft** creates one review handoff and no Material Version, render, or export.

- **CAP-6 — Safe migration and recovery**
  - **intent:** The application can move to the Profile-led model without corrupting historical data or template state.
  - **success:** `0021` is forward-only database DDL/backfill; template staging recovers abandoned files, fails closed on missing/digest-mismatched designated bytes, and leaves no designation or partial draft after failure.

## Constraints

- **AD-13:** Profile, template, draft, version, and claim-support provenance is append-only, local, UUIDv7 identified, and digest-pinned. `Resume.pdf` is never edited or represented as a generated draft.
- **AD-14:** `0021_resume_profile_materials` leaves `current_base_resume_*` records/files intact as read-only history. New Resume Edit actions never use legacy manual-editor writes.
- `LocalModelGateway` is server-side only and calls only `http://127.0.0.1:1234/api/v1/chat` with an OS-vault token, a Settings-validated exact Qwen3.5-9B model identifier, `store: false`, no response chaining, no tools/MCP, no CORS/LAN exposure, no cloud fallback, and no automatic retry.
- Consent binds the exact input snapshots and request text. Operational audit events contain UUIDv7 IDs and SHA-256 digests only, never tokens, paths, prompts, or model output.
- The local model returns bounded structured data only. It cannot create PDF, HTML, TeX, arbitrary files, a template change, a claim-support decision, a Material Version, or an export.

## Non-goals

- Manual editing, approval, or export of a Current Base Resume from Resume Edit.
- Rendering a generated resume that claims visual fidelity to `Resume.pdf`; renderer selection and export remain later gated work.
- Cloud AI, automated opportunity retrieval, browser automation, model tools, MCP, or local-network model serving.
- Migrating raw legacy Current Base Resume draft/proposal text into a new generated material.

## Success signal

With a saved valid profile, selected reviewed material, an optional captured opportunity, and ready local AI, Adrian can consent to one local request, read its fully supported draft, and hand it to review while the original template remains byte-identical. If any prerequisite or validation fails, Resume Edit retains safe local state and offers only the applicable recovery action.

## Open Questions

- Which Windows credential-vault adapter/library will fulfill the existing OS-vault invariant without exposing the LM Studio API token to browser code or SQLite?
