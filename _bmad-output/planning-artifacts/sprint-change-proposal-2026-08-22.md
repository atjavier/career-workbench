# Sprint Change Proposal - Resume Evidence Library and PDF Base Resume

**Status:** Approved by Adrian on 2026-08-22  
**Scope:** Moderate direct adjustment before Epic 2  
**Handoff:** Developer implements the following ordered Epic 1 stories; architecture and backlog updates below are binding.

## 1. Issue Summary

The completed Epic 1 implementation assumes a read-only LaTeX Base Resume (`resume.tex`). Adrian's actual source of truth is `Resume.pdf`, and he needs an editable, versioned base resume informed by a complete, user-managed library of project and experience evidence. Existing project folders contain resume-oriented Brownfield documentation and should be consolidated as evidence rather than treated as the resume itself.

## 2. Approved Product Model

```text
Optional selected project/document folder
  -> resume-evidence-documenter (local AI, explicit request only)
  -> reviewed resume-evidence/ Markdown library
  -> editable, versioned Current Base Resume derived from Resume.pdf and approved evidence
  -> reviewed job-specific Material Versions
```

- `resume-evidence/` is the single recursive evidence-library root. It contains reviewed Markdown evidence, not raw source repositories.
- The UI offers separate **Add Project** and **Add Experience** actions. Both are explicit, reviewable, and leave original selected folders unchanged.
- **Document for Resume** is optional. It uses the local LM Studio model only after an explicit request, analyzes only the chosen folder, and proposes rather than inserts evidence.
- A custom `resume-evidence-documenter` Codex skill is created by adapting the local `bmad-document-project` skill. It preserves brownfield evidence/provenance discipline but outputs resume-specific Markdown: project overview, resume evidence, and bullet candidates.
- A text-readable PDF is parsed locally into a structured editable base-resume draft. A scanned/unreadable PDF is rejected safely. An explicit update compares the draft with approved library evidence and requires individual review before a new base-resume version is accepted.
- Source PDF versions, base-resume versions, evidence revisions, and Material Versions are retained for provenance. The current base resume is updateable; historical versions are not overwritten.

## 3. Impact Analysis

| Area | Approved change |
| --- | --- |
| Epic 1 | Reopen as in progress and add Story 1.5 as the foundation gate before Epic 2. Stories 1.2-1.4 remain historical completed work, but Story 1.5 migrates/supersedes their LaTeX-only Base Resume assumptions. |
| PRD/SPEC | Supersede immutable `resume.tex` and TeXworks requirements with local PDF parsing, the evidence library, an editable versioned base resume, and rendering technology to be selected for structured materials. |
| Architecture | Replace the LaTeX adapter decision with local PDF parsing, evidence-library ingestion, structured base-resume versions, and an export renderer that does not rely on TeXworks. |
| UX | Candidate Profile becomes Resume & Evidence Library: PDF import/update, Add Project, Add Experience, optional Document for Resume, review queue, and explicit base-resume update. |
| Existing code | The Base Resume import schema/UI and deterministic `.tex` extractor require a safe migration/refactor. Preserve existing audit, private-storage, evidence revision, recovery, and accessibility invariants. |

## 4. Recommended Path

Use direct adjustment: add Story 1.5 before Epic 2, create the custom Codex skill, and refactor the local application foundation. No rollback of completed Epic 1 data-control work is justified. This is moderate effort and medium risk because it changes a completed import/evidence path, but it reduces long-term mismatch and preserves the product's truthfulness and provenance safeguards.

## 5. Approved Delivery Sequence

1. **Story 1.5 - Build Resume Evidence Library:** manual Add Project/Add Experience, reviewed Markdown evidence, one managed library root, and no AI dependency.
2. **Story 1.6 - Parse and Version Current Base Resume:** local text-readable PDF parsing and explicit editable base-resume versioning.
3. **Story 1.7 - Document Project for Resume:** optional, explicit local-AI analysis that proposes evidence but cannot store it without review.
4. **Story 1.8 - Create Resume Evidence Documenter Skill:** reusable Codex skill adapted from `bmad-document-project`, created after the evidence schema is proven.

## 6. Success Criteria

- A user can add approved project and experience evidence through the library without automatic scans or source-folder modification.
- A readable PDF can seed an editable current base resume; all updates are explicit, reviewable, versioned, and local.
- Every tailored claim remains traceable to approved evidence, an exact base-resume version, and relevant job-posting language.
- The optional local-AI documentation path cannot write evidence or modify source folders without user review and approval.
- No remaining implementation story assumes `resume.tex` or TeXworks as the resume source or renderer.
