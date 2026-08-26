import Link from "next/link";

import { ResumeProfileForm } from "@/app/resume-profile-form";
import { readCandidateProfileState } from "@/domain/resume-generation/candidate-profile-commands";
import { ResumeCoach } from "@/app/resume-coach";
import { readLocalModelReadiness } from "@/domain/resume-generation/local-model-configuration-commands";
import { resolveAppDataPaths } from "@/files/app-data";
import { applyMigrations, openDatabase } from "@/persistence/database";
import { listApprovedEvidence } from "@/persistence/evidence-repository";
import { listCapturedOpportunities } from "@/domain/opportunities/captured-opportunities";

const safeError = (error: unknown) => error instanceof Error && "summary" in error ? String(error.summary) : "Your saved profile details are unavailable right now.";

export async function ResumeWorkspace() {
  const profile = await readCandidateProfileState().catch((error) => ({ state: { revisionNumber: 0 }, error: safeError(error) }));
  const localModel = await readLocalModelReadiness();
  const materials = await (async () => { const paths = await resolveAppDataPaths(); const db = openDatabase(paths.databasePath); try { applyMigrations(db); return listApprovedEvidence(db).map((item) => ({ id: item.id, label: `${item.sourceDocument} — ${item.sourceSection}` })); } finally { db.close(); } })().catch(() => []);
  const opportunities = await listCapturedOpportunities().then((view) => view.opportunities.map((item) => ({ revisionId: item.revisionId, label: `${item.title} at ${item.company}` }))).catch(() => []);

  return <div className="workspace-shell resume-workspace">
    <header className="resume-page-head">
      <div><p className="eyebrow">Resume</p><h1>Shape your resume</h1><p>Keep your details current before creating a tailored resume.</p></div>
    </header>
    <nav className="resume-view-tabs" aria-label="Resume views"><a href="#resume-edit" aria-current="page">Edit</a><Link href="/evidence">Experience &amp; Projects</Link></nav>
    <section id="resume-edit" className="resume-profile-layout" aria-label="Resume Edit">
      <ResumeCoach available={Boolean(localModel.ready && !("error" in profile) && profile.revision && materials.length)} materials={materials} opportunities={opportunities} />
      <div className="resume-profile-pane">
        {"error" in profile ? <p className="status status-error" role="status">{profile.error}</p> : <ResumeProfileForm profileId={profile.profile?.id} expectedStateRevisionNumber={profile.state.revisionNumber} values={profile.revision?.values} />}
      </div>
    </section>
  </div>;
}
