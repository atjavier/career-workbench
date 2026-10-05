"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { tailorOpportunityAction } from "@/app/opportunities/actions";
import type { readTailoringState } from "@/application/opportunities/tailored-resume";
import { Button } from "@/components/common/button";
import { ContentCard } from "@/components/common/layout-containers";
import { OpportunityField } from "./opportunity-fields";

export function OpportunityTailoredResume({ opportunityId, state }: { opportunityId: string; state: Awaited<ReturnType<typeof readTailoringState>> }) {
  const [result, action, pending] = useActionState(tailorOpportunityAction, { status: "idle", summary: "" });
  const [reviewedGeneration, setReviewedGeneration] = useState<string>();
  const resume = state.resume;
  const tokens = <><input type="hidden" name="opportunityId" value={opportunityId} /><input type="hidden" name="fingerprint" value={state.fingerprint ?? ""} /><input type="hidden" name="generationId" value={state.expectedGenerationId} /></>;
  return <ContentCard as="section" className="opportunity-tailoring">
    <h2>Tailored resume</h2>
    <p>Your base resume is used automatically. This opportunity keeps one tailored resume; regeneration replaces it after the new result succeeds.</p>
    <p>Local AI selects and orders verified experience and project bullets for this posting. Your identity, dates and factual wording stay grounded in your base resume.</p>
    {state.unavailable ? <p role="status">{state.unavailable} <Link href="/resume">Open Resume</Link> · <Link href="/settings">AI settings</Link></p> : <form action={action}>
      {tokens}
      <label><input type="checkbox" name="consent" required disabled={pending} /> Allow local AI ({state.modelLabel}) to read this posting and my base resume for this request.</label>
      <div className="opportunity-form-actions"><Button type="submit" isLoading={pending}>{pending ? "Analysing, tailoring and reviewing…" : resume ? "Regenerate resume" : "Generate tailored resume"}</Button></div>
    </form>}
    {result.summary && <p role={result.status === "error" ? "alert" : "status"}>{result.summary}</p>}
    {resume && <div key={resume.generationId}>
      {resume.stale && <p className="opportunity-regeneration-notice" role="status">The source details changed. Regeneration is recommended before using this resume.</p>}
      <form action={action}>
        {tokens}<input type="hidden" name="mode" value="edit" />
        <p>You can remove or reorder existing bullets below. Keep headings, dates and other details unchanged.</p>
        {resume.sections.map((section, i) => <OpportunityField key={i} name="sectionText" label={section.heading} value={section.text} multiline rows={Math.min(16, Math.max(3, section.text.split("\n").length))} readOnly={!/^(?:work\s+)?experience$|^projects?$|^professional experience$/i.test(section.heading.trim())} disabled={pending} />)}
        <Button type="submit" variant="secondary" disabled={pending || !!state.unavailable || resume.stale}>Save resume edits</Button>
      </form>
      {resume.unknowns.length > 0 && <><h3>Check before using</h3><ul>{resume.unknowns.map((item, i) => <li key={i}>{item}</li>)}</ul></>}
      <label><input type="checkbox" checked={reviewedGeneration === resume.generationId} onChange={event => setReviewedGeneration(event.target.checked ? resume.generationId : undefined)} /> I reviewed this resume for accuracy.</label>
      {reviewedGeneration === resume.generationId && <p><a href={`/api/opportunities/${encodeURIComponent(opportunityId)}/resume?generation=${encodeURIComponent(resume.generationId)}&reviewed=yes`}>Download tailored PDF</a></p>}
    </div>}
  </ContentCard>;
}
