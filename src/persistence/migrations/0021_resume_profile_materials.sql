CREATE TABLE candidate_profiles (
  id TEXT PRIMARY KEY CHECK (id GLOB '????????-????-7???-[89ab]???-????????????'),
  created_at TEXT NOT NULL
);

CREATE TABLE candidate_profile_revisions (
  id TEXT PRIMARY KEY CHECK (id GLOB '????????-????-7???-[89ab]???-????????????'),
  profile_id TEXT NOT NULL REFERENCES candidate_profiles(id),
  revision_number INTEGER NOT NULL CHECK (revision_number > 0),
  parent_revision_id TEXT REFERENCES candidate_profile_revisions(id),
  first_name TEXT NOT NULL CHECK (length(trim(first_name)) BETWEEN 1 AND 120),
  middle_name TEXT,
  last_name TEXT NOT NULL CHECK (length(trim(last_name)) BETWEEN 1 AND 120),
  email TEXT NOT NULL CHECK (length(email) BETWEEN 3 AND 254),
  phone TEXT NOT NULL CHECK (length(phone) BETWEEN 7 AND 40),
  school TEXT NOT NULL CHECK (length(trim(school)) BETWEEN 1 AND 240),
  program TEXT NOT NULL CHECK (length(trim(program)) BETWEEN 1 AND 240),
  graduation_year INTEGER NOT NULL CHECK (graduation_year BETWEEN 1900 AND 2100),
  gwa TEXT,
  latin_honors TEXT,
  linkedin_url TEXT,
  github_url TEXT,
  canonical_content TEXT NOT NULL CHECK (length(canonical_content) BETWEEN 2 AND 20000),
  content_digest TEXT NOT NULL CHECK (length(content_digest) = 71 AND content_digest GLOB 'sha256:*' AND substr(content_digest, 8) NOT GLOB '*[^0-9a-f]*'),
  created_at TEXT NOT NULL,
  UNIQUE (profile_id, revision_number)
);

CREATE TABLE resume_template_sources (
  id TEXT PRIMARY KEY CHECK (id GLOB '????????-????-7???-[89ab]???-????????????'),
  origin TEXT NOT NULL CHECK (origin IN ('bundled', 'legacy_current_base_resume')),
  state TEXT NOT NULL CHECK (state IN ('verified', 'legacy_candidate')),
  filename TEXT NOT NULL CHECK (filename NOT GLOB '*[\\/:]*' AND length(filename) BETWEEN 1 AND 255),
  content_type TEXT NOT NULL CHECK (content_type = 'application/pdf'),
  content_digest TEXT NOT NULL CHECK (length(content_digest) = 71 AND content_digest GLOB 'sha256:*' AND substr(content_digest, 8) NOT GLOB '*[^0-9a-f]*'),
  byte_size INTEGER NOT NULL CHECK (byte_size > 0 AND byte_size <= 10485760),
  storage_location TEXT NOT NULL UNIQUE CHECK (storage_location NOT GLOB '/*' AND storage_location NOT GLOB '[A-Za-z]:*' AND storage_location NOT GLOB '*..*'),
  legacy_source_id TEXT UNIQUE REFERENCES current_base_resume_sources(id),
  created_at TEXT NOT NULL,
  CHECK ((origin = 'bundled' AND state = 'verified' AND filename = 'Resume.pdf' AND legacy_source_id IS NULL AND storage_location LIKE 'resume-templates/%') OR (origin = 'legacy_current_base_resume' AND state = 'legacy_candidate' AND legacy_source_id IS NOT NULL AND storage_location LIKE 'current-base-resumes/%'))
);

CREATE TABLE local_model_configuration_revisions (
  id TEXT PRIMARY KEY CHECK (id GLOB '????????-????-7???-[89ab]???-????????????'),
  endpoint TEXT NOT NULL CHECK (endpoint = 'http://127.0.0.1:1234/v1'),
  model_identifier TEXT NOT NULL CHECK (length(model_identifier) BETWEEN 1 AND 240),
  display_label TEXT NOT NULL CHECK (display_label = 'Qwen3.5-9B'),
  secret_reference TEXT NOT NULL CHECK (length(secret_reference) BETWEEN 1 AND 512),
  configuration_digest TEXT NOT NULL CHECK (length(configuration_digest) = 71 AND configuration_digest GLOB 'sha256:*' AND substr(configuration_digest, 8) NOT GLOB '*[^0-9a-f]*'),
  created_at TEXT NOT NULL
);

CREATE TABLE resume_generation_state (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  active_profile_revision_id TEXT REFERENCES candidate_profile_revisions(id),
  designated_template_id TEXT REFERENCES resume_template_sources(id),
  current_model_configuration_revision_id TEXT REFERENCES local_model_configuration_revisions(id),
  revision_number INTEGER NOT NULL CHECK (revision_number >= 0),
  updated_at TEXT NOT NULL
);

