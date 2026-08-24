---
title: 'Story 1.8 Re-review: Harden Resume Evidence Documenter Validation'
type: 'bugfix'
created: '2026-08-23'
status: 'done'
baseline_commit: NO_VCS
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/1-8-create-resume-evidence-documenter-skill.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The Story 1.8 re-review found six remaining gaps in the standalone skill's validation contract: bounded traversal, link/path-swap safety, complete reparse coverage, all-claim provenance, canonical unknowns/linkage, and fixture-driven non-mutation proof. The current harness passes while leaving those regressions possible.

**Approach:** Harden the reusable skill assets and their active validation harness so it enforces the documented local-only, evidence-first contract under normal and adversarial fixture cases. Record only findings demonstrably resolved after the specified validation and project checks pass.

## Boundaries & Constraints

**Always:** Keep all changes within `.agents/skills/resume-evidence-documenter/` plus the Story 1.8 review record. Preserve explicit source/output selection, offline operation, exactly three proposed/unreviewed Markdown artifacts, safe slash-form provenance, no unsupported claims, and byte-for-byte source non-mutation. Bound directories/depth/entries, aggregate reads, and allocation before processing; revalidate paths before use; reject reparse points; and leave no partial output on failure.

**Ask First:** Any modification outside the skill assets and Story 1.8 review record, any new dependency, or a change to accepted validation policy.

**Never:** Modify application source, the selected fixture under `validation/fixture/`, project behavior, databases, networks, models, or cloud services. Do not check off a re-review finding unless its active test coverage and the listed checks genuinely demonstrate resolution.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Successful documented invocation | Safe fixture source and absent explicit output directory | Creates exactly the three contract-compliant artifacts from delivered workflow assets; source snapshot is identical | N/A |
| Bound exhaustion | Excessive depth/directories/entries or aggregate eligible bytes | Stops before unbounded enumeration or retained reads | No output and source/output snapshots are unchanged |
| Link or swap | Source/output root, ancestor, or entry is a link/reparse point, including a path swap | Rejects immediately before use or creation | No source mutation and no partial artifacts |
| Invalid contract content | Tilde/backtick fenced provenance, unmapped overview/source-map claim, duplicate fields/IDs, or incomplete unknowns | Rejects the artifact contract | Clear failure with no accepted output |
| Rejected invocation | Missing, unsafe, binary, oversized, or nested output input | Fails before artifact publication | Full recursive source and output snapshots are unchanged |

</frozen-after-approval>

## Code Map

- `.agents/skills/resume-evidence-documenter/validation/validate-contract.mjs` — active deterministic preflight, generation-contract, provenance, and safety validator.
- `.agents/skills/resume-evidence-documenter/validation/validate-fixture.mjs` — supported validation entry point.
- `.agents/skills/resume-evidence-documenter/{SKILL.md,instructions.md,checklist.md}` — delivered workflow contract to reconcile with enforcement.
- `.agents/skills/resume-evidence-documenter/templates/*.md` — canonical artifact schemas that must include provenance, explicit unknowns, and unreviewed/import boundary.
- `_bmad-output/implementation-artifacts/1-8-create-resume-evidence-documenter-skill.md` — authoritative re-review checklist to update only after proof.

## Tasks & Acceptance

**Execution:**
- [ ] `.agents/skills/resume-evidence-documenter/validation/validate-contract.mjs` — add pre-enumeration directory/depth/entry and aggregate-read bounds, stable source/output revalidation, safe atomic artifact publication, all fence/overview/source-map provenance checks, duplicate/linkage/unknown validation, and active adversarial coverage — close every scoped re-review gap.
- [ ] `.agents/skills/resume-evidence-documenter/{SKILL.md,instructions.md,checklist.md,templates/*.md}` — align documented invocation and all templates with the validator's canonical provenance/explicit-unknowns schema — keep delivery instructions and tests consistent.
- [ ] `.agents/skills/resume-evidence-documenter/validation/validate-fixture.mjs` — retain it as a working entry point and exercise the documented successful invocation without changing the selected fixture.
- [ ] `_bmad-output/implementation-artifacts/1-8-create-resume-evidence-documenter-skill.md` — check off only the re-review items proven by the updated active fixture and required checks; add concise evidence to the record.

**Acceptance Criteria:**
- Given hostile traversal, aggregate size, link/reparse, or path-swap conditions, when the active validator runs, then it fails before unsafe traversal/use/publication and preserves full source/output snapshots with no partial artifacts.
- Given a successful new explicit output directory, when the documented skill workflow is validated, then exactly the three delivered-artifact forms are produced and every factual overview/evidence/bullet reference is safely reconciled to inspected source material outside both backtick and tilde fences.
- Given templates or output entries with incomplete explicit unknowns, duplicate fields/IDs, or ambiguous evidence linkage, when contract validation runs, then it rejects them.
- Given the scoped hardening is complete, when the listed skill and project checks run, then all pass and only demonstrably resolved Story 1.8 findings are checked.

## Design Notes

Treat a successful run as a transactional publication: validate stable inputs and output ancestry immediately before each operation, create artifacts in a guarded staging location, then publish as a set or remove only assets created by that run. Test link and junction/reparse cases independently because platforms can support one without the other.

## Verification

**Commands:**
- `node .agents/skills/resume-evidence-documenter/validation/validate-contract.mjs` — expected: all positive, rejection, bounds, reparse, swap, provenance, and non-mutation cases pass.
- `node .agents/skills/resume-evidence-documenter/validation/validate-fixture.mjs` — expected: supported entry point passes the active fixture contract.
- `python C:\Users\Adrian Javier\.codex\skills\.system\skill-creator\scripts\quick_validate.py .agents/skills/resume-evidence-documenter` — expected: valid local skill structure.
- `npm test` — expected: application tests pass unchanged.
- `npm run typecheck` — expected: pass.
- `npm run lint` — expected: pass.
- `npm run build` — expected: production build succeeds.
