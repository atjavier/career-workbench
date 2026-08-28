-- Older local databases created material_drafts with opportunity_id.  The
-- current draft contract snapshots a specific opportunity revision instead;
-- add that column without rewriting or deleting any existing draft rows.
ALTER TABLE material_drafts ADD COLUMN opportunity_revision_id TEXT REFERENCES captured_opportunity_revisions(id);

-- Preserve an existing opportunity association when a matching revision is
-- available.  Drafts without a resolvable revision remain valid base drafts.
UPDATE material_drafts
SET opportunity_revision_id = (
  SELECT r.id
  FROM captured_opportunity_revisions r
  WHERE r.opportunity_id = material_drafts.opportunity_id
  ORDER BY r.created_at DESC, r.id DESC
  LIMIT 1
)
WHERE opportunity_id IS NOT NULL;
