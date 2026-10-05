"use client";

import { useRef, useState } from "react";

import Link from "next/link";
import { PageHeader } from "@/components/common/page-header";
import { OpportunityCard, sourceHost } from "@/components/jobs/opportunity-card";
import {
  OpportunitySearch,
  OpportunityResultCount,
} from "@/components/jobs/opportunity-search";
import { OpportunityEmptyLibrary, OpportunityEmptySearch } from "./opportunity-empty-state";
import type { CapturedOpportunityLibraryItem } from "@/domain/opportunities/captured-opportunities";

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
  error,
}: {
  opportunities: CapturedOpportunityLibraryItem[];
  error?: { summary: string; safeNextAction: string };
}) {
  const [query, setQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
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
        subtitle="Keep saved jobs together and tailor your resume for each role."
        actions={
          <>
            {opportunities.length > 0 && !error ? (
              <OpportunitySearch
                query={query}
                onQueryChange={setQuery}
                onClearSearch={handleClearSearch}
                searchInputRef={searchInputRef}
                totalMatches={filteredOpportunities.length}
              />
            ) : null}

            <Link href="/opportunities/new" className="btn affirmative-action btn-primary btn-md add-opportunity-action">Add opportunity</Link>
          </>
        }
      />

      {error ? (
        <p className="status status-error" role="status">
          <strong>{error.summary}</strong> <strong>Safe next action:</strong>{" "}
          {error.safeNextAction}
        </p>
      ) : (
        <section className="jobs-results" aria-label="Saved opportunities">
          {opportunities.length > 0 ? (
            <h3 id="jobs-results-heading" className="sr-only">
              All opportunities
            </h3>
          ) : null}

          {opportunities.length > 0 ? (
            <OpportunityResultCount count={filteredOpportunities.length} />
          ) : null}

          {opportunities.length === 0 ? (
            <OpportunityEmptyLibrary />
          ) : filteredOpportunities.length === 0 ? (
            <OpportunityEmptySearch onClearSearch={handleClearSearch} />
          ) : (
            <ul className="job-listing-list">
              {filteredOpportunities.map((opportunity, index) => (
                <OpportunityCard
                  key={opportunity.id}
                  index={index}
                  opportunity={opportunity}
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
