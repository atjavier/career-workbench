"use server";

import { initializeWorkspace } from "@/domain/workspace/initialize-workspace";
import { importBaseResume, maximumBaseResumeFiles, maximumBaseResumeFileSize, maximumBaseResumeTotalSize } from "@/domain/base-resume/import-base-resume";
import { toSafeWorkspaceError, WorkspaceError } from "@/domain/workspace/types";
import { revalidatePath } from "next/cache";
import { addManualEvidence, approveEvidence, editEvidence, extractEvidenceFromBaseResume, rejectEvidence, removeEvidence, recordEvidenceFailure } from "@/domain/evidence/evidence-commands";
import { cleanupExpiredTrash, createActivityHistoryExport, createLocalBackup, permanentlyDeleteBackup, recordDataStorageFailure, restoreActivityHistoryExport, trashActivityHistoryExport } from "@/domain/data-storage/data-storage";
import { addExperienceToEvidenceLibrary, addProjectToEvidenceLibrary, recordEvidenceLibraryFailure, refreshEvidenceLibrary } from "@/domain/evidence/evidence-library";
import { documentWithLocalModel } from "@/adapters/evidence-documenter/lm-studio-documenter";
import { documentFolderForResume, recordDocumenterFailure, resolveDocumenterProposal } from "@/domain/evidence/evidence-documenter";
import { approveCurrentBaseResumeVersion, generateCurrentBaseResumeProposals, importCurrentBaseResume, resolveCurrentBaseResumeProposal, saveCurrentBaseResumeDraft } from "@/domain/current-base-resume/current-base-resume-commands";
import { maximumCurrentResumeText, type ResumeDraftContent } from "@/adapters/resume-parser/pdf-text-parser";
import { saveJobPreferences, type Country, type RoleIntent, type WorkStyle } from "@/domain/discovery/job-preferences";
import { createManualCareersPageSource, saveSourceConfiguration, type SourceAccessPath, type SourceType } from "@/domain/discovery/source-configurations";
import { startRefreshRun } from "@/domain/discovery/refresh-runs";

export type WorkspaceActionState = {
  status: "idle" | "success" | "error";
  summary: string;
  safeNextAction?: string;
};

export async function initializeWorkspaceAction(): Promise<WorkspaceActionState> {
  try {
    const result = await initializeWorkspace();
    return {
      status: "success",
      summary: result.initialization === "created" ? "Private local workspace created." : "Private local workspace validated.",
    };
  } catch (error) {
    const safeError = toSafeWorkspaceError(error);
    return { status: "error", summary: safeError.summary, safeNextAction: safeError.safeNextAction };
  }
}

export async function jobPreferencesAction(_: WorkspaceActionState, formData: FormData): Promise<WorkspaceActionState> {
  try {
    await saveJobPreferences({
      expectedRevisionId: String(formData.get("expectedRevisionId") ?? "") || undefined,
      values: {
        roleIntents: formData.getAll("roleIntent").map(String) as RoleIntent[],
        country: String(formData.get("country") ?? "") as Country,
        workStyleOrder: ["workStyleFirst", "workStyleSecond", "workStyleThird"].map((name) => String(formData.get(name) ?? "")) as WorkStyle[],
        preferNcrHybridOnsite: formData.get("preferNcrHybridOnsite") === "yes",
      },
    });
    revalidatePath("/");
    return { status: "success", summary: "Search Preferences were saved locally." };
  } catch (error) {
    const safeError = toSafeWorkspaceError(error);
    return { status: "error", summary: safeError.summary, safeNextAction: safeError.safeNextAction };
  }
}

