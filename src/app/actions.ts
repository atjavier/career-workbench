"use server";

import { initializeWorkspace } from "@/domain/workspace/initialize-workspace";
import { importBaseResume, maximumBaseResumeFiles, maximumBaseResumeFileSize, maximumBaseResumeTotalSize } from "@/domain/base-resume/import-base-resume";
import { toSafeWorkspaceError, WorkspaceError } from "@/domain/workspace/types";
import { revalidatePath } from "next/cache";
import { addManualEvidence, approveEvidence, editEvidence, extractEvidenceFromBaseResume, rejectEvidence, removeEvidence, recordEvidenceFailure } from "@/domain/evidence/evidence-commands";
import { cleanupExpiredTrash, createActivityHistoryExport, createLocalBackup, permanentlyDeleteBackup, recordDataStorageFailure, restoreActivityHistoryExport, trashActivityHistoryExport } from "@/domain/data-storage/data-storage";
import { addExperienceToEvidenceLibrary, addProjectToEvidenceLibrary, documentResumeEvidenceFolder, importDocumentedEvidenceArtifacts, recordEvidenceLibraryFailure, refreshEvidenceLibrary, resolveCollectionReviewHandle } from "@/domain/evidence/evidence-library";
import { documentWithLocalModel } from "@/adapters/evidence-documenter/lm-studio-documenter";
import { documentFolderForResume, recordDocumenterFailure, resolveDocumenterProposal } from "@/domain/evidence/evidence-documenter";
import { approveCurrentBaseResumeVersion, generateCurrentBaseResumeProposals, importCurrentBaseResume, resolveCurrentBaseResumeProposal, saveCurrentBaseResumeDraft } from "@/domain/current-base-resume/current-base-resume-commands";
import { maximumCurrentResumeText, type ResumeDraftContent } from "@/adapters/resume-parser/pdf-text-parser";
import { saveJobPreferences, type Country, type RoleIntent, type WorkStyle } from "@/domain/discovery/job-preferences";
import { createManualCareersPageSource, saveSourceConfiguration, type SourceAccessPath, type SourceType } from "@/domain/discovery/source-configurations";
import { startRefreshRun } from "@/domain/discovery/refresh-runs";
import { applyDuplicateOverride, importManualJobListing, reverseDuplicateOverride } from "@/domain/discovery/job-listings";
import { calculateAndPersistFitAssessment } from "@/domain/fit/fit-assessment";
import { captureOpportunityDraft, OpportunityCaptureValidationError, type OpportunityCaptureDraft } from "@/domain/opportunities/capture-draft";
import { confirmCapturedOpportunity } from "@/domain/opportunities/captured-opportunities";
import { resolveAppDataPaths } from "@/files/app-data";
import { applyMigrations, openDatabase } from "@/persistence/database";
import { saveCandidateProfile, type CandidateProfileInput } from "@/domain/resume-generation/candidate-profile-commands";
import { requestResumeCoach, resumeCoachConsentFingerprint, type ResumeCoachResponse } from "@/adapters/local-model/local-model-gateway";
import { readLocalModelGatewayConfiguration } from "@/domain/resume-generation/local-model-configuration-commands";
import { configureLocalModel } from "@/domain/resume-generation/local-model-configuration-commands";
import { readCandidateProfileState } from "@/domain/resume-generation/candidate-profile-commands";
import { listApprovedEvidence } from "@/persistence/evidence-repository";
import { appendAuditEvent } from "@/persistence/workspace-repository";
import { createAuditEvent } from "@/audit/audit-event";
import { findDesignatedResumeTemplate } from "@/persistence/resume-template-repository";
import { persistResumeCoachDraft } from "@/domain/resume-generation/resume-coach-commands";
import { findCapturedRevision, listCapturedRevisions, parseStoredRequirements } from "@/persistence/captured-opportunities-repository";
import { handOffMaterialDraft } from "@/domain/resume-generation/material-draft-commands";
import { assessCapturedOpportunity, recordOpportunityDecision, type OpportunityAssessmentView } from "@/domain/fit/ai-opportunity-assessment";

