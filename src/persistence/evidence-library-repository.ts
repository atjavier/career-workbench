import type { DatabaseSync } from "node:sqlite";

export type EvidenceLibraryDocument = { id: string; category: "project" | "experience"; libraryPath: string; contentDigest: string; importedAt: string };

export function findImport(database: DatabaseSync, sourceIdentity: string, sourceDigest: string): { id: string } | undefined {
  return database.prepare("SELECT id FROM evidence_library_imports WHERE source_identity = ? AND source_digest = ?").get(sourceIdentity, sourceDigest) as { id: string } | undefined;
}
export function insertImport(database: DatabaseSync, value: { id: string; category: "project" | "experience" | "refresh"; sourceIdentity: string; sourceDigest: string; createdAt: string }): void {
  database.prepare("INSERT INTO evidence_library_imports (id, category, source_identity, source_digest, library_root, created_at) VALUES (?, ?, ?, ?, 'resume-evidence', ?)").run(value.id, value.category, value.sourceIdentity, value.sourceDigest, value.createdAt);
}
export function findDocumentByPath(database: DatabaseSync, libraryPath: string): EvidenceLibraryDocument | undefined {
  const row = database.prepare("SELECT id, category, library_path, content_digest, imported_at FROM evidence_library_documents WHERE library_path = ? ORDER BY imported_at DESC LIMIT 1").get(libraryPath) as Record<string, string> | undefined;
  return row && { id: row.id, category: row.category as EvidenceLibraryDocument["category"], libraryPath: row.library_path, contentDigest: row.content_digest, importedAt: row.imported_at };
}
export function findDocumentByPathAndDigest(database: DatabaseSync, libraryPath: string, contentDigest: string): EvidenceLibraryDocument | undefined {
  const row = database.prepare("SELECT id, category, library_path, content_digest, imported_at FROM evidence_library_documents WHERE library_path = ? AND content_digest = ? LIMIT 1").get(libraryPath, contentDigest) as Record<string, string> | undefined;
  return row && { id: row.id, category: row.category as EvidenceLibraryDocument["category"], libraryPath: row.library_path, contentDigest: row.content_digest, importedAt: row.imported_at };
}
export function insertDocument(database: DatabaseSync, value: EvidenceLibraryDocument & { importId?: string }): void {
  database.prepare("INSERT INTO evidence_library_documents (id, import_id, category, library_path, content_digest, imported_at) VALUES (?, ?, ?, ?, ?, ?)").run(value.id, value.importId ?? null, value.category, value.libraryPath, value.contentDigest, value.importedAt);
}
export function candidateExists(database: DatabaseSync, documentId: string, sourceSection: string, lineNumber: number, contentDigest: string): boolean {
  return Boolean(database.prepare("SELECT 1 FROM evidence_library_candidates WHERE document_id = ? AND source_section = ? AND line_number = ? AND content_digest = ?").get(documentId, sourceSection, lineNumber, contentDigest));
}
export function insertCandidate(database: DatabaseSync, value: { documentId: string; sourceSection: string; lineNumber: number; contentDigest: string; evidenceRevisionId: string }): void {
  database.prepare("INSERT INTO evidence_library_candidates (document_id, source_section, line_number, content_digest, evidence_revision_id) VALUES (?, ?, ?, ?, ?)").run(value.documentId, value.sourceSection, value.lineNumber, value.contentDigest, value.evidenceRevisionId);
}
export function listLibraryDocuments(database: DatabaseSync): EvidenceLibraryDocument[] {
  return (database.prepare("SELECT id, category, library_path, content_digest, imported_at FROM evidence_library_documents ORDER BY imported_at DESC, library_path").all() as Record<string, string>[]).map((row) => ({ id: row.id, category: row.category as EvidenceLibraryDocument["category"], libraryPath: row.library_path, contentDigest: row.content_digest, importedAt: row.imported_at }));
}
