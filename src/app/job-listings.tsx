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
  try {
    const host = new URL(url).host;
    return host ? host.replace(/^www\./, "") : null;
  } catch {
    return null;
  }
}

export function JobListings({ opportunities, materials = [], assessments = {}, error }: { opportunities: CapturedOpportunityLibraryItem[]; materials?: Array<{ id: string; label: string }>; assessments?: Record<string, { assessment?: OpportunityAssessmentView; latestDecision?: OpportunityDecisionView; fit?: { label: "Strong" | "Potential" | "Stretch"; confidence: "high" | "medium" | "low"; calculatedAt: string; factors: FitFactor[] } }>; error?: { summary: string; safeNextAction: string } }) {
  const [query, setQuery] = useState("");
  const [jobsView, setJobsView] = useState<JobsView>("all");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const captureTrigger = useRef<HTMLButtonElement>(null);
  const [captureOpen, setCaptureOpen] = useState(false);
  const openCapture = (event: MouseEvent<HTMLButtonElement>) => { captureTrigger.current = event.currentTarget; setCaptureOpen(true); };
  const headerCaptureTrigger = useRef<HTMLButtonElement>(null);
  const closeCapture = () => { setCaptureOpen(false); requestAnimationFrame(() => { const trigger = captureTrigger.current; (trigger?.isConnected ? trigger : headerCaptureTrigger.current)?.focus(); }); };
  const handleClearSearch = () => {
    setQuery("");
    searchInputRef.current?.focus();
  };
  const filteredOpportunities = opportunities.filter((opportunity) => matchesOpportunity(opportunity, query));

  return (
    <section id="job-listings" aria-labelledby="job-listings-heading" className="jobs-workspace">
      <header className="jobs-workspace-header">
        <div>
          <p className="eyebrow">Jobs</p>
          <h1 id="job-listings-heading">Your opportunities</h1>
          <p>Keep the roles you choose to capture in one calm, private workspace. You decide what to save and when to open the original page.</p>
        </div>
        <div className="jobs-header-controls">
          {opportunities.length > 0 && jobsView === "all" && !error ? (
            <div className="jobs-search-box">
              <span className="search-icon" aria-hidden="true">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
              </span>
              <label htmlFor="opportunity-search" className="sr-only">Search opportunities</label>
              <input ref={searchInputRef} id="opportunity-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search opportunities (title, company)..." />
              {query ? <button type="button" className="secondary-action search-clear-btn" onClick={handleClearSearch}>Clear search</button> : null}
            </div>
          ) : null}
          {opportunities.length > 0 || jobsView === "applied" || error ? (
            <button ref={headerCaptureTrigger} className="affirmative-action add-opportunity-action" type="button" onClick={openCapture}>
              <span aria-hidden="true" className="add-icon">+</span>
              <span>Add opportunity</span>
            </button>
          ) : null}
        </div>
      </header>
      <nav className="jobs-subnavigation" aria-label="Jobs views">
        <button type="button" aria-pressed={jobsView === "all"} onClick={() => setJobsView("all")}>All opportunities</button>
        <button type="button" aria-pressed={jobsView === "applied"} onClick={() => setJobsView("applied")}>Applied</button>
      </nav>
      <OpportunityCapture open={captureOpen} onClose={closeCapture} onReturnToAllOpportunities={() => { setJobsView("all"); setQuery(""); closeCapture(); }} />
      {jobsView === "applied" ? (
        <section className="jobs-empty-state" aria-labelledby="applied-heading">
          <div className="empty-state-badge" aria-hidden="true">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
            </svg>
          </div>
          <h3 id="applied-heading">Applied opportunities are not available yet</h3>
          <p>Application tracking is a later local workflow. Your captured opportunities remain available in All opportunities.</p>
          <button type="button" className="secondary-action" onClick={() => setJobsView("all")}>Return to all opportunities</button>
        </section>
      ) : error ? (
        <p className="status status-error" role="status"><strong>{error.summary}</strong> <strong>Safe next action:</strong> {error.safeNextAction}</p>
      ) : (
        <section className="jobs-results" aria-label="Captured opportunities">
          {opportunities.length > 0 ? <h3 id="jobs-results-heading" className="sr-only">All opportunities</h3> : null}
          {opportunities.length > 0 ? (
            <p className="jobs-result-summary" role="status" aria-live="polite">
              {filteredOpportunities.length} matching captured opportunit{filteredOpportunities.length === 1 ? "y" : "ies"}.
            </p>
          ) : null}
          {opportunities.length === 0 ? (
            <section className="jobs-empty-state jobs-library-empty">
              <div className="empty-state-badge" aria-hidden="true">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="20" height="14" x="2" y="7" rx="2" />
                  <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                </svg>
              </div>
              <h4>No captured opportunities saved yet</h4>
              <p>Captured opportunities appear here after you review and confirm copied role details. You stay in control of the URL and text you provide.</p>
              <button className="affirmative-action add-opportunity-action" type="button" onClick={openCapture}>
                <span aria-hidden="true" className="add-icon">+</span>
                <span>Add opportunity</span>
              </button>
            </section>
          ) : filteredOpportunities.length === 0 ? (
            <div className="jobs-empty-state">
              <p>No captured opportunities match your search. Clear search and try again.</p>
              <button type="button" className="secondary-action" onClick={handleClearSearch}>Clear search</button>
            </div>
          ) : (
            <ul className="job-listing-list">
              {filteredOpportunities.map((opportunity, index) => (
                <OpportunityCard key={opportunity.id} index={index} opportunity={opportunity} materials={materials} assessment={assessments[opportunity.id]?.assessment} latestDecision={assessments[opportunity.id]?.latestDecision} fit={assessments[opportunity.id]?.fit} />
              ))}
            </ul>
          )}
        </section>
      )}
    </section>
  );
}