export type WorkspaceActionState = {
  status: "idle" | "success" | "error";
  summary: string;
  safeNextAction?: string;
};

type CandidateProfileField = keyof CandidateProfileInput;
export type CandidateProfileActionState = WorkspaceActionState & { fieldErrors?: Partial<Record<CandidateProfileField, string>> };
export type ResumeCoachActionState = WorkspaceActionState & { response?: ResumeCoachResponse; draftId?: string; evidenceLabels?: string[] };
export type MaterialDraftHandoffActionState = WorkspaceActionState & { draftId?: string };
export type OpportunityAssessmentActionState = WorkspaceActionState & { assessment?: OpportunityAssessmentView; decisionId?: string };

export async function localModelSettingsAction(_: WorkspaceActionState, formData: FormData): Promise<WorkspaceActionState> {
  try {
    await configureLocalModel({ modelIdentifier: String(formData.get("modelIdentifier") ?? ""), token: String(formData.get("token") ?? "") });
    revalidatePath("/settings"); revalidatePath("/resume");
    return { status: "success", summary: "Local AI is ready to use on this computer." };
  } catch (error) { const safe = toSafeWorkspaceError(error); return { status: "error", summary: safe.summary, safeNextAction: safe.safeNextAction }; }
}

export async function opportunityAssessmentAction(_: OpportunityAssessmentActionState, formData: FormData): Promise<OpportunityAssessmentActionState> {
  try {
    const command = String(formData.get("opportunityAssessmentCommand") ?? ""); const opportunityId = String(formData.get("opportunityId") ?? "");
    if (command === "deterministic-fit") { const paths = await resolveAppDataPaths(); const db = openDatabase(paths.databasePath); try { applyMigrations(db); calculateAndPersistFitAssessment(db, opportunityId); } finally { db.close(); } revalidatePath("/"); return { status: "success", summary: "Deterministic fit was calculated from captured requirements, approved evidence, and saved preferences." }; }
    if (command === "assess") { const assessment = await assessCapturedOpportunity({ opportunityId, evidenceIds: [...new Set(formData.getAll("evidenceId").map(String))], consent: formData.get("consent") === "yes" }); revalidatePath("/"); return { status: "success", summary: assessment.cached ? "Your saved local-AI fit assessment is ready." : "Your new local-AI fit assessment is ready.", assessment }; }
    if (command === "decision") { const priority = String(formData.get("priority") ?? ""); if (priority !== "low" && priority !== "normal" && priority !== "high") throw new WorkspaceError("OPPORTUNITY_ASSESSMENT_INVALID", "Choose a valid personal priority.", "Choose low, normal, or high priority and try again."); const decision = await recordOpportunityDecision({ opportunityId, assessmentId: String(formData.get("assessmentId") ?? ""), expectedDecisionId: String(formData.get("expectedDecisionId") ?? "") || undefined, pursue: formData.get("pursue") === "yes", priority }); revalidatePath("/"); return { status: "success", summary: "Your personal opportunity decision was saved.", decisionId: decision.id }; }
    throw new WorkspaceError("OPPORTUNITY_ASSESSMENT_INVALID", "The requested fit action is unavailable.", "Assess fit or save a personal decision again.");
  } catch (error) { const safe = toSafeWorkspaceError(error); return { status: "error", summary: safe.summary, safeNextAction: safe.safeNextAction }; }
}

