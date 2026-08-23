CREATE TABLE evidence_records (id TEXT PRIMARY KEY, created_at TEXT NOT NULL);
CREATE TABLE evidence_revisions (
  id TEXT PRIMARY KEY,
  evidence_id TEXT NOT NULL REFERENCES evidence_records(id),
  revision_number INTEGER NOT NULL CHECK (revision_number > 0),
  origin TEXT NOT NULL CHECK (origin IN ('extracted', 'user_entered')),
  source_base_resume_id TEXT REFERENCES base_resumes(id),
  source_document TEXT NOT NULL,
  source_section TEXT NOT NULL,
  factual_text TEXT NOT NULL CHECK (length(trim(factual_text)) > 0),
  review_state TEXT NOT NULL CHECK (review_state IN ('unreviewed', 'approved', 'rejected', 'removed')),
  supersedes_revision_id TEXT UNIQUE REFERENCES evidence_revisions(id),
  created_at TEXT NOT NULL,
  content_digest TEXT NOT NULL CHECK (length(content_digest) = 71 AND content_digest GLOB 'sha256:*' AND substr(content_digest, 8) NOT GLOB '*[^0-9a-f]*'),
  UNIQUE (evidence_id, revision_number)
);
CREATE TRIGGER evidence_records_immutable_update BEFORE UPDATE ON evidence_records BEGIN SELECT RAISE(ABORT, 'evidence records are immutable'); END;
CREATE TRIGGER evidence_records_immutable_delete BEFORE DELETE ON evidence_records BEGIN SELECT RAISE(ABORT, 'evidence records are immutable'); END;
CREATE TRIGGER evidence_revisions_immutable_update BEFORE UPDATE ON evidence_revisions BEGIN SELECT RAISE(ABORT, 'evidence revisions are immutable'); END;
CREATE TRIGGER evidence_revisions_immutable_delete BEFORE DELETE ON evidence_revisions BEGIN SELECT RAISE(ABORT, 'evidence revisions are immutable'); END;
CREATE TRIGGER evidence_revision_lineage BEFORE INSERT ON evidence_revisions
WHEN NEW.supersedes_revision_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM evidence_revisions p WHERE p.id = NEW.supersedes_revision_id AND p.evidence_id = NEW.evidence_id AND NEW.revision_number = p.revision_number + 1)
BEGIN SELECT RAISE(ABORT, 'evidence revision lineage must be linear'); END;
CREATE UNIQUE INDEX evidence_one_root_revision ON evidence_revisions(evidence_id) WHERE supersedes_revision_id IS NULL;
