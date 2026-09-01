import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Google Sheets has a dedicated shared-shell route and leaves Settings generic", async () => {
  const [page, placeholder] = await Promise.all([
    readFile(
      new URL("../src/app/google-sheets/page.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../src/app/[section]/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(page, /ApplicationShell active="Google Sheets"/);
  assert.match(page, /dynamic = "force-dynamic"/);
  assert.doesNotMatch(placeholder, /"google-sheets"\s*:/);
  assert.match(placeholder, /settings\s*:/);
});

test("Google Sheets shows the truthful optional local-first disconnected state", async () => {
  const workspace = await readFile(
    new URL("../src/app/google-sheets-workspace.tsx", import.meta.url),
    "utf8",
  );
  for (const text of [
    "Google Sheets",
    "Not connected",
    "Not selected",
    "No Google permission granted",
    "No sync has run",
    "optional",
    "Applications workspace",
    "/applications",
  ]) {
    assert.match(workspace, new RegExp(text, "i"));
  }
  assert.match(workspace, /<h1>/);
  assert.match(workspace, /<dl/);
  assert.match(workspace, /Applications workspace/i);
  assert.doesNotMatch(
    workspace,
    /continue updating applications, follow-ups, and interviews locally/i,
  );
});

test("Google Sheets previews future consent and recovery without fabricating a live integration", async () => {
  const workspace = await readFile(
    new URL("../src/app/google-sheets-workspace.tsx", import.meta.url),
    "utf8",
  );
  for (const text of [
    "What you will review before connecting",
    "not available yet",
    "Google account",
    "Sheets-only",
    "spreadsheet",
    "worksheet",
    "edit access",
    "Applications",
    "Material versions",
    "Follow-ups",
    "Interview rounds",
    "local-only",
    "affected record",
    "preserve",
    "reconnect",
    "reconciliation",
  ]) {
    assert.match(workspace, new RegExp(text, "i"));
  }
  assert.doesNotMatch(
    workspace,
    /Connect to Google|Sync now|Revoke connection|Retry sync|Reconcile now/i,
  );
});

test("Google Sheets workspace stays presentation-only and uses responsive accessible contracts", async () => {
  const [workspace, styles] = await Promise.all([
    readFile(
      new URL("../src/app/google-sheets-workspace.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../src/app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(
    workspace,
    /fetch\s*\(|googleapis|oauth|token|credential|setInterval|setTimeout|poll|automatic retry|sync succeeded/i,
  );
  assert.match(styles, /google-sheets-workspace/);
  assert.match(styles, /sheets-connection-summary/);
  assert.match(styles, /sheets-review-fields/);
  assert.match(styles, /@media \(max-width: 40rem\)/);
  assert.match(styles, /--accent: #0058be/i);
  assert.match(styles, /--focus-ring: #005ac2/i);
});
