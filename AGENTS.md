<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project Architectural Guidelines

## Component-Driven Development
When building or improving application UI:
- Before implementing UI, inspect `src/components` and relevant usages to understand which components already exist, their props, variants, and interaction patterns.
- Start with small, reusable components with explicit props and clear responsibilities; compose pages from them.
- Use existing components whenever they meet the need. Extend a compatible component with a focused prop or variant before creating a competing implementation, and reuse theme tokens.
- Separate presentation and interaction from domain rules, persistence, and AI orchestration. Keep server/client boundaries explicit.
- When an element or interaction is used repeatedly, extract it into a reusable component and migrate the repeated usages to it. This includes forms, fields, cards, action rows, dialogs, and states; avoid abstractions with only speculative uses.
- Build accessible loading, empty, error, success, and disabled states into each interactive component.
- Keep UI focused on usable features. Avoid roadmap cards, decorative eyebrow labels, and speculative feature copy. Use concise, truthful empty states, progress/success/error messages, and relevant next-step links so users understand the current state and can continue their task.
- Apply HCI principles: use task-oriented labels, distinguish reviewing from saving, show system status, preserve entered values on failure, and provide actionable recovery or navigation.
- Use the BMAD framework for implementation work and keep affected docs and planning/implementation artifacts synchronized with behavior and verification evidence. Record recommendations separately from approved changes, and distinguish implemented CRUD from unavailable application tracking.
- Record feature and refactor decisions when they are discussed: label proposals as proposed, user-approved decisions as approved, and changes as implemented only after verification. Before implementation, update affected BMAD requirements and acceptance criteria; after implementation, synchronize user docs and record verification evidence. Explicitly identify which earlier decisions a scope change supersedes.
- Verify components in context at desktop and narrow widths, and test meaningful user behavior and domain boundaries. For changed creation/edit flows, exercise the actual hydrated form with isolated data; source assertions or static layout checks do not establish that submitted data and follow-up fields are visible.

## Dynamic AI Personas for Evidence (No Static Categories)
When working on the Evidence Library, Resume Generation, or Clarification Prompts:
- **Do not** use or enforce legacy rigid categories (`purpose`, `ownership`, `users_workflow`, etc.).
- **Do** use dynamic, AI-generated category strings (2-3 words) based on missing context.
- **Do** prompt the AI to adopt a **Persona**:
  - **Engineering Manager** for Experiences (Jobs).
  - **Principal/Staff Engineer** for Projects.
- Ensure all schemas, DB tables, and UIs treat `category` as a flexible string.

## Agent Execution Autonomy (Command Permissions)
All AI agents and subagents operating in this repository are EXPLICITLY AUTHORIZED and expected to proactively run the following commands WITHOUT halting to ask the user for permission:
1. **BMAD Framework Commands**: All repetitive commands required when using a BMAD skill (e.g., `uv run`, `memlog.py` appending, and artifact generation commands).
2. **Standard Verification & Source Control**:
   - `git diff`, `git status`, and `git grep`
   - `npm run typecheck` (or equivalent typechecking)
   - `npm test` (or equivalent testing)
   - `npm run build` (or equivalent build steps)
Do not ask for permission to verify your work. Run these commands autonomously as part of your execution loop.
