import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Template importer is available only until the active resume has an imported contract", async () => {
  const page = await readFile(
    new URL("../src/app/resume-workspace.tsx", import.meta.url),
    "utf8",
  );
  const importer = await readFile(
    new URL("../src/app/base-resume-importer.tsx", import.meta.url),
    "utf8",
  );

  assert.match(page, /Shape your base resume/);
  assert.match(page, /Experience &amp; Projects/);
  assert.match(page, /!baselineReady \? <BaseResumeImporter \/> : null/);
  assert.doesNotMatch(
    page,
    /CurrentBaseResume|Retained resume history|Review changes before approving/,
  );
  assert.match(importer, /<label[^>]*htmlFor="base-resume-files"/);
  assert.match(importer, /id="base-resume-files"/);
  assert.match(importer, /type="file"/);
  assert.match(importer, /role="status"/);
  assert.match(importer, /aria-live="polite"/);
  assert.match(importer, /aria-invalid=\{state\.status === "error"\}/);
  assert.match(
    importer,
    /aria-describedby=\{\s*state\.status === "error" \? "base-resume-import-error"/,
  );
  assert.match(importer, /type="submit"/);
  assert.doesNotMatch(page, /storageLocation|primaryDigest|absolute/i);
});
