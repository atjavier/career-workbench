import type { DatabaseSync } from "node:sqlite";

export type StoredRefreshRun = {
  id: string;
  selectedSourceCount: number;
  status: "running" | "completed" | "partial" | "failed";
  contentDigest: string;
  startedAt: string;
  completedAt?: string;
};
export type StoredRefreshSourceOutcome = {
  id: string;
  refreshRunId: string;
  sourceId: string;
  sourceConfigurationRevisionId: string;
  status:
    "running" | "completed" | "partial" | "failed" | "blocked" | "throttled";
  requestCount: number;
  recoveryGuidance: string;
  contentDigest: string;
  startedAt: string;
  completedAt?: string;
};

function run(row: Record<string, unknown>): StoredRefreshRun {
  return {
    id: String(row.id),
    selectedSourceCount: Number(row.selected_source_count),
    status: String(row.status) as StoredRefreshRun["status"],
    contentDigest: String(row.content_digest),
    startedAt: String(row.started_at),
    completedAt: row.completed_at ? String(row.completed_at) : undefined,
  };
}
function outcome(row: Record<string, unknown>): StoredRefreshSourceOutcome {
  return {
    id: String(row.id),
    refreshRunId: String(row.refresh_run_id),
    sourceId: String(row.source_id),
    sourceConfigurationRevisionId: String(row.source_configuration_revision_id),
    status: String(row.status) as StoredRefreshSourceOutcome["status"],
    requestCount: Number(row.request_count),
    recoveryGuidance: String(row.recovery_guidance),
    contentDigest: String(row.content_digest),
    startedAt: String(row.started_at),
    completedAt: row.completed_at ? String(row.completed_at) : undefined,
  };
}
export function insertRefreshRun(
  database: DatabaseSync,
  value: StoredRefreshRun,
): void {
  database
    .prepare(
      "INSERT INTO refresh_runs (id, selected_source_count, status, content_digest, started_at, completed_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .run(
      value.id,
      value.selectedSourceCount,
      value.status,
      value.contentDigest,
      value.startedAt,
      value.completedAt ?? null,
    );
}
export function finalizeRefreshRun(
  database: DatabaseSync,
  id: string,
  status: "completed" | "partial" | "failed",
  completedAt: string,
): void {
  database
    .prepare(
      "UPDATE refresh_runs SET status = ?, completed_at = ? WHERE id = ?",
    )
    .run(status, completedAt, id);
}
export function failRefreshRun(
  database: DatabaseSync,
  id: string,
  completedAt: string,
): void {
  database
    .prepare(
      "UPDATE refresh_runs SET status = 'failed', completed_at = ? WHERE id = ? AND status = 'running'",
    )
    .run(completedAt, id);
}
export function insertRefreshSourceOutcome(
  database: DatabaseSync,
  value: StoredRefreshSourceOutcome,
): void {
  database
    .prepare(
      "INSERT INTO refresh_source_outcomes (id, refresh_run_id, source_id, source_configuration_revision_id, status, request_count, recovery_guidance, content_digest, started_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .run(
      value.id,
      value.refreshRunId,
      value.sourceId,
      value.sourceConfigurationRevisionId,
      value.status,
      value.requestCount,
      value.recoveryGuidance,
      value.contentDigest,
      value.startedAt,
      value.completedAt ?? null,
    );
}
export function listRefreshRuns(
  database: DatabaseSync,
): Array<StoredRefreshRun & { outcomes: StoredRefreshSourceOutcome[] }> {
  return (
    database
      .prepare("SELECT * FROM refresh_runs ORDER BY started_at DESC")
      .all() as Record<string, unknown>[]
  ).map((row) => {
    const value = run(row);
    return {
      ...value,
      outcomes: (
        database
          .prepare(
            "SELECT * FROM refresh_source_outcomes WHERE refresh_run_id = ? ORDER BY started_at",
          )
          .all(value.id) as Record<string, unknown>[]
      ).map(outcome),
    };
  });
}
