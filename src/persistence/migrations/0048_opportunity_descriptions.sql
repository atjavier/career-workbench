CREATE TABLE opportunity_revision_descriptions (
  revision_id TEXT PRIMARY KEY REFERENCES captured_opportunity_revisions(id) ON DELETE CASCADE,
  refined_description TEXT NOT NULL CHECK (length(refined_description) BETWEEN 1 AND 500000)
);