CREATE TABLE material_drafts (
  id TEXT PRIMARY KEY CHECK (id GLOB '????????-????-7???-[89ab]???-????????????'),
  kind TEXT NOT NULL CHECK (kind = 'resume'),
  profile_revision_id TEXT NOT NULL REFERENCES candidate_profile_revisions(id),
  profile_content_digest TEXT NOT NULL CHECK (length(profile_content_digest) = 71 AND profile_content_digest GLOB 'sha256:*' AND substr(profile_content_digest, 8) NOT GLOB '*[^0-9a-f]*'),
  template_source_id TEXT NOT NULL REFERENCES resume_template_sources(id),
  template_content_digest TEXT NOT NULL CHECK (length(template_content_digest) = 71 AND template_content_digest GLOB 'sha256:*' AND substr(template_content_digest, 8) NOT GLOB '*[^0-9a-f]*'),
  opportunity_revision_id TEXT REFERENCES captured_opportunity_revisions(id),
  opportunity_content_digest TEXT CHECK (opportunity_content_digest IS NULL OR (length(opportunity_content_digest) = 71 AND opportunity_content_digest GLOB 'sha256:*' AND substr(opportunity_content_digest, 8) NOT GLOB '*[^0-9a-f]*')),
  request_text TEXT NOT NULL CHECK (length(request_text) BETWEEN 1 AND 20000),
  request_digest TEXT NOT NULL CHECK (length(request_digest) = 71 AND request_digest GLOB 'sha256:*' AND substr(request_digest, 8) NOT GLOB '*[^0-9a-f]*'),
  content_json TEXT NOT NULL CHECK (length(content_json) BETWEEN 2 AND 100000),
  content_digest TEXT NOT NULL CHECK (length(content_digest) = 71 AND content_digest GLOB 'sha256:*' AND substr(content_digest, 8) NOT GLOB '*[^0-9a-f]*'),
  provenance_digest TEXT NOT NULL CHECK (length(provenance_digest) = 71 AND provenance_digest GLOB 'sha256:*' AND substr(provenance_digest, 8) NOT GLOB '*[^0-9a-f]*'),
  created_at TEXT NOT NULL,
  CHECK ((opportunity_revision_id IS NULL AND opportunity_content_digest IS NULL) OR (opportunity_revision_id IS NOT NULL AND opportunity_content_digest IS NOT NULL))
);

CREATE TABLE material_draft_evidence (
  draft_id TEXT NOT NULL REFERENCES material_drafts(id),
  evidence_revision_id TEXT NOT NULL REFERENCES evidence_revisions(id),
  PRIMARY KEY (draft_id, evidence_revision_id)
);

CREATE TABLE material_draft_claims (
  id TEXT PRIMARY KEY CHECK (id GLOB '????????-????-7???-[89ab]???-????????????'),
  draft_id TEXT NOT NULL REFERENCES material_drafts(id),
  ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
  claim_text TEXT NOT NULL CHECK (length(claim_text) BETWEEN 1 AND 4000),
  created_at TEXT NOT NULL,
  UNIQUE (draft_id, ordinal)
);

CREATE TABLE material_claim_support (
  claim_id TEXT NOT NULL REFERENCES material_draft_claims(id),
  evidence_revision_id TEXT NOT NULL REFERENCES evidence_revisions(id),
  PRIMARY KEY (claim_id, evidence_revision_id)
);

CREATE TABLE material_draft_handoffs (
  id TEXT PRIMARY KEY CHECK (id GLOB '????????-????-7???-[89ab]???-????????????'),
  draft_id TEXT NOT NULL UNIQUE REFERENCES material_drafts(id),
  destination TEXT NOT NULL CHECK (destination = 'review'),
  created_at TEXT NOT NULL
);

CREATE TABLE material_versions (
  id TEXT PRIMARY KEY CHECK (id GLOB '????????-????-7???-[89ab]???-????????????'),
  source_draft_id TEXT NOT NULL UNIQUE REFERENCES material_drafts(id),
  profile_content_digest TEXT NOT NULL CHECK (length(profile_content_digest) = 71 AND profile_content_digest GLOB 'sha256:*' AND substr(profile_content_digest, 8) NOT GLOB '*[^0-9a-f]*'),
  template_content_digest TEXT NOT NULL CHECK (length(template_content_digest) = 71 AND template_content_digest GLOB 'sha256:*' AND substr(template_content_digest, 8) NOT GLOB '*[^0-9a-f]*'),
  opportunity_content_digest TEXT CHECK (opportunity_content_digest IS NULL OR (length(opportunity_content_digest) = 71 AND opportunity_content_digest GLOB 'sha256:*' AND substr(opportunity_content_digest, 8) NOT GLOB '*[^0-9a-f]*')),
  accepted_at TEXT NOT NULL,
  content_digest TEXT NOT NULL CHECK (length(content_digest) = 71 AND content_digest GLOB 'sha256:*' AND substr(content_digest, 8) NOT GLOB '*[^0-9a-f]*'),
  provenance_digest TEXT NOT NULL CHECK (length(provenance_digest) = 71 AND provenance_digest GLOB 'sha256:*' AND substr(provenance_digest, 8) NOT GLOB '*[^0-9a-f]*'),
  renderer_metadata TEXT,
  export_metadata TEXT,
  created_at TEXT NOT NULL
);

