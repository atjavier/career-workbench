"use server";
import { revalidatePath } from "next/cache";
import { retryClarificationPlanning } from "@/application/resume-generation/retry-clarification-planning";

import { documentWithLocalModel } from "@/adapters/evidence-documenter/lm-studio-documenter";
import { documentFolderForResume, recordDocumenterFailure, resolveDocumenterProposal } from "@/application/evidence/evidence-documenter";
import { addExperienceToEvidenceLibrary, addProjectToEvidenceLibrary, documentResumeEvidenceFolder, importDocumentedEvidenceArtifacts, permanentlyDeleteDocumentedEvidenceItem, recordEvidenceLibraryFailure, refreshEvidenceLibrary, resolveCollectionReviewHandle } from "@/application/evidence/evidence-library";
import { readLatestResumeEvidenceIntake } from "@/application/resume-generation/resume-evidence-intake";
import { interpretWorkspaceEvidence } from "@/application/resume-generation/resume-evidence-interpretation";
import { addManualEvidence, approveEvidence, editEvidence, extractEvidenceFromBaseResume, recordEvidenceFailure, rejectEvidence, removeEvidence } from "@/domain/evidence/evidence-commands";
import { readResumeWorkspaceState } from "@/domain/resume-generation/resume-workspace-commands";
import { reconcileResumeWorkspaceJourney } from "@/domain/resume-generation/resume-workspace-journey";
import { toSafeWorkspaceError, WorkspaceError } from "@/domain/workspace/types";
import { resolveAppDataPaths } from "@/files/app-data";
import { applyMigrations, openDatabase } from "@/persistence/database";
import { readActiveResumeWorkspace } from "@/persistence/resume-workspace-repository";
import { revalidateCareerWorkspaces } from "./action-helpers";
import type { WorkspaceActionState } from "./action-state";

export async function retryClarificationPlanningAction(_: WorkspaceActionState, formData: FormData): Promise<WorkspaceActionState> {
  try {
    await retryClarificationPlanning(String(formData.get("workspaceId") ?? ""));
    revalidateCareerWorkspaces();
    revalidatePath("/resume/interview");
    return { status: "success", summary: "Questions prepared from your saved evidence.", nextUrl: "/resume/interview" };
  } catch (error) {
    const safe = toSafeWorkspaceError(error);
    return { status: "error", summary: safe.summary, safeNextAction: safe.safeNextAction };
  }
}

export async function readResumeEvidenceIntakeStatusAction(
  workspaceId: string,
): Promise<{
  status: "queued" | "running" | "ready" | "failed" | "idle";
  message: string;
  isComplete: boolean;
  failed: boolean;
}> {
  try {
    const intake = await readLatestResumeEvidenceIntake(workspaceId);
    const workspaceState = await readResumeWorkspaceState().catch(
      () => undefined,
    );
    const phase = workspaceState?.activeWorkspace?.journey?.phase;
    const isReady =
      intake?.status === "ready" ||
      phase === "interview" ||
      phase === "ready_to_generate" ||
      phase === "ready_for_preview";
    const isFailed = intake?.status === "failed";
    return {
      status: intake?.status ?? (isReady ? "ready" : "running"),
      message:
        intake?.message ??
        (isReady
          ? "Your evidence is documented and ready."
          : "Reading your selected local folders and documenting resume evidence."),
      isComplete: Boolean(isReady),
      failed: Boolean(isFailed),
    };
  } catch {
    return {
      status: "running",
      message:
        "Reading your selected local folders and documenting resume evidence.",
      isComplete: false,
      failed: false,
    };
  }
}