export async function resumeCoachAction(_: ResumeCoachActionState, formData: FormData): Promise<ResumeCoachActionState> {
  const userRequest = String(formData.get("request") ?? "");
  let auditContext: { databasePath: string; profileRevisionId: string; fingerprint: string } | undefined;
  try {
    if (formData.get("consent") !== "yes") throw new WorkspaceError("RESUME_COACH_INVALID", "Confirm what Resume Coach may read before sending the request.", "Select the local-model consent checkbox and try again.");
    const configured = await readLocalModelGatewayConfiguration();
    const connection = { configurationRevisionId: configured.id, configurationDigest: configured.configurationDigest, modelIdentifier: configured.modelIdentifier, token: configured.token };
    const profile = await readCandidateProfileState(); if (!profile.revision) throw new WorkspaceError("RESUME_COACH_INVALID", "Save your profile details before asking Resume Coach.", "Complete and save your profile details first.");
    const selectedIds = [...new Set(formData.getAll("evidenceId").map(String))];
    const paths = await resolveAppDataPaths(); const db = openDatabase(paths.databasePath); let evidence; let template; let opportunity;
    try {
      applyMigrations(db); evidence = listApprovedEvidence(db); template = findDesignatedResumeTemplate(db);
      const selectedOpportunityRevisionId = String(formData.get("opportunityRevisionId") ?? "");
      if (selectedOpportunityRevisionId) {
        const selectedRevision = findCapturedRevision(db, selectedOpportunityRevisionId);
        const currentRevision = selectedRevision ? listCapturedRevisions(db, selectedRevision.opportunityId).at(-1) : undefined;
        if (!selectedRevision || currentRevision?.id !== selectedRevision.id) throw new WorkspaceError("RESUME_COACH_INVALID", "The selected opportunity is no longer available.", "Choose a current local opportunity and confirm the request again.");
        opportunity = { revisionId: selectedRevision.id, contentDigest: selectedRevision.contentDigest, title: selectedRevision.title, company: selectedRevision.company, requirements: parseStoredRequirements(selectedRevision.requirements), copiedDescription: selectedRevision.copiedDescription };
      }
    } finally { db.close(); }
    if (!template) throw new WorkspaceError("RESUME_COACH_INVALID", "A verified Resume template is required before asking Resume Coach.", "Refresh Resume, then try again.");
    const selected = evidence.filter((item) => selectedIds.includes(item.id)).map(({ id, contentDigest, factualText, sourceDocument, sourceSection }) => ({ id, contentDigest, factualText, label: `Approved evidence: ${sourceDocument} — ${sourceSection}` }));
    if (!selected.length || selected.length !== selectedIds.length) throw new WorkspaceError("RESUME_COACH_INVALID", "Choose at least one currently approved Experience or Projects item.", "Review the approved material selection and try again.");
    const consentNonce = String(formData.get("consentNonce") ?? "");
    const profileSnapshot = profile.revision.canonicalContent;
    const consentFingerprint = resumeCoachConsentFingerprint({ connection, profileRevisionId: profile.revision.id, profileDigest: profile.revision.contentDigest, profileSnapshot, templateId: template.id, templateDigest: template.contentDigest, evidence: selected, opportunity, userRequest, consentNonce });
    if (!consentNonce) throw new WorkspaceError("RESUME_COACH_INVALID", "That local-model consent is unavailable.", "Review the disclosure and confirm the request again.");
    auditContext = { databasePath: paths.databasePath, profileRevisionId: profile.revision.id, fingerprint: consentFingerprint };
    const auditDb = openDatabase(paths.databasePath); try { applyMigrations(auditDb); auditDb.exec("BEGIN IMMEDIATE;"); try { auditDb.prepare("INSERT INTO resume_coach_consent_uses (consent_fingerprint, created_at) VALUES (?, ?)").run(consentFingerprint, new Date().toISOString()); appendAuditEvent(auditDb, createAuditEvent({ actor: "local-os-user", action: "resume.coach_requested", outcome: "success", entityId: profile.revision.id, contentHash: consentFingerprint })); auditDb.exec("COMMIT;"); } catch (error) { auditDb.exec("ROLLBACK;"); if (String(error).includes("UNIQUE constraint failed")) throw new WorkspaceError("RESUME_COACH_INVALID", "That local-model consent has already been used or changed.", "Review the disclosure and confirm the request again."); throw error; } } finally { auditDb.close(); }
    const response = await requestResumeCoach({ connection, profileRevisionId: profile.revision.id, profileDigest: profile.revision.contentDigest, profileSnapshot, templateId: template.id, templateDigest: template.contentDigest, evidence: selected, opportunity, userRequest, consentNonce, consentFingerprint });
    const draft = persistResumeCoachDraft({ databasePath: paths.databasePath, profileRevisionId: profile.revision.id, profileDigest: profile.revision.contentDigest, templateId: template.id, templateDigest: template.contentDigest, evidence: selected, opportunity: opportunity ? { revisionId: opportunity.revisionId, contentDigest: opportunity.contentDigest } : undefined, requestText: userRequest, consentFingerprint, response });
    return { status: "success", summary: "Local AI guidance is ready to review. Your Resume template is unchanged.", response, draftId: draft.id, evidenceLabels: selected.map((item) => item.label) };
  } catch (error) {
    if (auditContext) { const auditDb = openDatabase(auditContext.databasePath); try { appendAuditEvent(auditDb, createAuditEvent({ actor: "local-os-user", action: "resume.coach_failed", outcome: "failure", entityId: auditContext.profileRevisionId, contentHash: auditContext.fingerprint })); } catch { /* Preserve the original safe model error. */ } finally { auditDb.close(); } }
    const safeError = toSafeWorkspaceError(error); return { status: "error", summary: safeError.summary, safeNextAction: safeError.safeNextAction };
  }
}

