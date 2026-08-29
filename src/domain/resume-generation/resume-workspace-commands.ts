import { createAuditEvent, createUuidV7 } from "@/audit/audit-event";
import { lstat, rm } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import { WorkspaceError } from "@/domain/workspace/types";
import { evidenceLibraryRoot } from "@/files/evidence-library";
import { resolveAppDataPaths } from "@/files/app-data";
import { applyMigrations, openDatabase } from "@/persistence/database";
import { appendAuditEvent } from "@/persistence/workspace-repository";
import { insertResumeWorkspace, listResumeWorkspaces, readActiveResumeWorkspace, setActiveResumeWorkspace, type ResumeWorkspace } from "@/persistence/resume-workspace-repository";
import { insertResumeWorkspaceJourney, listResumeWorkspaceJourneys, type ResumeWorkspaceJourney } from "@/persistence/resume-workspace-journey-repository";
import { reconcileResumeWorkspaceJourneyInDatabase } from "@/domain/resume-generation/resume-workspace-journey";

type Options = { appDataRoot?: string; workspaceRoot?: string };
const restoreDeletionGuards = (db: ReturnType<typeof openDatabase>) => {
  db.exec("CREATE TRIGGER IF NOT EXISTS candidate_profiles_immutable_delete BEFORE DELETE ON candidate_profiles BEGIN SELECT RAISE(ABORT, 'candidate profiles are immutable'); END;");
  db.exec("CREATE TRIGGER IF NOT EXISTS candidate_profile_revisions_immutable_delete BEFORE DELETE ON candidate_profile_revisions BEGIN SELECT RAISE(ABORT, 'candidate profile revisions are immutable'); END;");
  db.exec("CREATE TRIGGER IF NOT EXISTS material_drafts_immutable_delete BEFORE DELETE ON material_drafts BEGIN SELECT RAISE(ABORT, 'material drafts are immutable'); END;");
  db.exec("CREATE TRIGGER IF NOT EXISTS material_draft_evidence_immutable_delete BEFORE DELETE ON material_draft_evidence BEGIN SELECT RAISE(ABORT, 'material draft evidence is immutable'); END;");
  db.exec("CREATE TRIGGER IF NOT EXISTS material_draft_claims_immutable_delete BEFORE DELETE ON material_draft_claims BEGIN SELECT RAISE(ABORT, 'material draft claims are immutable'); END;");
  db.exec("CREATE TRIGGER IF NOT EXISTS material_claim_support_immutable_delete BEFORE DELETE ON material_claim_support BEGIN SELECT RAISE(ABORT, 'material claim support is immutable'); END;");
  db.exec("CREATE TRIGGER IF NOT EXISTS material_draft_handoffs_immutable_delete BEFORE DELETE ON material_draft_handoffs BEGIN SELECT RAISE(ABORT, 'material draft handoffs are immutable'); END;");
  db.exec("CREATE TRIGGER IF NOT EXISTS evidence_library_imports_immutable_delete BEFORE DELETE ON evidence_library_imports BEGIN SELECT RAISE(ABORT, 'library imports are immutable'); END;");
  db.exec("CREATE TRIGGER IF NOT EXISTS evidence_library_documents_immutable_delete BEFORE DELETE ON evidence_library_documents BEGIN SELECT RAISE(ABORT, 'library documents are immutable'); END;");
  db.exec("CREATE TRIGGER IF NOT EXISTS evidence_library_candidates_immutable_delete BEFORE DELETE ON evidence_library_candidates BEGIN SELECT RAISE(ABORT, 'library candidates are immutable'); END;");
  db.exec("CREATE TRIGGER IF NOT EXISTS evidence_records_immutable_delete BEFORE DELETE ON evidence_records BEGIN SELECT RAISE(ABORT, 'evidence records are immutable'); END;");
  db.exec("CREATE TRIGGER IF NOT EXISTS evidence_revisions_immutable_delete BEFORE DELETE ON evidence_revisions BEGIN SELECT RAISE(ABORT, 'evidence revisions are immutable'); END;");
  db.exec("CREATE TRIGGER IF NOT EXISTS evidence_documenter_decisions_immutable_delete BEFORE DELETE ON evidence_documenter_proposal_decisions BEGIN SELECT RAISE(ABORT, 'documenter proposal decisions are immutable'); END;");
};
const nameOf = (value: string) => {
  const name = value.trim().replace(/\s+/g, " ");
  if (!name || name.length > 120 || /[\u0000-\u001f\u007f]/.test(name)) throw new WorkspaceError("RESUME_WORKSPACE_INVALID", "Enter a resume name of up to 120 plain-text characters.", "Name this resume workspace and try again.");
  return name;
};
function transaction<T>(root: string, work: (db: ReturnType<typeof openDatabase>) => T): T { const db = openDatabase(`${root}/workspace.sqlite`); try { applyMigrations(db); db.exec("BEGIN IMMEDIATE"); try { const value = work(db); db.exec("COMMIT"); return value; } catch (error) { db.exec("ROLLBACK"); throw error; } } finally { db.close(); } }
function managedEvidenceDirectory(libraryPath: string): { category: "projects" | "experiences"; name: string } | undefined { const match = /^resume-evidence\/(projects|experiences)\/([A-Za-z0-9._-]+)\//.exec(libraryPath); return match ? { category: match[1] as "projects" | "experiences", name: match[2] } : undefined; }
function inside(root: string, target: string): boolean { const path = relative(root, target); return Boolean(path) && path !== ".." && !path.startsWith(`..${sep}`) && !path.includes(`${sep}..${sep}`); }
async function removeManagedDirectory(root: string, target: string): Promise<boolean> { if (!inside(root, target)) return false; const stat = await lstat(target).catch(() => undefined); if (!stat) return true; if (stat.isSymbolicLink() || !stat.isDirectory()) return false; await rm(target, { recursive: true, force: true }); return true; }

export async function readResumeWorkspaceState(input: Options = {}): Promise<{ workspaces: Array<ResumeWorkspace & { journey?: ResumeWorkspaceJourney }>; activeWorkspace?: ResumeWorkspace & { journey?: ResumeWorkspaceJourney }; revisionNumber: number }> {
  const paths = await resolveAppDataPaths(input.appDataRoot);
  return transaction(paths.root, (db) => { const active = readActiveResumeWorkspace(db); const baseWorkspaces = listResumeWorkspaces(db); for (const workspace of baseWorkspaces) reconcileResumeWorkspaceJourneyInDatabase(db, workspace.id); const journeys = new Map(listResumeWorkspaceJourneys(db).map((journey) => [journey.workspaceId, journey])); const workspaces = baseWorkspaces.map((workspace) => ({ ...workspace, journey: journeys.get(workspace.id) })); return { workspaces, activeWorkspace: active.workspace ? { ...active.workspace, journey: journeys.get(active.workspace.id) } : undefined, revisionNumber: active.revisionNumber }; });
}
export async function createResumeWorkspace(input: Options & { name: string; expectedRevisionNumber?: number }): Promise<{ workspace: ResumeWorkspace; revisionNumber: number }> {
  const name = nameOf(input.name); const paths = await resolveAppDataPaths(input.appDataRoot);
  return transaction(paths.root, (db) => { const active = readActiveResumeWorkspace(db); if (input.expectedRevisionNumber !== undefined && input.expectedRevisionNumber !== active.revisionNumber) throw new WorkspaceError("RESUME_WORKSPACE_STALE", "Your resume workspace changed before it could be created.", "Refresh Resume and try again."); const now = new Date().toISOString(); const workspace = { id: createUuidV7(), name, createdAt: now, updatedAt: now }; insertResumeWorkspace(db, workspace); insertResumeWorkspaceJourney(db, { id: createUuidV7(), workspaceId: workspace.id, phase: "onboarding", nextAction: "complete_profile", message: "Complete your basic profile to begin evidence intake.", stateFingerprint: "sha256:unreconciled", stateRevision: 1, createdAt: now, updatedAt: now }); if (!setActiveResumeWorkspace(db, workspace.id, active.revisionNumber, now)) throw new WorkspaceError("RESUME_WORKSPACE_STALE", "Your resume workspace changed before it could be created.", "Refresh Resume and try again."); appendAuditEvent(db, createAuditEvent({ actor: "local-os-user", action: "resume.workspace_created", outcome: "success", entityId: workspace.id })); return { workspace, revisionNumber: active.revisionNumber + 1 }; });
}
export async function selectResumeWorkspace(input: Options & { workspaceId: string; expectedRevisionNumber: number }): Promise<void> {
  const paths = await resolveAppDataPaths(input.appDataRoot); transaction(paths.root, (db) => { const now = new Date().toISOString(); if (!setActiveResumeWorkspace(db, input.workspaceId, input.expectedRevisionNumber, now)) throw new WorkspaceError("RESUME_WORKSPACE_STALE", "That resume workspace is no longer available.", "Refresh Resume and choose an available workspace."); appendAuditEvent(db, createAuditEvent({ actor: "local-os-user", action: "resume.workspace_selected", outcome: "success", entityId: input.workspaceId })); });
}

// Deletion is deliberately explicit and transactional.  The immutable-record
// triggers protect ordinary application operations; this narrow recovery path
// removes only rows owned by the confirmed workspace, then leaves a metadata-only
// audit record.  No raw source, profile, prompt, or model data enters the audit.
export async function permanentlyDeleteResumeWorkspace(input: Options & { workspaceId: string; expectedRevisionNumber: number; confirmation: string }): Promise<{ reclaimedBytes: number; artifactCleanupIncomplete: boolean }> {
  if (input.confirmation !== "DELETE") throw new WorkspaceError("RESUME_WORKSPACE_DELETE_CONFIRMATION", "Permanent deletion was not confirmed.", "Type DELETE to permanently remove this resume workspace.");
  const paths = await resolveAppDataPaths(input.appDataRoot); const databasePath = `${paths.root}/workspace.sqlite`; const before = (await import("node:fs/promises")).stat(databasePath).then((item) => item.size).catch(() => 0);
  const managedDirectories = transaction(paths.root, (db) => {
    const active = readActiveResumeWorkspace(db); const exists = db.prepare("SELECT 1 FROM resume_workspaces WHERE id = ?").get(input.workspaceId);
    if (!exists) throw new WorkspaceError("RESUME_WORKSPACE_NOT_FOUND", "That resume workspace has already been deleted.", "Refresh Resume and choose an available workspace.");
    if (active.revisionNumber !== input.expectedRevisionNumber) throw new WorkspaceError("RESUME_WORKSPACE_STALE", "Your resume workspace changed before deletion.", "Refresh Resume and confirm the workspace again.");
    const now = new Date().toISOString(); const draftIds = (db.prepare("SELECT draft_id AS id FROM resume_workspace_drafts WHERE workspace_id = ?").all(input.workspaceId) as Array<{ id: string }>).map((row) => row.id); const evidenceIds = (db.prepare("SELECT evidence_id AS id FROM resume_workspace_evidence WHERE workspace_id = ?").all(input.workspaceId) as Array<{ id: string }>).map((row) => row.id); const importIds = (db.prepare("SELECT import_id AS id FROM resume_workspace_imports WHERE workspace_id = ?").all(input.workspaceId) as Array<{ id: string }>).map((row) => row.id); const profileIds = (db.prepare("SELECT profile_id AS id FROM resume_workspace_profiles WHERE workspace_id = ?").all(input.workspaceId) as Array<{ id: string }>).map((row) => row.id); const directories = [...new Set(importIds.flatMap((id) => (db.prepare("SELECT library_path FROM evidence_library_documents WHERE import_id = ?").all(id) as Array<{ library_path: string }>).map((row) => managedEvidenceDirectory(row.library_path)).filter((item): item is { category: "projects" | "experiences"; name: string } => Boolean(item)).map((item) => `${item.category}/${item.name}`)))];
    // The tables below are all private workspace payload, never audit payload.
    for (const trigger of ["material_claim_support_immutable_delete", "material_draft_claims_immutable_delete", "material_draft_evidence_immutable_delete", "material_draft_handoffs_immutable_delete", "material_drafts_immutable_delete", "candidate_profile_revisions_immutable_delete", "candidate_profiles_immutable_delete", "evidence_library_imports_immutable_delete", "evidence_library_documents_immutable_delete", "evidence_library_candidates_immutable_delete", "evidence_records_immutable_delete", "evidence_revisions_immutable_delete", "evidence_documenter_decisions_immutable_delete"]) db.exec(`DROP TRIGGER IF EXISTS ${trigger}`);
    // Remove ownership joins before deleting the rows they reference. SQLite
    // correctly prevents deleting a private record while its workspace link is
    // still present; the previous order turned that constraint into a generic
    // initialization error in the UI.
    // Clear every live profile pointer before removing ownership rows. Older
    // workspaces can still have the global generation pointer set.
    db.prepare("UPDATE resume_workspaces SET active_profile_revision_id = NULL WHERE id = ?").run(input.workspaceId);
    for (const id of profileIds) db.prepare("UPDATE resume_generation_state SET active_profile_revision_id = NULL, revision_number = revision_number + 1, updated_at = ? WHERE active_profile_revision_id IN (SELECT id FROM candidate_profile_revisions WHERE profile_id = ?)").run(now, id);
    db.prepare("DELETE FROM resume_workspace_drafts WHERE workspace_id = ?").run(input.workspaceId);
    db.prepare("DELETE FROM resume_workspace_evidence WHERE workspace_id = ?").run(input.workspaceId);
    db.prepare("DELETE FROM resume_workspace_imports WHERE workspace_id = ?").run(input.workspaceId);
    db.prepare("DELETE FROM resume_workspace_profiles WHERE workspace_id = ?").run(input.workspaceId);
    for (const id of draftIds) { db.prepare("DELETE FROM material_claim_support WHERE claim_id IN (SELECT id FROM material_draft_claims WHERE draft_id = ?)").run(id); db.prepare("DELETE FROM material_draft_claims WHERE draft_id = ?").run(id); db.prepare("DELETE FROM material_draft_evidence WHERE draft_id = ?").run(id); db.prepare("DELETE FROM material_draft_handoffs WHERE draft_id = ?").run(id); db.prepare("DELETE FROM material_drafts WHERE id = ?").run(id); }
    for (const id of evidenceIds) { db.prepare("DELETE FROM evidence_library_candidates WHERE evidence_revision_id IN (SELECT id FROM evidence_revisions WHERE evidence_id = ?)").run(id); db.prepare("DELETE FROM evidence_documenter_proposal_decisions WHERE evidence_revision_id IN (SELECT id FROM evidence_revisions WHERE evidence_id = ?)").run(id); db.prepare("DELETE FROM evidence_revisions WHERE evidence_id = ?").run(id); db.prepare("DELETE FROM evidence_records WHERE id = ?").run(id); }
    for (const id of importIds) { db.prepare("DELETE FROM evidence_library_candidates WHERE document_id IN (SELECT id FROM evidence_library_documents WHERE import_id = ?)").run(id); db.prepare("DELETE FROM evidence_library_documents WHERE import_id = ?").run(id); db.prepare("DELETE FROM evidence_library_imports WHERE id = ?").run(id); }
    for (const id of profileIds) { db.prepare("DELETE FROM candidate_profile_revisions WHERE profile_id = ?").run(id); db.prepare("DELETE FROM candidate_profiles WHERE id = ?").run(id); }
    const next = active.workspace?.id === input.workspaceId ? db.prepare("SELECT id FROM resume_workspaces WHERE id <> ? ORDER BY updated_at DESC, id DESC LIMIT 1").get(input.workspaceId) as { id: string } | undefined : active.workspace;
    if (db.prepare("UPDATE resume_workspace_state SET active_workspace_id = ?, revision_number = revision_number + 1, updated_at = ? WHERE singleton = 1 AND revision_number = ?").run(next?.id ?? null, now, active.revisionNumber).changes !== 1) throw new WorkspaceError("RESUME_WORKSPACE_STALE", "Your resume workspace changed before deletion.", "Refresh Resume and confirm the workspace again.");
    db.prepare("DELETE FROM resume_workspaces WHERE id = ?").run(input.workspaceId);
    restoreDeletionGuards(db);
    db.prepare("INSERT INTO resume_workspace_deletion_audit (id, workspace_id, occurred_at, outcome, reclaimed_bytes) VALUES (?, ?, ?, 'success', 0)").run(createUuidV7(), input.workspaceId, now);
    appendAuditEvent(db, createAuditEvent({ actor: "local-os-user", action: "resume.workspace_deleted", outcome: "success", entityId: input.workspaceId }));
    return directories;
  });
  const libraryRoot = evidenceLibraryRoot(input.workspaceRoot); let artifactCleanupIncomplete = false;
  const workspacePacketRoot = resolve(libraryRoot, "workspaces", input.workspaceId);
  if (!(await removeManagedDirectory(libraryRoot, workspacePacketRoot).catch(() => false))) artifactCleanupIncomplete = true;
  await Promise.all(managedDirectories.map(async (directory) => { try { if (!(await removeManagedDirectory(libraryRoot, resolve(libraryRoot, directory)))) artifactCleanupIncomplete = true; } catch { artifactCleanupIncomplete = true; } }));
  const db = openDatabase(databasePath); try { db.exec("VACUUM"); } finally { db.close(); }
  const after = await (await import("node:fs/promises")).stat(databasePath).then((item) => item.size).catch(() => 0); const reclaimedBytes = Math.max(0, await before - after); const auditDb = openDatabase(databasePath); try { auditDb.prepare("UPDATE resume_workspace_deletion_audit SET reclaimed_bytes = ? WHERE workspace_id = ? AND outcome = 'success'").run(reclaimedBytes, input.workspaceId); } finally { auditDb.close(); } return { reclaimedBytes, artifactCleanupIncomplete };
}