export async function evidenceAction(
  _: WorkspaceActionState,
  formData: FormData,
): Promise<WorkspaceActionState> {
  try {
    const command = String(formData.get("evidenceCommand") ?? "");
    let evidenceId = String(formData.get("evidenceId") ?? "");
    let expectedRevisionId = String(formData.get("expectedRevisionId") ?? "");
    const reviewHandle = String(formData.get("reviewHandle") ?? "");
    if (
      reviewHandle &&
      (command === "approve" || command === "reject" || command === "remove")
    ) {
      ({ evidenceId, expectedRevisionId } =
        await resolveCollectionReviewHandle(reviewHandle));
    }
    if (command === "add")
      await addManualEvidence({
        factualText: String(formData.get("factualText") ?? ""),
        sourceDocument: String(formData.get("sourceDocument") ?? ""),
        sourceSection: String(formData.get("sourceSection") ?? ""),
      });
    else if (command === "extract")
      await extractEvidenceFromBaseResume({
        baseResumeId: String(formData.get("baseResumeId") ?? ""),
      });
    else if (command === "approve")
      await approveEvidence({ evidenceId, expectedRevisionId });
    else if (command === "reject")
      await rejectEvidence({ evidenceId, expectedRevisionId });
    else if (command === "remove")
      await removeEvidence({ evidenceId, expectedRevisionId });
    else if (command === "edit")
      await editEvidence({
        evidenceId,
        expectedRevisionId,
        factualText: String(formData.get("factualText") ?? ""),
      });
    else
      throw new WorkspaceError(
        "EVIDENCE_INVALID",
        "The requested evidence action is unavailable.",
        "Choose an individual evidence action and try again.",
      );
    revalidateCareerWorkspaces();
    return { status: "success", summary: "Evidence review action completed." };
  } catch (error) {
    await recordEvidenceFailure().catch(() => undefined);
    const safeError = toSafeWorkspaceError(error);
    return {
      status: "error",
      summary: safeError.summary,
      safeNextAction: safeError.safeNextAction,
    };
  }
}

