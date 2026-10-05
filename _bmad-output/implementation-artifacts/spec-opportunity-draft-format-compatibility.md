---
title: Opportunity draft model format compatibility
created: 2026-10-05
type: bugfix
status: done
route: oneshot
baseline_commit: fbebb9cb1cd12f216acf9fca6c5ef36c439c4355
---
<frozen-after-approval reason="reported unusable-draft bug">
## Intent

Accept the reported Gemma response's fenced JSON, scalar strings and named requirement entries without weakening source-only extraction. Recover missing supporting excerpts only by matching original pasted text and existing explicit field/requirements context. Missing/null/unsupported suggestions stay blank; no draft persistence before Add. Reject malformed JSON, extra root keys and unexpected structures. Do not infer facts from model labels or reconstruct source from this log.
</frozen-after-approval>
## Implementation Notes

Reuse bounded local-model transport and domain validator; allow one complete JSON fence, without arbitrary JSON repair or prose extraction. Treat formatting compatibility separately from factual acceptance. Preserve exact source spelling when model capitalization differs. Test named/null requirement entries, unsupported/fabricated fields, wrong sections, malformed output and existing review/save behavior. Update source-only implementation artifact and README, run one existing high reviewer. Retain pre-existing dirty tree; no unrelated commit.

## Verification and review

324-test full suite passed; nine relevant source-only draft tests passed again after precomputing requirements context. Typecheck, scoped lint and production build passed. Existing filesystem-tracing warnings remain. The regression uses the reported Gemma response's fenced/scalar/named/null format against representative explicit source; the original posting was not supplied, so this is not a live quality claim. Complete JSON fences are accepted; malformed JSON and extra structures remain rejected. Unsupported values and misleading benefits stay blank. One existing different-model high reviewer confirmed no unresolved finding. No UI/save behavior changed; prior hydrated desktop/narrow and isolated-save evidence remains applicable. No unrelated changes staged or committed.
