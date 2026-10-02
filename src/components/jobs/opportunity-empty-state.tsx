"use client";

import type { MouseEvent } from "react";
import { EmptyStateCard } from "@/components/common/empty-state-card";

interface OpportunityEmptyLibraryProps {
  onOpenCapture: (event: MouseEvent<HTMLButtonElement>) => void;
}

export function OpportunityEmptyLibrary({ onOpenCapture }: OpportunityEmptyLibraryProps) {
  return (
    <EmptyStateCard
      headingLevel="h4"
      className="jobs-library-empty"
      title="No captured opportunities saved yet"
      description="Captured opportunities appear here after you review and confirm copied role details. You stay in control of the URL and text you provide."
      action={
        <button
          className="affirmative-action add-opportunity-action"
          type="button"
          onClick={onOpenCapture}
        >
          <span>Add opportunity</span>
        </button>
      }
    />
  );
}

interface OpportunityEmptySearchProps {
  onClearSearch: () => void;
}

export function OpportunityEmptySearch({ onClearSearch }: OpportunityEmptySearchProps) {
  return (
    <EmptyStateCard
      description="No captured opportunities match your search. Clear search and try again."
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
