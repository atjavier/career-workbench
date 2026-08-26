import type { DatabaseSync } from "node:sqlite";

export type StoredCapturedOpportunity = { id: string; duplicateKey: string; createdAt: string };
export type StoredCapturedRevision = { id: string; opportunityId: string; capturedAt: string; originalUrl: string; copiedDescription: string; title: string; company: string; location: string; workStyle: string; requirements: string; postedAt: string; contentDigest: string; createdAt: string };
const validUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const validDigest = (value: string) => /^sha256:[0-9a-f]{64}$/i.test(value);
const validTimestamp = (value: string) => !Number.isNaN(new Date(value).getTime()) && new Date(value).toISOString() === value;
const validText = (value: unknown, maximum: number) => typeof value === "string" && value.length > 0 && value.length <= maximum;

function invalidStoredRow(): never { throw new Error("Stored captured opportunity row is invalid"); }

function opportunity(row: StoredCapturedOpportunity): StoredCapturedOpportunity {
  if (!validUuid(row.id) || !validText(row.duplicateKey, 700) || row.duplicateKey.length < 3 || !validTimestamp(row.createdAt)) invalidStoredRow();
  return row;
}

function revision(row: StoredCapturedRevision): StoredCapturedRevision {
  if (!validUuid(row.id) || !validUuid(row.opportunityId) || !validTimestamp(row.capturedAt) || !validTimestamp(row.createdAt) || !validDigest(row.contentDigest) || !validText(row.originalUrl, 2048) || row.originalUrl.length < 9 || !validText(row.copiedDescription, 200000) || row.copiedDescription.length < 80 || !validText(row.title, 300) || !validText(row.company, 300) || !validText(row.location, 300) || !validText(row.workStyle, 120) || !validText(row.requirements, 20000) || row.requirements.length < 2 || (row.postedAt !== "Unknown" && !validTimestamp(row.postedAt))) invalidStoredRow();
  try {
    const parsedUrl = new URL(row.originalUrl);
    if (parsedUrl.protocol !== "https:" || parsedUrl.username || parsedUrl.password || parsedUrl.toString() !== row.originalUrl) invalidStoredRow();
  } catch { invalidStoredRow(); }
  parseStoredRequirements(row.requirements);
  return row;
}

export function parseStoredRequirements(value: string): string[] {
  try {
    const requirements = JSON.parse(value);
    if (!Array.isArray(requirements) || requirements.length < 1 || requirements.length > 20 || requirements.some((item) => !validText(item, 1000) || item !== item.replace(/\s+/g, " ").trim())) invalidStoredRow();
    return requirements;
  } catch { invalidStoredRow(); }
}
export function insertCapturedOpportunity(db: DatabaseSync, row: StoredCapturedOpportunity) { db.prepare("INSERT INTO captured_opportunities (id, duplicate_key, created_at) VALUES (?, ?, ?)").run(row.id, row.duplicateKey, row.createdAt); }
export function insertCapturedRevision(db: DatabaseSync, row: StoredCapturedRevision) { db.prepare("INSERT INTO captured_opportunity_revisions (id, opportunity_id, captured_at, original_url, copied_description, title, company, location, work_style, requirements, posted_at, content_digest, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(row.id, row.opportunityId, row.capturedAt, row.originalUrl, row.copiedDescription, row.title, row.company, row.location, row.workStyle, row.requirements, row.postedAt, row.contentDigest, row.createdAt); }
export function findCapturedOpportunityByDuplicateKey(db: DatabaseSync, duplicateKey: string): StoredCapturedOpportunity | undefined { const row = db.prepare("SELECT id, duplicate_key AS duplicateKey, created_at AS createdAt FROM captured_opportunities WHERE duplicate_key = ? ORDER BY created_at LIMIT 1").get(duplicateKey) as StoredCapturedOpportunity | undefined; return row ? opportunity(row) : undefined; }
export function insertDuplicateSuggestion(db: DatabaseSync, row: { id: string; opportunityId: string; probableDuplicateOpportunityId: string; createdAt: string; contentDigest: string }) { db.prepare("INSERT INTO captured_opportunity_duplicate_suggestions (id, opportunity_id, probable_duplicate_opportunity_id, created_at, content_digest) VALUES (?, ?, ?, ?, ?)").run(row.id, row.opportunityId, row.probableDuplicateOpportunityId, row.createdAt, row.contentDigest); }
export function listCapturedRevisions(db: DatabaseSync, opportunityId: string): StoredCapturedRevision[] { return (db.prepare("SELECT id, opportunity_id AS opportunityId, captured_at AS capturedAt, original_url AS originalUrl, copied_description AS copiedDescription, title, company, location, work_style AS workStyle, requirements, posted_at AS postedAt, content_digest AS contentDigest, created_at AS createdAt FROM captured_opportunity_revisions WHERE opportunity_id = ? ORDER BY created_at").all(opportunityId) as StoredCapturedRevision[]).map(revision); }
export function findCapturedRevision(db: DatabaseSync, revisionId: string): StoredCapturedRevision | undefined { const row = db.prepare("SELECT id, opportunity_id AS opportunityId, captured_at AS capturedAt, original_url AS originalUrl, copied_description AS copiedDescription, title, company, location, work_style AS workStyle, requirements, posted_at AS postedAt, content_digest AS contentDigest, created_at AS createdAt FROM captured_opportunity_revisions WHERE id = ?").get(revisionId) as StoredCapturedRevision | undefined; return row ? revision(row) : undefined; }
export function listCapturedOpportunities(db: DatabaseSync): StoredCapturedOpportunity[] { return (db.prepare("SELECT id, duplicate_key AS duplicateKey, created_at AS createdAt FROM captured_opportunities ORDER BY created_at DESC").all() as StoredCapturedOpportunity[]).map(opportunity); }
