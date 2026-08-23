import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Base Resume server action enforces upload limits before materializing bytes and refreshes the profile", async () => {
  const action = await readFile(new URL("../src/app/actions.ts", import.meta.url), "utf8");
  const config = await readFile(new URL("../next.config.ts", import.meta.url), "utf8");
  assert.match(config, /bodySizeLimit: "16mb"/);
  assert.match(action, /file\.size === 0 \|\| file\.size > maximumBaseResumeFileSize/);
  assert.match(action, /revalidatePath\("\/"\)/);
});
