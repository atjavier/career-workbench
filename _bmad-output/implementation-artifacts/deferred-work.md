# Deferred Work Ledger

**Last Triage:** 2026-09-20  
**Status:** Cleaned & Reconciled

---

## 1. Active Open Work

### Resilience & Error Recovery
- **source_spec:** `_bmad-output/implementation-artifacts/spec-improve-interview-turn-decisions.md`
  **summary:** Make the opening Coach Resume request retryable after an interrupted or failed opening stream.
  **evidence:** `openingTaskId` is set before the opening request starts and is not reset by the existing retry action; if the initial greeting stream fails or aborts, the current task requires a workspace reload to retry.

### Future Enhancements
- **source_spec:** None (Backlog Candidate)
  **summary:** Build the automatic local base-resume ATS Auditor pipeline with recoverable final revisions.
  **evidence:** Planned post-MVP capability to parse compiled TeX/PDF output with local heuristic checks for ATS readability.

- **source_spec:** `_bmad-output/implementation-artifacts/spec-refine-resume-architect-generation.md`
  **summary:** Preserve profile-derived header and approved profile substitutions when rendering a template-derived resume.
  **evidence:** Verify that custom candidate profile phone/location overrides take precedence when re-rendering drafts against imported templates with existing mock contact information.

- **source_spec:** `_bmad-output/implementation-artifacts/spec-validate-selected-evidence-folder.md`
  **summary:** Expand runtime fallback filtering tests to cover internal-manifest pattern families.
  **evidence:** Add edge-case test fixtures for nested hidden manifests and deep folder trees.

---

## 2. Reconciled & Resolved Items (Archived from Active Ledger)

- **Resolved:** Harden imported TeX baseline parsing, size handling, and recovery selection (`spec-bundled-baseline-and-preview-stabilization.md`).
- **Resolved:** Cover empty immutable template sections (`value.length >= 0` in `material-draft-commands.ts`).
- **Resolved:** Resolve macOS Homebrew `tectonic` symlink detection via `realpath` in `resume-tex-compiler.ts`.
- **Resolved:** Remove LM Studio user-facing API-token input and standardize on tokenless local loopback flow.
- **Resolved:** Implement separate, accessible routes for Resume (`/resume`), Evidence Library (`/evidence`), and Settings (`/settings`).
- **Resolved:** Bound recursive Markdown traversal in `enumerateMarkdown()` with size and count guards.
- **Deprecated/Obsolete:** Standalone canvas PDF generator tasks (entirely replaced by Homebrew Tectonic LaTeX compilation).
- **Resolved:** Restore structured work rendering and eliminate duplicate header/contact sections in PDF and TeX exports.

- source_spec: `spec-job-opportunity-reader-agent.md`
  summary: Resume clarification planning must call a bounded persona-based AI planner and persist dynamic 2–3 word categories.
  evidence: resume-evidence-interpretation.ts planClarifications still derives fixed categories from keyword patterns; its dynamic prompt is attached but has no model consumer.

- source_spec: `spec-job-opportunity-reader-agent.md`
  summary: Add a forward migration removing old category enums while preserving tasks, responses, clarified evidence, conflicts and interview references.
  evidence: Edits to migrations0031/0037 apply only to fresh workspaces because schema_migrations skips completed migrations; existing DB category checks remain.

- source_spec: `spec-job-opportunity-reader-agent.md`
  summary: Separate local model transport/per-feature adapters and introduce application-service ports for concrete adapter dependencies.
  evidence: Repository-wide import audit found11 domain-to-concrete-adapter import statements; gateway~5540lines/actions~2311 before current cleanup.

- source_spec: `spec-job-opportunity-reader-agent.md`
  summary: Align local production start with standalone output and verify static/runtime asset paths.
  evidence: next.config.ts outputstandalone while run-local.mjs invokes nextstart; isolated production verification prints this mismatch warning.


## Resolved audit follow-ups — 2026-10-05

The four reader-audit follow-ups above are resolved by `spec-codebase-audit-followups.md`: real dynamic persona planning and recovery, forward category upgrade, application orchestration/feature gateways/actions, and consistent standalone startup including desktop writable evidence roots. Original entries are retained as historical evidence. Feature-folder naming and retired CSS cleanup are complete; the dead-service audit confirmed active compatibility/history callers, so those APIs remain intentionally.
