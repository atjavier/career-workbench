"use server";

import { importBaseResume, maximumBaseResumeFiles, maximumBaseResumeFileSize, maximumBaseResumeTotalSize } from "@/domain/base-resume/import-base-resume";
import { toSafeWorkspaceError, WorkspaceError } from "@/domain/workspace/types";
import { revalidateCareerWorkspaces } from "./action-helpers";
import type { WorkspaceActionState } from "./action-state";

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

