import { BaseResumeImporter } from "@/app/base-resume-importer";
import { CurrentBaseResume } from "@/app/current-base-resume";
import { listStoredBaseResumes } from "@/domain/base-resume/list-base-resumes";
import { listStoredEvidence } from "@/domain/evidence/list-stored-evidence";
import { listCurrentBaseResume, readCurrentBaseResumePdf } from "@/domain/current-base-resume/current-base-resume-commands";

const safeError = (error: unknown, fallback: string) => error instanceof Error && "summary" in error && "safeNextAction" in error ? { summary: String(error.summary), safeNextAction: String(error.safeNextAction) } : { summary: fallback, safeNextAction: "Check local workspace storage, then refresh the page." };

export async function ResumeWorkspace() {
  const [legacy, current, evidence] = await Promise.all([
    listStoredBaseResumes().catch((error) => ({ resumes: [], error: safeError(error, "Retained resume history is unavailable.") })),
    listCurrentBaseResume()
      .then(async (value) => {
        const sourceId = value.draft?.sourceId;
        return {
          sourceCount: value.sources.length,
          sourceId,
          originalPdfAvailable: sourceId ? Boolean(await readCurrentBaseResumePdf({ sourceId })) : false,
          proposals: value.proposals,
          versions: value.versions,
          draft: value.draft,
          error: undefined,
        };
      })
      .catch((error) => ({
        sourceCount: 0,
        sourceId: undefined,
        originalPdfAvailable: false,
        proposals: [],
        versions: [],
        draft: undefined,
        error: error instanceof Error && "summary" in error && "safeNextAction" in error
          ? { summary: String(error.summary), safeNextAction: String(error.safeNextAction) }
          : { summary: "Current Base Resume is unavailable.", safeNextAction: "Check local workspace storage, then refresh the page." },
      })),
    listStoredEvidence().catch((error) => ({ evidence: [], error: safeError(error, "Evidence support is unavailable.") })),
  ]);

  return <div className="workspace-shell resume-workspace">
    <header className="resume-page-head">
      <div><p className="eyebrow">Resume</p><h1>Shape your resume</h1></div>
      <p className="resume-source-status">Base resume · read-only source<br />{current.draft ? "Working draft is available locally" : "No working draft yet"}</p>
    </header>
    <nav className="resume-view-tabs" aria-label="Resume views"><a href="#resume-edit" aria-current="page">Edit</a><span aria-disabled="true">Experience &amp; Projects <small>Coming soon</small></span></nav>
    <section className="resume-review-band" aria-labelledby="resume-review-band-heading"><div><h2 id="resume-review-band-heading">Review changes before approving</h2><p>Your Base Resume stays unchanged. Review manual edits and evidence-backed changes before approving a new version.</p></div>{current.draft ? <a href="#resume-warnings">Review details</a> : <a href="#resume-editor">Start with import</a>}</section>
    <section id="resume-edit" aria-label="Resume editor and preview">{evidence.error ? <p className="status status-error" role="status">{evidence.error.summary} <strong>Safe next action:</strong> {evidence.error.safeNextAction}</p> : null}<CurrentBaseResume {...current} evidence={evidence.evidence} /></section>
    <details className="resume-history"><summary>Retained resume history</summary><p>Older imported resumes remain read-only. They do not replace your Current Base Resume.</p><BaseResumeImporter />{legacy.error ? <p className="status status-error" role="status">{legacy.error.summary} <strong>Safe next action:</strong> {legacy.error.safeNextAction}</p> : legacy.resumes.length ? <ul>{legacy.resumes.map((resume) => <li key={resume.id}>{resume.primaryFilename} — imported {new Date(resume.importedAt).toLocaleString()}</li>)}</ul> : <p>No earlier resume imports are retained.</p>}</details>
  </div>;
}