export async function materialDraftHandoffAction(_: MaterialDraftHandoffActionState, formData: FormData): Promise<MaterialDraftHandoffActionState> {
  const draftId = String(formData.get("draftId") ?? "");
  try {
    await handOffMaterialDraft({ draftId });
    revalidatePath("/resume");
    return { status: "success", summary: "This local draft is ready for review. Your Resume template and Resume.pdf are unchanged.", draftId };
  } catch (error) {
    const safeError = toSafeWorkspaceError(error);
    return { status: "error", summary: safeError.summary, safeNextAction: safeError.safeNextAction };
  }
}

function candidateProfileFieldError(summary: string): CandidateProfileField | undefined {
  const value = summary.toLowerCase();
  if (value.includes("first name")) return "firstName";
  if (value.includes("middle name")) return "middleName";
  if (value.includes("last name")) return "lastName";
  if (value.includes("email")) return "email";
  if (value.includes("phone")) return "phone";
  if (value.includes("school")) return "school";
  if (value.includes("program")) return "program";
  if (value.includes("graduation year")) return "graduationYear";
  if (value.includes("gwa")) return "gwa";
  if (value.includes("latin honors")) return "latinHonors";
  if (value.includes("linkedin")) return "linkedInUrl";
  if (value.includes("github")) return "githubUrl";
  return undefined;
}

export async function saveCandidateProfileAction(_: CandidateProfileActionState, formData: FormData): Promise<CandidateProfileActionState> {
  const expectedStateRevisionNumber = Number(formData.get("expectedStateRevisionNumber"));
  try {
    await saveCandidateProfile({
      profileId: String(formData.get("profileId") ?? "") || undefined,
      expectedStateRevisionNumber: Number.isSafeInteger(expectedStateRevisionNumber) ? expectedStateRevisionNumber : undefined,
      values: {
        firstName: String(formData.get("firstName") ?? ""),
        middleName: String(formData.get("middleName") ?? ""),
        lastName: String(formData.get("lastName") ?? ""),
        email: String(formData.get("email") ?? ""),
        phone: String(formData.get("phone") ?? ""),
        school: String(formData.get("school") ?? ""),
        program: String(formData.get("program") ?? ""),
        graduationYear: String(formData.get("graduationYear") ?? ""),
        gwa: String(formData.get("gwa") ?? ""),
        latinHonors: String(formData.get("latinHonors") ?? ""),
        linkedInUrl: String(formData.get("linkedInUrl") ?? ""),
        githubUrl: String(formData.get("githubUrl") ?? ""),
      },
    });
    revalidatePath("/resume");
    return { status: "success", summary: "Details saved." };
  } catch (error) {
    const safeError = toSafeWorkspaceError(error);
    const field = candidateProfileFieldError(safeError.summary);
    return { status: "error", summary: safeError.summary, safeNextAction: safeError.safeNextAction, fieldErrors: field ? { [field]: safeError.summary } : undefined };
  }
}

