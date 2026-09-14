import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { mock } from "node:test";
import type { MaterialDraftView } from "../../src/domain/resume-generation/material-draft-commands";

const kind = process.argv[2];
assert.ok(kind === "structured" || kind === "raw");
const root = process.argv[3];
assert.ok(root, "the test harness must supply a temporary project root");
const originalCwd = process.cwd();
const pdf = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(1_024, 0xa5)]);
const baseline = "\\documentclass{article}\n\\begin{document}\nOriginal\n\\end{document}\n";
const tex = baseline.replace("Original", "\\textbf{Synthetic résumé 工程}");
const draft: MaterialDraftView = {
  id: "00000000-0000-7000-8000-000000000001",
  profileLabel: "Synthetic candidate", templateLabel: "Resume.pdf",
  templateId: "00000000-0000-7000-8000-000000000002",
  templateDigest: `sha256:${"a".repeat(64)}`, evidenceLabels: [],
  sections: [{ heading: "Contact", text: "Synthetic Candidate" }],
  claims: [], unknowns: [], handedOff: false,
};
type Outcome = "valid" | "short" | "bad-header" | "missing" | "directory" | "nonzero" | "start-error" | "timeout";
let outcome: Outcome = "valid";
let killed = 0;
let spawned: () => void = () => undefined;
let releaseChild: () => void = () => undefined;
let permitExit = Promise.resolve();
const calls: Array<{ command: string; args: string[]; options: { cwd: string; env: NodeJS.ProcessEnv; stdio: string[]; windowsHide: boolean } }> = [];

// No executable is launched: real host filesystem staging/output checks surround
// this controlled child-process boundary, inside an entirely synthetic project.
mock.module("node:child_process", { exports: {
  spawn(command: string, args: string[], options: typeof calls[number]["options"]) {
    calls.push({ command, args, options });
    const child = Object.assign(new EventEmitter(), {
      stdout: new PassThrough(), stderr: new PassThrough(),
      kill: () => { killed += 1; return true; },
    });
    spawned();
    if (outcome === "timeout") return child;
    setImmediate(async () => {
      await permitExit;
      try {
        if (outcome === "start-error") {
          child.emit("error", new Error("synthetic private diagnostic"));
          return;
        }
        await writeFile(join(options.cwd, "resume.log"), "synthetic private diagnostic");
        await writeFile(join(options.cwd, "resume.aux"), "synthetic generated dependency");
        if (outcome === "directory") await mkdir(join(options.cwd, "resume.pdf"));
        else if (outcome !== "missing") await writeFile(join(options.cwd, "resume.pdf"),
          outcome === "short" ? Buffer.from("%PDF-1.4\n") : outcome === "bad-header" ? Buffer.alloc(1_024, 0x61) : pdf);
        child.stderr.emit("data", Buffer.from("synthetic private diagnostic".repeat(300)));
        child.emit("exit", outcome === "nonzero" ? 1 : 0);
      } catch (error) { child.emit("error", error); }
    });
    return child;
  },
} });

try {
  process.chdir(root);
  await mkdir(join(root, "tools", "tectonic"), { recursive: true });
  // A regular non-executable sentinel satisfies compiler discovery, but must
  // never run. The mock above is the only permitted subprocess implementation.
  await writeFile(join(root, "tools", "tectonic", "tectonic.exe"), "not executable");
  const { compileResumeDraftPdf, compileRawTexDraftPdf } = await import("../../src/domain/resume-generation/resume-tex-compiler.ts");
  const { renderResumeDraftTex } = await import("../../src/domain/resume-generation/resume-tex.ts");
  const appDataRoot = join(root, "private-app-data");
  const scratch = kind === "raw" ? join(appDataRoot, ".tex-draft-compile") : join(root, "tmp", "resume-tex");
  const cache = kind === "raw" ? join(appDataRoot, ".tectonic-cache") : join(root, "tmp", "tectonic-cache");
  const expectedSource = kind === "raw" ? tex : renderResumeDraftTex(draft);
  const compile = () => kind === "raw"
    ? compileRawTexDraftPdf({ tex, immutableBaseline: baseline, draftId: draft.id, appDataRoot })
    : compileResumeDraftPdf(draft);

  for (const next of ["valid", "short", "bad-header", "missing", "directory", "nonzero", "start-error", "timeout"] as const) {
    outcome = next;
    const callCount = calls.length;
    const didSpawn = new Promise<void>((resolve) => { spawned = resolve; });
    permitExit = new Promise<void>((resolve) => { releaseChild = resolve; });
    if (outcome === "timeout") mock.timers.enable({ apis: ["setTimeout"] });
    const compilation = compile();
    // Attach rejection handling immediately, including for synthetic start errors.
    const completed = outcome === "valid"
      ? compilation.then((bytes) => assert.deepEqual(Buffer.from(bytes), pdf))
      : assert.rejects(compilation, {
        name: "ResumeTexCompilationError",
        message: outcome === "start-error" ? "The local TeX compiler could not start."
          : outcome === "timeout" ? "The generated resume took too long to compile."
          : ["short", "bad-header", "directory"].includes(outcome) ? "The generated resume PDF is invalid."
          : "The generated resume could not be compiled.",
      });
    await didSpawn;
    assert.equal(calls.length, callCount + 1);
    const { command, args, options } = calls.at(-1)!;
    assert.equal(command, join(root, "tools", "tectonic", "tectonic.exe"));
    assert.equal(join(options.cwd, ".."), scratch);
    assert.match(options.cwd.slice(scratch.length + 1), new RegExp(`^${draft.id}-[a-z0-9]+$`));
    assert.deepEqual(args, [
      ...(kind === "raw" ? ["--untrusted", "--only-cached"] : ["--bundle", "https://data1b.fullyjustified.net/tlextras-2022.0r0.tar"]),
      "--keep-logs", "--outdir", options.cwd, join(options.cwd, "resume.tex"),
    ]);
    assert.deepEqual(options, { cwd: options.cwd, env: { ...process.env, TECTONIC_CACHE_DIR: cache }, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    assert.equal(await readFile(join(options.cwd, "resume.tex"), "utf8"), expectedSource);
    releaseChild();
    if (outcome === "timeout") {
      mock.timers.tick(89_999);
      assert.equal(killed, 0);
      mock.timers.tick(1);
    }
    await completed;
    if (outcome === "timeout") { assert.equal(killed, 1); mock.timers.reset(); }
    await assert.rejects(access(options.cwd), { code: "ENOENT" });
    assert.deepEqual(await readdir(scratch), [], `${outcome}: source, logs, aux and PDF must be removed`);
    await access(cache);
  }
  assert.equal(calls.length, 8);
  if (kind === "raw") {
    await assert.rejects(compileRawTexDraftPdf({ tex: tex.replace("Synthetic", "\\input{secret}"), immutableBaseline: baseline, draftId: draft.id, appDataRoot }), { name: "ResumeTexCompilationError" });
    assert.equal(calls.length, 8, "unsafe raw TeX must not spawn a compiler");
  }
} finally {
  mock.timers.reset();
  mock.restoreAll();
  process.chdir(originalCwd);
}
