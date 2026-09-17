import { spawn } from "node:child_process";
import { lstat, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";

import type { MaterialDraftView } from "@/domain/resume-generation/material-draft-commands";
import { renderResumeDraftTex } from "@/domain/resume-generation/resume-tex";
import { resolveAppDataPaths } from "@/files/app-data";

const compilerTimeoutMilliseconds = 90_000;
const projectRoot = process.cwd();
const compilerPath = join(projectRoot, "tools", "tectonic", "tectonic.exe");
const scratchRoot = resolve(projectRoot, "tmp", "resume-tex");
const cacheRoot = resolve(projectRoot, "tmp", "tectonic-cache");
export const maximumRawTexBytes = 180_000;
export const maximumResumePdfBytes = 10 * 1024 * 1024;
const bundleUrl = "https://data1b.fullyjustified.net/tlextras-2022.0r0.tar";

export class ResumeTexCompilationError extends Error {
  cleanupPath?: string;

  constructor(
    message: string,
    readonly cleanupSafe = true,
  ) {
    super(message);
    this.name = "ResumeTexCompilationError";
  }
}

function inside(root: string, target: string): boolean {
  const value = relative(root, target);
  return Boolean(value) && !value.startsWith("..") && !isAbsolute(value);
}
function insideOrEqual(root: string, target: string): boolean {
  return root === target || inside(root, target);
}

/** The compiler must never create, read, write, clean, or execute through links. */
async function assertSafeDirectoryAncestors(
  root: string,
  target: string,
): Promise<void> {
  const resolvedRoot = resolve(root);
  const parent = resolve(target);
  if (!insideOrEqual(resolvedRoot, parent))
    throw new ResumeTexCompilationError(
      "The generated resume could not be compiled.",
    );
  let current = resolvedRoot;
  const rootMetadata = await lstat(current);
  if (!rootMetadata.isDirectory() || rootMetadata.isSymbolicLink())
    throw new ResumeTexCompilationError(
      "The generated resume could not be compiled.",
    );
  const parts = relative(resolvedRoot, parent).split(/[\\/]/).filter(Boolean);
  for (const [index, part] of parts.entries()) {
    current = join(current, part);
    const metadata = await lstat(current).catch(
      (error: NodeJS.ErrnoException) =>
        error.code === "ENOENT" ? undefined : Promise.reject(error),
    );
    if (!metadata) return;
    if (
      metadata.isSymbolicLink() ||
      (!metadata.isDirectory() && index < parts.length - 1)
    )
      throw new ResumeTexCompilationError(
        "The generated resume could not be compiled.",
      );
  }
}
async function ensureSafeDirectory(root: string, directory: string): Promise<void> {
  await assertSafeDirectoryAncestors(root, directory);
  await mkdir(directory, { recursive: true });
  await assertSafeDirectoryAncestors(root, directory);
}
async function removeSafeDirectory(root: string, directory: string): Promise<void> {
  await assertSafeDirectoryAncestors(root, directory);
  const metadata = await lstat(directory).catch(
    (error: NodeJS.ErrnoException) =>
      error.code === "ENOENT" ? undefined : Promise.reject(error),
  );
  if (!metadata) return;
  if (!metadata.isDirectory() || metadata.isSymbolicLink())
    throw new ResumeTexCompilationError(
      "Private TeX compilation files could not be cleaned up safely.",
    );
  await rm(directory, { recursive: true, force: true });
}

async function compiler(): Promise<string> {
  const binaryName = process.platform === "win32" ? "tectonic.exe" : "tectonic";
  const projectCandidates = [
    join(projectRoot, "tools", "tectonic", binaryName),
    join(projectRoot, "tools", "tectonic", "tectonic.exe"),
    join(projectRoot, "tools", "tectonic", "tectonic"),
  ];
  for (const candidate of projectCandidates) {
    try {
      await assertSafeDirectoryAncestors(projectRoot, candidate);
      const metadata = await lstat(candidate);
      if (
        metadata.isFile() &&
        !metadata.isSymbolicLink() &&
        inside(projectRoot, candidate)
      ) {
        return candidate;
      }
    } catch {}
  }
  if (process.platform !== "win32") {
    const systemCandidates = [
      "/opt/homebrew/bin/tectonic",
      "/usr/local/bin/tectonic",
      "/usr/bin/tectonic",
    ];
    for (const sysPath of systemCandidates) {
      try {
        const metadata = await lstat(sysPath);
        if (metadata.isFile() && !metadata.isSymbolicLink()) {
          return sysPath;
        }
      } catch {}
    }
  }
  throw new ResumeTexCompilationError(
    "The local TeX compiler is unavailable.",
  );
}

async function run(
  command: string,
  args: string[],
  environment: NodeJS.ProcessEnv,
  cwd: string,
): Promise<void> {
  await new Promise<void>((resolveRun, rejectRun) => {
    let output = "";
    let timedOut = false;
    let settled = false;
    const child = spawn(command, args, {
      cwd,
      env: environment,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (error) rejectRun(error);
      else resolveRun();
    };
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill();
      finish(
        new ResumeTexCompilationError(
          "The generated resume took too long to compile.",
        ),
      );
    }, compilerTimeoutMilliseconds);
    // Diagnostics remain bounded and are deliberately never returned or logged.
    const rememberOutput = (chunk: Buffer) => {
      output = (output + chunk.toString("utf8")).slice(-4_000);
    };
    child.stdout.on("data", rememberOutput);
    child.stderr.on("data", rememberOutput);
    child.once("error", () =>
      finish(
        new ResumeTexCompilationError(
          "The local TeX compiler could not start.",
        ),
      ),
    );
    child.once("exit", (code) => {
      if (timedOut)
        finish(
          new ResumeTexCompilationError(
            "The generated resume took too long to compile.",
          ),
        );
      else if (code === 0) finish();
      else
        finish(
          new ResumeTexCompilationError(
            output.includes("only-cached")
              ? "The local TeX template packages are not ready yet. Review the standard resume preview once, then retry the editable draft."
              : "The generated resume could not be compiled.",
          ),
        );
    });
  });
}

