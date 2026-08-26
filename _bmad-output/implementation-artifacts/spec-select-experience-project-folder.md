---
title: 'Select Experience & Project folders without typing paths'
type: 'feature'
created: '2026-08-26'
status: 'done'
baseline_commit: '32bf3f5d912b26f5c4ec799f4ff689014d5d0d8a'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/8-5-refine-experience-and-projects-collection.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Experience & Projects currently asks Adrian to type an absolute source-folder path. Browsers deliberately do not expose that path reliably, and manual entry is error-prone.

**Approach:** Replace the path field with a folder chooser. The client submits only a bounded allowlisted snapshot of the chosen folder and safe relative-path manifest to the existing application-native local-LLM documentation flow.

## Boundaries & Constraints

**Always:** Use a browser folder chooser (`webkitdirectory` with `multiple`) rather than a text path or browser filesystem handle. Show the selected folder name and eligible-file count before consent. Submit only files within the documented skill policy and their slash-form relative paths; validate the file/path pairing, extension, size, aggregate budget, and relative-path safety again on the server. The server treats uploads as untrusted snapshots, never as filesystem paths, never persists their raw bytes, and preserves the existing proposed/unreviewed, provenance, staging, and individual-review boundaries.

**Ask First:** Add a desktop/native picker, cloud source, arbitrary drag-and-drop import, or a fallback that asks for a filesystem path.

**Never:** Render or submit an absolute local path; use `showDirectoryPicker()` handles as server authority; upload excluded/generated/binary content; relax consent, model, artifact, or approval protections; retain selected files after the action completes.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Select folder | Chromium-family browser, folder with eligible files | Displays its root name and eligible bounded file count; enables consented documentation | N/A |
| Excluded/oversized content | Folder contains dependencies, binaries, generated files, or over-budget files | Client excludes them; server independently validates remaining snapshot | Safe error if no eligible safe files or bounds fail |
| Unsupported picker | Browser does not support folder-directory selection | Explains the feature requires a supported local browser | No typed-path fallback |
| Tampered manifest | Posted files/relative paths are mismatched or unsafe | Server rejects before local-model invocation or persistence | Concise safe recovery action |

</frozen-after-approval>

## Code Map

- `src/app/evidence-library.tsx` — collection disclosure, folder chooser, selected-file manifest, and accessible status.
- `src/app/actions.ts` — untrusted FormData boundary for source snapshots.
- `src/files/evidence-library.ts` — shared allowlist/budget snapshot validation for uploaded files.
- `src/domain/evidence/evidence-library.ts` — native documentation entry point accepting a validated snapshot rather than a server filesystem path.
- `tests/evidence-library.test.ts` and `tests/evidence-library-ui.test.ts` — source-snapshot and UI-contract coverage.

## Tasks & Acceptance

**Execution:**
- [x] `src/app/evidence-library.tsx` — replace the absolute-path input with an accessible folder chooser and submit only the selected eligible files plus relative manifest.
- [x] `src/app/actions.ts` and `src/domain/evidence/evidence-library.ts` — route file snapshots into documentation without accepting a source path from this flow.
- [x] `src/files/evidence-library.ts` — validate uploaded snapshot pairs with the registered skill policy and derive deterministic source provenance.
- [x] `tests/evidence-library.test.ts` and `tests/evidence-library-ui.test.ts` — cover chooser-only behavior, safe manifest rejection, bounded exclusions, and no typed-path fallback.

**Acceptance Criteria:**
- Given Projects or Experiences documentation is open, when Adrian chooses a folder, then the interface never asks for or displays an absolute path and announces the selected folder and eligible-file count.
- Given the action is submitted, when the local-LLM documentation skill runs, then it receives only the validated selected-file snapshot with safe relative provenance and retains no raw source bytes.
- Given a browser lacks directory selection or a snapshot is unsafe, when Adrian attempts documentation, then no model call or persistence occurs and the UI gives a concise recovery action without falling back to manual path entry.

## Verification

**Commands:**
- `node --import tsx --test tests/evidence-library.test.ts tests/evidence-library-ui.test.ts` — expected: folder-snapshot and UI contracts pass.
- `npm run typecheck` — expected: no TypeScript errors.
- `npm test` — expected: full suite passes.

## Suggested Review Order

**Browser handoff**

- Folder chooser builds a bounded, root-bound manifest without exposing a filesystem path.
  [`evidence-library.tsx:21`](../../src/app/evidence-library.tsx#L21)

- Submission reconstructs FormData from only eligible selected files and clears selection after completion.
  [`evidence-library.tsx:28`](../../src/app/evidence-library.tsx#L28)

**Server trust boundary**

- The action accepts uploaded files and treats their manifest as untrusted input.
  [`actions.ts:372`](../../src/app/actions.ts#L372)

- Snapshot validation enforces root, path, text, size, and policy limits before model invocation.
  [`evidence-library.ts:104`](../../src/files/evidence-library.ts#L104)

- Documentation uses the validated snapshot while retaining the established consent and staged-review boundaries.
  [`evidence-library.ts:57`](../../src/domain/evidence/evidence-library.ts#L57)

**Regression coverage**

- Snapshot tests reject unsafe roots, generated content, binary bytes, and forged manifest data.
  [`evidence-library.test.ts:62`](../../tests/evidence-library.test.ts#L62)

- UI contracts enforce chooser-only interaction and no legacy path fallback.
  [`evidence-library-ui.test.ts:5`](../../tests/evidence-library-ui.test.ts#L5)