export async function evidenceLibraryAction(
  _: WorkspaceActionState,
  formData: FormData,
): Promise<WorkspaceActionState> {
  try {
    const command = String(formData.get("libraryCommand") ?? "");
    let result;
    let documentedWorkspaceId: string | undefined;
    if (command === "document-source-folder") {
      const category = String(formData.get("category") ?? "");
      if (category !== "project" && category !== "experience")
        throw new WorkspaceError(
          "EVIDENCE_DOCUMENTER_INVALID",
          "Choose Projects or Experiences before documenting a folder.",
          "Select a work type and try the documentation again.",
        );
      const sourceDirectory = String(
        formData.get("sourceDirectory") ?? "",
      ).trim();
      if (!sourceDirectory)
        throw new WorkspaceError(
          "EVIDENCE_DOCUMENTER_INVALID",
          "Choose a local folder before documenting it.",
          "Use Browse local folder, then try the documentation again.",
        );
      const paths = await resolveAppDataPaths();
      const database = openDatabase(paths.databasePath);
      let expectedWorkspaceId: string;
      try {
        applyMigrations(database);
        const workspace = readActiveResumeWorkspace(database).workspace;
        if (!workspace)
          throw new WorkspaceError(
            "RESUME_WORKSPACE_NOT_FOUND",
            "Create a resume workspace before documenting a folder.",
            "Open Resume and create the workspace that should own this work.",
          );
        expectedWorkspaceId = workspace.id;
      } finally {
        database.close();
      }
      const itemName =
        String(formData.get("itemName") ?? "").trim() ||
        String(formData.get("projectName") ?? "").trim() ||
        String(formData.get("company") ?? "").trim() ||
        String(formData.get("role") ?? "").trim();
      result = await documentResumeEvidenceFolder({
        category,
        name: itemName,
        sourceDirectory,
        expectedWorkspaceId: expectedWorkspaceId!,
        disclosed: formData.get("localModelDisclosure") === "yes",
        candidateContext: { role: String(formData.get("role") ?? ""), startDate: String(formData.get("startDate") ?? ""), endDate: String(formData.get("endDate") ?? "") },
      });
      documentedWorkspaceId = expectedWorkspaceId;
    } else if (command === "delete-documented-item") {
      const category = String(formData.get("category") ?? "");
      if (category !== "project" && category !== "experience")
        throw new WorkspaceError(
          "EVIDENCE_LIBRARY_INVALID",
          "Choose a project or experience to delete.",
          "Refresh Experience & Projects and try again.",
        );
      const deleted = await permanentlyDeleteDocumentedEvidenceItem({
        category,
        name: String(formData.get("itemName") ?? ""),
        confirmation: String(formData.get("confirmation") ?? ""),
      });
      let nextUrl: string | undefined;
      let safeNextAction: string | undefined;
      const paths = await resolveAppDataPaths();
      const db = openDatabase(paths.databasePath);
      try {
        applyMigrations(db);
        const workspace = readActiveResumeWorkspace(db).workspace;
        if (workspace) {
          await reconcileResumeWorkspaceJourney(workspace.id);
          nextUrl = "/resume";
          safeNextAction =
            "You can generate an updated resume in Resume Preview whenever you want.";
        }
      } finally {
        db.close();
      }
      revalidateCareerWorkspaces();
      return {
        status: "success",
        nextUrl,
        safeNextAction,
        summary: deleted.artifactCleanupIncomplete
          ? `${deleted.findingsDeleted} documented finding${deleted.findingsDeleted === 1 ? "" : "s"} deleted. Close programs using the managed evidence folder to finish removing its files.`
          : `${deleted.findingsDeleted} documented finding${deleted.findingsDeleted === 1 ? "" : "s"} and this ${category} were permanently deleted.`,
      };
    } else if (command === "import-documentation-artifacts") {
      const category = String(formData.get("category") ?? "");
      if (category !== "project" && category !== "experience")
        throw new WorkspaceError(
          "EVIDENCE_LIBRARY_INVALID",
          "Choose Projects or Experiences before importing generated documents.",
          "Select a work type and try the import again.",
        );
      const paths = await resolveAppDataPaths();
      const database = openDatabase(paths.databasePath);
      let expectedWorkspaceId: string;
      try {
        applyMigrations(database);
        const workspace = readActiveResumeWorkspace(database).workspace;
        if (!workspace)
          throw new WorkspaceError(
            "RESUME_WORKSPACE_NOT_FOUND",
            "Create a resume workspace before importing generated documents.",
            "Open Resume and create the workspace that should own this work.",
          );
        expectedWorkspaceId = workspace.id;
      } finally {
        database.close();
      }
      result = await importDocumentedEvidenceArtifacts({
        category,
        name: String(formData.get("itemName") ?? ""),
        outputDirectory: String(formData.get("outputDirectory") ?? ""),
        expectedWorkspaceId: expectedWorkspaceId!,
      });
      documentedWorkspaceId = expectedWorkspaceId;
    } else if (command === "add-project") {
      const paths = await resolveAppDataPaths();
      const database = openDatabase(paths.databasePath);
      let expectedWorkspaceId: string;
      try {
        applyMigrations(database);
        const workspace = readActiveResumeWorkspace(database).workspace;
        if (!workspace)
          throw new WorkspaceError(
            "RESUME_WORKSPACE_NOT_FOUND",
            "Create a resume workspace before adding a project.",
            "Open Resume and create the workspace that should own this work.",
          );
        expectedWorkspaceId = workspace.id;
      } finally {
        database.close();
      }
      result = await addProjectToEvidenceLibrary({
        expectedWorkspaceId: expectedWorkspaceId!,
        sourceDirectory: String(formData.get("sourceDirectory") ?? ""),
        name: String(formData.get("projectName") ?? "") || undefined,
      });
      documentedWorkspaceId = expectedWorkspaceId;
    } else if (command === "add-experience") {
      const selected = formData.get("experienceFile");
      if (
        selected instanceof File &&
        selected.size > 0 &&
        (!selected.name.toLowerCase().endsWith(".md") ||
          selected.size > 2 * 1024 * 1024)
      )
        throw new WorkspaceError(
          "EVIDENCE_LIBRARY_INVALID",
          "The selected experience document is unavailable or unsupported.",
          "Choose one readable Markdown file up to 2 MB and try again.",
        );
      const markdown =
        selected instanceof File && selected.size > 0
          ? new TextDecoder("utf-8", { fatal: true }).decode(
              await selected.arrayBuffer(),
            )
          : String(formData.get("markdown") ?? "");
      const paths = await resolveAppDataPaths();
      const database = openDatabase(paths.databasePath);
      let expectedWorkspaceId: string;
      try {
        applyMigrations(database);
        const workspace = readActiveResumeWorkspace(database).workspace;
        if (!workspace)
          throw new WorkspaceError(
            "RESUME_WORKSPACE_NOT_FOUND",
            "Create a resume workspace before adding experience.",
            "Open Resume and create the workspace that should own this work.",
          );
        expectedWorkspaceId = workspace.id;
      } finally {
        database.close();
      }
      result = await addExperienceToEvidenceLibrary({
        expectedWorkspaceId: expectedWorkspaceId!,
        name: String(formData.get("experienceName") ?? ""),
        markdown,
      });
      documentedWorkspaceId = expectedWorkspaceId;
    } else if (command === "document-for-resume") {
      const proposals = await documentFolderForResume({
        sourceDirectory: String(formData.get("sourceDirectory") ?? ""),
        disclosed: formData.get("localModelDisclosure") === "yes",
        document: documentWithLocalModel,
      });
      revalidateCareerWorkspaces();
      return {
        status: "success",
        summary: `${proposals.length} review-only evidence proposal${proposals.length === 1 ? "" : "s"} generated. Decide each item individually.`,
      };
    } else if (command === "resolve-document-proposal") {
      const decision = String(formData.get("decision") ?? "");
      if (
        decision !== "accepted" &&
        decision !== "edited" &&
        decision !== "rejected"
      )
        throw new WorkspaceError(
          "EVIDENCE_DOCUMENTER_INVALID",
          "The proposal decision is unavailable.",
          "Choose accept, save edited, or reject for this proposal.",
        );
      await resolveDocumenterProposal({
        proposalId: String(formData.get("proposalId") ?? ""),
        expectedRevisionId: String(formData.get("expectedRevisionId") ?? ""),
        decision,
        factualText: String(formData.get("factualText") ?? "") || undefined,
      });
      revalidateCareerWorkspaces();
      return {
        status: "success",
        summary:
          "Proposal decision recorded. Accepted evidence remains unreviewed.",
      };
    } else if (command === "refresh") result = await refreshEvidenceLibrary();
    else
      throw new WorkspaceError(
        "EVIDENCE_LIBRARY_INVALID",
        "The requested library action is unavailable.",
        "Document a source folder, then import its generated review documents.",
      );
    // Documentation is only the evidence stage.  Immediately interpret the
    // curated artifacts for the same still-active workspace so new facts reopen
    // its clarification interview instead of leaving a stale ready/draft state.
    if (documentedWorkspaceId && !(await interpretWorkspaceEvidence(documentedWorkspaceId))) {
      throw new WorkspaceError("RESUME_WORKSPACE_STALE", "Evidence changed while questions were being prepared.", "Return to the current workspace and read the evidence again.");
    }
    revalidateCareerWorkspaces();
    let nextUrl: string | undefined;
    let safeNextAction: string | undefined;
    let journeyPhase: string | undefined;
    if (documentedWorkspaceId) {
      const journey = await reconcileResumeWorkspaceJourney(
        documentedWorkspaceId,
      );
      journeyPhase = journey?.phase;
      if (journeyPhase === "interview") {
        nextUrl = "/resume/interview";
        safeNextAction = "Answer clarification questions in Coach Q&A.";
      } else {
        nextUrl = "/resume";
        safeNextAction = "Go to Resume to regenerate your draft.";
      }
    }
    return {
      status: "success",
      workspaceId: documentedWorkspaceId,
      nextUrl,
      safeNextAction,
      summary:
        journeyPhase === "interview"
          ? `${result!.documentsAdded} document${result!.documentsAdded === 1 ? "" : "s"} added. Coach Resume has clarification questions ready.`
          : `${result!.documentsAdded} document${result!.documentsAdded === 1 ? "" : "s"} and ${result!.candidatesAdded} unreviewed evidence candidate${result!.candidatesAdded === 1 ? "" : "s"} were added.`,
    };
  } catch (error) {
    const command = String(formData.get("libraryCommand") ?? "");
    if (
      command === "document-for-resume" ||
      command === "document-source-folder" ||
      command === "resolve-document-proposal"
    )
      await recordDocumenterFailure().catch(() => undefined);
    else await recordEvidenceLibraryFailure().catch(() => undefined);
    const safeError = toSafeWorkspaceError(error);
    return {
      status: "error",
      summary: safeError.summary,
      safeNextAction: safeError.safeNextAction,
    };
  }
}