export async function sourceConfigurationAction(_: WorkspaceActionState, formData: FormData): Promise<WorkspaceActionState> {
  try {
    await saveSourceConfiguration({
      sourceId: String(formData.get("sourceId") ?? "") || undefined,
      expectedRevisionId: String(formData.get("expectedRevisionId") ?? "") || undefined,
      values: {
        name: String(formData.get("name") ?? ""), sourceType: String(formData.get("sourceType") ?? "") as SourceType, url: String(formData.get("url") ?? ""), accessPath: String(formData.get("accessPath") ?? "") as SourceAccessPath, policyRevision: String(formData.get("policyRevision") ?? ""), policyReviewedOn: String(formData.get("policyReviewedOn") ?? ""), policyApproved: formData.get("policyApproved") === "yes", requestBudget: Number(formData.get("requestBudget") ?? Number.NaN), rateLimitPerMinute: Number(formData.get("rateLimitPerMinute") ?? Number.NaN), retentionRule: String(formData.get("retentionRule") ?? ""), enabled: formData.get("enabled") === "yes", failureGuidance: String(formData.get("failureGuidance") ?? ""),
      },
    });
    revalidatePath("/");
    return { status: "success", summary: "Permitted Source was saved locally. No retrieval was performed." };
  } catch (error) {
    const safeError = toSafeWorkspaceError(error);
    return { status: "error", summary: safeError.summary, safeNextAction: safeError.safeNextAction };
  }
}

export async function careersPageUrlAction(_: WorkspaceActionState, formData: FormData): Promise<WorkspaceActionState> {
  try {
    await saveSourceConfiguration({ values: createManualCareersPageSource(formData.get("careersPageUrl")) });
    revalidatePath("/");
    return { status: "success", summary: "Careers page saved locally. It was not opened or scanned.", safeNextAction: "Use the normal browser page when you are ready, or edit the saved source details below." };
  } catch (error) {
    const safeError = toSafeWorkspaceError(error);
    return { status: "error", summary: safeError.summary, safeNextAction: safeError.safeNextAction };
  }
}

export async function sourceRefreshAction(_: WorkspaceActionState, formData: FormData): Promise<WorkspaceActionState> {
  try {
    const result = await startRefreshRun({ sourceIds: formData.getAll("sourceId").map(String), confirmed: formData.get("confirmed") === "yes" });
    revalidatePath("/");
    return { status: "success", summary: `Bounded Refresh Run ${result.status}. ${result.outcomes.length} source outcome${result.outcomes.length === 1 ? "" : "s"} recorded locally.` };
  } catch (error) {
    const safeError = toSafeWorkspaceError(error);
    return { status: "error", summary: safeError.summary, safeNextAction: safeError.safeNextAction };
  }
}

export async function importBaseResumeAction(_: WorkspaceActionState, formData: FormData): Promise<WorkspaceActionState> {
  try {
    const files = formData.getAll("baseResumeFiles").filter((value): value is File => value instanceof File);
    if (files.length > maximumBaseResumeFiles || files.some((file) => file.size === 0 || file.size > maximumBaseResumeFileSize) || files.reduce((total, file) => total + file.size, 0) > maximumBaseResumeTotalSize) {
      const affected = files.find((file) => file.size === 0 || file.size > maximumBaseResumeFileSize) ?? files[maximumBaseResumeFiles] ?? files[0];
      throw new WorkspaceError("BASE_RESUME_INVALID", `The selected file ${affected?.name ?? "selection"} cannot be imported.`, "Choose no more than 12 readable supported files within the import size limit.");
    }
    const importFiles = await Promise.all(files.map(async (file) => ({ name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) })));
    const result = await importBaseResume({ files: importFiles });
    revalidatePath("/");
    return { status: "success", summary: `${result.baseResume.primaryFilename} was imported as a read-only Base Resume.` };
  } catch (error) {
    const safeError = toSafeWorkspaceError(error);
    return { status: "error", summary: safeError.summary, safeNextAction: safeError.safeNextAction };
  }
}

function draftFromForm(formData: FormData): ResumeDraftContent {
  const read = (name: string) => { const value = String(formData.get(name) ?? ""); if (value.length > maximumCurrentResumeText) throw new WorkspaceError("CURRENT_BASE_RESUME_INVALID", "The Current Base Resume draft is too large.", "Shorten the draft and try again."); return value.split("\n").map((line) => line.trim()).filter(Boolean); };
  return { contact: read("contact"), summary: read("summary"), experience: read("experience"), projects: read("projects"), education: read("education"), skills: read("skills"), other: read("other") };
}

