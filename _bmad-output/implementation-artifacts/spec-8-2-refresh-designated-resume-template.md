---
title: 'Refresh the designated Resume template after a bundled template update'
type: 'bugfix'
created: '2026-08-25'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'b2bb2a3475d68e20e1a6af42ea2324fe347df115'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-8-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/8-2-build-simplified-resume-edit-and-preview-only-state.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** Resume Edit previews the previously bootstrapped private copy of `Resume.pdf` after the bundled visual template is intentionally replaced. The Education helper sentence is explanatory implementation copy that Adrian does not want in the compact form.

**Approach:** Treat the fixed bundled `Resume.pdf` bytes as the authoritative template release. When their verified digest differs, stage and designate a new immutable private source while preserving prior sources; simplify the Profile form by removing the helper sentence.

## Boundaries & Constraints

**Always:** Read only the fixed repository `Resume.pdf`; validate its PDF bytes, byte size, and digest before selection. Reuse an already verified source with the same digest, or create one new immutable bundled source and advance the singleton designation with its existing compare-and-swap transaction. Preserve older template rows and private copies as history. Keep `/api/resume-template/pdf` identifier-free, same-origin, private/no-store, and fail closed without legacy fallback. Remove the education helper from the rendered form and its obsolete UI assertion.

**Ask First:** Stop if the change would require a migration, an external template-management UI, deletion of old private template copies, or a change to how candidate profile data is saved.

**Never:** Accept a caller-supplied path, template ID, URL, or template bytes; overwrite an immutable stored source; silently serve Current Base Resume content; expose a digest/path in the UI; add LocalModelGateway, generation, rendering, or export behavior.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
| --- | --- | --- | --- |
| Updated bundled template | Root `Resume.pdf` validates and has a new digest | A new verified private snapshot is recorded and designated; preview route serves its bytes | Old sources remain unchanged |
| Unchanged or reverted template | Root digest already has a verified private source | Re-designate that exact immutable source without creating a duplicate | No unnecessary source or audit entry when already selected |
| Invalid, missing, or corrupt source | Root bytes are invalid/missing, or matching private bytes fail integrity verification | Preview is unavailable and the prior state remains untouched | Safe 404 only; no legacy fallback or diagnostics |
| Concurrent refresh | Two requests observe the same new root snapshot | They converge on one verified source and designation | Clean only the losing unreferenced staging/output; no partial state |

</frozen-after-approval>

## Code Map

- `src/domain/resume-generation/resume-template-commands.ts` - fixed-source bootstrap, immutable designation, and safe failure boundary.
- `src/persistence/resume-template-repository.ts` - immutable source lookup by bundled digest and designation persistence.
- `src/files/resume-template.ts` - staging, byte verification, containment, and safe cleanup primitives.
- `src/app/api/resume-template/pdf/route.ts` - fixed, private preview route that consumes the domain boundary.
- `src/app/resume-profile-form.tsx` - compact active Profile form copy.
- `tests/resume-profile-template.test.ts` - bootstrap, integrity, concurrency, and route regression coverage.
- `tests/resume-profile-ui.test.ts` - active Resume Edit content regression coverage.
- `_bmad-output/implementation-artifacts/8-2-build-simplified-resume-edit-and-preview-only-state.md` - Story 8.2 acceptance record to align with the approved copy correction.

## Tasks & Acceptance

**Execution:**
- [x] `src/files/resume-template.ts` and `src/domain/resume-generation/resume-template-commands.ts` - fingerprint the fixed bundled PDF before selecting a source, stage that exact validated snapshot when no verified digest match exists, and preserve the designated pointer on every failure.
- [x] `src/persistence/resume-template-repository.ts` - add only the digest-scoped bundled-source query needed to select a historical immutable source; retain current insert-only and designation guards.
- [x] `src/app/resume-profile-form.tsx` and `tests/resume-profile-ui.test.ts` - remove the education helper sentence and its obsolete expectation without changing labels, validation, fields, or save behavior.
- [x] `tests/resume-profile-template.test.ts` - cover changed, unchanged, reverted, corrupt, invalid, and concurrent bundled-template states, including the bytes returned by the fixed preview route.
- [x] `_bmad-output/implementation-artifacts/8-2-build-simplified-resume-edit-and-preview-only-state.md` - record the approved removal of the education helper in the acceptance language and change log.

**Acceptance Criteria:**
- Given the bundled `Resume.pdf` has changed since the current designated source, when the fixed preview route is opened, then it serves a newly verified and designated immutable snapshot of those current bytes.
- Given the root PDF matches a verified historical source, when bootstrap runs, then it selects that source rather than creating another copy; an already selected source causes no new audit event.
- Given bootstrap cannot validate the current root or a matching private source, when the preview is requested, then it returns the existing non-technical unavailable response and neither changes the designated pointer nor uses legacy content.
- Given the Profile form is rendered, then it omits “School, degree/program, and expected or graduation year.” while all education inputs retain visible labels and their current validation/accessibility behavior.

## Design Notes

The update is a versioned designation, not a cache clear. The root repository file is trusted release input; every served template remains a separately stored, digest-verified private snapshot. A root template revision may be selected again later, but a stored source is never modified or deleted by this repair.

## Verification

**Commands:**
- `node --import tsx --test tests/resume-profile-template.test.ts tests/resume-profile-ui.test.ts` - expected: all template and active-form regressions pass.
- `npx tsc --noEmit` - expected: no TypeScript errors.
- `npm test` - expected: all suites pass.
- `npm run lint` - expected: lint passes.
- `npm run build` - expected: production build passes.
- `git diff --check` - expected: no whitespace errors.

## Suggested Review Order

**Versioned template selection**

- Compare fixed bundled bytes before selecting or designating immutable private snapshots.
  [`resume-template-commands.ts:45`](../../src/domain/resume-generation/resume-template-commands.ts#L45)

- Reuse only an exact verified historical digest; preserve the existing repository guards.
  [`resume-template-repository.ts:15`](../../src/persistence/resume-template-repository.ts#L15)

**Safe staging and concurrent recovery**

- Keep active staging directories intact while deleting only expired abandoned work.
  [`resume-template.ts:103`](../../src/files/resume-template.ts#L103)

**Compact Resume Edit copy**

- Keep field labels while removing the redundant education explanation.
  [`resume-profile-form.tsx:32`](../../src/app/resume-profile-form.tsx#L32)

- Align Story 8.2's acceptance record with the approved copy simplification.
  [`8-2-build-simplified-resume-edit-and-preview-only-state.md:17`](8-2-build-simplified-resume-edit-and-preview-only-state.md#L17)

**Regression coverage**

- Prove refreshes preserve history, fail closed, and converge under concurrent bootstrap.
  [`resume-profile-template.test.ts:165`](../../tests/resume-profile-template.test.ts#L165)

- Prove the active form omits the unnecessary helper without losing labels or accessibility hooks.
  [`resume-profile-ui.test.ts:7`](../../tests/resume-profile-ui.test.ts#L7)
