import { readActionSources } from "./helpers/source-modules";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Experience & Projects exposes category-specific source-folder handoff and safe generated-document import", async () => {
  const [evidenceUi, tabsUi, workspace, actions, page] = await Promise.all(
    [
      "../src/components/evidence/experience-projects.tsx",
      "../src/components/common/segmented-tabs.tsx",
      "../src/components/evidence/experience-projects-workspace.tsx",
      "../src/app/actions.ts",
      "../src/app/evidence/page.tsx",
    ].map((file) => file === "../src/app/actions.ts" ? readActionSources() : readFile(new URL(file, import.meta.url), "utf8")),
  );
  const ui = evidenceUi + "\n" + tabsUi;
  for (const text of [
    "Projects",
    "Experiences",
    'role="tablist"',
    "aria-selected",
    "Document project folder",
    "Document experience folder",
    "project-overview.md",
    "resume-evidence.md",
    "resume-bullet-candidates.md",
    "localModelDisclosure",
    "document-source-folder",
    'role="status"',
    'aria-live="polite"',
    "aria-expanded",
    "aria-controls",
    "Ready to use",
    "delete-documented-item",
    "Confirm permanent deletion",
    'evidenceCommand"[\\s\\S]*?value="remove',
  ])
    assert.match(ui, new RegExp(text));
  assert.match(workspace, /resume-page-head/);
  assert.match(workspace, /resume-view-tabs/);
  assert.match(workspace, /Experience &amp; Projects/);
  assert.match(page, /ApplicationShell active="Resume"/);
  assert.match(actions, /documentResumeEvidenceFolder/);
  assert.match(actions, /document-source-folder/);
  for (const text of [
    "Browse",
    "local-folder-input",
    "chooseLocalEvidenceFolderAction",
    "sourceDirectory",
    "It is not uploaded",
    "bounded local inspection",
  ])
    assert.match(ui, new RegExp(text.replace(/\s+/g, "\\s+")));
  assert.doesNotMatch(
    ui + workspace,
    /type="file"|webkitdirectory|sourceManifest|sourceFile|Base Resume|Resume\.pdf|Add Experience|Add Project|Absolute local|accept="\.md|local LM Studio|Document for Resume proposals|Markdown copies|Codex prompt|copyable/i,
  );
});

test("collection implementation stays local, artifact-only, and avoids network, watcher, raw-source, and private display data", async () => {
  const source = (
    await Promise.all(
      [
        "../src/files/evidence-library.ts",
        "../src/application/evidence/evidence-library.ts",
        "../src/components/evidence/experience-projects.tsx",
      ].map((file) => file === "../src/app/actions.ts" ? readActionSources() : readFile(new URL(file, import.meta.url), "utf8")),
    )
  ).join("\n");
  assert.match(source, /copyDocumentedEvidenceArtifacts/);
  assert.match(source, /requiredDocumentationArtifacts/);
  assert.match(source, /documentedCandidates/);
  assert.match(source, /summaryFromProjectOverview/);
  assert.doesNotMatch(source, /watch\s*\(|fetch\s*\(|https?:\/\//i);
  assert.doesNotMatch(
    await readFile(
      new URL("../src/components/evidence/experience-projects.tsx", import.meta.url),
      "utf8",
    ),
    /sourceSection|sourceDocument|contentDigest|absolutePath|diagnostic/i,
  );
});

test("EvidenceLibrary cleans up deleting state on success, submission, tab change, and collection disappearance", async () => {
  const content = await readFile(
    new URL("../src/components/evidence/experience-projects.tsx", import.meta.url),
    "utf8",
  );
  assert.match(
    content,
    /deleting &&\s*!collection\.some\(\(item\)\s*=>\s*`\$\{item\.category\}-\$\{item\.name\}`\s*===\s*deleting\)/,
  );
  assert.match(content, /if \(state\.status === "success"\) \{[\s\S]*?setDeleting\(undefined\)/);
  assert.match(content, /submitDocumentation =[\s\S]*?setDeleting\(undefined\)/);
});
