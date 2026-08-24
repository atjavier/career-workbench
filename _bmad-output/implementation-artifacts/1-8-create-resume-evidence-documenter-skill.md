---
title: 'Story 1.8 - Create Resume Evidence Documenter Skill'
type: 'feature'
created: '2026-08-23'
status: 'review'
baseline_commit: NO_VCS
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-22.md'
  - '{project-root}/_bmad-output/implementation-artifacts/1-7-document-project-for-resume.md'
---

# Story 1.8: Create Resume Evidence Documenter Skill

## Story

As Adrian,
I want a reusable Codex skill based on `bmad-document-project`,
so that I can document project folders into the same resume-evidence format outside the application.

## Acceptance Criteria

1. Given a selected project/document folder and an explicit output directory outside it, when `resume-evidence-documenter` is invoked, then it performs evidence-first brownfield inspection and writes exactly these reviewable Markdown artifacts to the output directory:
   - `project-overview.md`
   - `resume-evidence.md`
   - `resume-bullet-candidates.md`
2. Every factual evidence item and bullet candidate is atomic, grounded in inspected project material, and carries source-relative file plus section/line provenance. Missing metrics, ownership, dates, users, deployment status, or other unsupported detail is stated as an explicit unknown; the skill never invents a claim.
3. The selected source folder remains byte-for-byte unchanged. The skill neither writes inside it nor auto-imports into `resume-evidence/`, SQLite, the app, or audit history; it creates no watcher, background task, network call, cloud fallback, or model invocation.
4. Unsafe inputs (a missing/unreadable source or output path, output path within source, traversal/absolute provenance, symlink/reparse point, unsupported/binary/oversized content) stop safely before output is written and provide a clear corrective action.
5. The resulting artifacts describe proposed, unreviewed evidence only. They state that an explicit later import and individual evidence approval are required before any item can support a resume claim.

## Tasks / Subtasks

- [x] 1. Scaffold the workspace-local skill and define its contract (AC: 1, 3-5)
  - [x] Create `.agents/skills/resume-evidence-documenter/` with a concise `SKILL.md`, `customize.toml`, a routed `instructions.md`, a validation `checklist.md`, and reusable Markdown templates.
  - [x] Use the activation/customization conventions of `.agents/skills/bmad-document-project/`, but do not copy its resumable state-file, archive/move, or source-adjacent documentation behavior.
  - [x] Require an explicit selected source folder and output directory; reject output paths equal to or beneath the source folder and never choose an output location implicitly.
- [x] 2. Specify bounded evidence-first inspection and provenance rules (AC: 1, 2, 4)
  - [x] Inspect manifests/configuration, source tree, tests, existing documentation, and relevant implementation files only as needed to support factual project evidence; collect source-relative slash-formatted file and heading/line references.
  - [x] Accept readable Markdown/text/source/config files only under explicit limits; ignore or reject binary, oversized, unsafe, linked/reparse-point, and traversal inputs without following them.
  - [x] Require conservative wording: distinguish verified facts from unknowns, omit unsupported claims, and never claim personal ownership, metrics, production use, users, dates, or outcomes without direct evidence.
- [x] 3. Define the three output artifacts and their review boundary (AC: 1, 2, 5)
  - [x] `project-overview.md`: evidence-backed project purpose, architecture/stack, verified capabilities, limitations, and a source map.
  - [x] `resume-evidence.md`: one atomic factual item per entry with source-relative provenance and explicit unknowns.
  - [x] `resume-bullet-candidates.md`: conservative candidate bullets traceable to evidence entries, each marked proposed/unreviewed and unsuitable for claim use until separately imported and individually approved.
