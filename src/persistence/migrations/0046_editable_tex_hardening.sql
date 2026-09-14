ALTER TABLE tex_draft_revisions
ADD COLUMN context_limit_tokens INTEGER CHECK (context_limit_tokens BETWEEN 12001 AND 30000);

DROP TRIGGER IF EXISTS tex_draft_revision_artifacts_immutable_update;
DROP TRIGGER IF EXISTS tex_draft_revision_artifacts_immutable_delete;
ALTER TABLE tex_draft_revision_artifacts RENAME TO tex_draft_revision_artifacts_legacy;

-- Provenance snapshots intentionally retain the opaque document id after live
-- evidence is deleted. Insert-time triggers below prove it was current and
-- workspace-owned when the immutable snapshot was created.
CREATE TABLE tex_draft_revision_artifacts (
  revision_id TEXT NOT NULL REFERENCES tex_draft_revisions(id) ON DELETE CASCADE,
  document_id TEXT NOT NULL,
  library_path TEXT NOT NULL CHECK (
    length(library_path) BETWEEN 1 AND 800
    AND library_path NOT GLOB '/*'
    AND library_path NOT GLOB '[A-Za-z]:*'
    AND library_path NOT GLOB '*\\*'
    AND library_path <> '.'
    AND library_path NOT LIKE './%'
    AND library_path NOT LIKE '%/./%'
    AND library_path NOT LIKE '%/.'
    AND library_path <> '..'
    AND library_path NOT LIKE '../%'
    AND library_path NOT LIKE '%/../%'
    AND library_path NOT LIKE '%/..'
  ),
  content_digest TEXT NOT NULL CHECK (
    length(content_digest) = 71
    AND content_digest GLOB 'sha256:*'
    AND substr(content_digest, 8) NOT GLOB '*[^0-9a-f]*'
  ),
  PRIMARY KEY (revision_id, document_id)
);

INSERT INTO tex_draft_revision_artifacts
  (revision_id, document_id, library_path, content_digest)
SELECT revision_id, document_id, library_path, content_digest
FROM tex_draft_revision_artifacts_legacy;
DROP TABLE tex_draft_revision_artifacts_legacy;

CREATE TRIGGER tex_draft_revision_artifacts_provenance
BEFORE INSERT ON tex_draft_revision_artifacts
WHEN NOT EXISTS (
  SELECT 1
  FROM tex_draft_revisions r
  JOIN tex_drafts t ON t.id = r.draft_id
  JOIN evidence_library_documents d
    ON d.id = NEW.document_id
   AND d.library_path = NEW.library_path
   AND d.content_digest = NEW.content_digest
  JOIN evidence_library_imports i ON i.id = d.import_id
  JOIN resume_workspace_imports w
    ON w.import_id = i.id
   AND w.workspace_id = t.workspace_id
  WHERE r.id = NEW.revision_id
)
BEGIN
  SELECT RAISE(ABORT, 'tex draft artifact provenance must match a workspace-owned document');
END;

CREATE TRIGGER tex_draft_revision_artifacts_immutable_update
BEFORE UPDATE ON tex_draft_revision_artifacts
BEGIN SELECT RAISE(ABORT, 'tex draft artifact snapshots are immutable'); END;
CREATE TRIGGER tex_draft_revision_artifacts_immutable_delete
BEFORE DELETE ON tex_draft_revision_artifacts
BEGIN SELECT RAISE(ABORT, 'tex draft artifact snapshots are immutable'); END;

CREATE TRIGGER local_model_context_limits_immutable_update
BEFORE UPDATE ON local_model_configuration_context_limits
BEGIN SELECT RAISE(ABORT, 'local model context limits are immutable'); END;
CREATE TRIGGER local_model_context_limits_immutable_delete
BEFORE DELETE ON local_model_configuration_context_limits
BEGIN SELECT RAISE(ABORT, 'local model context limits are immutable'); END;

CREATE TRIGGER tex_draft_revision_context_snapshot
BEFORE INSERT ON tex_draft_revisions
WHEN NEW.context_limit_tokens IS NULL
  OR NOT EXISTS (
    SELECT 1 FROM local_model_configuration_context_limits c
    WHERE c.configuration_id = NEW.model_configuration_id
      AND c.context_limit_tokens = NEW.context_limit_tokens
  )
BEGIN
  SELECT RAISE(ABORT, 'tex draft context limit must match its model configuration');
END;

CREATE TABLE tex_private_cleanup_queue (
  id TEXT PRIMARY KEY CHECK (id GLOB '????????-????-7???-[89ab]???-????????????'),
  relative_path TEXT NOT NULL UNIQUE CHECK (
    length(relative_path) BETWEEN 1 AND 800
    AND relative_path NOT GLOB '/*'
    AND relative_path NOT GLOB '[A-Za-z]:*'
    AND relative_path NOT GLOB '*\\*'
    AND relative_path <> '.'
    AND relative_path NOT LIKE './%'
    AND relative_path NOT LIKE '%/./%'
    AND relative_path NOT LIKE '%/.'
    AND relative_path <> '..'
    AND relative_path NOT LIKE '../%'
    AND relative_path NOT LIKE '%/../%'
    AND relative_path NOT LIKE '%/..'
  ),
  created_at TEXT NOT NULL,
  last_attempt_at TEXT
);
