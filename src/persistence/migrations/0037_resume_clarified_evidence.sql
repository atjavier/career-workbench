CREATE TABLE resume_clarified_evidence (
  id TEXT PRIMARY KEY CHECK (id GLOB '????????-????-7???-[89ab]???-????????????'),
  workspace_id TEXT NOT NULL REFERENCES resume_workspaces(id) ON DELETE CASCADE,
  task_id TEXT NOT NULL UNIQUE REFERENCES resume_clarification_tasks(id) ON DELETE CASCADE,
  response_id TEXT NOT NULL UNIQUE REFERENCES resume_clarification_task_responses(id) ON DELETE CASCADE,
  item_key TEXT NOT NULL,
  item_name TEXT NOT NULL,
  item_category TEXT NOT NULL CHECK (item_category IN ('project', 'experience')),
  category TEXT NOT NULL CHECK (category IN ('purpose', 'ownership', 'users_workflow', 'outcome', 'metrics', 'deployment', 'collaboration', 'dates', 'role')),
  candidate_text TEXT NOT NULL CHECK (length(candidate_text) BETWEEN 1 AND 2400),
  provenance TEXT NOT NULL CHECK (provenance = 'candidate_interview_answer'),
  created_at TEXT NOT NULL
);
CREATE INDEX resume_clarified_evidence_workspace_item_index ON resume_clarified_evidence(workspace_id, item_key, created_at, id);

CREATE TABLE resume_clarified_evidence_conflicts (
  id TEXT PRIMARY KEY CHECK (id GLOB '????????-????-7???-[89ab]???-????????????'),
  workspace_id TEXT NOT NULL REFERENCES resume_workspaces(id) ON DELETE CASCADE,
  clarified_evidence_id TEXT NOT NULL REFERENCES resume_clarified_evidence(id) ON DELETE CASCADE,
  documented_interpretation_id TEXT NOT NULL REFERENCES resume_evidence_interpretations(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'needs_review' CHECK (status = 'needs_review'),
  created_at TEXT NOT NULL,
  UNIQUE (clarified_evidence_id, documented_interpretation_id)
);
CREATE INDEX resume_clarified_evidence_conflicts_workspace_index ON resume_clarified_evidence_conflicts(workspace_id, status, created_at, id);