INSERT INTO resume_generation_state (singleton, active_profile_revision_id, designated_template_id, current_model_configuration_revision_id, revision_number, updated_at)
VALUES (1, NULL, NULL, NULL, 0, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

INSERT INTO resume_template_sources (id, origin, state, filename, content_type, content_digest, byte_size, storage_location, legacy_source_id, created_at)
SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-7' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', (random() & 3) + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))), 'legacy_current_base_resume', 'legacy_candidate', filename, 'application/pdf', content_digest, byte_size, storage_location, id, imported_at
FROM current_base_resume_sources;

CREATE INDEX candidate_profile_revisions_profile_index ON candidate_profile_revisions(profile_id, revision_number DESC);
CREATE INDEX resume_template_sources_legacy_index ON resume_template_sources(legacy_source_id);
CREATE UNIQUE INDEX resume_template_sources_bundled_digest_unique ON resume_template_sources(content_digest) WHERE origin = 'bundled';
CREATE INDEX material_drafts_profile_index ON material_drafts(profile_revision_id, created_at DESC);
CREATE INDEX material_draft_claims_draft_index ON material_draft_claims(draft_id, ordinal);

CREATE TRIGGER candidate_profiles_immutable_update BEFORE UPDATE ON candidate_profiles BEGIN SELECT RAISE(ABORT, 'candidate profiles are immutable'); END;
CREATE TRIGGER candidate_profiles_immutable_delete BEFORE DELETE ON candidate_profiles BEGIN SELECT RAISE(ABORT, 'candidate profiles are immutable'); END;
CREATE TRIGGER candidate_profile_revisions_immutable_update BEFORE UPDATE ON candidate_profile_revisions BEGIN SELECT RAISE(ABORT, 'candidate profile revisions are immutable'); END;
CREATE TRIGGER candidate_profile_revisions_immutable_delete BEFORE DELETE ON candidate_profile_revisions BEGIN SELECT RAISE(ABORT, 'candidate profile revisions are immutable'); END;
CREATE TRIGGER resume_template_sources_immutable_update BEFORE UPDATE ON resume_template_sources BEGIN SELECT RAISE(ABORT, 'resume template sources are immutable'); END;
CREATE TRIGGER resume_template_sources_immutable_delete BEFORE DELETE ON resume_template_sources BEGIN SELECT RAISE(ABORT, 'resume template sources are immutable'); END;
CREATE TRIGGER local_model_configuration_revisions_immutable_update BEFORE UPDATE ON local_model_configuration_revisions BEGIN SELECT RAISE(ABORT, 'local model configuration revisions are immutable'); END;
CREATE TRIGGER local_model_configuration_revisions_immutable_delete BEFORE DELETE ON local_model_configuration_revisions BEGIN SELECT RAISE(ABORT, 'local model configuration revisions are immutable'); END;
CREATE TRIGGER material_drafts_immutable_update BEFORE UPDATE ON material_drafts BEGIN SELECT RAISE(ABORT, 'material drafts are immutable'); END;
CREATE TRIGGER material_drafts_immutable_delete BEFORE DELETE ON material_drafts BEGIN SELECT RAISE(ABORT, 'material drafts are immutable'); END;
CREATE TRIGGER material_draft_evidence_immutable_update BEFORE UPDATE ON material_draft_evidence BEGIN SELECT RAISE(ABORT, 'material draft evidence is immutable'); END;
CREATE TRIGGER material_draft_evidence_immutable_delete BEFORE DELETE ON material_draft_evidence BEGIN SELECT RAISE(ABORT, 'material draft evidence is immutable'); END;
CREATE TRIGGER material_draft_claims_immutable_update BEFORE UPDATE ON material_draft_claims BEGIN SELECT RAISE(ABORT, 'material draft claims are immutable'); END;
CREATE TRIGGER material_draft_claims_immutable_delete BEFORE DELETE ON material_draft_claims BEGIN SELECT RAISE(ABORT, 'material draft claims are immutable'); END;
CREATE TRIGGER material_claim_support_immutable_update BEFORE UPDATE ON material_claim_support BEGIN SELECT RAISE(ABORT, 'material claim support is immutable'); END;
CREATE TRIGGER material_claim_support_immutable_delete BEFORE DELETE ON material_claim_support BEGIN SELECT RAISE(ABORT, 'material claim support is immutable'); END;
CREATE TRIGGER material_draft_handoffs_immutable_update BEFORE UPDATE ON material_draft_handoffs BEGIN SELECT RAISE(ABORT, 'material draft handoffs are immutable'); END;
CREATE TRIGGER material_draft_handoffs_immutable_delete BEFORE DELETE ON material_draft_handoffs BEGIN SELECT RAISE(ABORT, 'material draft handoffs are immutable'); END;
CREATE TRIGGER material_versions_immutable_update BEFORE UPDATE ON material_versions BEGIN SELECT RAISE(ABORT, 'material versions are immutable'); END;
CREATE TRIGGER material_versions_immutable_delete BEFORE DELETE ON material_versions BEGIN SELECT RAISE(ABORT, 'material versions are immutable'); END;
CREATE TRIGGER resume_generation_state_singleton_delete BEFORE DELETE ON resume_generation_state BEGIN SELECT RAISE(ABORT, 'resume generation state cannot be deleted'); END;

