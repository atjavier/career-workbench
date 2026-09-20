import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { basename, join, relative, resolve } from "node:path";

import { createAuditEvent, createUuidV7 } from "@/audit/audit-event";
import { resolveAppDataPaths } from "@/files/app-data";
import { applyMigrations, openDatabase } from "@/persistence/database";
import {
  findBaseResumeByDigest,
  insertBaseResume,
  type StoredBaseResume,
  type StoredBaseResumeFile,
} from "@/persistence/base-resume-repository";
import { appendAuditEvent } from "@/persistence/workspace-repository";
import { WorkspaceError } from "@/domain/workspace/types";

export type ImportBaseResumeFile = { name: string; bytes: Uint8Array };
export type ImportBaseResumeRequest = {
  appDataRoot?: string;
  files: ImportBaseResumeFile[];
};
export type ImportedBaseResume = {
  baseResume: StoredBaseResume;
  files: StoredBaseResumeFile[];
};
type ImportDependencies = {
  stageFile?: (path: string, bytes: Uint8Array) => Promise<void>;
};

const allowedExtensions = [
  ".tex",
  ".pdf",
  ".aux",
  ".log",
  ".out",
  ".synctex.gz",
];
const reservedWindowsNames = new Set([
  "CON",
  "PRN",
  "AUX",
  "NUL",
  "COM1",
  "COM2",
  "COM3",
  "COM4",
  "COM5",
  "COM6",
  "COM7",
  "COM8",
  "COM9",
  "LPT1",
  "LPT2",
  "LPT3",
  "LPT4",
  "LPT5",
  "LPT6",
  "LPT7",
  "LPT8",
  "LPT9",
]);
export const maximumBaseResumeFileSize = 10 * 1024 * 1024;
export const maximumBaseResumeFiles = 12;
export const maximumBaseResumeTotalSize = 12 * 1024 * 1024;

function digest(bytes: Uint8Array): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}
function displayFilename(name: string): string {
  return basename(name).replace(/[\u0000-\u001f]/g, "") || "selected file";
}
function validFilename(name: string): boolean {
  const extension = allowedExtensions.find((candidate) =>
    name.toLowerCase().endsWith(candidate),
  );
  const stem = extension
    ? name
        .slice(0, -extension.length)
        .replace(/[. ]+$/, "")
        .toUpperCase()
    : "";
  return (
    basename(name) === name &&
    !/[\u0000-\u001f]/.test(name) &&
    Boolean(extension) &&
    !reservedWindowsNames.has(stem)
  );
}

function validate(files: ImportBaseResumeFile[]): ImportBaseResumeFile {
  if (files.length === 0)
    throw new WorkspaceError(
      "BASE_RESUME_INVALID",
      "No files were selected for import.",
      "Choose the resume .tex file and supported companion files, then try again.",
    );
  if (files.length > maximumBaseResumeFiles)
    throw new WorkspaceError(
      "BASE_RESUME_INVALID",
      `The selected file ${displayFilename(files[maximumBaseResumeFiles].name)} cannot be imported.`,
      "Choose no more than 12 supported files and try again.",
    );
  const seen = new Set<string>();
  for (const file of files) {
    if (
      !validFilename(file.name) ||
      file.bytes.byteLength === 0 ||
      file.bytes.byteLength > maximumBaseResumeFileSize ||
      seen.has(file.name.toLowerCase())
    )
      throw new WorkspaceError(
        "BASE_RESUME_INVALID",
        `The selected file ${displayFilename(file.name)} cannot be imported.`,
        "Choose a readable supported file and try again.",
      );
    seen.add(file.name.toLowerCase());
  }
  const primary = files.filter((file) =>
    file.name.toLowerCase().endsWith(".tex"),
  );
  if (primary.length !== 1) {
    const affectedFile = primary[1] ?? files[0];
    throw new WorkspaceError(
      "BASE_RESUME_PRIMARY_REQUIRED",
      `The selected file ${displayFilename(affectedFile.name)} cannot be imported without exactly one .tex Base Resume.`,
      "Choose exactly one readable .tex Base Resume file and try again.",
    );
  }
  return primary[0];
}

