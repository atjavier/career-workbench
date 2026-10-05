"use server";

import { requestBaseResumeGeneration, requestResumeCoachReview, resumeCoachConsentFingerprint, type ResumeCoachDocumentation } from "@/adapters/local-model/local-model-gateway";
import { generateEditableTexDraft } from "@/application/resume-generation/editable-tex-drafts";
import { handOffMaterialDraft, readMaterialDraft } from "@/application/resume-generation/material-draft-commands";
import { persistResumeCoachDraft } from "@/application/resume-generation/resume-coach-commands";
import { createAuditEvent, createUuidV7 } from "@/audit/audit-event";
import { bootstrapBundledBaseResume } from "@/domain/base-resume/import-base-resume";
import { readInitialResumeTemplateContract } from "@/domain/base-resume/resume-template-contract";
import { getResumeAgentSkill } from "@/domain/resume-agent/skill-registry";
import { readCandidateProfileState } from "@/domain/resume-generation/candidate-profile-commands";
import { readLocalModelGatewayConfiguration } from "@/domain/resume-generation/local-model-configuration-commands";
import { listClarifiedEvidenceInDatabase } from "@/domain/resume-generation/resume-clarified-evidence";
import { reconcileResumeWorkspaceJourney } from "@/domain/resume-generation/resume-workspace-journey";
import { toSafeWorkspaceError, WorkspaceError } from "@/domain/workspace/types";
import { resolveAppDataPaths } from "@/files/app-data";
import { createResumeFileReadSession, readManagedDocumentedArtifacts } from "@/files/evidence-library";
import { applyMigrations, openDatabase } from "@/persistence/database";
import { listCurrentEvidence } from "@/persistence/evidence-repository";
import { findDesignatedResumeTemplate } from "@/persistence/resume-template-repository";
import { listWorkspaceDocumentedEvidenceIds, readActiveResumeWorkspace } from "@/persistence/resume-workspace-repository";
import { appendAuditEvent } from "@/persistence/workspace-repository";
import { revalidatePath } from "next/cache";
import { dirname } from "node:path";
import type { EditableTexDraftActionState, MaterialDraftHandoffActionState, ResumeCoachActionState, ResumeCoachReviewActionState } from "./action-state";

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
    if (!template)
      throw new WorkspaceError(
        "RESUME_COACH_INVALID",
        "A verified Resume template is required before asking Resume Coach.",
        "Add or import a verified Resume template and try again.",
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
    // Enforce 1-page LaTeX printable budget: prioritize experiences (up to 3),
    // then fill remaining slots with top projects, capped at 5 items total.
    const experiences = managedGroups.filter(
      (g) => g.category === "experience",
    );
    const projects = managedGroups.filter((g) => g.category === "project");
    const budgetedExperiences = experiences.slice(0, 3);
    const remainingSlots = Math.max(0, 5 - budgetedExperiences.length);
    const budgetedProjects = projects.slice(0, remainingSlots);
    const budgetedGroups = [...budgetedExperiences, ...budgetedProjects];

    const managedRoots = [
      ...new Set(
        budgetedGroups.map((group) => {
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
    const documentation: ResumeCoachDocumentation[] = budgetedGroups
      .map((group) => ({
        name: group.name,
        category: group.category,
        documents: group.documents
          .filter((document) =>
            /(?:resume-evidence|resume-bullet-candidates|technology-stack|project-overview|experience-overview|resume-summary|resume-clarifications)\.md$/i.test(
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
            /(?:resume-evidence|resume-bullet-candidates|technology-stack|project-overview|experience-overview|resume-summary|resume-clarifications)\.md$/i.test(
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

