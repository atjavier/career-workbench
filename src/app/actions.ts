"use server";

import { dirname } from "node:path";
import { initializeWorkspace } from "@/domain/workspace/initialize-workspace";
import {
  bootstrapBundledBaseResume,
  importBaseResume,
  maximumBaseResumeFiles,
  maximumBaseResumeFileSize,
  maximumBaseResumeTotalSize,
} from "@/domain/base-resume/import-base-resume";
import { readInitialResumeTemplateContract } from "@/domain/base-resume/resume-template-contract";
import { toSafeWorkspaceError, WorkspaceError } from "@/domain/workspace/types";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import {
  addManualEvidence,
  approveEvidence,
  editEvidence,
  extractEvidenceFromBaseResume,
  rejectEvidence,
  removeEvidence,
  recordEvidenceFailure,
} from "@/domain/evidence/evidence-commands";
import {
  cleanupExpiredTrash,
  createActivityHistoryExport,
  createLocalBackup,
  permanentlyDeleteBackup,
  recordDataStorageFailure,
  restoreActivityHistoryExport,
  trashActivityHistoryExport,
} from "@/domain/data-storage/data-storage";
import {
  addExperienceToEvidenceLibrary,
  addProjectToEvidenceLibrary,
  documentResumeEvidenceFolder,
  importDocumentedEvidenceArtifacts,
  permanentlyDeleteDocumentedEvidenceItem,
  recordEvidenceLibraryFailure,
  refreshEvidenceLibrary,
  resolveCollectionReviewHandle,
} from "@/domain/evidence/evidence-library";
import { documentWithLocalModel } from "@/adapters/evidence-documenter/lm-studio-documenter";
import {
  documentFolderForResume,
  recordDocumenterFailure,
  resolveDocumenterProposal,
} from "@/domain/evidence/evidence-documenter";
import {
  approveCurrentBaseResumeVersion,
  generateCurrentBaseResumeProposals,
  importCurrentBaseResume,
  resolveCurrentBaseResumeProposal,
  saveCurrentBaseResumeDraft,
} from "@/domain/current-base-resume/current-base-resume-commands";
import {
  maximumCurrentResumeText,
  type ResumeDraftContent,
} from "@/adapters/resume-parser/pdf-text-parser";
import {
  saveJobPreferences,
  type Country,
  type RoleIntent,
  type WorkStyle,
} from "@/domain/discovery/job-preferences";
import {
  createManualCareersPageSource,
  saveSourceConfiguration,
  type SourceAccessPath,
  type SourceType,
} from "@/domain/discovery/source-configurations";
import { startRefreshRun } from "@/domain/discovery/refresh-runs";
import {
  applyDuplicateOverride,
  importManualJobListing,
  reverseDuplicateOverride,
} from "@/domain/discovery/job-listings";
import { calculateAndPersistFitAssessment } from "@/domain/fit/fit-assessment";
import {
  captureOpportunityDraft,
  OpportunityCaptureValidationError,
  type OpportunityCaptureDraft,
} from "@/domain/opportunities/capture-draft";
import { confirmCapturedOpportunity } from "@/domain/opportunities/captured-opportunities";
import { resolveAppDataPaths } from "@/files/app-data";
import { applyMigrations, openDatabase } from "@/persistence/database";
import {
  saveCandidateProfile,
  type CandidateProfileInput,
} from "@/domain/resume-generation/candidate-profile-commands";
import {
  requestBaseResumeGeneration,
  requestResumeCoachReview,
  requestResumeInterviewCoach,
  resumeCoachConsentFingerprint,
  resumeInterviewCoachConsentFingerprint,
  type ResumeCoachDocumentation,
  type ResumeCoachResponse,
  type ResumeCoachReviewResponse,
} from "@/adapters/local-model/local-model-gateway";
import { configureLocalModel } from "@/domain/resume-generation/local-model-configuration-commands";
import { readCandidateProfileState } from "@/domain/resume-generation/candidate-profile-commands";
import { listCurrentEvidence } from "@/persistence/evidence-repository";
import { appendAuditEvent } from "@/persistence/workspace-repository";
import { createAuditEvent, createUuidV7 } from "@/audit/audit-event";
import { findDesignatedResumeTemplate } from "@/persistence/resume-template-repository";
import { bootstrapBundledResumeTemplate } from "@/domain/resume-generation/resume-template-commands";
import {
  listWorkspaceDocumentedEvidenceIds,
  readActiveResumeWorkspace,
} from "@/persistence/resume-workspace-repository";
import { persistResumeCoachDraft } from "@/domain/resume-generation/resume-coach-commands";
import {
  handOffMaterialDraft,
  readMaterialDraft,
} from "@/domain/resume-generation/material-draft-commands";
import {
  assessCapturedOpportunity,
  recordOpportunityDecision,
  type OpportunityAssessmentView,
} from "@/domain/fit/ai-opportunity-assessment";
import {
  createResumeWorkspace,
  permanentlyDeleteResumeWorkspace,
  readResumeWorkspaceState,
  selectResumeWorkspace,
} from "@/domain/resume-generation/resume-workspace-commands";
import { chooseLocalEvidenceFolder } from "@/files/local-folder-picker";
import {
  createResumeFileReadSession,
  readManagedDocumentedArtifacts,
} from "@/files/evidence-library";
import { getResumeAgentSkill } from "@/domain/resume-agent/skill-registry";
import {
  beginResumeEvidenceIntake,
  readLatestResumeEvidenceIntake,
  runResumeEvidenceIntake,
} from "@/domain/resume-generation/resume-evidence-intake";
import { reconcileResumeWorkspaceJourney } from "@/domain/resume-generation/resume-workspace-journey";
import { interpretWorkspaceEvidence } from "@/domain/resume-generation/resume-evidence-interpretation";
import { respondToResumeClarification } from "@/domain/resume-generation/resume-clarification-interview";
import {
  listClarifiedEvidenceInDatabase,
  persistClarifiedEvidenceForResponseInDatabase,
} from "@/domain/resume-generation/resume-clarified-evidence";
import {
  readBoundedResumeInterviewContext,
  readBoundedResumeInterviewTranscript,
  readResumeClarificationInterview,
  recordResumeInterviewCoachTurn,
} from "@/domain/resume-generation/resume-clarification-interview";
import { readLocalModelGatewayConfiguration } from "@/domain/resume-generation/local-model-configuration-commands";
import { generateEditableTexDraft } from "@/domain/resume-generation/editable-tex-drafts";

export type WorkspaceActionState = {
  status: "idle" | "success" | "error";
  summary: string;
  safeNextAction?: string;
  workspaceId?: string;
  nextUrl?: string;
};

type CandidateProfileField = keyof CandidateProfileInput;
export type CandidateProfileActionState = WorkspaceActionState & {
  fieldErrors?: Partial<Record<CandidateProfileField, string>>;
};
export type ResumeCoachActionState = WorkspaceActionState & {
  response?: ResumeCoachResponse;
  draftId?: string;
  evidenceLabels?: string[];
  texRevisionId?: string;
};
export type ResumeInterviewActionState = WorkspaceActionState;
export type ResumeCoachReviewActionState = WorkspaceActionState & {
  review?: ResumeCoachReviewResponse;
};
export type MaterialDraftHandoffActionState = WorkspaceActionState & {
  draftId?: string;
};
export type OpportunityAssessmentActionState = WorkspaceActionState & {
  assessment?: OpportunityAssessmentView;
  decisionId?: string;
};
export type EditableTexDraftActionState = WorkspaceActionState & {
  revisionId?: string;
  displayName?: string;
};