function OpportunityCard({ opportunity, index, materials, assessment, latestDecision, fit }: { opportunity: CapturedOpportunityLibraryItem; index: number; materials: Array<{ id: string; label: string }>; assessment?: OpportunityAssessmentView; latestDecision?: OpportunityDecisionView; fit?: { label: "Strong" | "Potential" | "Stretch"; confidence: "high" | "medium" | "low"; calculatedAt: string; factors: FitFactor[] } }) {
  const host = sourceHost(opportunity.originalUrl);
  const parsedPosted = opportunity.postedAt === "Unknown" || Number.isNaN(new Date(opportunity.postedAt).getTime())
    ? "Unknown"
    : new Date(opportunity.postedAt).toLocaleDateString();
  const parsedCaptured = Number.isNaN(new Date(opportunity.capturedAt).getTime())
    ? "recent"
    : new Date(opportunity.capturedAt).toLocaleDateString();

  return (
    <li className="job-listing">
      <article aria-labelledby={`opportunity-${index}`}>
        <header className="job-listing-header">
          <div className="job-listing-identity">
            <div className="company-logo-badge" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="14" x="2" y="7" rx="2" />
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
              </svg>
            </div>
            <div className="job-listing-title-block">
              <p className="job-company">{opportunity.company}</p>
              <h2 id={`opportunity-${index}`} className="job-title">{opportunity.title}</h2>
            </div>
          </div>
          <time className="job-listing-saved">
            Captured {parsedCaptured}
          </time>
        </header>
        <dl className="job-listing-facts">
          <div><dt>Location</dt><dd>{opportunity.location}</dd></div>
          <div><dt>Work style</dt><dd>{opportunity.workStyle}</dd></div>
          <div><dt>Posted date</dt><dd>{parsedPosted}</dd></div>
        </dl>
        <div className="job-listing-foot">
          <p className="job-fit">{assessment ? "Saved local-AI fit guidance is available for review." : "No fit guidance yet. Fit guidance uses only your selected approved evidence and these captured details."}</p>
          <div className="job-listing-actions">
            <OpportunityAssessment opportunityId={opportunity.id} materials={materials} initialAssessment={assessment} latestDecisionId={latestDecision?.id} deterministicFit={fit} />
            <p className="job-source">
              <a href={opportunity.originalUrl} target="_blank" rel="noreferrer" className="job-source-link">
                <span>Open original page</span>
                {host ? <span className="source-host">on {host}</span> : null}
                <span aria-hidden="true" className="external-icon">↗</span>
              </a>
              <span className="job-meta">Submission happens outside this workspace; nothing is prefilled or transmitted.</span>
            </p>
          </div>
        </div>
      </article>
    </li>
  );
}
