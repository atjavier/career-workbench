---
title: Job Opportunity Reader agent
created: 2026-10-05
type: feature
status: done
route: dispatch
baseline_commit: fbebb9cb1cd12f216acf9fca6c5ef36c439c4355
---
<frozen-after-approval reason="user requests application reader agent following existing agent conventions">
## Intent

Create a purpose-built Job Opportunity Reader application agent using the comprehensive agent-card convention of existing resume agents. Replace the inline extraction prompt, and recognize explicitly stated advertised role and hiring employer throughout real postings, including the supplied Regal Rexnord position summary and About-company prose. Existing source checks reject correct model answers; a named prompt alone cannot fix that failure.

## Boundaries & Constraints

Always: stateless, host-controlled local model, full pasted description, exact source citations, no inferred missing facts, no tools or runtime memory. Keep original source, reference-only URL, Title Case role, optional unknowns and single Add opportunity formatting/save/redirect. Agent outputs are suggestions; host validates evidence, formatting and persistence. Match existing Identity, Mission, Context, Inputs, Responsibilities, Reasoning Framework, Workflow, Coordination, Tools, Memory, Constraints, Communication Style, Output Format, Validation, Failure Handling and Completion sections. Document which prior narrow extraction decisions are superseded.

Never: external retrieval, guessed employer from website/technology/location, treating every organization mention as employer, title inferred from skills, fit scores, new tracking/resume versions, generic instruction-word bans that reject legitimate Assistant roles, database writes from the agent, pre-save approval UI or automatic saving after failed required-field validation.

## I/O & Edge-Case Matrix

| Scenario | Expected behavior |
| --- | --- |
| Regal position-summary role and About-company heading/prose | Junior Automation Developer / Regal Rexnord, optional unstated fields blank |
| Arch explicit hiring sentence plus numeric corporate footer | Backend Developer / Arch Global Services (Philippines) Inc. preserved |
| Nontechnical or Assistant role explicitly stated in position summary | Exact supported title accepted without requiring a fixed list of job nouns |
| Unrelated technology/vendor/agency mentions, CTA prose, embedded instructions | Cannot establish title or hiring employer |
| Conflicting explicit roles/employers | Required field blank and manual completion; no save |
| Valid response missing required identity | Source-grounded recovery; at most one focused reader retry for unresolved required fields, then manual completion |
| Malformed/offline AI | Preserve existing error/manual recovery; no persistence |
</frozen-after-approval>
## Code Map

- src/adapters/local-model/resume-evidence-analyst-agent.ts: existing full agent-card style to follow, not its resume-specific persona.
- src/adapters/local-model/local-model-gateway.ts: local stateless bounded transport; replace inline opportunity prompt, preserve legacy callable wrapper for tests/compatibility.
- src/domain/opportunities/opportunity-draft-contract.ts: source validation, scalar evidence and requirement checks. Extend relationship evidence, retain exact citation/conflict checks.
- src/domain/opportunities/generate-opportunity-draft.ts: existing orchestration helper; coordinate named reader, validated identity, bounded retry and formatting without writes.
- src/domain/opportunities/create-formatted-opportunity.ts: single persistence boundary, reuse unchanged.
- src/domain/opportunities/refined-description.ts: source-preserving formatter, extend common posting headings without dropping content.
- docs/application-native-resume-agent.md and README.md: explain reader versus tailoring agents.

## Tasks & Acceptance

- [x] Add job-opportunity-reader-agent.ts full agent card and job-opportunity-reader-contract.ts host boundary/limits/validated output contract.
- [x] Wire gateway and orchestrator to named reader; one focused retry only for unresolved required identity; retain compatibility of injected test requests.
- [x] Broaden evidence rules for position summaries and About-employer sections while preserving ambiguity, malformed response and injection guards; remove obsolete label/footer-only acceptance rule.
- [x] Add Regal source fixture and tests for metadata, full source transport, actual create persistence, conflicts, vendor/agency mentions, nontechnical roles and retry ceilings; retain existing Arch tests.
- [x] Update README, agent architecture documentation, PRD and UX artifacts. Verify tests, typecheck, scoped lint/build and local-model smoke cases; one existing different-model high reviewer.

Given the complete Regal posting, when correct reader metadata cites its actual position-summary/company lines, then validation and Add accept Junior Automation Developer / Regal Rexnord. Given only qualification/tool references, when the reader suggests a job title or employer, then it remains blank. Given source conflict or no required evidence after recovery/retry, when Add completes, then no record is created and entered values remain available.

## Design Notes

The reader adopts an employer-side job-posting analyst persona and supplies source-indexed facts for the opportunity library and later tailoring. It does not inherit resume-writing instructions. A stateless application instruction module is the requested deliverable, following existing app agents; no installed Codex SKILL, memory sanctum or customization UI is needed. Use Agent Builder design guidance adapted to this application structure, with BMAD Build verification. Existing explicit user authorization covers implementation in the dirty tree and primary implementation plus one high review; no duplicate approval or commit/staging of unrelated changes.

## Implementation Notes

## Verification

