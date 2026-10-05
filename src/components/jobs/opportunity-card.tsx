import Link from "next/link";
import { ContentCard } from "@/components/common/layout-containers";
import { OpportunityFacts } from "./opportunity-fields";
import type { CapturedOpportunityLibraryItem } from "@/domain/opportunities/captured-opportunities";

export function sourceHost(url: string) {
  try { return new URL(url).host.replace(/^www\./, "") || null; } catch { return null; }
}
export function OpportunityCard({ opportunity, index }: { opportunity: CapturedOpportunityLibraryItem; index: number }) {
  return <ContentCard as="li" className="job-listing opportunity-library-card">
    <article aria-labelledby={`opportunity-${index}`}>
      <header className="job-listing-header">
        <div className="job-listing-identity">
          <div className="company-logo-badge" aria-hidden="true">{opportunity.company.trim().slice(0, 2).toLocaleUpperCase()}</div>
          <div className="job-listing-title-block">
            <p className="job-company">{opportunity.company}</p>
            <h2 id={`opportunity-${index}`} className="job-title"><Link href={`/opportunities/${opportunity.id}`}>{opportunity.title}</Link></h2>
          </div>
        </div>
        <time className="job-listing-saved" dateTime={opportunity.capturedAt}>Saved {opportunity.capturedAt.slice(0, 10)}</time>
      </header>
      <OpportunityFacts opportunity={opportunity} />
      <div className="opportunity-card-actions">
        <Link className="opportunity-details-link" href={`/opportunities/${opportunity.id}`}>View opportunity <span aria-hidden="true">→</span></Link>
        <a href={opportunity.originalUrl} target="_blank" rel="noreferrer" className="job-source-link">Original posting <span aria-hidden="true">↗</span></a>
      </div>
    </article>
  </ContentCard>;
}
