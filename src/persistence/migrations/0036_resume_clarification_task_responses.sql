CREATE TABLE resume_clarification_task_responses (
  id TEXT PRIMARY KEY CHECK (id GLOB '????????-????-7???-[89ab]???-????????????'),
  workspace_id TEXT NOT NULL REFERENCES resume_workspaces(id) ON DELETE CASCADE,
  task_id TEXT NOT NULL UNIQUE REFERENCES resume_clarification_tasks(id) ON DELETE CASCADE,
  disposition TEXT NOT NULL CHECK (disposition IN ('answered', 'skipped')),
  answer_text TEXT CHECK (answer_text IS NULL OR length(answer_text) BETWEEN 1 AND 2400),
  created_at TEXT NOT NULL,
  CHECK ((disposition = 'answered' AND answer_text IS NOT NULL) OR (disposition = 'skipped' AND answer_text IS NULL))
);
CREATE INDEX resume_clarification_task_responses_workspace_index ON resume_clarification_task_responses(workspace_id, created_at, id);