CREATE TRIGGER candidate_profile_revisions_linear_parent BEFORE INSERT ON candidate_profile_revisions
WHEN (NEW.revision_number = 1 AND NEW.parent_revision_id IS NOT NULL)
  OR (NEW.revision_number > 1 AND (NEW.parent_revision_id IS NULL
    OR (SELECT profile_id FROM candidate_profile_revisions WHERE id = NEW.parent_revision_id) <> NEW.profile_id
    OR (SELECT revision_number FROM candidate_profile_revisions WHERE id = NEW.parent_revision_id) <> NEW.revision_number - 1
    OR EXISTS (SELECT 1 FROM candidate_profile_revisions WHERE parent_revision_id = NEW.parent_revision_id)))
BEGIN SELECT RAISE(ABORT, 'candidate profile revision must extend the immediately preceding revision'); END;

CREATE TRIGGER material_draft_evidence_requires_approved BEFORE INSERT ON material_draft_evidence
WHEN NOT EXISTS (SELECT 1 FROM evidence_revisions WHERE id = NEW.evidence_revision_id AND review_state = 'approved')
BEGIN SELECT RAISE(ABORT, 'material draft evidence must be approved'); END;

CREATE TRIGGER material_claim_support_requires_approved BEFORE INSERT ON material_claim_support
WHEN NOT EXISTS (SELECT 1 FROM evidence_revisions WHERE id = NEW.evidence_revision_id AND review_state = 'approved')
BEGIN SELECT RAISE(ABORT, 'material claim support must be approved'); END;

CREATE TRIGGER material_drafts_snapshot_integrity BEFORE INSERT ON material_drafts
WHEN NOT EXISTS (SELECT 1 FROM candidate_profile_revisions WHERE id = NEW.profile_revision_id AND content_digest = NEW.profile_content_digest)
  OR NOT EXISTS (SELECT 1 FROM resume_template_sources WHERE id = NEW.template_source_id AND content_digest = NEW.template_content_digest)
  OR (NEW.opportunity_revision_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM captured_opportunity_revisions WHERE id = NEW.opportunity_revision_id AND content_digest = NEW.opportunity_content_digest))
BEGIN SELECT RAISE(ABORT, 'material draft snapshots must match immutable source revisions'); END;

CREATE TRIGGER material_versions_snapshot_integrity BEFORE INSERT ON material_versions
WHEN NOT EXISTS (
  SELECT 1 FROM material_drafts WHERE id = NEW.source_draft_id
    AND profile_content_digest = NEW.profile_content_digest
    AND template_content_digest = NEW.template_content_digest
    AND (opportunity_content_digest IS NEW.opportunity_content_digest)
    AND content_digest = NEW.content_digest
    AND provenance_digest = NEW.provenance_digest
)
BEGIN SELECT RAISE(ABORT, 'material version snapshots must match its source draft'); END;

CREATE TRIGGER resume_generation_state_cas BEFORE UPDATE ON resume_generation_state
WHEN NEW.singleton <> 1 OR NEW.revision_number <> OLD.revision_number + 1
BEGIN SELECT RAISE(ABORT, 'resume generation state requires compare and swap'); END;

CREATE TRIGGER resume_generation_state_verified_template BEFORE UPDATE OF designated_template_id ON resume_generation_state
WHEN NEW.designated_template_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM resume_template_sources WHERE id = NEW.designated_template_id AND origin = 'bundled' AND state = 'verified'
)
BEGIN SELECT RAISE(ABORT, 'only verified bundled resume templates can be designated'); END;
