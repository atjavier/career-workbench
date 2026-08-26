---
title: 'Clarify Oboda AI Resume Experience'
type: 'chore'
created: '2026-08-26'
status: 'done'
route: 'one-shot'
---

# Clarify Oboda AI Resume Experience

## Intent

**Problem:** The Oboda-tailored resume used generic local-model language and did not clearly distinguish the implemented Local Resume Coach from the separate Evidence Documenter skill. Several inherited project claims also needed tighter evidence boundaries.

**Approach:** Make the AI workflow, provenance, consent, and human-review safeguards explicit; foreground full-stack and AI-workflow fit; and remove unsupported performance, ownership, and impact claims before exporting a new one-page version.

## Suggested Review Order

**Oboda positioning**

- Lead with a concise, evidence-supported full-stack and AI-workflow target statement.
  [`generate-oboda-resume.mjs:72`](../../scripts/generate-oboda-resume.mjs#L72)

**Local AI implementation**

- Name the bounded Resume Coach and its actual technical scope precisely.
  [`generate-oboda-resume.mjs:94`](../../scripts/generate-oboda-resume.mjs#L94)

- Review consent, immutable drafts, evidence links, and the distinct Documenter skill.
  [`generate-oboda-resume.mjs:96`](../../scripts/generate-oboda-resume.mjs#L96)

**Claim integrity**

- Confirm team-scoped attribution and removal of unsupported benchmark claims.
  [`generate-oboda-resume.mjs:99`](../../scripts/generate-oboda-resume.mjs#L99)
