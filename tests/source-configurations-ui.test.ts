import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Permitted Sources remains an accessible historical policy control outside the active Jobs experience", async () => {
  const [ui, page, actions, sourceConfigurations] = await Promise.all([
    readFile(
      new URL("../src/app/permitted-sources.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../src/app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/actions.ts", import.meta.url), "utf8"),
    readFile(
      new URL(
        "../src/domain/discovery/source-configurations.ts",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);
  for (const label of [
    "Careers-page URL",
    "Save a careers page URL",
    "Source name",
    "Source type",
    "Source URL",
    "Access path",
    "Policy review date",
    "Policy revision",
    "Request budget",
    "Rate limit per minute",
    "Retention rule",
    "Failure guidance",
    "Policy reviewed and approved",
    "Enable for future retrieval",
  ])
    assert.match(ui, new RegExp(label));
  assert.match(ui, /useActionState/);
  assert.match(ui, /<label/);
  assert.match(ui, /aria-invalid/);
  assert.match(ui, /aria-describedby/);
  assert.match(ui, /role="status"/);
  assert.match(ui, /aria-live="polite"/);
  assert.match(ui, /disabled=\{pending\}/);
  assert.match(ui, /disabled=\{careersPagePending\}/);
  assert.match(ui, /maxLength=\{2048\}/);
  assert.match(ui, /Safe next action:/);
  assert.doesNotMatch(page, /Permitted Sources/);
  assert.match(actions, /sourceConfigurationAction/);
  assert.match(actions, /careersPageUrlAction/);
  assert.match(ui, /will\s+not\s+be\s+opened\s+or\s+scanned/);
  for (const source of [
    "LinkedIn Jobs",
    "JobStreet Philippines",
    "Bossjob Philippines",
    "Indeed Philippines",
    "Glassdoor",
    "Kalibrr",
    "PhilJobNet",
    "OnlineJobs.ph",
  ])
    assert.match(sourceConfigurations, new RegExp(source.replace(".", "\\.")));
  assert.match(ui, /readOnly=\{manual\}/);
  assert.match(ui, /view\.configurations\.length > 0/);
  assert.match(ui, /state\.status === "success"/);
  assert.doesNotMatch(
    ui,
    /<button[^>]*>\s*(?:Refresh|Test connection|Retrieve)/i,
  );
  assert.doesNotMatch(ui, /fetch\s*\(|setInterval|setTimeout/i);
  assert.match(actions, /createManualCareersPageSource/);
  assert.doesNotMatch(actions, /fetch\s*\(|setInterval|setTimeout|open\s*\(/i);
});
