import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Local AI Settings and Resume recovery keep secrets and diagnostics out of Resume Edit", async () => {
  const settings = await readFile(
    new URL("../src/app/local-model-settings.tsx", import.meta.url),
    "utf8",
  );
  const page = await readFile(
    new URL("../src/app/settings/page.tsx", import.meta.url),
    "utf8",
  );
  const coach = await readFile(
    new URL("../src/app/resume-coach.tsx", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(settings, /type="password"|name="token"|authorization/i);
  assert.match(settings, /aria-busy/);
  assert.match(settings, /aria-live="polite"/);
  assert.match(settings, /Qwen3\.5-9B/);
  assert.match(settings, /does\s+not\s+use\s+an\s+API\s+token/);
  assert.match(page, /ApplicationShell active="Settings"/);
  assert.match(coach, /Set up local AI/);
  assert.match(coach, /local employer-side reviewer/);
  assert.doesNotMatch(
    coach,
    /token|127\.0\.0\.1|api\/v1|secret_reference|configuration_digest/i,
  );
});
