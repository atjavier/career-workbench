CREATE TABLE tex_drafts (
  id TEXT PRIMARY KEY CHECK (id GLOB '????????-????-7???-[89ab]???-????????????'),
  workspace_id TEXT NOT NULL REFERENCES resume_workspaces(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL CHECK (length(trim(display_name)) BETWEEN 1 AND 120),
  storage_location TEXT NOT NULL UNIQUE CHECK (storage_location LIKE 'tex-drafts/%' AND storage_location NOT GLOB '/*' AND storage_location NOT GLOB '[A-Za-z]:*' AND storage_location NOT GLOB '*..*'),
  baseline_id TEXT NOT NULL REFERENCES base_resumes(id),
  baseline_digest TEXT NOT NULL CHECK (length(baseline_digest) = 71 AND baseline_digest GLOB 'sha256:*' AND substr(baseline_digest, 8) NOT GLOB '*[^0-9a-f]*'),
  created_at TEXT NOT NULL
);

CREATE TABLE tex_draft_revisions (
  id TEXT PRIMARY KEY CHECK (id GLOB '????????-????-7???-[89ab]???-????????????'),
  draft_id TEXT NOT NULL REFERENCES tex_drafts(id) ON DELETE CASCADE,
  revision_number INTEGER NOT NULL CHECK (revision_number > 0),
  source_location TEXT NOT NULL UNIQUE CHECK (source_location LIKE 'tex-drafts/%' AND source_location NOT GLOB '/*' AND source_location NOT GLOB '[A-Za-z]:*' AND source_location NOT GLOB '*..*'),
  pdf_location TEXT NOT NULL UNIQUE CHECK (pdf_location LIKE 'tex-drafts/%' AND pdf_location NOT GLOB '/*' AND pdf_location NOT GLOB '[A-Za-z]:*' AND pdf_location NOT GLOB '*..*'),
  source_digest TEXT NOT NULL CHECK (length(source_digest) = 71 AND source_digest GLOB 'sha256:*' AND substr(source_digest, 8) NOT GLOB '*[^0-9a-f]*'),
  pdf_digest TEXT NOT NULL CHECK (length(pdf_digest) = 71 AND pdf_digest GLOB 'sha256:*' AND substr(pdf_digest, 8) NOT GLOB '*[^0-9a-f]*'),
  baseline_id TEXT NOT NULL REFERENCES base_resumes(id),
  baseline_digest TEXT NOT NULL CHECK (length(baseline_digest) = 71 AND baseline_digest GLOB 'sha256:*' AND substr(baseline_digest, 8) NOT GLOB '*[^0-9a-f]*'),
  artifact_snapshot_digest TEXT NOT NULL CHECK (length(artifact_snapshot_digest) = 71 AND artifact_snapshot_digest GLOB 'sha256:*' AND substr(artifact_snapshot_digest, 8) NOT GLOB '*[^0-9a-f]*'),
  model_configuration_id TEXT NOT NULL REFERENCES local_model_configuration_revisions(id),
  model_configuration_digest TEXT NOT NULL CHECK (length(model_configuration_digest) = 71 AND model_configuration_digest GLOB 'sha256:*' AND substr(model_configuration_digest, 8) NOT GLOB '*[^0-9a-f]*'),
  consent_fingerprint TEXT NOT NULL CHECK (length(consent_fingerprint) = 71 AND consent_fingerprint GLOB 'sha256:*' AND substr(consent_fingerprint, 8) NOT GLOB '*[^0-9a-f]*'),
  created_at TEXT NOT NULL,
  UNIQUE (draft_id, revision_number)
);

CREATE TABLE tex_draft_revision_artifacts (
  revision_id TEXT NOT NULL REFERENCES tex_draft_revisions(id) ON DELETE CASCADE,
  document_id TEXT NOT NULL REFERENCES evidence_library_documents(id),
  library_path TEXT NOT NULL CHECK (library_path NOT GLOB '/*' AND library_path NOT GLOB '[A-Za-z]:*' AND library_path NOT GLOB '*..*'),
  content_digest TEXT NOT NULL CHECK (length(content_digest) = 71 AND content_digest GLOB 'sha256:*' AND substr(content_digest, 8) NOT GLOB '*[^0-9a-f]*'),
  PRIMARY KEY (revision_id, document_id)
);

CREATE INDEX tex_drafts_workspace_created_idx ON tex_drafts(workspace_id, created_at DESC);
CREATE INDEX tex_draft_revisions_draft_created_idx ON tex_draft_revisions(draft_id, created_at DESC);

CREATE TRIGGER tex_drafts_immutable_update BEFORE UPDATE ON tex_drafts BEGIN SELECT RAISE(ABORT, 'tex drafts are immutable'); END;
CREATE TRIGGER tex_drafts_immutable_delete BEFORE DELETE ON tex_drafts BEGIN SELECT RAISE(ABORT, 'tex drafts are immutable'); END;
CREATE TRIGGER tex_draft_revisions_immutable_update BEFORE UPDATE ON tex_draft_revisions BEGIN SELECT RAISE(ABORT, 'tex draft revisions are immutable'); END;
CREATE TRIGGER tex_draft_revisions_immutable_delete BEFORE DELETE ON tex_draft_revisions BEGIN SELECT RAISE(ABORT, 'tex draft revisions are immutable'); END;
CREATE TRIGGER tex_draft_revision_artifacts_immutable_update BEFORE UPDATE ON tex_draft_revision_artifacts BEGIN SELECT RAISE(ABORT, 'tex draft artifact snapshots are immutable'); END;
CREATE TRIGGER tex_draft_revision_artifacts_immutable_delete BEFORE DELETE ON tex_draft_revision_artifacts BEGIN SELECT RAISE(ABORT, 'tex draft artifact snapshots are immutable'); END;

CREATE TRIGGER tex_drafts_baseline_snapshot BEFORE INSERT ON tex_drafts
WHEN NOT EXISTS (SELECT 1 FROM base_resumes WHERE id = NEW.baseline_id AND primary_digest = NEW.baseline_digest)
BEGIN SELECT RAISE(ABORT, 'tex draft baseline snapshot must match imported baseline'); END;

CREATE TRIGGER tex_draft_revisions_baseline_snapshot BEFORE INSERT ON tex_draft_revisions
WHEN NOT EXISTS (SELECT 1 FROM base_resumes WHERE id = NEW.baseline_id AND primary_digest = NEW.baseline_digest)
  OR NOT EXISTS (SELECT 1 FROM tex_drafts WHERE id = NEW.draft_id AND baseline_id = NEW.baseline_id AND baseline_digest = NEW.baseline_digest)
  OR NOT EXISTS (SELECT 1 FROM local_model_configuration_revisions WHERE id = NEW.model_configuration_id AND configuration_digest = NEW.model_configuration_digest)
BEGIN SELECT RAISE(ABORT, 'tex draft revision snapshots must match immutable sources'); END;
