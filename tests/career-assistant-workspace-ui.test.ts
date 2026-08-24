import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Career Assistant has a dedicated local-first shared-shell route", async () => {
  const [page, placeholder] = await Promise.all([
    readFile(new URL("../src/app/career-assistant/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/[section]/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(page, /ApplicationShell active="Career Assistant"/);
  assert.match(page, /dynamic = "force-dynamic"/);
  assert.doesNotMatch(placeholder, /career-assistant:/);
});

test("Career Assistant discloses the bounded local project-evidence workflow before inspection", async () => {
  const ui = await readFile(new URL("../src/app/career-assistant.tsx", import.meta.url), "utf8");
  for (const text of ["Career Assistant", "Add project evidence", "selected local folder", "readable Markdown", "source folder is never changed", "unreviewed proposals", "local LM Studio model", "localModelDisclosure"]) assert.match(ui, new RegExp(text));
  assert.match(ui, /role="status"/); assert.match(ui, /aria-live="polite"/); assert.match(ui, /Cancel/);
  assert.match(ui, /selectedFolderName/); assert.match(ui, /Unverified proposal/); assert.match(ui, /Proposal list is unavailable/);
});

test("Career Assistant preserves individual proposal review and recovery truthfulness", async () => {
  const [ui, workspace, actions] = await Promise.all([
    readFile(new URL("../src/app/career-assistant.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/career-assistant-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/actions.ts", import.meta.url), "utf8"),
  ]);
  for (const text of ["Ready for your review", "Unknowns", "Accept as unreviewed evidence", "Save edited as unreviewed evidence", "Reject proposal", "No folder selected", "No usable evidence", "cancelled before inspection started", "partial available results", "Safe next action", "Evidence Review"]) assert.match(ui, new RegExp(text, "i"));
  assert.match(workspace, /listDocumenterProposals/); assert.match(workspace, /safeNextAction/);
  assert.match(actions, /revalidatePath\("\/career-assistant"\)/);
});

test("Career Assistant stays explicit and does not add unsafe client behavior", async () => {
  const source = (await Promise.all(["../src/app/career-assistant.tsx", "../src/app/career-assistant-workspace.tsx"].map((file) => readFile(new URL(file, import.meta.url), "utf8")))).join("\n");
  assert.doesNotMatch(source, /fetch\s*\(|setInterval|setTimeout|watch\s*\(|oauth|showDirectoryPicker/i);
  assert.doesNotMatch(source, /LM_STUDIO_API_TOKEN|absolutePath|prompt|raw response|audit payload/i);
});
