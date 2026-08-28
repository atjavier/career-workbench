CREATE TABLE IF NOT EXISTS resume_workspace_profiles (
  workspace_id TEXT NOT NULL REFERENCES resume_workspaces(id) ON DELETE CASCADE,
  profile_id TEXT NOT NULL UNIQUE REFERENCES candidate_profiles(id),
  PRIMARY KEY (workspace_id, profile_id)
);
CREATE TABLE IF NOT EXISTS resume_workspace_evidence (
  workspace_id TEXT NOT NULL REFERENCES resume_workspaces(id) ON DELETE CASCADE,
  evidence_id TEXT NOT NULL UNIQUE REFERENCES evidence_records(id),
  PRIMARY KEY (workspace_id, evidence_id)
);
CREATE TABLE IF NOT EXISTS resume_workspace_imports (
  workspace_id TEXT NOT NULL REFERENCES resume_workspaces(id) ON DELETE CASCADE,
  import_id TEXT NOT NULL UNIQUE REFERENCES evidence_library_imports(id),
  PRIMARY KEY (workspace_id, import_id)
);
CREATE TABLE IF NOT EXISTS resume_workspace_drafts (
  workspace_id TEXT NOT NULL REFERENCES resume_workspaces(id) ON DELETE CASCADE,
  draft_id TEXT NOT NULL UNIQUE REFERENCES material_drafts(id),
  PRIMARY KEY (workspace_id, draft_id)
);
CREATE TABLE IF NOT EXISTS resume_workspace_deletion_audit (
  id TEXT PRIMARY KEY CHECK (id GLOB '????????-????-7???-[89ab]???-????????????'),
  workspace_id TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('success', 'not_found', 'stale')),
  reclaimed_bytes INTEGER NOT NULL DEFAULT 0 CHECK (reclaimed_bytes >= 0)
);
CREATE INDEX IF NOT EXISTS resume_workspace_evidence_workspace_index ON resume_workspace_evidence(workspace_id);
CREATE INDEX IF NOT EXISTS resume_workspace_imports_workspace_index ON resume_workspace_imports(workspace_id);
CREATE INDEX IF NOT EXISTS resume_workspace_drafts_workspace_index ON resume_workspace_drafts(workspace_id);
