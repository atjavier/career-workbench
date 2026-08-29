CREATE TABLE resume_interview_stream_reservations (
  stream_request_id TEXT PRIMARY KEY CHECK (stream_request_id GLOB '????????-????-7???-[89ab]???-????????????'),
  workspace_id TEXT NOT NULL REFERENCES resume_workspaces(id) ON DELETE CASCADE,
  task_id TEXT NOT NULL REFERENCES resume_clarification_tasks(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('started', 'completed')),
  created_at TEXT NOT NULL
);
CREATE INDEX resume_interview_stream_reservations_workspace_task_index ON resume_interview_stream_reservations(workspace_id, task_id, status);
