import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path: string) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Resume Edit presents a single onboarding card before a workspace exists and Coach after generation", async () => {
  const [workspace, form, coach, styles] = await Promise.all([
    read("src/app/resume-workspace.tsx"),
    read("src/app/resume-onboarding.tsx"),
    read("src/app/resume-coach.tsx"),
    read("src/app/globals.css"),
  ]);

  for (const label of ["First name", "Middle name (optional)", "Last name", "Email", "Phone", "School", "Degree or program", "Expected or graduation year", "GWA (optional)", "Latin honors (optional)", "LinkedIn URL (optional)", "GitHub URL (optional)", "Projects and Experiences", "Create resume from my work folders"]) assert.ok(form.includes(label));
  assert.match(form, /Add every Project and Experience you want to start with/);
  assert.match(form, /localModelDisclosure/);
  assert.match(form, /Add another Project or Experience/);
  assert.match(form, /startTransition/);
  assert.match(form, /local-folder-input/);

  assert.match(workspace, /Start your resume/);
  assert.match(workspace, /ResumeOnboarding/);
  assert.match(coach, /Resume Coach is unavailable right now/);
  assert.match(coach, /Resume Coach/);
  assert.match(coach, /resume-coach-preview-layout/);
  assert.match(workspace, /href="\/evidence"/);
  assert.match(workspace, /readCandidateProfileState/);
  assert.doesNotMatch(workspace, /CurrentBaseResume|BaseResumeImporter|listCurrentBaseResume|current-base-resume|Evidence and skills|Warnings|Approve Current Base Resume|iframe|api\/resume-template|Open or download Resume\.pdf/);
  assert.doesNotMatch(form + workspace + coach, /iframe|material_draft|api\/current-base-resume/i);

  assert.match(styles, /\.resume-onboarding-fields/);
  assert.match(styles, /\.onboarding-work/);
  assert.match(styles, /\.resume-coach-preview-layout/);
  assert.match(styles, /grid-template-columns: minmax\(18rem, \.82fr\) minmax\(22rem, 1\.18fr\)/);
  assert.match(styles, /@media \(max-width: 51\.25rem\)/);
  assert.match(styles, /\.resume-coach-preview-layout \{ grid-template-columns: 1fr; \}/);
});

test("Candidate Profile action remains a thin append-only server boundary", async () => {
  const action = await read("src/app/actions.ts");
  assert.match(action, /export type CandidateProfileActionState/);
  assert.match(action, /export async function saveCandidateProfileAction/);
  assert.match(action, /saveCandidateProfile\(\{/);
  assert.match(action, /profileId: String\(formData\.get\("profileId"\)/);
  assert.match(action, /expectedStateRevisionNumber/);
  assert.match(action, /revalidatePath\("\/resume"\)/);
  assert.match(action, /toSafeWorkspaceError/);
  assert.doesNotMatch(action, /saveCandidateProfileAction[\s\S]{0,1600}(?:fetch\s*\(|LocalModelGateway|bootstrapBundledResumeTemplate|currentBaseResumeAction)/);
});
