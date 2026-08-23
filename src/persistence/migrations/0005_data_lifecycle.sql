CREATE TABLE managed_artifacts (
  id TEXT PRIMARY KEY,
  artifact_kind TEXT NOT NULL CHECK (artifact_kind IN ('backup', 'activity_history_export')),
  lifecycle_state TEXT NOT NULL CHECK (lifecycle_state IN ('active', 'trashed', 'expired', 'permanently_deleted')),
  storage_location TEXT NOT NULL UNIQUE CHECK (storage_location NOT GLOB '/*' AND storage_location NOT GLOB '[A-Za-z]:*' AND storage_location NOT GLOB '*..*'),
  content_digest TEXT NOT NULL CHECK (length(content_digest) = 71 AND content_digest GLOB 'sha256:*' AND substr(content_digest, 8) NOT GLOB '*[^0-9a-f]*'),
  byte_size INTEGER NOT NULL CHECK (byte_size >= 0),
  local_revision INTEGER NOT NULL CHECK (local_revision > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  expires_at TEXT
);
CREATE TRIGGER managed_artifacts_base_resume_guard BEFORE INSERT ON managed_artifacts
WHEN NEW.storage_location LIKE 'base-resumes/%'
BEGIN SELECT RAISE(ABORT, 'base resume storage is not a managed artifact'); END;
CREATE TRIGGER audit_events_append_only_update BEFORE UPDATE ON audit_events BEGIN SELECT RAISE(ABORT, 'audit events are append-only'); END;
CREATE TRIGGER audit_events_append_only_delete BEFORE DELETE ON audit_events BEGIN SELECT RAISE(ABORT, 'audit events are append-only'); END;