export async function currentBaseResumeAction(_: WorkspaceActionState, formData: FormData): Promise<WorkspaceActionState> {
  try {
    const command = String(formData.get("currentResumeCommand") ?? "");
    if (command === "import") {
      const file = formData.get("currentResumePdf");
      if (!(file instanceof File)) throw new WorkspaceError("CURRENT_BASE_RESUME_INVALID", "Choose one resume PDF to import.", "Choose a text-readable PDF and try again.");
      await importCurrentBaseResume({ filename: file.name, bytes: new Uint8Array(await file.arrayBuffer()) });
    } else if (command === "save") await saveCurrentBaseResumeDraft({ draftId: String(formData.get("draftId") ?? ""), content: draftFromForm(formData) });
    else if (command === "propose") await generateCurrentBaseResumeProposals({ draftId: String(formData.get("draftId") ?? "") });
    else if (command === "resolve") { const decision = String(formData.get("decision") ?? ""); if (decision !== "approved" && decision !== "edited" && decision !== "rejected") throw new WorkspaceError("CURRENT_BASE_RESUME_INVALID", "The proposed change decision is unavailable.", "Choose approve, save edited, or reject and try again."); await resolveCurrentBaseResumeProposal({ proposalId: String(formData.get("proposalId") ?? ""), expectedDecisionRevisionId: String(formData.get("expectedDecisionRevisionId") ?? ""), decision, text: String(formData.get("proposalText") ?? "") || undefined }); }
    else if (command === "approve-version") await approveCurrentBaseResumeVersion({ draftId: String(formData.get("draftId") ?? ""), explicitApproval: formData.get("explicitApproval") === "yes" });
    else throw new WorkspaceError("CURRENT_BASE_RESUME_INVALID", "The requested Current Base Resume action is unavailable.", "Choose a Current Base Resume action and try again.");
    revalidatePath("/");
    return { status: "success", summary: "Current Base Resume action completed." };
  } catch (error) {
    const safeError = toSafeWorkspaceError(error);
    return { status: "error", summary: safeError.summary, safeNextAction: safeError.safeNextAction };
  }
}

export async function evidenceAction(_: WorkspaceActionState, formData: FormData): Promise<WorkspaceActionState> {
  try {
    const command = String(formData.get("evidenceCommand") ?? "");
    const evidenceId = String(formData.get("evidenceId") ?? "");
    const expectedRevisionId = String(formData.get("expectedRevisionId") ?? "");
    if (command === "add") await addManualEvidence({ factualText: String(formData.get("factualText") ?? ""), sourceDocument: String(formData.get("sourceDocument") ?? ""), sourceSection: String(formData.get("sourceSection") ?? "") });
    else if (command === "extract") await extractEvidenceFromBaseResume({ baseResumeId: String(formData.get("baseResumeId") ?? "") });
    else if (command === "approve") await approveEvidence({ evidenceId, expectedRevisionId });
    else if (command === "reject") await rejectEvidence({ evidenceId, expectedRevisionId });
    else if (command === "remove") await removeEvidence({ evidenceId, expectedRevisionId });
    else if (command === "edit") await editEvidence({ evidenceId, expectedRevisionId, factualText: String(formData.get("factualText") ?? "") });
    else throw new WorkspaceError("EVIDENCE_INVALID", "The requested evidence action is unavailable.", "Choose an individual evidence action and try again.");
    revalidatePath("/");
    return { status: "success", summary: "Evidence review action completed." };
  } catch (error) { await recordEvidenceFailure().catch(() => undefined); const safeError = toSafeWorkspaceError(error); return { status: "error", summary: safeError.summary, safeNextAction: safeError.safeNextAction }; }
}

