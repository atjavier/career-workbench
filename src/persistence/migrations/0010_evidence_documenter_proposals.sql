CREATE TABLE evidence_documenter_proposal_sets (
  id TEXT PRIMARY KEY CHECK (id GLOB '????????-????-7???-[89ab]???-????????????'),
  source_digest TEXT NOT NULL CHECK (length(source_digest) = 71 AND source_digest GLOB 'sha256:*' AND substr(source_digest, 8) NOT GLOB '*[^0-9a-f]*'),
  created_at TEXT NOT NULL,
  UNIQUE (source_digest)
);
CREATE TABLE evidence_documenter_proposals (
  id TEXT PRIMARY KEY CHECK (id GLOB '????????-????-7???-[89ab]???-????????????'),
  proposal_set_id TEXT NOT NULL REFERENCES evidence_documenter_proposal_sets(id),
  factual_text TEXT NOT NULL CHECK (length(trim(factual_text)) BETWEEN 1 AND 5000),
  source_references TEXT NOT NULL CHECK (length(source_references) BETWEEN 2 AND 10000 AND source_references NOT LIKE '%\\%' AND source_references NOT LIKE '%..%'),
  unknowns TEXT NOT NULL CHECK (length(unknowns) <= 10000),
  content_digest TEXT NOT NULL CHECK (length(content_digest) = 71 AND content_digest GLOB 'sha256:*' AND substr(content_digest, 8) NOT GLOB '*[^0-9a-f]*'),
  created_at TEXT NOT NULL,
  UNIQUE (proposal_set_id, content_digest)
);
CREATE TABLE evidence_documenter_proposal_decisions (
  id TEXT PRIMARY KEY CHECK (id GLOB '????????-????-7???-[89ab]???-????????????'),
  proposal_id TEXT NOT NULL UNIQUE REFERENCES evidence_documenter_proposals(id),
  decision TEXT NOT NULL CHECK (decision IN ('accepted', 'edited', 'rejected')),
  factual_text TEXT,
  evidence_revision_id TEXT UNIQUE REFERENCES evidence_revisions(id),
  created_at TEXT NOT NULL,
  CHECK ((decision = 'rejected' AND factual_text IS NULL AND evidence_revision_id IS NULL) OR (decision IN ('accepted', 'edited') AND length(trim(factual_text)) BETWEEN 1 AND 5000 AND evidence_revision_id IS NOT NULL))
);
CREATE TRIGGER evidence_documenter_sets_immutable_update BEFORE UPDATE ON evidence_documenter_proposal_sets BEGIN SELECT RAISE(ABORT, 'documenter proposal sets are immutable'); END;
CREATE TRIGGER evidence_documenter_sets_immutable_delete BEFORE DELETE ON evidence_documenter_proposal_sets BEGIN SELECT RAISE(ABORT, 'documenter proposal sets are immutable'); END;
CREATE TRIGGER evidence_documenter_proposals_immutable_update BEFORE UPDATE ON evidence_documenter_proposals BEGIN SELECT RAISE(ABORT, 'documenter proposals are immutable'); END;
CREATE TRIGGER evidence_documenter_proposals_immutable_delete BEFORE DELETE ON evidence_documenter_proposals BEGIN SELECT RAISE(ABORT, 'documenter proposals are immutable'); END;
CREATE TRIGGER evidence_documenter_decisions_immutable_update BEFORE UPDATE ON evidence_documenter_proposal_decisions BEGIN SELECT RAISE(ABORT, 'documenter proposal decisions are immutable'); END;
CREATE TRIGGER evidence_documenter_decisions_immutable_delete BEFORE DELETE ON evidence_documenter_proposal_decisions BEGIN SELECT RAISE(ABORT, 'documenter proposal decisions are immutable'); END;
