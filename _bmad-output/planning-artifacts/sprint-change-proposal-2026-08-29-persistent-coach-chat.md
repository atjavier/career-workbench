# Sprint Change Proposal: Persistent Coach Resume Chat

## Issue Summary

Story 9.7’s initial turn-based wording could produce an interaction that feels like a task form rather than the chat experience Adrian expects. The required outcome is a conventional, persistent request/reply chat UI; token streaming remains deferred.

## Impact Analysis

- **Epic 9:** unchanged in purpose and sequence. Story 9.7 remains the interview-only local AI chat; Story 9.8 remains the first-resume generation gate.
- **Story 9.7:** expand the presentation and persistence contract to restore workspace-owned Coach/user messages, show a composer and pending state, and pass a bounded prior transcript on each explicit request.
- **Architecture:** no decision change. AD-1/AD-2 still require explicit, loopback-only, stateless, tool-free requests and SQLite authority. Persisted chat content is private application state, never an operational audit payload.
- **UX:** add chronological message bubbles, a bottom composer, visible “Coach is thinking…” status, and resilient reload/switch behavior. The interface remains keyboard accessible and reflows without horizontal scrolling.
- **PRD:** no conflict; the change clarifies the existing local-only, explicit-action Coach interaction.

## Recommended Approach

Direct adjustment to Story 9.7. Effort: medium. Risk: medium, mitigated by bounded transcript limits, active-workspace/task revalidation before persistence, and focused regression tests. No rollback, reordering, or new epic is needed.

## Detailed Change Proposals

### Story 9.7 — Acceptance Criteria

**Old:** the chat must retain saved questions, messages, answers, skips, progress, and safe action after return.

**New:** present those records as a chronological workspace-owned Coach/user message thread with an always-visible, labelled composer; explicitly submitted turns show an announced pending state and append only validated saved replies. Reloading or switching restores only the selected workspace’s thread.

**Old:** each turn sends a safe transcript needed to phrase the next question.

**New:** each turn sends at most the bounded, persisted active-workspace transcript associated with the current interview; it never streams tokens, sends another workspace’s messages, or resumes automatically.

### Implementation Handoff

1. Add/reuse a workspace-owned message projection and repository methods for Coach and candidate messages, task linkage, ordering, and bounded readback.
2. Update the explicit Coach action to read bounded history/context, persist the candidate message and validated Coach reply transactionally after active-workspace validation, and preserve errors without partial message mutation.
3. Replace the current interview panel with scrollable chronological bubbles, a fixed-in-panel composer, pending state, and explicit Start/Send controls.
4. Add migration/domain/gateway/UI tests for reload, switching, stale task/workspace, bounded transcript, no auto-retry, accessibility, and no token streaming.

## Success Criteria

- A user can send an explicit message, see pending state and a Coach reply, and see the same thread after reload.
- Workspace switching never reveals another workspace’s messages.
- Every request remains one bounded request/reply; no token streaming, tools, automatic retry, or generation occurs.
- Existing answer/skip evidence authority, privacy boundaries, and full validation suite remain intact.

## Approval and Handoff

Approved by Adrian on 2026-08-29. Scope: moderate direct adjustment; route to Developer for Story 9.7 implementation.
