"use client";

import { useActionState, useRef, useState, type ComponentProps, type MouseEvent } from "react";

import { jobListingsAction, type WorkspaceActionState } from "@/app/actions";
import { OpportunityCapture } from "@/app/opportunity-capture";
import type { JobListing, JobListingsView } from "@/domain/discovery/job-listings";

type FitFilter = "all" | "Strong" | "Potential";
type JobsView = "all" | "applied";
type FormAction = ComponentProps<"form">["action"];

const initial: WorkspaceActionState = { status: "idle", summary: "Your saved opportunities stay on this computer." };

function matchesListing(listing: JobListing, query: string, fitFilter: FitFilter) {
  const searchable = [listing.title, listing.company, listing.workStyle, listing.location].join(" ").toLocaleLowerCase();
  return searchable.includes(query.trim().toLocaleLowerCase()) && (fitFilter === "all" || listing.fitAssessment?.label === fitFilter);
}

function sourceHost(url: string) {
  try { return new URL(url).host; } catch { return "the original page"; }
}

export function JobListings({ view, error }: { view: JobListingsView; error?: { summary: string; safeNextAction: string } }) {
  const [state, action, pending] = useActionState(jobListingsAction, initial);
  const [confirmingListingId, setConfirmingListingId] = useState<string>();
  const [query, setQuery] = useState("");
  const [fitFilter, setFitFilter] = useState<FitFilter>("all");
  const [jobsView, setJobsView] = useState<JobsView>("all");
  const invokers = useRef(new Map<string, HTMLButtonElement>());
  const captureTrigger = useRef<HTMLButtonElement>(null);
  const [captureOpen, setCaptureOpen] = useState(false);
  const closeConfirmation = (listingId: string) => { setConfirmingListingId(undefined); requestAnimationFrame(() => invokers.current.get(listingId)?.focus()); };
  const openCapture = (event: MouseEvent<HTMLButtonElement>) => { captureTrigger.current = event.currentTarget; setCaptureOpen(true); };
  const closeCapture = () => { setCaptureOpen(false); requestAnimationFrame(() => captureTrigger.current?.focus()); };
  const filteredListings = view.listings.filter((listing) => matchesListing(listing, query, fitFilter));
  const hasActiveFilter = Boolean(query.trim()) || fitFilter !== "all";
  const filterDescription = [query.trim() ? `search “${query.trim()}”` : "all saved opportunities", fitFilter === "all" ? "all fit labels" : `${fitFilter} fit`].join("; ");

  return <section id="job-listings" aria-labelledby="job-listings-heading" className="jobs-workspace">
    <header className="jobs-workspace-header"><div><p className="eyebrow">Jobs</p><h1 id="job-listings-heading">Your opportunities</h1><p>Keep the roles you find in one calm, private workspace. You decide what to save and when to open the original page.</p></div>{view.hasListings || jobsView === "applied" || error ? <button className="affirmative-action add-opportunity-action" type="button" onClick={openCapture}>Add opportunity</button> : null}</header>
    <nav className="jobs-subnavigation" aria-label="Jobs views"><button type="button" aria-pressed={jobsView === "all"} onClick={() => setJobsView("all")}>All opportunities</button><button type="button" aria-pressed={jobsView === "applied"} onClick={() => setJobsView("applied")}>Applied</button></nav>
    <OpportunityCapture open={captureOpen} onClose={closeCapture} />
    {state.status !== "idle" ? <p className={state.status === "error" ? "status status-error jobs-action-status" : "status jobs-action-status"} role="status" aria-live="polite"><strong>{state.summary}</strong>{state.safeNextAction ? <> <strong>Safe next action:</strong> {state.safeNextAction}</> : null}</p> : null}
    {jobsView === "applied" ? <section className="jobs-empty-state" aria-labelledby="applied-heading"><h3 id="applied-heading">No applied opportunities yet</h3><p>Roles you deliberately track as applied will appear here. Tracking stays local and never submits an employer application.</p></section> : error ? <p className="status status-error" role="status"><strong>{error.summary}</strong> <strong>Safe next action:</strong> {error.safeNextAction}</p> : <section className="jobs-results" aria-label="Saved opportunities">
      {view.hasListings ? <><h3 id="jobs-results-heading">All opportunities</h3>
      <label htmlFor="job-search">Search opportunities</label>
      <input id="job-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Job title, company, location, or work style" />
      <fieldset className="fit-filter-group"><legend>Fit label</legend><button type="button" aria-pressed={fitFilter === "all"} onClick={() => setFitFilter("all")}>All fits</button><button type="button" aria-pressed={fitFilter === "Strong"} onClick={() => setFitFilter("Strong")}>Strong fit</button><button type="button" aria-pressed={fitFilter === "Potential"} onClick={() => setFitFilter("Potential")}>Potential fit</button></fieldset>
      <p className="jobs-result-summary" role="status" aria-live="polite">{filteredListings.length} matching saved opportunities for {filterDescription}.</p>
      {hasActiveFilter ? <button type="button" className="secondary-action" onClick={() => { setQuery(""); setFitFilter("all"); }}>Clear filters</button> : null}</> : null}
      {!view.hasListings ? <section className="jobs-empty-state jobs-library-empty"><h4>No opportunities saved yet</h4><p>Saved opportunities appear here. Add one when you are ready; you remain in control of the URL and copied details you provide.</p><button className="affirmative-action add-opportunity-action" type="button" onClick={openCapture}>Add opportunity</button></section> : filteredListings.length === 0 ? <p className="jobs-empty-state">No saved opportunities match your current search or filters. Clear filters and try again.</p> : <ul className="job-listing-list">{filteredListings.map((listing) => <JobCard key={listing.id} listing={listing} action={action} pending={pending} confirming={confirmingListingId === listing.id} setConfirmingListingId={setConfirmingListingId} invokers={invokers} closeConfirmation={closeConfirmation} />)}</ul>}
    </section>}
  </section>;
}

