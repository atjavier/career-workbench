import { DatabaseSync } from "node:sqlite";

import { migrations } from "@/persistence/migrations";

export function openDatabase(databasePath: string): DatabaseSync {
  const database = new DatabaseSync(databasePath);
  database.exec("PRAGMA foreign_keys = ON;");
  database.exec("PRAGMA busy_timeout = 5000;");
  return database;
}

export function applyMigrations(database: DatabaseSync): void {
  database.exec("CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL);");
  const appliedStatement = database.prepare("SELECT id FROM schema_migrations WHERE id = ?");
  const recordMigration = database.prepare("INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)");

  for (const migration of migrations) {
    if (appliedStatement.get(migration.id)) {
      continue;
    }
    database.exec("BEGIN IMMEDIATE;");
    try {
      // Migration 0028 repairs databases created while material_drafts still
      // used the earlier opportunity_id column. Fresh databases already have
      // the replacement column from 0021, so its ALTER TABLE is intentionally
      // skipped when that column is present.
      if (migration.id === "0028_resume_draft_schema_compat") {
        const columns = database.prepare("PRAGMA table_info(material_drafts)").all() as Array<{ name?: string }>;
        if (!columns.some((column) => column.name === "opportunity_revision_id")) database.exec(migration.sql);
      } else {
        database.exec(migration.sql);
      }
      recordMigration.run(migration.id, new Date().toISOString());
      database.exec("COMMIT;");
    } catch (error) {
      database.exec("ROLLBACK;");
      throw error;
    }
  }
}
