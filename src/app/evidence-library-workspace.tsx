import Link from "next/link";

import { EvidenceLibrary } from "@/app/evidence-library";
import { ResumeWorkspacePicker } from "@/app/resume-workspace-picker";
import { listExperienceProjectCollection } from "@/domain/evidence/evidence-library";
import { readResumeWorkspaceState } from "@/domain/resume-generation/resume-workspace-commands";

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
  const [collection, workspaceState] = await Promise.all([
    listExperienceProjectCollection()
      .then((items) => ({ items, error: undefined }))
      .catch((error) => ({ items: [], error: safeError(error) })),
    readResumeWorkspaceState().catch(() => ({
      workspaces: [],
      activeWorkspace: undefined,
      revisionNumber: 0,
    })),
  ]);
  return (
    <div className="workspace-shell resume-workspace experience-projects-workspace">
      <header className="resume-page-head">
        <div className="resume-head-copy">
          <h1>Experience &amp; Projects</h1>
          <p>
            Keep source folders separate from the reviewable evidence behind
            your resume.
          </p>
        </div>
        <div className="resume-view-tabs sr-only" aria-hidden="true" />
        <ResumeWorkspacePicker
          workspaces={workspaceState.workspaces}
          activeWorkspaceId={workspaceState.activeWorkspace?.id}
          revisionNumber={workspaceState.revisionNumber}
        />
      </header>
      <section id="experience-projects" aria-label="Experience and Projects">
        <EvidenceLibrary
          collection={collection.items}
          error={collection.error}
        />
      </section>
    </div>
  );
}
