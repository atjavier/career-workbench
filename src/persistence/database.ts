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
      database.exec(migration.sql);
      recordMigration.run(migration.id, new Date().toISOString());
      database.exec("COMMIT;");
    } catch (error) {
      database.exec("ROLLBACK;");
      throw error;
    }
  }
}
