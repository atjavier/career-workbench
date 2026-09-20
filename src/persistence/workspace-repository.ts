import type { DatabaseSync } from "node:sqlite";

import type { AuditEvent } from "@/audit/audit-event";

type WorkspaceRow = { id: string };

export function findWorkspace(
  database: DatabaseSync,
): WorkspaceRow | undefined {
  return database
    .prepare("SELECT id FROM workspace_singleton WHERE singleton = 1")
    .get() as WorkspaceRow | undefined;
}

export function createWorkspace(
  database: DatabaseSync,
  id: string,
  timestamp: string,
): void {
  database
    .prepare(
      "INSERT INTO workspace_singleton (singleton, id, created_at, updated_at) VALUES (1, ?, ?, ?)",
    )
    .run(id, timestamp, timestamp);
}

export function appendAuditEvent(
  database: DatabaseSync,
  event: AuditEvent,
): void {
  database
    .prepare(
      "INSERT INTO audit_events (id, occurred_at, actor, entity_id, action, outcome, content_hash) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .run(
      event.id,
      event.occurredAt,
      event.actor,
      event.entityId ?? null,
      event.action,
      event.outcome,
      event.contentHash ?? null,
    );
}
