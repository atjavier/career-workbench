import { createHash } from "node:crypto";
import {
  lstat,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";

import { resolveAppDataPaths } from "@/files/app-data";
import type { ResumeTemplateSource } from "@/persistence/resume-template-repository";

const maximumTemplateBytes = 10 * 1024 * 1024;
const abandonedStagingAgeMilliseconds = 60_000;
const activeStagingDirectories = new Set<string>();
const digest = (bytes: Uint8Array) =>
  `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

export type BundledResumeTemplateSnapshot = {
  bytes: Uint8Array;
  byteSize: number;
  contentDigest: string;
};

function storageSegments(source: ResumeTemplateSource): string[] | undefined {
  if (
    source.origin !== "bundled" ||
    source.state !== "verified" ||
    source.filename !== "Resume.pdf" ||
    source.contentType !== "application/pdf" ||
    isAbsolute(source.storageLocation)
  )
    return undefined;
  const segments = source.storageLocation.split(/[\\/]/);
  const expected = ["resume-templates", source.id, "Resume.pdf"];
  if (
    segments.some((segment) => !segment || segment === "." || segment === "..")
  )
    return undefined;
  return segments.length === expected.length &&
    segments.every((segment, index) => segment === expected[index])
    ? segments
    : undefined;
}

async function isRealDirectory(path: string): Promise<boolean> {
  try {
    const metadata = await lstat(path);
    return metadata.isDirectory() && !metadata.isSymbolicLink();
  } catch {
    return false;
  }
}

async function ensureRealDirectory(path: string): Promise<void> {
  try {
    const metadata = await lstat(path);
    if (!metadata.isDirectory() || metadata.isSymbolicLink())
      throw new Error("Unsafe template directory.");
    return;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  try {
    await mkdir(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
  const metadata = await lstat(path);
  if (!metadata.isDirectory() || metadata.isSymbolicLink())
    throw new Error("Unsafe template directory.");
}

async function templateDirectories(
  root: string,
): Promise<{ templateRoot: string; stagingRoot: string }> {
  if (!(await isRealDirectory(root)))
    throw new Error("Unsafe private workspace directory.");
  const templateRoot = resolve(root, "resume-templates");
  const stagingRoot = resolve(templateRoot, ".staging");
  if (
    [templateRoot, stagingRoot].some(
      (path) =>
        relative(root, path).startsWith("..") ||
        isAbsolute(relative(root, path)),
    )
  )
    throw new Error("Unsafe template directory.");
  await ensureRealDirectory(templateRoot);
  await ensureRealDirectory(stagingRoot);
  return { templateRoot, stagingRoot };
}

async function removeStagingDirectory(
  root: string,
  staging: string | undefined,
): Promise<void> {
  if (!staging) return;
  try {
    const { stagingRoot } = await templateDirectories(root);
    if (
      relative(stagingRoot, staging).startsWith("..") ||
      isAbsolute(relative(stagingRoot, staging))
    )
      return;
    const metadata = await lstat(staging);
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) return;
    await rm(staging, { recursive: true, force: true });
  } catch {
    // Do not follow an invalid path while attempting cleanup.
  }
}

function isPdf(bytes: Uint8Array): boolean {
  return (
    bytes.byteLength > 5 &&
    bytes.byteLength <= maximumTemplateBytes &&
    Buffer.from(bytes.subarray(0, 5)).toString("ascii") === "%PDF-"
  );
}

export async function readBundledResumeTemplate(): Promise<BundledResumeTemplateSnapshot> {
  const sourcePath = join(process.cwd(), "Resume.pdf");
  const metadata = await lstat(sourcePath);
  if (!metadata.isFile() || metadata.isSymbolicLink())
    throw new Error("Bundled resume template is unavailable.");
  const bytes = new Uint8Array(await readFile(sourcePath));
  if (metadata.size !== bytes.byteLength || !isPdf(bytes))
    throw new Error("Bundled resume template is invalid.");
  return { bytes, byteSize: bytes.byteLength, contentDigest: digest(bytes) };
}

export async function readVerifiedResumeTemplatePdf(
  root: string,
  source: ResumeTemplateSource,
): Promise<Uint8Array | undefined> {
  const segments = storageSegments(source);
  if (
    !segments ||
    !Number.isSafeInteger(source.byteSize) ||
    source.byteSize < 1 ||
    source.byteSize > maximumTemplateBytes ||
    !/^sha256:[a-f0-9]{64}$/.test(source.contentDigest)
  )
    return undefined;

  const templateRoot = resolve(root, segments[0]);
  const templateDirectory = resolve(templateRoot, segments[1]);
  const filePath = resolve(templateDirectory, segments[2]);
  if (
    [templateRoot, templateDirectory, filePath].some(
      (path) =>
        relative(root, path).startsWith("..") ||
        isAbsolute(relative(root, path)),
    )
  )
    return undefined;
  if (
    !(await isRealDirectory(root)) ||
    !(await isRealDirectory(templateRoot)) ||
    !(await isRealDirectory(templateDirectory))
  )
    return undefined;
  try {
    const metadata = await lstat(filePath);
    if (
      !metadata.isFile() ||
      metadata.isSymbolicLink() ||
      metadata.size !== source.byteSize
    )
      return undefined;
    const bytes = new Uint8Array(await readFile(filePath));
    return isPdf(bytes) && digest(bytes) === source.contentDigest
      ? bytes
      : undefined;
  } catch {
    return undefined;
  }
}

export async function cleanupAbandonedResumeTemplateStaging(
  appDataRoot?: string,
): Promise<void> {
  const paths = await resolveAppDataPaths(appDataRoot);
  let stagingRoot: string;
  try {
    ({ stagingRoot } = await templateDirectories(paths.root));
    const entries = await readdir(/* turbopackIgnore: true */ stagingRoot, {
      withFileTypes: true,
    });
    const expiredBefore = Date.now() - abandonedStagingAgeMilliseconds;
    await Promise.all(
      entries
        .filter((entry) => entry.isDirectory() && !entry.isSymbolicLink())
        .map(async (entry) => {
          const path = join(stagingRoot, entry.name);
          if (activeStagingDirectories.has(path)) return;
          const metadata = await lstat(path);
          if (
            metadata.isDirectory() &&
            !metadata.isSymbolicLink() &&
            metadata.mtimeMs <= expiredBefore
          )
            await rm(path, { recursive: true, force: true });
        }),
    );
  } catch {
    // A missing or unreadable staging root is handled by the bounded bootstrap operation.
  }
}

export async function stageBundledResumeTemplate(
  appDataRoot: string | undefined,
  id: string,
  snapshot: BundledResumeTemplateSnapshot,
): Promise<{
  root: string;
  final: string;
  storageLocation: string;
  byteSize: number;
  contentDigest: string;
}> {
  const paths = await resolveAppDataPaths(appDataRoot);
  let staging: string | undefined;
  let final: string | undefined;
  try {
    const { templateRoot, stagingRoot } = await templateDirectories(paths.root);
    staging = resolve(stagingRoot, id);
    final = resolve(templateRoot, id);
    activeStagingDirectories.add(staging);
    if (
      [staging, final].some(
        (path) =>
          relative(paths.root, path).startsWith("..") ||
          isAbsolute(relative(paths.root, path)),
      )
    )
      throw new Error("Unsafe template directory.");
    if (
      !isPdf(snapshot.bytes) ||
      snapshot.byteSize !== snapshot.bytes.byteLength ||
      snapshot.contentDigest !== digest(snapshot.bytes)
    )
      throw new Error("Bundled resume template is invalid.");
    await mkdir(staging);
    await writeFile(join(staging, "Resume.pdf"), snapshot.bytes, {
      flag: "wx",
    });
    const stagedMetadata = await lstat(join(staging, "Resume.pdf"));
    if (
      !stagedMetadata.isFile() ||
      stagedMetadata.isSymbolicLink() ||
      stagedMetadata.size !== snapshot.byteSize
    )
      throw new Error("Bundled resume template verification failed.");
    const stagedBytes = new Uint8Array(
      await readFile(join(staging, "Resume.pdf")),
    );
    if (!isPdf(stagedBytes) || digest(stagedBytes) !== snapshot.contentDigest)
      throw new Error("Bundled resume template verification failed.");
    if (
      !(await isRealDirectory(templateRoot)) ||
      !(await isRealDirectory(stagingRoot))
    )
      throw new Error("Unsafe template directory.");
    await rename(staging, final);
    return {
      root: paths.root,
      final,
      storageLocation: `resume-templates/${id}/Resume.pdf`,
      byteSize: stagedBytes.byteLength,
      contentDigest: snapshot.contentDigest,
    };
  } catch (error) {
    await removeStagingDirectory(paths.root, staging);
    throw error;
  } finally {
    if (staging) activeStagingDirectories.delete(staging);
  }
}

export async function cleanupResumeTemplate(
  root: string,
  path: string | undefined,
): Promise<void> {
  if (!path) return;
  try {
    const { templateRoot } = await templateDirectories(root);
    if (
      relative(templateRoot, path).startsWith("..") ||
      isAbsolute(relative(templateRoot, path))
    )
      return;
    const metadata = await lstat(path);
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) return;
    await rm(path, { recursive: true, force: true });
  } catch {
    // Do not follow an invalid path while attempting cleanup.
  }
}
