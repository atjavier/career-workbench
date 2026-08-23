import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("local startup script binds Next.js to loopback only", async () => {
  const script = await readFile(new URL("../scripts/run-local.mjs", import.meta.url), "utf8");

  assert.match(script, /127\.0\.0\.1/);
  assert.doesNotMatch(script, /0\.0\.0\.0/);
  assert.match(script, /--hostname/);
  assert.match(script, /NEXT_TELEMETRY_DISABLED/);
  assert.match(script, /127\.0\.0\.1/);
});
