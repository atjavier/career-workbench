import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("evidence review exposes textual origin/state, individual controls, errors, and status", async () => {
  const ui = await readFile(
    new URL("../src/app/evidence-review.tsx", import.meta.url),
    "utf8",
  );
  assert.match(ui, /Extracted/);
  assert.match(ui, /User-entered/);
  assert.match(ui, /Edit/);
  assert.match(ui, /Approve/);
  assert.match(ui, /Reject/);
  assert.match(ui, /Remove/);
  assert.match(ui, /aria-invalid/);
  assert.match(ui, /aria-describedby/);
  assert.match(ui, /role="status"/);
  assert.match(ui, /<label/);
});
