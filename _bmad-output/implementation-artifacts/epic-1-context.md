# Epic 1 Context: Private career evidence workspace

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Establish the private, local foundation for a trustworthy career record: a user-managed Markdown evidence library, individually reviewed evidence revisions, and an editable, versioned Current Base Resume derived from a locally parsed PDF. This epic protects factual accuracy and provenance before later job-fit, drafting, and export capabilities depend on the data. Existing local storage, audit, recovery, and accessibility safeguards remain in force while the former immutable-LaTeX resume import approach is safely superseded.

## Stories

- Story 1.1: Start a private local workspace
- Story 1.2: Import and preserve the Base Resume
- Story 1.3: Review candidate evidence
- Story 1.4: Control local data, recovery, and audit history
- Story 1.5: Build Resume Evidence Library
- Story 1.6: Parse and Version Current Base Resume
- Story 1.7: Document Project for Resume
- Story 1.8: Create Resume Evidence Documenter Skill

## Requirements & Constraints

- Run only as a private local application on `127.0.0.1`, with SQLite and private OS-user app-data as authoritative storage. There is no public deployment or product sign-in.
- Keep all career data local. No feature may silently scan, watch, modify, upload, or process a folder in the background.
- Treat `resume-evidence/` as the one recursive Markdown-library root. It stores approved, resume-oriented evidence rather than raw source repositories.
- Provide separate explicit Add Project and Add Experience actions. Record evidence origin, source file/section, factual text, review state, and revision. Only approved evidence may support future fit or resume claims.
- Add Project may offer an optional **Document for Resume** branch. It reads only the user-selected folder, leaves that original folder unchanged, proposes standardized resume evidence with source references and explicitly marked unknowns, and requires individual review before evidence enters the library.
- The optional documentation analysis is local-AI only, user-started, and uses the configured loopback LM Studio model. Do not use a cloud fallback, automatic retry, or raw request/response logging.
- Import a text-readable PDF as a retained source version and locally parse it into a structured editable base-resume draft. A scanned, malformed, or unreadable PDF must leave existing state unchanged and return an accessible, actionable recovery message.
- An explicit Update Base Resume action compares the editable draft with approved evidence and presents evidence-backed additions, removals, and rewrites for individual approve, edit, or reject decisions. Acceptance produces a new retained Current Base Resume version; historical source-PDF and base-resume versions are never overwritten.
- The standalone `resume-evidence-documenter` Codex skill must use evidence-first brownfield inspection and produce the approved project overview, resume evidence, and factual bullet-candidate Markdown without modifying the selected source folder.
- Any later Material Version must identify its precise Current Base Resume version and the approved evidence revisions supporting it.
- Preserve existing local lifecycle protections: active data remains until user deletion; ordinary deletion enters 30-day local trash; sensitive permanent deletion requires confirmation; backups stay local within the Windows OS-account/full-disk-encryption boundary. Show dependencies and consequences before destructive actions.
- Append metadata-only audit events for local initialization, imports, evidence review, resume-version updates, and recovery/deletion. Never log documents, prompts, model responses, tokens, or credentials.
- Meet WCAG 2.2 AA intent: semantic labels and statuses, visible focus, keyboard operation, accessible validation/recovery messages, non-color state cues, and responsive reflow.

## Technical Decisions

- Use a local-first modular monolith. State changes follow: explicit UI action -> domain command -> SQLite transaction -> append-only audit event -> optional visible adapter attempt. Adapters are never authoritative.
- Use UUIDv7 entity identifiers, UTC ISO 8601 storage/audit timestamps, immutable content and evidence revisions, and provenance from a claim to evidence revision and source section.
- The prior `resume.tex`/TeXworks Base Resume implementation is superseded for this epic. `Resume.pdf` is source input only; the editable representation is a separately persisted structured Current Base Resume. Do not require TeXworks or introduce it as a resume-rendering dependency.
- Replace the old LaTeX import path with narrow resume-parser and evidence-documenter adapters. Material rendering is a later Epic 4 decision and must support structured, ATS-readable output without relying on TeXworks.
- The local model boundary remains one server-side gateway to LM Studio on loopback. Enforce explicit consent/data disclosure before first use or model changes; restrict the documentation request to permitted extracted content from the selected folder.
- Create the `resume-evidence-documenter` Codex skill by adapting the local `bmad-document-project` workflow. Preserve its evidence-first brownfield inspection and provenance discipline, but generate resume-specific Markdown: project overview, resume evidence, and factual bullet candidates.

## UX & Interaction Patterns

- Rename/reframe Candidate Profile as **Resume & Evidence Library** with explicit Add Project, Add Experience, Refresh Library, Import PDF, and Update Base Resume controls. Do not show a passive scan/watch state.
- Document for Resume shows the selected folder, local-model disclosure, proposed-evidence status, source-folder non-mutation guarantee, individual review controls, and a cancel path that changes nothing.
- PDF import distinguishes parse success from unreadable/scanned-file failure and keeps the editable draft visibly separate from the original source PDF.
- Update Base Resume presents an accessible per-change review set with descriptive evidence provenance and approve/edit/reject controls. Unavailable controls must state the reason and a reachable repair action.
- Evidence-review rows identify source document/section, extracted versus user-entered origin, and review state without relying on color. All actions are keyboard operable and status updates are programmatically announced.

## Cross-Story Dependencies

- Story 1.5 is the foundation gate before Epic 2. It migrates/supersedes the LaTeX-only assumptions in the completed Stories 1.2-1.4 while retaining their private storage, evidence revision, audit, recovery, and accessibility guarantees.
- Story 1.6 uses the approved evidence library to create retained, editable Current Base Resume versions. Story 1.7 can propose additional evidence but may not persist it without review; Story 1.8 provides an outside-the-application workflow that produces the same resume-evidence format.
- Epics 3 and 4 may consume only approved evidence revisions; Epic 4 must retain the exact Current Base Resume version and supporting evidence for each Material Version.
