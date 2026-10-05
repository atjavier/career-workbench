import { ApplicationShell } from "@/components/common/application-shell";
import {
  ExperienceProjectsDetailsWorkspace,
  EvidenceDetailsWorkspace,
} from "@/components/evidence/experience-projects-details-workspace";
import { listExperienceProjectCollection } from "@/application/evidence/evidence-library";
import { readResumeWorkspaceState } from "@/domain/resume-generation/resume-workspace-commands";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function EvidenceDetailsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; name?: string }>;
}) {
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

  const { category, name } = await searchParams;
  const decodedName = name ? decodeURIComponent(name) : "";
  const collection = await listExperienceProjectCollection().catch(() => []);

  const item =
    collection.find(
      (i) =>
        i.name.toLowerCase() === decodedName.toLowerCase() &&
        (!category || i.category === category),
    ) ??
    collection.find((i) => i.name.toLowerCase() === decodedName.toLowerCase());

  return (
    <ApplicationShell active="Resume" activeSubItem="Experience & Projects">
      <ExperienceProjectsDetailsWorkspace item={item} requestedName={decodedName} />
    </ApplicationShell>
  );
}
