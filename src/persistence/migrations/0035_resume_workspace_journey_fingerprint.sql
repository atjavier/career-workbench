ALTER TABLE resume_workspace_journeys
ADD COLUMN state_fingerprint TEXT NOT NULL DEFAULT 'sha256:unreconciled'
CHECK (length(state_fingerprint) BETWEEN 1 AND 200);