export type OpportunityCaptureActionState = {
  status: "idle" | "success" | "error";
  summary: string;
  safeNextAction?: string;
  fieldErrors?: Partial<Record<"postingUrl" | "copiedDescription", string>>;
  submittedPostingUrl?: string;
  submittedCopiedDescription?: string;
  draft?: OpportunityCaptureDraft;
};
export type OpportunityConfirmationActionState = OpportunityCaptureActionState & { fieldErrors?: Partial<Record<"postingUrl" | "copiedDescription" | "title" | "company" | "location" | "workStyle" | "requirements" | "postedAt", string>>; probableDuplicate?: { title: string; company: string; capturedAt: string } };

export async function opportunityCaptureAction(_: OpportunityCaptureActionState, formData: FormData): Promise<OpportunityCaptureActionState> {
  try {
    const draft = captureOpportunityDraft({ postingUrl: formData.get("postingUrl"), copiedDescription: formData.get("copiedDescription") });
    return { status: "success", summary: "Your local capture draft is ready for review. Nothing is saved yet.", draft, submittedPostingUrl: String(formData.get("postingUrl") ?? ""), submittedCopiedDescription: String(formData.get("copiedDescription") ?? "") };
  } catch (error) {
    if (error instanceof OpportunityCaptureValidationError) return { status: "error", summary: error.summary, safeNextAction: error.safeNextAction, fieldErrors: { [error.field]: error.summary } };
    const safeError = toSafeWorkspaceError(error);
    return { status: "error", summary: safeError.summary, safeNextAction: safeError.safeNextAction };
  }
}

export async function opportunityConfirmationAction(_: OpportunityConfirmationActionState, formData: FormData): Promise<OpportunityConfirmationActionState> {
  const submitted = { submittedPostingUrl: String(formData.get("postingUrl") ?? ""), submittedCopiedDescription: String(formData.get("copiedDescription") ?? "") };
  try {
    const result = await confirmCapturedOpportunity({ postingUrl: formData.get("postingUrl"), copiedDescription: formData.get("copiedDescription"), capturedAt: formData.get("capturedAt"), title: formData.get("title"), company: formData.get("company"), location: formData.get("location"), workStyle: formData.get("workStyle"), requirements: formData.get("requirements"), postedAt: formData.get("postedAt") });
    revalidatePath("/");
    return { status: "success", summary: `${result.opportunity.title} at ${result.opportunity.company} was saved locally.`, probableDuplicate: result.probableDuplicate, ...submitted };
  } catch (error) {
    if (error instanceof OpportunityCaptureValidationError) return { status: "error", summary: error.summary, safeNextAction: error.safeNextAction, fieldErrors: { [error.field]: error.summary }, ...submitted };
    const safeError = toSafeWorkspaceError(error); const code = safeError.code;
    const field = code === "OPPORTUNITY_TITLE_INVALID" ? "title" : code === "OPPORTUNITY_COMPANY_INVALID" ? "company" : code === "OPPORTUNITY_LOCATION_INVALID" ? "location" : code === "OPPORTUNITY_WORK_STYLE_INVALID" ? "workStyle" : code === "OPPORTUNITY_REQUIREMENTS_INVALID" ? "requirements" : code === "OPPORTUNITY_POSTED_DATE_INVALID" ? "postedAt" : code === "OPPORTUNITY_CAPTURE_INVALID" ? "postingUrl" : undefined;
    return { status: "error", summary: safeError.summary, safeNextAction: safeError.safeNextAction, fieldErrors: field ? { [field]: safeError.summary } : undefined, ...submitted };
  }
}

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

