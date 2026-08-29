CREATE TABLE resume_interview_turns (
  id TEXT PRIMARY KEY CHECK (id GLOB '????????-????-7???-[89ab]???-????????????'),
  workspace_id TEXT NOT NULL REFERENCES resume_workspaces(id) ON DELETE CASCADE,
  task_id TEXT NOT NULL REFERENCES resume_clarification_tasks(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role = 'coach'),
  content TEXT NOT NULL CHECK (length(content) BETWEEN 1 AND 1800),
  created_at TEXT NOT NULL
);
CREATE INDEX resume_interview_turns_workspace_task_index ON resume_interview_turns(workspace_id, task_id, created_at, id);
