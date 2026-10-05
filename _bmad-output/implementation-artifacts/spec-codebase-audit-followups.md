---
title: Complete remaining codebase audit findings
type: refactor
created: 2026-10-05
status: done
route: dispatch
review_loop_iteration: 0
baseline_commit: fbebb9cb1cd12f216acf9fca6c5ef36c439c4355
context: []
---

<frozen-after-approval reason="User explicitly authorized all remaining audit work">
## Intent
Complete the remaining findings in docs/codebase-structure-review-2026-10-05.md. Clarification categories must come from the selected local AI using the appropriate evidence persona, including existing installed databases. Establish an application orchestration layer, separate feature gateway/action modules, align standalone startup, and resolve naming/dead-code findings through verified callers.

## Boundaries & Constraints
Always preserve user data, existing public behavior and the dirty working tree. Keep primary implementation and one existing different-model high reviewer. Use stateless bounded loopback AI, flexible 2–3 word generated categories, Engineering Manager for experience and Principal/Staff Engineer for projects. Make no model requests while holding write transactions. Failures retain existing tasks and offer retry; no static-category fallback. Preserve answered/skipped tasks, responses, clarified evidence, conflicts and interview history. Keep migrations forward-only and atomic, restoring foreign-key enforcement on success and failure. Preserve component APIs and test actual hydrated flows after action relocations.

Never commit, stage, push, modify the user's live database, add speculative UI, restore fit UI, or invent candidate facts. Existing domain-owned persistence can remain: this change resolves concrete adapter coupling via application services, rather than claiming every domain module is pure.

## I/O & Edge-Case Matrix
| Scenario | State | Expected | Failure handling |
| --- | --- | --- | --- |
| AI planning | Documented project/experience | Persona-specific bounded questions with flexible category strings | Malformed/unavailable fails without replacing tasks |
| No gaps | AI returns tasks: [] | Pending unanswered tasks reconciled away; completed history retained | No fabricated default tasks |
| Concurrent change | Workspace/source/answers change during AI call | Stale plan not committed | Retry against current evidence |
| Installed database | Legacy category CHECK plus dependent rows | Forward upgrade permits flexible strings, preserves all IDs/rows/FKs/indexes/triggers | Transaction rollback restores original schema/data |
| New database | All migrations | Same flexible schema and foreign-key enforcement | Migration error surfaces |
| Production start | Completed build | Loopback standalone serves pages and static/public assets | Missing build reports actionable error |
</frozen-after-approval>

## Code Map
- src/domain/resume-generation/resume-evidence-interpretation.ts: fixed planner and persistence reconciliation; preserve fact parsing and context provenance.
- src/persistence/database.ts and migrations: transactions and compatibility fixture; category tables have dependent response/evidence/turn rows.
- src/adapters/local-model/local-model-gateway.ts: bounded native transport, JSON parser, per-feature requests; keep facade exports for compatibility.
- src/app/actions.ts: existing Server Actions; separate by feature with shared action-state types and helpers, retaining compatibility exports.
- src/domain modules importing adapters: relocate persistence/AI/source workflows into src/application; update all callers and tests, keep pure contracts in domain.
- scripts/run-local.mjs/build-local.mjs: build already copies static/public; production must use generated standalone/server.js.
- components/pro and legacy fit/capture: identify real production callers before removal/renaming.

## Tasks & Acceptance
- [x] Add dynamic planner agent, schema validation and bounded transport; wire selected model before transaction and guard stale inputs.
- [x] Add forward category migration and installed/fresh/rollback preservation tests.
- [x] Relocate adapter-coupled services to application, update callers and add import-boundary regression check.
- [x] Split gateway transport/feature protocols and actions by feature without changing APIs.
- [x] Align standalone start and verify page, static and public paths.
- [x] Resolve verified naming/dead-code findings; update architecture, agent docs, audit and deferred ledger.
- [x] Run focused tests, full suite, typecheck, build, hydrated desktop/narrow flow and high-model review.

