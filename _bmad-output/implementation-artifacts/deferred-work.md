# Deferred Work

## Deferred from: Local AI setup UX (2026-08-26)

- Update Resume Coach unavailable copy to identify the actual missing prerequisite (especially unsaved basic profile information or no approved Experience & Projects material) and refresh automatically after prerequisites are met.
- Restyle the Resume Coach “Set up local AI” control as an underlined text link instead of a dark-green affirmative button.
- Repair the focused Local AI Settings field layout so its outline does not overlap the label.
- Remove the user-facing LM Studio API-token input and revise the local connection configuration to use the agreed tokenless local-only flow.

- source_spec: none
  summary: Implement the approved Resume Experience & Projects design as a separate UI scope.
  evidence: It is independently shippable from the Resume Edit visual implementation.
- source_spec: none
  summary: Implement the approved Settings design as a separate UI scope.
  evidence: It is independently shippable from the Resume Edit visual implementation.

## Deferred from: code review of story-0-5-add-the-career-assistant-workspace (2026-08-24)

- Bound recursive Markdown traversal for arbitrary selected folders: `enumerateMarkdown()` applies Markdown count and per-file byte limits but has no directory/entry/depth/traversal-time budget before walking a pasted directory. This pre-existing evidence-documenter concern should return a safe folder-too-large recovery outcome.
- Do not audit expected stale proposal decisions as documenter failures: `evidenceLibraryAction` currently records every documenter resolution error as `evidence.documenter_failed`, including expected stale/not-found concurrent decisions. This pre-existing domain/action concern needs a distinct conflict outcome or exemption.

- source_spec: `spec-finalize-oboda-resume-achievement-wording.md`
  summary: Harden the standalone resume PDF generator's output handling and declared dependency model.
  evidence: The review found pre-existing CWD-dependent output, silent overwrite/direct-write risk, and an undeclared direct canvas dependency; none were introduced by the wording revision.
- source_spec: `spec-finalize-oboda-resume-achievement-wording.md`
  summary: Improve standalone resume PDF typography, Unicode support, and coordinate measurement.
  evidence: The review found pre-existing ASCII-only font encoding, approximate right alignment/subtitle positioning, an off-center header, and incomplete PDF-string escaping; these require a separate renderer-focused change.

- source_spec: `spec-add-evidence-first-resume-coach-guidance.md`
  summary: Harden Local Resume Coach response validation and claim-to-evidence enforcement.
  evidence: Review found pre-existing acceptance of standard response-envelope IDs, predictive wording, weak/detached claim support, and input-versus-final-body size differences; resolving them requires a separate contract change.
- source_spec: `spec-add-evidence-first-resume-coach-guidance.md`
  summary: Harden Opportunity Assessment response bounds, schema validation, evidence uniqueness, and excerpt grounding.
  evidence: Review found pre-existing unbounded response parsing and incomplete response-contract/evidence validation outside the Resume Coach wording scope.
- source_spec: `spec-add-evidence-first-resume-coach-guidance.md`
  summary: Validate Evidence Documenter proposal content against its cited Markdown, not only its schema and paths.
  evidence: Prompt-instruction resistance was added in this change, but full factual entailment validation requires separate evidence parsing and proposal-contract work.
