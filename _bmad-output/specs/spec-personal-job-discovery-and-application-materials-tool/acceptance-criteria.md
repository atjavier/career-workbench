# Acceptance Criteria

| Capability | Acceptance criteria |
| --- | --- |
| CAP-1 | Evidence stores source document/section and review state; user-entered and extracted facts are distinct; unreviewed/rejected evidence cannot support a draft. |
| CAP-2 | Current Base Resume is editable through explicit, reviewed, versioned updates; a Material Version identifies its exact Base Resume version and evidence revisions. |
| CAP-3 | Defaults include fresh-graduate, junior, associate, cadetship, and paid-training roles; Philippines-first ranks remote before hybrid/onsite and favors NCR for hybrid/onsite. |
| CAP-4 | Refresh begins only from a direct action, identifies included sources, and reports running/completed/partial/failed outcomes with timestamps. |
| CAP-5 | Listings show title, company, work style/location when known, source, original URL, and freshness; duplicate grouping preserves records and supports user override; absent facts display as unknown. |
| CAP-6 | A source records type, URL, allowed method, rate policy, permission-review date, retention rule, and enabled state; unknown/disallowed/bypass-dependent sources cannot run. |
| CAP-7 | Fit records the listing, evidence, preferences, ruleset, factor outcomes, confidence/freshness, and calculation time; label definitions are visible and non-predictive. |
| CAP-8 | Fit view separates supported matches, gaps/uncertainty, seniority, work-style/location, freshness, and short source language; Potential and Stretch roles remain saveable. |
| CAP-9 | Before first generation or endpoint/model change, UI identifies LM Studio endpoint, model, and selected data categories; request is explicit, isolated, local-only, and not auto-retried. |
| CAP-10 | Drafts contain no fabricated claims, hidden text, invisible characters, or deceptive ATS tactics; every candidate-facing claim has approved-evidence provenance; detectable unsupported edits warn and block export readiness. |
| CAP-11 | Review summary exposes claims, provenance, and blocking warnings; material edits require renewed acknowledgement; export creates new `.tex`, PDF, content manifest, template digest, and provenance manifest without overwriting prior versions. |
| CAP-12 | One saved listing supports one application record with stage, notes, attached versions, many follow-ups, and ordered interview rounds; app never changes an employer portal. |
| CAP-13 | Connection names account/spreadsheet/worksheet and data categories before consent; OAuth uses a Desktop loopback client and Sheets scope only; edit access is verified; revocation preserves local records and offers reauthorization. |
| CAP-14 | Applications, Materials, Follow-ups, and Interview Rounds use stable UUID/revision/hash identities in Sheets; repeated sync does not duplicate entities; entity-level errors, retry/reconnect, and explicit local-vs-Sheet reconciliation are available. |
| CAP-15 | Outbound link names destination host, says submission occurs outside the workspace, and transmits no candidate data or prefilled application fields. |
| CAP-16 | Data & Storage shows local/remote location and deletion consequences; ordinary deletes are restorable for 30 days, sensitive items can be permanently deleted after confirmation, local backup remains on the protected device and relies on its OS-account/full-disk-encryption boundary, and audit records omit raw content/tokens. |

## Deferred Implementation Decisions

| Decision | Scope boundary |
| --- | --- |
| Initial permitted-source catalog and request budgets | Resolve per source before enabling its adapter; no unreviewed source may run. |
| Structured material renderer | Select and validate a local renderer that produces ATS-readable PDF and editable-source Material Versions without relying on TeXworks. |
| Application-level encryption at rest | Resolve before use on a shared or unencrypted device; until then the OS account is the documented boundary. |
