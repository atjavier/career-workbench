"use client";

import { useRef, useState, type MouseEvent } from "react";

import { OpportunityCapture } from "@/app/opportunity-capture";
import { OpportunityAssessment } from "@/app/opportunity-assessment";
import type { OpportunityAssessmentView, OpportunityDecisionView } from "@/domain/fit/ai-opportunity-assessment";
import type { CapturedOpportunityLibraryItem } from "@/domain/opportunities/captured-opportunities";
import type { FitFactor } from "@/domain/fit/fit-assessment";

type JobsView = "all" | "applied";

function matchesOpportunity(opportunity: CapturedOpportunityLibraryItem, query: string) {
  return [opportunity.title, opportunity.company, opportunity.location, opportunity.workStyle].join(" ").toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
}

function sourceHost(url: string) {
  try { return new URL(url).host; } catch { return "the original page"; }
}

export function JobListings({ opportunities, materials = [], assessments = {}, error }: { opportunities: CapturedOpportunityLibraryItem[]; materials?: Array<{ id: string; label: string }>; assessments?: Record<string, { assessment?: OpportunityAssessmentView; latestDecision?: OpportunityDecisionView; fit?: { label: "Strong" | "Potential" | "Stretch"; confidence: "high" | "medium" | "low"; calculatedAt: string; factors: FitFactor[] } }>; error?: { summary: string; safeNextAction: string } }) {
  const [query, setQuery] = useState("");
  const [jobsView, setJobsView] = useState<JobsView>("all");
  const captureTrigger = useRef<HTMLButtonElement>(null);
  const [captureOpen, setCaptureOpen] = useState(false);
  const openCapture = (event: MouseEvent<HTMLButtonElement>) => { captureTrigger.current = event.currentTarget; setCaptureOpen(true); };
  const headerCaptureTrigger = useRef<HTMLButtonElement>(null);
  const closeCapture = () => { setCaptureOpen(false); requestAnimationFrame(() => { const trigger = captureTrigger.current; (trigger?.isConnected ? trigger : headerCaptureTrigger.current)?.focus(); }); };
  const filteredOpportunities = opportunities.filter((opportunity) => matchesOpportunity(opportunity, query));

  return <section id="job-listings" aria-labelledby="job-listings-heading" className="jobs-workspace">
    <header className="jobs-workspace-header"><div><p className="eyebrow">Jobs</p><h1 id="job-listings-heading">Your opportunities</h1><p>Keep the roles you choose to capture in one calm, private workspace. You decide what to save and when to open the original page.</p></div>{opportunities.length > 0 || jobsView === "applied" || error ? <button ref={headerCaptureTrigger} className="affirmative-action add-opportunity-action" type="button" onClick={openCapture}>Add opportunity</button> : null}</header>
    <nav className="jobs-subnavigation" aria-label="Jobs views"><button type="button" aria-pressed={jobsView === "all"} onClick={() => setJobsView("all")}>All opportunities</button><button type="button" aria-pressed={jobsView === "applied"} onClick={() => setJobsView("applied")}>Applied</button></nav>
    <OpportunityCapture open={captureOpen} onClose={closeCapture} onReturnToAllOpportunities={() => { setJobsView("all"); setQuery(""); closeCapture(); }} />
    {jobsView === "applied" ? <section className="jobs-empty-state" aria-labelledby="applied-heading"><h3 id="applied-heading">Applied opportunities are not available yet</h3><p>Application tracking is a later local workflow. Your captured opportunities remain available in All opportunities.</p></section> : error ? <p className="status status-error" role="status"><strong>{error.summary}</strong> <strong>Safe next action:</strong> {error.safeNextAction}</p> : <section className="jobs-results" aria-label="Captured opportunities">
      {opportunities.length > 0 ? <><h3 id="jobs-results-heading">All opportunities</h3><label htmlFor="opportunity-search">Search opportunities</label><input id="opportunity-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Job title, company, location, or work style" /><p className="jobs-result-summary" role="status" aria-live="polite">{filteredOpportunities.length} matching captured opportunit{filteredOpportunities.length === 1 ? "y" : "ies"}.</p>{query ? <button type="button" className="secondary-action" onClick={() => setQuery("")}>Clear search</button> : null}</> : null}
      {opportunities.length === 0 ? <section className="jobs-empty-state jobs-library-empty"><h4>No captured opportunities saved yet</h4><p>Captured opportunities appear here after you review and confirm copied role details. You stay in control of the URL and text you provide.</p><button className="affirmative-action add-opportunity-action" type="button" onClick={openCapture}>Add opportunity</button></section> : filteredOpportunities.length === 0 ? <p className="jobs-empty-state">No captured opportunities match your search. Clear search and try again.</p> : <ul className="job-listing-list">{filteredOpportunities.map((opportunity, index) => <OpportunityCard key={opportunity.id} index={index} opportunity={opportunity} materials={materials} assessment={assessments[opportunity.id]?.assessment} latestDecision={assessments[opportunity.id]?.latestDecision} fit={assessments[opportunity.id]?.fit} />)}</ul>}
    </section>}
  </section>;
}

function OpportunityCard({ opportunity, index, materials, assessment, latestDecision, fit }: { opportunity: CapturedOpportunityLibraryItem; index: number; materials: Array<{ id: string; label: string }>; assessment?: OpportunityAssessmentView; latestDecision?: OpportunityDecisionView; fit?: { label: "Strong" | "Potential" | "Stretch"; confidence: "high" | "medium" | "low"; calculatedAt: string; factors: FitFactor[] } }) {
  return <li className="job-listing"><article aria-labelledby={`opportunity-${index}`}><header className="job-listing-header"><div><h2 id={`opportunity-${index}`}>{opportunity.title}</h2><p className="job-company">{opportunity.company}</p></div><time className="job-listing-saved">Captured {new Date(opportunity.capturedAt).toLocaleDateString()}</time></header><dl className="job-listing-facts"><div><dt>Location</dt><dd>{opportunity.location}</dd></div><div><dt>Work style</dt><dd>{opportunity.workStyle}</dd></div><div><dt>Posted date</dt><dd>{opportunity.postedAt === "Unknown" ? "Unknown" : new Date(opportunity.postedAt).toLocaleDateString()}</dd></div></dl><div className="job-listing-foot"><p className="job-fit">{assessment ? "Saved local-AI fit guidance is available for review." : "No fit guidance yet. Fit guidance uses only your selected approved evidence and these captured details."}</p><OpportunityAssessment opportunityId={opportunity.id} materials={materials} initialAssessment={assessment} latestDecisionId={latestDecision?.id} deterministicFit={fit} /><p className="job-source"><a href={opportunity.originalUrl} target="_blank" rel="noreferrer">Open original page on {sourceHost(opportunity.originalUrl)}</a> <span className="job-meta">Submission happens outside this workspace; nothing is prefilled or transmitted.</span></p></div></article></li>;
}
