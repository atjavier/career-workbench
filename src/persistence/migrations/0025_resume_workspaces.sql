CREATE TABLE resume_workspaces (
  id TEXT PRIMARY KEY CHECK (id GLOB '????????-????-7???-[89ab]???-????????????'),
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
  active_profile_revision_id TEXT REFERENCES candidate_profile_revisions(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE resume_workspace_state (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  active_workspace_id TEXT REFERENCES resume_workspaces(id),
  revision_number INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);
INSERT INTO resume_workspace_state (singleton, active_workspace_id, revision_number, updated_at) VALUES (1, NULL, 0, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
CREATE INDEX resume_workspaces_updated_index ON resume_workspaces(updated_at DESC);

-- Workspace ownership is deliberately kept in join tables.  The historic resume
-- tables remain append-only and a record can therefore never be silently moved
-- from one resume to another.
CREATE TABLE resume_workspace_profiles (
  workspace_id TEXT NOT NULL REFERENCES resume_workspaces(id) ON DELETE CASCADE,
  profile_id TEXT NOT NULL UNIQUE REFERENCES candidate_profiles(id),
  PRIMARY KEY (workspace_id, profile_id)
);
CREATE TABLE resume_workspace_evidence (
  workspace_id TEXT NOT NULL REFERENCES resume_workspaces(id) ON DELETE CASCADE,
  evidence_id TEXT NOT NULL UNIQUE REFERENCES evidence_records(id),
  PRIMARY KEY (workspace_id, evidence_id)
);
CREATE TABLE resume_workspace_imports (
  workspace_id TEXT NOT NULL REFERENCES resume_workspaces(id) ON DELETE CASCADE,
  import_id TEXT NOT NULL UNIQUE REFERENCES evidence_library_imports(id),
  PRIMARY KEY (workspace_id, import_id)
);
CREATE TABLE resume_workspace_drafts (
  workspace_id TEXT NOT NULL REFERENCES resume_workspaces(id) ON DELETE CASCADE,
  draft_id TEXT NOT NULL UNIQUE REFERENCES material_drafts(id),
  PRIMARY KEY (workspace_id, draft_id)
);
CREATE TABLE resume_workspace_deletion_audit (
  id TEXT PRIMARY KEY CHECK (id GLOB '????????-????-7???-[89ab]???-????????????'),
  workspace_id TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('success', 'not_found', 'stale')),
  reclaimed_bytes INTEGER NOT NULL DEFAULT 0 CHECK (reclaimed_bytes >= 0)
);
CREATE INDEX resume_workspace_evidence_workspace_index ON resume_workspace_evidence(workspace_id);
CREATE INDEX resume_workspace_imports_workspace_index ON resume_workspace_imports(workspace_id);
CREATE INDEX resume_workspace_drafts_workspace_index ON resume_workspace_drafts(workspace_id);
