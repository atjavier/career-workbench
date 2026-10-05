"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import type { OpportunityDetails as Opportunity } from "@/domain/opportunities/captured-opportunities";
import { Button } from "@/components/common/button";
import { ContentCard } from "@/components/common/layout-containers";
import { PageHeader } from "@/components/common/page-header";
import { OpportunityFacts } from "./opportunity-fields";
import { OpportunityEditor } from "./opportunity-editor";
import { OpportunityDeleteDialog } from "./opportunity-delete-dialog";

export function OpportunityDetails({ opportunity, children }: { opportunity: Opportunity; children?: React.ReactNode }) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const editButton = useRef<HTMLButtonElement>(null);
  const deleteButton = useRef<HTMLButtonElement>(null);
  return <section className="opportunity-details-workspace">
    <Link href="/" className="opportunity-back-link">← All Opportunities</Link>
    <PageHeader title={opportunity.title} subtitle={opportunity.company} actions={<>
      <Button ref={editButton} variant="secondary" onClick={() => setEditing(true)} disabled={editing}>Edit opportunity</Button>
      <Button ref={deleteButton} variant="danger" onClick={() => setDeleting(true)} disabled={editing}>Delete</Button>
    </>} />
    {opportunity.tailoredResumeStale ? <p role="status" className="opportunity-regeneration-notice">Job details changed. Regenerate your resume to reflect the latest requirements.</p> : null}
    {editing ? <OpportunityEditor opportunity={opportunity} onClose={() => { setEditing(false); requestAnimationFrame(() => editButton.current?.focus()); }} /> : <>
      <ContentCard as="section"><OpportunityFacts opportunity={opportunity} /></ContentCard>
      <ContentCard as="section" aria-labelledby="opportunity-description"><h2 id="opportunity-description">Job description</h2><p className="opportunity-description-text">{opportunity.refinedDescription ?? opportunity.copiedDescription}</p>
        {opportunity.refinedDescription && <details><summary>Original pasted description</summary><p className="opportunity-description-text">{opportunity.copiedDescription}</p></details>}
        <a href={opportunity.originalUrl} target="_blank" rel="noreferrer" className="job-source-link">Open original posting ↗</a>
      </ContentCard>
      {children}
    </>}
    <OpportunityDeleteDialog key={deleting ? "open" : "closed"} opportunity={opportunity} open={deleting} onClose={() => { setDeleting(false); requestAnimationFrame(() => deleteButton.current?.focus()); }} />
  </section>;
}
