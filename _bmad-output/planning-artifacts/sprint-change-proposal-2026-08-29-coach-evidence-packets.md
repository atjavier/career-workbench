# Sprint Change Proposal — Coach Resume Chat and Workspace Evidence Packets

Date: 2026-08-29
Status: approved by Adrian in batch mode

## 1. Issue Summary

Manual testing revealed two gaps in the new evidence-first onboarding flow. First, the interview route could present a ready-like interview state while folder documentation was still processing. Second, the delivered interview was a persisted questionnaire rather than the local AI Coach Resume chat Adrian intended. A related discoverability gap is that candidate-provided interview context lives only in SQLite rather than beside the documented Project or Experience packet.

The completed deterministic Stories 9.4 and 9.5 remain useful foundations: they created workspace-scoped tasks, exact candidate answers, skips, provenance, conflict signals, and deletion safety. They do not satisfy the newly clarified interaction and filesystem requirements by themselves.

## 2. Impact Analysis

| Area | Impact |
| --- | --- |
| Epic 9 | Remains valid, but its remaining work must be reordered: evidence packet ownership and the AI Coach chat precede generation. |
| Stories 9.1–9.5 | No rollback. Add follow-on requirements; preserve their deterministic intake/task/answer records as the authority. |
| Current 9.6–9.7 | Renumber to 9.8–9.9 after two prerequisite stories are inserted. |
| Architecture | Preserve loopback-only, one-explicit-request, no-tool, no-cloud-fallback constraints. Add a workspace-scoped managed evidence-packet projection; SQLite remains authoritative. |
| UX | The processing route must state only actual intake status. The interview becomes a chronological chat with a local Coach turn, explicit consent, bounded follow-up, and recoverable unavailable state. |
| Data/privacy | Never mix workspaces in a human-readable folder. Candidate answers remain clearly separate from repository-grounded `resume-evidence.md`; no raw prompts/model output go into files or audit history. |

## 3. Recommended Approach

Direct adjustment within Epic 9 (moderate scope, medium risk): add two prerequisite stories, then move generation and the final split workspace after them. No rollback is justified because the existing task, response, clarification, journey, and cascade data model is required by the new implementation.

## 4. Detailed Change Proposals

### Insert Story 9.6 — Workspace-Scoped Evidence Packets

Replace the shared `resume-evidence/projects/<name>` and `experiences/<name>` canonical ownership assumption with a workspace-scoped managed packet path. The packet contains the existing documentation artifacts plus a generated `resume-clarifications.md` that mirrors only workspace-owned candidate answers, explicit skips, provenance, timestamp, and conflict-review state. `resume-evidence.md` remains unchanged and source-grounded. SQLite remains authoritative; file writes are derived, atomic, safe-path bounded, and removed with their workspace.

### Insert Story 9.7 — Run a Local AI Coach Resume Conversation

Replace the task-card experience with a local LM Studio Coach chat. The application remains task-led: it gives the model the current saved task and bounded safe transcript/context; the Coach introduces the question and may ask a bounded follow-up. Every model turn requires explicit local-AI consent, is loopback-only/tool-free, has no automatic retry, and cannot create a claim, task, draft, or PDF. Only validated user answers/explicit skips mutate candidate evidence.

### Renumber prior remaining stories

- Prior 9.6 **Generate the Resume After Interview Completion** becomes 9.8. It consumes workspace-owned documented evidence plus authoritative clarification records and the readable packet only as a projection; it must reject unresolved conflict-backed claims.
- Prior 9.7 **Show the Final Coach and Resume Workspace** becomes 9.9.

## 5. Implementation Handoff

1. Developer: create Story 9.6 context and implement workspace packet migration/copy/synchronization with deletion, switch, import, and safe-path tests.
2. Developer: create Story 9.7 context and implement the local AI Coach conversation using the existing gateway and consent boundary, with transcript/state/accessibility tests.
3. Developer: update Story 9.8 generation handoff to source only the authoritative workspace records and reject unreviewed conflicts.
4. Developer: implement Story 9.9 final split view only after a valid generated draft exists.

## Success Criteria

- Processing is never described as complete before intake and task planning are complete.
- A workspace can be inspected through one workspace-specific evidence packet without exposing another resume's candidate answers.
- `resume-clarifications.md` never turns candidate context into repository evidence.
- Coach chat is a bounded, consented LM Studio interaction; model availability does not erase saved tasks/answers or trigger generation.
- Deletion removes both authoritative data and its workspace-owned packet; the shared `Resume.pdf` remains untouched.
