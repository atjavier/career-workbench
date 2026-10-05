import { readGatewaySources } from "./helpers/source-modules";
import { readActionSources } from "./helpers/source-modules";
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
    readFile(
      new URL("../src/components/resume/resume-workspace.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../src/components/resume/resume-preview.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../src/components/evidence/experience-projects-workspace.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../src/components/evidence/experience-projects.tsx", import.meta.url),
      "utf8",
    ),
  ]);
  for (const text of [
    "Shape your base resume",
    "Experience &amp; Projects",
    "Resume Coach",
    "Reviewable preview",
    ">Resume<",
  ])
    assert.match(resume + coach, new RegExp(text));
  assert.doesNotMatch(
    coach,
    /Draft focus|Create a fresh resume draft|opportunityRevisionId|Optional local opportunity/,
  );
  assert.doesNotMatch(
    resume,
    /Resume template|Resume\.pdf|api\/resume-template|iframe/,
  );
  assert.doesNotMatch(
    resume,
    /Coming soon|Review changes before approving|Start with import|Retained resume history|CurrentBaseResume/,
  );
  for (const text of [
    "Ready to use",
    "Document project folder",
    "Document folder",
    "used automatically when Resume Coach creates a draft",
    "no separate material-selection step",
  ])
    assert.match(evidence + collection, new RegExp(text));
  assert.doesNotMatch(
    collection,
    /name="evidenceCommand" value="approve"|name="evidenceCommand" value="reject"/,
  );
  assert.match(evidence, /EvidenceLibrary/);
  assert.doesNotMatch(evidence, /EvidenceReview/);
});

test("the registered workflow separates folder documentation from base-resume generation", async () => {
  const [registry, source, coach, actions, gateway] = await Promise.all([
    readFile(
      new URL("../src/domain/resume-agent/skill-registry.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../src/files/evidence-library.ts", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../src/components/resume/resume-preview.tsx", import.meta.url), "utf8"),
    readActionSources(),
    readGatewaySources(),
  ]);
  for (const text of [
    "for a project: classify repository shape",
    "for an experience: identify documented role",
    "routes, services, models, client flow, workflows, and tests",
    "documentationSnapshotPriority",
    "starter-template",
    "boilerplate material",
  ])
    assert.match(registry + source + gateway, new RegExp(text));
  assert.match(coach, /every documented Experience/);
  assert.match(registry, /resume\.generate-base-resume/);
  assert.match(registry, /resume\.coach-resume/);
  assert.match(
    coach,
    /does\s+not\s+rebuild\s+the\s+resume\s+on\s+every\s+visit/,
  );
  assert.doesNotMatch(coach, /startTransition\(\(\) => generationAction/);
  assert.doesNotMatch(coach, /name="evidenceId"|name="consent"/);
  assert.match(actions, /const selectedIds = evidence\.map/);
  assert.match(
    actions,
    /Evidence interpretation is starting in the background/,
  );
  assert.match(actions, /expectedWorkspaceId: expectedWorkspaceId!?/);
  assert.match(actions, /beginResumeEvidenceIntake/);
});

test("resume and evidence routes stay explicit, local-first, and safe", async () => {
  const source = (
    await Promise.all(
      [
        "../src/components/resume/resume-workspace.tsx",
        "../src/components/evidence/experience-projects-workspace.tsx",
      ].map((file) => readFile(new URL(file, import.meta.url), "utf8")),
    )
  ).join("\n");
  assert.doesNotMatch(
    source,
    /fetch\s*\(|setInterval|setTimeout|oauth|Material Version|automatic scan|watch\s*\(/i,
  );
  assert.match(source, /safeNextAction/);
});

test("existing generated resumes retain their Coach and preview workspace", async () => {
  const [resume, form, coach, styles] = await Promise.all([
    readFile(
      new URL("../src/components/resume/resume-workspace.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../src/components/resume/resume-profile-form.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../src/components/resume/resume-preview.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/globals.css", import.meta.url), "utf8"),
  ]);
  for (const text of [
    "Your Details",
    "Save details",
    "Resume Coach",
    "Reviewable preview",
  ])
    assert.match(resume + form + coach, new RegExp(text));
  assert.doesNotMatch(resume, /ResumeProfileForm|resume-profile-layout/);
  assert.match(resume, /BaseResumeImporter/);
  assert.match(resume, /readInitialResumeTemplateContract/);
  assert.doesNotMatch(
    resume,
    /CurrentBaseResume|Warnings|Evidence and skills|Approve Current Base Resume|textarea|iframe|Resume\.pdf|api\/resume-template/,
  );
  assert.match(styles, /scroll-margin-top/);
  assert.match(styles, /\.resume-profile-layout/);
  assert.match(styles, /grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(styles, /@media \(max-width: 51\.25rem\)/);
  assert.match(styles, /\.resume-profile-fields/);
});

test("generated resumes offer an accessible evidence-based regeneration control without a revision request input", async () => {
  const [coach, actions] = await Promise.all([
    readFile(new URL("../src/components/resume/resume-preview.tsx", import.meta.url), "utf8"),
    readActionSources(),
  ]);

  assert.match(
    coach,
    /<form[\s\S]*?action=\{revisionAction\}[\s\S]*?name="generationCommand"[\s\S]*?value=\{activeDraftId \? "revision" : "initial"\}[\s\S]*?<button[^>]*type="submit"[^>]*>[\s\S]*?\{revisionPending[\s\S]*?\?[\s\S]*?"Generating resume…"[\s\S]*?:[\s\S]*?"Generate resume"\}[\s\S]*?<\/button>/,
  );
  assert.doesNotMatch(
    coach,
    /Apply a small supported change|id="resume-revision"|name="resumeRequest"|Apply change/,
  );
  assert.doesNotMatch(
    actions,
    /generationCommand === "revision" && !requestedRevision/,
  );
});
