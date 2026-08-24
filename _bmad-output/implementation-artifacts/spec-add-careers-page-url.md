---
title: 'Add a Careers Page URL'
type: 'feature'
created: '2026-08-23'
status: 'done'
baseline_commit: 'NO_VCS'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/2-2-approve-permitted-discovery-sources.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Adrian wants one simple place to paste an employer careers-page URL instead of completing every advanced source-policy field before saving it. The page must remain a deliberate browser handoff, not automatic site retrieval.

**Approach:** Add a small URL-only form in Permitted Sources. A valid URL creates a local company-careers source with the existing manual-browser policy, zero request limits, disabled retrieval, and clear next steps to open the page or edit its source details.

## Boundaries & Constraints

**Always:** Accept only a valid HTTPS URL without embedded credentials; create one local, append-only source revision; keep the source as a disabled manual-browser handoff with zero request budget/rate limit; give accessible success or recovery feedback; keep the existing advanced source form available for editing; audit only the normal source-configuration metadata already used by the app.

**Ask First:** Any network request, automated page scan, title/company lookup, browser automation, retrieval adapter, source enablement, URL opening, credential access, or change to source-policy retention/audit rules.

**Never:** Fetch, visit, test, scrape, parse, or follow the entered URL; infer its employer or content; create a scheduler, retry, proxy, credential store, or background behavior; accept HTTP, malformed URLs, or credential-bearing URLs.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|---------------------------|----------------|
| Save a careers page | Valid HTTPS careers-page URL | One disabled manual company-careers source is saved locally with zero limits and is available in Saved sources | Success explains that no site was opened or scanned. |
| Invalid URL | Empty, HTTP, malformed, or credential-bearing URL | No source revision or audit event is created | Accessible status identifies the input error and tells Adrian to enter an HTTPS careers-page URL. |
| Persistence failure | Local save fails | Existing sources remain unchanged | Accessible status tells Adrian to check local storage and try again. |
</frozen-after-approval>

## Code Map

- `src/app/permitted-sources.tsx` — Permitted Sources UI and existing advanced source editor.
- `src/app/actions.ts` — local Server Actions and safe action-state messages.
- `src/domain/discovery/source-configurations.ts` — source validation, append-only persistence, and audit behavior.
- `tests/source-configurations.test.ts` — persistence, validation, rollback, and no-retrieval coverage.
- `tests/source-configurations-ui.test.ts` — accessible UI and static no-retrieval guardrails.

## Tasks & Acceptance

**Execution:**

- [x] `src/app/permitted-sources.tsx` — add a clearly labelled careers-page URL form that submits independently from the advanced editor, preserves keyboard/accessibility feedback, and explains manual-only behavior.
- [x] `src/app/actions.ts` — add a dedicated action that normalizes the URL into a safe disabled company-careers source using the current date and existing manual-policy text; return a concise success/recovery status and revalidate the page.
- [x] `src/domain/discovery/source-configurations.ts` — expose only the small shared helper or validation surface required by the action, without adding a retrieval API or changing existing source-policy safeguards.
- [x] `tests/source-configurations.test.ts` — prove valid URL creation, manual zero-limit/disabled values, rejection without mutation for unsafe URLs, and safe persistence-failure recovery.
- [x] `tests/source-configurations-ui.test.ts` — prove the labelled URL entry and its manual/no-retrieval explanation; retain no-fetch/no-retrieval controls assertions.

**Acceptance Criteria:**

- Given Permitted Sources, when Adrian enters one valid HTTPS careers-page URL and saves it, then a locally saved, disabled company-careers source is visible with manual-browser access and zero limits, and the UI says it was not opened or scanned.
- Given an empty, HTTP, malformed, or credential-bearing URL, when Adrian saves it, then no source or audit record is added and the form exposes an accessible correction message.
- Given a normal list or save request, when it succeeds or fails, then it performs no external request, URL opening, page parsing, browser automation, scheduling, retry, credential access, proxy use, or automatic retrieval.

## Spec Change Log

## Design Notes

The existing source configuration model already stores a user-added `company-careers` record through immutable revisions. The shortcut only supplies conservative manual defaults; it does not weaken the advanced policy editor or make policy approval appear granted.

## Verification

**Commands:**

- `npm test` — expected: all source configuration and existing tests pass.
- `npm run typecheck` — expected: no TypeScript errors.
- `npm run lint` — expected: no lint errors.
- `npm run build` — expected: production build succeeds.

## Suggested Review Order

**Local-only URL handoff**

- Creates conservative manual defaults and rejects unsafe URL variants before persistence.
  [`source-configurations.ts:52`](../../src/domain/discovery/source-configurations.ts#L52)

- Saves the validated shortcut through the existing local configuration command only.
  [`actions.ts:72`](../../src/app/actions.ts#L72)

**Accessible interaction**

- Provides independent labelled submission, feedback, duplicate prevention, and source disambiguation.
  [`permitted-sources.tsx:15`](../../src/app/permitted-sources.tsx#L15)

**Verification**

- Covers safe defaults, audit shape, and invalid URL non-mutation.
  [`source-configurations.test.ts:67`](../../tests/source-configurations.test.ts#L67)

- Guards the action wiring and absence of retrieval controls.
  [`source-configurations-ui.test.ts:5`](../../tests/source-configurations-ui.test.ts#L5)
