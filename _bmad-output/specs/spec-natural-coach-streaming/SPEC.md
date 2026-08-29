---
id: SPEC-natural-coach-streaming
companions:
  - streaming-contract.md
sources:
  - ../../implementation-artifacts/9-10-stream-the-local-ai-coach-resume-conversation.md
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. Source documents listed in frontmatter are for traceability — consult them only if you need narrative rationale or prose color this contract intentionally omits.

# Natural Realtime Coach Resume Streaming

## Why

A rigid streamed-response validator rejects normal LM Studio replies even while the local model is running, leaving Adrian with an unavailable error rather than the expected responsive chatbot experience. Coach Resume must stream natural conversational help through one chat-first interface without allowing model wording to become resume evidence or expand local-model authority.

## Capabilities

- **CAP-1**
  - **intent:** Adrian can send a message through one Coach Resume composer and receive a progressive, natural conversational Coach reply for the active saved clarification task.
  - **success:** A verified local LM Studio stream renders its text incrementally in the chronological chat thread and completes without requiring the reply to reproduce the saved question verbatim.

- **CAP-2**
  - **intent:** Adrian can use the same chat thread to decide which of his messages answers the active clarification task.
  - **success:** The interface exposes no secondary Coach or answer textboxes; Adrian can explicitly select an existing candidate chat message as the final answer or mark the task unknown.

- **CAP-3**
  - **intent:** The application can distinguish valid local streaming protocol completion from untrusted model text while preserving the existing interview safety boundary.
  - **success:** The server accepts LM Studio native `/api/v1/chat` named SSE events, relays bounded message text, persists a Coach turn only after valid `chat.end` completion, and keeps model text presentation-only until the candidate explicitly finalizes a message.

- **CAP-4**
  - **intent:** Adrian can have a traditional messaging-style conversation with Coach Resume while clarifying the active saved task.
  - **success:** Candidate and Coach bubbles remain chronological in one thread; each explicit candidate send creates one new candidate turn and Coach response; the single composer remains available until Adrian explicitly finalizes a message or marks the task unknown.

## Constraints

- Model access remains server-owned, explicit, stateless, loopback-only, bounded, request-consented, task/workspace isolated, `store: false`, tool-free, filesystem-free, cloud-free, LAN-free, and retry-free.
- The selected streaming protocol must be documented by LM Studio and must have executable tests for normal deltas, terminal completion, malformed/error frames, cancellation, timeout, and incomplete streams.
- Natural Coach wording cannot create or modify clarification tasks, candidate answers, clarified evidence, claims, drafts, PDFs, or rendering state.
- SQLite/application-host code remains authoritative for chronology, candidate-message durability, cancellation/finalization, active-workspace checks, and the explicit answer/unknown transaction.
- The chat remains keyboard and screen-reader operable; progress announcements are throttled and unfinished text is clearly labelled and discarded after interruption.

## Non-goals

- Supporting OpenAI-compatible streaming or protocol failover in the Coach request path.
- A general-purpose chatbot, automated answer extraction, automatic answer completion, or treating every chat message as evidence.
- Client-side direct connections to LM Studio, model credentials, raw SSE events, prompts, diagnostics, tool calls, cloud fallback, or resume generation.

## Success signal

With the configured LM Studio model running locally, Adrian can hold a natural realtime Coach conversation in one thread, see text arrive progressively, and explicitly promote one of his messages as the answer without seeing a false unavailable error. Interrupted or malformed streams leave no persisted Coach reply and retain a clear recovery path.

## Assumptions

- Story 9.10’s existing persistence, cancellation, bounded-context, workspace-isolation, and final-answer authority remain intact; this change is limited to stream interpretation and the chat surface.
