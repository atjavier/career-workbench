import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Data & Storage exposes local-only consequences and semantic confirmations", async () => { const ui = await readFile(new URL("../src/app/data-storage.tsx", import.meta.url), "utf8"); assert.match(ui, /workspace database snapshot/); assert.match(ui, /not portable, cloud-synced, or application-encrypted/); assert.match(ui, /Local trash/); assert.match(ui, /type="checkbox"/); assert.match(ui, /aria-live/); assert.match(ui, /onKeyDown/); assert.match(ui, /Cancel/); assert.match(ui, /Create local workspace database backup/); assert.match(ui, /Create activity-history export/); });
