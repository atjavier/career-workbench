import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);

test("Base Resume server action enforces upload limits before materializing bytes and refreshes the profile", async () => {
  const action = await readFile(
    new URL("../src/app/actions.ts", import.meta.url),
    "utf8",
  );
  const config = await readFile(
    new URL("../next.config.ts", import.meta.url),
    "utf8",
  );
  assert.match(config, /bodySizeLimit: "16mb"/);
  assert.match(
    action,
    /file\.size === 0 \|\| file\.size > maximumBaseResumeFileSize/,
  );
  assert.match(action, /revalidatePath\("\/"\)/);
});

test("Base Resume generation creates and passes a session scoped to active workspace-managed roots", async () => {
  await execFileAsync(
    process.execPath,
    [
      "--experimental-test-module-mocks",
      "--import",
      "tsx",
      "tests/fixtures/generate-base-resume-action-session.mts",
    ],
    { cwd: process.cwd() },
  );
});

test("Base Resume generation sends only eligible candidate clarifications", async () => {
  const action = await readFile(
    new URL("../src/app/actions.ts", import.meta.url),
    "utf8",
  );

  assert.match(
    action,
    /listClarifiedEvidenceInDatabase\(db, workspace\.id\)\s*\.filter\(\(item\) => !item\.needsReview\)/,
  );
  assert.match(action, /clarifications: eligibleClarifications/);
});

test("Base Resume regeneration accepts an empty revision request while retaining generation gates", async () => {
  const action = await readFile(
    new URL("../src/app/actions.ts", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(
    action,
    /generationCommand === "revision" && !requestedRevision/,
  );
  assert.match(
    action,
    /const userRequest = requestedRevision\s*\?\s*`Create a revised base resume from my saved profile and all documented work\./,
  );
  assert.match(
    action,
    /: "Create a base resume draft from my saved profile and all documented work\."/,
  );
  assert.match(
    action,
    /generationCommand === "initial" &&\s*journey\.nextAction !== "generate_resume"/,
  );
  assert.match(
    action,
    /generationCommand === "revision" &&\s*journey\.nextAction !== "generate_resume" &&\s*journey\.nextAction !== "view_resume"/,
  );
});
