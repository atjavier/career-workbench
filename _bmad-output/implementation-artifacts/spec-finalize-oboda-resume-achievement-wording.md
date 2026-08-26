---
title: 'Finalize Oboda Resume Achievement Wording'
type: 'chore'
created: '2026-08-26'
status: 'done'
route: 'one-shot'
---

# Finalize Oboda Resume Achievement Wording

## Intent

**Problem:** The Oboda tailored resume described project features well but did not consistently state the practical result those features created, especially for BioEvidence users.

**Approach:** Reword verified project bullets as feature-to-outcome statements, retain the existing defensible scale figures, and export a new one-page PDF version without replacing the prior resume.

## Suggested Review Order

- Check that BioEvidence clearly states the beginner-focused outcome without claiming unmeasured adoption.
  [`generate-oboda-resume.mjs:94`](../../scripts/generate-oboda-resume.mjs#L94)

- Review the remaining projects for the same feature-to-workflow-result framing.
  [`generate-oboda-resume.mjs:99`](../../scripts/generate-oboda-resume.mjs#L99)

- Confirm the export targets a new version rather than overwriting v11.
  [`generate-oboda-resume.mjs:5`](../../scripts/generate-oboda-resume.mjs#L5)
