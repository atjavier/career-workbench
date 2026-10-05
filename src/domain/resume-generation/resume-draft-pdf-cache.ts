import { lstat, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";

import type { MaterialDraftView } from "@/domain/resume-generation/material-draft-types";
import { compileResumeDraftPdf } from "@/domain/resume-generation/resume-tex-compiler";
import { resolveAppDataPaths } from "@/files/app-data";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidDraftId(draftId: string): boolean {
  return uuidPattern.test(draftId);
}

function inside(root: string, target: string): boolean {
  const value = relative(root, target);
  return Boolean(value) && !value.startsWith("..") && !isAbsolute(value);
}

const inFlightCompilations = new Map<string, Promise<Uint8Array>>();

export type ResumeDraftPdfOptions = {
  appDataRoot?: string;
  compiler?: (draft: MaterialDraftView) => Promise<Uint8Array>;
};

export async function getCachedResumeDraftPdf(
  draftId: string,
  options?: { appDataRoot?: string },
): Promise<Uint8Array | undefined> {
  if (!isValidDraftId(draftId)) return undefined;
  try {
    const paths = await resolveAppDataPaths(options?.appDataRoot);
    const cacheDir = resolve(paths.root, "pdf-cache");
    const cacheFile = resolve(cacheDir, `${draftId}.pdf`);
    if (!inside(paths.root, cacheFile)) return undefined;
    const metadata = await lstat(cacheFile);
    if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size === 0) {
      return undefined;
    }
    const bytes = new Uint8Array(await readFile(cacheFile));
    if (
      bytes.byteLength >= 5 &&
      Buffer.from(bytes.subarray(0, 5)).toString("ascii") === "%PDF-"
    ) {
      return bytes;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export async function cacheResumeDraftPdf(
  draftId: string,
  bytes: Uint8Array,
  options?: { appDataRoot?: string },
): Promise<void> {
  if (!isValidDraftId(draftId)) return;
  if (
    bytes.byteLength < 5 ||
    Buffer.from(bytes.subarray(0, 5)).toString("ascii") !== "%PDF-"
  ) {
    return;
  }
  try {
    const paths = await resolveAppDataPaths(options?.appDataRoot);
    const cacheDir = resolve(paths.root, "pdf-cache");
    const cacheFile = resolve(cacheDir, `${draftId}.pdf`);
    if (!inside(paths.root, cacheFile)) return;
    await mkdir(cacheDir, { recursive: true });
    const tempFile = resolve(
      cacheDir,
      `${draftId}.${Date.now().toString(36)}.${Math.random().toString(36).slice(2, 8)}.tmp`,
    );
    try {
      await writeFile(tempFile, bytes);
      await rename(tempFile, cacheFile);
    } catch {
      await rm(tempFile, { force: true }).catch(() => undefined);
    }
  } catch {
    // Caching failures are non-fatal
  }
}

export async function getOrCompileResumeDraftPdf(
  draft: MaterialDraftView,
  options?: ResumeDraftPdfOptions,
): Promise<Uint8Array> {
  if (!isValidDraftId(draft.id)) {
    throw new Error("Invalid draft ID.");
  }
  const inFlight = inFlightCompilations.get(draft.id);
  if (inFlight) {
    return await inFlight;
  }
  const compiler = options?.compiler ?? compileResumeDraftPdf;
  const compilePromise = (async () => {
    try {
      const cached = await getCachedResumeDraftPdf(draft.id, options);
      if (cached) {
        return cached;
      }
      const bytes = await compiler(draft);
      await cacheResumeDraftPdf(draft.id, bytes, options);
      return bytes;
    } finally {
      inFlightCompilations.delete(draft.id);
    }
  })();
  inFlightCompilations.set(draft.id, compilePromise);
  return await compilePromise;
}

export function clearInFlightCompilations(): void {
  inFlightCompilations.clear();
}
