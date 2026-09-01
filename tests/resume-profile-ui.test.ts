import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path: string) =>
  readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Resume onboarding prepares evidence before the Coach interview", async () => {
  const [workspace, form, coach, styles] = await Promise.all([
    read("src/app/resume-workspace.tsx"),
    read("src/app/resume-onboarding.tsx"),
    read("src/app/resume-coach.tsx"),
    read("src/app/globals.css"),
  ]);

  for (const label of [
    "First name",
    "Middle name (optional)",
    "Last name",
    "Email",
    "Phone",
    "School",
    "Degree or program",
    "Expected or graduation year",
    "GWA (optional)",
    "Latin honors (optional)",
    "LinkedIn URL (optional)",
    "GitHub URL (optional)",
    "Projects and Experiences",
    "Process local evidence & start AI interview",
  ])
    assert.ok(form.includes(label));
  assert.match(form, /Add every Project and Experience you want to start with/);
  assert.match(form, /localModelDisclosure/);
  assert.match(form, /startTransition/);
  assert.match(form, /local-folder-input/);
  assert.match(form, /\/resume\/interview/);

  assert.match(workspace, /Start your resume/);
  assert.match(workspace, /ResumeOnboarding/);
  assert.match(coach, /Resume Coach is unavailable right now/);
  assert.match(coach, /Resume Coach/);
  assert.match(coach, /resume-coach-preview-layout/);
  assert.match(workspace, /href="\/evidence"/);
  assert.match(workspace, /readCandidateProfileState/);
  assert.doesNotMatch(
    workspace,
    /CurrentBaseResume|BaseResumeImporter|listCurrentBaseResume|current-base-resume|Evidence and skills|Warnings|Approve Current Base Resume|iframe|api\/resume-template|Open or download Resume\.pdf/,
  );
  assert.doesNotMatch(
    form + workspace + coach,
    /iframe|material_draft|api\/current-base-resume/i,
  );

  assert.match(styles, /\.resume-onboarding-fields/);
  assert.match(styles, /\.resume-onboarding-progress/);
  assert.match(form, /resume-onboarding-progress/);
  assert.match(styles, /\.onboarding-work/);
  assert.match(styles, /\.resume-coach-preview-layout/);
  assert.match(
    styles,
    /grid-template-columns:\s*minmax\(18rem, 0?\.82fr\)\s*minmax\(22rem, 1\.18fr\)/,
  );
  assert.match(styles, /@media \(max-width: 51\.25rem\)/);
  assert.match(
    styles,
    /\.resume-coach-preview-layout\s*\{\s*grid-template-columns:\s*1fr;/,
  );
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
  assert.doesNotMatch(
    action,
    /saveCandidateProfileAction[\s\S]{0,1600}(?:fetch\s*\(|LocalModelGateway|bootstrapBundledResumeTemplate|currentBaseResumeAction)/,
  );
});

