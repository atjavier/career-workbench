import { DatabaseSync } from "node:sqlite";

import { migrations } from "@/persistence/migrations";
import { upgradeClarificationCategories } from "@/persistence/flexible-clarification-categories";

export function openDatabase(databasePath: string): DatabaseSync {
  const database = new DatabaseSync(databasePath);
  database.exec("PRAGMA foreign_keys = ON;");
  database.exec("PRAGMA busy_timeout = 5000;");
  return database;
}

export function applyMigrations(database: DatabaseSync): void {
  database.exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL);",
  );
  const appliedStatement = database.prepare(
    "SELECT id FROM schema_migrations WHERE id = ?",
  );
  const recordMigration = database.prepare(
    "INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)",
  );

  for (const migration of migrations) {
    if (appliedStatement.get(migration.id)) {
      continue;
    }
    const categoryUpgrade = migration.id === "0049_flexible_clarification_categories";
    const foreignKeys = (database.prepare("PRAGMA foreign_keys").get() as { foreign_keys: number }).foreign_keys;
    // SQLite ignores this PRAGMA inside a transaction. Disable it before BEGIN
    // so dropping a parent table cannot cascade through retained interview history.
    if (categoryUpgrade) database.exec("PRAGMA foreign_keys = OFF;");
    try {
      database.exec("BEGIN IMMEDIATE;");
      // Migration 0028 repairs databases created while material_drafts still
      // used the earlier opportunity_id column. Fresh databases already have
      // the replacement column from 0021, so its ALTER TABLE is intentionally
      // skipped when that column is present.
      if (categoryUpgrade) {
        upgradeClarificationCategories(database);
      } else if (migration.id === "0028_resume_draft_schema_compat") {
        const columns = database
          .prepare("PRAGMA table_info(material_drafts)")
          .all() as Array<{ name?: string }>;
        if (
          !columns.some((column) => column.name === "opportunity_revision_id")
        )
          database.exec(migration.sql);
      } else if (
        [
          "0032_resume_evidence_interpretation_contradictions",
          "0033_resume_workspace_journeys",
          "0034_backfill_resume_workspace_journeys",
          "0035_resume_workspace_journey_fingerprint",
          "0036_resume_clarification_task_responses",
          "0037_resume_clarified_evidence",
          "0038_resume_evidence_packets",
          "0039_resume_interview_turns",
          "0040_resume_interview_candidate_turns",
          "0041_resume_interview_stream_attempts",
          "0042_resume_interview_stream_reservations",
          "0043_resume_interview_stream_request_uuid_compat",
          "0044_editable_tex_drafts",
          "0045_local_model_context_limits",
          "0046_editable_tex_hardening",
        ].includes(migration.id)
      ) {
        // The legacy 0028 compatibility fixture intentionally contains only
        // its material-draft tables. It has no workspace schema to upgrade;
        // avoid rebuilding a table whose foreign-key parent is absent.
        const workspaceTable = database
          .prepare(
            "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'resume_workspaces'",
          )
          .get();
        if (workspaceTable) database.exec(migration.sql);
        else if (migration.id === "0037_resume_clarified_evidence") {
          database.exec("ROLLBACK;");
          continue;
        }
      } else {
        database.exec(migration.sql);
      }
      recordMigration.run(migration.id, new Date().toISOString());
      database.exec("COMMIT;");
    } catch (error) {
      if (database.isTransaction) database.exec("ROLLBACK;");
      throw error;
    } finally {
      if (categoryUpgrade) database.exec(`PRAGMA foreign_keys = ${foreignKeys ? "ON" : "OFF"};`);
    }
  }
}
