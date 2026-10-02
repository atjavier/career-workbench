"use client";

import { useRef, useState, type MouseEvent } from "react";

import { OpportunityCapture } from "@/components/jobs/opportunity-capture";
import { PageHeader } from "@/components/common/page-header";
import { OpportunityCard, sourceHost } from "@/components/jobs/opportunity-card";
import {
  OpportunitySearch,
  OpportunityResultCount,
} from "@/components/jobs/opportunity-search";
import { OpportunitySubnav, type JobsView } from "@/components/jobs/opportunity-subnav";
import {
  OpportunityEmptyLibrary,
  OpportunityEmptySearch,
  OpportunityEmptyApplied,
} from "@/components/jobs/opportunity-empty-state";
import type {
  OpportunityAssessmentView,
  OpportunityDecisionView,
} from "@/domain/fit/ai-opportunity-assessment";
import type { CapturedOpportunityLibraryItem } from "@/domain/opportunities/captured-opportunities";
import type { FitFactor } from "@/domain/fit/fit-assessment";

function matchesOpportunity(
  opportunity: CapturedOpportunityLibraryItem,
  query: string,
) {
  return [
    opportunity.title,
    opportunity.company,
    opportunity.location,
    opportunity.workStyle,
  ]
    .join(" ")
    .toLocaleLowerCase()
    .includes(query.trim().toLocaleLowerCase());
}

export function JobListings({
  opportunities,
  materials = [],
  assessments = {},
  error,
}: {
  opportunities: CapturedOpportunityLibraryItem[];
  materials?: Array<{ id: string; label: string }>;
  assessments?: Record<
    string,
    {
      assessment?: OpportunityAssessmentView;
      latestDecision?: OpportunityDecisionView;
      fit?: {
        label: "Strong" | "Potential" | "Stretch";
        confidence: "high" | "medium" | "low";
        calculatedAt: string;
        factors: FitFactor[];
      };
    }
  >;
  error?: { summary: string; safeNextAction: string };
}) {
  const [query, setQuery] = useState("");
  const [jobsView, setJobsView] = useState<JobsView>("all");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const captureTrigger = useRef<HTMLButtonElement>(null);
  const [captureOpen, setCaptureOpen] = useState(false);
  const openCapture = (event: MouseEvent<HTMLButtonElement>) => {
    captureTrigger.current = event.currentTarget;
    setCaptureOpen(true);
  };
  const headerCaptureTrigger = useRef<HTMLButtonElement>(null);
  const closeCapture = () => {
    setCaptureOpen(false);
    requestAnimationFrame(() => {
      const trigger = captureTrigger.current;
      (trigger?.isConnected ? trigger : headerCaptureTrigger.current)?.focus();
    });
  };
  const handleClearSearch = () => {
    setQuery("");
    searchInputRef.current?.focus();
  };
  const filteredOpportunities = opportunities.filter((opportunity) =>
    matchesOpportunity(opportunity, query),
  );

  return (
    <section
      id="job-listings"
      aria-labelledby="job-listings-heading"
      className="jobs-workspace"
    >
      <PageHeader
        className="jobs-workspace-header"
        title={<h1 id="job-listings-heading">Your opportunities</h1>}
        subtitle="Keep the roles you choose to capture in one calm, private workspace. You decide what to save and when to open the original page."
        actions={
          <>
            {opportunities.length > 0 && jobsView === "all" && !error ? (
              <OpportunitySearch
                query={query}
                onQueryChange={setQuery}
                onClearSearch={handleClearSearch}
                searchInputRef={searchInputRef}
                totalMatches={filteredOpportunities.length}
              />
            ) : null}

            {opportunities.length > 0 || jobsView === "applied" || error ? (
              <button
                ref={headerCaptureTrigger}
                className="affirmative-action add-opportunity-action"
                type="button"
                onClick={openCapture}
              >
                <span>Add opportunity</span>
              </button>
            ) : null}
          </>
        }
      />

      <OpportunitySubnav
        currentView={jobsView}
        onViewChange={setJobsView}
        allCount={opportunities.length}
      />

      <OpportunityCapture
        open={captureOpen}
        onClose={closeCapture}
        onReturnToAllOpportunities={() => {
          setJobsView("all");
          setQuery("");
          closeCapture();
        }}
      />

      {jobsView === "applied" ? (
        <OpportunityEmptyApplied
          onReturnToAllOpportunities={() => setJobsView("all")}
        />
      ) : error ? (
        <p className="status status-error" role="status">
          <strong>{error.summary}</strong> <strong>Safe next action:</strong>{" "}
          {error.safeNextAction}
        </p>
      ) : (
        <section className="jobs-results" aria-label="Captured opportunities">
          {opportunities.length > 0 ? (
            <h3 id="jobs-results-heading" className="sr-only">
              All opportunities
            </h3>
          ) : null}

          {opportunities.length > 0 ? (
            <OpportunityResultCount count={filteredOpportunities.length} />
          ) : null}

          {opportunities.length === 0 ? (
            <OpportunityEmptyLibrary onOpenCapture={openCapture} />
          ) : filteredOpportunities.length === 0 ? (
            <OpportunityEmptySearch onClearSearch={handleClearSearch} />
          ) : (
            <ul className="job-listing-list">
              {filteredOpportunities.map((opportunity, index) => (
                <OpportunityCard
                  key={opportunity.id}
                  index={index}
                  opportunity={opportunity}
                  materials={materials}
                  assessment={assessments[opportunity.id]?.assessment}
                  latestDecision={assessments[opportunity.id]?.latestDecision}
                  fit={assessments[opportunity.id]?.fit}
                />
              ))}
            </ul>
          )}
        </section>
      )}
    </section>
  );
}

export { OpportunityCard, sourceHost };
