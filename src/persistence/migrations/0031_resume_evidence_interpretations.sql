CREATE TABLE resume_evidence_interpretations (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES resume_workspaces(id) ON DELETE CASCADE,
  item_key TEXT NOT NULL,
  item_name TEXT NOT NULL,
  item_category TEXT NOT NULL CHECK (item_category IN ('project', 'experience')),
  kind TEXT NOT NULL CHECK (kind IN ('direct_fact', 'capability', 'context', 'unknown')),
  content TEXT NOT NULL CHECK (length(content) BETWEEN 1 AND 4000),
  evidence_document_path TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (workspace_id, item_key, kind, content)
);
CREATE TABLE resume_clarification_tasks (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES resume_workspaces(id) ON DELETE CASCADE,
  item_key TEXT NOT NULL,
  item_name TEXT NOT NULL,
  item_category TEXT NOT NULL CHECK (item_category IN ('project', 'experience')),
  category TEXT NOT NULL CHECK (category IN ('purpose', 'ownership', 'users_workflow', 'outcome', 'metrics', 'deployment', 'collaboration', 'dates', 'role')),
  question TEXT NOT NULL CHECK (length(question) BETWEEN 1 AND 600),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'answered', 'skipped')),
  created_at TEXT NOT NULL,
  UNIQUE (workspace_id, item_key, category)
);
