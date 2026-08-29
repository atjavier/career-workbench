# Streaming Contract

## Protocol decision

Use LM Studio's documented native REST endpoint: `POST /api/v1/chat` with `stream: true`.

| Frame | Required handling |
| --- | --- |
| `event: message.delta` | Relay its bounded `content` as Coach presentation text. |
| `event: chat.end` | Validate the aggregate message from `result.output` and persist the completed Coach turn. |
| `event: error` | Stop without persisting a Coach turn and expose a safe retry state. |

Do not silently retry against another endpoint or accept OpenAI-compatible framing in this adapter.

## Response acceptance

- Relay only bounded assistant message text; ignore or reject reasoning, tools, raw metadata, and unknown events according to the selected protocol.
- The Coach reply may use natural language. It does not need to begin with, repeat, or quote the saved question.
- Candidate and Coach messages behave like a traditional messaging thread: every explicit send appends one candidate bubble, then a streamed Coach bubble; the single composer stays available for additional turns until finalization.
- Reject empty output, malformed framing, protocol error events, duplicate terminals, output over the existing bound, cancellation, timeout, and any incomplete stream.
- Persist a Coach turn only after the selected terminal condition validates. Partial output is client-only and disappears after interruption or refresh.

## Thread and final-answer interaction

- One active composer sends candidate chat messages and starts the explicit local stream.
- The chronological thread is the sole interaction surface; no non-streaming Coach composer or independent answer textarea is rendered.
- Candidate chat messages remain presentation-only until Adrian explicitly chooses one as the final answer through the existing answer transaction.
- The existing **I don't know** action remains available for the pending task.

## Verification matrix

| Case | Expected behavior |
| --- | --- |
| Valid natural reply | Incremental Coach bubble appears; final Coach turn persists after terminal validation. |
| Reply does not repeat saved question | Stream completes and persists as presentation text. |
| Malformed/error/duplicate terminal | No Coach turn persists; a safe error and retry control appear. |
| Cancel/disconnect/timeout | Upstream aborts; partial bubble is unfinished and not persisted. |
| Candidate final-answer selection | Only explicitly selected candidate message enters the existing answer/evidence transaction. |
| Workspace/task change | Stream fails closed and cannot persist into a different workspace or task. |
