import { WorkspaceContainer } from "@/components/common/layout-containers";
import { PageHeader } from "@/components/common/page-header";
import { EmptyStateCard } from "@/components/common/empty-state-card";
import Link from "next/link";

export function ApplicationsWorkspace() {
  return <WorkspaceContainer className="applications-workspace">
    <PageHeader title="Applied" subtitle="Application tracking isn’t available yet." />
    <EmptyStateCard title="No applied jobs to show"
      description="Review saved opportunities and tailor a resume for your next application."
      action={<Link href="/">Browse opportunities</Link>} />
  </WorkspaceContainer>;
}
