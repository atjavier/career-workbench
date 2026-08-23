import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { resolveAppDataPaths } from "@/files/app-data";

export async function stageCurrentBaseResume(appDataRoot: string | undefined, id: string, filename: string, bytes: Uint8Array): Promise<{ root: string; staging: string; final: string; storageLocation: string }> {
  const paths = await resolveAppDataPaths(appDataRoot);
  const staging = join(paths.root, ".import-staging", id);
  const final = join(paths.root, "current-base-resumes", id);
  try {
    await mkdir(staging, { recursive: true });
    await writeFile(join(staging, filename), bytes, { flag: "wx" });
    await mkdir(join(paths.root, "current-base-resumes"), { recursive: true });
    await rename(staging, final);
    return { root: paths.root, staging, final, storageLocation: `current-base-resumes/${id}/${filename}` };
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    throw error;
  }
}

export async function cleanupCurrentBaseResume(path: string | undefined): Promise<void> { if (path) await rm(path, { recursive: true, force: true }); }
