# Application AI agents

Application agents live in `src/adapters/local-model`. Each agent is a stateless instruction definition sent to the configured local model; it is not a background worker or a Codex subagent. The application supplies the packet, validates returned data and owns persistence. Agents have no filesystem, shell, external browsing, database or runtime memory access.

## Job Opportunity Reader

`job-opportunity-reader-agent.ts` defines the full persona/card, mission, source relationships, JSON output and constraints. `requestJobOpportunityReader` in the local gateway sends the entire description through loopback LM Studio. `readJobOpportunity` coordinates validation and at most one focused retry for missing title/company, preserving accepted fields and the original formatting response. The URL never enters the model packet.

The reader interprets advertised role, hiring employer and optional metadata from arbitrary wording across the whole posting. It distinguishes vendor/client/agency names, legal notices and boilerplate from the opportunity's identity; ambiguous or unstated facts are null. It proposes description sections using source text rather than invented replacements.

`src/domain/opportunities/job-opportunity-reader-contract.ts` is ordinary application code. It checks JSON keys, field types and bounds, citation presence and value support, and complete-date validity. It has no role vocabulary, corporate suffix requirement, hiring-sentence parser or employer-meaning heuristic. It does not invoke AI. Legacy scalar responses use their own literal text as citation; object facts carry excerpts. Citation checks tolerate case and whitespace differences. A quote proves source traceability, not semantic correctness: attribution quality remains the reader's responsibility and must be measured with real-model evaluations.

`createFormattedOpportunity` is the save boundary. Only Add invokes it. Unavailable/malformed initial AI creates no record; the form retains the paste for retry. After a valid response and one focused retry, missing facts use the existing Unknown storage representation. No manual details form or extra approval appears. Users can deliberately edit saved details. The source-preserving formatter validates full source coverage and uses deterministic original-text organization if proposed sections are incomplete or unsupported; it never guesses identity.

## Resume agents

Evidence Analyst extracts supported findings, Strategist selects emphasis, Writer proposes evidence-backed edits, and Integrity Reviewer evaluates the host-reconstructed candidate. Coach/File/Architect instructions serve their existing workflows. `resume-agent-shared-instructions.ts` contains reusable Architect/Coach persona text in the adapter layer. Agent modules combine shared instructions with their own responsibilities before a model call.

`src/domain/resume-agent/resume-generation-stages.ts` contains stage types and structural validation helpers. `skill-registry.ts` describes permitted application capabilities and bounds. These are application definitions, not additional AI calls.

## Tailoring

Job Analyst, Resume Writer and Resume Integrity Reviewer in `job-tailoring-agents.ts` handle the selected saved opportunity and verified base-resume content. They do not create opportunities. One base resume and one replaceable tailored result per opportunity remain the MVP constraints.

## Clarification Planner

`resume-clarification-planner-agent.ts` defines the evidence-question persona. `requestClarificationPlan` sends the complete bounded facts/context/unknowns/answer packet to the selected local model through the shared stateless loopback transport. Experience uses an Engineering Manager; projects use a Principal/Staff Engineer. The model returns at most eight item-specific questions with newly generated two–three word category labels, or an empty task list when no material gaps remain. There is no fixed-category questionnaire or heuristic fallback.

`src/domain/resume-generation/clarification-plan.ts` validates shape, bounds, category length and duplicate categories. `src/application/resume-generation/resume-evidence-interpretation.ts` orchestrates the model call before opening a write transaction and rejects plans if the active workspace, source files, task state, answers, turns or reservations changed during planning. Answered/skipped tasks and in-progress interviews are preserved. Explicitly supplied role and dates are stored as candidate-provided context in managed documentation, not synthetic interview answers; the prompt treats them as known information unless the evidence conflicts.

If local AI fails, existing tasks and saved documents remain intact. **Read evidence again** on Experience & Projects or a failed intake retries only question planning, without importing the same folder again. A successful retry clears a planning-stage failure; it does not disguise a failed folder import as completed.

## Current boundaries

`src/application` contains adapter-consuming orchestration for evidence documentation, source refresh, opportunity reading/tailoring and resume workflows. Pure reader/tailoring/clarification contracts, shared material data types and stage definitions remain under `src/domain`. Existing persistence-owning domain commands remain valid; this is not a claim that every domain function is side-effect free. Domain modules no longer import concrete adapters or application services.

`local-model-gateway.ts` is a compatibility facade. Bounded transport and JSON handling live in `native-transport.ts` and `model-json.ts`; feature gateways own generation, file-agent work, interview, review, documentation, assessment, editable TeX and opportunities. Shared validation and composition have explicit modules, with an automated circular-dependency check. `src/app/actions` owns feature-specific Server Actions; `src/app/actions.ts` is a plain compatibility export barrel. The Server Action directive belongs to the implementation modules.

Forward migration `0049_flexible_clarification_categories` removes legacy category restrictions from installed databases while preserving table columns, rows, indexes, triggers and dependent history. It is atomic, checks foreign-key integrity and restores enforcement after success or rollback. Historical categories remain readable; new categories are flexible strings.

Production uses the generated standalone server, with copied CSS/JavaScript assets. npm launchers pin writable evidence to the original workspace through `CAREER_WORKBENCH_WORKSPACE_ROOT`. Packaged Electron uses a writable workspace under its user-data directory, independently of standalone runtime assets; an explicit environment override can select an existing evidence workspace. No existing evidence directories are deleted or moved by this change.
