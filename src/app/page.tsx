import { WorkspaceContainer } from "@/components/common/layout-containers";
import { JobListings } from "@/components/jobs/job-listings";
import { listCapturedOpportunities } from "@/domain/opportunities/captured-opportunities";
import { ApplicationShell } from "@/components/common/application-shell";
export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const { deleted } = await searchParams;
  const opportunitiesState = await listCapturedOpportunities()
    .then((view) => ({ opportunities: view.opportunities, error: undefined }))
    .catch((error) => ({
      opportunities: [],
      error:
        error instanceof Error &&
        "summary" in error &&
        "safeNextAction" in error
          ? {
              summary: String(error.summary),
              safeNextAction: String(error.safeNextAction),
            }
          : {
              summary: "Your opportunities are unavailable.",
              safeNextAction:
                "Check local workspace storage, then refresh the page.",
            },
    }));
  return (
    <ApplicationShell active="Jobs">
      <WorkspaceContainer className="jobs-page-shell">
        {deleted && <p role="status">{deleted === "cleanup-pending" ? "Opportunity deleted. Some old resume files could not be removed yet; cleanup will retry when you open this page." : "Opportunity and attached tailored resume deleted."}</p>}
        <JobListings
          opportunities={opportunitiesState.opportunities}
          error={opportunitiesState.error}
        />
      </WorkspaceContainer>
    </ApplicationShell>
  );
}