function bracesBalanced(tex: string): boolean {
  let depth = 0;
  for (let index = 0; index < tex.length; index += 1) {
    if (tex[index] === "\\") {
      index += 1;
      continue;
    }
    if (tex[index] === "{") depth += 1;
    if (tex[index] === "}" && --depth < 0) return false;
  }
  return depth === 0;
}

const forbiddenBodyCommand =
  /\\(?:documentclass|usepackage|requirepackage|input|include|includegraphics|openin|openout|read|write|immediate|write18|shellescape|inputenc|catcode|csname|endcsname|def|gdef|xdef|edef|let|futurelet|every|loop|repeat|directlua|pdfliteral|pdfobj|special|href|url|bibliography|addbibresource)\b/i;
const fixedBodyCommands = new Set([
  "section",
  "subsection",
  "textbf",
  "textit",
  "emph",
  "underline",
  "item",
  "begin",
  "end",
  "hfill",
  "hspace",
  "vspace",
  "fontsize",
  "selectfont",
  "smallskip",
  "medskip",
  "bigskip",
  "noindent",
  "newline",
  "linebreak",
  "par",
  "quad",
  "qquad",
  "ldots",
  "textbullet",
  "enspace",
]);
const fixedEnvironments = new Set([
  "itemize",
  "enumerate",
  "tabular",
  "center",
  "flushleft",
  "flushright",
]);

function bodyBounds(tex: string): { start: number; end: number } | undefined {
  const marker = "\\begin{document}";
  const start = tex.indexOf(marker);
  const end = tex.lastIndexOf("\\end{document}");
  return start >= 0 && end > start ? { start: start + marker.length, end } : undefined;
}
function declaredCommands(preamble: string): string[] {
  return [
    ...preamble.matchAll(
      /\\(?:newcommand|renewcommand|providecommand)\*?\s*\{\\([A-Za-z@]+)\}/g,
    ),
  ].map((match) => match[1]!);
}
function declaredEnvironments(preamble: string): string[] {
  return [
    ...preamble.matchAll(
      /\\(?:newenvironment|renewenvironment)\*?\s*\{([A-Za-z@]+)\}/g,
    ),
  ].map((match) => match[1]!);
}

