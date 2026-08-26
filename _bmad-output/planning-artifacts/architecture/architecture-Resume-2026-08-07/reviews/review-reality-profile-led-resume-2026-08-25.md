# Reality Review — Profile-led Resume Generation

**Verdict:** Needs revision before implementation. The proposed native LM Studio v1 endpoint is current, and the forward-only schema direction fits the repository, but the privacy/state contract and the coexistence path need tightening.

## Findings

1. **[High] Native chat is stateful unless the request explicitly opts out.** AD-2 calls `LocalModelGateway` stateless, yet LM Studio's native `POST /api/v1/chat` stores chats by default. The contract must require `store: false`, prohibit `previous_response_id`, and reject/ignore `response_id`; otherwise selected profile and evidence persist in LM Studio outside the application's Material Draft and audit model. [LM Studio Stateful Chats](https://lmstudio.ai/docs/developer/rest/stateful-chats) and [Chat API](https://lmstudio.ai/docs/developer/rest/chat).

2. **[High] The current local-model adapter uses a different contract.** `src/adapters/evidence-documenter/lm-studio-documenter.ts` calls OpenAI-compatible `POST /v1/chat/completions`, reads `LM_STUDIO_MODEL`, and only sends a token when configured. AD-2/AD-13 require native `/api/v1/chat` and an API token. The architecture must explicitly say whether the old evidence-documenter remains supported as a separate compatibility adapter or is migrated in the same Epic 8 slice; leaving both unspecified risks divergent consent, authentication, and persistence behavior.

3. **[Medium] Model identity is not executable as written.** LM Studio's native API requires a server-recognized `model` identifier; the existing code obtains that from `LM_STUDIO_MODEL`. "Qwen3.5-9B" is a product selection, not a validated LM Studio model ID. Define a single protected configuration field containing the exact loaded-model identifier, verify it before consent, include its digest in the configuration fingerprint, and do not expose it in the UI. [LM Studio REST quickstart](https://lmstudio.ai/docs/developer/rest/quickstart).

4. **[Medium] The migration is feasible, but the file/database atomicity claim needs a recovery rule.** SQLite can transact `0021_resume_profile_materials`, but copying `Resume.pdf` into app data cannot participate in that transaction. The stated staging cleanup helps; additionally require startup/bootstrap recovery to remove unreferenced staging/final template directories and to re-verify the designated row before use. This matches the existing file-first `stageCurrentBaseResume`/cleanup pattern in `src/files/current-base-resume.ts`.

5. **[Medium] Compatibility scope must explicitly remove the active legacy route, not only the UI panel.** `src/app/resume-workspace.tsx`, `src/app/actions.ts`, and `src/app/api/current-base-resume/[sourceId]/pdf/route.ts` currently expose the manual Current Base Resume flow. AD-14 says new routes/actions use only Profile-led repositories, but it does not state the disposition of the existing route/action handlers. Make them history-only/unreachable from the Resume page and prevent new writes through them, or keep a clearly scoped archival screen; otherwise the old workflow remains an active competing authority.

## Confirmed

- `/api/v1/chat` is the officially recommended native LM Studio v1 endpoint; API tokens are supported when authentication is enabled. [LM Studio REST API](https://lmstudio.ai/docs/developer/rest), [Authentication](https://lmstudio.ai/docs/developer/core/authentication).
- Migration numbering and the existing `node:sqlite` migration registry support adding `0021_resume_profile_materials` after `0020`.
- `current_base_resume_sources` already retains immutable byte metadata and private relative storage paths, so legacy-candidate backfill can be non-destructive.
