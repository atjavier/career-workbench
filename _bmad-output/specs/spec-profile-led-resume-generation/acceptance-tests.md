# Epic 8 Acceptance and Failure Contract

| Area | Demonstrable acceptance | Failure contract |
| --- | --- | --- |
| Profile save | Valid required values create a new immutable revision and update the singleton with compare-and-swap. | Invalid/missing required values create no revision, show linked field errors and error summary, and prevent Coach submission. |
| Legacy migration | `0021` upgrades a populated workspace, preserves every legacy source/draft/proposal/version/file, and creates only legacy template candidates. | Any migration failure rolls back its database work; reconstructed legacy text is never converted or designated. |
| Template bootstrap | A verified bundled `Resume.pdf` is copied, hash-pinned, designated, and served by the native preview route. | Copy/hash/crash recovery cleans staging; unavailable or mismatched bytes yield an accessible unavailable/fallback state and never auto-select another file. |
| Preview-only UI | Resume Edit shows only profile, Coach state, and template preview/fallback; unavailable AI still permits profile save and template reading. | No manual editor, evidence/skills card, warning repair, version approval, export, or technical diagnostics appears as a fallback. |
| Consent | The panel names saved profile fields, selected reviewed materials, optional opportunity, LM Studio on this device, and configured model; the fingerprint includes request text. | Any changed input invalidates consent and blocks submission until reconfirmed. |
| Coach request | One explicit submit uses native-v1 loopback with vault token, exact validated model, `store: false`, and no integrations/retry/fallback. | Missing settings/token/readiness, timeout, invalid endpoint/model, response ID, or network error stores no partial draft; prompt/profile selection remains for a user-initiated retry or Settings recovery. |
| Draft response | Full readable content is available before **Use as draft**; each claim resolves to selected approved evidence and stores immutable snapshot joins. | Invalid JSON, selection echo mismatch, bounds/control-character failure, missing evidence support, or invalid claim reference rejects the whole response and writes metadata-only failure audit. |
| Handoff | **Use as draft** creates one immutable handoff, announces the template is unchanged, and offers Review draft. | Repeated handoff is rejected without creating another record; no Material Version, renderer, or export is triggered. |
| Accessibility | Profile errors, Coach busy/completion/failure, availability, proposal controls, and PDF fallback are keyboard-visible and announced; narrow/400% layout has no required horizontal scrolling. | Focus stays predictable, duplicate generation is blocked with an announced reason, and failure preserves typed request plus saved local state. |

## Required regression coverage

- Migration and repository tests for immutability, UUIDv7, digests, foreign-key/trigger rules, CAS selection, legacy preservation, and staged-template recovery.
- Gateway unit tests using a fake fetcher for request body/header allowlist, `store: false`, token isolation, bounded input/output, response-ID rejection, no retry, and all invalid response branches.
- Domain tests for consent invalidation, eligible reviewed-evidence selection, claim-support persistence, atomic draft creation, and duplicate handoff rejection.
- Route/UI tests for template byte verification, unavailable AI preview-only state, removed manual-editor actions, accessible profile validation, consent disclosure, full proposal before handoff, and focus/status behavior.
