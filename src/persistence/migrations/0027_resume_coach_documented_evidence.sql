-- Resume Coach may use a workspace's directly documented findings without a
-- separate approval click. Rejected and removed evidence remain ineligible.
DROP TRIGGER IF EXISTS material_draft_evidence_requires_approved;
DROP TRIGGER IF EXISTS material_claim_support_requires_approved;
CREATE TRIGGER material_draft_evidence_requires_documented
BEFORE INSERT ON material_draft_evidence
WHEN NOT EXISTS (
  SELECT 1 FROM evidence_revisions
  WHERE id = NEW.evidence_revision_id
    AND review_state IN ('unreviewed', 'approved')
)
BEGIN
  SELECT RAISE(ABORT, 'material draft evidence must be documented');
END;

CREATE TRIGGER material_claim_support_requires_documented
BEFORE INSERT ON material_claim_support
WHEN NOT EXISTS (
  SELECT 1 FROM evidence_revisions
  WHERE id = NEW.evidence_revision_id
    AND review_state IN ('unreviewed', 'approved')
)
BEGIN
  SELECT RAISE(ABORT, 'material claim support must be documented');
END;
