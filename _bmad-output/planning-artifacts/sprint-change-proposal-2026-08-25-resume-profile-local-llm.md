---
title: Sprint Change Proposal — Profile-led Resume and Local AI
date: 2026-08-25
status: approved
scope: major
sources:
  - prds/prd-Resume-2026-08-06/prd.md
  - epics.md
  - architecture/architecture-Resume-2026-08-07/ARCHITECTURE-SPINE.md
  - ux-designs/ux-Resume-2026-08-06/DESIGN.md
  - ux-designs/ux-Resume-2026-08-06/EXPERIENCE.md
---

# Sprint Change Proposal — Profile-led Resume and Local AI

**Approved:** 2026-08-25 by Adrian Javier.

## 1. Issue Summary

The implemented Current Base Resume workflow is a manual, section-by-section editor with proposal, warning, evidence, version, and approval controls. It does not match the approved end-user Resume experience: a compact candidate profile, immutable `Resume.pdf` template, reviewed Experience & Projects sources, and local-LLM Coach as the only tailoring path. Its reconstructed-text preview also cannot faithfully represent the source PDF.

Evidence: Story 1.6 and the current Resume implementation parse a PDF into an editable structured draft; the approved UX explicitly removes those controls and makes `Resume.pdf` a read-only visual template. The existing local-LM boundary is insufficient for a full Coach/material workflow and no versioned candidate-profile schema exists.

## 2. Checklist and Impact Analysis

| Checklist item | Status | Finding |
|---|---|---|
| Trigger/context | [x] | New stakeholder requirement plus failed manual-editor approach, exposed by Stories 1.6 and the Resume UI. |
| Epic impact | [!] | Epic 1 Story 1.6 is superseded; Epic 4 Stories 4.1–4.4 must consume profile/template/material records. |
| PRD impact | [!] | FR-1, FR-2, FR-10–FR-12 and the data model need a profile/template/material revision addendum. |
| Architecture impact | [!] | AD-2, AD-4, AD-8, AD-11 and persistence/adapters need new contracts. |
| UX impact | [x] | Finalized in the Profile-led Resume Workspace and Simplified Resume Edit updates. |
| Secondary impact | [!] | Existing Current Base Resume UI/actions/tests, migrations, LM Studio adapter, generated-PDF route, and Material Version tests need replacement or compatibility coverage. |

### Epic and story impact

- **Epic 1:** retain reviewed evidence and historical source preservation; replace Story 1.6's editable Current Base Resume goal with a compatibility/migration story.
- **Epic 4:** retain truthful claim, review, and export gates; replace listing-only/evidence-only input language with Candidate Profile revision + reviewed evidence + optional Captured Opportunity; defer renderer implementation until the template contract is approved.
- **New Epic 8: Profile-led Resume Generation:** must run before additional Resume polish. It makes the new data and UI model real without deleting prior history.
- **Existing Resume Edit UI work:** mark as superseded; do not extend the manual editor further. Keep the faithful source-PDF route only as a template-preview capability until its designated-template replacement is implemented.

## 3. Recommended Approach

**Hybrid of direct adjustment and controlled replacement — recommended.** Do not roll back retained PDF/evidence records. Add append-only profile/template/material entities, migrate existing Current Base Resume source data as historical/template candidates, then replace the UI in bounded stories. This is **major scope**, high effort and medium-high risk, because it changes persistence, local-model requests, provenance, and future material rendering.

Rollback is not recommended: it would discard useful local-source preservation and evidence work while still requiring the new profile/model schema. A PRD MVP reduction is not recommended: local-LLM tailoring and truthful material generation remain core product value.

## 4. Detailed Change Proposals

### PRD

**Sections 4.1, 4.5, 6, 8, and 14 — replace the Current Base Resume drafting model.**

OLD: a text-readable PDF is parsed into a structured editable Current Base Resume draft, which is updated through individual evidence proposals.

NEW: `Resume.pdf` is an immutable designated visual template. Candidate identity/contact/education details live in immutable Candidate Profile revisions. A local model receives only explicitly selected profile fields, reviewed evidence, and optional captured-opportunity text; it returns structured material content. Generated content is a separate reviewable Material Draft and never mutates the template. A deterministic renderer, selected in a later gated story, is required before claiming generated output matches the template.

