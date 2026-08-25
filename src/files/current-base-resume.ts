import { lstat, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
import { resolveAppDataPaths } from "@/files/app-data";
import type { CurrentBaseResumeSource } from "@/persistence/current-base-resume-repository";

const safeFilename = (name: string) => name.length > 0 && !/[\\/\u0000-\u001f]/.test(name) && name.toLowerCase().endsWith(".pdf");

function sourceStorageSegments(source: CurrentBaseResumeSource): string[] | undefined {
  if (!safeFilename(source.filename) || isAbsolute(source.storageLocation)) return undefined;
  const segments = source.storageLocation.split(/[\\/]/);
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) return undefined;
  const expected = ["current-base-resumes", source.id, source.filename];
  return segments.length === expected.length && segments.every((segment, index) => segment === expected[index]) ? segments : undefined;
}

async function isRealDirectory(path: string): Promise<boolean> {
  try {
    const metadata = await lstat(path);
    return metadata.isDirectory() && !metadata.isSymbolicLink();
  } catch {
    return false;
  }
}

export async function readRetainedCurrentBaseResumePdf(root: string, source: CurrentBaseResumeSource): Promise<Uint8Array | undefined> {
  const segments = sourceStorageSegments(source);
  if (!segments || !Number.isSafeInteger(source.byteSize) || source.byteSize < 1 || !/^sha256:[a-f0-9]{64}$/.test(source.contentDigest)) return undefined;

  const storageRoot = resolve(root, segments[0]);
  const sourceDirectory = resolve(storageRoot, segments[1]);
  const filePath = resolve(sourceDirectory, segments[2]);
  if ([storageRoot, sourceDirectory, filePath].some((path) => relative(root, path).startsWith("..") || isAbsolute(relative(root, path)))) return undefined;
  if (!(await isRealDirectory(storageRoot)) || !(await isRealDirectory(sourceDirectory))) return undefined;

  try {
    const metadata = await lstat(filePath);
    if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size !== source.byteSize) return undefined;
    return new Uint8Array(await readFile(filePath));
  } catch {
    return undefined;
  }
}

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
