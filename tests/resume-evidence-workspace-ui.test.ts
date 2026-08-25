import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Resume and Evidence have dedicated shared-shell routes rather than generic placeholders", async () => {
  const [resume, evidence, placeholder] = await Promise.all([
    readFile(new URL("../src/app/resume/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/evidence/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/[section]/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(resume, /ApplicationShell active="Resume"/);
  assert.match(evidence, /ApplicationShell active="Evidence Library"/);
  assert.match(resume, /dynamic = "force-dynamic"/);
  assert.match(evidence, /dynamic = "force-dynamic"/);
  assert.doesNotMatch(placeholder, /resume:|evidence:/);
  assert.match(placeholder, /destination\.href === "\/settings"/);
});

test("workspaces present resume editing as a focused local review flow and retain human evidence review states", async () => {
  const [resume, evidence] = await Promise.all([
    readFile(new URL("../src/app/resume-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/evidence-library-workspace.tsx", import.meta.url), "utf8"),
  ]);
  for (const text of ["Shape your resume", "Experience &amp; Projects", "Coming soon", "Review changes before approving", "Start with import", "Retained resume history"]) assert.match(resume, new RegExp(text));
  for (const text of ["Ready for review", "Approved", "Not using", "Removed", "Only approved evidence"]) assert.match(evidence, new RegExp(text));
  assert.match(evidence, /EvidenceLibrary/); assert.match(evidence, /EvidenceReview/);
});

test("resume and evidence routes stay explicit, local-first, and safe", async () => {
  const source = (await Promise.all(["../src/app/resume-workspace.tsx", "../src/app/evidence-library-workspace.tsx"].map((file) => readFile(new URL(file, import.meta.url), "utf8")))).join("\n");
  assert.doesNotMatch(source, /fetch\s*\(|setInterval|setTimeout|oauth|Material Version|automatic scan|watch\s*\(/i);
  assert.match(source, /safeNextAction/);
});

test("Resume uses an approved split, review-safe local editor and preview pattern", async () => {
  const [resume, stepper, current, styles] = await Promise.all([
    readFile(new URL("../src/app/resume-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/resume-stepper.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/current-base-resume.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/globals.css", import.meta.url), "utf8"),
  ]);
  for (const text of ["Guided resume steps", "Evidence and skills", "Manual resume review", "Coach not available", "Preview", "Warnings", "Provenance", "safe text-only review"]) assert.match(resume + stepper + current, new RegExp(text));
  assert.match(stepper, /aria-current/); assert.match(stepper, /href={`#\$\{id\}`}/);
  assert.match(current, /revisionNumber/);
  assert.match(current, /Save the displayed edits before approving this revision/);
  assert.match(current, /Review this evidence/); assert.match(current, /sourceDocument/); assert.match(current, /sourceSection/);
  assert.match(current, /evidence-\$\{support\.id\}/); assert.match(styles, /scroll-margin-top/);
  assert.match(current, /aria-label="Resume preview"/);
  assert.match(current, /No scripts, remote assets, or cloud processing are used/);
  assert.match(current, /Resume Coach is not available/);
  assert.doesNotMatch(current, /fetch\s*\(|setInterval|setTimeout|telemetry|oauth/i);
  assert.match(styles, /\.resume-editor-preview/);
  assert.match(styles, /grid-template-columns: minmax\(330px, 0\.85fr\) minmax\(390px, 1\.15fr\)/);
  assert.match(styles, /@media \(max-width: 51\.25rem\)/);
  assert.match(styles, /#resume-edit, #resume-editor/);
  assert.match(styles, /\.resume-stepper/);
});