Add required profile fields: First Name, Last Name, email, phone number, and education (school, degree/program, expected/graduation year). Middle Name, GWA, Latin honors, LinkedIn URL, and GitHub URL are optional.

### Architecture

**AD-2 Local model boundary:** replace the generic/optional adapter seam with `LocalModelGateway`: loopback-only LM Studio, Qwen3.5-9B, required vault token, no tools/MCP/CORS/LAN/cloud fallback/retry. Every Coach reply is a deliberate request after an exact local-data consent panel.

**AD-4/AD-8:** add `candidate_profile_revisions`, `resume_template_sources`, `material_drafts`, `material_versions`, and `material_claim_support`. Each draft/version records profile revision, selected evidence revisions, optional captured-opportunity revision, and template digest. The model returns bounded structured content only; it cannot author PDF/HTML/TeX.

**AD-11:** the native PDF route serves only the designated immutable template. Resume Edit is preview-only when local AI is unavailable; profile values and typed Coach prompts are retained locally.

### Schema and migration

1. Add append-only `candidate_profile_revisions` and a current-profile pointer.
2. Add immutable `resume_template_sources`; validate, digest-pin, and retain `Resume.pdf` privately.
3. Add `material_drafts`, `material_versions`, and claim-support joins; reject missing approved evidence support.
4. Migrate retained Current Base Resume source metadata without deleting it. Mark prior structured drafts/read-only versions historical; do not convert their reconstructed text into a generated material.
5. Add metadata-only audit actions for profile save, template designation, local generation request/outcome, draft selection, review, render, and export.

### Epic and story changes

| Story | Proposed change |
|---|---|
| 1.5 | Keep as reviewed Experience & Projects source material. Clarify only reviewed evidence can be selected for Coach. |
| 1.6 | Supersede. Replace with migration/compatibility behavior; remove manual Current Base Resume editing from UI. |
| 4.1 | Expand into LocalModelGateway readiness and exact per-request profile/opportunity/evidence consent. |
| 4.2 | Generate separate structured Material Drafts from profile revision, reviewed evidence, and optional captured opportunity. |
| 4.3 | Replace LaTeX-specific acceptance with a gated deterministic template-renderer contract; model-authored document code remains forbidden. |
| 4.4 | Keep later review/export gate; move it out of Resume Edit. |
| New Epic 8 | Deliver profile-led Resume Edit and its migration/model prerequisites in order below. |

### Proposed Epic 8: Profile-led Resume Generation

**8.1 — Versioned Candidate Profile and Resume Template Migration**

Persist/validate the required and optional profile fields; designate immutable `Resume.pdf`; migrate legacy Current Base Resume records without loss; add private audit coverage.

**8.2 — Simplified Resume Edit and Preview-only State**

Implement the approved profile form, native template preview/fallback, and clean local-AI-unavailable state. Remove manual editor, warning/provenance/version cards, and developer-facing UI from Resume Edit.

**8.3 — Safe Local Resume Coach**

Implement `LocalModelGateway`, exact selection/consent, accessible Coach transcript/state behavior, and no-retry/no-cloud failure handling.

**8.4 — Structured Material Draft Handoff**

Generate validated, provenance-backed material drafts; show readable proposal content; **Use as draft** routes to the existing/future material-review flow. No export from Resume Edit.

## 5. Implementation Handoff

**Classification:** Major — route first to Product Manager and Solution Architect, then Developer.

- **PM:** amend PRD requirements/data model and replace superseded story scope.
- **Architect:** amend AD-2/4/8/11, specify schema/migration and renderer contract.
- **Developer:** implement Epic 8 sequentially; preserve historical data; add migration, domain, route, UI, accessibility, and regression tests.
- **UX:** already complete; use the revised Resume Edit mock and spines as the UI contract.

### Success criteria

1. Resume Edit has only Profile, Local Resume Coach, and immutable template preview.
2. No local-model request occurs without exact selection and explicit action.
3. Missing/unavailable AI leaves a useful, private preview-only state with no manual-editor fallback.
4. Every generated material draft remains separate, profile/evidence/opportunity/template-provenanced, reviewable, and export-gated.
5. Existing source/evidence history survives migration; no raw content, prompts, responses, tokens, or filesystem details reach logs/UI.
