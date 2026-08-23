import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Resume & Evidence Library exposes explicit, labelled keyboard-native controls and announced recovery feedback", async () => {
  const ui = await readFile(new URL("../src/app/evidence-library.tsx", import.meta.url), "utf8");
  const actions = await readFile(new URL("../src/app/actions.ts", import.meta.url), "utf8");
  assert.match(ui, /Add Project/); assert.match(ui, /Add Experience/); assert.match(ui, /Refresh Library/);
  assert.match(ui, /<label/); assert.match(ui, /required/); assert.match(ui, /role="status"/); assert.match(ui, /aria-live="polite"/); assert.match(ui, /<button/);
  assert.match(ui, /type="file"/); assert.match(ui, /accept="\.md,text\/markdown"/);
  assert.match(actions, /addProjectToEvidenceLibrary/); assert.match(actions, /addExperienceToEvidenceLibrary/); assert.match(actions, /refreshEvidenceLibrary/);
});

test("library implementation remains local and explicit without watcher or network APIs", async () => {
  const files = await Promise.all(["../src/files/evidence-library.ts", "../src/domain/evidence/evidence-library.ts"].map((file) => readFile(new URL(file, import.meta.url), "utf8")));
  const source = files.join("\n");
  assert.doesNotMatch(source, /watch\s*\(/i); assert.doesNotMatch(source, /fetch\s*\(|https?:\/\//i); assert.match(source, /readManagedMarkdown/);
});
