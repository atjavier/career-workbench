"use client";

import Link from "next/link";
import { EmptyStateCard } from "@/components/common/empty-state-card";

export function OpportunityEmptyLibrary() {
  return <EmptyStateCard headingLevel="h4" className="jobs-library-empty" title="No opportunities yet"
    description="Add a job you’re interested in to get started."
    action={<Link href="/opportunities/new" className="btn affirmative-action btn-primary btn-md add-opportunity-action">Add opportunity</Link>} />;
}

interface OpportunityEmptySearchProps {
  onClearSearch: () => void;
}

export function OpportunityEmptySearch({ onClearSearch }: OpportunityEmptySearchProps) {
  return (
    <EmptyStateCard
      description="No opportunities match your search. Clear search and try again."
      action={
        <button
          type="button"
          className="secondary-action"
          onClick={onClearSearch}
        >
          Clear search
        </button>
      }
    />
  );
}

interface OpportunityEmptyAppliedProps {
  onReturnToAllOpportunities: () => void;
}

export function OpportunityEmptyApplied({
  onReturnToAllOpportunities,
}: OpportunityEmptyAppliedProps) {
  return (
    <EmptyStateCard
      headingLevel="h3"
      id="applied-heading"
      title="Applied opportunities are not available yet"
      description="Application tracking is a later local workflow. Your captured opportunities remain available in All opportunities."
      action={
        <button
          type="button"
          className="secondary-action"
          onClick={onReturnToAllOpportunities}
        >
          Return to all opportunities
        </button>
      }
    />
  );
}
