# Application-Native Resume Agent

## Product intent

The resume-evidence agent operates inside the application. Its local LLM receives the approved registry in `src/domain/resume-agent/skill-registry.ts` and executes only the user-visible source-folder documentation skill. Skills are not CLI commands and do not require Codex or a developer session.

## Runtime boundary

- The agent may use only application-registered skills with typed inputs and structured outputs.
- Skill use occurs only after the app presents the relevant local-data scope and receives the user's consent.
- The app records the selected skill, returned result, evidence provenance, and unknowns in reviewable local state.
- The agent cannot invoke shells, local CLI skills, arbitrary files, network services, or unregistered tools.
- A response may present a proposed plan and result, but it cannot silently apply resume changes or turn unreviewed evidence into a claim.

## Candidate application skills

- Evidence documentation: derive review-only factual proposals from selected project material.
- Opportunity assessment: compare an explicitly selected opportunity with approved evidence and identify strengths, gaps, and unknowns.
- Resume refinement: turn approved evidence into role-relevant draft guidance using the evidence-first measurement and attribution rules.

## Current state

The application exposes these as bounded local workflows through the registry. There is no open-ended planner or tool-selection loop; only registered, typed skills may run. The existing `.agents/skills/resume-evidence-documenter/` directory remains development reference material, not a product runtime dependency.
