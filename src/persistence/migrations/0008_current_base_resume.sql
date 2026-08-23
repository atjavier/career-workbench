CREATE TABLE current_base_resume_sources (
  id TEXT PRIMARY KEY CHECK (length(id) = 36),
  filename TEXT NOT NULL CHECK (filename NOT GLOB '*[\\/:]*' AND length(filename) BETWEEN 1 AND 255),
  content_digest TEXT NOT NULL UNIQUE CHECK (length(content_digest) = 71 AND content_digest GLOB 'sha256:*' AND substr(content_digest, 8) NOT GLOB '*[^0-9a-f]*'),
  byte_size INTEGER NOT NULL CHECK (byte_size > 0 AND byte_size <= 10485760),
  storage_location TEXT NOT NULL UNIQUE CHECK (storage_location LIKE 'current-base-resumes/%' AND storage_location NOT GLOB '/*' AND storage_location NOT GLOB '[A-Za-z]:*' AND storage_location NOT GLOB '*..*'),
  imported_at TEXT NOT NULL
);
CREATE TABLE current_base_resume_drafts (
  id TEXT PRIMARY KEY CHECK (length(id) = 36),
  source_id TEXT NOT NULL REFERENCES current_base_resume_sources(id),
  parent_draft_id TEXT REFERENCES current_base_resume_drafts(id),
  revision_number INTEGER NOT NULL CHECK (revision_number > 0),
  content_json TEXT NOT NULL CHECK (length(content_json) > 1),
  content_digest TEXT NOT NULL CHECK (length(content_digest) = 71 AND content_digest GLOB 'sha256:*' AND substr(content_digest, 8) NOT GLOB '*[^0-9a-f]*'),
  created_at TEXT NOT NULL,
  UNIQUE (source_id, revision_number)
);
CREATE TABLE current_base_resume_proposals (
  id TEXT PRIMARY KEY CHECK (length(id) = 36),
  draft_id TEXT NOT NULL REFERENCES current_base_resume_drafts(id),
  evidence_revision_id TEXT NOT NULL REFERENCES evidence_revisions(id),
  kind TEXT NOT NULL CHECK (kind IN ('addition', 'replacement')),
  proposed_text TEXT NOT NULL,
  content_digest TEXT NOT NULL CHECK (length(content_digest) = 71 AND content_digest GLOB 'sha256:*' AND substr(content_digest, 8) NOT GLOB '*[^0-9a-f]*'),
  created_at TEXT NOT NULL,
  UNIQUE (draft_id, evidence_revision_id, kind)
);
CREATE TABLE current_base_resume_proposal_revisions (
  id TEXT PRIMARY KEY CHECK (length(id) = 36),
  proposal_id TEXT NOT NULL REFERENCES current_base_resume_proposals(id),
  revision_number INTEGER NOT NULL CHECK (revision_number > 0),
  decision TEXT NOT NULL CHECK (decision IN ('open', 'approved', 'edited', 'rejected')),
  resolved_text TEXT,
  parent_revision_id TEXT REFERENCES current_base_resume_proposal_revisions(id),
  created_at TEXT NOT NULL,
  UNIQUE (proposal_id, revision_number)
);
CREATE TABLE current_base_resume_versions (
  id TEXT PRIMARY KEY CHECK (length(id) = 36),
  source_id TEXT NOT NULL REFERENCES current_base_resume_sources(id),
  draft_id TEXT NOT NULL REFERENCES current_base_resume_drafts(id),
  approved_at TEXT NOT NULL,
  content_digest TEXT NOT NULL CHECK (length(content_digest) = 71 AND content_digest GLOB 'sha256:*' AND substr(content_digest, 8) NOT GLOB '*[^0-9a-f]*'),
  UNIQUE (draft_id)
);
CREATE TABLE current_base_resume_version_evidence_support (
  version_id TEXT NOT NULL REFERENCES current_base_resume_versions(id),
  evidence_revision_id TEXT NOT NULL REFERENCES evidence_revisions(id),
  PRIMARY KEY (version_id, evidence_revision_id)
);
CREATE TRIGGER current_base_resume_sources_immutable_update BEFORE UPDATE ON current_base_resume_sources BEGIN SELECT RAISE(ABORT, 'current resume sources are immutable'); END;
CREATE TRIGGER current_base_resume_sources_immutable_delete BEFORE DELETE ON current_base_resume_sources BEGIN SELECT RAISE(ABORT, 'current resume sources are immutable'); END;
CREATE TRIGGER current_base_resume_drafts_immutable_update BEFORE UPDATE ON current_base_resume_drafts BEGIN SELECT RAISE(ABORT, 'current resume drafts are immutable'); END;
CREATE TRIGGER current_base_resume_drafts_immutable_delete BEFORE DELETE ON current_base_resume_drafts BEGIN SELECT RAISE(ABORT, 'current resume drafts are immutable'); END;
CREATE TRIGGER current_base_resume_proposals_immutable_update BEFORE UPDATE ON current_base_resume_proposals BEGIN SELECT RAISE(ABORT, 'current resume proposals are immutable'); END;
CREATE TRIGGER current_base_resume_proposals_immutable_delete BEFORE DELETE ON current_base_resume_proposals BEGIN SELECT RAISE(ABORT, 'current resume proposals are immutable'); END;
CREATE TRIGGER current_base_resume_proposal_revisions_immutable_update BEFORE UPDATE ON current_base_resume_proposal_revisions BEGIN SELECT RAISE(ABORT, 'proposal revisions are immutable'); END;
CREATE TRIGGER current_base_resume_proposal_revisions_immutable_delete BEFORE DELETE ON current_base_resume_proposal_revisions BEGIN SELECT RAISE(ABORT, 'proposal revisions are immutable'); END;
CREATE TRIGGER current_base_resume_versions_immutable_update BEFORE UPDATE ON current_base_resume_versions BEGIN SELECT RAISE(ABORT, 'current resume versions are immutable'); END;
CREATE TRIGGER current_base_resume_versions_immutable_delete BEFORE DELETE ON current_base_resume_versions BEGIN SELECT RAISE(ABORT, 'current resume versions are immutable'); END;
CREATE TRIGGER current_base_resume_version_evidence_support_immutable_update BEFORE UPDATE ON current_base_resume_version_evidence_support BEGIN SELECT RAISE(ABORT, 'version evidence support is immutable'); END;
CREATE TRIGGER current_base_resume_version_evidence_support_immutable_delete BEFORE DELETE ON current_base_resume_version_evidence_support BEGIN SELECT RAISE(ABORT, 'version evidence support is immutable'); END;
