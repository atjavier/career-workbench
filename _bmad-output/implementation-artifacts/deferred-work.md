# Deferred Work

- source_spec: none
  summary: Implement the approved Resume Experience & Projects design as a separate UI scope.
  evidence: It is independently shippable from the Resume Edit visual implementation.
- source_spec: none
  summary: Implement the approved Settings design as a separate UI scope.
  evidence: It is independently shippable from the Resume Edit visual implementation.

## Deferred from: code review of story-0-5-add-the-career-assistant-workspace (2026-08-24)

- Bound recursive Markdown traversal for arbitrary selected folders: `enumerateMarkdown()` applies Markdown count and per-file byte limits but has no directory/entry/depth/traversal-time budget before walking a pasted directory. This pre-existing evidence-documenter concern should return a safe folder-too-large recovery outcome.
- Do not audit expected stale proposal decisions as documenter failures: `evidenceLibraryAction` currently records every documenter resolution error as `evidence.documenter_failed`, including expected stale/not-found concurrent decisions. This pre-existing domain/action concern needs a distinct conflict outcome or exemption.
