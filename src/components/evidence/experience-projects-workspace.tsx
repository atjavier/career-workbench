import { WorkspaceContainer } from "@/components/common/layout-containers";
import Link from "next/link";

import { EvidenceLibrary } from "@/components/evidence/experience-projects";
import { PageHeader } from "@/components/common/page-header";
import { listExperienceProjectCollection } from "@/application/evidence/evidence-library";
import { readResumeWorkspaceState } from "@/domain/resume-generation/resume-workspace-commands";
import { ClarificationPlanningRetry } from "@/components/coach/clarification-planning-retry";

const safeError = (error: unknown) =>
  error instanceof Error && "summary" in error && "safeNextAction" in error
    ? {
        summary: String(error.summary),
        safeNextAction: String(error.safeNextAction),
      }
    : {
        summary: "Your documented collection is unavailable right now.",
        safeNextAction:
          "Check the local review documents, then refresh the page.",
      };

export async function EvidenceLibraryWorkspace() {
  const collection = await listExperienceProjectCollection()
    .then((items) => ({ items, error: undefined }))
    .catch((error) => ({ items: [], error: safeError(error) }));
  const workspace = await readResumeWorkspaceState().catch(() => undefined);
  return (
    <WorkspaceContainer className="resume-workspace experience-projects-workspace">
      <PageHeader
        className="resume-page-head"
        title="Experience &amp; Projects"
        subtitle="Keep source folders separate from the reviewable evidence behind your resume."
      />
      <div className="resume-view-tabs sr-only" aria-hidden="true" />
      {collection.items.length > 0 && workspace?.activeWorkspace ? <ClarificationPlanningRetry workspaceId={workspace.activeWorkspace.id} /> : null}
      <section id="experience-projects" aria-label="Experience and Projects">
        <EvidenceLibrary
          collection={collection.items}
          error={collection.error}
        />
      </section>
    </WorkspaceContainer>
  );
}

export const ExperienceProjectsWorkspace = EvidenceLibraryWorkspace;
