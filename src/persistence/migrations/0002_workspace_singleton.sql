CREATE TABLE IF NOT EXISTS workspace_singleton (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  id TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT OR IGNORE INTO workspace_singleton (singleton, id, created_at, updated_at)
SELECT 1, id, created_at, updated_at FROM workspace LIMIT 1;
