import { notFound } from "next/navigation";
import { ApplicationShell } from "@/components/common/application-shell";
import { WorkspaceContainer } from "@/components/common/layout-containers";
import { OpportunityDetails } from "@/components/jobs/opportunity-details";
import { readOpportunityDetails, readOpportunityDuplicate } from "@/domain/opportunities/captured-opportunities";
import Link from "next/link";
import { readTailoringState } from "@/application/opportunities/tailored-resume";
import { OpportunityTailoredResume } from "@/components/jobs/opportunity-tailored-resume";

export const dynamic = "force-dynamic";
export default async function OpportunityPage({ params, searchParams }: { params: Promise<{ opportunityId: string }>; searchParams: Promise<{ added?: string }> }) {
  const { opportunityId } = await params;
  const opportunity = await readOpportunityDetails(opportunityId);
  if (!opportunity) notFound();
  const tailoring = await readTailoringState(opportunityId);
  const { added } = await searchParams;
  const duplicate = await readOpportunityDuplicate(opportunityId);
  return <ApplicationShell active="Jobs" activeSubItem="All Opportunities">
    <WorkspaceContainer>
      {added === "1" && <p role="status">Opportunity added.</p>}
      {duplicate && <p role="status">A similar opportunity is already saved: <Link href={`/opportunities/${duplicate.id}`}>{duplicate.title} at {duplicate.company}</Link>. Both jobs remain separate.</p>}
      <OpportunityDetails opportunity={opportunity}><OpportunityTailoredResume opportunityId={opportunityId} state={tailoring} /></OpportunityDetails>
    </WorkspaceContainer>
  </ApplicationShell>;
}
