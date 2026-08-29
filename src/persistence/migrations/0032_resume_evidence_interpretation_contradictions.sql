ALTER TABLE resume_evidence_interpretations RENAME TO resume_evidence_interpretations_previous;

CREATE TABLE resume_evidence_interpretations (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES resume_workspaces(id) ON DELETE CASCADE,
  item_key TEXT NOT NULL,
  item_name TEXT NOT NULL,
  item_category TEXT NOT NULL CHECK (item_category IN ('project', 'experience')),
  kind TEXT NOT NULL CHECK (kind IN ('direct_fact', 'capability', 'context', 'unknown', 'contradiction')),
  content TEXT NOT NULL CHECK (length(content) BETWEEN 1 AND 4000),
  evidence_document_path TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (workspace_id, item_key, kind, content)
);

INSERT INTO resume_evidence_interpretations (id, workspace_id, item_key, item_name, item_category, kind, content, evidence_document_path, created_at)
SELECT id, workspace_id, item_key, item_name, item_category, kind, content, evidence_document_path, created_at
FROM resume_evidence_interpretations_previous;

DROP TABLE resume_evidence_interpretations_previous;