- [x] 4. Add a deterministic safety and output validation harness (AC: 1-5)
  - [x] Add a small fixture project and a scripted or documented repeatable validation that runs the skill with a separate output directory, checks the three expected files and their Markdown/provenance contract, and compares the source tree before/after.
  - [x] Cover invalid output-inside-source, missing/unreadable input, symlink/reparse point, binary/oversized content, unsafe provenance, and unsupported/ambiguous claims; assert no output or source mutation on every rejected case.
  - [x] Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build` to prove the new workspace skill does not regress the local application.

### Review Findings

- [x] [Review][Patch] Enforce inspection bounds before reading source bytes [.agents/skills/resume-evidence-documenter/validation/validate-contract.mjs:17] — `snapshot()` reads and hashes every regular file before the extension, 2 MiB, and 200-file checks run. A large or unsupported source entry can exhaust resources before safe rejection, so count eligible files and inspect `lstat` size/type before `readFile`.
- [x] [Review][Patch] Make the advertised validation exercise the delivered skill contract [.agents/skills/resume-evidence-documenter/validation/validate-fixture.mjs:7] — the compatibility validator imports the contract validator then leaves its own fixture suite unreachable under `if (false)`; the contract validator writes canned artifacts instead of deriving/validating the delivered instruction/template contract. Replace the dormant duplicate harness with a single active fixture test that detects regressions in the skill assets and validates the documented invocation result.
- [x] [Review][Patch] Validate every artifact entry’s provenance and evidence linkage [.agents/skills/resume-evidence-documenter/validation/validate-contract.mjs:42] — current regexes verify only the first overview/evidence item and a literal `E-001`; they do not validate nearest headings, fenced-code exclusion, all evidence/bullet IDs and statuses, required overview sections, or conservative candidate-to-evidence wording. Parse every entry and reject fabricated, unmapped, or incomplete content.
- [x] [Review][Patch] Complete deterministic negative safety coverage [.agents/skills/resume-evidence-documenter/validation/validate-contract.mjs:67] — the harness does not execute a real symlink/junction/reparse preflight case and omits invalid UTF-8 and over-200-file cases required by the instructions. Add these rejection tests and assert unchanged source and output for each.

### Review Findings (Re-review 2026-08-23)

- [x] [Review][Patch] Bound traversal and aggregate source reads [.agents/skills/resume-evidence-documenter/validation/validate-contract.mjs:25] — directory enumeration is unbounded, while `Promise.all` can read and retain 200 files of 2 MiB each. Add directory/depth and aggregate-byte or bounded-concurrency limits that stop before unbounded enumeration or allocation, then cover those limits in the active fixture.
- [x] [Review][Patch] Close source/output path-swap and partial-output windows [.agents/skills/resume-evidence-documenter/validation/validate-contract.mjs:25] — `lstat` validation and later pathname reads/writes allow an entry or output ancestor to be swapped for a link/reparse point; the three independent writes can also leave partial output. Revalidate stable entries immediately before use, recheck output ancestry immediately before each creation, and write atomically/cleanly fail without partial artifacts; add swap-race coverage.
- [x] [Review][Patch] Exercise actual junction/reparse coverage independently [.agents/skills/resume-evidence-documenter/validation/validate-contract.mjs:38] — the test makes a junction only when file-symlink creation fails, so systems that allow symlinks never test a junction or output/source-ancestor reparse path. Create a real junction/reparse fixture independently and assert rejection for source-root, nested-source, output-root, and output-ancestor cases.
- [x] [Review][Patch] Validate every overview claim and Markdown fence form [.agents/skills/resume-evidence-documenter/validation/validate-contract.mjs:29] — only triple-backtick fences are excluded, and arbitrary overview bullets and Source Map rows are not reconciled to inspected source lines. Reject tilde-fenced provenance and parse every factual overview row and Source Map entry through the same provenance checker.
- [x] [Review][Patch] Enforce complete explicit-unknowns and unambiguous entry linkage [.agents/skills/resume-evidence-documenter/validation/validate-contract.mjs:34] — any non-empty unknowns value passes, duplicate IDs/fields are accepted, and two templates omit unsupported skills. Require each mandatory unknown category (or a structured explicit value), reject duplicate evidence/bullet IDs and repeated fields, and align all templates with the canonical provenance/unknowns schema.
- [x] [Review][Patch] Make the fixture validate a documented successful invocation and rejection non-mutation [.agents/skills/resume-evidence-documenter/validation/validate-contract.mjs:32] — the harness writes hard-coded artifact strings instead of exercising generation from the delivered templates/instructions; its rejection helper snapshots only the root directory and does not cover a valid new output directory. Drive the active fixture through the documented workflow/asset contract, test output-directory creation, and compare full source/output snapshots for every rejection.

## Dev Notes

### Non-negotiable boundaries

- This is a reusable Codex skill, not an extension of the browser application and not a replacement for Story 1.7’s optional in-app Document for Resume flow. Do not modify `src/`, migrations, SQLite, audit behavior, or the app UI for this story.
- Place the skill alongside the existing workspace skills at `.agents/skills/resume-evidence-documenter/`. It must be independently invokable and must not require external packages, a network call, an LM Studio model, credentials, or a database.
- The source folder is read-only. The user supplies the output directory explicitly and it must resolve outside the selected source. Never create output in the source tree, `resume-evidence/`, a project-knowledge folder, or another inferred location.
- Do not inherit broad source-writing behavior from `bmad-document-project`. Reuse its evidence-first brownfield reconnaissance, incremental inspect/write/validate discipline, and activation conventions only.

### Evidence and provenance contract

- Follow the proven evidence-documenter boundary: factual text is bounded and source references are selected-folder-relative, slash-formatted, and safe. Reject `..`, absolute paths, backslashes, links/reparse points, and references to files not inspected.
- Preserve heading/line provenance compatible with the evidence library’s `"<heading>, line <n>"` convention. Keep factual entries atomic and out of fenced code blocks.
- Every candidate must include explicit unknowns. Do not infer metrics, ownership, impact, dates, users, production status, or skills not evidenced in the inspected source.
- Generated content is proposed/unreviewed documentation. It must say that a user must explicitly import it and individually approve resulting evidence before it can be claim-eligible.

### Existing patterns to reuse

- `.agents/skills/bmad-document-project/SKILL.md`, `instructions.md`, `customize.toml`, and `checklist.md` provide the skill activation and brownfield-documentation conventions.
- `src/files/evidence-library.ts` establishes strict UTF-8, Markdown bounds, recursive explicit-only traversal, symlink/reparse-point rejection, and non-mutation safety. Reuse the policy as skill instructions; do not couple the skill to application code.
- `src/domain/evidence/evidence-library.ts` establishes heading/line provenance and fenced-code exclusion.
- `src/domain/evidence/evidence-documenter.ts` and `src/adapters/evidence-documenter/lm-studio-documenter.ts` establish the safe factual candidate shape: factual text, safe relative source references, and non-empty explicit unknowns. The new skill must be deterministic/local and must not call the adapter.

### Expected file map

- NEW `.agents/skills/resume-evidence-documenter/SKILL.md` — activation, trigger description, boundaries, and routed workflow.
- NEW `.agents/skills/resume-evidence-documenter/customize.toml` — compatible local customization surface.
- NEW `.agents/skills/resume-evidence-documenter/instructions.md` — explicit source/output preflight, bounded brownfield inspection, artifact production, and validation sequence.
- NEW `.agents/skills/resume-evidence-documenter/checklist.md` — artifact, provenance, non-mutation, and safety completion gates.
- NEW `.agents/skills/resume-evidence-documenter/templates/` — templates for the overview, evidence, and bullet-candidate outputs.
- NEW test fixture/validation artifact under `.agents/skills/resume-evidence-documenter/` or `tests/` — deterministic validation without source mutation.

### Verification

1. Invoke the new skill against a small fixture folder and an explicitly separate output directory.
2. Snapshot/hash the complete source tree before and after. It must remain byte-for-byte identical, with no new source files.
3. Validate all three required Markdown files exist; each factual bullet has valid selected-folder-relative provenance and explicit unknowns, with no unsupported assertions.
4. Exercise safety failures: output nested in source, missing/unreadable paths, links/reparse points, binary/oversized input, and unsafe provenance. Each must leave source and output unchanged.
5. Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`.

