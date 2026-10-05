import Link from "next/link";
import { ApplicationShell } from "@/components/common/application-shell";
import { WorkspaceContainer } from "@/components/common/layout-containers";
import { PageHeader } from "@/components/common/page-header";
import { OpportunityCreateForm } from "@/components/jobs/opportunity-create-form";

export const dynamic = "force-dynamic";
export default function NewOpportunityPage() {
  return <ApplicationShell active="Jobs" activeSubItem="All Opportunities">
    <WorkspaceContainer className="opportunity-details-workspace">
      <Link href="/" className="opportunity-back-link">← All opportunities</Link>
      <PageHeader title="Add opportunity" subtitle="Paste the posting link and description. We’ll format the details and add the opportunity." />
      <OpportunityCreateForm />
    </WorkspaceContainer>
  </ApplicationShell>;
}
