"use client";

import type { RefObject } from "react";

interface OpportunitySearchProps {
  query: string;
  onQueryChange: (query: string) => void;
  onClearSearch: () => void;
  searchInputRef: RefObject<HTMLInputElement | null>;
  totalMatches: number;
}

export function OpportunitySearch({
  query,
  onQueryChange,
  onClearSearch,
  searchInputRef,
  totalMatches,
}: OpportunitySearchProps) {
  return (
    <div className="jobs-search-box">
      <label htmlFor="opportunity-search" className="sr-only">
        Search opportunities
      </label>
      <input
        ref={searchInputRef}
        id="opportunity-search"
        type="search"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="Search opportunities (title, company)..."
        aria-label="Search opportunities by title, company, or location"
      />
      {query ? (
        <button
          type="button"
          className="secondary-action search-clear-btn"
          onClick={onClearSearch}
        >
          Clear search
        </button>
      ) : null}
    </div>
  );
}

export function OpportunityResultCount({ count }: { count: number }) {
  return (
    <p className="jobs-result-summary" role="status" aria-live="polite">
      {count} matching captured opportunit{count === 1 ? "y" : "ies"}.
    </p>
  );
}
