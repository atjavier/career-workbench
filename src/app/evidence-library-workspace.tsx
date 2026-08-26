import Link from "next/link";

import { EvidenceLibrary } from "@/app/evidence-library";
import { listExperienceProjectCollection } from "@/domain/evidence/evidence-library";

const safeError = (error: unknown) => error instanceof Error && "summary" in error && "safeNextAction" in error ? { summary: String(error.summary), safeNextAction: String(error.safeNextAction) } : { summary: "Your documented collection is unavailable right now.", safeNextAction: "Check the local review documents, then refresh the page." };

export async function EvidenceLibraryWorkspace() {
  const collection = await listExperienceProjectCollection().then((items) => ({ items, error: undefined })).catch((error) => ({ items: [], error: safeError(error) }));
  return <div className="workspace-shell resume-workspace experience-projects-workspace"><header className="resume-page-head"><div><p className="eyebrow">Resume</p><h1>Experience &amp; Projects</h1><p>Keep source folders separate from the reviewable evidence behind your resume.</p></div></header><nav className="resume-view-tabs" aria-label="Resume views"><Link href="/resume">Edit</Link><a href="#experience-projects" aria-current="page">Experience &amp; Projects</a></nav><section id="experience-projects" aria-label="Experience and Projects"><EvidenceLibrary collection={collection.items} error={collection.error} /></section></div>;
}
