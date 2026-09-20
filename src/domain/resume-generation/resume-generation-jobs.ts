import { createUuidV7 } from "@/audit/audit-event";
import { resolveAppDataPaths } from "@/files/app-data";
import { applyMigrations, openDatabase } from "@/persistence/database";

export type ResumeGenerationJob = {
  id: string;
  workspaceId: string;
  status: "queued" | "running" | "completed" | "failed";
  message: string;
  updatedAt: string;
};

type StoredJob = {
  id: string;
  workspace_id: string;
  status: ResumeGenerationJob["status"];
  message: string;
  updated_at: string;
};

function view(row: StoredJob): ResumeGenerationJob {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    status: row.status,
    message: row.message,
    updatedAt: row.updated_at,
  };
}

export async function beginResumeGenerationJob(
  workspaceId: string,
): Promise<ResumeGenerationJob> {
  const paths = await resolveAppDataPaths();
  const db = openDatabase(paths.databasePath);
  try {
    applyMigrations(db);
    const now = new Date().toISOString();
    const job: ResumeGenerationJob = {
      id: createUuidV7(),
      workspaceId,
      status: "queued",
      message: "Preparing your selected work folders for resume generation.",
      updatedAt: now,
    };
    db.prepare(
      "INSERT INTO resume_generation_jobs (id, workspace_id, status, message, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).run(job.id, job.workspaceId, job.status, job.message, now, now);
    return job;
  } finally {
    db.close();
  }
}

export async function updateResumeGenerationJob(
  id: string,
  status: ResumeGenerationJob["status"],
  message: string,
): Promise<void> {
  const paths = await resolveAppDataPaths();
  const db = openDatabase(paths.databasePath);
  try {
    applyMigrations(db);
    const now = new Date().toISOString();
    db.prepare(
      "UPDATE resume_generation_jobs SET status = ?, message = ?, updated_at = ?, completed_at = CASE WHEN ? IN ('completed', 'failed') THEN ? ELSE NULL END WHERE id = ?",
    ).run(status, message, now, status, now, id);
  } finally {
    db.close();
  }
}

export async function readResumeGenerationJob(
  id: string,
): Promise<ResumeGenerationJob | undefined> {
  const paths = await resolveAppDataPaths();
  const db = openDatabase(paths.databasePath);
  try {
    applyMigrations(db);
    const row = db
      .prepare(
        "SELECT id, workspace_id, status, message, updated_at FROM resume_generation_jobs WHERE id = ?",
      )
      .get(id) as StoredJob | undefined;
    return row ? view(row) : undefined;
  } finally {
    db.close();
  }
}

export async function readLatestResumeGenerationJob(
  workspaceId: string,
): Promise<ResumeGenerationJob | undefined> {
  const paths = await resolveAppDataPaths();
  const db = openDatabase(paths.databasePath);
  try {
    // Rendering the Resume page must remain read-only when Windows holds a
    // private app-data write lock.
    const row = db
      .prepare(
        "SELECT id, workspace_id, status, message, updated_at FROM resume_generation_jobs WHERE workspace_id = ? ORDER BY updated_at DESC LIMIT 1",
      )
      .get(workspaceId) as StoredJob | undefined;
    return row ? view(row) : undefined;
  } finally {
    db.close();
  }
}
