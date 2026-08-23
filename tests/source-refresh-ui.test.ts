import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Source Refresh provides accessible confirmation, no-enabled recovery, and outcome semantics", async () => {
  const [ui, page, actions] = await Promise.all([readFile(new URL("../src/app/source-refresh.tsx", import.meta.url), "utf8"), readFile(new URL("../src/app/page.tsx", import.meta.url), "utf8"), readFile(new URL("../src/app/actions.ts", import.meta.url), "utf8")]);
  for (const text of ["Source Refresh", "Select sources for one bounded refresh", "I confirm this selected source scope.", "Refresh now", "No source is enabled for app retrieval.", "Safe next action:", "Refresh outcomes"]) assert.match(ui, new RegExp(text.replace(/[.?]/g, "\\$&")));
  assert.match(ui, /useActionState/); assert.match(ui, /<label/); assert.match(ui, /role="status"/); assert.match(ui, /aria-live="polite"/); assert.match(ui, /disabled=\{pending \|\| selected\.length === 0\}/); assert.match(ui, /toLocaleString/);
  assert.match(page, /#source-refresh/); assert.match(page, /<SourceRefresh/); assert.match(actions, /sourceRefreshAction/);
  assert.doesNotMatch(ui, /automatic refresh|Retry now|Test connection|setInterval|setTimeout|fetch\s*\(/i);
});
