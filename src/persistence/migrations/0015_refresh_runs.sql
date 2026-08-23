CREATE TABLE refresh_runs (
  id TEXT PRIMARY KEY CHECK (id GLOB '????????-????-7???-[89ab]???-????????????'),
  selected_source_count INTEGER NOT NULL CHECK (selected_source_count > 0 AND selected_source_count <= 100),
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'partial', 'failed')),
  content_digest TEXT NOT NULL CHECK (length(content_digest) = 71 AND content_digest GLOB 'sha256:*' AND substr(content_digest, 8) NOT GLOB '*[^0-9a-f]*'),
  started_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE TABLE refresh_source_outcomes (
  id TEXT PRIMARY KEY CHECK (id GLOB '????????-????-7???-[89ab]???-????????????'),
  refresh_run_id TEXT NOT NULL REFERENCES refresh_runs(id),
  source_id TEXT NOT NULL CHECK (source_id GLOB '????????-????-7???-[89ab]???-????????????'),
  source_configuration_revision_id TEXT NOT NULL REFERENCES source_configuration_revisions(id),
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'partial', 'failed', 'blocked', 'throttled')),
  request_count INTEGER NOT NULL CHECK (request_count BETWEEN 0 AND 1000),
  recovery_guidance TEXT NOT NULL CHECK (length(recovery_guidance) BETWEEN 1 AND 500),
  content_digest TEXT NOT NULL CHECK (length(content_digest) = 71 AND content_digest GLOB 'sha256:*' AND substr(content_digest, 8) NOT GLOB '*[^0-9a-f]*'),
  started_at TEXT NOT NULL,
  completed_at TEXT,
  UNIQUE(refresh_run_id, source_id)
);

CREATE INDEX refresh_source_outcomes_run_index ON refresh_source_outcomes(refresh_run_id);
CREATE TRIGGER refresh_runs_terminal_once BEFORE UPDATE ON refresh_runs
WHEN OLD.status <> 'running' OR NEW.status = 'running' OR NEW.completed_at IS NULL
BEGIN SELECT RAISE(ABORT, 'refresh run may be finalized once'); END;
CREATE TRIGGER refresh_runs_immutable_delete BEFORE DELETE ON refresh_runs BEGIN SELECT RAISE(ABORT, 'refresh runs are immutable'); END;
CREATE TRIGGER refresh_source_outcomes_immutable_update BEFORE UPDATE ON refresh_source_outcomes BEGIN SELECT RAISE(ABORT, 'refresh source outcomes are immutable'); END;
CREATE TRIGGER refresh_source_outcomes_immutable_delete BEFORE DELETE ON refresh_source_outcomes BEGIN SELECT RAISE(ABORT, 'refresh source outcomes are immutable'); END;
CREATE TRIGGER refresh_source_outcomes_matching_revision BEFORE INSERT ON refresh_source_outcomes
WHEN (SELECT source_id FROM source_configuration_revisions WHERE id = NEW.source_configuration_revision_id) <> NEW.source_id
BEGIN SELECT RAISE(ABORT, 'refresh outcome revision must belong to source'); END;
