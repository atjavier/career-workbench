import type { DatabaseSync } from "node:sqlite";

export type StoredSourceConfigurationRevision = {
  id: string;
  sourceId: string;
  revisionNumber: number;
  name: string;
  sourceType: string;
  url: string;
  accessPath: string;
  policyRevision: string;
  policyReviewedOn: string;
  policyApproved: number;
  requestBudget: number;
  rateLimitPerMinute: number;
  retentionRule: string;
  enabled: number;
  failureGuidance: string;
  contentDigest: string;
  createdAt: string;
};

function map(row: Record<string, unknown>): StoredSourceConfigurationRevision {
  return {
    id: String(row.id),
    sourceId: String(row.source_id),
    revisionNumber: Number(row.revision_number),
    name: String(row.name),
    sourceType: String(row.source_type),
    url: String(row.url),
    accessPath: String(row.access_path),
    policyRevision: String(row.policy_revision),
    policyReviewedOn: String(row.policy_reviewed_on),
    policyApproved: Number(row.policy_approved),
    requestBudget: Number(row.request_budget),
    rateLimitPerMinute: Number(row.rate_limit_per_minute),
    retentionRule: String(row.retention_rule),
    enabled: Number(row.enabled),
    failureGuidance: String(row.failure_guidance),
    contentDigest: String(row.content_digest),
    createdAt: String(row.created_at),
  };
}

const selectCurrent =
  "SELECT r.id, r.source_id, r.revision_number, r.name, r.source_type, r.url, r.access_path, r.policy_revision, r.policy_reviewed_on, r.policy_approved, r.request_budget, r.rate_limit_per_minute, r.retention_rule, r.enabled, r.failure_guidance, r.content_digest, r.created_at FROM source_configurations_current c JOIN source_configuration_revisions r ON r.id = c.revision_id";

export function listCurrentSourceConfigurationRevisions(
  database: DatabaseSync,
): StoredSourceConfigurationRevision[] {
  return (
    database
      .prepare(`${selectCurrent} ORDER BY r.name COLLATE NOCASE`)
      .all() as Record<string, unknown>[]
  ).map(map);
}
export function currentSourceConfigurationRevision(
  database: DatabaseSync,
  sourceId: string,
): StoredSourceConfigurationRevision | undefined {
  const row = database
    .prepare(`${selectCurrent} WHERE c.source_id = ?`)
    .get(sourceId) as Record<string, unknown> | undefined;
  return row ? map(row) : undefined;
}
export function insertSourceConfigurationRevision(
  database: DatabaseSync,
  value: StoredSourceConfigurationRevision,
): void {
  database
    .prepare(
      "INSERT INTO source_configuration_revisions (id, source_id, revision_number, name, source_type, url, access_path, policy_revision, policy_reviewed_on, policy_approved, request_budget, rate_limit_per_minute, retention_rule, enabled, failure_guidance, content_digest, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .run(
      value.id,
      value.sourceId,
      value.revisionNumber,
      value.name,
      value.sourceType,
      value.url,
      value.accessPath,
      value.policyRevision,
      value.policyReviewedOn,
      value.policyApproved,
      value.requestBudget,
      value.rateLimitPerMinute,
      value.retentionRule,
      value.enabled,
      value.failureGuidance,
      value.contentDigest,
      value.createdAt,
    );
}
export function setCurrentSourceConfigurationRevision(
  database: DatabaseSync,
  sourceId: string,
  revisionId: string,
  updatedAt: string,
): void {
  database
    .prepare(
      "INSERT INTO source_configurations_current (source_id, revision_id, updated_at) VALUES (?, ?, ?) ON CONFLICT(source_id) DO UPDATE SET revision_id = excluded.revision_id, updated_at = excluded.updated_at",
    )
    .run(sourceId, revisionId, updatedAt);
}
