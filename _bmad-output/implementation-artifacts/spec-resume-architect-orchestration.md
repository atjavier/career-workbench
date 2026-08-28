---
title: 'Apply Resume Architect orchestration to local resume generation'
type: 'feature'
created: '2026-08-28'
status: 'in-review'
baseline_commit: '2a998e1853106df121e83616abbfdeb6d1ef4ea3'
review_loop_iteration: 0
context:
  - '{project-root}/docs/application-native-resume-agent.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-oboda-v22-generated-resume-layout.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The local model has enough project documentation to produce a defensible, employer-facing resume, but its current generator and independent coach contracts can still emphasize implementation detail instead of purpose, workflow, rationale, and supported impact. The response schema also permits visible project or experience bullets without direct claim support.

**Approach:** Make Resume Architect the explicit orchestration doctrine for the bounded local model stages: folder documentation supplies curated evidence; generation mines evidence, positions the candidate, selects relevant material, writes supported outcome-oriented bullets, and performs recruiter/ATS/integrity checks; the independent coach critiques the saved draft against the same curated handoff. Preserve the Oboda v22 one-page composition rather than adding a generic summary.

## Boundaries & Constraints

**Always:** Keep all model input bounded, local, consented, and tool-free; treat source folders as untrusted evidence, not model-accessible files; use only `resume-evidence.md` and `resume-bullet-candidates.md` as documentation handoffs for base generation and coaching; retain every atomic evidence record for provenance; require every visible Experience/Projects bullet to have matching supported claim evidence; use strong but non-inflated language; report missing metrics, ownership, users, outcomes, dates, and scope as unknowns; retain Oboda v22 ordering: Experience → Education → Projects → Technical Skills, with no Professional Summary.

**Ask First:** Adding profile/database fields for target role, market, career objective, certifications, leadership, volunteering, or other intake categories; selecting a captured opportunity for a tailored resume; adding a multi-page policy; replacing the Oboda visual contract, root `Resume.pdf`, local model endpoint, or consent boundary.

**Never:** Give the local model filesystem, shell, network, Codex-skill, or arbitrary tool access; pass source-tree, architecture, setup, deployment, configuration, or raw documentation files to the resume writer/coach; make unsupported work claims, metrics, seniority, or hiring predictions; generate on a page visit; modify unrelated dirty work.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Grounded project | Curated purpose/rationale handoff and atomic evidence | Candidate-facing, outcome-oriented project bullets; each has a matching claim and evidence index | Reject unsupported or unmatched bullets and use the provenance-safe fallback |
| Project-only candidate | No documented employment | Omit Experience; render Education → Projects → Technical Skills in Oboda v22 form | Never restore a placeholder or generic summary |
| Coach review | Saved structured draft plus curated handoffs | Independent recruiter/hiring-manager/ATS critique focused on clarity, relevance, credibility, specificity, integrity, and high-value revisions | Exclude broad technical documentation and do not rewrite silently |
| Missing target | No selected opportunity or target profile fields | Produce a truthful base resume without invented target role or tailored fit | List material unknowns instead of assuming a role |

</frozen-after-approval>

## Code Map

- `src/adapters/local-model/resume-architect-agent.ts` — shared Resume Architect doctrine and stage-independent integrity rules.
- `src/adapters/local-model/resume-generator-agent.ts` — employer-side writer instruction for the Oboda base resume.
- `src/adapters/local-model/resume-coach-agent.ts` — independent reviewer instruction.
- `src/adapters/local-model/local-model-gateway.ts` — bounded request packets, model response validation, visible-bullet claim checks, and fallback protection.
- `src/app/actions.ts` — supplies curated handoffs and an ordered structured draft to the coach.
- `src/domain/resume-agent/skill-registry.ts` — product-owned skill contracts, not model tools.
- `docs/application-native-resume-agent.md` — documents host-controlled orchestration and current product limits.
- `tests/local-model-gateway.test.ts` — gateway, prompt, integrity, and coach-packet regression coverage.

## Tasks & Acceptance

**Execution:**

