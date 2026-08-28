import type { DatabaseSync } from "node:sqlite";

export type ResumeTemplateSource = { id: string; origin: "bundled" | "legacy_current_base_resume"; state: "verified" | "legacy_candidate"; filename: string; contentType: "application/pdf"; contentDigest: string; byteSize: number; storageLocation: string; legacySourceId?: string; createdAt: string };

const columns = "id, origin, state, filename, content_type, content_digest, byte_size, storage_location, legacy_source_id, created_at";
function source(row: Record<string, unknown>): ResumeTemplateSource {
  return { id: String(row.id), origin: row.origin as ResumeTemplateSource["origin"], state: row.state as ResumeTemplateSource["state"], filename: String(row.filename), contentType: "application/pdf", contentDigest: String(row.content_digest), byteSize: Number(row.byte_size), storageLocation: String(row.storage_location), legacySourceId: row.legacy_source_id ? String(row.legacy_source_id) : undefined, createdAt: String(row.created_at) };
}

export function findDesignatedResumeTemplate(db: DatabaseSync): ResumeTemplateSource | undefined {
  const row = db.prepare(`SELECT ${columns} FROM resume_template_sources source JOIN resume_generation_state state ON state.designated_template_id = source.id WHERE state.singleton = 1`).get() as Record<string, unknown> | undefined;
  return row ? source(row) : undefined;
}

export function findResumeTemplateById(db: DatabaseSync, id: string, contentDigest: string): ResumeTemplateSource | undefined {
  const row = db.prepare(`SELECT ${columns} FROM resume_template_sources WHERE id = ? AND content_digest = ? AND origin = 'bundled' AND state = 'verified'`).get(id, contentDigest) as Record<string, unknown> | undefined;
  return row ? source(row) : undefined;
}

export function findBundledResumeTemplateByDigest(db: DatabaseSync, contentDigest: string): ResumeTemplateSource | undefined {
  const row = db.prepare(`SELECT ${columns} FROM resume_template_sources WHERE origin = 'bundled' AND state = 'verified' AND content_digest = ? ORDER BY created_at ASC LIMIT 1`).get(contentDigest) as Record<string, unknown> | undefined;
  return row ? source(row) : undefined;
}

export function insertResumeTemplateSource(db: DatabaseSync, item: ResumeTemplateSource): void {
  db.prepare("INSERT INTO resume_template_sources (id, origin, state, filename, content_type, content_digest, byte_size, storage_location, legacy_source_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .run(item.id, item.origin, item.state, item.filename, item.contentType, item.contentDigest, item.byteSize, item.storageLocation, item.legacySourceId ?? null, item.createdAt);
}

export function designateResumeTemplate(db: DatabaseSync, expectedRevisionNumber: number, templateId: string, updatedAt: string): boolean {
  const result = db.prepare("UPDATE resume_generation_state SET designated_template_id = ?, revision_number = revision_number + 1, updated_at = ? WHERE singleton = 1 AND revision_number = ?").run(templateId, updatedAt, expectedRevisionNumber);
  return result.changes === 1;
}
