import Link from "next/link";

import { EvidenceLibrary } from "@/components/evidence/experience-projects";
import { PageHeader } from "@/components/common/page-header";
import { listExperienceProjectCollection } from "@/domain/evidence/evidence-library";

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
  return (
    <div className="workspace-shell resume-workspace experience-projects-workspace">
      <PageHeader
        className="resume-page-head"
        title="Experience &amp; Projects"
        subtitle="Keep source folders separate from the reviewable evidence behind your resume."
      />
      <div className="resume-view-tabs sr-only" aria-hidden="true" />
      <section id="experience-projects" aria-label="Experience and Projects">
        <EvidenceLibrary
          collection={collection.items}
          error={collection.error}
        />
      </section>
    </div>
  );
}

export const ExperienceProjectsWorkspace = EvidenceLibraryWorkspace;

