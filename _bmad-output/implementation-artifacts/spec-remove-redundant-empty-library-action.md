---
title: 'Remove redundant empty-library header action'
type: 'refactor'
created: '2026-08-25'
status: 'done'
route: 'one-shot'
---

# Remove redundant empty-library header action

## Intent

**Problem:** An empty Opportunity Library showed two identical **Add opportunity** controls.

**Approach:** Keep the contextual empty-state action and hide the header action only on empty All opportunities; preserve a capture path in Applied and error states.

## Suggested Review Order

- Gates the header action by library and view state without changing capture behavior.
  [`job-listings.tsx:38`](../../src/app/job-listings.tsx#L38)

- Guards the intended state boundary and retained empty-state action.
  [`job-listings-ui.test.ts:46`](../../tests/job-listings-ui.test.ts#L46)
