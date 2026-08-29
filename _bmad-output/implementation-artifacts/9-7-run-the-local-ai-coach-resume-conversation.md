---
baseline_commit: c285895af6f9e62c68ad1f79d331458274b6ed9b
---

# Story 9.7: Run the Local AI Coach Resume Conversation

Status: in-review

## Story

As Adrian,
I want Coach Resume to conduct the required clarification interview as a local AI chat,
so that the conversation feels natural while remaining grounded in saved evidence tasks.

## Acceptance Criteria

1. **Processing gate:** Given documentation or task planning is queued/running, opening `/resume/interview` shows only the truthful persisted processing state—no ready message, task, chat turn, resume generation, or preview.
2. **Explicit bounded turn:** Given pending saved tasks and ready local AI, an explicit Begin/Continue action sends LM Studio only the current saved task, bounded workspace-owned documented and clarified context, and a safe transcript needed to phrase the next question.
3. **Constrained reply:** A valid reply may conversationally introduce the saved question and request at most one bounded follow-up. It cannot create tasks, claims, evidence, drafts, PDFs, filesystem reads, network calls, or tool actions.
4. **Authoritative answer/skip:** Answer/skip continues to use the existing task/response/clarified-evidence transaction. A next AI turn is requested only by another explicit user action.
5. **Persistent chat recovery:** On unavailable/invalid model response or return to the page, a chronological workspace-owned Coach/user thread, saved questions, answers, skips, progress, and the next safe action remain visible. Explicit sends show an announced pending state; never automatically retry, stream tokens, or generate a resume.
6. **Accessible chat:** Transcript, consent disclosure, input, pending/recovery state, and explicit controls are keyboard and screen-reader operable and reflow at 400%/narrow screens without horizontal overflow.

## Tasks / Subtasks

- [x] Define a narrow persisted Coach-interview projection and turn contract (AC: 2-5)
  - [x] Add a forward-only migration/repository only if durable chat turn state is not already representable from saved tasks/responses; workspace ID, task ID, ordering, status, and timestamp must be authoritative and isolated.
  - [x] Build a server-only domain command that re-reads the active/original workspace and exact pending task before preparing a turn.
  - [x] Select only bounded workspace-owned documented facts and clarified candidate evidence. Never consume source folders, global/unowned evidence, readable packet paths, raw prompts, model response IDs, or another workspace’s data.
  - [x] Persist only data necessary for safe chronological rendering: task-linked Coach and candidate messages with workspace ordering. Audit metadata/hashes only—never prompts, tokens, credentials, diagnostics, or raw source content.

- [x] Add a separate, stateless local-model interview capability (AC: 2-3, 5)
  - [x] Extend the existing server-side LM Studio gateway with a distinct interview request/response schema and configuration capability/fingerprint; do not reuse generation or post-draft review contracts.
  - [x] Retain the gateway’s loopback-only native v1 request behavior, `store: false`, stateless request shape, bounded timeouts/sizes, no cloud fallback, no tools/MCP, and no automatic retry.
  - [x] Validate a minimal response contract: conversational framing of the exact stored question plus zero or one bounded follow-up. Reject malformed/stateful/tool-like output and never let it create or alter task/evidence/draft/PDF state.
  - [x] Require fresh explicit, request-bound consent. Bind it to workspace, current task, bounded context/transcript, selected local configuration revision/digest/model, and nonce; changes invalidate it.

- [x] Evolve the interview route and actions without moving authority to the client (AC: 1, 4-6)
  - [x] UPDATE `src/app/resume/interview/page.tsx` to preserve the journey gate and status-only processing state; route visits must not invoke LM Studio.
  - [x] UPDATE `src/app/resume-interview.tsx` into a persistent chronological bubble thread with a labelled bottom composer, explicit Start/Send, announced “Coach is thinking” pending state, progress, consent, unavailable, invalid, and recovery states; retain the saved task as answer/skip authority.
  - [x] Add a thin Server Action in `src/app/actions.ts` for hostile `FormData` validation, safe domain invocation, safe-error conversion, and literal `/resume/interview` and `/resume` revalidation only after a user-visible mutation.
  - [x] Keep `respondToResumeClarification` as the only answer/skip mutation. Preserve its 2,400-character bound, active-workspace/pending-task checks, transaction, clarified-evidence semantics, journey reconciliation, and packet-sync recovery outcome.

- [x] Preserve boundaries and accessible interaction (AC: 1-6)
  - [x] Keep this a chat-only story: do not implement token streaming, resume generation, draft/PDF/TeX rendering, preview, task planning, task/evidence/claim creation, filesystem browsing, or external/network/tool actions.
  - [x] Use semantic chronological transcript markup, labelled input/actions, `aria-live="polite"` atomic status, `aria-busy` during the explicit request, visible focus, and source-order reflow with no horizontal scrolling.
  - [x] The unavailable state preserves interview history and offers the safe local-AI setup recovery; never expose endpoint, token, prompt, model diagnostic, UUID, digest, or path.

