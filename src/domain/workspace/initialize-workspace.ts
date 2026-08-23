import { createAuditEvent, createUuidV7, type AuditEvent } from "@/audit/audit-event";
import { appendFile } from "node:fs/promises";
import { join } from "node:path";
import { resolveAppDataPaths } from "@/files/app-data";
import { applyMigrations, openDatabase } from "@/persistence/database";
import { appendAuditEvent, createWorkspace, findWorkspace } from "@/persistence/workspace-repository";

export type WorkspaceInitialization = {
  workspaceId: string;
  databasePath: string;
  initialization: "created" | "validated";
  auditEvent: AuditEvent;
};

export async function initializeWorkspace(options: { appDataRoot?: string } = {}): Promise<WorkspaceInitialization> {
  const paths = await resolveAppDataPaths(options.appDataRoot);

  try {
    const database = openDatabase(paths.databasePath);
    try {
    applyMigrations(database);
    database.exec("BEGIN IMMEDIATE;");
    try {
      const existingWorkspace = findWorkspace(database);
      const initialization = existingWorkspace ? "validated" : "created";
      const workspaceId = existingWorkspace?.id ?? createUuidV7();
      const timestamp = new Date().toISOString();
      if (!existingWorkspace) {
        createWorkspace(database, workspaceId, timestamp);
      }
      const auditEvent = createAuditEvent({
        actor: "local-os-user",
        action: initialization === "created" ? "workspace.initialized" : "workspace.validated",
        outcome: "success",
        entityId: workspaceId,
      });
      appendAuditEvent(database, auditEvent);
      database.exec("COMMIT;");

      return { workspaceId, databasePath: paths.databasePath, initialization, auditEvent };
    } catch (error) {
      database.exec("ROLLBACK;");
      throw error;
    }
    } finally {
      database.close();
    }
  } catch (error) {
    const failureEvent = createAuditEvent({ actor: "local-os-user", action: "workspace.initialized", outcome: "failure" });
    await appendFile(join(paths.root, "workspace-init-audit.jsonl"), `${JSON.stringify(failureEvent)}\n`, "utf8").catch(() => undefined);
    throw error;
  }
}
