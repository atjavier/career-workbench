import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

for (const [kind, name] of [["structured", "compileResumeDraftPdf"], ["raw", "compileRawTexDraftPdf"]] as const) {
  test(`${name} preserves command, cwd, output validation and cleanup at runtime`, async () => {
    const root = await realpath(await mkdtemp(join(tmpdir(), "resume-tex-compiler-contract-")));
    try {
      const result = await execFileAsync(process.execPath, [
        "--experimental-test-module-mocks", "--import", "tsx",
        "tests/fixtures/resume-tex-compiler-contract.mts", kind, root,
      ], { cwd: process.cwd(), timeout: 30_000 });
      assert.equal(result.stdout, "");
      assert.doesNotMatch(result.stderr, /synthetic private diagnostic/);
    } finally {
      // On Windows the loader can hold cwd handles until the child exits.
      await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });
}
