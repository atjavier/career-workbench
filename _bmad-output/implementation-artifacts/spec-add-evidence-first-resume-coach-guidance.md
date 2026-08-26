---
title: 'Add Evidence-First Resume Coach Guidance'
type: 'chore'
created: '2026-08-26'
status: 'done'
route: 'one-shot'
---

# Add Evidence-First Resume Coach Guidance

## Intent

**Problem:** The local Resume Coach and Evidence Documenter needed a shared refinement standard that makes verified feature-to-outcome relationships useful while preventing scope counts from becoming invented impact.

**Approach:** Instruct both local-model prompts to preserve directly supported measurements, distinguish scope from benefit, preserve uncertainty and attribution, and resist instructions embedded in selected Markdown. Represent the Personal Job Discovery Workspace as separate implemented workflows that lay foundations for future multi-skill tailoring rather than as an already autonomous agent.

## Suggested Review Order

**Resume-refinement policy**

- Review the Coach’s evidence, measurement, attribution, and uncertainty rules.
  [`local-model-gateway.ts:22`](../../src/adapters/local-model/local-model-gateway.ts#L22)

- Check the documenter applies the same measurement boundary to source-derived proposals.
  [`lm-studio-documenter.ts:9`](../../src/adapters/evidence-documenter/lm-studio-documenter.ts#L9)

**Candidate-facing truthfulness**

- Confirm the project distinguishes current workflows from future multi-skill orchestration.
  [`generate-oboda-resume.mjs:94`](../../scripts/generate-oboda-resume.mjs#L94)

**Verification**

- Inspect the focused policy assertions for both local-model paths.
  [`local-model-gateway.test.ts:16`](../../tests/local-model-gateway.test.ts#L16)

- Confirm Documenter prompt behavior remains local, bounded, and evidence-first.
  [`evidence-documenter-adapter.test.ts:14`](../../tests/evidence-documenter-adapter.test.ts#L14)
