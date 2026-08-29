import { ApplicationShell } from "@/app/application-shell";
import { redirect } from "next/navigation";
import { ResumeWorkspacePicker } from "@/app/resume-workspace-picker";
import { readResumeWorkspaceState } from "@/domain/resume-generation/resume-workspace-commands";
import { readLatestResumeEvidenceIntake } from "@/domain/resume-generation/resume-evidence-intake";
import { readResumeClarificationInterview } from "@/domain/resume-generation/resume-clarification-interview";
import { ResumeInterview } from "@/app/resume-interview";

export const dynamic = "force-dynamic";

export default async function ResumeInterviewPage() {
  const state = await readResumeWorkspaceState().catch(() => ({ workspaces: [], activeWorkspace: undefined, revisionNumber: 0 }));
  const intake = state.activeWorkspace ? await readLatestResumeEvidenceIntake(state.activeWorkspace.id).catch(() => undefined) : undefined;
  const interview = state.activeWorkspace ? await readResumeClarificationInterview(state.activeWorkspace.id).catch(() => undefined) : undefined;
  const hasReviewConflict = Boolean(interview?.completed.some((task) => task.needsReview));
  const shouldShowInterview = Boolean(state.activeWorkspace && interview && (state.activeWorkspace.journey?.phase === "interview" || hasReviewConflict));
  if (state.activeWorkspace?.journey && !["documenting", "interview", "recovery"].includes(state.activeWorkspace.journey.phase) && !hasReviewConflict) redirect("/resume");
  const message = state.activeWorkspace?.journey?.message ?? intake?.message ?? "Your saved evidence will be prepared before Coach Resume begins its interview.";
  return <ApplicationShell active="Resume"><main className="workspace-shell resume-workspace"><header className="resume-page-head"><div><p className="eyebrow">Resume Coach</p><h1>Prepare your resume evidence</h1><p>Answer only what your documented work could not establish.</p></div></header><ResumeWorkspacePicker workspaces={state.workspaces} activeWorkspaceId={state.activeWorkspace?.id} revisionNumber={state.revisionNumber} />{shouldShowInterview && state.activeWorkspace && interview ? <ResumeInterview workspaceId={state.activeWorkspace.id} interview={interview}/> : <section className="panel"><p role="status" aria-live="polite">{message}</p>{intake?.status === "failed" ? <p>Your saved work is recoverable. Return to this resume when you can restart evidence intake.</p> : null}</section>}</main></ApplicationShell>;
}
