"use server";

import { cleanupExpiredTrash, createActivityHistoryExport, createLocalBackup, permanentlyDeleteBackup, recordDataStorageFailure, restoreActivityHistoryExport, trashActivityHistoryExport } from "@/domain/data-storage/data-storage";
import { toSafeWorkspaceError, WorkspaceError } from "@/domain/workspace/types";
import { revalidatePath } from "next/cache";
import type { WorkspaceActionState } from "./action-state";

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