function JobCard({ listing, action, pending, confirming, setConfirmingListingId, invokers, closeConfirmation }: { listing: JobListing; action: FormAction; pending: boolean; confirming: boolean; setConfirmingListingId: (listingId?: string) => void; invokers: React.RefObject<Map<string, HTMLButtonElement>>; closeConfirmation: (listingId: string) => void }) {
  const originalUrl = listing.sourceRecords.find((record) => record.jobListingId === listing.id)?.originalUrl;
  return <li className="job-listing"><article aria-labelledby={`listing-${listing.id}`}><header className="job-listing-header"><div><h2 id={`listing-${listing.id}`}>{listing.title}</h2><p className="job-company">{listing.company}</p></div><time className="job-listing-saved">Saved {new Date(listing.firstSeenAt).toLocaleDateString()}</time></header><dl className="job-listing-facts"><div><dt>Location</dt><dd>{listing.location || "Unknown"}</dd></div><div><dt>Work style</dt><dd>{listing.workStyle || "Unknown"}</dd></div></dl><div className="job-listing-foot"><p className="job-fit">{listing.fitAssessment ? <>{listing.fitAssessment.label} <span className="job-meta">({listing.fitAssessment.confidence} confidence; decision support, not a hiring prediction)</span></> : "Fit not calculated"}</p>{originalUrl ? <p className="job-source"><a href={originalUrl} target="_blank" rel="noreferrer">Open original page on {sourceHost(originalUrl)}</a> <span className="job-meta">Submission happens outside this workspace; nothing is prefilled or transmitted.</span></p> : <p className="job-meta">Original page: Unknown.</p>}</div><div className="job-card-actions"><form action={action}><input type="hidden" name="jobCommand" value="calculate-fit" /><input type="hidden" name="listingId" value={listing.id} /><button className="affirmative-action" type="submit" disabled={pending}>Calculate fit from approved evidence</button></form>{listing.activeOverrideId ? <form action={action}><input type="hidden" name="jobCommand" value="reverse-duplicate" /><input type="hidden" name="overrideId" value={listing.activeOverrideId} /><p>A local duplicate override is active.</p><button className="danger-action" name="confirmed" value="yes" type="submit" disabled={pending}>Reverse duplicate change</button></form> : <><button className="neutral-action" ref={(element) => { if (element) invokers.current.set(listing.id, element); else invokers.current.delete(listing.id); }} type="button" aria-expanded={confirming} aria-controls={`duplicate-confirmation-${listing.id}`} onClick={() => setConfirmingListingId(confirming ? undefined : listing.id)}>Change duplicate group</button>{confirming ? <form action={action} id={`duplicate-confirmation-${listing.id}`} aria-label="Confirm duplicate change" onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); closeConfirmation(listing.id); } }}><input type="hidden" name="jobCommand" value="separate-duplicate" /><input type="hidden" name="listingId" value={listing.id} /><p>Confirm duplicate change: this separates this saved opportunity from its current probable group.</p><button className="danger-action" name="confirmed" value="yes" type="submit" disabled={pending}>Confirm duplicate change</button><button className="neutral-action" type="button" onClick={() => closeConfirmation(listing.id)}>Cancel</button></form> : null}</>}</div></article></li>;
}