test("mandatory Coach Resume interview is chat-only and accessible", async () => {
  const [page, interview, action, streamRoute] = await Promise.all([
    read("src/app/resume/interview/page.tsx"),
    read("src/app/resume-interview.tsx"),
    read("src/app/actions.ts"),
    read("src/app/api/resume-interview/stream/route.ts"),
  ]);
  assert.match(page, /ResumeInterview/);
  assert.match(page, /ApplicationShell/);
  assert.doesNotMatch(
    page,
    /ResumePdfPreview|iframe|resume-coach-preview-layout/,
  );
  assert.match(page, /shouldShowInterview/);
  assert.match(page, /journey\?\.phase === "interview"/);
  for (const label of [
    "Clarify your experience",
    "Chat",
    "Goals",
    "Local Coach Resume only.",
    "coach-chat-view",
    "coach-goals-view",
    "coach-hero",
    "Local only",
    "coach-insights",
    "Optimization goals",
    "coach-insight-goals",
    "coach-input-row",
    "pendingCandidate",
    "messagesRef",
    "scrollTop = messages.scrollHeight",
    "turn.taskId === current.id",
    "onKeyDown",
    "requestSubmit",
    "form.reset",
    "aria-live",
    "aria-busy",
    "questions complete",
    "Review needed: this answer may conflict with documented evidence",
    "unfinished",
    "Try again",
    "1_500",
  ])
    assert.match(interview, new RegExp(label));
  assert.match(streamRoute, /streamResumeInterviewCoach/);
  assert.match(streamRoute, /beginResumeInterviewCoachStream/);
  assert.match(streamRoute, /finalizeResumeInterviewCoachStream/);
  assert.match(streamRoute, /text\/event-stream/);
  assert.doesNotMatch(
    streamRoute,
    /127\.0\.0\.1|system_prompt|direct model URL/,
  );
  assert.doesNotMatch(interview, /import \{ interviewCategoryLabel/);
  assert.doesNotMatch(
    interview,
    /ResumePdfPreview|iframe|generateBaseResumeAction|requestBaseResumeGeneration/,
  );
  assert.doesNotMatch(
    interview,
    /resumeInterviewCoachAction|Use non-streaming Coach/,
  );
  assert.doesNotMatch(
    interview,
    /Use this message as my final answer|I don&apos;t know|Coach Resume is responding\. You can|Stop generating/,
  );
  assert.match(action, /resumeClarificationAction/);
  assert.match(action, /respondToResumeClarification/);
  assert.match(action, /if \(deleted\) redirect\("\/resume"\)/);
  assert.match(action, /revalidatePath\("\/resume\/interview"\)/);
});

test("Stitch-led Resume Builder provides separated work collections and accessible date/folder controls", async () => {
  const [form, styles] = await Promise.all([
    read("src/app/resume-onboarding.tsx"),
    read("src/app/globals.css"),
  ]);

  // Three-stage progress roadmap
  assert.match(form, /resume-onboarding-progress/);
  assert.match(form, /stage-goals-grid/);
  assert.match(form, /Profile &amp; Evidence Intake/);
  assert.match(form, /AI Clarification Interview/);
  assert.match(form, /Resume Generation &amp; Review/);

  // Separated collections
  assert.match(form, /onboarding-projects/);
  assert.match(form, /onboarding-experiences/);
  assert.match(form, /<legend>Projects<\/legend>/);
  assert.match(form, /<legend>Experiences<\/legend>/);
  assert.match(form, /Add project/);
  assert.match(form, /Add experience/);

  // Project fields
  assert.match(form, /Project name/);
  assert.match(form, /projectStartDate/);
  assert.match(form, /projectEndDate/);

  // Experience fields & current-role toggle
  assert.match(form, /Company or organization/);
  assert.match(form, /expCompany/);
  assert.match(form, /expRole/);
  assert.match(form, /expStartDate/);
  assert.match(form, /expEndDate/);
  assert.match(form, /I currently work here/);
  assert.match(form, /Present/);
  assert.match(form, /exp-current-desc/);

  // Local folder selection tile
  assert.match(form, /FolderSelectionTile/);
  assert.match(form, /folder-selection-tile/);
  assert.match(form, /Choose local folder for/);
  assert.match(form, /Change folder/);
  assert.match(form, /selected for bounded local inspection/);
  assert.match(form, /Source files remain unchanged/);
  assert.doesNotMatch(form, /drag and drop|upload your files|cloud sync/i);

  // Serene Builder styling rules
  assert.match(styles, /\.resume-builder-layout/);
  assert.match(styles, /\.personal-education-grid/);
  assert.match(styles, /\.folder-selection-tile/);
  assert.match(styles, /\.work-date-range/);
  assert.match(styles, /\.present-badge/);
  assert.match(styles, /\.onboarding-projects/);
  assert.match(styles, /\.onboarding-experiences/);
});

