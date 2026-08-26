---
id: SPEC-experience-project-evidence-agent
companions:
  - documentation-contract.md
  - agent-skill-contract.md
  - ../../planning-artifacts/ux-designs/ux-Resume-2026-08-06/DESIGN.md
  - ../../planning-artifacts/ux-designs/ux-Resume-2026-08-06/EXPERIENCE.md
sources: []
---

> **Canonical contract.** This SPEC and its companions are the complete contract for the Experience & Projects source-folder documentation flow.

# Experience & Projects source-folder evidence agent

## Why

Projects and experiences are real working folders, not pre-authored Markdown folders. Adrian needs an explicit, conservative way to turn selected local source material into reviewable resume evidence without treating source code, `Resume.pdf`, or an AI summary as automatically eligible claims.

## Capabilities

- **CAP-1**
  - **intent:** Adrian can choose an actual local Project or Experience folder for resume documentation.
  - **success:** The active flow accepts a real source folder and never treats raw folder files as direct resume evidence.
- **CAP-2**
  - **intent:** A dedicated local resume-evidence documentation skill can derive bounded, traceable, review-only Markdown artifacts from the selected folder.
  - **success:** It produces the defined three artifacts with source-relative provenance and explicit unknowns, and no artifact can support a claim until Adrian explicitly imports and individually approves evidence.
- **CAP-3**
  - **intent:** Adrian can review Projects and Experiences separately using summaries derived only from the documentation artifacts.
  - **success:** The collection exposes no raw local paths, IDs, digests, prompts, model diagnostics, Base Resume records, or `Resume.pdf` extraction control.
- **CAP-4**
  - **intent:** The configured local LLM can execute an application-native resume-evidence skill over a user-selected Project or Experience folder.
  - **success:** The skill produces the three bounded review artifacts through declared application tools, with no Codex handoff, undeclared file access, or unapproved claim.
- **CAP-5**
  - **intent:** The agent can be extended with strictly scoped supporting skills without weakening the source, privacy, or review boundary.
  - **success:** Every registered skill declares typed inputs/outputs, readable and writable paths, limits, required consent, and prohibited operations; runtime enforcement rejects anything outside that declaration.

## Constraints

- Inspection is explicit, local, bounded, and read-only for the selected source; no network, watcher, background scan, automatic retry, or automatic approval is permitted.
- The application-native agent, not Codex, owns execution. It may use only an allowlisted skill registry and typed local tools; it may not invoke shells, arbitrary tools, network/cloud services, background work, credentials, or unregistered skills.
- The skill must safely inspect allowlisted text, documentation, manifest, configuration, source, and test files while excluding generated, dependency, binary, linked, and unsafe content according to `documentation-contract.md`.
- Every retained fact is atomic and source-relative with heading/line provenance; unsupported metrics, ownership, dates, users, outcomes, deployment status, and skills remain explicit unknowns.
- `Resume.pdf` remains the immutable Resume Edit template only; it is never an Experience or Projects import or extraction source.

## Non-goals

- Uploading, copying, or parsing an arbitrary source folder directly into the evidence library.
- A copyable Codex prompt or external developer-session handoff.
- Generating resume claims, editing the source folder, calling cloud services, or replacing individual evidence review.

## Success signal

From a real local Project or Experience folder, Adrian can consent to the application-native local LLM documentation skill, receive three clearly proposed documentation artifacts, explicitly import supported items, and individually approve evidence before Resume Coach can use it. The original folder and immutable Resume.pdf are unchanged.

## Decision

The documentation skill is an application-native local-LLM skill. Codex is not part of the product runtime and must not appear in the user flow.