Run meaningful domain/gateway/create tests, full npm test, npm run typecheck, scoped ESLint, production build. Replay exact source packet and use public fixtures only for actual local-model smoke tests; report model availability honestly. UI unchanged, existing desktop/narrow direct-create checks remain applicable; no new speculative UI.

## User-approved scope corrections — 2026-10-05

Supersedes the frozen block's proposed semantic pattern expansion, source-identity heuristic recovery and missing-field manual completion: the named AI reader interprets role/employer context for arbitrary postings. Host contract validates JSON structure, bounded values, literal source evidence and supported date normalization only; no grammar templates, company suffix rules or title vocabulary. At most one focused AI retry for absent role/company. Genuinely missing facts persist with existing Unknown storage convention, without adding metadata fields to the creation form. AI unavailable/malformed keeps source and exposes retry through Add, no manual button/form. Saved details remain editable by deliberate user action. Move resume-agent-contracts prompt text to adapters/local-model/resume-agent-shared-instructions.ts and remove retired capture/subnav/fit UI components. Repository-wide audit completed before implementation; findings documented in docs/codebase-structure-review-2026-10-05.md. Preserve backing services/history and defer unrelated ports/migration refactors explicitly.

## Review correction

High reviewer found schema-empty {} accepted as unknown and saved. Reject empty output objects before recovery or persistence; explicit null fields remain valid unknowns. Added empty-initial no-database/no-retry regression, preserving general schema/evidence validation and no manual form.

## Final implementation evidence — 2026-10-05

Completed under the user-approved scope corrections above. Named full-card reader is in adapters/local-model/job-opportunity-reader-agent.ts, called by requestJobOpportunityReader. Domain reader contract is schema/bounds/citation validation only; all previous semantic role/employer parsers and heuristic identity recovery removed. Source validation/snapshot now opportunity-source.ts; active preparation renamed read-job-opportunity.ts. One focused retry fills only absent identity fields, never overwrites accepted fields or regenerates description. Null identity uses existing Unknown representation on save. Empty-object/malformed/offline initial responses do not save.

Creation form/action/domain have no manual mode, detail fields, dirty-field markers or completion form. Only URL/description + Add/Cancel; pending disables source, failure preserves values, explicit Add saves/redirects. Saved editing remains. Retired capture/horizontal-subnav/fit components and capture-review server actions removed; old backing persistence/domain services retained for actual callers/history. Shared resume personas moved to adapters/local-model/resume-agent-shared-instructions.ts; all seven imports updated. Original source, source-preserving formatting, physical deletion and single-base/single-tailored behavior preserved.

Verification after final reviewer patch: npm test 340/340 pass; typecheck, scoped ESLint, production build pass. Hydrated React creation at1280/320: one submit/save, disabled pending fields, error value retention, direct retry, genuinely missing metadata never opens manual fields. Actual isolated Next/SQLite + local Gemma at1280/320: unconfigured AI saves nothing; configure isolated model then retry Add persists once; exact original textarea bytes retained; formatted description stored; edit and Cancel/Delete checked; no typed DELETE and no manual follow-up. Isolated server stopped after checks. A fixture reset initially violated compare-and-swap; corrected test-only reset to increment revision number; rerun passed.

Actual local google/gemma-4-e4b reader with full supplied Regal source (7,107 characters) returned Junior Automation Developer / Regal Rexnord and blank location; source-preserving format 7,154 characters. A different public nontechnical posting with Microsoft/Copilot and agency notice returned Registered Nurse / Harbor Health and blank location. Work style in Regal remained an explicitly quoted, verbose hybrid phrase; no unsupported optional metadata fabricated. These smoke checks demonstrate these examples, not universal semantic accuracy.

Architecture audit covers repository layers/imports/route and component entry points/Electron/scripts/config/tests/migrations. Findings and dispositions in docs/codebase-structure-review-2026-10-05.md; active behavior in docs/application-ai-agents.md and README; PRD/UX addenda record superseded decisions. No unrelated staging/commit or user database mutation.

## Review Triage Log

| Finding | Verdict | Resolution |
| --- | --- | --- |
| Hardcoded identity interpretation rejects Regal and arbitrary roles | High | Removed active parser; source citation/schema only; actual Gemma Regal/nontechnical checks and domain regressions pass. |
| Manual follow-up still present | High | Removed UI, action and domain modes; actual hydrated desktop/narrow checks confirm no fields open after failure. |
| Shared prompt text in domain | Medium | Moved named shared persona instructions to adapter layer; imports/typecheck/build pass. |
| Retired capture/subnav/fit UI and capture actions | Medium | Removed unreferenced components/actions; retained independent backing services/history, updated tests. |
| Fixed clarification categories and unused dynamic prompt | High, pre-existing follow-up | Recorded for separate evidence-planning + migration change; not claimed fixed. |
| Old migration edits do not upgrade existing workspaces | High, pre-existing follow-up | Recorded forward migration preserving related rows/FKs; not performed against user data. |
| Empty JSON object accepted and saved as Unknown | Medium, patch | Reject {} before recovery/persistence; no-DB and no-retry regression passes. High reviewer confirms resolved, no remaining issue in requested fixes. |
| Monolithic gateway/actions and concrete adapter imports | Medium, refactor recommendation | Documented ports/application-service and per-feature decomposition scope separately. |
