---
title: 'Match generated resumes to the Oboda v22 visual layout'
type: 'feature'
created: '2026-08-28'
status: 'in-progress'
baseline_commit: '2a998e1853106df121e83616abbfdeb6d1ef4ea3'
review_loop_iteration: 0
context:
  - '{project-root}/scripts/generate-oboda-resume.mjs'
  - '{project-root}/docs/application-native-resume-agent.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The generated TeX PDF currently resembles the older root-template reconstruction rather than the user-approved Oboda v22 resume. It flattens skills, renders project metadata poorly, and prints placeholder text for a missing employment history.

**Approach:** Use Oboda v22 as the generated-resume visual contract: a compact US-Letter, one-page hierarchy with a centered header, ruled all-caps sections, aligned title/detail/date rows, concise bullets, and labelled skill rows. Preserve the root `Resume.pdf` file and the existing TeX-only on-demand compilation pipeline.

## Boundaries & Constraints

**Always:** Keep the section order Experience, Education, Projects, Technical Skills; use only saved semantic draft content; preserve TeX escaping and the fixed local Tectonic compiler; make no stored-PDF, database, folder, model, or audit changes; retain a safe bounded fallback template with the same visual contract.

**Ask First:** Replacing or deleting root `Resume.pdf`, altering the approved Oboda source resume content, changing page count policy, or adding fonts/dependencies outside the fixed compiler bundle.

**Never:** Substitute Oboda content for the candidate’s content, re-run generation merely for a visit, copy source paths/configuration into the output, or alter unrelated dirty work.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Structured project | `Name | concise descriptor` followed by `-` bullets | Bold name and italic descriptor share the title row; bullets align under the v22 gutter | Escape all text before TeX insertion |
| Empty employment history | No employment entries | Do not print the placeholder sentence or an empty visual Experience block | Education becomes the first rendered section |
| Education and skills | Profile education and labelled multiline skills | School/program/date/honours and one labelled row per skill group retain their line structure | Use concise fallback copy only when the field is absent |
| Long content | Valid entries exceed a page | Preserve readable layout rather than clipping or overlapping | Existing compiler returns its safe unavailable outcome if TeX cannot compile |

</frozen-after-approval>

## Code Map

- `resume-template.tex` — checked-in TeX visual contract filled at generation time.
- `src/domain/resume-generation/resume-tex.ts` — semantic-draft projection, TeX escaping, and template token replacement.
- `src/domain/resume-generation/resume-pdf.ts` — shared entry parsing used by the TeX projection.
- `scripts/generate-oboda-resume.mjs` — approved v22 dimensions, type roles, spacing, and entry geometry reference.
- `tests/resume-template-tex.test.ts` — projection and template regression coverage.

## Tasks & Acceptance

**Execution:**

- [x] `resume-template.tex` — replace the A4 root reconstruction with the Oboda v22 US-Letter geometry, type roles, spacing, rules, bullet gutter, and aligned entry rows.
- [x] `src/domain/resume-generation/resume-tex.ts` — project semantic entries into Oboda title/detail/date, education, and skills rows; omit an empty Experience block; keep all dynamic text escaped.
- [x] `src/domain/resume-generation/resume-pdf.ts` — preserve explicit bullet and metadata boundaries so TeX does not make the first project bullet an italic metadata line.
- [x] `tests/resume-template-tex.test.ts` — assert Oboda geometry and semantic row treatment, including project-only and multiline-skills cases.
- [x] `tmp/pdfs/format-review/` — render the current draft after the change and visually compare it with v22; retain only review images, never a generated PDF payload.

**Acceptance Criteria:**

- Given a valid generated draft, when its PDF is compiled, then its page size, margins, section rules, hierarchy, and entry rhythm match Oboda v22 rather than the former A4 reconstruction.
- Given a project-only candidate, when no Experience entries exist, then the PDF begins with Education and contains no “No experience entries were documented” text.
- Given labelled skills on separate model lines, when rendered, then each label/value pair appears on its own Oboda-style row.
- Given a title containing `|`, when rendered, then the title is bold and its descriptor is italic on the same row without exposing Markdown or source formatting.

## Design Notes

Oboda v22’s source layout supplies concrete geometry: 612×792 points, content from x=54 to x=568, section labels at 12pt with a rule four points below, body titles near 10.5pt, italic detail/date rows near 9.7pt, and bullets from x=70 to x=82 with 11.6pt leading. The TeX contract approximates these metrics using fixed Letter-paper dimensions and point values; it does not import, embed, or modify the Oboda PDF.

## Verification

**Commands:**

- `npm run typecheck` — expected: no TypeScript errors.
- `npm run lint` — expected: no lint errors.
- `npm test -- --runInBand` — expected: all regression tests pass.

**Manual checks:**

- Render the active draft and Oboda v22 to PNGs; expected: no clipped/overlapping text and the same visual hierarchy, compactness, and aligned rows.