### Project Structure Notes

- The repository has no Git history; retain `baseline_commit: NO_VCS`.
- Existing app regression suite uses Node’s built-in test runner through `tsx`; no new dependency is authorized.
- Story 1.7 already implements local-model proposal generation. Keep this story’s standalone skill offline and output-only to avoid duplicating that behavior or weakening its consent/proposal safeguards.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` - Story 1.8]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-22.md` - approved custom-skill scope and delivery order]
- [Source: `_bmad-output/implementation-artifacts/epic-1-context.md` - evidence, provenance, local-only, and non-mutation invariants]
- [Source: `_bmad-output/implementation-artifacts/1-7-document-project-for-resume.md` - proposal trust boundary and completed review learnings]
- [Source: `.agents/skills/bmad-document-project/SKILL.md` and `instructions.md` - activation and brownfield inspection patterns]
- [Source: `src/files/evidence-library.ts` - bounded safe traversal]
- [Source: `src/domain/evidence/evidence-library.ts` - factual extraction and heading/line provenance]
- [Source: `src/domain/evidence/evidence-documenter.ts` - source-reference and unknowns validation]
- [Official OpenAI documentation: Build skills](https://learn.chatgpt.com/docs/build-skills)

## Dev Agent Record

### Completion Notes List

- 2026-08-23: Comprehensive implementation context created from the approved change, Epic 1 evidence contract, Stories 1.5-1.7, local skill patterns, and Codex skill guidance.
- 2026-08-23: Added the standalone, local-only `resume-evidence-documenter` skill, a copy-ready invocation prompt, templates, and a deterministic fixture validator. The workflow requires explicit source/output paths, treats source material as read-only, emits exactly three proposed/unreviewed artifacts, and forbids model, network, app, database, and audit usage.
- 2026-08-23: Hardened the skill and validation contract after review: unsupported content is rejected, snapshots record path/size/digest, output ancestor reparse checks are repeated immediately before writes, and candidate provenance must resolve to an inspected source line with matching direct text.
- 2026-08-23: Resolved all four review patches: metadata checks precede every source read, the active fixture runner validates delivered assets and invocation output, all entries receive provenance/evidence-link validation, and real reparse plus invalid UTF-8 and file-count rejection cases preserve source/output integrity.

### Debug Log

- `node .agents/skills/resume-evidence-documenter/validation/validate-contract.mjs` (pass; uses the checked-in fixture source and deterministic simulated nonregular-entry coverage)
- `node .agents/skills/resume-evidence-documenter/validation/validate-fixture.mjs` (pass; compatibility entrypoint)
- `python C:\Users\Adrian Javier\.codex\skills\.system\skill-creator\scripts\quick_validate.py .agents/skills/resume-evidence-documenter` (pass)
- `npm test` (37 passing), `npm run typecheck` (pass), `npm run lint` (pass), `npm run build` (pass) on 2026-08-23.
- 2026-08-23: `node .agents/skills/resume-evidence-documenter/validation/validate-contract.mjs` (pass); `node .agents/skills/resume-evidence-documenter/validation/validate-fixture.mjs` (pass); `npm test` (37 passing); `npm run typecheck`, `npm run lint`, and `npm run build` (pass).

### File List

- _bmad-output/implementation-artifacts/1-8-create-resume-evidence-documenter-skill.md
- .agents/skills/resume-evidence-documenter/SKILL.md
- .agents/skills/resume-evidence-documenter/customize.toml
- .agents/skills/resume-evidence-documenter/instructions.md
- .agents/skills/resume-evidence-documenter/checklist.md
- .agents/skills/resume-evidence-documenter/templates/project-overview.md
- .agents/skills/resume-evidence-documenter/templates/resume-evidence.md
- .agents/skills/resume-evidence-documenter/templates/resume-bullet-candidates.md
- .agents/skills/resume-evidence-documenter/prompts/invoke-resume-evidence-documenter.md
- .agents/skills/resume-evidence-documenter/validation/fixture/README.md
- .agents/skills/resume-evidence-documenter/validation/fixture/package.json
- .agents/skills/resume-evidence-documenter/validation/fixture/report.js
- .agents/skills/resume-evidence-documenter/validation/validate-fixture.mjs
- .agents/skills/resume-evidence-documenter/validation/validate-contract.mjs

## Change Log

- 2026-08-23: Created implementation-ready Story 1.8 context; status set to ready-for-dev.
- 2026-08-23: Implemented the workspace-local resume evidence documenter skill, copy-ready prompt, templates, and local deterministic safety validation; retained `in-progress` for review handoff.
- 2026-08-23: Closed review-gate safety and provenance gaps; Story remains `in-review` for re-review.
- 2026-08-23: Code review found unresolved validation-contract gaps; returned to development as `in-progress`.
- 2026-08-23: Addressed code review findings — 4 review patches resolved; validated the full safety/provenance contract and returned Story 1.8 to `review`.

## Suggested Review Order

**Skill contract and safety boundary**

- Defines explicit paths, local-only operation, and the three-artifact limit.
  [`SKILL.md:10`](../../.agents/skills/resume-evidence-documenter/SKILL.md#L10)

- Specifies preflight, provenance, and source-integrity gates before writing.
  [`instructions.md:3`](../../.agents/skills/resume-evidence-documenter/instructions.md#L3)

**Deterministic contract validation**

- Validates bounded inspection, path safety, provenance, artifacts, and non-mutation.
  [`validate-contract.mjs:17`](../../.agents/skills/resume-evidence-documenter/validation/validate-contract.mjs#L17)

**User invocation**

- Supplies the explicit source/output request ready to paste into Codex.
  [`invoke-resume-evidence-documenter.md:1`](../../.agents/skills/resume-evidence-documenter/prompts/invoke-resume-evidence-documenter.md#L1)