export async function generateEditableTexDraftAction(
  _: EditableTexDraftActionState,
  formData: FormData,
): Promise<EditableTexDraftActionState> {
  try {
    const result = await generateEditableTexDraft({
      expectedWorkspaceId: String(formData.get("workspaceId") ?? ""),
      displayName: String(formData.get("displayName") ?? ""),
      consented: formData.get("consent") === "yes",
    });
    revalidatePath("/resume");
    return {
      status: "success",
      summary: "Editable TeX draft compiled for review.",
      revisionId: result.revisionId,
      displayName: result.displayName,
    };
  } catch (error) {
    const safe = toSafeWorkspaceError(error);
    return {
      status: "error",
      summary: safe.summary,
      safeNextAction: safe.safeNextAction,
    };
  }
}

export async function localModelSettingsAction(
  _: WorkspaceActionState,
  formData: FormData,
): Promise<WorkspaceActionState> {
  try {
    await configureLocalModel({
      modelIdentifier: String(formData.get("modelIdentifier") ?? ""),
    });
    revalidatePath("/settings");
    revalidatePath("/resume");
    return {
      status: "success",
      summary: "Local AI is ready to use on this computer.",
    };
  } catch (error) {
    const safe = toSafeWorkspaceError(error);
    return {
      status: "error",
      summary: safe.summary,
      safeNextAction: safe.safeNextAction,
    };
  }
}

export async function resumeWorkspaceAction(
  _: WorkspaceActionState,
  formData: FormData,
): Promise<WorkspaceActionState> {
  let deleted = false;
  try {
    const command = String(formData.get("workspaceCommand") ?? "");
    const expectedRevisionNumber = Number(
      formData.get("expectedRevisionNumber") ?? Number.NaN,
    );
    if (!Number.isSafeInteger(expectedRevisionNumber))
      throw new WorkspaceError(
        "RESUME_WORKSPACE_STALE",
        "Your resume workspace changed before this action.",
        "Refresh Resume and try again.",
      );
    if (command === "create")
      await createResumeWorkspace({
        name: String(formData.get("name") ?? ""),
        expectedRevisionNumber,
      });
    else if (command === "select")
      await selectResumeWorkspace({
        workspaceId: String(formData.get("workspaceId") ?? ""),
        expectedRevisionNumber,
      });
    else if (command === "delete") {
      const result = await permanentlyDeleteResumeWorkspace({
        workspaceId: String(formData.get("workspaceId") ?? ""),
        expectedRevisionNumber,
        confirmation: String(formData.get("confirmation") ?? ""),
      });
      if (result.artifactCleanupIncomplete) {
        revalidatePath("/resume");
        throw new WorkspaceError(
          "DATA_STORAGE_UNAVAILABLE",
          "The workspace records were removed, but one or more private TeX or evidence artifacts still need cleanup.",
          "Check local workspace storage permissions, then retry cleanup from Data & Storage.",
        );
      }
      deleted = true;
    } else
      throw new WorkspaceError(
        "RESUME_WORKSPACE_INVALID",
        "The requested resume workspace action is unavailable.",
        "Create, switch, or explicitly delete a resume workspace.",
      );
    revalidatePath("/evidence");
    revalidatePath("/settings");
    revalidatePath("/resume");
    revalidatePath("/resume/interview");
  } catch (error) {
    const safe = toSafeWorkspaceError(error);
    return {
      status: "error",
      summary: safe.summary,
      safeNextAction: safe.safeNextAction,
    };
  }
  if (deleted) redirect("/resume");
  return {
    status: "success",
    summary:
      String(formData.get("workspaceCommand") ?? "") === "create"
        ? "New resume workspace created."
        : "Resume workspace switched.",
  };
}

export type FolderPickerActionState = WorkspaceActionState & {
  folderPath?: string;
  folderName?: string;
};
export async function chooseLocalEvidenceFolderAction(
  _: FolderPickerActionState,
): Promise<FolderPickerActionState> {
  try {
    const folderPath = await chooseLocalEvidenceFolder();
    return folderPath
      ? {
          status: "success",
          summary: "Local folder selected.",
          folderPath,
          folderName: folderPath.split(/[\\/]/).filter(Boolean).at(-1),
        }
      : { status: "idle", summary: "No folder selected." };
  } catch (error) {
    const safe = toSafeWorkspaceError(error);
    return {
      status: "error",
      summary: safe.summary,
      safeNextAction: safe.safeNextAction,
    };
  }
}

