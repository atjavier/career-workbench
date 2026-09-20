import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Search Preferences remains an accessible historical local-only control outside the active Jobs experience", async () => {
  const [ui, page, actions] = await Promise.all([
    readFile(
      new URL("../src/app/job-preferences.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../src/app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/actions.ts", import.meta.url), "utf8"),
  ]);
  for (const label of [
    "Fresh graduate",
    "Junior",
    "Associate",
    "Cadetship",
    "Paid training",
    "Country",
    "Work-style priority",
    "Prioritize NCR for Hybrid and Onsite",
  ])
    assert.match(ui, new RegExp(label));
  assert.match(ui, /useActionState/);
  assert.match(ui, /<label/);
  assert.match(ui, /aria-invalid/);
  assert.match(ui, /aria-describedby/);
  assert.match(ui, /role="status"/);
  assert.match(ui, /aria-live="polite"/);
  assert.match(ui, /disabled=\{pending\}/);
  assert.match(ui, /Safe next action:/);
  assert.doesNotMatch(page, /Search Preferences/);
  assert.match(actions, /jobPreferencesAction/);
  assert.doesNotMatch(ui, /<button[^>]*>\s*(?:Refresh now|Enable source)/i);
  assert.doesNotMatch(ui, /fetch\s*\(|setInterval|setTimeout/i);
});
