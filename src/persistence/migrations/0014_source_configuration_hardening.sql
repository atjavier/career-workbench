CREATE TRIGGER source_configuration_revisions_require_safe_url
BEFORE INSERT ON source_configuration_revisions
WHEN NEW.url NOT GLOB 'https://*'
  OR instr(substr(NEW.url, 9), '@') > 0
   AND (instr(substr(NEW.url, 9), '/') = 0 OR instr(substr(NEW.url, 9), '@') < instr(substr(NEW.url, 9), '/'))
BEGIN
  SELECT RAISE(ABORT, 'source configuration URL must be credential-free HTTPS');
END;

CREATE TRIGGER source_configuration_revisions_require_approved_enabled_policy
BEFORE INSERT ON source_configuration_revisions
WHEN NEW.enabled = 1 AND NEW.policy_approved <> 1
BEGIN
  SELECT RAISE(ABORT, 'enabled source configuration requires approved policy');
END;

CREATE TRIGGER source_configurations_current_require_matching_source_insert
BEFORE INSERT ON source_configurations_current
WHEN (SELECT source_id FROM source_configuration_revisions WHERE id = NEW.revision_id) <> NEW.source_id
BEGIN
  SELECT RAISE(ABORT, 'current source configuration revision must belong to source');
END;

CREATE TRIGGER source_configurations_current_require_matching_source_update
BEFORE UPDATE OF source_id, revision_id ON source_configurations_current
WHEN (SELECT source_id FROM source_configuration_revisions WHERE id = NEW.revision_id) <> NEW.source_id
BEGIN
  SELECT RAISE(ABORT, 'current source configuration revision must belong to source');
END;

INSERT INTO source_configuration_revisions (id, source_id, revision_number, name, source_type, url, access_path, policy_revision, policy_reviewed_on, policy_approved, request_budget, rate_limit_per_minute, retention_rule, enabled, failure_guidance, content_digest, created_at) VALUES
  ('00000000-0000-7000-8000-000000000211', '00000000-0000-7000-8000-000000000101', 2, 'LinkedIn Jobs', 'job-platform', 'https://www.linkedin.com/jobs/', 'manual-browser-handoff', 'LinkedIn prohibited-software policy reviewed', '2026-08-23', 1, 0, 0, 'No integration-fetched content; locally imported listings follow local lifecycle.', 0, 'Stop and use the normal site page or manually import a selected listing.', 'sha256:c35d4ef2f2eacb1e233a5ab36bd39fd25114bcdd60f1d07777a8bb0c45d87ea8', '2026-08-23T00:00:01.000Z'),
  ('00000000-0000-7000-8000-000000000212', '00000000-0000-7000-8000-000000000102', 2, 'JobStreet Philippines', 'job-platform', 'https://ph.jobstreet.com/', 'manual-browser-handoff', 'JobStreet website terms reviewed', '2026-08-23', 1, 0, 0, 'No integration-fetched content; locally imported listings follow local lifecycle.', 0, 'Stop and use the normal site page or manually import a selected listing.', 'sha256:0015b48cc97f8f2f82ca5d55f185deefe9c1a22901de3192e2b857f8ef81dadb', '2026-08-23T00:00:01.000Z'),
  ('00000000-0000-7000-8000-000000000213', '00000000-0000-7000-8000-000000000103', 2, 'Bossjob Philippines', 'job-platform', 'https://bossjob.ph/', 'manual-browser-handoff', 'Bossjob terms reviewed', '2026-08-23', 1, 0, 0, 'No integration-fetched content; locally imported listings follow local lifecycle.', 0, 'Stop and use the normal site page or manually import a selected listing.', 'sha256:acfe13b5feb1623d997a890f553fe215081f3665e56ec3d0323c45c5dbef3592', '2026-08-23T00:00:01.000Z'),
  ('00000000-0000-7000-8000-000000000214', '00000000-0000-7000-8000-000000000104', 2, 'Indeed Philippines', 'job-platform', 'https://ph.indeed.com/', 'manual-browser-handoff', 'Indeed terms reviewed', '2026-08-23', 1, 0, 0, 'No integration-fetched content; locally imported listings follow local lifecycle.', 0, 'Stop and use the normal site page or manually import a selected listing.', 'sha256:aba79243de57fb440a3f44c2d3248f0a9eee471093debd5cb0f59ac1ee63b45e', '2026-08-23T00:00:01.000Z'),
  ('00000000-0000-7000-8000-000000000215', '00000000-0000-7000-8000-000000000105', 2, 'Glassdoor', 'job-platform', 'https://www.glassdoor.com/', 'manual-browser-handoff', 'Glassdoor terms reviewed', '2026-08-23', 1, 0, 0, 'No integration-fetched content; locally imported listings follow local lifecycle.', 0, 'Stop and use the normal site page or manually import a selected listing.', 'sha256:161832e41cee3ca50e387d1ad47c4c9a32485a0f692fbbbed0b52853fdef8380', '2026-08-23T00:00:01.000Z');

UPDATE source_configurations_current
SET revision_id = CASE source_id
  WHEN '00000000-0000-7000-8000-000000000101' THEN '00000000-0000-7000-8000-000000000211'
  WHEN '00000000-0000-7000-8000-000000000102' THEN '00000000-0000-7000-8000-000000000212'
  WHEN '00000000-0000-7000-8000-000000000103' THEN '00000000-0000-7000-8000-000000000213'
  WHEN '00000000-0000-7000-8000-000000000104' THEN '00000000-0000-7000-8000-000000000214'
  WHEN '00000000-0000-7000-8000-000000000105' THEN '00000000-0000-7000-8000-000000000215'
END,
updated_at = '2026-08-23T00:00:01.000Z'
WHERE source_id IN ('00000000-0000-7000-8000-000000000101', '00000000-0000-7000-8000-000000000102', '00000000-0000-7000-8000-000000000103', '00000000-0000-7000-8000-000000000104', '00000000-0000-7000-8000-000000000105');
