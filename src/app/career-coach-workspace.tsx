import Link from "next/link";
import { CareerCoachChat } from "@/app/career-coach-chat";
import { ResumeWorkspacePicker } from "@/app/resume-workspace-picker";
import { readCandidateProfileState } from "@/domain/resume-generation/candidate-profile-commands";
import { readLocalModelReadiness } from "@/domain/resume-generation/local-model-configuration-commands";
import { readMaterialDraft } from "@/domain/resume-generation/material-draft-commands";
import { readResumeWorkspaceState } from "@/domain/resume-generation/resume-workspace-commands";
import { resolveAppDataPaths } from "@/files/app-data";
import { applyMigrations, openDatabase } from "@/persistence/database";
import { findLatestWorkspaceMaterialDraftId } from "@/persistence/material-draft-repository";

export async function CareerCoachWorkspace() {
  const workspaceState = await readResumeWorkspaceState().catch(() => ({
    workspaces: [],
    activeWorkspace: undefined,
    revisionNumber: 0,
  }));
  const profile = await readCandidateProfileState().catch(() => ({
    state: { revisionNumber: 0 },
    error: "Your saved profile is unavailable.",
  }));
  const localModel = await readLocalModelReadiness();

  const draft = await (async () => {
    if (!workspaceState.activeWorkspace) return undefined;
    const paths = await resolveAppDataPaths();
    const db = openDatabase(paths.databasePath);
    try {
      applyMigrations(db);
      const draftId = findLatestWorkspaceMaterialDraftId(
        db,
        workspaceState.activeWorkspace.id,
      );
      return draftId ? await readMaterialDraft({ draftId }) : undefined;
    } finally {
      db.close();
    }
  })().catch(() => undefined);

  const available = Boolean(
    workspaceState.activeWorkspace &&
      localModel.ready &&
      !("error" in profile) &&
      profile.revision &&
      draft,
  );

  const unavailableReason = !workspaceState.activeWorkspace
    ? "Create your first resume workspace and complete onboarding to use Career Coach."
    : !localModel.ready
      ? "Local AI is not set up on this computer."
      : "error" in profile || !profile.revision
        ? "Your saved profile details are unavailable."
        : !draft
          ? "Generate your base resume before asking Career Coach."
          : undefined;

  return (
    <div className="workspace-shell resume-workspace career-coach-workspace">
      <header className="resume-page-head">
        <div className="resume-head-copy">
          <div className="eyebrow-row">
            <p className="eyebrow">Resume</p>
            <span className="pro-badge-pill" aria-label="Pro Feature">Pro</span>
          </div>
          <h1>Career Coach</h1>
          <p>
            Evidence-backed critique, ATS readability audit, and strategic guidance
            for your engineering career.
          </p>
        </div>
        <ResumeWorkspacePicker
          workspaces={workspaceState.workspaces}
          activeWorkspaceId={workspaceState.activeWorkspace?.id}
          revisionNumber={workspaceState.revisionNumber}
        />
      </header>

      <section id="career-coach-section" aria-label="Career Coach">
        <CareerCoachChat
          available={available}
          unavailableReason={unavailableReason}
          draft={draft}
          workspaceId={workspaceState.activeWorkspace?.id}
        />
      </section>
    </div>
  );
}
