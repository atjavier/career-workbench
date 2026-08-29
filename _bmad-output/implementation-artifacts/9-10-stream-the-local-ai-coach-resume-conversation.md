---
baseline_commit: c285895af6f9e62c68ad1f79d331458274b6ed9b
---

# Story 9.10: Stream the Local AI Coach Resume Conversation

Status: in-review

## Story

As Adrian,
I want Coach Resume replies to appear progressively while I wait,
so that the required local clarification interview feels like a responsive realtime conversation without weakening its evidence, privacy, or task boundaries.

## Prerequisites

- Story 9.7’s persisted, bounded, explicit-turn Coach conversation is complete and remains the authoritative fallback.
- A configured, verified local model supports the chosen loopback streaming protocol. If it does not, the UI truthfully offers the existing non-streaming send path; it must never fall back to a cloud or LAN service.

## Acceptance Criteria

1. **Explicit local stream:** Given a pending saved clarification task, fresh request-bound consent, and a streaming-capable verified local model, when Adrian selects **Send to local Coach**, the server opens exactly one bounded, loopback-only model request and progressively renders only Coach response text in the current task’s transcript. The client never receives local-model credentials, prompt text, raw model events, configuration diagnostics, or any direct model URL.

2. **Server-owned streaming boundary:** Given the realtime request, when model chunks arrive, then a server-owned route/stream adapter validates protocol framing, applies existing request, output-size, timeout, loopback-host, `store: false`, no-tools, no-retry, and workspace/task/consent checks, and relays only a bounded presentation-safe text delta stream. No client-side model connection, external request, LAN serving, tool/MCP call, filesystem access, or automatic retry is introduced.

3. **Authoritative finalization:** Given streamed text completes, when its complete response satisfies the narrow Coach response contract (the exact saved question and zero or one bounded follow-up), then the server rechecks active/original workspace and pending task and atomically persists the candidate message and final Coach message as ordinary chronological turns. Partial chunks are never persisted, never treated as evidence, and never create/change tasks, answers, claims, clarified evidence, drafts, PDFs, or resume generation state.

4. **Safe interruption and failure:** Given Adrian cancels, navigates away, the stream disconnects/times out, output exceeds its bound, the workspace changes/deletes, or final validation fails, then visible partial Coach text is labelled unfinished and discarded on the next render; no Coach reply is persisted. The already-persisted thread and current answer/skip controls remain available with an explicit, truthful recovery action. Cancellation and failure do not automatically retry.

5. **Candidate-message durability:** Given Adrian starts a stream, then their submitted message is persisted only once under the same workspace/current task ownership checks and remains visible after reload. A failed or cancelled stream must not duplicate that candidate message; a later explicit send creates a distinct candidate turn.

6. **Accessible realtime UX:** Given streaming is active, then the composer exposes a disabled send control and an enabled **Stop generating** control, uses an appropriately throttled polite live region for meaningful progress/final completion (without announcing every token), indicates busy state, retains keyboard operation and focus visibility, and reflows at 400%/narrow widths without horizontal overflow. Screen-reader users can distinguish unfinished streamed text from completed persisted messages.

7. **Fallback compatibility:** Given the selected local model cannot perform the validated stream protocol, then Coach Resume clearly offers the existing explicit non-streaming turn instead. Its established persistence, bounded context, and recovery behavior remain unchanged.

## Implementation Guardrails

- Keep SQLite/application-host ownership of transcript ordering, workspace isolation, consent validation, task authority, and final persistence. React state is display-only.
- Use a narrow server route/adapter specifically for Coach streaming; do not broaden the generation, drafting, or post-draft-review contracts.
- Define an explicit stream event schema and test malformed events, duplicate terminal events, mid-stream errors, oversized streams, client aborts, stale consent, workspace switching/deletion, and final-response validation.
- Do not log raw prompts, streamed text, credentials, response IDs, or diagnostics. Audit metadata/hashes only if permitted by the existing audit policy.
- Preserve `respondToResumeClarification` as the sole answer/skip and clarified-evidence mutation.

## Test Requirements

- Gateway/route tests for loopback-only streaming, headers/event filtering, bounds, timeout, abort propagation, no retry/fallback, and non-stream capability fallback.
- Domain tests for exact-once candidate persistence, final Coach persistence only after valid completion, isolation by workspace/task, interrupted-stream cleanup, and switch/delete races.
- UI tests for incremental rendering, cancellation, recovery, accessibility/live-region throttling, keyboard use, and narrow layouts.

## References

- Story 9.7: `_bmad-output/implementation-artifacts/9-7-run-the-local-ai-coach-resume-conversation.md`
- Existing Coach gateway: `src/adapters/local-model/local-model-gateway.ts`
- Existing interview authority: `src/domain/resume-generation/resume-clarification-interview.ts`
- Existing interview UI: `src/app/resume-interview.tsx`
