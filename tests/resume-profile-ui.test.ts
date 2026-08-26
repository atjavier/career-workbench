import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path: string) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Resume Edit is a compact profile and unavailable Coach workspace before generation", async () => {
  const [workspace, form, coach, styles] = await Promise.all([
    read("src/app/resume-workspace.tsx"),
    read("src/app/resume-profile-form.tsx"),
    read("src/app/resume-coach.tsx"),
    read("src/app/globals.css"),
  ]);

  for (const label of ["First name", "Middle name (optional)", "Last name", "Email", "Phone number", "School", "Degree or program", "Expected or graduation year", "GWA (optional)", "Latin honors (optional)", "LinkedIn URL (optional)", "GitHub URL (optional)", "Save details"]) assert.ok(form.includes(label));
  assert.match(form, /Save details to generate/);
  assert.match(form, /Details saved/);
  assert.doesNotMatch(form, /School, degree\/program, and expected or graduation year\./);
  assert.match(form, /role="alert"/);
  assert.match(form, /aria-invalid/);
  assert.match(form, /aria-describedby/);
  assert.match(form, /expectedStateRevisionNumber/);
  for (const category of ["Personal", "Contact", "Education"]) assert.match(form, new RegExp(`category: "${category}"`));
  assert.match(form, /resume-profile-group/);

  assert.match(form + workspace, /Profile details/);
  assert.match(coach, /Local AI is not ready\. You can still save your profile details\./);
  assert.match(coach, /Resume Coach/);
  assert.ok(workspace.indexOf("resume-coach-unavailable") < workspace.lastIndexOf("<ResumeProfileForm"));
  assert.match(workspace, /href="\/evidence"/);
  assert.match(workspace, /readCandidateProfileState/);
  assert.doesNotMatch(workspace, /CurrentBaseResume|BaseResumeImporter|listCurrentBaseResume|current-base-resume|Evidence and skills|Warnings|Approve Current Base Resume|textarea|iframe|api\/resume-template|Open or download Resume\.pdf/);
  assert.doesNotMatch(form + workspace + coach, /iframe|material_draft|api\/current-base-resume/i);

  assert.match(styles, /\.resume-profile-layout/);
  assert.match(styles, /grid-template-columns: minmax\(15rem, 0\.42fr\) minmax\(0, 1fr\)/);
  assert.match(styles, /\.resume-profile-fields/);
  assert.match(styles, /\.resume-profile-group/);
  assert.match(styles, /grid-template-columns: minmax\(9rem, 0\.3fr\) minmax\(0, 1fr\)/);
  assert.match(styles, /@media \(max-width: 51\.25rem\)/);
  assert.match(styles, /\.resume-profile-layout \{ grid-template-columns: 1fr; \}/);
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
