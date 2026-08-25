---
title: 'Render the retained Resume PDF faithfully'
type: 'feature'
created: '2026-08-25'
status: 'done'
review_loop_iteration: 0
baseline_commit: '879b687dbd7851baf59657dd837b4c284a2a9be0'
context:
  - '_bmad-output/implementation-artifacts/spec-implement-resume-edit-design.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-Resume-2026-08-06/DESIGN.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-Resume-2026-08-06/EXPERIENCE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Resume Edit currently turns the imported PDF into categorized text and renders that reconstructed draft in its Preview pane. The result cannot preserve the original `resume.pdf` page layout, fonts, columns, or pagination, so it is not a faithful preview.

**Approach:** Render the retained immutable source PDF in the browser's native same-origin PDF viewer. Supply it through a narrow local route that reads only the database-recorded Current Base Resume source, verifies its integrity, and returns safe inline PDF bytes. Keep the structured draft editor and evidence workflow, but state clearly that the right pane is the original read-only PDF and does not reflect unsaved or saved draft text changes.

## Boundaries & Constraints

**Always:** Preserve the original PDF byte-for-byte and keep it private to the loopback workspace. Authorize the route only through a valid source identifier that resolves to the current draft's source; never accept a filesystem path from the browser. Resolve only the persisted relative location, reject absolute/traversal/symlink escapes, verify byte count and SHA-256 digest before response, and return generic safe errors without paths/digests. Serve `application/pdf` inline with private/no-store, nosniff, and same-origin resource headers. Keep import, editing, proposal decisions, provenance, version approval, PDF-only validation, and the empty-preview state working.

**Ask First:** Generating a revised PDF from structured edits, altering the retained source, adding cloud/client-side PDF rendering, exposing the PDF outside the local workspace, or changing the broader Resume Coach/editing model.

**Never:** Do not reconstruct the PDF with text/HTML/pdfjs, publish a public asset URL, leak storage locations/digests/absolute paths, cache the source in a shared response, add client `fetch`/telemetry, or claim that draft edits change the original PDF preview.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Current imported draft | Valid retained source bytes match stored metadata | Preview pane displays the original PDF through a native read-only viewer; the page layout matches `resume.pdf` | Provide an accessible Open original PDF fallback |
| Draft edits exist | Saved or unsaved structured draft differs from source PDF | Editor states that changes are a separate working draft; PDF pane remains the immutable original | Keep existing unsaved-save/approval safeguards; no misleading live-preview state |
| Missing, tampered, or unsafe source | Source ID is unknown, bytes are absent/mismatched, or path validation fails | No PDF bytes or filesystem information leave the server | Return a generic unavailable response and show safe local recovery copy |
| No draft | No Current Base Resume is imported | Existing empty preview/import composition remains | No PDF route is rendered or requested |

</frozen-after-approval>

## Code Map

- `src/files/current-base-resume.ts` — safe retained-source path validation and byte read.
- `src/domain/current-base-resume/current-base-resume-commands.ts` — source lookup and immutable byte/integrity verification.
- `src/app/api/current-base-resume/[sourceId]/pdf/route.ts` — node-runtime local route that returns sanitized inline PDF responses.
- `src/app/resume-workspace.tsx` — passes only the current source identifier into the Resume Edit projection.
- `src/app/current-base-resume.tsx` — replaces reconstructed preview document with a native PDF viewer and truthful draft/source labels.
- `src/app/globals.css` — viewer sizing and narrow-layout behavior within the existing Preview pane.
- `tests/current-base-resume.test.ts` and `tests/resume-evidence-workspace-ui.test.ts` — source safety, integrity, viewer, and truthful-copy regression coverage.

## Tasks & Acceptance

**Execution:**
- [x] `src/files/current-base-resume.ts` and `src/domain/current-base-resume/current-base-resume-commands.ts` — add a server-only, bounded read for the current source PDF that validates storage confinement and immutable metadata.
- [x] `src/app/api/current-base-resume/[sourceId]/pdf/route.ts` — create a dynamic Node route that returns only verified PDF bytes with inline, private/no-store, nosniff, and same-origin headers; normalize every unsafe/unavailable case to a safe response.
- [x] `src/app/resume-workspace.tsx` and `src/app/current-base-resume.tsx` — pass the source ID without exposing source metadata, embed the native viewer and fallback link, and distinguish the original PDF from the editable working draft.
- [x] `src/app/globals.css` — keep the faithful viewer paper-like, legible, constrained within the existing Preview pane, and usable in the existing 820px/440px reflow.
- [x] `tests/current-base-resume.test.ts` and `tests/resume-evidence-workspace-ui.test.ts` — cover byte integrity, unsafe/missing source recovery, response security semantics, native viewer/fallback markup, and no leaked storage implementation details.

**Acceptance Criteria:**
- Given an imported `resume.pdf`, when Resume Edit opens, then its Preview pane renders the original PDF pages and layout rather than reconstructed text.
- Given a source URL request, when it names the current valid source, then the response contains only verified bytes with `application/pdf`, inline, private/no-store, nosniff, and same-origin headers.
- Given a missing, modified, traversal, or symlink-escaping source, when the route is requested, then it returns no file bytes or sensitive metadata and the UI retains a safe recovery state.
- Given a saved or unsaved structured draft edit, when the user views Preview, then the UI accurately identifies the PDF as the unchanged original and retains current explicit save/approval behavior.
- Given no source draft or a narrow viewport, when Resume Edit loads, then import/empty recovery remains intact and the viewer has no hidden essential control or horizontal page layout overflow.

## Spec Change Log

## Design Notes

Native browser PDF rendering is the only implementation that faithfully preserves the stored source without adding a second PDF renderer or making false claims about draft-to-PDF generation. The `<iframe>` title and fallback link must name it as the original, read-only Resume PDF; the source route must never reveal its internal storage location.

## Verification

**Commands:**
- `npm run test` — expected: source/route/UI contracts and all existing tests pass.
- `npm run lint` — expected: no lint errors.
- `npm run typecheck` — expected: no TypeScript errors.
- `npm run build` — expected: production build succeeds with the dynamic PDF route.

**Manual checks (if no CLI):**
- Import a multi-page PDF, compare the rendered pages to the original file, test the fallback link, edit draft text, and verify the PDF remains visibly unchanged at desktop and narrow widths.

## Suggested Review Order

**Faithful preview experience**

- Renders the retained source in the browser's native PDF viewer, never reconstructed draft markup.
  [`current-base-resume.tsx:27`](../../src/app/current-base-resume.tsx#L27)

- Verifies availability before rendering a viewer and gives a truthful local recovery state.
  [`resume-workspace.tsx:18`](../../src/app/resume-workspace.tsx#L18)

- Keeps the embedded document legible and contained as the Resume pane reflows.
  [`globals.css:349`](../../src/app/globals.css#L349)

**Private source boundary**

- Limits disk reads to an exact persisted path, rejecting symlinks and unsafe source metadata.
  [`current-base-resume.ts:25`](../../src/files/current-base-resume.ts#L25)

- Rechecks integrity and current-draft authorization immediately before returning bytes.
  [`current-base-resume-commands.ts:44`](../../src/domain/current-base-resume/current-base-resume-commands.ts#L44)

- Serves only verified bytes with restrictive inline PDF response headers.
  [`route.ts:23`](../../src/app/api/current-base-resume/[sourceId]/pdf/route.ts#L23)

**Regression coverage**

- Exercises valid, malformed, missing, and tampered route responses end-to-end.
  [`current-base-resume.test.ts:85`](../../tests/current-base-resume.test.ts#L85)
