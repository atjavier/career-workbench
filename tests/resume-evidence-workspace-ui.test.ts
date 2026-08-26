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
  assert.match(evidence, /ApplicationShell active="Resume"/);
  assert.match(resume, /dynamic = "force-dynamic"/);
  assert.match(evidence, /dynamic = "force-dynamic"/);
  assert.doesNotMatch(placeholder, /resume:|evidence:/);
  assert.match(placeholder, /destination\.href === "\/settings"/);
});

test("Resume presents Profile-led Edit and Experience & Projects retains human evidence review states", async () => {
  const [resume, coach, evidence, collection] = await Promise.all([
    readFile(new URL("../src/app/resume-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/resume-coach.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/evidence-library-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/evidence-library.tsx", import.meta.url), "utf8"),
  ]);
  for (const text of ["Shape your resume", "Experience &amp; Projects", "Resume Coach", "Local AI is not ready"]) assert.match(resume + coach, new RegExp(text));
  assert.doesNotMatch(resume, /Resume template|Resume\.pdf|api\/resume-template|iframe/);
  assert.doesNotMatch(resume, /Coming soon|Review changes before approving|Start with import|Retained resume history|CurrentBaseResume/);
  for (const text of ["Ready for review", "Approve", "Reject", "Document project folder", "Document folder"]) assert.match(evidence + collection, new RegExp(text));
  assert.match(evidence, /EvidenceLibrary/); assert.doesNotMatch(evidence, /EvidenceReview/);
});

test("resume and evidence routes stay explicit, local-first, and safe", async () => {
  const source = (await Promise.all(["../src/app/resume-workspace.tsx", "../src/app/evidence-library-workspace.tsx"].map((file) => readFile(new URL(file, import.meta.url), "utf8")))).join("\n");
  assert.doesNotMatch(source, /fetch\s*\(|setInterval|setTimeout|oauth|Material Version|automatic scan|watch\s*\(/i);
  assert.match(source, /safeNextAction/);
});

test("Resume uses a pre-generation Profile-led workspace while legacy editor UI remains outside the active page", async () => {
  const [resume, form, coach, current, styles] = await Promise.all([
    readFile(new URL("../src/app/resume-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/resume-profile-form.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/resume-coach.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/current-base-resume.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/globals.css", import.meta.url), "utf8"),
  ]);
  for (const text of ["Profile details", "Save details", "Resume Coach", "Local AI is not ready"]) assert.match(resume + form + coach, new RegExp(text));
  assert.doesNotMatch(resume, /CurrentBaseResume|BaseResumeImporter|Warnings|Evidence and skills|Approve Current Base Resume|textarea|iframe|Resume\.pdf|api\/resume-template/);
  assert.match(current, /revisionNumber/);
  assert.match(current, /Save the displayed edits before approving this revision/);
  assert.match(current, /Review this evidence/); assert.match(current, /sourceDocument/); assert.match(current, /sourceSection/);
  assert.match(current, /evidence-\$\{support\.id\}/); assert.match(styles, /scroll-margin-top/);
  assert.match(current, /aria-label="Resume preview"/);
  assert.match(current, /The original PDF preview remains unchanged/);
  assert.match(current, /Original, read-only Resume PDF/);
  assert.match(current, /Resume Coach is not available/);
  assert.doesNotMatch(current, /fetch\s*\(|setInterval|setTimeout|telemetry|oauth/i);
  assert.match(styles, /\.resume-profile-layout/);
  assert.match(styles, /grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(styles, /@media \(max-width: 51\.25rem\)/);
  assert.match(styles, /\.resume-profile-fields/);
});