export async function importBaseResume(
  request: ImportBaseResumeRequest,
  dependencies: ImportDependencies = {},
): Promise<ImportedBaseResume> {
  const paths = await resolveAppDataPaths(request.appDataRoot);
  const database = openDatabase(paths.databasePath);
  let finalDirectory: string | undefined;
  let stagingDirectory: string | undefined;
  let primaryDigest: string | undefined;
  let primaryFilename: string | undefined;
  let duplicateId: string | undefined;
  try {
    applyMigrations(database);
    const primary = validate(request.files);
    primaryFilename = primary.name;
    primaryDigest = digest(primary.bytes);
    const duplicate = findBaseResumeByDigest(database, primaryDigest);
    if (duplicate) {
      duplicateId = duplicate.id;
      throw new WorkspaceError(
        "BASE_RESUME_DUPLICATE",
        `The selected file ${primary.name} is already imported.`,
        "Choose a different Base Resume file or review the existing read-only import.",
      );
    }
    const id = createUuidV7();
    const storageLocation = join("base-resumes", id, primary.name).replaceAll(
      "\\",
      "/",
    );
    const baseResume: StoredBaseResume = {
      id,
      primaryFilename: primary.name,
      primaryDigest,
      importedAt: new Date().toISOString(),
      storageLocation,
    };
    const files = request.files.map((file) => ({
      id: createUuidV7(),
      baseResumeId: id,
      filename: file.name,
      contentDigest: digest(file.bytes),
      byteSize: file.bytes.byteLength,
      storageLocation: join("base-resumes", id, file.name).replaceAll(
        "\\",
        "/",
      ),
    }));
    const baseDirectory = join(paths.root, "base-resumes");
    finalDirectory = join(baseDirectory, id);
    stagingDirectory = join(paths.root, ".import-staging", id);
    await mkdir(stagingDirectory, { recursive: true });
    const stageFile =
      dependencies.stageFile ??
      ((path, bytes) => writeFile(path, bytes, { flag: "wx" }));
    for (const file of request.files)
      await stageFile(
        join(/* turbopackIgnore: true */ stagingDirectory, file.name),
        file.bytes,
      );
    await mkdir(baseDirectory, { recursive: true });
    await rename(stagingDirectory, finalDirectory);
    stagingDirectory = undefined;

    database.exec("BEGIN IMMEDIATE;");
    try {
      insertBaseResume(database, baseResume, files);
      appendAuditEvent(
        database,
        createAuditEvent({
          actor: "local-os-user",
          action: "base_resume.imported",
          outcome: "success",
          entityId: id,
          contentHash: primaryDigest,
        }),
      );
      database.exec("COMMIT;");
      return { baseResume, files };
    } catch (error) {
      database.exec("ROLLBACK;");
      throw error;
    }
  } catch (error) {
    let failure = error;
    if (
      primaryDigest &&
      error instanceof Error &&
      error.message.includes(
        "UNIQUE constraint failed: base_resumes.primary_digest",
      )
    ) {
      duplicateId = findBaseResumeByDigest(database, primaryDigest)?.id;
      failure = new WorkspaceError(
        "BASE_RESUME_DUPLICATE",
        `The selected file ${displayFilename(primaryFilename ?? "resume.tex")} is already imported.`,
        "Choose a different Base Resume file or review the existing read-only import.",
      );
    }
    if (stagingDirectory)
      await rm(stagingDirectory, { recursive: true, force: true }).catch(
        () => undefined,
      );
    if (finalDirectory)
      await rm(finalDirectory, { recursive: true, force: true }).catch(
        () => undefined,
      );
    try {
      appendAuditEvent(
        database,
        createAuditEvent({
          actor: "local-os-user",
          action: "base_resume.import_failed",
          outcome: "failure",
          entityId: duplicateId,
          contentHash: primaryDigest,
        }),
      );
    } catch {
      // Import failure auditing is best-effort and never exposes filesystem diagnostics.
    }
    throw failure;
  } finally {
    database.close();
  }
}

export function isRelativePrivateLocation(
  location: string,
  appDataRoot: string,
): boolean {
  return (
    !location.includes("..") &&
    !relative(resolve(appDataRoot), resolve(appDataRoot, location)).startsWith(
      "..",
    )
  );
}

export async function bootstrapBundledBaseResume(
  input: { appDataRoot?: string } = {},
): Promise<ImportedBaseResume | undefined> {
  const paths = await resolveAppDataPaths(input.appDataRoot);
  const db = openDatabase(paths.databasePath);
  let existingCount = 0;
  try {
    applyMigrations(db);
    const row = db
      .prepare("SELECT count(*) AS count FROM base_resumes")
      .get() as { count: number } | undefined;
    existingCount = row?.count ?? 0;
  } finally {
    db.close();
  }
  if (existingCount > 0) return undefined;

  const templatePath = join(process.cwd(), "resume-template.tex");
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await readFile(templatePath));
  } catch {
    return undefined;
  }
  if (!bytes.byteLength) return undefined;

  return await importBaseResume({
    appDataRoot: input.appDataRoot,
    files: [{ name: "resume-template.tex", bytes }],
  });
}