/** Commands the model may use, derived only from the verified baseline. */
export function rawTexDocumentPolicy(immutableBaseline: string): {
  commands: string[];
  environments: string[];
} {
  const bounds = bodyBounds(immutableBaseline);
  if (!bounds)
    throw new ResumeTexCompilationError(
      "The immutable TeX template is malformed.",
    );
  const preamble = immutableBaseline.slice(0, bounds.start);
  const baselineBody = immutableBaseline.slice(bounds.start, bounds.end);
  const commands = new Set(fixedBodyCommands);
  for (const name of declaredCommands(preamble)) commands.add(name);
  for (const match of baselineBody.matchAll(/\\([A-Za-z@]+)\*?/g))
    if (!forbiddenBodyCommand.test(match[0])) commands.add(match[1]!);
  const environments = new Set(fixedEnvironments);
  for (const name of declaredEnvironments(preamble)) environments.add(name);
  for (const match of baselineBody.matchAll(/\\begin\{([A-Za-z@]+)\}/g))
    if (match[1] !== "document") environments.add(match[1]!);
  return {
    commands: [...commands].sort(),
    environments: [...environments].sort(),
  };
}

function hasUnescapedComment(body: string): boolean {
  for (let index = 0; index < body.length; index += 1) {
    if (body[index] !== "%") continue;
    let slashes = 0;
    for (let cursor = index - 1; cursor >= 0 && body[cursor] === "\\"; cursor -= 1)
      slashes += 1;
    if (slashes % 2 === 0) return true;
  }
  return false;
}
function environmentsAreCanonicalAndBalanced(
  body: string,
  allowed: Set<string>,
): boolean {
  const stack: string[] = [];
  const commands = [...body.matchAll(/\\(begin|end)\b/g)];
  for (const command of commands) {
    const tail = body.slice(command.index);
    const canonical = /^\\(begin|end)\{([A-Za-z@]+)\}/.exec(tail);
    if (!canonical || canonical[1] !== command[1] || !allowed.has(canonical[2]!))
      return false;
    if (canonical[1] === "begin") stack.push(canonical[2]!);
    else if (stack.pop() !== canonical[2]) return false;
  }
  return stack.length === 0;
}

/**
 * Model TeX may change only the document body. The imported preamble is an
 * immutable host-controlled capability boundary. Body commands are limited to
 * fixed inert structure plus commands/environments authorized by that verified
 * baseline; dangerous primitives remain forbidden even if named there.
 */
export function validateRawTexDocument(
  tex: string,
  immutableBaseline: string,
): void {
  const bytes = Buffer.byteLength(tex, "utf8");
  if (
    !tex ||
    bytes > maximumRawTexBytes ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/.test(tex)
  )
    throw new ResumeTexCompilationError(
      "The local model returned an invalid TeX document.",
    );
  const marker = "\\begin{document}";
  const baselineStart = immutableBaseline.indexOf(marker);
  const start = tex.indexOf(marker);
  if (
    baselineStart < 0 ||
    start !== baselineStart ||
    tex.slice(0, start + marker.length) !==
      immutableBaseline.slice(0, baselineStart + marker.length)
  )
    throw new ResumeTexCompilationError(
      "The local model changed the protected TeX template preamble.",
    );
  const endMarker = "\\end{document}";
  const end = tex.lastIndexOf(endMarker);
  if (
    end < start ||
    tex.slice(end + endMarker.length).trim() ||
    tex.indexOf(endMarker) !== end ||
    !bracesBalanced(tex)
  )
    throw new ResumeTexCompilationError(
      "The local model returned a malformed TeX document.",
    );
  const body = tex.slice(start + marker.length, end);
  if (/\^\^/.test(body))
    throw new ResumeTexCompilationError(
      "The local model returned TeX character-code escapes that are not permitted for a private draft.",
    );
  if (forbiddenBodyCommand.test(body) || hasUnescapedComment(body))
    throw new ResumeTexCompilationError(
      "The local model returned TeX that is not permitted for a private draft.",
    );
  const policy = rawTexDocumentPolicy(immutableBaseline);
  const allowedCommands = new Set(policy.commands);
  for (const match of body.matchAll(/\\([A-Za-z@]+)\*?/g))
    if (!allowedCommands.has(match[1]!))
      throw new ResumeTexCompilationError(
        "The local model returned TeX commands outside the verified template policy.",
      );
  if (!environmentsAreCanonicalAndBalanced(body, new Set(policy.environments)))
    throw new ResumeTexCompilationError(
      "The local model returned TeX environments outside the verified template policy.",
    );
}

