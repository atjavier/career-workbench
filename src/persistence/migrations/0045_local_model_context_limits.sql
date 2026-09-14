CREATE TABLE local_model_configuration_context_limits (
  configuration_id TEXT PRIMARY KEY REFERENCES local_model_configuration_revisions(id) ON DELETE CASCADE,
  context_limit_tokens INTEGER NOT NULL CHECK (context_limit_tokens BETWEEN 12001 AND 30000),
  observed_at TEXT NOT NULL
);
