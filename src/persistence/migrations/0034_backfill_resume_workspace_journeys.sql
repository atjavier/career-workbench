INSERT OR IGNORE INTO resume_workspace_journeys (id, workspace_id, phase, next_action, message, state_revision, created_at, updated_at)
SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-7' || substr(lower(hex(randomblob(2))), 2) || '-8' || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))), id, 'onboarding', 'complete_profile', 'Resume journey needs to be reconciled.', 1, created_at, updated_at
FROM resume_workspaces;
