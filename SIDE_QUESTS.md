# Side Quests

## BMad-inspired Pi Subagent Authoring

**Status:** Deferred

Enhance the `pi-subagents` package's custom-agent creation flow so a rough agent idea is refined through a BMad-inspired design pass before it becomes a runnable Pi subagent.

### Goal

Create stronger Pi subagents by deriving their mission, consumer, persona, capability boundaries, memory needs, and routing metadata—not merely accepting a raw system prompt.

### Proposed shape

- Keep the current direct creation mode for users who already have a system prompt.
- Add a designed creation mode that conducts guided discovery and emits:
  - canonical agent-design artifact
  - generated Pi subagent profile (system prompt, model, tools, memory, acceptance role)
  - routing metadata for a future agent-selection layer
- Keep the BMad-inspired authoring pipeline native to `pi-subagents` rather than adding a runtime dependency on BMad.
- Treat automatic agent selection as a separate router concern: the parent Pi agent still decides whether to delegate; routing metadata makes that decision more consistent.

### Notes

- This is tooling work on the `pi-subagents` package, not a feature of the Resume application.
- Resume Architect and Resume Coach are application contracts; the proposed feature targets Pi development subagents.
