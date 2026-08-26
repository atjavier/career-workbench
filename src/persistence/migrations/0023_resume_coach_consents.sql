CREATE TABLE resume_coach_consent_uses (
  consent_fingerprint TEXT PRIMARY KEY CHECK (length(consent_fingerprint) = 71 AND consent_fingerprint GLOB 'sha256:*'),
  created_at TEXT NOT NULL
);