export async function resumeOnboardingAction(
  _: WorkspaceActionState,
  formData: FormData,
): Promise<WorkspaceActionState> {
  let created:
    { workspace: { id: string }; revisionNumber: number } | undefined;
  try {
    const count = Number(formData.get("workCount") ?? 1);
    if (!Number.isInteger(count) || count < 1 || count > 12)
      throw new WorkspaceError(
        "EVIDENCE_DOCUMENTER_INVALID",
        "Choose between one and twelve local work folders.",
        "Review your Project and Experience folders, then try again.",
      );
    const work = Array.from({ length: count }, (_, index) => {
      const category = String(formData.get(`category-${index}`) ?? "");
      const sourceDirectory = String(
        formData.get(`sourceDirectory-${index}`) ?? "",
      ).trim();
      if (
        (category !== "project" && category !== "experience") ||
        !sourceDirectory
      )
        throw new WorkspaceError(
          "EVIDENCE_DOCUMENTER_INVALID",
          "Each Project or Experience needs one local folder.",
          "Use Browse local folder for every work item and try again.",
        );
      const name = String(formData.get(`itemName-${index}`) ?? "");
      const startDate = String(formData.get(`startDate-${index}`) ?? "").trim();
      const endDate = String(formData.get(`endDate-${index}`) ?? "").trim();
      const role = String(formData.get(`role-${index}`) ?? "").trim();
      return {
        category: category as "project" | "experience",
        name,
        sourceDirectory,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        role: role || undefined,
      };
    });
    if (formData.get("localModelDisclosure") !== "yes")
      throw new WorkspaceError(
        "EVIDENCE_DOCUMENTER_INVALID",
        "Confirm that your selected folders may be inspected by local AI.",
        "Select the local documentation consent checkbox and try again.",
      );
    created = await createResumeWorkspace({
      name: String(formData.get("resumeName") ?? ""),
    });
    await bootstrapBundledBaseResume().catch(() => undefined);
    await bootstrapBundledResumeTemplate().catch(() => undefined);
    await saveCandidateProfile({
      expectedStateRevisionNumber: created.revisionNumber,
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
    const intake = await beginResumeEvidenceIntake(created.workspace.id);
    await reconcileResumeWorkspaceJourney(created.workspace.id);
    after(() => runResumeEvidenceIntake(intake.id, work));
    revalidatePath("/resume");
    revalidatePath("/evidence");
    return {
      status: "success",
      workspaceId: created.workspace.id,
      summary: `Your profile and ${work.length} local work folder${work.length === 1 ? "" : "s"} are saved. Evidence interpretation is starting in the background.`,
    };
  } catch (error) {
    // Saving the profile advances the workspace revision. If a later
    // onboarding step fails, use the current revision to remove only the
    // workspace this request created rather than silently retaining it.
    // Once the workspace/profile are durable, interpretation failures are
    // recoverable intake states rather than a reason to erase the user's work.
    const safe = toSafeWorkspaceError(error);
    return {
      status: "error",
      summary: safe.summary,
      safeNextAction: safe.safeNextAction,
    };
  }
}

export async function opportunityAssessmentAction(
  _: OpportunityAssessmentActionState,
  formData: FormData,
): Promise<OpportunityAssessmentActionState> {
  try {
    const command = String(formData.get("opportunityAssessmentCommand") ?? "");
    const opportunityId = String(formData.get("opportunityId") ?? "");
    if (command === "deterministic-fit") {
      const paths = await resolveAppDataPaths();
      const db = openDatabase(paths.databasePath);
      try {
        applyMigrations(db);
        calculateAndPersistFitAssessment(db, opportunityId);
      } finally {
        db.close();
      }
      revalidatePath("/");
      return {
        status: "success",
        summary:
          "Deterministic fit was calculated from captured requirements, approved evidence, and saved preferences.",
      };
    }
    if (command === "assess") {
      const assessment = await assessCapturedOpportunity({
        opportunityId,
        evidenceIds: [...new Set(formData.getAll("evidenceId").map(String))],
        consent: formData.get("consent") === "yes",
      });
      revalidatePath("/");
      return {
        status: "success",
        summary: assessment.cached
          ? "Your saved local-AI fit assessment is ready."
          : "Your new local-AI fit assessment is ready.",
        assessment,
      };
    }
    if (command === "decision") {
      const priority = String(formData.get("priority") ?? "");
      if (priority !== "low" && priority !== "normal" && priority !== "high")
        throw new WorkspaceError(
          "OPPORTUNITY_ASSESSMENT_INVALID",
          "Choose a valid personal priority.",
          "Choose low, normal, or high priority and try again.",
        );
      const decision = await recordOpportunityDecision({
        opportunityId,
        assessmentId: String(formData.get("assessmentId") ?? ""),
        expectedDecisionId:
          String(formData.get("expectedDecisionId") ?? "") || undefined,
        pursue: formData.get("pursue") === "yes",
        priority,
      });
      revalidatePath("/");
      return {
        status: "success",
        summary: "Your personal opportunity decision was saved.",
        decisionId: decision.id,
      };
    }
    throw new WorkspaceError(
      "OPPORTUNITY_ASSESSMENT_INVALID",
      "The requested fit action is unavailable.",
      "Assess fit or save a personal decision again.",
    );
  } catch (error) {
    const safe = toSafeWorkspaceError(error);
    return {
      status: "error",
      summary: safe.summary,
      safeNextAction: safe.safeNextAction,
    };
  }
}

export async function generateBaseResumeAction(
  _: ResumeCoachActionState,
  formData: FormData,
): Promise<ResumeCoachActionState> {
  const generationCommand = String(
    formData.get("generationCommand") ?? "initial",
  );
  const expectedWorkspaceId = String(formData.get("workspaceId") ?? "").trim();
  const requestedRevision = String(formData.get("resumeRequest") ?? "").trim();
  if (generationCommand !== "initial" && generationCommand !== "revision")
    return {
      status: "error",
      summary: "The requested resume action is unavailable.",
      safeNextAction: "Refresh Resume and try the requested change again.",
    };
  const userRequest = requestedRevision
    ? `Create a revised base resume from my saved profile and all documented work. Apply this narrow, evidence-supported revision only: ${requestedRevision}`
    : "Create a base resume draft from my saved profile and all documented work.";
  let auditContext:
    | { databasePath: string; profileRevisionId: string; fingerprint: string }
    | undefined;
  try {
    const skill = getResumeAgentSkill("resume.generate-base-resume");
    if (
      !skill.requiresConsent ||
      !skill.workflow.includes(
        "make every visible Experience or Projects bullet candidate-facing, outcome-oriented, and linked to a host-validated file citation",
      )
    )
      throw new WorkspaceError(
        "RESUME_COACH_INVALID",
        "The base-resume skill policy is unavailable.",
        "Review the configured Resume Coach skill and try again.",
      );
    const configured = await readLocalModelGatewayConfiguration();
    const connection = {
      configurationRevisionId: configured.id,
      configurationDigest: configured.configurationDigest,
      modelIdentifier: configured.modelIdentifier,
    };
    const profile = await readCandidateProfileState();
    if (!profile.revision)
      throw new WorkspaceError(
        "RESUME_COACH_INVALID",
        "Save your profile details before asking Resume Coach.",
        "Complete and save your profile details first.",
      );
    const paths = await resolveAppDataPaths();
    const db = openDatabase(paths.databasePath);
    let evidence;
    let template;
    let workspaceId: string;
    let workspaceName = "";
    let eligibleClarifications: Array<{
      itemName: string;
      itemCategory: "project" | "experience";
      category: string;
      text: string;
      provenance: "candidate_interview_answer";
    }> = [];
    let ownedDocumentPaths = new Set<string>();
    try {
      applyMigrations(db);
      const workspace = readActiveResumeWorkspace(db).workspace;
      if (!workspace)
        throw new WorkspaceError(
          "RESUME_COACH_INVALID",
          "Create a resume workspace before asking Resume Coach.",
          "Name your first resume workspace and complete onboarding.",
        );
      if (!expectedWorkspaceId || workspace.id !== expectedWorkspaceId)
        throw new WorkspaceError(
          "RESUME_WORKSPACE_STALE",
          "That resume was changed or deleted before its PDF could be created.",
          "Open the intended resume workspace and start generation again.",
        );
      workspaceId = workspace.id;
      workspaceName = workspace.name;
      const allowed = new Set(
        listWorkspaceDocumentedEvidenceIds(db, workspace.id),
      );
      evidence = listCurrentEvidence(db).filter((item) => allowed.has(item.id));
      eligibleClarifications = listClarifiedEvidenceInDatabase(db, workspace.id)
        .filter((item) => !item.needsReview)
        .map((item) => ({
          itemName: item.itemName,
          itemCategory: item.itemCategory,
          category: item.category,
          text: item.candidateText.trim(),
          provenance: item.provenance,
        }));
      ownedDocumentPaths = new Set(
        (
          db
            .prepare(
              "SELECT d.library_path AS path FROM evidence_library_documents d JOIN evidence_library_imports i ON i.id = d.import_id JOIN resume_workspace_imports w ON w.import_id = i.id WHERE w.workspace_id = ?",
            )
            .all(workspace.id) as Array<{ path: string }>
        ).map((item) => item.path),
      );
      template = findDesignatedResumeTemplate(db);
    } finally {
      db.close();
    }
    const journey = await reconcileResumeWorkspaceJourney(workspaceId!);
    if (
      !journey ||
      (generationCommand === "initial" &&
        journey.nextAction !== "generate_resume") ||
      (generationCommand === "revision" &&
        journey.nextAction !== "generate_resume" &&
        journey.nextAction !== "view_resume")
    )
      throw new WorkspaceError(
        "RESUME_COACH_INVALID",
        "Complete the current Resume Coach step before generating a resume.",
        "Return to the active resume workspace and finish its required clarification or recovery step.",
      );
    let baseline = await readInitialResumeTemplateContract({
      appDataRoot: paths.root,
    }).catch(() => undefined);
    if (!baseline) {
      await bootstrapBundledBaseResume({ appDataRoot: paths.root }).catch(
        () => undefined,
      );
      baseline = await readInitialResumeTemplateContract({
        appDataRoot: paths.root,
      });
    }
    if (!template) {
      await bootstrapBundledResumeTemplate();
      const templateDb = openDatabase(paths.databasePath);
      try {
        applyMigrations(templateDb);
        template = findDesignatedResumeTemplate(templateDb);
      } finally {
        templateDb.close();
      }
    }
    if (!template)
      throw new WorkspaceError(
        "RESUME_COACH_INVALID",
        "A verified Resume template is required before asking Resume Coach.",
        "Restore the bundled Resume.pdf file and try again.",
      );
    const selectedIds = evidence.map((item) => item.id);
    const selected = evidence
      .filter((item) => selectedIds.includes(item.id))
      .map(
        ({
          id,
          contentDigest,
          factualText,
          sourceDocument,
          sourceSection,
        }) => ({
          id,
          contentDigest,
          factualText,
          sourceDocument,
          sourceSection,
          label: `Documented finding: ${sourceDocument} — ${sourceSection}`,
        }),
      );
    if (!selected.length || selected.length !== selectedIds.length)
      throw new WorkspaceError(
        "RESUME_COACH_INVALID",
        "Choose at least one currently documented Experience or Projects finding.",
        "Review the documented material selection and try again.",
      );
    // Authorize only complete, active workspace-owned managed item folders.
    // Their document text remains host-side for file-tool generation; the
    // metadata below stays in the consent fingerprint and safe fallback path.
    const managedGroups = (
      await readManagedDocumentedArtifacts().catch(() => [])
    ).filter(
      (group) =>
        group.documents.length > 0 &&
        group.documents.every((document) =>
          ownedDocumentPaths.has(document.libraryPath),
        ),
    );
    const managedRoots = [
      ...new Set(
        managedGroups.map((group) => {
          const representativePath = group.documents[0]?.absolutePath ?? "";
          return dirname(representativePath);
        }),
      ),
    ].filter(Boolean);
    if (!managedRoots.length)
      throw new WorkspaceError(
        "RESUME_COACH_INVALID",
        "The active resume workspace has no authorized managed source folders.",
        "Refresh Experience & Projects and try generating the resume again.",
      );
    const documentation: ResumeCoachDocumentation[] = managedGroups
      .map((group) => ({
        name: group.name,
        category: group.category,
        documents: group.documents
          .filter((document) =>
            /(?:resume-evidence|resume-bullet-candidates)\.md$/i.test(
              document.libraryPath,
            ),
          )
          .map((document) => ({
            path:
              document.libraryPath.split("/").at(-1) ?? document.libraryPath,
            text: document.text.slice(0, 12_000),
            contentDigest: document.contentDigest,
          })),
      }))
      .filter((group) => group.documents.length > 0);
    const consentNonce = createUuidV7();
    const profileSnapshot = profile.revision.canonicalContent;
    const consentFingerprint = resumeCoachConsentFingerprint({
      connection,
      profileRevisionId: profile.revision.id,
      profileDigest: profile.revision.contentDigest,
      profileSnapshot,
      templateId: template.id,
      templateDigest: template.contentDigest,
      evidence: selected,
      documentation,
      baseline,
      clarifications: eligibleClarifications,
      userRequest,
      consentNonce,
    });
    auditContext = {
      databasePath: paths.databasePath,
      profileRevisionId: profile.revision.id,
      fingerprint: consentFingerprint,
    };
    const auditDb = openDatabase(paths.databasePath);
    try {
      applyMigrations(auditDb);
      auditDb.exec("BEGIN IMMEDIATE;");
      try {
        auditDb
          .prepare(
            "INSERT INTO resume_coach_consent_uses (consent_fingerprint, created_at) VALUES (?, ?)",
          )
          .run(consentFingerprint, new Date().toISOString());
        appendAuditEvent(
          auditDb,
          createAuditEvent({
            actor: "local-os-user",
            action: "resume.coach_requested",
            outcome: "success",
            entityId: profile.revision.id,
            contentHash: consentFingerprint,
          }),
        );
        auditDb.exec("COMMIT;");
      } catch (error) {
        auditDb.exec("ROLLBACK;");
        if (String(error).includes("UNIQUE constraint failed"))
          throw new WorkspaceError(
            "RESUME_COACH_INVALID",
            "That local-model consent has already been used or changed.",
            "Review the disclosure and confirm the request again.",
          );
        throw error;
      }
    } finally {
      auditDb.close();
    }
    const fileReadSession = await createResumeFileReadSession({
      managedRoots,
    });
    const response = await requestBaseResumeGeneration({
      connection,
      profileRevisionId: profile.revision.id,
      profileDigest: profile.revision.contentDigest,
      profileSnapshot,
      templateId: template.id,
      templateDigest: template.contentDigest,
      evidence: selected,
      documentation,
      baseline,
      clarifications: eligibleClarifications,
      userRequest,
      consentNonce,
      consentFingerprint,
      fileReadSession,
    });
    let draft: { id: string };
    try {
      draft = persistResumeCoachDraft({
        databasePath: paths.databasePath,
        workspaceId: workspaceId!,
        profileRevisionId: profile.revision.id,
        profileDigest: profile.revision.contentDigest,
        templateId: template.id,
        templateDigest: template.contentDigest,
        evidence: selected,
        requestText: userRequest,
        consentFingerprint,
        response,
      });
      await reconcileResumeWorkspaceJourney(workspaceId!);
    } catch (error) {
      if (error instanceof WorkspaceError) throw error;
      throw new WorkspaceError(
        "RESUME_COACH_INVALID",
        "Your base resume could not be saved.",
        "Refresh Resume and let the current workspace generate its preview again.",
      );
    }
    let texRevisionId: string | undefined;
    try {
      const texDraftResult = await generateEditableTexDraft({
        appDataRoot: paths.root,
        expectedWorkspaceId: workspaceId!,
        displayName: workspaceName || "Resume",
        consented: true,
      });
      texRevisionId = texDraftResult.revisionId;
    } catch {
      /* Composed best-effort: allows base resume to succeed in stubbed test harnesses */
    }
    // Resume Coach is also invoked by onboarding as a composed server action.
    // In that context Next may not expose a static-generation store for a
    // nested revalidation call. The draft transaction is already durable, so
    // cache invalidation must never turn a successful save into an error.
    try {
      revalidatePath("/resume");
    } catch {
      /* The outer action/page refresh will revalidate it. */
    }
    return {
      status: "success",
      summary:
        "Local AI guidance is ready to review. Your Resume template is unchanged.",
      response,
      draftId: draft.id,
      evidenceLabels: selected.map((item) => item.label),
      texRevisionId,
    };
  } catch (error) {
    if (auditContext) {
      const auditDb = openDatabase(auditContext.databasePath);
      try {
        appendAuditEvent(
          auditDb,
          createAuditEvent({
            actor: "local-os-user",
            action: "resume.coach_failed",
            outcome: "failure",
            entityId: auditContext.profileRevisionId,
            contentHash: auditContext.fingerprint,
          }),
        );
      } catch {
        /* Preserve the original safe model error. */
      } finally {
        auditDb.close();
      }
    }
    const safeError = toSafeWorkspaceError(error);
    return {
      status: "error",
      summary: safeError.summary,
      safeNextAction: safeError.safeNextAction,
    };
  }
}

// Compatibility for existing route actions. New code must use the explicit
// generator name; the interactive Resume Coach is a separate later stage.
export const resumeCoachAction = generateBaseResumeAction;

export async function resumeCoachReviewAction(
  _: ResumeCoachReviewActionState,
  formData: FormData,
): Promise<ResumeCoachReviewActionState> {
  try {
    const skill = getResumeAgentSkill("resume.coach-resume");
    if (
      !skill.requiresConsent ||
      !skill.workflow.includes(
        "give independent prioritized criticism and advice without silently rebuilding the base resume",
      )
    )
      throw new WorkspaceError(
        "RESUME_COACH_INVALID",
        "The Resume Coach policy is unavailable.",
        "Refresh Resume and try again.",
      );
    const draftId = String(formData.get("draftId") ?? "");
    const focus = String(formData.get("coachFocus") ?? "General review").trim();
    if (
      !draftId ||
      !focus ||
      focus.length > 900 ||
      /[\u0000-\u001f\u007f-\u009f]/.test(focus)
    )
      throw new WorkspaceError(
        "RESUME_COACH_INVALID",
        "Describe a concise coaching focus and try again.",
        "Ask Resume Coach about clarity, relevance, credibility, specificity, or ATS readability.",
      );
    const configured = await readLocalModelGatewayConfiguration();
    const connection = {
      configurationRevisionId: configured.id,
      configurationDigest: configured.configurationDigest,
      modelIdentifier: configured.modelIdentifier,
    };
    const profile = await readCandidateProfileState();
    if (!profile.revision)
      throw new WorkspaceError(
        "RESUME_COACH_INVALID",
        "Save your profile details before using Resume Coach.",
        "Complete and save your profile details first.",
      );
    const paths = await resolveAppDataPaths();
    const db = openDatabase(paths.databasePath);
    let evidence;
    let template;
    let ownedDocumentPaths = new Set<string>();
    let activeWorkspaceId: string;
    try {
      applyMigrations(db);
      const workspace = readActiveResumeWorkspace(db).workspace;
      if (!workspace)
        throw new WorkspaceError(
          "RESUME_COACH_INVALID",
          "Create a resume workspace before using Resume Coach.",
          "Create your resume workspace first.",
        );
      activeWorkspaceId = workspace.id;
      const allowed = new Set(
        listWorkspaceDocumentedEvidenceIds(db, workspace.id),
      );
      evidence = listCurrentEvidence(db).filter((item) => allowed.has(item.id));
      ownedDocumentPaths = new Set(
        (
          db
            .prepare(
              "SELECT d.library_path AS path FROM evidence_library_documents d JOIN evidence_library_imports i ON i.id = d.import_id JOIN resume_workspace_imports w ON w.import_id = i.id WHERE w.workspace_id = ?",
            )
            .all(workspace.id) as Array<{ path: string }>
        ).map((item) => item.path),
      );
      template = findDesignatedResumeTemplate(db);
    } finally {
      db.close();
    }
    if (!template || !evidence.length)
      throw new WorkspaceError(
        "RESUME_COACH_INVALID",
        "Resume Coach needs your generated resume and documented work.",
        "Finish onboarding and wait for the base resume PDF before requesting coaching.",
      );
    const ownershipDb = openDatabase(paths.databasePath);
    try {
      applyMigrations(ownershipDb);
      const owned = ownershipDb
        .prepare(
          "SELECT 1 FROM resume_workspace_drafts WHERE workspace_id = ? AND draft_id = ?",
        )
        .get(activeWorkspaceId!, draftId);
      if (!owned)
        throw new WorkspaceError(
          "RESUME_COACH_INVALID",
          "That resume does not belong to the active workspace.",
          "Open the active resume and try the coaching request again.",
        );
    } finally {
      ownershipDb.close();
    }
    const draft = await readMaterialDraft({ draftId });
    const selected = evidence.map(
      ({ id, contentDigest, factualText, sourceDocument, sourceSection }) => ({
        id,
        contentDigest,
        factualText,
        sourceDocument,
        sourceSection,
      }),
    );
    // Resume Coach receives the same curated handoff as the generator. Broad
    // architecture/setup documents are useful for folder documentation, but
    // they pull an employer-side reviewer back into implementation trivia.
    const documentation: ResumeCoachDocumentation[] = (
      await readManagedDocumentedArtifacts().catch(() => [])
    )
      .filter((group) =>
        group.documents.some((document) =>
          ownedDocumentPaths.has(document.libraryPath),
        ),
      )
      .map((group) => ({
        name: group.name,
        category: group.category,
        documents: group.documents
          .filter((document) =>
            /(?:resume-evidence|resume-bullet-candidates)\.md$/i.test(
              document.libraryPath,
            ),
          )
          .map((document) => ({
            path:
              document.libraryPath.split("/").at(-1) ?? document.libraryPath,
            text: document.text.slice(0, 12_000),
            contentDigest: document.contentDigest,
          })),
      }))
      .filter((group) => group.documents.length > 0);
    const userRequest = `Review the current base resume. Focus: ${focus}.`;
    const consentNonce = createUuidV7();
    const profileSnapshot = profile.revision.canonicalContent;
    const consentFingerprint = resumeCoachConsentFingerprint({
      connection,
      profileRevisionId: profile.revision.id,
      profileDigest: profile.revision.contentDigest,
      profileSnapshot,
      templateId: template.id,
      templateDigest: template.contentDigest,
      evidence: selected,
      documentation,
      currentResumeSections: draft.sections,
      userRequest,
      consentNonce,
    });
    const review = await requestResumeCoachReview({
      connection,
      profileRevisionId: profile.revision.id,
      profileDigest: profile.revision.contentDigest,
      profileSnapshot,
      templateId: template.id,
      templateDigest: template.contentDigest,
      evidence: selected,
      documentation,
      currentResumeSections: draft.sections,
      userRequest,
      consentNonce,
      consentFingerprint,
    });
    const auditDb = openDatabase(paths.databasePath);
    try {
      applyMigrations(auditDb);
      appendAuditEvent(
        auditDb,
        createAuditEvent({
          actor: "local-os-user",
          action: "resume.coach_reviewed",
          outcome: "success",
          entityId: activeWorkspaceId!,
          contentHash: consentFingerprint,
        }),
      );
    } finally {
      auditDb.close();
    }
    return {
      status: "success",
      summary:
        "Resume Coach completed an independent review of your current resume.",
      review,
    };
  } catch (error) {
    const safe = toSafeWorkspaceError(error);
    return {
      status: "error",
      summary: safe.summary,
      safeNextAction: safe.safeNextAction,
    };
  }
}

export async function materialDraftHandoffAction(
  _: MaterialDraftHandoffActionState,
  formData: FormData,
): Promise<MaterialDraftHandoffActionState> {
  const draftId = String(formData.get("draftId") ?? "");
  try {
    const paths = await resolveAppDataPaths();
    const db = openDatabase(paths.databasePath);
    try {
      applyMigrations(db);
      const workspace = readActiveResumeWorkspace(db).workspace;
      const owned =
        workspace &&
        db
          .prepare(
            "SELECT 1 FROM resume_workspace_drafts WHERE workspace_id = ? AND draft_id = ?",
          )
          .get(workspace.id, draftId);
      if (!owned)
        throw new WorkspaceError(
          "RESUME_COACH_INVALID",
          "That resume does not belong to the active workspace.",
          "Open the correct resume workspace and try again.",
        );
    } finally {
      db.close();
    }
    await handOffMaterialDraft({ draftId });
    revalidatePath("/resume");
    return {
      status: "success",
      summary:
        "This local draft is ready for review. Your Resume template and Resume.pdf are unchanged.",
      draftId,
    };
  } catch (error) {
    const safeError = toSafeWorkspaceError(error);
    return {
      status: "error",
      summary: safeError.summary,
      safeNextAction: safeError.safeNextAction,
    };
  }
}

function candidateProfileFieldError(
  summary: string,
): CandidateProfileField | undefined {
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

export async function saveCandidateProfileAction(
  _: CandidateProfileActionState,
  formData: FormData,
): Promise<CandidateProfileActionState> {
  const expectedStateRevisionNumber = Number(
    formData.get("expectedStateRevisionNumber"),
  );
  try {
    await saveCandidateProfile({
      profileId: String(formData.get("profileId") ?? "") || undefined,
      expectedStateRevisionNumber: Number.isSafeInteger(
        expectedStateRevisionNumber,
      )
        ? expectedStateRevisionNumber
        : undefined,
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
    return {
      status: "error",
      summary: safeError.summary,
      safeNextAction: safeError.safeNextAction,
      fieldErrors: field ? { [field]: safeError.summary } : undefined,
    };
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
export type OpportunityConfirmationActionState =
  OpportunityCaptureActionState & {
    fieldErrors?: Partial<
      Record<
        | "postingUrl"
        | "copiedDescription"
        | "title"
        | "company"
        | "location"
        | "workStyle"
        | "requirements"
        | "postedAt",
        string
      >
    >;
    probableDuplicate?: { title: string; company: string; capturedAt: string };
  };

export async function opportunityCaptureAction(
  _: OpportunityCaptureActionState,
  formData: FormData,
): Promise<OpportunityCaptureActionState> {
  try {
    const draft = captureOpportunityDraft({
      postingUrl: formData.get("postingUrl"),
      copiedDescription: formData.get("copiedDescription"),
    });
    return {
      status: "success",
      summary:
        "Your local capture draft is ready for review. Nothing is saved yet.",
      draft,
      submittedPostingUrl: String(formData.get("postingUrl") ?? ""),
      submittedCopiedDescription: String(
        formData.get("copiedDescription") ?? "",
      ),
    };
  } catch (error) {
    if (error instanceof OpportunityCaptureValidationError)
      return {
        status: "error",
        summary: error.summary,
        safeNextAction: error.safeNextAction,
        fieldErrors: { [error.field]: error.summary },
      };
    const safeError = toSafeWorkspaceError(error);
    return {
      status: "error",
      summary: safeError.summary,
      safeNextAction: safeError.safeNextAction,
    };
  }
}

export async function opportunityConfirmationAction(
  _: OpportunityConfirmationActionState,
  formData: FormData,
): Promise<OpportunityConfirmationActionState> {
  const submitted = {
    submittedPostingUrl: String(formData.get("postingUrl") ?? ""),
    submittedCopiedDescription: String(formData.get("copiedDescription") ?? ""),
  };
  try {
    const result = await confirmCapturedOpportunity({
      postingUrl: formData.get("postingUrl"),
      copiedDescription: formData.get("copiedDescription"),
      capturedAt: formData.get("capturedAt"),
      title: formData.get("title"),
      company: formData.get("company"),
      location: formData.get("location"),
      workStyle: formData.get("workStyle"),
      requirements: formData.get("requirements"),
      postedAt: formData.get("postedAt"),
    });
    revalidatePath("/");
    return {
      status: "success",
      summary: `${result.opportunity.title} at ${result.opportunity.company} was saved locally.`,
      probableDuplicate: result.probableDuplicate,
      ...submitted,
    };
  } catch (error) {
    if (error instanceof OpportunityCaptureValidationError)
      return {
        status: "error",
        summary: error.summary,
        safeNextAction: error.safeNextAction,
        fieldErrors: { [error.field]: error.summary },
        ...submitted,
      };
    const safeError = toSafeWorkspaceError(error);
    const code = safeError.code;
    const field =
      code === "OPPORTUNITY_TITLE_INVALID"
        ? "title"
        : code === "OPPORTUNITY_COMPANY_INVALID"
          ? "company"
          : code === "OPPORTUNITY_LOCATION_INVALID"
            ? "location"
            : code === "OPPORTUNITY_WORK_STYLE_INVALID"
              ? "workStyle"
              : code === "OPPORTUNITY_REQUIREMENTS_INVALID"
                ? "requirements"
                : code === "OPPORTUNITY_POSTED_DATE_INVALID"
                  ? "postedAt"
                  : code === "OPPORTUNITY_CAPTURE_INVALID"
                    ? "postingUrl"
                    : undefined;
    return {
      status: "error",
      summary: safeError.summary,
      safeNextAction: safeError.safeNextAction,
      fieldErrors: field ? { [field]: safeError.summary } : undefined,
      ...submitted,
    };
  }
}

export async function initializeWorkspaceAction(): Promise<WorkspaceActionState> {
  try {
    const result = await initializeWorkspace();
    return {
      status: "success",
      summary:
        result.initialization === "created"
          ? "Private local workspace created."
          : "Private local workspace validated.",
    };
  } catch (error) {
    const safeError = toSafeWorkspaceError(error);
    return {
      status: "error",
      summary: safeError.summary,
      safeNextAction: safeError.safeNextAction,
    };
  }
}

export async function jobPreferencesAction(
  _: WorkspaceActionState,
  formData: FormData,
): Promise<WorkspaceActionState> {
  try {
    await saveJobPreferences({
      expectedRevisionId:
        String(formData.get("expectedRevisionId") ?? "") || undefined,
      values: {
        roleIntents: formData.getAll("roleIntent").map(String) as RoleIntent[],
        country: String(formData.get("country") ?? "") as Country,
        workStyleOrder: [
          "workStyleFirst",
          "workStyleSecond",
          "workStyleThird",
        ].map((name) => String(formData.get(name) ?? "")) as WorkStyle[],
        preferNcrHybridOnsite: formData.get("preferNcrHybridOnsite") === "yes",
      },
    });
    revalidatePath("/");
    return {
      status: "success",
      summary: "Search Preferences were saved locally.",
    };
  } catch (error) {
    const safeError = toSafeWorkspaceError(error);
    return {
      status: "error",
      summary: safeError.summary,
      safeNextAction: safeError.safeNextAction,
    };
  }
}

export async function sourceConfigurationAction(
  _: WorkspaceActionState,
  formData: FormData,
): Promise<WorkspaceActionState> {
  try {
    await saveSourceConfiguration({
      sourceId: String(formData.get("sourceId") ?? "") || undefined,
      expectedRevisionId:
        String(formData.get("expectedRevisionId") ?? "") || undefined,
      values: {
        name: String(formData.get("name") ?? ""),
        sourceType: String(formData.get("sourceType") ?? "") as SourceType,
        url: String(formData.get("url") ?? ""),
        accessPath: String(
          formData.get("accessPath") ?? "",
        ) as SourceAccessPath,
        policyRevision: String(formData.get("policyRevision") ?? ""),
        policyReviewedOn: String(formData.get("policyReviewedOn") ?? ""),
        policyApproved: formData.get("policyApproved") === "yes",
        requestBudget: Number(formData.get("requestBudget") ?? Number.NaN),
        rateLimitPerMinute: Number(
          formData.get("rateLimitPerMinute") ?? Number.NaN,
        ),
        retentionRule: String(formData.get("retentionRule") ?? ""),
        enabled: formData.get("enabled") === "yes",
        failureGuidance: String(formData.get("failureGuidance") ?? ""),
      },
    });
    revalidatePath("/");
    return {
      status: "success",
      summary:
        "Permitted Source was saved locally. No retrieval was performed.",
    };
  } catch (error) {
    const safeError = toSafeWorkspaceError(error);
    return {
      status: "error",
      summary: safeError.summary,
      safeNextAction: safeError.safeNextAction,
    };
  }
}

export async function careersPageUrlAction(
  _: WorkspaceActionState,
  formData: FormData,
): Promise<WorkspaceActionState> {
  try {
    await saveSourceConfiguration({
      values: createManualCareersPageSource(formData.get("careersPageUrl")),
    });
    revalidatePath("/");
    return {
      status: "success",
      summary: "Careers page saved locally. It was not opened or scanned.",
      safeNextAction:
        "Use the normal browser page when you are ready, or edit the saved source details below.",
    };
  } catch (error) {
    const safeError = toSafeWorkspaceError(error);
    return {
      status: "error",
      summary: safeError.summary,
      safeNextAction: safeError.safeNextAction,
    };
  }
}

export async function sourceRefreshAction(
  _: WorkspaceActionState,
  formData: FormData,
): Promise<WorkspaceActionState> {
  try {
    const result = await startRefreshRun({
      sourceIds: formData.getAll("sourceId").map(String),
      confirmed: formData.get("confirmed") === "yes",
    });
    revalidatePath("/");
    return {
      status: "success",
      summary: `Bounded Refresh Run ${result.status}. ${result.outcomes.length} source outcome${result.outcomes.length === 1 ? "" : "s"} recorded locally.`,
    };
  } catch (error) {
    const safeError = toSafeWorkspaceError(error);
    return {
      status: "error",
      summary: safeError.summary,
      safeNextAction: safeError.safeNextAction,
    };
  }
}

export async function jobListingsAction(
  _: WorkspaceActionState,
  formData: FormData,
): Promise<WorkspaceActionState> {
  try {
    const command = String(formData.get("jobCommand") ?? "");
    if (command === "manual-import") {
      const [sourceId, sourceConfigurationRevisionId] = String(
        formData.get("sourceId") ?? "",
      ).split(":");
      await importManualJobListing({
        sourceId,
        sourceConfigurationRevisionId,
        title: formData.get("title"),
        company: formData.get("company"),
        workStyle: formData.get("workStyle"),
        location: formData.get("location"),
        originalUrl: formData.get("originalUrl"),
        postedAt: formData.get("postedAt"),
      });
      revalidatePath("/");
      return {
        status: "success",
        summary: "Listing was imported locally with its source attribution.",
      };
    }
    if (command === "separate-duplicate") {
      await applyDuplicateOverride({
        listingId: String(formData.get("listingId") ?? ""),
        confirmed: formData.get("confirmed") === "yes",
      });
      revalidatePath("/");
      return {
        status: "success",
        summary:
          "The saved opportunity's duplicate grouping was changed locally.",
      };
    }
    if (command === "reverse-duplicate") {
      await reverseDuplicateOverride({
        overrideId: String(formData.get("overrideId") ?? ""),
        confirmed: formData.get("confirmed") === "yes",
      });
      revalidatePath("/");
      return {
        status: "success",
        summary: "The prior probable duplicate grouping was restored locally.",
      };
    }
    if (command === "calculate-fit") {
      const paths = await resolveAppDataPaths();
      const db = openDatabase(paths.databasePath);
      try {
        applyMigrations(db);
        calculateAndPersistFitAssessment(
          db,
          String(formData.get("listingId") ?? ""),
        );
      } finally {
        db.close();
      }
      revalidatePath("/");
      return {
        status: "success",
        summary:
          "Fit Assessment calculated from approved evidence and current preferences.",
      };
    }
    throw new WorkspaceError(
      "JOB_LISTING_INVALID",
      "The Job Listing action is unavailable.",
      "Choose Manual import or an available duplicate action.",
    );
  } catch (error) {
    const safeError = toSafeWorkspaceError(error);
    return {
      status: "error",
      summary: safeError.summary,
      safeNextAction: safeError.safeNextAction,
    };
  }
}

export async function importBaseResumeAction(
  _: WorkspaceActionState,
  formData: FormData,
): Promise<WorkspaceActionState> {
  try {
    const files = formData
      .getAll("baseResumeFiles")
      .filter((value): value is File => value instanceof File);
    if (
      files.length > maximumBaseResumeFiles ||
      files.some(
        (file) => file.size === 0 || file.size > maximumBaseResumeFileSize,
      ) ||
      files.reduce((total, file) => total + file.size, 0) >
        maximumBaseResumeTotalSize
    ) {
      const affected =
        files.find(
          (file) => file.size === 0 || file.size > maximumBaseResumeFileSize,
        ) ??
        files[maximumBaseResumeFiles] ??
        files[0];
      throw new WorkspaceError(
        "BASE_RESUME_INVALID",
        `The selected file ${affected?.name ?? "selection"} cannot be imported.`,
        "Choose no more than 12 readable supported files within the import size limit.",
      );
    }
    const importFiles = await Promise.all(
      files.map(async (file) => ({
        name: file.name,
        bytes: new Uint8Array(await file.arrayBuffer()),
      })),
    );
    const result = await importBaseResume({ files: importFiles });
    revalidateCareerWorkspaces();
    return {
      status: "success",
      summary: `${result.baseResume.primaryFilename} was imported as a read-only Base Resume.`,
    };
  } catch (error) {
    const safeError = toSafeWorkspaceError(error);
    return {
      status: "error",
      summary: safeError.summary,
      safeNextAction: safeError.safeNextAction,
    };
  }
}

function draftFromForm(formData: FormData): ResumeDraftContent {
  const read = (name: string) => {
    const value = String(formData.get(name) ?? "");
    if (value.length > maximumCurrentResumeText)
      throw new WorkspaceError(
        "CURRENT_BASE_RESUME_INVALID",
        "The Current Base Resume draft is too large.",
        "Shorten the draft and try again.",
      );
    return value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  };
  return {
    contact: read("contact"),
    summary: read("summary"),
    experience: read("experience"),
    projects: read("projects"),
    education: read("education"),
    skills: read("skills"),
    other: read("other"),
  };
}

function revalidateCareerWorkspaces() {
  revalidatePath("/");
  revalidatePath("/resume");
  revalidatePath("/resume/interview");
  revalidatePath("/evidence");
  revalidatePath("/career-assistant");
}

export async function resumeClarificationAction(
  _: ResumeInterviewActionState,
  formData: FormData,
): Promise<ResumeInterviewActionState> {
  try {
    const workspaceId = String(formData.get("workspaceId") ?? "");
    const taskId = String(formData.get("taskId") ?? "");
    const skip = formData.get("command") === "skip";
    await respondToResumeClarification({
      workspaceId,
      taskId,
      answer: String(formData.get("answer") ?? ""),
      skip,
    });
    revalidatePath("/resume/interview");
    revalidatePath("/resume");
    return {
      status: "success",
      summary: skip
        ? "Coach Resume recorded this as an explicit unknown and moved to the next question."
        : "Answer saved. Coach Resume moved to the next question.",
    };
  } catch (error) {
    const safe = toSafeWorkspaceError(error);
    return {
      status: "error",
      summary: safe.summary,
      safeNextAction: safe.safeNextAction,
    };
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

export async function resumeInterviewCoachAction(
  _: ResumeInterviewActionState,
  formData: FormData,
): Promise<ResumeInterviewActionState> {
  try {
    const workspaceId = String(formData.get("workspaceId") ?? "");
    const consentNonce = String(formData.get("consentNonce") ?? "");
    const candidateContent = String(formData.get("message") ?? "").trim();
    if (
      !consentNonce ||
      consentNonce.length > 120 ||
      !candidateContent ||
      candidateContent.length > 1200 ||
      /[\u0000-\u001f\u007f-\u009f]/.test(candidateContent)
    )
      throw new WorkspaceError(
        "RESUME_COACH_INVALID",
        "Write a concise message before explicitly sending it to local Coach Resume.",
        "Review the local-only disclosure and try again.",
      );
    const interview = await readResumeClarificationInterview(workspaceId);
    const task = interview?.current;
    if (!task)
      throw new WorkspaceError(
        "RESUME_COACH_INVALID",
        "There is no saved clarification question ready for Coach Resume.",
        "Return to the interview after evidence planning is complete.",
      );
    const configuration = await readLocalModelGatewayConfiguration();
    const connection = {
      configurationRevisionId: configuration.id,
      configurationDigest: configuration.configurationDigest,
      modelIdentifier: configuration.modelIdentifier,
    };
    const [context, transcript] = await Promise.all([
      readBoundedResumeInterviewContext(workspaceId, task.id),
      readBoundedResumeInterviewTranscript(workspaceId, task.id),
    ]);
    const input = {
      connection,
      workspaceId,
      taskId: task.id,
      question: task.question,
      context,
      transcript: [...transcript, `Candidate: ${candidateContent}`].slice(-20),
      consentNonce,
    };
    const reply = await requestResumeInterviewCoach({
      ...input,
      consentFingerprint: resumeInterviewCoachConsentFingerprint(input),
    });
    const coachContent = reply.followUp
      ? `${reply.question} ${reply.followUp}`
      : reply.question;
    await recordResumeInterviewCoachTurn({
      workspaceId,
      taskId: task.id,
      candidateContent,
      coachContent,
    });
    revalidatePath("/resume/interview");
    revalidatePath("/resume");
    return {
      status: "success",
      summary:
        "Coach Resume replied. Your saved answer or skip remains the only way to complete this question.",
    };
  } catch (error) {
    const safe = toSafeWorkspaceError(error);
    return {
      status: "error",
      summary: safe.summary,
      safeNextAction: safe.safeNextAction,
    };
  }
}

export async function currentBaseResumeAction(
  _: WorkspaceActionState,
  formData: FormData,
): Promise<WorkspaceActionState> {
  try {
    const command = String(formData.get("currentResumeCommand") ?? "");
    if (command === "import") {
      const file = formData.get("currentResumePdf");
      if (!(file instanceof File))
        throw new WorkspaceError(
          "CURRENT_BASE_RESUME_INVALID",
          "Choose one resume PDF to import.",
          "Choose a text-readable PDF and try again.",
        );
      await importCurrentBaseResume({
        filename: file.name,
        bytes: new Uint8Array(await file.arrayBuffer()),
      });
    } else if (command === "save")
      await saveCurrentBaseResumeDraft({
        draftId: String(formData.get("draftId") ?? ""),
        content: draftFromForm(formData),
      });
    else if (command === "propose")
      await generateCurrentBaseResumeProposals({
        draftId: String(formData.get("draftId") ?? ""),
      });
    else if (command === "resolve") {
      const decision = String(formData.get("decision") ?? "");
      if (
        decision !== "approved" &&
        decision !== "edited" &&
        decision !== "rejected"
      )
        throw new WorkspaceError(
          "CURRENT_BASE_RESUME_INVALID",
          "The proposed change decision is unavailable.",
          "Choose approve, save edited, or reject and try again.",
        );
      await resolveCurrentBaseResumeProposal({
        proposalId: String(formData.get("proposalId") ?? ""),
        expectedDecisionRevisionId: String(
          formData.get("expectedDecisionRevisionId") ?? "",
        ),
        decision,
        text: String(formData.get("proposalText") ?? "") || undefined,
      });
    } else if (command === "approve-version")
      await approveCurrentBaseResumeVersion({
        draftId: String(formData.get("draftId") ?? ""),
        explicitApproval: formData.get("explicitApproval") === "yes",
      });
    else
      throw new WorkspaceError(
        "CURRENT_BASE_RESUME_INVALID",
        "The requested Current Base Resume action is unavailable.",
        "Choose a Current Base Resume action and try again.",
      );
    revalidateCareerWorkspaces();
    return {
      status: "success",
      summary: "Current Base Resume action completed.",
    };
  } catch (error) {
    const safeError = toSafeWorkspaceError(error);
    return {
      status: "error",
      summary: safeError.summary,
      safeNextAction: safeError.safeNextAction,
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
          safeNextAction = "Go to Resume to regenerate your draft with updated evidence.";
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
          : `${deleted.findingsDeleted} documented finding${deleted.findingsDeleted === 1 ? "" : "s"} and this ${category} were permanently deleted. Changes detected — your base resume needs updating.`,
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
    if (documentedWorkspaceId) {
      await interpretWorkspaceEvidence(documentedWorkspaceId);

      const startDate = String(formData.get("startDate") ?? "").trim();
      const endDate = String(formData.get("endDate") ?? "").trim();
      const dateText = [startDate, endDate].filter(Boolean).join(" - ").trim();
      const role = String(formData.get("role") ?? "").trim();
      const itemName =
        String(formData.get("itemName") ?? "").trim() ||
        String(formData.get("projectName") ?? "").trim() ||
        String(formData.get("company") ?? "").trim() ||
        String(formData.get("role") ?? "").trim();

      if (dateText || role) {
        const paths = await resolveAppDataPaths();
        const db = openDatabase(paths.databasePath);
        try {
          applyMigrations(db);
          const now = new Date().toISOString();
          if (dateText) {
            const task = db
              .prepare(
                "SELECT id, item_key AS itemKey, item_name AS itemName FROM resume_clarification_tasks WHERE workspace_id = ? AND item_name = ? AND category = 'dates' AND status = 'pending'",
              )
              .get(documentedWorkspaceId, itemName) as
              { id: string; itemKey: string; itemName: string } | undefined;
            if (task) {
              const responseId = createUuidV7();
              db.prepare(
                "INSERT INTO resume_clarification_task_responses (id, workspace_id, task_id, disposition, answer_text, created_at) VALUES (?, ?, ?, 'answered', ?, ?)",
              ).run(responseId, documentedWorkspaceId, task.id, dateText, now);
              db.prepare(
                "UPDATE resume_clarification_tasks SET status = 'answered' WHERE id = ? AND workspace_id = ?",
              ).run(task.id, documentedWorkspaceId);
              persistClarifiedEvidenceForResponseInDatabase(db, {
                workspaceId: documentedWorkspaceId,
                taskId: task.id,
                responseId,
                candidateText: dateText,
                now,
              });
            }
          }
          if (role) {
            const roleTask = db
              .prepare(
                "SELECT id, item_key AS itemKey, item_name AS itemName FROM resume_clarification_tasks WHERE workspace_id = ? AND item_name = ? AND category = 'role' AND status = 'pending'",
              )
              .get(documentedWorkspaceId, itemName) as
              { id: string; itemKey: string; itemName: string } | undefined;
            if (roleTask) {
              const responseId = createUuidV7();
              db.prepare(
                "INSERT INTO resume_clarification_task_responses (id, workspace_id, task_id, disposition, answer_text, created_at) VALUES (?, ?, ?, 'answered', ?, ?)",
              ).run(responseId, documentedWorkspaceId, roleTask.id, role, now);
              db.prepare(
                "UPDATE resume_clarification_tasks SET status = 'answered' WHERE id = ? AND workspace_id = ?",
              ).run(roleTask.id, documentedWorkspaceId);
              persistClarifiedEvidenceForResponseInDatabase(db, {
                workspaceId: documentedWorkspaceId,
                taskId: roleTask.id,
                responseId,
                candidateText: role,
                now,
              });
            }
          }
        } finally {
          db.close();
        }
      }


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


export async function dataStorageAction(
  _: WorkspaceActionState,
  formData: FormData,
): Promise<WorkspaceActionState> {
  const artifactId = String(formData.get("artifactId") ?? "");
  try {
    const command = String(formData.get("dataCommand") ?? "");
    const input = {
      artifactId,
      expectedRevision: Number(formData.get("expectedRevision") ?? 0),
      confirmed: formData.get("confirmed") === "yes",
    };
    if (command === "backup") await createLocalBackup();
    else if (command === "history-export") await createActivityHistoryExport();
    else if (command === "trash") await trashActivityHistoryExport(input);
    else if (command === "restore") await restoreActivityHistoryExport(input);
    else if (command === "permanent-delete")
      await permanentlyDeleteBackup(input);
    else if (command === "cleanup")
      await cleanupExpiredTrash({ confirmed: input.confirmed });
    else
      throw new WorkspaceError(
        "DATA_ARTIFACT_INVALID",
        "The requested data action is unavailable.",
        "Choose a Data & Storage action and try again.",
      );
    revalidatePath("/");
    return { status: "success", summary: "Local data action completed." };
  } catch (error) {
    await recordDataStorageFailure({ artifactId });
    const safeError = toSafeWorkspaceError(error);
    return {
      status: "error",
      summary: safeError.summary,
      safeNextAction: safeError.safeNextAction,
    };
  }
}
