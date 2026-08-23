INSERT INTO source_configuration_revisions (id, source_id, revision_number, name, source_type, url, access_path, policy_revision, policy_reviewed_on, policy_approved, request_budget, rate_limit_per_minute, retention_rule, enabled, failure_guidance, content_digest, created_at) VALUES
  ('00000000-0000-7000-8000-000000000206', '00000000-0000-7000-8000-000000000106', 1, 'Kalibrr', 'job-platform', 'https://www.kalibrr.com/', 'manual-browser-handoff', 'Kalibrr terms reviewed', '2026-08-23', 1, 0, 0, 'No integration-fetched content; locally imported listings follow local lifecycle.', 0, 'Stop and use the normal site page or manually import a selected listing.', 'sha256:43bca5925d5044c1924fded63fa7e8265af1b42f7d878b1ce5394a411fc3c29b', '2026-08-23T00:00:00.000Z'),
  ('00000000-0000-7000-8000-000000000207', '00000000-0000-7000-8000-000000000107', 1, 'PhilJobNet', 'public-employment-service', 'https://philjobnet.gov.ph/job-vacancies/', 'manual-browser-handoff', 'PhilJobNet terms reviewed', '2026-08-23', 1, 0, 0, 'No integration-fetched content; locally imported listings follow local lifecycle.', 0, 'Stop and use the normal site page or manually import a selected listing.', 'sha256:2937dc001df740968ed2301260fd24bf23646bae5a4bd2d3ccd76cf402ebb146', '2026-08-23T00:00:00.000Z'),
  ('00000000-0000-7000-8000-000000000208', '00000000-0000-7000-8000-000000000108', 1, 'OnlineJobs.ph', 'job-platform', 'https://www.onlinejobs.ph/jobseekers/jobsearch', 'manual-browser-handoff', 'OnlineJobs.ph terms reviewed', '2026-08-23', 1, 0, 0, 'No integration-fetched content; locally imported listings follow local lifecycle.', 0, 'Stop and use the normal site page or manually import a selected listing.', 'sha256:028b2cc053ec1e11ac255e60d9f4147749483ceb01b4941bc266e149fc4f69e9', '2026-08-23T00:00:00.000Z');

INSERT INTO source_configurations_current (source_id, revision_id, updated_at)
SELECT source_id, id, created_at
FROM source_configuration_revisions
WHERE source_id IN (
  '00000000-0000-7000-8000-000000000106',
  '00000000-0000-7000-8000-000000000107',
  '00000000-0000-7000-8000-000000000108'
);
