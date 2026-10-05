"use server";

import { saveCandidateProfile } from "@/domain/resume-generation/candidate-profile-commands";
import { toSafeWorkspaceError } from "@/domain/workspace/types";
import { revalidatePath } from "next/cache";
import type { CandidateProfileActionState, CandidateProfileField } from "./action-state";

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
    revalidatePath("/resume/profile");
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

