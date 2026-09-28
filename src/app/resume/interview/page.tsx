import { ApplicationShell } from "@/app/application-shell";
import { redirect } from "next/navigation";
import { PageHeader } from "@/app/page-header";
import { ResumeWorkspacePicker } from "@/app/resume-workspace-picker";
import { readResumeWorkspaceState } from "@/domain/resume-generation/resume-workspace-commands";
import { readLatestResumeEvidenceIntake } from "@/domain/resume-generation/resume-evidence-intake";
import { readResumeClarificationInterview } from "@/domain/resume-generation/resume-clarification-interview";
import { ResumeInterview } from "@/app/resume-interview";
import { ResumeIntakeStatus } from "@/app/resume-intake-status";

export const dynamic = "force-dynamic";

export default async function ResumeInterviewPage() {
  const state = await readResumeWorkspaceState().catch(() => ({
    workspaces: [],
    activeWorkspace: undefined,
    revisionNumber: 0,
  }));
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
    <ApplicationShell active="Coach Q&A">
      <div className="workspace-shell resume-workspace resume-interview-workspace">
        <PageHeader
          className="resume-page-head"
          title="Prepare your resume evidence"
          subtitle="Your local AI coach analyzes your documented work and identifies a few targeted clarification questions. Answer the questions below to establish your verified achievements and metrics before generating your base resume."
          actions={
            <ResumeWorkspacePicker
              workspaces={state.workspaces}
              activeWorkspaceId={state.activeWorkspace?.id}
              revisionNumber={state.revisionNumber}
            />
          }
        />
        {shouldShowInterview && state.activeWorkspace && interview ? (
          <ResumeInterview
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
      </div>
    </ApplicationShell>
  );
}
