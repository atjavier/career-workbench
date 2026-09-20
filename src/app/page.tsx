import { storageProtectionMessage } from "@/domain/workspace/status-message";
import { WorkspaceStatus } from "@/app/workspace-status";
import { DataStorage } from "@/app/data-storage";
import { listDataStorage } from "@/domain/data-storage/data-storage";
import { JobListings } from "@/app/job-listings";
import { listCapturedOpportunities } from "@/domain/opportunities/captured-opportunities";
import { ApplicationShell } from "@/app/application-shell";
import { resolveAppDataPaths } from "@/files/app-data";
import { applyMigrations, openDatabase } from "@/persistence/database";
import { listApprovedEvidence } from "@/persistence/evidence-repository";
import {
  latestCapturedOpportunityAssessment,
  latestCapturedOpportunityDecision,
  type OpportunityAssessmentView,
  type OpportunityDecisionView,
} from "@/domain/fit/ai-opportunity-assessment";
import {
  latestCapturedFitAssessmentView,
  type FitFactor,
} from "@/domain/fit/fit-assessment";

export const dynamic = "force-dynamic";

export default async function Home() {
  const protection = storageProtectionMessage();
  const dataStorageState = await listDataStorage().catch(() => undefined);
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
  const materials = await (async () => {
    const paths = await resolveAppDataPaths();
    const db = openDatabase(paths.databasePath);
    try {
      applyMigrations(db);
      return listApprovedEvidence(db).map((item) => ({
        id: item.id,
        label: `${item.sourceDocument} — ${item.sourceSection}`,
      }));
    } finally {
      db.close();
    }
  })().catch(() => []);

  const assessmentState = await Promise.all(
    opportunitiesState.opportunities.map(
      async (opportunity) =>
        [
          opportunity.id,
          await latestCapturedOpportunityAssessment(opportunity.id).catch(
            () => undefined,
          ),
          await latestCapturedOpportunityDecision(opportunity.id).catch(
            () => undefined,
          ),
          await (async () => {
            const paths = await resolveAppDataPaths();
            const db = openDatabase(paths.databasePath);
            try {
              applyMigrations(db);
              return latestCapturedFitAssessmentView(db, opportunity.id);
            } finally {
              db.close();
            }
          })().catch(() => undefined),
        ] as const,
    ),
  );
  const assessments = Object.fromEntries(
    assessmentState.map(([id, assessment, decision, fit]) => [
      id,
      { assessment, latestDecision: decision, fit },
    ]),
  ) as Record<
    string,
    {
      assessment?: OpportunityAssessmentView;
      latestDecision?: OpportunityDecisionView;
      fit?: {
        label: "Strong" | "Potential" | "Stretch";
        confidence: "high" | "medium" | "low";
        calculatedAt: string;
        factors: FitFactor[];
      };
    }
  >;

  return (
    <ApplicationShell active="Jobs">
      <div className="workspace-shell jobs-page-shell">
        <JobListings
          opportunities={opportunitiesState.opportunities}
          materials={materials}
          assessments={assessments}
          error={opportunitiesState.error}
        />
        <WorkspaceStatus />
        <details className="secondary-workspace">
          <summary>Data &amp; Storage</summary>
          <p>
            Review local storage, recovery copies, and activity history when you
            need them.
          </p>
          <div id="data-storage">
            {dataStorageState ? (
              <DataStorage
                view={dataStorageState}
                protectionSummary={protection.summary}
                protectionDetail={protection.detail}
              />
            ) : (
              <section className="panel" aria-labelledby="data-storage-heading">
                <h2 id="data-storage-heading">Data &amp; Storage</h2>
                <p className="status status-error" role="status">
                  Data &amp; Storage is unavailable right now.{" "}
                  <strong>Safe next action:</strong> Check local workspace
                  storage access, then refresh the page.
                </p>
              </section>
            )}
          </div>
        </details>
      </div>
    </ApplicationShell>
  );
}