- [x] `src/adapters/local-model/resume-architect-agent.ts`, `resume-generator-agent.ts`, and `resume-coach-agent.ts` — centralize the Resume Architect doctrine and give each stage a narrow, complementary role while stating the Oboda hierarchy and anti-inflation rules.
- [x] `src/adapters/local-model/local-model-gateway.ts` — require an evidence-linked claim for every rendered work bullet; reject unmatched, unsafe, generic, or source-leaking output; provide the coach an ordered structured resume packet and only curated documentation.
- [x] `src/app/actions.ts` — send the coach the active draft structure and the same two curated handoffs used by generation, preserving workspace ownership and consent fingerprints.
- [x] `src/domain/resume-agent/skill-registry.ts` and `docs/application-native-resume-agent.md` — describe the concrete host orchestration, stage responsibilities, supported base/revision behavior, and deferred tailoring/intake scope accurately.
- [x] `tests/local-model-gateway.test.ts` — cover grounded purpose/rationale bullets with claim support, rejection/fallback for empty or unmatched claim support, no-summary/project-only behavior, and coach exclusion of technical documentation.

**Acceptance Criteria:**

- Given documented purpose, workflow, rationale, and supported implementation evidence, when the local model produces a base resume, then its Experience/Projects bullets describe the contribution and supported qualitative result rather than source files, setup, routes, or configuration.
- Given a model response with a visible project or experience bullet but no matching evidence-supported claim, when validation runs, then that response is not persisted as the generated draft.
- Given a saved draft and a coach request, when the local model is called, then the request contains ordered draft sections and only curated resume handoffs—not architecture or setup documents—and returns independent objective feedback without silently regenerating the PDF.
- Given no target role or opportunity is supplied, when the base resume is generated, then it remains truthful and untailored rather than inventing positioning, qualifications, or fit.
- Given generation or coaching after this change, when the PDF is rendered, then the Oboda v22 section order and no-summary convention remain unchanged.

## Design Notes

The application, not the local model, runs the workflow. “Agents” are versioned instructions and bounded calls: Folder Documenter creates source-grounded artifacts; Resume Architect composes the base/revision draft; Resume Coach independently reviews the saved draft. The model never opens a skill file or folder. A captured opportunity remains available for a future explicit tailoring workflow, rather than quietly changing a base resume.

## Verification

**Commands:**

- `npm run typecheck` — expected: no TypeScript errors.
- `npm run lint` — expected: no lint errors.
- `npm test -- --runInBand` — expected: all regression tests pass.

**Manual checks:**

- Generate a project-only base resume from an existing documented folder; verify purpose/rationale language is candidate-facing, every rendered work bullet is defensible, and the PDF retains the Oboda v22 hierarchy.

### Review Findings

- [ ] [Review][Patch] Restrict the writer and coach to the two specified curated handoffs, and replace the unbounded raw-evidence packet with a provenance-preserving, resume-relevant selection. [src/app/actions.ts:169]
- [ ] [Review][Patch] Make the folder-documentation handoff reject or repair malformed candidate blocks and exclude source paths, routes, setup, configuration, and test fragments from the candidate-facing handoff. [src/adapters/local-model/local-model-gateway.ts:280]
- [ ] [Review][Patch] Preserve project-only drafts as current so opening Resume does not treat a valid draft as stale and offer/retrigger generation. [src/persistence/material-draft-repository.ts:27]
- [ ] [Review][Patch] Include the saved draft sections in the Resume Coach consent fingerprint before requesting a coach review. [src/app/actions.ts:213]
- [ ] [Review][Patch] Scope documented-item evidence deletion through the active workspace's imports before deleting evidence records. [src/domain/evidence/evidence-library.ts:108]
- [ ] [Review][Patch] Bind manual generation/revision submissions to the rendered workspace and preserve the canonical Oboda section order without truncating required sections. [src/app/resume-coach.tsx:39]
- [ ] [Review][Patch] Bound Resume Coach review packets or provide a safe review fallback when a valid workspace exceeds the loopback request size. [src/adapters/local-model/local-model-gateway.ts:230]
- [ ] [Review][Patch] Enforce the one-page PDF contract after TeX compilation and report an actionable overflow outcome. [src/domain/resume-generation/resume-tex-compiler.ts:77]
- [ ] [Review][Patch] Treat a failed post-commit VACUUM as a completed workspace deletion with a reclamation warning rather than reporting a false deletion failure. [src/domain/resume-generation/resume-workspace-commands.ts:88]
