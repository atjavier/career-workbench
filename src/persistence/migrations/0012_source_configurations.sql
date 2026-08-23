CREATE TABLE source_configuration_revisions (
  id TEXT PRIMARY KEY CHECK (id GLOB '????????-????-7???-[89ab]???-????????????'),
  source_id TEXT NOT NULL CHECK (source_id GLOB '????????-????-7???-[89ab]???-????????????'),
  revision_number INTEGER NOT NULL CHECK (revision_number > 0),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  source_type TEXT NOT NULL CHECK (source_type IN ('job-platform', 'company-careers', 'public-employment-service')),
  url TEXT NOT NULL CHECK (length(url) BETWEEN 9 AND 2048),
  access_path TEXT NOT NULL CHECK (access_path IN ('manual-browser-handoff', 'official-api', 'published-feed', 'policy-reviewed-html')),
  policy_revision TEXT NOT NULL CHECK (length(policy_revision) BETWEEN 1 AND 500),
  policy_reviewed_on TEXT NOT NULL CHECK (length(policy_reviewed_on) = 10),
  policy_approved INTEGER NOT NULL CHECK (policy_approved IN (0, 1)),
  request_budget INTEGER NOT NULL CHECK (request_budget BETWEEN 0 AND 1000),
  rate_limit_per_minute INTEGER NOT NULL CHECK (rate_limit_per_minute BETWEEN 0 AND 120),
  retention_rule TEXT NOT NULL CHECK (length(retention_rule) BETWEEN 1 AND 500),
  enabled INTEGER NOT NULL CHECK (enabled IN (0, 1)),
  failure_guidance TEXT NOT NULL CHECK (length(failure_guidance) BETWEEN 1 AND 500),
  content_digest TEXT NOT NULL CHECK (length(content_digest) = 71 AND content_digest GLOB 'sha256:*' AND substr(content_digest, 8) NOT GLOB '*[^0-9a-f]*'),
  created_at TEXT NOT NULL,
  UNIQUE(source_id, revision_number),
  CHECK ((access_path = 'manual-browser-handoff' AND request_budget = 0 AND rate_limit_per_minute = 0 AND enabled = 0) OR (access_path IN ('official-api', 'published-feed', 'policy-reviewed-html') AND request_budget > 0 AND rate_limit_per_minute > 0))
);
CREATE TABLE source_configurations_current (
  source_id TEXT PRIMARY KEY CHECK (source_id GLOB '????????-????-7???-[89ab]???-????????????'),
  revision_id TEXT NOT NULL UNIQUE REFERENCES source_configuration_revisions(id),
  updated_at TEXT NOT NULL
);
CREATE TRIGGER source_configuration_revisions_immutable_update BEFORE UPDATE ON source_configuration_revisions BEGIN SELECT RAISE(ABORT, 'source configuration revisions are immutable'); END;
CREATE TRIGGER source_configuration_revisions_immutable_delete BEFORE DELETE ON source_configuration_revisions BEGIN SELECT RAISE(ABORT, 'source configuration revisions are immutable'); END;

INSERT INTO source_configuration_revisions (id, source_id, revision_number, name, source_type, url, access_path, policy_revision, policy_reviewed_on, policy_approved, request_budget, rate_limit_per_minute, retention_rule, enabled, failure_guidance, content_digest, created_at) VALUES
  ('00000000-0000-7000-8000-000000000201', '00000000-0000-7000-8000-000000000101', 1, 'LinkedIn Jobs', 'job-platform', 'https://www.linkedin.com/jobs/', 'manual-browser-handoff', 'LinkedIn prohibited-software policy reviewed', '2026-08-23', 1, 0, 0, 'No integration-fetched content; locally imported listings follow local lifecycle.', 0, 'Stop and use the normal site page or manually import a selected listing.', 'sha256:1111111111111111111111111111111111111111111111111111111111111111', '2026-08-23T00:00:00.000Z'),
  ('00000000-0000-7000-8000-000000000202', '00000000-0000-7000-8000-000000000102', 1, 'JobStreet Philippines', 'job-platform', 'https://ph.jobstreet.com/', 'manual-browser-handoff', 'JobStreet website terms reviewed', '2026-08-23', 1, 0, 0, 'No integration-fetched content; locally imported listings follow local lifecycle.', 0, 'Stop and use the normal site page or manually import a selected listing.', 'sha256:2222222222222222222222222222222222222222222222222222222222222222', '2026-08-23T00:00:00.000Z'),
  ('00000000-0000-7000-8000-000000000203', '00000000-0000-7000-8000-000000000103', 1, 'Bossjob Philippines', 'job-platform', 'https://bossjob.ph/', 'manual-browser-handoff', 'Bossjob terms reviewed', '2026-08-23', 1, 0, 0, 'No integration-fetched content; locally imported listings follow local lifecycle.', 0, 'Stop and use the normal site page or manually import a selected listing.', 'sha256:3333333333333333333333333333333333333333333333333333333333333333', '2026-08-23T00:00:00.000Z'),
  ('00000000-0000-7000-8000-000000000204', '00000000-0000-7000-8000-000000000104', 1, 'Indeed Philippines', 'job-platform', 'https://ph.indeed.com/', 'manual-browser-handoff', 'Indeed terms reviewed', '2026-08-23', 1, 0, 0, 'No integration-fetched content; locally imported listings follow local lifecycle.', 0, 'Stop and use the normal site page or manually import a selected listing.', 'sha256:4444444444444444444444444444444444444444444444444444444444444444', '2026-08-23T00:00:00.000Z'),
  ('00000000-0000-7000-8000-000000000205', '00000000-0000-7000-8000-000000000105', 1, 'Glassdoor', 'job-platform', 'https://www.glassdoor.com/', 'manual-browser-handoff', 'Glassdoor terms reviewed', '2026-08-23', 1, 0, 0, 'No integration-fetched content; locally imported listings follow local lifecycle.', 0, 'Stop and use the normal site page or manually import a selected listing.', 'sha256:5555555555555555555555555555555555555555555555555555555555555555', '2026-08-23T00:00:00.000Z');
INSERT INTO source_configurations_current (source_id, revision_id, updated_at) SELECT source_id, id, created_at FROM source_configuration_revisions;
