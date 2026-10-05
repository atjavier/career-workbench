---
title: Refined opportunity description and standard delete confirmation
created: 2026-10-05
type: feature
status: done
route: dispatch
baseline_commit: fbebb9cb1cd12f216acf9fca6c5ef36c439c4355
---
<frozen-after-approval reason="user requests description-centered generation and established deletion convention">
## Intent

Make generated opportunities center on one editable, clearly organized job description rather than duplicate requirements. Extract role/company alongside it; mechanically format role in readable Title Case (Backend Developer), retaining acronyms. Source-only content remains the boundary: improve headings/layout, not invented qualifications or altered meaning. Preserve original paste separately and save only on Add opportunity. Keep optional metadata blank when unstated. Replace typed DELETE with existing Cancel/Delete dialog convention.

Always reuse form, field, ContentCard, Button and Dialog components. Keep refined text with its immutable opportunity revision, retain raw source for tailoring/integrity, invalidate source changes, preserve manual edits, and cascade physical deletion to saved description and attached tailored resume. Legacy opportunities keep their source description available. AI sections must cite exact source lines and retain source content; unsupported or incomplete organization falls back to formatting original source. Never fetch URL, infer metadata, introduce fit/tracking, or duplicate requirements UI.
</frozen-after-approval>
## Implementation Notes

- New source-grounded formatting module validates AI section headings and exact source lines with full coverage; deterministic fallback organizes source without rewriting facts.
- Extend local generation packet/response to description sections; keep earlier structured fact variants compatible.
- Reuse fields with an explicit refined description field and suppress redundant requirements in new/revised creation/edit/details flows. Retain internal requirements for current tailoring compatibility.
- Store refined text in a forward migration's revision-keyed side table, cascade deletion. Include formatting in revision digest; edits create new revisions and stale tailoring as usual.
- Preserve original source in a collapsible view; reviewed refined text is user editable and distinct from original.
- Dialog Cancel/Delete uses hidden confirmation marker, matching Profile/Evidence existing convention; keep server stale/confirmation guards.
- Verify real hydrated desktop/narrow and isolated save/edit/delete, domain content grounding and legacy compatibility. One existing different-model high reviewer only. No commit of mixed pre-existing changes.

## Review triage and verification

- High/patch: AI headings could reclassify benefits as requirements despite exact excerpts. AI organization now must match host-validated source-section boundaries; mismatches fall back to source-preserving format. Regression passes.
- Medium/patch: editing original source could retain stale formatted text. Canonical line-ending comparison detects unchanged formatting and refreshes it from changed source; explicit edited replacement is preserved. Metadata-only edits retain original source bytes. LF/CRLF regression passes.
- Medium/patch: all-cap ordinary role words were treated as acronyms. Explicit acronym/brand names preserve API, SQL, iOS and .NET; ordinary words use Title Case. Regressions pass.
- Low/patch: valid company/application section headings weren't recognized as boundaries. All allowed headings now resolve canonically; regression passes.
- Low/patch: unchanged legacy source could be stored as a duplicate refined description. Suppressed duplicate legacy row; regression passes.
- Low/patch: iOS became Ios. Known-name map fixes it; same reviewer confirmed no unresolved findings.

Actual evidence: full **333 tests passed**, zero failed/skipped. Six focused refined-description tests passed again after the final LF/CRLF edit comparison fix. Typecheck, scoped lint and production build passed; existing dynamic-filesystem tracing warnings remain.

Hydrated actual form with isolated server-action fixtures passed at 1280/320: formatted description shown, corrections retained during regeneration, source invalidation/stale response protection, manual completion, explicit save and failed-save retention. Actual production Next/SQLite browser at 1280/320 against `/private/tmp/opportunity-draft-live.2xQFAq`: no record during failed generation, manual formatted review visible, Add persisted once with original source, edit persisted, Cancel/delete worked without typed confirmation, and physical deletion cascaded to saved description. New migration preserves existing opportunities; source and reviewed description are separate revision records.

One existing different-model high reviewer; all findings fixed and confirmed. Live LM Studio organization quality not exercised; gateway/model outputs are covered by deterministic transport/domain fixtures. URL reference remains unrequested. No unrelated changes staged/committed. Temporary live app stopped. README and PRD/UX addenda synchronized.
