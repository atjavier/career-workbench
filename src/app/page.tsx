import { storageProtectionMessage } from "@/domain/workspace/status-message";
import { WorkspaceStatus } from "@/app/workspace-status";
import { DataStorage } from "@/app/data-storage";
import { listDataStorage } from "@/domain/data-storage/data-storage";
import { JobListings } from "@/app/job-listings";
import { listCapturedOpportunities } from "@/domain/opportunities/captured-opportunities";
import { ApplicationShell } from "@/app/application-shell";

export const dynamic = "force-dynamic";

export default async function Home() {
  const protection = storageProtectionMessage();
  const dataStorageState = await listDataStorage().catch(() => undefined);
  const opportunitiesState = await listCapturedOpportunities().then((view) => ({ opportunities: view.opportunities, error: undefined })).catch((error) => ({
    opportunities: [],
    error: error instanceof Error && "summary" in error && "safeNextAction" in error
      ? { summary: String(error.summary), safeNextAction: String(error.safeNextAction) }
      : { summary: "Your opportunities are unavailable.", safeNextAction: "Check local workspace storage, then refresh the page." },
  }));

  return <ApplicationShell active="Jobs"><div className="workspace-shell jobs-page-shell">
    <JobListings opportunities={opportunitiesState.opportunities} error={opportunitiesState.error} />
    <WorkspaceStatus />
    <details className="secondary-workspace"><summary>Data &amp; Storage</summary><p>Review local storage, recovery copies, and activity history when you need them.</p><div id="data-storage">{dataStorageState ? <DataStorage view={dataStorageState} protectionSummary={protection.summary} protectionDetail={protection.detail} /> : <section className="panel" aria-labelledby="data-storage-heading"><h2 id="data-storage-heading">Data &amp; Storage</h2><p className="status status-error" role="status">Data &amp; Storage is unavailable right now. <strong>Safe next action:</strong> Check local workspace storage access, then refresh the page.</p></section>}</div></details>
  </div></ApplicationShell>;
}
