import { WorkspaceContainer } from "@/components/common/layout-containers";
import { ApplicationShell } from "@/components/common/application-shell";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/common/page-header";
import { readResumeWorkspaceState } from "@/domain/resume-generation/resume-workspace-commands";
import { readLatestResumeEvidenceIntake } from "@/application/resume-generation/resume-evidence-intake";
import { readResumeClarificationInterview } from "@/domain/resume-generation/resume-clarification-interview";
import { CoachQA, ResumeInterview } from "@/components/coach/coach-qa";
import { ResumeIntakeStatus } from "@/components/coach/resume-intake-status";

export const dynamic = "force-dynamic";

export default async function ResumeInterviewPage() {
  const state = await readResumeWorkspaceState().catch(() => ({
    workspaces: [],
    activeWorkspace: undefined,
    revisionNumber: 0,
  }));
  if (!state.activeWorkspace) {
    redirect("/resume");
  }
  if (state.activeWorkspace.journey?.phase === "onboarding") {
    redirect("/resume");
  }
  const intake = state.activeWorkspace
    ? await readLatestResumeEvidenceIntake(state.activeWorkspace.id).catch(
        () => undefined,
      )
    : undefined;
  const interview = state.activeWorkspace
    ? await readResumeClarificationInterview(state.activeWorkspace.id).catch(
        () => undefined,
      )
    : undefined;
  const hasReviewConflict = Boolean(
    interview?.completed.some((task) => task.needsReview),
  );
  const shouldShowInterview = Boolean(
    state.activeWorkspace &&
    interview &&
    (state.activeWorkspace.journey?.phase === "interview" ||
      state.activeWorkspace.journey?.phase === "ready_to_generate" ||
      hasReviewConflict),
  );
  if (
    state.activeWorkspace?.journey &&
    !["documenting", "interview", "ready_to_generate", "recovery"].includes(
      state.activeWorkspace.journey.phase,
    ) &&
    !hasReviewConflict
  )
    redirect("/resume");
  const message =
    state.activeWorkspace?.journey?.message ??
    intake?.message ??
    "Reading your selected local folders and documenting resume evidence.";
  return (
    <ApplicationShell active={shouldShowInterview ? "Coach Q&A" : "Resume"}>
      <WorkspaceContainer className="resume-workspace resume-interview-workspace">
        <PageHeader
          className="resume-page-head"
          title={
            shouldShowInterview
              ? "Prepare your resume evidence"
              : "Processing your work"
          }
          subtitle={
            shouldShowInterview
              ? "Your local AI coach analyzes your documented work and identifies a few targeted clarification questions. Answer the questions below to establish your verified achievements and metrics before generating your base resume."
              : "Analyzing your selected project and experience folders with bounded local inspection to extract source-backed technical facts."
          }
        />
        {shouldShowInterview && state.activeWorkspace && interview ? (
          <CoachQA
            workspaceId={state.activeWorkspace.id}
            interview={interview}
          />
        ) : (
          <ResumeIntakeStatus
            workspaceId={state.activeWorkspace?.id ?? ""}
            initialMessage={message}
            initialStatus={intake?.status}
          />
        )}
      </WorkspaceContainer>
    </ApplicationShell>
  );
}