async function compileSource(
  source: string,
  draftId: string,
  root: string,
  cache: string,
  privateRoot: string,
  isolated = false,
): Promise<Uint8Array> {
  const executable = await compiler();
  await ensureSafeDirectory(privateRoot, root);
  await ensureSafeDirectory(privateRoot, cache);
  const work = resolve(root, `${draftId}-${Date.now().toString(36)}`);
  if (!inside(root, work))
    throw new ResumeTexCompilationError(
      "The generated resume could not be compiled.",
    );
  let cleanupSafe = true;
  try {
    await ensureSafeDirectory(privateRoot, work);
    const sourcePath = join(work, "resume.tex");
    const outputPath = join(work, "resume.pdf");
    await assertSafeDirectoryAncestors(privateRoot, sourcePath);
    await writeFile(sourcePath, source, { encoding: "utf8", flag: "wx" });
    await assertSafeDirectoryAncestors(privateRoot, cache);
    const sourceMetadata = await lstat(sourcePath);
    if (!sourceMetadata.isFile() || sourceMetadata.isSymbolicLink())
      throw new ResumeTexCompilationError(
        "The generated resume could not be compiled.",
      );
    // Untrusted model TeX may read only a cache previously provisioned by the
    // host's established structured-template compilation path.
    const args = isolated
      ? ["--untrusted", "--only-cached", "--keep-logs", "--outdir", work, sourcePath]
      : ["--bundle", bundleUrl, "--keep-logs", "--outdir", work, sourcePath];
    await run(
      executable,
      args,
      { ...process.env, TECTONIC_CACHE_DIR: cache },
      work,
    );
    await assertSafeDirectoryAncestors(privateRoot, outputPath);
    const outputMetadata = await lstat(outputPath);
    if (
      !outputMetadata.isFile() ||
      outputMetadata.isSymbolicLink() ||
      outputMetadata.size > maximumResumePdfBytes
    )
      throw new ResumeTexCompilationError(
        "The generated resume PDF is invalid.",
      );
    const bytes = new Uint8Array(await readFile(outputPath));
    if (
      bytes.byteLength < 1_000 ||
      Buffer.from(bytes.subarray(0, 5)).toString("ascii") !== "%PDF-"
    )
      throw new ResumeTexCompilationError(
        "The generated resume PDF is invalid.",
      );
    return bytes;
  } catch (error) {
    if (error instanceof ResumeTexCompilationError) {
      cleanupSafe = error.cleanupSafe;
      if (!cleanupSafe) error.cleanupPath = work;
      throw error;
    }
    throw new ResumeTexCompilationError(
      "The generated resume could not be compiled.",
    );
  } finally {
    if (cleanupSafe) {
      try {
        await removeSafeDirectory(privateRoot, work);
      } catch {
        throw Object.assign(
          new ResumeTexCompilationError(
            "Private TeX compilation files could not be cleaned up; retry cleanup from Data & Storage.",
          ),
          { cleanupPath: work },
        );
      }
    }
  }
}

/** Compile the existing structured Resume.pdf renderer without changing its contract. */
export async function compileResumeDraftPdf(
  draft: MaterialDraftView,
): Promise<Uint8Array> {
  return compileSource(
    renderResumeDraftTex(draft),
    draft.id,
    scratchRoot,
    cacheRoot,
    projectRoot,
  );
}

/** Compile only a validated host-owned raw document in private app-data scratch. */
export async function compileRawTexDraftPdf(input: {
  tex: string;
  immutableBaseline: string;
  draftId: string;
  appDataRoot?: string;
}): Promise<Uint8Array> {
  validateRawTexDocument(input.tex, input.immutableBaseline);
  const paths = await resolveAppDataPaths(input.appDataRoot);
  return compileSource(
    input.tex,
    input.draftId,
    resolve(paths.root, ".tex-draft-compile"),
    resolve(paths.root, ".tectonic-cache"),
    paths.root,
    true,
  );
}
