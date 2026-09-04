import Link from "next/link";
import { redirect } from "next/navigation";
import { BaseResumeImporter } from "@/app/base-resume-importer";
import { ResumeCoach } from "@/app/resume-coach";
import { ResumeWorkspacePicker } from "@/app/resume-workspace-picker";
import { ResumeOnboarding } from "@/app/resume-onboarding";
import { readInitialResumeTemplateContract } from "@/domain/base-resume/resume-template-contract";
import { readCandidateProfileState } from "@/domain/resume-generation/candidate-profile-commands";
import { readLocalModelReadiness } from "@/domain/resume-generation/local-model-configuration-commands";
import { readMaterialDraft } from "@/domain/resume-generation/material-draft-commands";
import { readResumeWorkspaceState } from "@/domain/resume-generation/resume-workspace-commands";
import { resolveAppDataPaths } from "@/files/app-data";
import { applyMigrations, openDatabase } from "@/persistence/database";
import { listCurrentEvidence } from "@/persistence/evidence-repository";
import {
  findLatestWorkspaceMaterialDraftId,
  isLatestWorkspaceMaterialDraftCurrent,
} from "@/persistence/material-draft-repository";
import { listWorkspaceDocumentedEvidenceIds } from "@/persistence/resume-workspace-repository";
import { readLatestResumeGenerationJob } from "@/domain/resume-generation/resume-generation-jobs";
import { readLatestResumeEvidenceIntake } from "@/domain/resume-generation/resume-evidence-intake";

const safeError = (error: unknown) =>
  error instanceof Error && "summary" in error
    ? String(error.summary)
    : "Your saved profile details are unavailable right now.";
export async function ResumeWorkspace() {
  const workspaceState = await readResumeWorkspaceState().catch(() => ({
    workspaces: [],
    activeWorkspace: undefined,
    revisionNumber: 0,
  }));
  const profile = await readCandidateProfileState().catch((error) => ({
    state: { revisionNumber: 0 },
    error: safeError(error),
  }));
  const localModel = await readLocalModelReadiness();
  const baselineReady = await readInitialResumeTemplateContract()
    .then(() => true)
    .catch(() => false);
  const materials = await (async () => {
    if (!workspaceState.activeWorkspace) return [];
    const paths = await resolveAppDataPaths();
    const db = openDatabase(paths.databasePath);
    try {
      applyMigrations(db);
      const allowed = new Set(
        listWorkspaceDocumentedEvidenceIds(
          db,
          workspaceState.activeWorkspace.id,
        ),
      );
      return listCurrentEvidence(db)
        .filter((item) => allowed.has(item.id))
        .map((item) => ({
          id: item.id,
          label: `${item.sourceDocument} — ${item.sourceSection}`,
        }));
    } finally {
      db.close();
    }
  })().catch(() => []);
  const draftState = await (async () => {
    if (
      !workspaceState.activeWorkspace ||
      "error" in profile ||
      !profile.revision
    )
      return { draft: undefined, current: false };
    const paths = await resolveAppDataPaths();
    const db = openDatabase(paths.databasePath);
    let draftId: string | undefined;
    let current = false;
    try {
      applyMigrations(db);
      draftId = findLatestWorkspaceMaterialDraftId(
        db,
        workspaceState.activeWorkspace.id,
      );
      current = isLatestWorkspaceMaterialDraftCurrent(db, {
        workspaceId: workspaceState.activeWorkspace.id,
        profileRevisionId: profile.revision.id,
        evidenceRevisionIds: materials.map((item) => item.id),
      });
    } finally {
      db.close();
    }
    return {
      draft: draftId ? await readMaterialDraft({ draftId }) : undefined,
      current,
    };
  })().catch(() => ({ draft: undefined, current: false }));
  const generationJob = workspaceState.activeWorkspace
    ? await readLatestResumeGenerationJob(
        workspaceState.activeWorkspace.id,
      ).catch(() => undefined)
    : undefined;
  const intake = workspaceState.activeWorkspace
    ? await readLatestResumeEvidenceIntake(
        workspaceState.activeWorkspace.id,
      ).catch(() => undefined)
    : undefined;
  if (
    ["documenting", "interview", "recovery"].includes(
      workspaceState.activeWorkspace?.journey?.phase ?? "",
    )
  )
    redirect("/resume/interview");
  const missing = !workspaceState.activeWorkspace
    ? "Create your first resume workspace, then save your basic profile."
    : !baselineReady
      ? "Import the initial resume.tex that defines your resume template before creating a draft."
      : "error" in profile
        ? profile.error
        : !profile.revision
          ? "Your saved basic information is unavailable. Open a different resume or create a new one."
          : !materials.length
            ? "Open Experience & Projects and document at least one project or experience before creating a resume draft."
            : !localModel.ready
              ? "Local AI is not set up on this computer."
              : undefined;
  const aiMissing = Boolean(
    workspaceState.activeWorkspace &&
      !localModel.ready &&
      !("error" in profile) &&
      profile.revision &&
      materials.length,
  );
  if (!workspaceState.activeWorkspace && workspaceState.workspaces.length === 0)
    return (
      <div className="workspace-shell resume-workspace">
        <header className="resume-page-head">
          <div className="resume-head-copy">
            <p className="eyebrow">Resume</p>
            <h1>Start your resume</h1>
            <p>
              Save your basic information and choose your local work folders to
              document. You can add more folders anytime.
            </p>
          </div>
          <ResumeWorkspacePicker
            workspaces={workspaceState.workspaces}
            activeWorkspaceId={undefined}
            revisionNumber={workspaceState.revisionNumber}
          />
        </header>
        <ResumeOnboarding localAiReady={localModel.ready} />
      </div>
    );
  return (
    <div className="workspace-shell resume-workspace">
      <header className="resume-page-head">
        <div className="resume-head-copy">
          <p className="eyebrow">Resume</p>
          <h1 aria-label="Shape your base resume">Shape your base resume</h1>
          <p>
            Resume Coach is on the left and your automatically generated
            base-resume preview is on the right. Manage{" "}
            <Link href="/evidence">Experience &amp; Projects</Link> separately.
          </p>
        </div>
        <ResumeWorkspacePicker
          workspaces={workspaceState.workspaces}
          activeWorkspaceId={workspaceState.activeWorkspace?.id}
          revisionNumber={workspaceState.revisionNumber}
        />
      </header>
      {!baselineReady ? <BaseResumeImporter /> : null}
      <section id="resume-edit" aria-label="Resume Edit">
        <ResumeCoach
          available={Boolean(
            workspaceState.activeWorkspace &&
              baselineReady &&
              localModel.ready &&
              !("error" in profile) &&
              profile.revision &&
              (materials.length ||
                generationJob?.status === "queued" ||
                generationJob?.status === "running"),
          )}
          unavailableReason={missing}
          showSetupLink={aiMissing}
          initialDraft={draftState.draft}
          generationNeeded={
            !draftState.current &&
            generationJob?.status !== "queued" &&
            generationJob?.status !== "running"
          }
          generationMessage={
            generationJob?.status === "queued" ||
            generationJob?.status === "running"
              ? generationJob.message
              : generationJob?.status === "failed"
                ? generationJob.message
                : undefined
          }
          workspaceId={workspaceState.activeWorkspace?.id}
        />
      </section>
    </div>
  );
}