Acceptance:
- Given custom missing evidence, when planning runs, then a real local model request supplies categories and questions with the correct persona, rather than fixed heuristics.
- Given model failure or concurrent evidence/workspace change, when a plan finishes, then it cannot replace current tasks/history with stale or fabricated content.
- Given an installed database containing legacy restrictions and dependent records, when migrations run, then records remain intact and flexible categories are accepted.
- Given the new layer boundaries, when scanning production imports, then domain modules have no concrete adapter/application imports.
- Given the existing UI, when creation/edit actions run after relocation, then submitted fields, failures, redirect and deletion behave as before at desktop and narrow widths.
- Given a production build, when npm start runs, then it binds loopback, serves runtime assets and does not emit the standalone/next-start warning.

## Implementation Notes
User's “please do those remaining work” authorizes the documented bundle, superseding earlier deferred dispositions. Existing authorization covers working in this dirty tree and proceeding without another approval checkpoint. Primary implements; existing reviewer reviews. Historical specs remain historical; this artifact records their follow-up changes.

## Spec Change Log

## Review Triage Log

## Verification
npm test; npm run typecheck; npm run build; focused planner/migration/layer/start tests; actual hydrated opportunities flow at1280/320; real local AI persona planning with public fixture; existing high reviewer.


## Implementation evidence

Primary implemented with the existing GPT-6 Luna high reviewer, preserving the user's one-reviewer preference. Twelve service modules moved into application; pure material types remain in domain. Gateway compatibility facade is12lines; feature gateways separate protocols from bounded transport/JSON/consent/composition/validation. Actions facade is11lines; implementation modules own use-server directives (a facade directive caused a build rejection and was removed). Retired capture/confirmation CSS removed and pro folder names replaced with feature names. Legacy services/unmounted reusable components were audited and retained where APIs/tests/history justify them.

Network planning happens before write transactions. Full source/context/known role/dates/history reach the selected model; no static fallback. Reconciliation retains all tasks with interview history/reservations and completed answers. Rechecks source/history/active workspace; failures preserve tasks. Plan-only retry is shared UI for failed intake and saved Evidence Library; planning failures recover without duplicate import, folder failures stay explicit.

0049 rebuilds only tables with legacy category CHECKs, preserving schema columns/indexes/triggers and all dependent rows; FK off is outside the transaction, FK integrity checked before commit and original enforcement restored finally. Forward-only; no live user DB edited.

Standalone startup passes loopback HOSTNAME and writable evidence root. Desktop sets user-data/workspace for packaged apps or original cwd for unpackaged; explicit overrides survive. Generated standalone cwd is an asset root, so evidence uses its own root. Existing directories are not moved or deleted.

## Final review triage

- High / corrected: same-category replan could overwrite reserved question/transcript. Guard all dependent history and test reservation with no candidate reply.
- Medium / corrected: no retry after planner failure, duplicate reimport blocked recovery. Add plan-only service/action and reusable form; distinguish planning/folder failures.
- Medium / corrected: prompt did not explicitly mark supplied role/dates as known. Establish candidate context and non-repeat constraint; packet/prompt test.
- High / corrected: packaged desktop lacked writable root. Add explicit root to ServerManager/main and actual child-process regression.

## Verification evidence

Focused planner/upgrade tests, installed/fresh/rollback dependency preservation, source/history staleness, retry, domain boundary and gateway cycle tests pass. Typecheck, scoped lint and production build pass. Actual production page serves nine linked CSS/JS assets; repository has no public directory. Real Gemma hydrated retry at1280/320 passes failure/pending/known-source/no-reimport/category persistence/visible questions; sequential actual opportunity add/edit/delete at1280/320 passes after relocations. Live checks use isolated /private/tmp data and public fixtures. Full suite final count and final reviewer status appended on completion.


Final verification: **351/351 automated tests pass**, typecheck, scoped lint and production build pass. High reviewer confirms no remaining actionable findings after normalizing relative workspace overrides in both launchers; desktop child-process test covers separate writable workspace and macOS canonical runtime paths. Actual hydrated local-AI retry and opportunity CRUD pass at1280/320; production page and nine runtime CSS/JS assets return200. Temporary production server stopped. No requested follow-up remains deferred. Existing user data/tree, staged Resume.pdf deletion and earlier edits preserved; no staging, commit, push or live user DB mutation.
