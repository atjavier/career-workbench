CREATE TABLE job_listings (
  id TEXT PRIMARY KEY CHECK (id GLOB '????????-????-7???-[89ab]???-????????????'),
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 300),
  company TEXT NOT NULL CHECK (length(company) BETWEEN 1 AND 300),
  work_style TEXT CHECK (work_style IS NULL OR length(work_style) BETWEEN 1 AND 120),
  location TEXT CHECK (location IS NULL OR length(location) BETWEEN 1 AND 300),
  duplicate_key TEXT NOT NULL CHECK (length(duplicate_key) BETWEEN 3 AND 700),
  duplicate_group_id TEXT NOT NULL CHECK (duplicate_group_id GLOB '????????-????-7???-[89ab]???-????????????'),
  first_seen_at TEXT NOT NULL CHECK (strftime('%Y-%m-%dT%H:%M:%fZ', first_seen_at) = first_seen_at),
  last_observed_at TEXT NOT NULL CHECK (strftime('%Y-%m-%dT%H:%M:%fZ', last_observed_at) = last_observed_at),
  content_digest TEXT NOT NULL CHECK (length(content_digest) = 71 AND content_digest GLOB 'sha256:*' AND substr(content_digest, 8) NOT GLOB '*[^0-9a-f]*')
);

CREATE TABLE retained_job_source_records (
  id TEXT PRIMARY KEY CHECK (id GLOB '????????-????-7???-[89ab]???-????????????'),
  job_listing_id TEXT NOT NULL REFERENCES job_listings(id),
  source_id TEXT NOT NULL CHECK (source_id GLOB '????????-????-7???-[89ab]???-????????????'),
  source_configuration_revision_id TEXT NOT NULL REFERENCES source_configuration_revisions(id),
  refresh_run_id TEXT REFERENCES refresh_runs(id),
  original_url TEXT NOT NULL CHECK (length(original_url) BETWEEN 9 AND 2048 AND original_url GLOB 'https://*' AND instr(substr(original_url, 9), '@') = 0),
  posted_at TEXT CHECK (posted_at IS NULL OR (length(posted_at) <= 40 AND strftime('%Y-%m-%dT%H:%M:%fZ', posted_at) = posted_at)),
  observed_at TEXT NOT NULL CHECK (strftime('%Y-%m-%dT%H:%M:%fZ', observed_at) = observed_at),
  content_digest TEXT NOT NULL CHECK (length(content_digest) = 71 AND content_digest GLOB 'sha256:*' AND substr(content_digest, 8) NOT GLOB '*[^0-9a-f]*')
);

CREATE TABLE job_listing_duplicate_overrides (
  id TEXT PRIMARY KEY CHECK (id GLOB '????????-????-7???-[89ab]???-????????????'),
  job_listing_id TEXT NOT NULL REFERENCES job_listings(id),
  previous_group_id TEXT NOT NULL CHECK (previous_group_id GLOB '????????-????-7???-[89ab]???-????????????'),
  new_group_id TEXT NOT NULL CHECK (new_group_id GLOB '????????-????-7???-[89ab]???-????????????'),
  status TEXT NOT NULL CHECK (status IN ('applied', 'reversed')),
  created_at TEXT NOT NULL,
  reversed_at TEXT,
  content_digest TEXT NOT NULL CHECK (length(content_digest) = 71 AND content_digest GLOB 'sha256:*' AND substr(content_digest, 8) NOT GLOB '*[^0-9a-f]*')
);

CREATE INDEX retained_job_source_records_listing_index ON retained_job_source_records(job_listing_id);
CREATE INDEX job_listings_duplicate_group_index ON job_listings(duplicate_group_id);
CREATE UNIQUE INDEX job_listing_one_active_override ON job_listing_duplicate_overrides(job_listing_id) WHERE status = 'applied';
CREATE TRIGGER retained_job_source_records_matching_revision BEFORE INSERT ON retained_job_source_records
WHEN (SELECT source_id FROM source_configuration_revisions WHERE id = NEW.source_configuration_revision_id) <> NEW.source_id
BEGIN SELECT RAISE(ABORT, 'source record revision must belong to source'); END;
CREATE TRIGGER retained_job_source_records_matching_refresh BEFORE INSERT ON retained_job_source_records
WHEN NEW.refresh_run_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM refresh_source_outcomes WHERE refresh_run_id = NEW.refresh_run_id AND source_id = NEW.source_id AND source_configuration_revision_id = NEW.source_configuration_revision_id AND status IN ('completed', 'partial'))
BEGIN SELECT RAISE(ABORT, 'source record refresh provenance is not a permitted terminal outcome'); END;
CREATE TRIGGER retained_job_source_records_immutable_update BEFORE UPDATE ON retained_job_source_records BEGIN SELECT RAISE(ABORT, 'retained source records are immutable'); END;
CREATE TRIGGER retained_job_source_records_immutable_delete BEFORE DELETE ON retained_job_source_records BEGIN SELECT RAISE(ABORT, 'retained source records are immutable'); END;
CREATE TRIGGER job_listing_duplicate_overrides_once BEFORE UPDATE ON job_listing_duplicate_overrides
WHEN OLD.status = 'reversed' OR NEW.status <> 'reversed' OR NEW.reversed_at IS NULL OR NEW.job_listing_id <> OLD.job_listing_id OR NEW.previous_group_id <> OLD.previous_group_id OR NEW.new_group_id <> OLD.new_group_id OR NEW.created_at <> OLD.created_at OR NEW.content_digest <> OLD.content_digest
BEGIN SELECT RAISE(ABORT, 'duplicate override may be reversed once'); END;
CREATE TRIGGER job_listing_duplicate_overrides_immutable_delete BEFORE DELETE ON job_listing_duplicate_overrides BEGIN SELECT RAISE(ABORT, 'duplicate overrides are immutable'); END;
