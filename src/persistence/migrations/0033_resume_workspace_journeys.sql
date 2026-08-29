CREATE TABLE resume_workspace_journeys (
  id TEXT PRIMARY KEY CHECK (id GLOB '????????-????-7???-[89ab]???-????????????'),
  workspace_id TEXT NOT NULL UNIQUE REFERENCES resume_workspaces(id) ON DELETE CASCADE,
  phase TEXT NOT NULL CHECK (phase IN ('onboarding', 'documenting', 'interview', 'ready_to_generate', 'ready_for_preview', 'recovery')),
  next_action TEXT NOT NULL CHECK (next_action IN ('complete_profile', 'wait_for_documentation', 'answer_clarifications', 'generate_resume', 'view_resume', 'recover')),
  message TEXT NOT NULL CHECK (length(message) BETWEEN 1 AND 600),
  state_revision INTEGER NOT NULL DEFAULT 1 CHECK (state_revision > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX resume_workspace_journeys_phase_index ON resume_workspace_journeys(phase, updated_at DESC);