- [x] Test the full safe-turn and regression contract (AC: 1-6)
  - [x] Extend gateway/configuration tests for exact loopback-bounded payload, consent fingerprint invalidation, malformed/stateful/tool-like response rejection, one-follow-up maximum, and no retry/fallback.
  - [x] Extend interview/domain tests for workspace isolation, current-task binding, answer/skip authority, reload transcript/progress, unavailable/invalid recovery, and switch/delete races.
  - [x] Add UI tests for status-only processing, no generation/preview, explicit-action sequencing, accessible consent/transcript/status, and narrow layout.
  - [x] Run `npm run typecheck`, `npm run lint`, and `npm test -- --runInBand`.

## Dev Notes

### Existing foundation—extend, do not replace

- Stories 9.1-9.3 establish intake, conservative interpretation, workspace-owned tasks, and journey state. Stories 9.4-9.5 own the interview answer/skip and clarified-evidence transaction. Story 9.6 owns only a readable derived evidence-packet projection. SQLite remains authoritative throughout.
- `readResumeClarificationInterview` and `respondToResumeClarification` in `src/domain/resume-generation/resume-clarification-interview.ts` are the authoritative deterministic projection/mutation. The chat must phrase saved questions; it must not invent, reorder, complete, or mutate them.
- `src/app/resume/interview/page.tsx` already guards by journey phase and renders processing-only state. `src/app/resume-interview.tsx` and `resumeClarificationAction` are extension points; maintain Server Component ownership and thin Action boundaries.
- `src/adapters/local-model/local-model-gateway.ts` has reusable stateless loopback transport, but existing generation/review contracts are incompatible: they create material-oriented output and fallbacks. Introduce a narrowly validated interview capability instead.

### Mandatory architecture and privacy rules

- The configured exact Qwen3.5-9B model is verified locally through the existing configuration command. Model requests are explicit, server-side, loopback-only `http://127.0.0.1:1234/api/v1/chat`, `store: false`, and stateless. No cloud, LAN serving, CORS expansion, tool/MCP integration, filesystem access, or automatic retry.
- Model output is untrusted. A conversational response is presentation only; no candidate-facing claim may result. Candidate answers become attributable evidence only through the existing answer transaction and its provenance/conflict logic.
- Re-read active/original workspace before model work and before persistence. A workspace switch/deletion fails closed and cannot attach context or transcript to the newly selected workspace.
- Do not log prompts/responses or reveal internal local-model details. Audit only metadata/hashes as allowed by the existing audit contract.

### Framework and UI rules

- This repository uses Next.js 16.3, React 19.2, TypeScript 5.9, Node 24, and Node’s native test runner through `tsx`. Before application-code changes, read relevant installed Next 16 guides under `node_modules/next/dist/docs/` for Server Actions and `revalidatePath`.
- Keep client props and Action returns serializable. Validate hostile `FormData` in the server action and make domain ownership checks authoritative. Do not use `after()` or client-side parallel actions for a critical interview turn.
- Follow the local Resume Coach visual language: contained chronological coach/user bubbles, calm consent disclosure, explicit controls, visible focus, semantic status, and a one-column narrow layout. Do not show final split Coach/preview UI until Story 9.9.

### Files likely to change

- UPDATE `src/app/resume/interview/page.tsx`
- UPDATE `src/app/resume-interview.tsx`
- UPDATE `src/app/actions.ts`
- UPDATE `src/domain/resume-generation/resume-clarification-interview.ts` only for safe projections/integration; preserve answer authority
- NEW/UPDATE focused Coach-chat domain command, repository, migration, and narrow local-model adapter/gateway contract as implementation requires
- UPDATE `src/domain/resume-generation/local-model-configuration-commands.ts` / capability registry only when needed for a distinct interview capability
- TEST `tests/local-model-gateway.test.ts`, `tests/resume-evidence-interpretation.test.ts`, relevant Resume UI tests, and workspace-race coverage

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 9]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 9.7]
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-08-29-coach-evidence-packets.md#Detailed Change Proposals]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-Resume-2026-08-07/ARCHITECTURE-SPINE.md#AD-1, AD-2, AD-4, AD-10, AD-11]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-Resume-2026-08-06/DESIGN.md#Local AI state pattern]
- [Source: _bmad-output/implementation-artifacts/9-6-create-workspace-scoped-resume-evidence-packets.md]
- [Source: src/domain/resume-generation/resume-clarification-interview.ts]
- [Source: src/adapters/local-model/local-model-gateway.ts]
- [Source: src/app/resume/interview/page.tsx]
- [Source: src/app/resume-interview.tsx]

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Completion Notes List

- 2026-08-29: Ultimate context engine analysis completed - comprehensive developer guide created.

### File List

- _bmad-output/implementation-artifacts/9-7-run-the-local-ai-coach-resume-conversation.md

## Change Log

- 2026-08-29: Created implementation-ready Story 9.7 from Epic 9, architecture, UX, current implementation, and Story 9.6 context.
