CREATE TABLE resume_interview_stream_reservations_v2 (
  stream_request_id TEXT PRIMARY KEY CHECK (stream_request_id GLOB '????????-????-[47]???-[89ab]???-????????????'),
  workspace_id TEXT NOT NULL REFERENCES resume_workspaces(id) ON DELETE CASCADE,
  task_id TEXT NOT NULL REFERENCES resume_clarification_tasks(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('started', 'completed')),
  created_at TEXT NOT NULL
);
INSERT INTO resume_interview_stream_reservations_v2 (stream_request_id, workspace_id, task_id, status, created_at)
SELECT stream_request_id, workspace_id, task_id, status, created_at
FROM resume_interview_stream_reservations;
DROP TABLE resume_interview_stream_reservations;
ALTER TABLE resume_interview_stream_reservations_v2 RENAME TO resume_interview_stream_reservations;
CREATE INDEX resume_interview_stream_reservations_workspace_task_index
  ON resume_interview_stream_reservations(workspace_id, task_id, status);
