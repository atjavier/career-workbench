CREATE TABLE IF NOT EXISTS resume_interview_candidate_turns (
  id TEXT PRIMARY KEY CHECK (id GLOB '????????-????-7???-[89ab]???-????????????'),
  workspace_id TEXT NOT NULL REFERENCES resume_workspaces(id) ON DELETE CASCADE,
  task_id TEXT NOT NULL REFERENCES resume_clarification_tasks(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (length(content) BETWEEN 1 AND 1200),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS resume_interview_candidate_turns_workspace_task_index ON resume_interview_candidate_turns(workspace_id, task_id, created_at, id);
