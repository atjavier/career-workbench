import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Candidate Profile exposes a labeled, keyboard-operable Base Resume import and accessible outcome", async () => {
  const page = await readFile(new URL("../src/app/page.tsx", import.meta.url), "utf8");
  const importer = await readFile(new URL("../src/app/base-resume-importer.tsx", import.meta.url), "utf8");

  assert.match(page, /Read-only Base Resume/);
  assert.match(page, /Drafts.*not available yet/);
  assert.match(page, /Material Versions.*not available yet/);
  assert.match(importer, /<label[^>]*htmlFor="base-resume-files"/);
  assert.match(importer, /id="base-resume-files"/);
  assert.match(importer, /type="file"/);
  assert.match(importer, /role="status"/);
  assert.match(importer, /aria-live="polite"/);
  assert.match(importer, /aria-invalid=\{state\.status === "error"\}/);
  assert.match(importer, /aria-describedby=\{state\.status === "error" \? "base-resume-import-error"/);
  assert.match(importer, /type="submit"/);
  assert.doesNotMatch(page, /storageLocation|primaryDigest|absolute/i);
});
