CREATE TABLE captured_fit_assessments (
  id TEXT PRIMARY KEY CHECK (id GLOB '????????-????-7???-[89ab]???-????????????'),
  opportunity_id TEXT NOT NULL REFERENCES captured_opportunities(id),
  opportunity_revision_id TEXT NOT NULL REFERENCES captured_opportunity_revisions(id),
  opportunity_content_digest TEXT NOT NULL CHECK (length(opportunity_content_digest) = 71 AND opportunity_content_digest GLOB 'sha256:*'),
  preference_revision_id TEXT NOT NULL REFERENCES job_preference_revisions(id),
  preference_content_digest TEXT NOT NULL CHECK (length(preference_content_digest) = 71 AND preference_content_digest GLOB 'sha256:*'),
  ruleset_id TEXT NOT NULL CHECK (length(ruleset_id) BETWEEN 1 AND 80),
  ruleset_version TEXT NOT NULL CHECK (length(ruleset_version) BETWEEN 1 AND 40),
  ruleset_digest TEXT NOT NULL CHECK (length(ruleset_digest) = 71 AND ruleset_digest GLOB 'sha256:*'),
  opportunity_snapshot TEXT NOT NULL CHECK (length(opportunity_snapshot) BETWEEN 2 AND 500000),
  preference_snapshot TEXT NOT NULL CHECK (length(preference_snapshot) BETWEEN 2 AND 200000),
  factor_outcomes TEXT NOT NULL CHECK (length(factor_outcomes) BETWEEN 2 AND 100000),
  label TEXT NOT NULL CHECK (label IN ('Strong', 'Potential', 'Stretch')),
  confidence TEXT NOT NULL CHECK (confidence IN ('high', 'medium', 'low')),
  calculated_at TEXT NOT NULL CHECK (strftime('%Y-%m-%dT%H:%M:%fZ', calculated_at) = calculated_at),
  content_digest TEXT NOT NULL CHECK (length(content_digest) = 71 AND content_digest GLOB 'sha256:*')
);
CREATE TABLE captured_fit_assessment_evidence (
  assessment_id TEXT NOT NULL REFERENCES captured_fit_assessments(id),
  evidence_revision_id TEXT NOT NULL REFERENCES evidence_revisions(id),
  evidence_content_digest TEXT NOT NULL CHECK (length(evidence_content_digest) = 71 AND evidence_content_digest GLOB 'sha256:*'),
  ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
  PRIMARY KEY (assessment_id, evidence_revision_id), UNIQUE (assessment_id, ordinal)
);
CREATE INDEX captured_fit_assessments_opportunity_index ON captured_fit_assessments(opportunity_id, calculated_at DESC, id DESC);
CREATE TRIGGER captured_fit_assessments_immutable_update BEFORE UPDATE ON captured_fit_assessments BEGIN SELECT RAISE(ABORT, 'captured fit assessments are immutable'); END;
CREATE TRIGGER captured_fit_assessments_immutable_delete BEFORE DELETE ON captured_fit_assessments BEGIN SELECT RAISE(ABORT, 'captured fit assessments are immutable'); END;
CREATE TRIGGER captured_fit_assessment_evidence_immutable_update BEFORE UPDATE ON captured_fit_assessment_evidence BEGIN SELECT RAISE(ABORT, 'captured fit assessment evidence is immutable'); END;
CREATE TRIGGER captured_fit_assessment_evidence_immutable_delete BEFORE DELETE ON captured_fit_assessment_evidence BEGIN SELECT RAISE(ABORT, 'captured fit assessment evidence is immutable'); END;
CREATE TRIGGER captured_fit_assessments_snapshot_integrity BEFORE INSERT ON captured_fit_assessments
WHEN NOT EXISTS (SELECT 1 FROM captured_opportunity_revisions WHERE id = NEW.opportunity_revision_id AND opportunity_id = NEW.opportunity_id AND content_digest = NEW.opportunity_content_digest)
 OR NOT EXISTS (SELECT 1 FROM job_preference_revisions WHERE id = NEW.preference_revision_id AND content_digest = NEW.preference_content_digest)
BEGIN SELECT RAISE(ABORT, 'captured fit assessment snapshots must match immutable sources'); END;
CREATE TRIGGER captured_fit_assessment_evidence_requires_approved BEFORE INSERT ON captured_fit_assessment_evidence
WHEN NOT EXISTS (SELECT 1 FROM evidence_revisions WHERE id = NEW.evidence_revision_id AND review_state = 'approved' AND content_digest = NEW.evidence_content_digest)
BEGIN SELECT RAISE(ABORT, 'captured fit assessment evidence must be approved'); END;
