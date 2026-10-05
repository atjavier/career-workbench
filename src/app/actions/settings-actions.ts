"use server";

import { configureLocalModel } from "@/domain/resume-generation/local-model-configuration-commands";
import { toSafeWorkspaceError } from "@/domain/workspace/types";
import { revalidatePath } from "next/cache";
import type { WorkspaceActionState } from "./action-state";

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

