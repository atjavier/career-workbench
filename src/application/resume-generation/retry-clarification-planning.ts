import { interpretWorkspaceEvidence } from "./resume-evidence-interpretation";
import { WorkspaceError } from "@/domain/workspace/types";
import { reconcileResumeWorkspaceJourney } from "@/domain/resume-generation/resume-workspace-journey";
import { resolveAppDataPaths } from "@/files/app-data";
import { applyMigrations, openDatabase } from "@/persistence/database";
import { readActiveResumeWorkspace } from "@/persistence/resume-workspace-repository";

export const clarificationPlanningFailurePrefix = "Your evidence is saved, but questions could not be prepared.";

export async function retryClarificationPlanning(workspaceId: string, options: Parameters<typeof interpretWorkspaceEvidence>[1] = {}): Promise<void> {
  const paths = await resolveAppDataPaths(options?.appDataRoot);
  const db = openDatabase(paths.databasePath);
  try {
    applyMigrations(db);
    if (readActiveResumeWorkspace(db).workspace?.id !== workspaceId) throw new WorkspaceError("RESUME_WORKSPACE_STALE", "The resume workspace changed.", "Refresh the page and try again.");
    const intake = db.prepare("SELECT id, status, message FROM resume_evidence_intakes WHERE workspace_id = ? ORDER BY updated_at DESC, id DESC LIMIT 1").get(workspaceId) as { id: string; status: string; message: string } | undefined;
    if (intake && ["queued", "running"].includes(intake.status)) throw new WorkspaceError("RESUME_WORKSPACE_STALE", "Evidence is still being documented.", "Wait for documentation to finish before preparing questions again.");
    if (!db.prepare("SELECT 1 FROM resume_workspace_imports WHERE workspace_id = ? LIMIT 1").get(workspaceId)) throw new WorkspaceError("EVIDENCE_LIBRARY_EMPTY", "There is no saved evidence to read yet.", "Add a project or experience first.");
    if (!(await interpretWorkspaceEvidence(workspaceId, options))) throw new WorkspaceError("RESUME_WORKSPACE_STALE", "Evidence changed while questions were being prepared.", "Read the current evidence again.");
    // Only clear failures from this stage, never pretend a failed folder import completed.
    if (intake?.status === "failed" && intake.message.startsWith(clarificationPlanningFailurePrefix))
      db.prepare("UPDATE resume_evidence_intakes SET status = 'ready', message = ?, updated_at = ? WHERE id = ? AND status = 'failed' AND message = ?").run("Questions prepared from your saved evidence.", new Date().toISOString(), intake.id, intake.message);
    await reconcileResumeWorkspaceJourney(workspaceId, options);
  } finally { db.close(); }
}
