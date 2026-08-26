CREATE TABLE ai_opportunity_assessments (
  id TEXT PRIMARY KEY CHECK (id GLOB '????????-????-7???-[89ab]???-????????????'),
  opportunity_id TEXT NOT NULL REFERENCES captured_opportunities(id),
  opportunity_revision_id TEXT NOT NULL REFERENCES captured_opportunity_revisions(id),
  opportunity_content_digest TEXT NOT NULL CHECK (length(opportunity_content_digest) = 71 AND opportunity_content_digest GLOB 'sha256:*'),
  profile_revision_id TEXT NOT NULL REFERENCES candidate_profile_revisions(id),
  profile_content_digest TEXT NOT NULL CHECK (length(profile_content_digest) = 71 AND profile_content_digest GLOB 'sha256:*'),
  template_source_id TEXT NOT NULL REFERENCES resume_template_sources(id),
  template_content_digest TEXT NOT NULL CHECK (length(template_content_digest) = 71 AND template_content_digest GLOB 'sha256:*'),
  model_identifier TEXT NOT NULL CHECK (length(model_identifier) BETWEEN 1 AND 240),
  capability_version TEXT NOT NULL CHECK (capability_version = 'opportunity-assessment-v1'),
  input_fingerprint TEXT NOT NULL UNIQUE CHECK (length(input_fingerprint) = 71 AND input_fingerprint GLOB 'sha256:*'),
  response_json TEXT NOT NULL CHECK (length(response_json) BETWEEN 2 AND 12000),
  content_digest TEXT NOT NULL CHECK (length(content_digest) = 71 AND content_digest GLOB 'sha256:*'),
  created_at TEXT NOT NULL CHECK (strftime('%Y-%m-%dT%H:%M:%fZ', created_at) = created_at)
);
CREATE TABLE ai_opportunity_assessment_evidence (
  assessment_id TEXT NOT NULL REFERENCES ai_opportunity_assessments(id),
  evidence_revision_id TEXT NOT NULL REFERENCES evidence_revisions(id),
  evidence_content_digest TEXT NOT NULL CHECK (length(evidence_content_digest) = 71 AND evidence_content_digest GLOB 'sha256:*'),
  ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
  PRIMARY KEY (assessment_id, evidence_revision_id), UNIQUE (assessment_id, ordinal)
);
CREATE TABLE opportunity_decision_revisions (
  id TEXT PRIMARY KEY CHECK (id GLOB '????????-????-7???-[89ab]???-????????????'),
  opportunity_id TEXT NOT NULL REFERENCES captured_opportunities(id),
  assessment_id TEXT NOT NULL REFERENCES ai_opportunity_assessments(id),
  parent_revision_id TEXT REFERENCES opportunity_decision_revisions(id),
  pursue INTEGER NOT NULL CHECK (pursue IN (0, 1)),
  priority TEXT NOT NULL CHECK (priority IN ('low', 'normal', 'high')),
  content_digest TEXT NOT NULL CHECK (length(content_digest) = 71 AND content_digest GLOB 'sha256:*'),
  created_at TEXT NOT NULL CHECK (strftime('%Y-%m-%dT%H:%M:%fZ', created_at) = created_at)
);
CREATE INDEX ai_opportunity_assessments_opportunity_index ON ai_opportunity_assessments(opportunity_id, created_at DESC);
CREATE INDEX opportunity_decision_revisions_opportunity_index ON opportunity_decision_revisions(opportunity_id, created_at DESC);
CREATE TRIGGER ai_opportunity_assessments_immutable_update BEFORE UPDATE ON ai_opportunity_assessments BEGIN SELECT RAISE(ABORT, 'AI opportunity assessments are immutable'); END;
CREATE TRIGGER ai_opportunity_assessments_immutable_delete BEFORE DELETE ON ai_opportunity_assessments BEGIN SELECT RAISE(ABORT, 'AI opportunity assessments are immutable'); END;
CREATE TRIGGER ai_opportunity_assessment_evidence_immutable_update BEFORE UPDATE ON ai_opportunity_assessment_evidence BEGIN SELECT RAISE(ABORT, 'AI opportunity assessment evidence is immutable'); END;
CREATE TRIGGER ai_opportunity_assessment_evidence_immutable_delete BEFORE DELETE ON ai_opportunity_assessment_evidence BEGIN SELECT RAISE(ABORT, 'AI opportunity assessment evidence is immutable'); END;
CREATE TRIGGER opportunity_decision_revisions_immutable_update BEFORE UPDATE ON opportunity_decision_revisions BEGIN SELECT RAISE(ABORT, 'opportunity decisions are immutable'); END;
CREATE TRIGGER opportunity_decision_revisions_immutable_delete BEFORE DELETE ON opportunity_decision_revisions BEGIN SELECT RAISE(ABORT, 'opportunity decisions are immutable'); END;
CREATE TRIGGER ai_opportunity_assessments_snapshot_integrity BEFORE INSERT ON ai_opportunity_assessments
WHEN NOT EXISTS (SELECT 1 FROM captured_opportunity_revisions WHERE id = NEW.opportunity_revision_id AND opportunity_id = NEW.opportunity_id AND content_digest = NEW.opportunity_content_digest)
 OR NOT EXISTS (SELECT 1 FROM candidate_profile_revisions WHERE id = NEW.profile_revision_id AND content_digest = NEW.profile_content_digest)
 OR NOT EXISTS (SELECT 1 FROM resume_template_sources WHERE id = NEW.template_source_id AND content_digest = NEW.template_content_digest)
BEGIN SELECT RAISE(ABORT, 'AI opportunity assessment snapshots must match immutable sources'); END;
CREATE TRIGGER ai_opportunity_assessment_evidence_requires_approved BEFORE INSERT ON ai_opportunity_assessment_evidence
WHEN NOT EXISTS (SELECT 1 FROM evidence_revisions WHERE id = NEW.evidence_revision_id AND review_state = 'approved' AND content_digest = NEW.evidence_content_digest)
BEGIN SELECT RAISE(ABORT, 'AI opportunity assessment evidence must be approved'); END;
CREATE TRIGGER opportunity_decision_parent BEFORE INSERT ON opportunity_decision_revisions
WHEN (NEW.parent_revision_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM opportunity_decision_revisions WHERE id = NEW.parent_revision_id AND opportunity_id = NEW.opportunity_id))
 OR NOT EXISTS (SELECT 1 FROM ai_opportunity_assessments WHERE id = NEW.assessment_id AND opportunity_id = NEW.opportunity_id)
BEGIN SELECT RAISE(ABORT, 'opportunity decision must extend its opportunity and assessment'); END;
