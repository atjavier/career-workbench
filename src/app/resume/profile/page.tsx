import { redirect } from "next/navigation";
import { ApplicationShell } from "@/components/common/application-shell";
import { ResumeProfileWorkspace } from "@/components/resume/resume-profile-workspace";
import { readCandidateProfileState } from "@/domain/resume-generation/candidate-profile-commands";
import { readResumeWorkspaceState } from "@/domain/resume-generation/resume-workspace-commands";

export const dynamic = "force-dynamic";

export default async function ResumeProfilePage() {
  const workspaceState = await readResumeWorkspaceState().catch(() => ({
    workspaces: [],
    activeWorkspace: undefined,
    revisionNumber: 0,
  }));

  if (!workspaceState.activeWorkspace) {
    redirect("/resume");
  }

  const profile = await readCandidateProfileState().catch(() => ({
    state: { revisionNumber: 0 },
    error: "Your saved profile details are unavailable right now.",
  }));

  const hasCompletedProfile =
    !("error" in profile) && Boolean(profile.revision);
  const isOnboarding =
    workspaceState.activeWorkspace?.journey?.phase === "onboarding" ||
    !hasCompletedProfile;

  if (isOnboarding) {
    redirect("/resume");
  }

  return (
    <ApplicationShell active="Resume" activeSubItem="Your Details">
      <ResumeProfileWorkspace
        profileId={!("error" in profile) ? profile.profile?.id : undefined}
        expectedStateRevisionNumber={
          !("error" in profile) ? profile.state.revisionNumber : 0
        }
        values={!("error" in profile) ? profile.revision?.values : undefined}
        workspaceId={workspaceState.activeWorkspace.id}
        workspaceRevisionNumber={workspaceState.revisionNumber}
      />
    </ApplicationShell>
  );
}