export async function jobListingsAction(_: WorkspaceActionState, formData: FormData): Promise<WorkspaceActionState> {
  try {
    const command = String(formData.get("jobCommand") ?? "");
    if (command === "manual-import") {
      const [sourceId, sourceConfigurationRevisionId] = String(formData.get("sourceId") ?? "").split(":");
      await importManualJobListing({ sourceId, sourceConfigurationRevisionId, title: formData.get("title"), company: formData.get("company"), workStyle: formData.get("workStyle"), location: formData.get("location"), originalUrl: formData.get("originalUrl"), postedAt: formData.get("postedAt") });
      revalidatePath("/");
      return { status: "success", summary: "Listing was imported locally with its source attribution." };
    }
    if (command === "separate-duplicate") {
      await applyDuplicateOverride({ listingId: String(formData.get("listingId") ?? ""), confirmed: formData.get("confirmed") === "yes" });
      revalidatePath("/");
      return { status: "success", summary: "The saved opportunity's duplicate grouping was changed locally." };
    }
    if (command === "reverse-duplicate") {
      await reverseDuplicateOverride({ overrideId: String(formData.get("overrideId") ?? ""), confirmed: formData.get("confirmed") === "yes" });
      revalidatePath("/");
      return { status: "success", summary: "The prior probable duplicate grouping was restored locally." };
    }
    if (command === "calculate-fit") {
      const paths = await resolveAppDataPaths(); const db = openDatabase(paths.databasePath); try { applyMigrations(db); calculateAndPersistFitAssessment(db, String(formData.get("listingId") ?? "")); } finally { db.close(); }
      revalidatePath("/"); return { status: "success", summary: "Fit Assessment calculated from approved evidence and current preferences." };
    }
    throw new WorkspaceError("JOB_LISTING_INVALID", "The Job Listing action is unavailable.", "Choose Manual import or an available duplicate action.");
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
    revalidateCareerWorkspaces();
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

function revalidateCareerWorkspaces() {
  revalidatePath("/");
  revalidatePath("/resume");
  revalidatePath("/evidence");
  revalidatePath("/career-assistant");
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
    revalidateCareerWorkspaces();
    return { status: "success", summary: "Current Base Resume action completed." };
  } catch (error) {
    const safeError = toSafeWorkspaceError(error);
    return { status: "error", summary: safeError.summary, safeNextAction: safeError.safeNextAction };
  }
}

export async function evidenceAction(_: WorkspaceActionState, formData: FormData): Promise<WorkspaceActionState> {
  try {
    const command = String(formData.get("evidenceCommand") ?? "");
    let evidenceId = String(formData.get("evidenceId") ?? "");
    let expectedRevisionId = String(formData.get("expectedRevisionId") ?? "");
    const reviewHandle = String(formData.get("reviewHandle") ?? "");
    if (reviewHandle && (command === "approve" || command === "reject")) ({ evidenceId, expectedRevisionId } = await resolveCollectionReviewHandle(reviewHandle));
    if (command === "add") await addManualEvidence({ factualText: String(formData.get("factualText") ?? ""), sourceDocument: String(formData.get("sourceDocument") ?? ""), sourceSection: String(formData.get("sourceSection") ?? "") });
    else if (command === "extract") await extractEvidenceFromBaseResume({ baseResumeId: String(formData.get("baseResumeId") ?? "") });
    else if (command === "approve") await approveEvidence({ evidenceId, expectedRevisionId });
    else if (command === "reject") await rejectEvidence({ evidenceId, expectedRevisionId });
    else if (command === "remove") await removeEvidence({ evidenceId, expectedRevisionId });
    else if (command === "edit") await editEvidence({ evidenceId, expectedRevisionId, factualText: String(formData.get("factualText") ?? "") });
    else throw new WorkspaceError("EVIDENCE_INVALID", "The requested evidence action is unavailable.", "Choose an individual evidence action and try again.");
    revalidateCareerWorkspaces();
    return { status: "success", summary: "Evidence review action completed." };
  } catch (error) { await recordEvidenceFailure().catch(() => undefined); const safeError = toSafeWorkspaceError(error); return { status: "error", summary: safeError.summary, safeNextAction: safeError.safeNextAction }; }
}

export async function evidenceLibraryAction(_: WorkspaceActionState, formData: FormData): Promise<WorkspaceActionState> {
  try {
    const command = String(formData.get("libraryCommand") ?? "");
    let result;
    if (command === "document-source-folder") {
      const category = String(formData.get("category") ?? "");
      if (category !== "project" && category !== "experience") throw new WorkspaceError("EVIDENCE_DOCUMENTER_INVALID", "Choose Projects or Experiences before documenting a folder.", "Select a work type and try the documentation again.");
      const values = formData.getAll("sourceFile");
      if (!values.length || values.some((value) => !(value instanceof File))) throw new WorkspaceError("EVIDENCE_DOCUMENTER_INVALID", "Choose a folder before documenting it.", "Choose a folder containing supported source files and try again.");
      result = await documentResumeEvidenceFolder({ category, name: String(formData.get("itemName") ?? ""), sourceSnapshot: { files: values as File[], manifest: String(formData.get("sourceManifest") ?? "") }, disclosed: formData.get("localModelDisclosure") === "yes" });
    }
    else if (command === "import-documentation-artifacts") {
      const category = String(formData.get("category") ?? "");
      if (category !== "project" && category !== "experience") throw new WorkspaceError("EVIDENCE_LIBRARY_INVALID", "Choose Projects or Experiences before importing generated documents.", "Select a work type and try the import again.");
      result = await importDocumentedEvidenceArtifacts({ category, name: String(formData.get("itemName") ?? ""), outputDirectory: String(formData.get("outputDirectory") ?? "") });
    }
    else if (command === "add-project") result = await addProjectToEvidenceLibrary({ sourceDirectory: String(formData.get("sourceDirectory") ?? ""), name: String(formData.get("projectName") ?? "") || undefined });
    else if (command === "add-experience") {
      const selected = formData.get("experienceFile");
      if (selected instanceof File && selected.size > 0 && (!selected.name.toLowerCase().endsWith(".md") || selected.size > 2 * 1024 * 1024)) throw new WorkspaceError("EVIDENCE_LIBRARY_INVALID", "The selected experience document is unavailable or unsupported.", "Choose one readable Markdown file up to 2 MB and try again.");
      const markdown = selected instanceof File && selected.size > 0 ? new TextDecoder("utf-8", { fatal: true }).decode(await selected.arrayBuffer()) : String(formData.get("markdown") ?? "");
      result = await addExperienceToEvidenceLibrary({ name: String(formData.get("experienceName") ?? ""), markdown });
    }
    else if (command === "document-for-resume") {
      const proposals = await documentFolderForResume({ sourceDirectory: String(formData.get("sourceDirectory") ?? ""), disclosed: formData.get("localModelDisclosure") === "yes", document: documentWithLocalModel });
      revalidateCareerWorkspaces();
      return { status: "success", summary: `${proposals.length} review-only evidence proposal${proposals.length === 1 ? "" : "s"} generated. Decide each item individually.` };
    }
    else if (command === "resolve-document-proposal") {
      const decision = String(formData.get("decision") ?? "");
      if (decision !== "accepted" && decision !== "edited" && decision !== "rejected") throw new WorkspaceError("EVIDENCE_DOCUMENTER_INVALID", "The proposal decision is unavailable.", "Choose accept, save edited, or reject for this proposal.");
      await resolveDocumenterProposal({ proposalId: String(formData.get("proposalId") ?? ""), expectedRevisionId: String(formData.get("expectedRevisionId") ?? ""), decision, factualText: String(formData.get("factualText") ?? "") || undefined });
      revalidateCareerWorkspaces();
      return { status: "success", summary: "Proposal decision recorded. Accepted evidence remains unreviewed." };
    }
    else if (command === "refresh") result = await refreshEvidenceLibrary();
    else throw new WorkspaceError("EVIDENCE_LIBRARY_INVALID", "The requested library action is unavailable.", "Document a source folder, then import its generated review documents.");
    revalidateCareerWorkspaces();
    return { status: "success", summary: `${result!.documentsAdded} document${result!.documentsAdded === 1 ? "" : "s"} and ${result!.candidatesAdded} unreviewed evidence candidate${result!.candidatesAdded === 1 ? "" : "s"} were added.` };
  } catch (error) {
    const command = String(formData.get("libraryCommand") ?? "");
    if (command === "document-for-resume" || command === "document-source-folder" || command === "resolve-document-proposal") await recordDocumenterFailure().catch(() => undefined);
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
