CREATE INDEX captured_revision_latest_index
ON captured_opportunity_revisions(opportunity_id, created_at, id);

-- One current tailored output per opportunity, never a list of saved versions.
CREATE TABLE opportunity_tailored_resumes (
  opportunity_id TEXT PRIMARY KEY REFERENCES captured_opportunities(id) ON DELETE CASCADE,
  opportunity_revision_id TEXT NOT NULL REFERENCES captured_opportunity_revisions(id),
  base_draft_id TEXT NOT NULL REFERENCES material_drafts(id) ON DELETE CASCADE,
  input_fingerprint TEXT NOT NULL CHECK (length(input_fingerprint) = 71),
  generation_id TEXT NOT NULL,
  content_json TEXT NOT NULL CHECK (json_valid(content_json)),
  tex TEXT NOT NULL,
  pdf BLOB NOT NULL CHECK (length(pdf) BETWEEN 5 AND 10485760),
  updated_at TEXT NOT NULL
);

-- Only paths, no retained opportunity payload. Drained after committed deletion.
CREATE TABLE opportunity_file_cleanup (
  relative_path TEXT PRIMARY KEY CHECK (relative_path GLOB 'pdf-cache/*.pdf' AND relative_path NOT LIKE '%..%' AND relative_path NOT LIKE '%\\%')
);
