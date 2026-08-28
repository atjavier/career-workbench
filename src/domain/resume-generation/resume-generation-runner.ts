import { revalidatePath } from "next/cache";

import { generateBaseResumeAction } from "@/app/actions";
import { documentResumeEvidenceFolder } from "@/domain/evidence/evidence-library";
import { readResumeGenerationJob, updateResumeGenerationJob } from "@/domain/resume-generation/resume-generation-jobs";
import { compileResumeDraftPdf } from "@/domain/resume-generation/resume-tex-compiler";
import { readMaterialDraft } from "@/domain/resume-generation/material-draft-commands";
import { toSafeWorkspaceError, WorkspaceError } from "@/domain/workspace/types";
import { resolveAppDataPaths } from "@/files/app-data";
import { applyMigrations, openDatabase } from "@/persistence/database";
import { listWorkspaceDocumentedEvidenceIds } from "@/persistence/resume-workspace-repository";

export type ResumeGenerationWorkItem = { category: "project" | "experience"; name: string; sourceDirectory: string };

async function workspaceHasDocumentedEvidence(workspaceId: string): Promise<boolean> {
  const paths = await resolveAppDataPaths(); const database = openDatabase(paths.databasePath);
  try { applyMigrations(database); return listWorkspaceDocumentedEvidenceIds(database, workspaceId).length > 0; } finally { database.close(); }
}

/** Run after a workspace/profile transaction has committed. Folder paths live
 * only in this in-memory job input; the persisted job contains metadata-only
 * progress, never a path or source content. */
export async function runResumeGenerationJob(jobId: string, work: ResumeGenerationWorkItem[]): Promise<void> {
  try {
    const job = await readResumeGenerationJob(jobId);
    // Deletion cascades the job row. A detached background task must never
    // attach its folders or draft to whichever workspace becomes active next.
    if (!job) return;
    await updateResumeGenerationJob(jobId, "running", "Reading your selected local work folders and creating documentation.");
    for (const item of work) {
      // A job row disappears through the workspace's deletion cascade. Check
      // before every expensive source read/model request so later folders are
      // not processed after the user has permanently deleted this resume.
      if (!await readResumeGenerationJob(jobId)) return;
      try {
        await documentResumeEvidenceFolder({ ...item, expectedWorkspaceId: job.workspaceId, disclosed: true });
      } catch (error) {
        // A repeated onboarding folder may already have been imported by an
        // earlier item in this same job. Its evidence is durable and owned by
        // this workspace, so it must not block the later base-resume stage.
        if (error instanceof WorkspaceError && error.code === "EVIDENCE_LIBRARY_DUPLICATE" && await workspaceHasDocumentedEvidence(job.workspaceId)) continue;
        throw error;
      }
    }
    if (!await readResumeGenerationJob(jobId)) return;
    await updateResumeGenerationJob(jobId, "running", "Creating and typesetting your resume PDF.");
    const formData = new FormData();
    formData.set("workspaceId", job.workspaceId);
    const generated = await generateBaseResumeAction({ status: "idle", summary: "" }, formData);
    if (generated.status !== "success" || !generated.draftId) throw new WorkspaceError("RESUME_COACH_INVALID", generated.summary || "Your resume could not be generated.", "Review your local AI setup and documented work, then try again.");
    await compileResumeDraftPdf(await readMaterialDraft({ draftId: generated.draftId }));
    await updateResumeGenerationJob(jobId, "completed", "Your resume PDF is ready.");
  } catch (error) {
    const safe = toSafeWorkspaceError(error);
    await updateResumeGenerationJob(jobId, "failed", safe.summary).catch(() => undefined);
  } finally {
    // The runner is also exercised outside a Server Action. The completed
    // database transaction is authoritative, so a missing Next cache context
    // must not turn a safely abandoned/deleted background job into a failure.
    try { revalidatePath("/resume"); revalidatePath("/evidence"); } catch { /* The next page visit will read current durable state. */ }
  }
}
