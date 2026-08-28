import type { DatabaseSync } from "node:sqlite";

export type ResumeWorkspace = { id: string; name: string; activeProfileRevisionId?: string; createdAt: string; updatedAt: string };
type Row = { id: string; name: string; active_profile_revision_id: string | null; created_at: string; updated_at: string };
const map = (row: Row): ResumeWorkspace => ({ id: row.id, name: row.name, activeProfileRevisionId: row.active_profile_revision_id ?? undefined, createdAt: row.created_at, updatedAt: row.updated_at });

export function listResumeWorkspaces(db: DatabaseSync): ResumeWorkspace[] { return (db.prepare("SELECT id, name, active_profile_revision_id, created_at, updated_at FROM resume_workspaces ORDER BY updated_at DESC, id DESC").all() as Row[]).map(map); }
export function readActiveResumeWorkspace(db: DatabaseSync): { workspace?: ResumeWorkspace; revisionNumber: number } {
  const state = db.prepare("SELECT active_workspace_id, revision_number FROM resume_workspace_state WHERE singleton = 1").get() as { active_workspace_id: string | null; revision_number: number };
  if (!state.active_workspace_id) return { revisionNumber: state.revision_number };
  const row = db.prepare("SELECT id, name, active_profile_revision_id, created_at, updated_at FROM resume_workspaces WHERE id = ?").get(state.active_workspace_id) as Row | undefined;
  return { workspace: row ? map(row) : undefined, revisionNumber: state.revision_number };
}
export function insertResumeWorkspace(db: DatabaseSync, item: ResumeWorkspace): void { db.prepare("INSERT INTO resume_workspaces (id, name, active_profile_revision_id, created_at, updated_at) VALUES (?, ?, NULL, ?, ?)").run(item.id, item.name, item.createdAt, item.updatedAt); }
export function setActiveResumeWorkspace(db: DatabaseSync, id: string, expectedRevisionNumber: number, updatedAt: string): boolean { return db.prepare("UPDATE resume_workspace_state SET active_workspace_id = ?, revision_number = revision_number + 1, updated_at = ? WHERE singleton = 1 AND revision_number = ? AND EXISTS (SELECT 1 FROM resume_workspaces WHERE id = ?)").run(id, updatedAt, expectedRevisionNumber, id).changes === 1; }
export function attachProfileToWorkspace(db: DatabaseSync, workspaceId: string, profileId: string, revisionId: string, updatedAt: string): boolean {
  db.prepare("INSERT OR IGNORE INTO resume_workspace_profiles (workspace_id, profile_id) VALUES (?, ?)").run(workspaceId, profileId);
  if (db.prepare("UPDATE resume_workspaces SET active_profile_revision_id = ?, updated_at = ? WHERE id = ?").run(revisionId, updatedAt, workspaceId).changes !== 1) return false;
  db.prepare("UPDATE resume_workspace_state SET revision_number = revision_number + 1, updated_at = ? WHERE singleton = 1").run(updatedAt);
  return true;
}
export function workspaceOwnsEvidence(db: DatabaseSync, workspaceId: string, evidenceRevisionId: string): boolean { return Boolean(db.prepare("SELECT 1 FROM resume_workspace_evidence w JOIN evidence_revisions e ON e.evidence_id = w.evidence_id WHERE w.workspace_id = ? AND e.id = ?").get(workspaceId, evidenceRevisionId)); }
export function attachEvidenceToWorkspace(db: DatabaseSync, workspaceId: string, evidenceId: string): void { db.prepare("INSERT INTO resume_workspace_evidence (workspace_id, evidence_id) VALUES (?, ?)").run(workspaceId, evidenceId); }
export function attachImportToWorkspace(db: DatabaseSync, workspaceId: string, importId: string): void { db.prepare("INSERT INTO resume_workspace_imports (workspace_id, import_id) VALUES (?, ?)").run(workspaceId, importId); }
export function attachDraftToWorkspace(db: DatabaseSync, workspaceId: string, draftId: string): void { db.prepare("INSERT INTO resume_workspace_drafts (workspace_id, draft_id) VALUES (?, ?)").run(workspaceId, draftId); }
export function workspaceOwnsDraft(db: DatabaseSync, workspaceId: string, draftId: string): boolean { return Boolean(db.prepare("SELECT 1 FROM resume_workspace_drafts WHERE workspace_id = ? AND draft_id = ?").get(workspaceId, draftId)); }
export function listWorkspaceApprovedEvidenceIds(db: DatabaseSync, workspaceId: string): string[] { return (db.prepare("SELECT e.id FROM evidence_revisions e JOIN resume_workspace_evidence w ON w.evidence_id = e.evidence_id WHERE w.workspace_id = ? AND e.review_state = 'approved' AND NOT EXISTS (SELECT 1 FROM evidence_revisions n WHERE n.supersedes_revision_id = e.id) ORDER BY e.created_at DESC").all(workspaceId) as Array<{ id: string }>).map((row) => row.id); }
export function listWorkspaceDocumentedEvidenceIds(db: DatabaseSync, workspaceId: string): string[] { return (db.prepare("SELECT e.id FROM evidence_revisions e JOIN resume_workspace_evidence w ON w.evidence_id = e.evidence_id WHERE w.workspace_id = ? AND e.review_state IN ('unreviewed', 'approved') AND NOT EXISTS (SELECT 1 FROM evidence_revisions n WHERE n.supersedes_revision_id = e.id) ORDER BY e.created_at DESC").all(workspaceId) as Array<{ id: string }>).map((row) => row.id); }
