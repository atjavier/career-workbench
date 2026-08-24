CREATE TRIGGER job_listings_valid_insert BEFORE INSERT ON job_listings
WHEN (NEW.work_style IS NOT NULL AND length(NEW.work_style) > 120)
  OR (NEW.location IS NOT NULL AND length(NEW.location) > 300)
  OR NEW.first_seen_at NOT GLOB '????-??-??T??:??:??.???Z'
  OR NEW.last_observed_at NOT GLOB '????-??-??T??:??:??.???Z'
BEGIN SELECT RAISE(ABORT, 'job listing fields must be bounded and UTC ISO-8601'); END;
CREATE TRIGGER retained_job_source_records_valid_insert BEFORE INSERT ON retained_job_source_records
WHEN (NEW.posted_at IS NOT NULL AND NEW.posted_at NOT GLOB '????-??-??T??:??:??.???Z')
  OR NEW.observed_at NOT GLOB '????-??-??T??:??:??.???Z'
  OR instr(substr(NEW.original_url, 9), '@') > 0
  OR (NEW.refresh_run_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM refresh_source_outcomes o
    WHERE o.refresh_run_id = NEW.refresh_run_id
      AND o.source_id = NEW.source_id
      AND o.source_configuration_revision_id = NEW.source_configuration_revision_id
      AND o.status IN ('completed', 'partial')
  ))
BEGIN SELECT RAISE(ABORT, 'retained source record must be safe and match a permitted source outcome'); END;
CREATE UNIQUE INDEX job_listing_duplicate_overrides_one_active ON job_listing_duplicate_overrides(job_listing_id) WHERE status = 'applied';
CREATE TRIGGER job_listing_duplicate_overrides_reversal_immutable BEFORE UPDATE ON job_listing_duplicate_overrides
WHEN NEW.id <> OLD.id OR NEW.job_listing_id <> OLD.job_listing_id OR NEW.previous_group_id <> OLD.previous_group_id OR NEW.new_group_id <> OLD.new_group_id OR NEW.created_at <> OLD.created_at OR NEW.content_digest <> OLD.content_digest
BEGIN SELECT RAISE(ABORT, 'duplicate override history is immutable'); END;
