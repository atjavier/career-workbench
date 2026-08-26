---
title: 'Simplify Oboda Resume Header'
type: 'chore'
created: '2026-08-26'
status: 'done'
route: 'one-shot'
---

# Simplify Oboda Resume Header

## Intent

**Problem:** The Oboda resume header included an unnecessary role tagline and the name was visibly left of center.

**Approach:** Remove the tagline, center the name on the page, retain contact information, and shift the body upward to preserve the one-page layout.

## Suggested Review Order

- Check the centered name, absent subtitle, and retained contact line.
  [`generate-oboda-resume.mjs:71`](../../scripts/generate-oboda-resume.mjs#L71)

- Confirm the restored body position leaves an intentional header gap.
  [`generate-oboda-resume.mjs:74`](../../scripts/generate-oboda-resume.mjs#L74)
