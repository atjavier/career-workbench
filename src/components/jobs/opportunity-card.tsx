"use client";

import type {
  OpportunityAssessmentView,
  OpportunityDecisionView,
} from "@/domain/fit/ai-opportunity-assessment";
import type { CapturedOpportunityLibraryItem } from "@/domain/opportunities/captured-opportunities";
import type { FitFactor } from "@/domain/fit/fit-assessment";
import { OpportunityAssessment } from "@/components/jobs/opportunity-assessment";
import { TierBadge, fitLabelToTier } from "@/components/common/tier-badge";

export function sourceHost(url: string) {
  try {
    const host = new URL(url).host;
    return host ? host.replace(/^www\./, "") : null;
  } catch {
    return null;
  }
}

export function getFitTierClass(label?: "Strong" | "Potential" | "Stretch"): string {
  switch (label) {
    case "Strong":
      return "tier-excellent";
    case "Potential":
      return "tier-good";
    case "Stretch":
      return "tier-polish";
    default:
      return "";
  }
}

interface OpportunityCardProps {
  opportunity: CapturedOpportunityLibraryItem;
  index: number;
  materials: Array<{ id: string; label: string }>;
  assessment?: OpportunityAssessmentView;
  latestDecision?: OpportunityDecisionView;
  fit?: {
    label: "Strong" | "Potential" | "Stretch";
    confidence: "high" | "medium" | "low";
    calculatedAt: string;
    factors: FitFactor[];
  };
}

export function OpportunityCard({
  opportunity,
  index,
  materials,
  assessment,
  latestDecision,
  fit,
}: OpportunityCardProps) {
  const host = sourceHost(opportunity.originalUrl);
  const parsedPosted =
    opportunity.postedAt === "Unknown" ||
    Number.isNaN(new Date(opportunity.postedAt).getTime())
      ? "Unknown"
      : new Date(opportunity.postedAt).toLocaleDateString();
  const parsedCaptured = Number.isNaN(
    new Date(opportunity.capturedAt).getTime(),
  )
    ? "recent"
    : new Date(opportunity.capturedAt).toLocaleDateString();

  return (
    <li className="job-listing">
      <article aria-labelledby={`opportunity-${index}`}>
        <header className="job-listing-header">
          <div className="job-listing-identity">
            <div className="company-logo-badge" aria-hidden="true">
              <span className="company-logo-letter">C</span>
            </div>
            <div className="job-listing-title-block">
              <p className="job-company">{opportunity.company}</p>
              <h2 id={`opportunity-${index}`} className="job-title">
                {opportunity.title}
              </h2>
            </div>
          </div>
          <time className="job-listing-saved" suppressHydrationWarning>
            Captured {parsedCaptured}
          </time>
        </header>

        <dl className="job-listing-facts">
          <div>
            <dt>Location</dt>
            <dd>{opportunity.location}</dd>
          </div>
          <div>
            <dt>Work style</dt>
            <dd>{opportunity.workStyle}</dd>
          </div>
          <div>
            <dt>Posted date</dt>
            <dd suppressHydrationWarning>{parsedPosted}</dd>
          </div>
        </dl>

        <div className="job-listing-foot">
          <div className="job-fit-row">
            {fit ? (
              <TierBadge level={fitLabelToTier(fit.label)}>
                {fit.label} fit • {fit.confidence} confidence
              </TierBadge>
            ) : null}
            <p className="job-fit">
              {assessment
                ? "Saved local-AI fit guidance is available for review."
                : "No fit guidance yet. Fit guidance uses only your selected approved evidence and these captured details."}
            </p>
          </div>

          <div className="job-listing-actions">
            <OpportunityAssessment
              opportunityId={opportunity.id}
              materials={materials}
              initialAssessment={assessment}
              latestDecisionId={latestDecision?.id}
              deterministicFit={fit}
            />
            <p className="job-source">
              <a
                href={opportunity.originalUrl}
                target="_blank"
                rel="noreferrer"
                className="job-source-link"
              >
                <span>Open original page</span>
                {host ? <span className="source-host">on {host}</span> : null}
              </a>
              <span className="job-meta">
                Submission happens outside this workspace; nothing is prefilled
                or transmitted.
              </span>
            </p>
          </div>
        </div>
      </article>
    </li>
  );
}
