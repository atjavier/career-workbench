import { ApplicationShell } from "@/components/common/application-shell";
import {
  ExperienceProjectsWorkspace,
  EvidenceLibraryWorkspace,
} from "@/components/evidence/experience-projects-workspace";
import { readResumeWorkspaceState } from "@/domain/resume-generation/resume-workspace-commands";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function EvidencePage() {
  const workspaceState = await readResumeWorkspaceState().catch(() => ({
    workspaces: [],
    activeWorkspace: undefined,
    revisionNumber: 0,
  }));
  if (!workspaceState.activeWorkspace) {
    redirect("/resume");
  }
  if (workspaceState.activeWorkspace.journey?.phase === "onboarding") {
    redirect("/resume");
  }
  if (workspaceState.activeWorkspace.journey?.phase === "documenting") {
    redirect("/resume/interview");
  }
  return (
    <ApplicationShell active="Resume" activeSubItem="Experience & Projects">
      <ExperienceProjectsWorkspace />
    </ApplicationShell>
  );
}
