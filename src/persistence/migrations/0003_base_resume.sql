CREATE TABLE base_resumes (
  id TEXT PRIMARY KEY,
  primary_filename TEXT NOT NULL,
  primary_digest TEXT NOT NULL UNIQUE CHECK (length(primary_digest) = 71 AND primary_digest GLOB 'sha256:*' AND substr(primary_digest, 8) NOT GLOB '*[^0-9a-f]*'),
  imported_at TEXT NOT NULL,
  storage_location TEXT NOT NULL UNIQUE CHECK (storage_location NOT GLOB '/*' AND storage_location NOT GLOB '[A-Za-z]:*' AND storage_location NOT GLOB '*..*')
);

CREATE TABLE base_resume_files (
  id TEXT PRIMARY KEY,
  base_resume_id TEXT NOT NULL REFERENCES base_resumes(id),
  filename TEXT NOT NULL,
  content_digest TEXT NOT NULL CHECK (length(content_digest) = 71 AND content_digest GLOB 'sha256:*' AND substr(content_digest, 8) NOT GLOB '*[^0-9a-f]*'),
  byte_size INTEGER NOT NULL CHECK (byte_size > 0),
  storage_location TEXT NOT NULL UNIQUE CHECK (storage_location NOT GLOB '/*' AND storage_location NOT GLOB '[A-Za-z]:*' AND storage_location NOT GLOB '*..*'),
  UNIQUE (base_resume_id, filename)
);

CREATE TRIGGER base_resumes_immutable_update BEFORE UPDATE ON base_resumes BEGIN SELECT RAISE(ABORT, 'base resumes are immutable'); END;
CREATE TRIGGER base_resumes_immutable_delete BEFORE DELETE ON base_resumes BEGIN SELECT RAISE(ABORT, 'base resumes are immutable'); END;
CREATE TRIGGER base_resume_files_immutable_update BEFORE UPDATE ON base_resume_files BEGIN SELECT RAISE(ABORT, 'base resume files are immutable'); END;
CREATE TRIGGER base_resume_files_immutable_delete BEFORE DELETE ON base_resume_files BEGIN SELECT RAISE(ABORT, 'base resume files are immutable'); END;
CREATE TRIGGER base_resume_files_sealed BEFORE INSERT ON base_resume_files
WHEN EXISTS (SELECT 1 FROM audit_events WHERE entity_id = NEW.base_resume_id AND action = 'base_resume.imported' AND outcome = 'success')
BEGIN SELECT RAISE(ABORT, 'base resume files are sealed after import'); END;
