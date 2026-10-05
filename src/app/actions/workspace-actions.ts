"use server";

import { beginResumeEvidenceIntake, runResumeEvidenceIntake } from "@/application/resume-generation/resume-evidence-intake";
import { bootstrapBundledBaseResume } from "@/domain/base-resume/import-base-resume";
import { saveCandidateProfile } from "@/domain/resume-generation/candidate-profile-commands";
import { createResumeWorkspace, permanentlyDeleteResumeWorkspace, selectResumeWorkspace } from "@/domain/resume-generation/resume-workspace-commands";
import { reconcileResumeWorkspaceJourney } from "@/domain/resume-generation/resume-workspace-journey";
import { initializeWorkspace } from "@/domain/workspace/initialize-workspace";
import { toSafeWorkspaceError, WorkspaceError } from "@/domain/workspace/types";
import { chooseLocalEvidenceFolder } from "@/files/local-folder-picker";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import type { FolderPickerActionState, WorkspaceActionState } from "./action-state";

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
    revalidatePath("/resume/profile");
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

