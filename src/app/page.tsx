import { storageProtectionMessage } from "@/domain/workspace/status-message";
import { WorkspaceStatus } from "@/app/workspace-status";
import { BaseResumeImporter } from "@/app/base-resume-importer";
import { listStoredBaseResumes } from "@/domain/base-resume/list-base-resumes";
import { listStoredEvidence } from "@/domain/evidence/list-stored-evidence";
import { EvidenceReview } from "@/app/evidence-review";
import { DataStorage } from "@/app/data-storage";
import { listDataStorage } from "@/domain/data-storage/data-storage";
import { EvidenceLibrary } from "@/app/evidence-library";
import { listEvidenceLibrary } from "@/domain/evidence/evidence-library";
import { listDocumenterProposals } from "@/domain/evidence/evidence-documenter";
import { CurrentBaseResume } from "@/app/current-base-resume";
import { listCurrentBaseResume } from "@/domain/current-base-resume/current-base-resume-commands";
import { JobPreferences } from "@/app/job-preferences";
import { defaultJobPreferences, listJobPreferences } from "@/domain/discovery/job-preferences";
import { PermittedSources } from "@/app/permitted-sources";
import { listSourceConfigurations } from "@/domain/discovery/source-configurations";
import { SourceRefresh } from "@/app/source-refresh";
import { listRefreshRuns } from "@/domain/discovery/refresh-runs";

export const dynamic = "force-dynamic";

export default async function Home() {
  const protection = storageProtectionMessage();
  const baseResumeState = await listStoredBaseResumes();
  const evidenceState = await listStoredEvidence();
  const dataStorageState = await listDataStorage().catch(() => undefined);
  const libraryState: { documents: Awaited<ReturnType<typeof listEvidenceLibrary>>; error?: { summary: string; safeNextAction: string } } = await listEvidenceLibrary().then((documents) => ({ documents, error: undefined })).catch((error) => ({ documents: [], error: error instanceof Error && "summary" in error && "safeNextAction" in error ? { summary: String(error.summary), safeNextAction: String(error.safeNextAction) } : undefined }));
  const documenterState: { proposals: Awaited<ReturnType<typeof listDocumenterProposals>>; error?: { summary: string; safeNextAction: string } } = await listDocumenterProposals().then((proposals) => ({ proposals, error: undefined })).catch((error) => ({ proposals: [], error: error instanceof Error && "summary" in error && "safeNextAction" in error ? { summary: String(error.summary), safeNextAction: String(error.safeNextAction) } : { summary: "Document for Resume proposals are unavailable.", safeNextAction: "Check local workspace storage, then refresh the page." } }));
  const currentResumeState = await listCurrentBaseResume().then((value) => ({ sourceCount: value.sources.length, proposals: value.proposals, versions: value.versions, draft: value.draft, error: undefined })).catch((error) => ({ sourceCount: 0, proposals: [], versions: [], draft: undefined, error: error instanceof Error && "summary" in error && "safeNextAction" in error ? { summary: String(error.summary), safeNextAction: String(error.safeNextAction) } : undefined }));
  const jobPreferencesState = await listJobPreferences().then((view) => ({ view, error: undefined })).catch((error) => ({ view: { values: defaultJobPreferences }, error: error instanceof Error && "summary" in error && "safeNextAction" in error ? { summary: String(error.summary), safeNextAction: String(error.safeNextAction) } : { summary: "Search Preferences are unavailable.", safeNextAction: "Check local workspace storage, then refresh the page." } }));
  const sourceConfigurationsState = await listSourceConfigurations().then((view) => ({ view, error: undefined })).catch((error) => ({ view: { configurations: [] }, error: error instanceof Error && "summary" in error && "safeNextAction" in error ? { summary: String(error.summary), safeNextAction: String(error.safeNextAction) } : { summary: "Permitted Sources are unavailable.", safeNextAction: "Check local workspace storage, then refresh the page." } }));
  const refreshState = await listRefreshRuns().then((view) => ({ view, error: undefined })).catch((error) => ({ view: { runs: [], eligibleSources: [] }, error: error instanceof Error && "summary" in error && "safeNextAction" in error ? { summary: String(error.summary), safeNextAction: String(error.safeNextAction) } : { summary: "Source Refresh is unavailable.", safeNextAction: "Check local workspace storage, then refresh the page." } }));

  return (
    <main className="workspace-shell">
      <header className="workspace-header">
        <p className="eyebrow">Private local workspace</p>
        <h1>Personal Job Discovery</h1>
        <p>Career data stays on this computer. This workspace has no public hosting or product sign-in.</p>
        <nav aria-label="Workspace sections">
          <a href="#search-preferences">Search Preferences</a>
          <a href="#permitted-sources">Permitted Sources</a>
          <a href="#source-refresh">Source Refresh</a>
          <a href="#candidate-profile">Resume &amp; Evidence Library</a>
          <a href="#data-storage">Data &amp; Storage</a>
        </nav>
      </header>

      <WorkspaceStatus />

      <JobPreferences {...jobPreferencesState} />
      <PermittedSources {...sourceConfigurationsState} />
      <SourceRefresh {...refreshState} />

      <section id="candidate-profile" aria-labelledby="candidate-profile-heading" className="panel">
        <h2 id="candidate-profile-heading">Resume &amp; Evidence Library</h2>
        <p>Only approved evidence can support future drafts.</p>
        <EvidenceLibrary documents={libraryState.documents} documenterProposals={documenterState.proposals} documenterError={documenterState.error} error={libraryState.error} />
        <CurrentBaseResume {...currentResumeState} />
        {evidenceState.error ? <p className="status status-error" role="status">{evidenceState.error.summary} <strong>Safe next action:</strong> {evidenceState.error.safeNextAction}</p> : <EvidenceReview evidence={evidenceState.evidence} baseResumeIds={baseResumeState.resumes.map((resume) => resume.id)} />}
        <section aria-labelledby="base-resumes-heading">
          <h3 id="base-resumes-heading">Read-only Base Resume</h3>
          {baseResumeState.error ? <p className="status status-error" role="status">{baseResumeState.error.summary} <strong>Safe next action:</strong> {baseResumeState.error.safeNextAction}</p> : baseResumeState.resumes.length === 0 ? <p>No Base Resume has been imported yet.</p> : <ul>{baseResumeState.resumes.map((resume) => <li key={resume.id}><strong>{resume.primaryFilename}</strong> — imported {new Date(resume.importedAt).toLocaleString()}</li>)}</ul>}
          <p>Legacy Drafts are not available yet. Material Versions are not available yet. Legacy Base Resume imports are retained as history; Current Base Resume versions are managed above.</p>
        </section>
      </section>

      <div id="data-storage">{dataStorageState ? <DataStorage view={dataStorageState} protectionSummary={protection.summary} protectionDetail={protection.detail} /> : <section className="panel" aria-labelledby="data-storage-heading"><h2 id="data-storage-heading">Data &amp; Storage</h2><p className="status status-error" role="status">Data &amp; Storage is unavailable right now. <strong>Safe next action:</strong> Check local workspace storage access, then refresh the page.</p></section>}</div>
    </main>
  );
}
