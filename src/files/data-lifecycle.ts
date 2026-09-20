import { createHash } from "node:crypto";
import {
  lstat,
  mkdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { backup, DatabaseSync } from "node:sqlite";
import { WorkspaceError } from "@/domain/workspace/types";
import type { AppDataPaths } from "@/files/app-data";

export const digest = (bytes: Uint8Array) =>
  `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
function safeLocation(paths: AppDataPaths, location: string): string {
  if (!location || isAbsolute(location) || location.includes(".."))
    throw new WorkspaceError(
      "DATA_ARTIFACT_INVALID",
      "The local data artifact is unavailable.",
      "Refresh Data & Storage and try again.",
    );
  const target = resolve(paths.root, location);
  const rel = relative(paths.root, target);
  if (isAbsolute(rel) || rel.startsWith(".."))
    throw new WorkspaceError(
      "DATA_ARTIFACT_INVALID",
      "The local data artifact is unavailable.",
      "Refresh Data & Storage and try again.",
    );
  return target;
}
async function assertSafeDirectories(
  paths: AppDataPaths,
  target: string,
): Promise<void> {
  let current = paths.root;
  for (const part of relative(paths.root, dirname(target))
    .split(/[\\/]/)
    .filter(Boolean)) {
    current = join(current, part);
    try {
      const metadata = await lstat(current);
      if (metadata.isSymbolicLink())
        throw new WorkspaceError(
          "DATA_ARTIFACT_INVALID",
          "The private data location is unavailable.",
          "Check private workspace storage and try again.",
        );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
}
async function rejectExisting(target: string): Promise<void> {
  try {
    await lstat(target);
    throw new WorkspaceError(
      "DATA_ARTIFACT_INVALID",
      "A local data artifact already uses that destination.",
      "Refresh Data & Storage and try again.",
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}
async function prepare(
  paths: AppDataPaths,
  target: string,
  staging: string,
): Promise<void> {
  await assertSafeDirectories(paths, target);
  await assertSafeDirectories(paths, staging);
  await mkdir(dirname(staging), { recursive: true });
  await mkdir(dirname(target), { recursive: true });
  await rejectExisting(target);
  await rejectExisting(staging);
}
async function writeStaged(
  paths: AppDataPaths,
  relativeTarget: string,
  bytes: Uint8Array,
): Promise<{ digest: string; byteSize: number }> {
  const target = safeLocation(paths, relativeTarget);
  const staging = safeLocation(paths, `staging/${relativeTarget}.tmp`);
  await prepare(paths, target, staging);
  await writeFile(staging, bytes, { flag: "wx" });
  await rename(staging, target);
  return { digest: digest(bytes), byteSize: bytes.byteLength };
}
export async function createDatabaseBackup(
  paths: AppDataPaths,
  id: string,
): Promise<{ location: string; digest: string; byteSize: number }> {
  const location = `backups/${id}.sqlite`;
  const target = safeLocation(paths, location);
  const staging = safeLocation(paths, `staging/backups/${id}.sqlite.tmp`);
  await prepare(paths, target, staging);
  const source = new DatabaseSync(paths.databasePath, { readOnly: true });
  try {
    await backup(source, staging);
    const check = new DatabaseSync(staging, { readOnly: true });
    try {
      const result = check.prepare("PRAGMA integrity_check").get() as {
        integrity_check: string;
      };
      if (result.integrity_check !== "ok") throw new Error("integrity");
    } finally {
      check.close();
    }
    await rename(staging, target);
    const bytes = await readFile(target);
    return { location, digest: digest(bytes), byteSize: bytes.byteLength };
  } catch {
    await rm(staging, { force: true }).catch(() => undefined);
    throw new WorkspaceError(
      "DATA_STORAGE_UNAVAILABLE",
      "The local backup could not be created.",
      "Check private workspace storage, then try the backup again.",
    );
  } finally {
    source.close();
  }
}
export async function createHistoryExport(
  paths: AppDataPaths,
  id: string,
  content: string,
): Promise<{ location: string; digest: string; byteSize: number }> {
  const bytes = new TextEncoder().encode(content);
  const location = `activity-history-exports/${id}.json`;
  const written = await writeStaged(paths, location, bytes);
  return { location, ...written };
}
export async function moveArtifact(
  paths: AppDataPaths,
  from: string,
  to: string,
): Promise<void> {
  const source = safeLocation(paths, from);
  const target = safeLocation(paths, to);
  await assertSafeDirectories(paths, source);
  await prepare(paths, target, target);
  await rename(source, target).catch(() => {
    throw new WorkspaceError(
      "DATA_STORAGE_UNAVAILABLE",
      "The local data artifact could not be moved safely.",
      "Check private workspace storage and try again.",
    );
  });
}
export async function removeArtifact(
  paths: AppDataPaths,
  location: string,
): Promise<void> {
  const target = safeLocation(paths, location);
  await rm(target, { force: true }).catch(() => {
    throw new WorkspaceError(
      "DATA_STORAGE_UNAVAILABLE",
      "The local data artifact could not be deleted.",
      "Check private workspace storage and try again.",
    );
  });
}
export async function verifyArtifact(
  paths: AppDataPaths,
  location: string,
  expectedDigest: string,
): Promise<void> {
  const bytes = await readFile(safeLocation(paths, location)).catch(() => {
    throw new WorkspaceError(
      "DATA_STORAGE_UNAVAILABLE",
      "The local data artifact is unavailable.",
      "Refresh Data & Storage and try again.",
    );
  });
  if (digest(bytes) !== expectedDigest)
    throw new WorkspaceError(
      "DATA_ARTIFACT_INVALID",
      "The local data artifact failed its integrity check.",
      "Keep the original data and create a new backup or export.",
    );
}
export async function verifyDatabaseBackup(
  paths: AppDataPaths,
  location: string,
  expectedDigest: string,
): Promise<void> {
  await verifyArtifact(paths, location, expectedDigest);
  const database = new DatabaseSync(safeLocation(paths, location), {
    readOnly: true,
  });
  try {
    const result = database.prepare("PRAGMA integrity_check").get() as {
      integrity_check: string;
    };
    if (result.integrity_check !== "ok")
      throw new WorkspaceError(
        "DATA_ARTIFACT_INVALID",
        "The local backup failed its integrity check.",
        "Keep the original backup and create a new one.",
      );
  } finally {
    database.close();
  }
}
export async function artifactSize(
  paths: AppDataPaths,
  location: string,
): Promise<number> {
  return (await stat(safeLocation(paths, location))).size;
}
