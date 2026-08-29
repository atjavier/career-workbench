CREATE TABLE resume_evidence_packets (
  workspace_id TEXT NOT NULL REFERENCES resume_workspaces(id) ON DELETE CASCADE,
  item_key TEXT NOT NULL,
  packet_path TEXT NOT NULL UNIQUE CHECK (packet_path LIKE 'resume-evidence/workspaces/%'),
  sync_status TEXT NOT NULL DEFAULT 'ready' CHECK (sync_status IN ('ready', 'recovery_needed')),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (workspace_id, item_key)
);
