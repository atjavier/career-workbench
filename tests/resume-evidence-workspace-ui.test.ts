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

test("Resume presents Coach and preview panes while Experience & Projects makes documented findings available", async () => {
  const [resume, coach, evidence, collection] = await Promise.all([
    readFile(new URL("../src/app/resume-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/resume-coach.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/evidence-library-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/evidence-library.tsx", import.meta.url), "utf8"),
  ]);
  for (const text of ["Shape your base resume", "Experience &amp; Projects", "Resume Coach", "Reviewable preview", ">Resume<"]) assert.match(resume + coach, new RegExp(text));
  assert.doesNotMatch(coach, /Draft focus|Create a fresh resume draft|opportunityRevisionId|Optional local opportunity/);
  assert.doesNotMatch(resume, /Resume template|Resume\.pdf|api\/resume-template|iframe/);
  assert.doesNotMatch(resume, /Coming soon|Review changes before approving|Start with import|Retained resume history|CurrentBaseResume/);
  for (const text of ["Ready to use", "Document project folder", "Document folder", "used automatically when Resume Coach creates a draft", "no separate material-selection step"]) assert.match(evidence + collection, new RegExp(text));
  assert.doesNotMatch(collection, /name="evidenceCommand" value="approve"|name="evidenceCommand" value="reject"/);
  assert.match(evidence, /EvidenceLibrary/); assert.doesNotMatch(evidence, /EvidenceReview/);
});

test("the registered workflow separates folder documentation from base-resume generation", async () => {
  const [registry, source, coach, actions, gateway] = await Promise.all([
    readFile(new URL("../src/domain/resume-agent/skill-registry.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/files/evidence-library.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/resume-coach.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/actions.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/adapters/local-model/local-model-gateway.ts", import.meta.url), "utf8"),
  ]);
  for (const text of ["for a project: classify repository shape", "for an experience: identify documented role", "routes, services, models, client flow, workflows, and tests", "documentationSnapshotPriority", "starter-template", "boilerplate material"]) assert.match(registry + source + gateway, new RegExp(text));
  assert.match(coach, /every documented Experience/);
  assert.match(registry, /resume\.generate-base-resume/);
  assert.match(registry, /resume\.coach-resume/);
  assert.match(coach, /does not rebuild the resume on every visit/);
  assert.doesNotMatch(coach, /startTransition\(\(\) => generationAction/);
  assert.doesNotMatch(coach, /name="evidenceId"|name="consent"/);
  assert.match(actions, /const selectedIds = evidence\.map/);
  assert.match(actions, /Resume generation is starting in the background/);
  assert.match(actions, /expectedWorkspaceId: expectedWorkspaceId!?/);
  assert.match(actions, /readResumeWorkspaceState\(\)/);
});

test("resume and evidence routes stay explicit, local-first, and safe", async () => {
  const source = (await Promise.all(["../src/app/resume-workspace.tsx", "../src/app/evidence-library-workspace.tsx"].map((file) => readFile(new URL(file, import.meta.url), "utf8")))).join("\n");
  assert.doesNotMatch(source, /fetch\s*\(|setInterval|setTimeout|oauth|Material Version|automatic scan|watch\s*\(/i);
  assert.match(source, /safeNextAction/);
});

test("Resume uses its initial onboarding only once, then keeps Coach and preview in the active page", async () => {
  const [resume, form, coach, current, styles] = await Promise.all([
    readFile(new URL("../src/app/resume-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/resume-profile-form.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/resume-coach.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/current-base-resume.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/globals.css", import.meta.url), "utf8"),
  ]);
  for (const text of ["Profile details", "Save details", "Resume Coach", "Reviewable preview", "generated automatically during onboarding"]) assert.match(resume + form + coach, new RegExp(text));
  assert.doesNotMatch(resume, /ResumeProfileForm|resume-profile-layout/);
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
