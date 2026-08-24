import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Applications has a dedicated shared-shell route rather than the generic placeholder", async () => {
  const [page, placeholder] = await Promise.all([
    readFile(new URL("../src/app/applications/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/[section]/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(page, /ApplicationShell active="Applications"/);
  assert.match(page, /ApplicationsWorkspace/);
  assert.doesNotMatch(placeholder, /applications:/);
  assert.match(placeholder, /destination\.href === "\/settings"/);
});

test("Applications gives an honest, accessible empty tracking state and useful handoffs", async () => {
  const workspace = await readFile(new URL("../src/app/applications.tsx", import.meta.url), "utf8");
  for (const text of ["Applications", "No applications to track yet", "Browse Jobs", "Google Sheets", "not connected", "optional"]) {
    assert.match(workspace, new RegExp(text));
  }
  assert.match(workspace, /<h1>/);
  assert.match(workspace, /<section aria-labelledby="applications-status"/);
  assert.match(workspace, /<section aria-labelledby="applications-list"/);
  assert.match(workspace, /<Link href="\/">Browse Jobs<\/Link>/);
  assert.doesNotMatch(workspace, /href="\/google-sheets"/);
  assert.match(workspace, /Ordered rounds, dates, statuses, outcomes, notes, and next actions\./);
});

test("Applications preserves local-first scope and does not manufacture tracking or sync behavior", async () => {
  const [workspace, styles] = await Promise.all([
    readFile(new URL("../src/app/applications.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(workspace, /fetch\s*\(|setInterval|setTimeout|useActionState|Server Action|oauth|authorization|sync now|application submitted/i);
  assert.match(workspace, /Local tracking will remain available without a Google Sheets connection\./);
  assert.match(styles, /\.applications-workspace/);
  assert.match(styles, /\.applications-empty-state/);
  assert.match(styles, /overflow-wrap: anywhere/);
});
