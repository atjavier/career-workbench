---
title: Direct formatted opportunity creation
created: 2026-10-05
type: feature
status: done
route: dispatch
baseline_commit: fbebb9cb1cd12f216acf9fca6c5ef36c439c4355
---
<frozen-after-approval reason="user explicitly removes pre-save draft approval">
## Intent

Supersede Generate draft → Review opportunity → Add with URL + pasted description → Add opportunity. The single submit generates source-grounded metadata/formatting, persists the opportunity and opens details. No draft approval screen. User edits remain available on saved details. Missing title/company or AI failure keeps inputs and provides actionable manual completion; never invent required facts or save invalid/partial records. Optional unknowns remain optional. Manual completion formats source and saves directly using the same validation path.

Preserve original source, Title Case role names, source-grounding and formatting boundaries, physical job/description/tailored-resume deletion and Cancel/Delete convention. URL remains reference only. Disable form during processing to keep submission source stable. Keep server redirect outside error catch. Do not introduce fit/tracking or new resume versions.
</frozen-after-approval>
## Implementation Notes

Reuse local AI generator as an internal preparation helper and shared persistence/domain validation. Add a domain create pipeline returning saved result, with missing-required-fields error carrying recoverable generated values. Replace active form's draft/generation controls with one Add opportunity submit and optional manual completion. Normalize multipart source snapshot without treating it as approval. Update active action to pipeline, remove unused generation action and wording. Update docs/artifacts explicitly superseding earlier approval requirement. Verify zero records on failure/missing fields, single successful record + formatted source, hydrated one-step create/manual recovery/edit/delete at desktop/narrow. One existing different-model high reviewer only; preserve unrelated dirty tree.

## Approved extraction correction — 2026-10-05

User reports missing role for the Arch posting despite explicit “We are seeking a highly skilled backend developer to join our team.” Extend the direct-creation acceptance criteria: given this full posting or its formatted equivalent and a valid AI response omitting the role/company or supplying an incomplete excerpt, when adding, recover the unique explicitly stated role and standalone corporate footer from the original source and save Backend Developer / Arch Global Services (Philippines) Inc. Given conflicting roles/employers, retain blank fields and request completion. Preserve unsupported optional blanks, full source transport, instruction rejection and zero records on AI failure. This supersedes dependence on model-proposed identity fields, not source-only grounding. Update shared extraction/prompt, regression fixtures and documentation; verify complete source reaches the gateway and direct persistence succeeds with omitted AI identity.

## Implementation and verification evidence — 2026-10-05

Implemented direct Add action via create-formatted-opportunity.ts; server formats/validates/saves and redirects to details outside the error catch. Removed generation-only action and review-stage UI. Required-field completion preserves values, failed AI creates no record, manual save bypasses AI and formats original source. Pending fields are disabled. Source snapshots normalize multipart line endings while preserving original pasted bytes. Prepared-source identity plus edited-field tracking discards stale generated values and hidden requirements after source edits, retaining explicitly typed corrections.

Identity correction shares conservative contextual extraction with validation. Prompt now recognizes explicit hiring prose and corporate footers rather than limiting identity to labels/headings. Missing/rejected AI identity is recovered only from a unique explicit source candidate. Modifier normalization and rejection of hiring prose/corporate calls to action address both reviewer P2 findings. Original source and formatted source regressions replay omitted/null identity and incomplete excerpts through the real gateway/generator/direct SQLite create path. URL is never retrieved.

Verification: 340/340 npm tests passed (loopback tests require sandbox escalation); npm run typecheck, scoped ESLint and production build passed. Actual hydrated React form at 1280/320 passed single Add submission, pending locks, no approval UI, preserved failures, manual recovery and required-field completion. Actual isolated Next/SQLite at 1280/320 passed no record on unavailable AI, manual Add persists once, original bytes retained, formatted content stored, edit persistence, Cancel and physical Delete without typed confirmation. Temporary server stopped after checks. A prior live run failed while build output was being replaced; restarting against the completed build passed both widths.

Actual LM Studio google/gemma-4-e4b request with complete public Arch fixture passed: Backend Developer, Arch Global Services (Philippines) Inc., location blank; 3,694 source characters sent and 3,708 formatted characters retained. Domain tests additionally cover the formatted-equivalent source. This verifies this posting; no blanket model-quality claim. README, PRD addendum and UX behavior artifact synchronized. Unrelated dirty files preserved; no commit created.

Final reviewer correction: standalone corporate-looking text alone cannot anchor missing-company recovery because “Explore Acme Inc.” could be a CTA. Require an explicit employer label or recognized numeric corporate footer for that fallback; retain all contextual corporate candidates for conflict detection. This conservative narrowing preserves the supplied Arch original/formatted examples and requests manual completion for unanchored names.

Company anchoring also applies to AI-proposed values, not only fallback. Exact excerpts cannot establish an employer from unanchored CTA prose. Regression covers both paths and retains unanchored corporate candidates solely to reject conflicts.

## Final review disposition

One existing different-model high reviewer (/root/epic16_review, GPT-6 Luna) reviewed the implementation. Fixed stale source-derived manual fields, overbroad role phrases, CTA company fallback and the parallel AI-company validation gap; all findings addressed. Reviewer confirms no remaining actionable issue in this fix. Final verification after the last grounding change: 340/340 tests, typecheck, scoped lint and production build passed. Completed; no further draft approval step required.
