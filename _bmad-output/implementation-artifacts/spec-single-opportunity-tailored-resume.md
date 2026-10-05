---
title: 'One tailored resume per opportunity'
type: 'feature'
created: '2026-10-04'
status: 'done'
baseline_commit: 'fbebb9cb1cd12f216acf9fca6c5ef36c439c4355'
route: 'dispatch'
context: ['{project-root}/AGENTS.md']
---
<frozen-after-approval>
## Intent
Use the single existing base resume automatically to generate one evidence-grounded tailored resume owned by each opportunity. Regenerate replaces that result; no saved alternate versions. Opportunity edits advise regeneration; opportunity deletion removes the attached resume. The user approved these rules and implementation on 2026-10-04.

## Boundaries & Constraints
Keep the base resume unchanged and no resume chooser. Job Analyst, Resume Writer and Integrity Reviewer run sequentially through the existing loopback local gateway, with validated structured outputs and no tools or external retrieval. Tailoring emphasizes existing verified work bullets; preserve identity, education, dates and other baseline metadata. User review precedes download. No fit assessment, cloud fallback or automatic retry. Use reusable themed components. One row per opportunity stores current content/TeX/PDF; failed generation preserves the previous result. No saved output history or filesystem accumulation.

## I/O & Edge-Case Matrix
| Scenario | Input | Behavior | Failure |
|---|---|---|---|
| Generate | Saved job + ready base + explicit consent | Curate relevant verified bullets; compile and store one separate result | Invalid/model/compiler output saves nothing |
| Regenerate | Existing result | Atomically replace after all validation/compilation | Preserve previous result |
| Edit job | Existing tailored result | Persistent regeneration recommendation | No automatic AI |
| Edit tailored draft | Revised structured work sections | Validate preserved metadata and traceable bullets, compile, replace current result | Unsupported edits rejected, old result retained |
| Inputs change | Job/base/model or output changes during request | Reject stale write | Discard transient output |
| Missing base | No ready base | Actionable link to Resume | No inference |
| Delete | Confirmed hard deletion | Remove job + attached result | Never recreate from late generation |
</frozen-after-approval>
## Code Map
- `src/domain/resume-generation/material-draft-commands.ts` and `src/persistence/material-draft-repository.ts`: validated base read and current workspace base selection; do not attach tailoring to workspace base pointer.
- `src/adapters/local-model/local-model-gateway.ts`: stateless native loopback request, response bounds and decoding; reuse transport.
- `src/domain/resume-generation/resume-tex.ts`, `resume-tex-compiler.ts`: deterministic structured renderer and PDF compiler.
- `src/persistence/migrations/0047_opportunity_lifecycle.sql`: unique opportunity-owned output.
## Tasks & Acceptance
- [x] `src/adapters/local-model/job-tailoring-agents.ts`, `src/domain/opportunities/tailoring-contract.ts`: bounded stage instructions, output validation, evidence mapping, safe work-section curation.
- [x] `src/adapters/local-model/local-model-gateway.ts`: expose one validated tailoring stage call over existing transport.
- [x] `src/domain/opportunities/tailored-resume.ts`: ready base selection, input fingerprint, staged generation/compile, CAS replacement, reads and validated user edits.
- [x] `src/app/opportunities/actions.ts`, `src/components/jobs/opportunity-tailored-resume.tsx`, `src/app/opportunities/[opportunityId]/page.tsx`: consent, generate/regenerate, review/edit, safe feedback and export.
- [x] `src/app/api/opportunities/[opportunityId]/resume/route.ts`: same-origin no-store PDF serving only current attached output, with explicit review acknowledgment.
- [x] Tests: isolated persistence/replacement/deletion/races, stage validation, no cloud request, renderer preservation and component interactions.
Given a result exists, when regeneration fails, then it remains downloadable and unchanged. Given repeated successful regeneration, then only one output row remains. Given job edits, then regeneration advice survives reload. Given deletion, then both job and attached output are absent. Given the base resume, then its content and workspace ownership never change.
## Implementation Notes
Primary implementation directly here per user team constraint; one high-reasoning reviewer later. Structuring the writer as verified bullet selection/reordering intentionally prevents inventing claims while providing relevant emphasis; preserve baseline metadata and evidence links.
## Verification
`npm run typecheck`, `npm test`, `npm run build`; isolated local Chromium interaction/layout checks. Test local-model and compiler injection without sending production data.
## Review Triage Log

## Completion Evidence

- 2026-10-05: `npm test`: 314 passed; typecheck, scoped ESLint and production build passed. Build reports the three pre-existing dynamic-filesystem tracing warnings.
- Isolated SQLite tests cover physical deletion, base/unrelated-job preservation, legacy job draft/PDF cleanup, rollback/guard restoration, stale writes, failed replacement, one-result storage, review-gated export and loopback-only stage transport.
- Chromium fixture covers responsive cards and tailoring content at 1280/900/640/320px. This is a static layout check; hydrated form pending/focus behavior has not been exercised end to end.
- Local model and compiler behavior were injected for deterministic lifecycle tests. No live LM Studio generation was run; actual output quality remains a manual check with the configured local model.
- One existing GPT-6 Luna high reviewer used per user preference. One verified ordering finding fixed and rechecked; no other actionable finding reported.
- No local commit: the shared tree includes unrelated pre-existing modifications and a staged deletion. These were preserved.

## Follow-up: task-oriented feedback — 2026-10-05

See spec-opportunity-actions-and-helpful-empty-states.md for the BMAD follow-up. Capture labels now distinguish Review details (no database write) from Add opportunity (explicit save). Applied has a truthful empty state with a useful navigation link; tracking remains unimplemented. README and current PRD/UX addenda document CRUD, ownership, regeneration and deferred fit.
