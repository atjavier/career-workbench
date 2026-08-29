import { resolveAppDataPaths } from "@/files/app-data";
import { createHash } from "node:crypto";
import { applyMigrations, openDatabase } from "@/persistence/database";
import { isLatestWorkspaceMaterialDraftCurrent } from "@/persistence/material-draft-repository";
import { readActiveResumeWorkspace } from "@/persistence/resume-workspace-repository";
import { listWorkspaceDocumentedEvidenceIds } from "@/persistence/resume-workspace-repository";
import { insertResumeWorkspaceJourney, readResumeWorkspaceJourney, type ResumeWorkspaceJourney, updateResumeWorkspaceJourney } from "@/persistence/resume-workspace-journey-repository";
import { createUuidV7 } from "@/audit/audit-event";

type Options = { appDataRoot?: string };
export type ResumeJourneyState = Pick<ResumeWorkspaceJourney, "phase" | "nextAction" | "message">;
type DerivedJourneyState = ResumeJourneyState & Pick<ResumeWorkspaceJourney, "stateFingerprint">;

function fingerprint(value: unknown): string { return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`; }

function derived(db: ReturnType<typeof openDatabase>, workspaceId: string): DerivedJourneyState {
  const profile = db.prepare("SELECT active_profile_revision_id AS id FROM resume_workspaces WHERE id = ?").get(workspaceId) as { id: string | null } | undefined;
  const intake = db.prepare("SELECT status, message FROM resume_evidence_intakes WHERE workspace_id = ?").get(workspaceId) as { status: "queued" | "running" | "ready" | "failed"; message: string } | undefined;
  const tasks = db.prepare("SELECT item_key AS itemKey, category, question, status FROM resume_clarification_tasks WHERE workspace_id = ? ORDER BY item_key, category, status").all(workspaceId) as Array<{ itemKey: string; category: string; question: string; status: string }>;
  const evidenceRevisionIds = listWorkspaceDocumentedEvidenceIds(db, workspaceId);
  const hasImportedDocumentation = Boolean(db.prepare("SELECT 1 FROM resume_workspace_imports WHERE workspace_id = ? LIMIT 1").get(workspaceId));
  const draftIsCurrent = Boolean(profile?.id && isLatestWorkspaceMaterialDraftCurrent(db, { workspaceId, profileRevisionId: profile.id, evidenceRevisionIds }));
  const stateFingerprint = fingerprint({ profileRevisionId: profile?.id ?? null, intake: intake ? { status: intake.status, message: intake.message } : null, tasks, evidenceRevisionIds, hasImportedDocumentation, draftIsCurrent });
  if (intake?.status === "queued" || intake?.status === "running") return { phase: "documenting", nextAction: "wait_for_documentation", message: intake.message, stateFingerprint };
  if (intake?.status === "failed") return { phase: "recovery", nextAction: "recover", message: intake.message, stateFingerprint };
  if (tasks.some((task) => task.status === "pending")) return { phase: "interview", nextAction: "answer_clarifications", message: "Coach Resume needs a few details that your documented work could not establish.", stateFingerprint };
  if (!profile?.id && evidenceRevisionIds.length === 0 && !hasImportedDocumentation && tasks.length === 0) return { phase: "onboarding", nextAction: "complete_profile", message: "Complete your basic profile to begin evidence intake.", stateFingerprint };
  if (draftIsCurrent) return { phase: "ready_for_preview", nextAction: "view_resume", message: "Your generated resume is ready to review.", stateFingerprint };
  return { phase: "ready_to_generate", nextAction: "generate_resume", message: "Your evidence is ready for resume generation after the interview workflow is complete.", stateFingerprint };
}

export function reconcileResumeWorkspaceJourneyInDatabase(db: ReturnType<typeof openDatabase>, workspaceId: string, now = new Date().toISOString()): ResumeWorkspaceJourney | undefined {
  const next = derived(db, workspaceId); let current = readResumeWorkspaceJourney(db, workspaceId);
  if (!current) { insertResumeWorkspaceJourney(db, { id: createUuidV7(), workspaceId, ...next, stateRevision: 1, createdAt: now, updatedAt: now }); current = readResumeWorkspaceJourney(db, workspaceId); }
  return current ? updateResumeWorkspaceJourney(db, { workspaceId, ...next, updatedAt: now }) : undefined;
}

export async function reconcileResumeWorkspaceJourney(workspaceId: string, input: Options & { requireActive?: boolean } = {}): Promise<ResumeWorkspaceJourney | undefined> {
  const paths = await resolveAppDataPaths(input.appDataRoot); const db = openDatabase(paths.databasePath);
  try { applyMigrations(db); db.exec("BEGIN IMMEDIATE"); try { if (input.requireActive !== false && readActiveResumeWorkspace(db).workspace?.id !== workspaceId) { db.exec("ROLLBACK"); return undefined; } const journey = reconcileResumeWorkspaceJourneyInDatabase(db, workspaceId); db.exec("COMMIT"); return journey; } catch (error) { db.exec("ROLLBACK"); throw error; } } finally { db.close(); }
}
