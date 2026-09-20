import type { DatabaseSync } from "node:sqlite";

export type StoredJobPreferenceRevision = {
  id: string;
  revisionNumber: number;
  roleIntents: string;
  country: string;
  workStyleOrder: string;
  preferNcrHybridOnsite: number;
  contentDigest: string;
  createdAt: string;
};

function map(row: Record<string, unknown>): StoredJobPreferenceRevision {
  return {
    id: String(row.id),
    revisionNumber: Number(row.revision_number),
    roleIntents: String(row.role_intents),
    country: String(row.country),
    workStyleOrder: String(row.work_style_order),
    preferNcrHybridOnsite: Number(row.prefer_ncr_hybrid_onsite),
    contentDigest: String(row.content_digest),
    createdAt: String(row.created_at),
  };
}

export function currentJobPreferenceRevision(
  database: DatabaseSync,
): StoredJobPreferenceRevision | undefined {
  const row = database
    .prepare(
      "SELECT r.id, r.revision_number, r.role_intents, r.country, r.work_style_order, r.prefer_ncr_hybrid_onsite, r.content_digest, r.created_at FROM job_preferences_current c JOIN job_preference_revisions r ON r.id = c.revision_id WHERE c.singleton = 1",
    )
    .get() as Record<string, unknown> | undefined;
  return row ? map(row) : undefined;
}

export function insertJobPreferenceRevision(
  database: DatabaseSync,
  value: StoredJobPreferenceRevision,
): void {
  database
    .prepare(
      "INSERT INTO job_preference_revisions (id, revision_number, role_intents, country, work_style_order, prefer_ncr_hybrid_onsite, content_digest, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .run(
      value.id,
      value.revisionNumber,
      value.roleIntents,
      value.country,
      value.workStyleOrder,
      value.preferNcrHybridOnsite,
      value.contentDigest,
      value.createdAt,
    );
}

export function setCurrentJobPreferenceRevision(
  database: DatabaseSync,
  revisionId: string,
  updatedAt: string,
): void {
  database
    .prepare(
      "INSERT INTO job_preferences_current (singleton, revision_id, updated_at) VALUES (1, ?, ?) ON CONFLICT(singleton) DO UPDATE SET revision_id = excluded.revision_id, updated_at = excluded.updated_at",
    )
    .run(revisionId, updatedAt);
}
