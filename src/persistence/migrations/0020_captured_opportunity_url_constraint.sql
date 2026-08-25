DROP TRIGGER captured_opportunity_revisions_immutable_update;
DROP TRIGGER captured_opportunity_revisions_immutable_delete;
DROP INDEX captured_opportunity_revisions_opportunity_index;

ALTER TABLE captured_opportunity_revisions RENAME TO captured_opportunity_revisions_0019;

CREATE TABLE captured_opportunity_revisions (
  id TEXT PRIMARY KEY CHECK (id GLOB '????????-????-7???-[89ab]???-????????????'),
  opportunity_id TEXT NOT NULL REFERENCES captured_opportunities(id),
  captured_at TEXT NOT NULL CHECK (strftime('%Y-%m-%dT%H:%M:%fZ', captured_at) = captured_at),
  original_url TEXT NOT NULL CHECK (length(original_url) BETWEEN 9 AND 2048 AND original_url GLOB 'https://*'),
  copied_description TEXT NOT NULL CHECK (length(copied_description) BETWEEN 80 AND 200000),
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 300), company TEXT NOT NULL CHECK (length(company) BETWEEN 1 AND 300),
  location TEXT NOT NULL CHECK (length(location) BETWEEN 1 AND 300), work_style TEXT NOT NULL CHECK (length(work_style) BETWEEN 1 AND 120),
  requirements TEXT NOT NULL CHECK (length(requirements) BETWEEN 2 AND 20000), posted_at TEXT NOT NULL CHECK (posted_at = 'Unknown' OR strftime('%Y-%m-%dT%H:%M:%fZ', posted_at) = posted_at),
  content_digest TEXT NOT NULL CHECK (length(content_digest) = 71 AND content_digest GLOB 'sha256:*' AND substr(content_digest, 8) NOT GLOB '*[^0-9a-f]*'),
  created_at TEXT NOT NULL CHECK (strftime('%Y-%m-%dT%H:%M:%fZ', created_at) = created_at)
);

INSERT INTO captured_opportunity_revisions SELECT * FROM captured_opportunity_revisions_0019;
DROP TABLE captured_opportunity_revisions_0019;

CREATE INDEX captured_opportunity_revisions_opportunity_index ON captured_opportunity_revisions(opportunity_id);
CREATE TRIGGER captured_opportunity_revisions_immutable_update BEFORE UPDATE ON captured_opportunity_revisions BEGIN SELECT RAISE(ABORT, 'captured opportunity revisions are immutable'); END;
CREATE TRIGGER captured_opportunity_revisions_immutable_delete BEFORE DELETE ON captured_opportunity_revisions BEGIN SELECT RAISE(ABORT, 'captured opportunity revisions are immutable'); END;