export async function evidenceLibraryAction(_: WorkspaceActionState, formData: FormData): Promise<WorkspaceActionState> {
  try {
    const command = String(formData.get("libraryCommand") ?? "");
    let result;
    if (command === "add-project") result = await addProjectToEvidenceLibrary({ sourceDirectory: String(formData.get("sourceDirectory") ?? ""), name: String(formData.get("projectName") ?? "") || undefined });
    else if (command === "add-experience") {
      const selected = formData.get("experienceFile");
      if (selected instanceof File && selected.size > 0 && (!selected.name.toLowerCase().endsWith(".md") || selected.size > 2 * 1024 * 1024)) throw new WorkspaceError("EVIDENCE_LIBRARY_INVALID", "The selected experience document is unavailable or unsupported.", "Choose one readable Markdown file up to 2 MB and try again.");
      const markdown = selected instanceof File && selected.size > 0 ? new TextDecoder("utf-8", { fatal: true }).decode(await selected.arrayBuffer()) : String(formData.get("markdown") ?? "");
      result = await addExperienceToEvidenceLibrary({ name: String(formData.get("experienceName") ?? ""), markdown });
    }
    else if (command === "document-for-resume") {
      const proposals = await documentFolderForResume({ sourceDirectory: String(formData.get("sourceDirectory") ?? ""), disclosed: formData.get("localModelDisclosure") === "yes", document: documentWithLocalModel });
      revalidatePath("/");
      return { status: "success", summary: `${proposals.length} review-only evidence proposal${proposals.length === 1 ? "" : "s"} generated. Decide each item individually.` };
    }
    else if (command === "resolve-document-proposal") {
      const decision = String(formData.get("decision") ?? "");
      if (decision !== "accepted" && decision !== "edited" && decision !== "rejected") throw new WorkspaceError("EVIDENCE_DOCUMENTER_INVALID", "The proposal decision is unavailable.", "Choose accept, save edited, or reject for this proposal.");
      await resolveDocumenterProposal({ proposalId: String(formData.get("proposalId") ?? ""), expectedRevisionId: String(formData.get("expectedRevisionId") ?? ""), decision, factualText: String(formData.get("factualText") ?? "") || undefined });
      revalidatePath("/");
      return { status: "success", summary: "Proposal decision recorded. Accepted evidence remains unreviewed." };
    }
    else if (command === "refresh") result = await refreshEvidenceLibrary();
    else throw new WorkspaceError("EVIDENCE_LIBRARY_INVALID", "The requested library action is unavailable.", "Choose Add Project, Add Experience, or Refresh Library and try again.");
    revalidatePath("/");
    return { status: "success", summary: `${result!.documentsAdded} document${result!.documentsAdded === 1 ? "" : "s"} and ${result!.candidatesAdded} unreviewed evidence candidate${result!.candidatesAdded === 1 ? "" : "s"} were added.` };
  } catch (error) {
    const command = String(formData.get("libraryCommand") ?? "");
    if (command === "document-for-resume" || command === "resolve-document-proposal") await recordDocumenterFailure().catch(() => undefined);
    else await recordEvidenceLibraryFailure().catch(() => undefined);
    const safeError = toSafeWorkspaceError(error);
    return { status: "error", summary: safeError.summary, safeNextAction: safeError.safeNextAction };
  }
}

export async function dataStorageAction(_: WorkspaceActionState, formData: FormData): Promise<WorkspaceActionState> {
  const artifactId = String(formData.get("artifactId") ?? "");
  try {
    const command = String(formData.get("dataCommand") ?? "");
    const input = { artifactId, expectedRevision: Number(formData.get("expectedRevision") ?? 0), confirmed: formData.get("confirmed") === "yes" };
    if (command === "backup") await createLocalBackup();
    else if (command === "history-export") await createActivityHistoryExport();
    else if (command === "trash") await trashActivityHistoryExport(input);
    else if (command === "restore") await restoreActivityHistoryExport(input);
    else if (command === "permanent-delete") await permanentlyDeleteBackup(input);
    else if (command === "cleanup") await cleanupExpiredTrash({ confirmed: input.confirmed });
    else throw new WorkspaceError("DATA_ARTIFACT_INVALID", "The requested data action is unavailable.", "Choose a Data & Storage action and try again.");
    revalidatePath("/");
    return { status: "success", summary: "Local data action completed." };
  } catch (error) {
    await recordDataStorageFailure({ artifactId });
    const safeError = toSafeWorkspaceError(error);
    return { status: "error", summary: safeError.summary, safeNextAction: safeError.safeNextAction };
  }
}
