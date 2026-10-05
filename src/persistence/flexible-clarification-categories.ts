import type { DatabaseSync } from "node:sqlite";

/** Called inside the migration transaction with foreign_keys disabled outside it. */
export function upgradeClarificationCategories(database: DatabaseSync): void {
  for (const table of ["resume_clarification_tasks", "resume_clarified_evidence"]) {
    const definition = database.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?").get(table) as { sql: string } | undefined;
    if (!definition) continue; // The minimal historical compatibility fixture has no workspace.
    const flexible = definition.sql.replace(/(\bcategory\s+TEXT\s+NOT\s+NULL)\s+CHECK\s*\(\s*category\s+IN\s*\([^)]*\)\s*\)/i, "$1");
    if (flexible === definition.sql) continue;
    const dependents = database.prepare("SELECT sql FROM sqlite_master WHERE tbl_name = ? AND type IN ('index', 'trigger') AND sql IS NOT NULL").all(table) as Array<{ sql: string }>;
    const temporary = `${table}_flexible_upgrade`;
    const create = flexible.replace(/^CREATE\s+TABLE\s+(?:"[^"]+"|\w+)/i, `CREATE TABLE "${temporary}"`);
    if (create === flexible) throw new Error(`Cannot rebuild ${table} safely.`);
    const columns = (database.prepare(`PRAGMA table_info("${table}")`).all() as Array<{ name: string }>).map(({ name }) => `"${name.replaceAll('"', '""')}"`).join(", ");
    database.exec(create);
    database.exec(`INSERT INTO "${temporary}" (${columns}) SELECT ${columns} FROM "${table}"`);
    database.exec(`DROP TABLE "${table}"`);
    database.exec(`ALTER TABLE "${temporary}" RENAME TO "${table}"`);
    for (const dependent of dependents) database.exec(dependent.sql);
  }
  if (database.prepare("PRAGMA foreign_key_check").all().length) throw new Error("Clarification category upgrade failed foreign-key validation.");
}
