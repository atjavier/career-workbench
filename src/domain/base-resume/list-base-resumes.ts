import { access } from "node:fs/promises";
import { join } from "node:path";

import { privateAppDataRoot } from "@/files/app-data";
import { openDatabase } from "@/persistence/database";
import { listBaseResumes, type StoredBaseResume } from "@/persistence/base-resume-repository";
import { WorkspaceError } from "@/domain/workspace/types";

export type BaseResumeListState = { resumes: StoredBaseResume[]; error?: undefined } | { resumes: StoredBaseResume[]; error: WorkspaceError };

export async function listStoredBaseResumes(): Promise<BaseResumeListState> {
  const root = privateAppDataRoot();
  const databasePath = join(root, "workspace.sqlite");
  try {
    await access(databasePath);
    const database = openDatabase(databasePath);
    try {
      return { resumes: listBaseResumes(database) };
    } finally {
      database.close();
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { resumes: [] };
    return { resumes: [], error: new WorkspaceError("BASE_RESUME_IMPORT_FAILED", "Imported Base Resumes cannot be loaded right now.", "Check local workspace storage access, then refresh the page.") };
  }
}
