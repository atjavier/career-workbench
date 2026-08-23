CREATE TABLE evidence_library_candidates_preserved AS SELECT document_id, source_section, line_number, content_digest, evidence_revision_id FROM evidence_library_candidates;
DROP TABLE evidence_library_candidates;
CREATE TABLE evidence_library_documents_new (
  id TEXT PRIMARY KEY,
  import_id TEXT REFERENCES evidence_library_imports(id),
  category TEXT NOT NULL CHECK (category IN ('project', 'experience')),
  library_path TEXT NOT NULL CHECK (library_path NOT GLOB '/*' AND library_path NOT GLOB '[A-Za-z]:*' AND library_path LIKE 'resume-evidence/%'),
  content_digest TEXT NOT NULL CHECK (length(content_digest) = 71 AND content_digest GLOB 'sha256:*' AND substr(content_digest, 8) NOT GLOB '*[^0-9a-f]*'),
  imported_at TEXT NOT NULL
);
INSERT INTO evidence_library_documents_new SELECT id, import_id, category, library_path, content_digest, imported_at FROM evidence_library_documents;
DROP TABLE evidence_library_documents;
ALTER TABLE evidence_library_documents_new RENAME TO evidence_library_documents;
CREATE UNIQUE INDEX evidence_library_document_versions ON evidence_library_documents(library_path, content_digest);
CREATE TABLE evidence_library_candidates (
  document_id TEXT NOT NULL REFERENCES evidence_library_documents(id),
  source_section TEXT NOT NULL,
  line_number INTEGER NOT NULL CHECK (line_number > 0),
  content_digest TEXT NOT NULL CHECK (length(content_digest) = 71 AND content_digest GLOB 'sha256:*' AND substr(content_digest, 8) NOT GLOB '*[^0-9a-f]*'),
  evidence_revision_id TEXT NOT NULL REFERENCES evidence_revisions(id),
  PRIMARY KEY (document_id, source_section, line_number, content_digest),
  UNIQUE (evidence_revision_id)
);
INSERT INTO evidence_library_candidates SELECT document_id, source_section, line_number, content_digest, evidence_revision_id FROM evidence_library_candidates_preserved;
DROP TABLE evidence_library_candidates_preserved;
CREATE TRIGGER evidence_library_documents_immutable_update BEFORE UPDATE ON evidence_library_documents BEGIN SELECT RAISE(ABORT, 'library documents are immutable'); END;
CREATE TRIGGER evidence_library_documents_immutable_delete BEFORE DELETE ON evidence_library_documents BEGIN SELECT RAISE(ABORT, 'library documents are immutable'); END;
CREATE TRIGGER evidence_library_candidates_immutable_update BEFORE UPDATE ON evidence_library_candidates BEGIN SELECT RAISE(ABORT, 'library candidates are immutable'); END;
CREATE TRIGGER evidence_library_candidates_immutable_delete BEFORE DELETE ON evidence_library_candidates BEGIN SELECT RAISE(ABORT, 'library candidates are immutable'); END;
