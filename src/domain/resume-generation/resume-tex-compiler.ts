import { spawn } from "node:child_process";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";

import type { MaterialDraftView } from "@/domain/resume-generation/material-draft-commands";
import { renderResumeDraftTex } from "@/domain/resume-generation/resume-tex";

const compilerTimeoutMilliseconds = 90_000;
const projectRoot = process.cwd();
const compilerPath = join(projectRoot, "tools", "tectonic", "tectonic.exe");
const scratchRoot = resolve(projectRoot, "tmp", "resume-tex");
const cacheRoot = resolve(projectRoot, "tmp", "tectonic-cache");
const bundleUrl = "https://data1b.fullyjustified.net/tlextras-2022.0r0.tar";

export class ResumeTexCompilationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResumeTexCompilationError";
  }
}

function inside(root: string, target: string): boolean {
  const value = relative(root, target);
  return Boolean(value) && !value.startsWith("..") && !isAbsolute(value);
}

async function compiler(): Promise<string> {
  try {
    const metadata = await stat(compilerPath);
    if (!metadata.isFile() || !inside(projectRoot, compilerPath)) throw new Error("unavailable");
    return compilerPath;
  } catch {
    throw new ResumeTexCompilationError("The local TeX compiler is unavailable.");
  }
}

async function run(command: string, args: string[], environment: NodeJS.ProcessEnv): Promise<void> {
  await new Promise<void>((resolveRun, rejectRun) => {
    let output = "";
    const child = spawn(command, args, { cwd: projectRoot, env: environment, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    const timer = setTimeout(() => {
      child.kill();
      rejectRun(new ResumeTexCompilationError("The generated resume took too long to compile."));
    }, compilerTimeoutMilliseconds);
    const rememberOutput = (chunk: Buffer) => { output = (output + chunk.toString("utf8")).slice(-4_000); };
    child.stdout.on("data", rememberOutput);
    child.stderr.on("data", rememberOutput);
    child.once("error", () => {
      clearTimeout(timer);
      rejectRun(new ResumeTexCompilationError("The local TeX compiler could not start."));
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      if (code === 0) resolveRun();
      else rejectRun(new ResumeTexCompilationError(output.includes("only-cached") ? "The local TeX template packages are not ready yet." : "The generated resume could not be compiled."));
    });
  });
}

/**
 * Compile the Resume.pdf-derived TeX source. The document is written only to
 * a private scratch directory, uses a fixed compiler and cached package bundle,
 * and never allows a model or user value to become a shell argument.
 */
export async function compileResumeDraftPdf(draft: MaterialDraftView): Promise<Uint8Array> {
  const executable = await compiler();
  await mkdir(scratchRoot, { recursive: true });
  await mkdir(cacheRoot, { recursive: true });
  const work = resolve(scratchRoot, draft.id + "-" + Date.now().toString(36));
  if (!inside(scratchRoot, work)) throw new ResumeTexCompilationError("The generated resume could not be compiled.");
  try {
    await mkdir(work);
    const sourcePath = join(work, "base-resume.tex");
    const outputPath = join(work, "base-resume.pdf");
    await writeFile(sourcePath, renderResumeDraftTex(draft), { encoding: "utf8", flag: "wx" });
    await run(executable, ["--bundle", bundleUrl, "--keep-logs", "--outdir", work, sourcePath], { ...process.env, TECTONIC_CACHE_DIR: cacheRoot });
    const bytes = new Uint8Array(await readFile(outputPath));
    if (bytes.byteLength < 1_000 || Buffer.from(bytes.subarray(0, 5)).toString("ascii") !== "%PDF-") throw new ResumeTexCompilationError("The generated resume PDF is invalid.");
    return bytes;
  } catch (error) {
    if (error instanceof ResumeTexCompilationError) throw error;
    throw new ResumeTexCompilationError("The generated resume could not be compiled.");
  } finally {
    await rm(work, { recursive: true, force: true }).catch(() => undefined);
  }
}
