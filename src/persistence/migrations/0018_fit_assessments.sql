CREATE TABLE fit_assessments (
  id TEXT PRIMARY KEY CHECK (id GLOB '????????-????-7???-[89ab]???-????????????'),
  job_listing_id TEXT NOT NULL REFERENCES job_listings(id),
  candidate_profile_revision_id TEXT,
  preference_revision_id TEXT NOT NULL REFERENCES job_preference_revisions(id),
  ruleset_id TEXT NOT NULL CHECK (length(ruleset_id) BETWEEN 1 AND 80),
  ruleset_version TEXT NOT NULL CHECK (length(ruleset_version) BETWEEN 1 AND 40),
  ruleset_digest TEXT NOT NULL CHECK (length(ruleset_digest) = 71 AND ruleset_digest GLOB 'sha256:*' AND substr(ruleset_digest, 8) NOT GLOB '*[^0-9a-f]*'),
  listing_snapshot TEXT NOT NULL CHECK (length(listing_snapshot) BETWEEN 2 AND 200000),
  evidence_snapshot TEXT NOT NULL CHECK (length(evidence_snapshot) BETWEEN 2 AND 200000),
  preference_snapshot TEXT NOT NULL CHECK (length(preference_snapshot) BETWEEN 2 AND 200000),
  factor_outcomes TEXT NOT NULL CHECK (length(factor_outcomes) BETWEEN 2 AND 100000),
  label TEXT NOT NULL CHECK (label IN ('Strong', 'Potential', 'Stretch')),
  confidence TEXT NOT NULL CHECK (confidence IN ('high', 'medium', 'low')),
  freshness TEXT NOT NULL CHECK (length(freshness) BETWEEN 1 AND 2000),
  calculated_at TEXT NOT NULL CHECK (strftime('%Y-%m-%dT%H:%M:%fZ', calculated_at) = calculated_at),
  content_digest TEXT NOT NULL CHECK (length(content_digest) = 71 AND content_digest GLOB 'sha256:*' AND substr(content_digest, 8) NOT GLOB '*[^0-9a-f]*')
);
CREATE INDEX fit_assessments_listing_index ON fit_assessments(job_listing_id, calculated_at DESC);
CREATE TRIGGER fit_assessments_immutable_update BEFORE UPDATE ON fit_assessments BEGIN SELECT RAISE(ABORT, 'fit assessments are immutable'); END;
CREATE TRIGGER fit_assessments_immutable_delete BEFORE DELETE ON fit_assessments BEGIN SELECT RAISE(ABORT, 'fit assessments are immutable'); END;
