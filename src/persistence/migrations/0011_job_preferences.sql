CREATE TABLE job_preference_revisions (
  id TEXT PRIMARY KEY CHECK (id GLOB '????????-????-7???-[89ab]???-????????????'),
  revision_number INTEGER NOT NULL UNIQUE CHECK (revision_number > 0),
  role_intents TEXT NOT NULL CHECK (json_valid(role_intents) AND length(role_intents) BETWEEN 2 AND 500),
  country TEXT NOT NULL CHECK (country IN ('PH', 'SG', 'AU', 'CA', 'GB', 'JP', 'US')),
  work_style_order TEXT NOT NULL CHECK (json_valid(work_style_order) AND length(work_style_order) BETWEEN 2 AND 100),
  prefer_ncr_hybrid_onsite INTEGER NOT NULL CHECK (prefer_ncr_hybrid_onsite IN (0, 1)),
  content_digest TEXT NOT NULL CHECK (length(content_digest) = 71 AND content_digest GLOB 'sha256:*' AND substr(content_digest, 8) NOT GLOB '*[^0-9a-f]*'),
  created_at TEXT NOT NULL
);
CREATE TABLE job_preferences_current (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  revision_id TEXT NOT NULL UNIQUE REFERENCES job_preference_revisions(id),
  updated_at TEXT NOT NULL
);
CREATE TRIGGER job_preference_revisions_immutable_update BEFORE UPDATE ON job_preference_revisions BEGIN SELECT RAISE(ABORT, 'job preference revisions are immutable'); END;
CREATE TRIGGER job_preference_revisions_immutable_delete BEFORE DELETE ON job_preference_revisions BEGIN SELECT RAISE(ABORT, 'job preference revisions are immutable'); END;
