import { BaseResumeImporter } from "@/app/base-resume-importer";
import { CurrentBaseResume } from "@/app/current-base-resume";
import { ResumeStepper } from "@/app/resume-stepper";
import { listStoredBaseResumes } from "@/domain/base-resume/list-base-resumes";
import { listStoredEvidence } from "@/domain/evidence/list-stored-evidence";
import { listCurrentBaseResume } from "@/domain/current-base-resume/current-base-resume-commands";

const safeError = (error: unknown, fallback: string) => error instanceof Error && "summary" in error && "safeNextAction" in error ? { summary: String(error.summary), safeNextAction: String(error.safeNextAction) } : { summary: fallback, safeNextAction: "Check local workspace storage, then refresh the page." };
export async function ResumeWorkspace() {
  const [legacy, current, evidence] = await Promise.all([
    listStoredBaseResumes().catch((error) => ({ resumes: [], error: safeError(error, "Retained resume history is unavailable.") })),
    listCurrentBaseResume()
      .then((value) => ({ sourceCount: value.sources.length, proposals: value.proposals, versions: value.versions, draft: value.draft, error: undefined }))
      .catch((error) => ({
        sourceCount: 0,
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
    <header className="workspace-header"><p className="eyebrow">Resume</p><h1>Build your resume with confidence</h1><p>Keep your source resume, editable working version, and future tailored materials clearly separate.</p>
      <ResumeStepper />
    </header>
    <section aria-labelledby="resume-current-heading"><h2 id="resume-current-heading">Current Base Resume</h2>{evidence.error ? <p className="status status-error" role="status">{evidence.error.summary} <strong>Safe next action:</strong> {evidence.error.safeNextAction}</p> : null}<CurrentBaseResume {...current} evidence={evidence.evidence} /></section>
    <section aria-labelledby="resume-editable-heading" className="panel"><h2 id="resume-editable-heading">Editable versions</h2><p>Your editable structured draft and approved Current Base Resume versions are shown above. Editing never changes the original PDF source.</p></section>
    <section aria-labelledby="tailored-materials-heading" className="panel"><h2 id="tailored-materials-heading">Tailored materials</h2><p>Tailored materials are not available yet. They will be created as separate reviewed versions and will never replace your Base Resume.</p></section>
    <section aria-labelledby="legacy-resume-heading" className="panel"><h2 id="legacy-resume-heading">Retained resume history</h2><p>Older imported resumes stay as read-only history.</p><BaseResumeImporter />{legacy.error ? <p className="status status-error" role="status">{legacy.error.summary} <strong>Safe next action:</strong> {legacy.error.safeNextAction}</p> : legacy.resumes.length ? <ul>{legacy.resumes.map((resume) => <li key={resume.id}>{resume.primaryFilename} — imported {new Date(resume.importedAt).toLocaleString()}</li>)}</ul> : <p>No earlier resume imports are retained.</p>}</section>
  </div>;
}
