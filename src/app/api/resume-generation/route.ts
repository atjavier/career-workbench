import { beginResumeGenerationJob } from "@/domain/resume-generation/resume-generation-jobs";
import { runResumeGenerationJob, type ResumeGenerationWorkItem } from "@/domain/resume-generation/resume-generation-runner";
import { toSafeWorkspaceError, WorkspaceError } from "@/domain/workspace/types";
import { resolveAppDataPaths } from "@/files/app-data";
import { applyMigrations, openDatabase } from "@/persistence/database";
import { readActiveResumeWorkspace } from "@/persistence/resume-workspace-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const workspaceId = (value: unknown) => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const plain = (value: unknown, maximum: number) => typeof value === "string" && value.trim().length > 0 && value.length <= maximum && !/[\u0000-\u001f]/.test(value);

function parse(input: unknown): { workspaceId: string; work: ResumeGenerationWorkItem[] } {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new WorkspaceError("RESUME_COACH_INVALID", "Resume generation could not be started.", "Return to Resume and try creating it again.");
  const value = input as { workspaceId?: unknown; work?: unknown };
  if (!workspaceId(value.workspaceId) || !Array.isArray(value.work) || value.work.length < 1 || value.work.length > 12) throw new WorkspaceError("RESUME_COACH_INVALID", "Resume generation could not be started.", "Return to Resume and try creating it again.");
  const work = value.work.map((item) => {
    if (!item || typeof item !== "object") throw new WorkspaceError("RESUME_COACH_INVALID", "Resume generation could not be started.", "Return to Resume and try creating it again.");
    const entry = item as Partial<ResumeGenerationWorkItem>;
    if ((entry.category !== "project" && entry.category !== "experience") || !plain(entry.name, 120) || !plain(entry.sourceDirectory, 2_048)) throw new WorkspaceError("RESUME_COACH_INVALID", "Resume generation could not be started.", "Return to Resume and try creating it again.");
    return { category: entry.category, name: String(entry.name).trim(), sourceDirectory: String(entry.sourceDirectory).trim() };
  });
  return { workspaceId: String(value.workspaceId), work };
}

async function assertActiveWorkspace(id: string): Promise<void> {
  const paths = await resolveAppDataPaths(); const db = openDatabase(paths.databasePath);
  try { applyMigrations(db); if (readActiveResumeWorkspace(db).workspace?.id !== id) throw new WorkspaceError("RESUME_WORKSPACE_STALE", "Your resume workspace changed before generation could begin.", "Select this resume again, then start generation."); } finally { db.close(); }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const input = parse(await request.json());
    await assertActiveWorkspace(input.workspaceId);
    const job = await beginResumeGenerationJob(input.workspaceId);
    void runResumeGenerationJob(job.id, input.work);
    return Response.json({ status: "accepted", jobId: job.id }, { status: 202, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const safe = toSafeWorkspaceError(error);
    return Response.json({ status: "error", summary: safe.summary, safeNextAction: safe.safeNextAction }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
}
