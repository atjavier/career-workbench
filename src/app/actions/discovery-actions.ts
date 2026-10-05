"use server";

import { startRefreshRun } from "@/application/discovery/refresh-runs";
import { assessCapturedOpportunity, recordOpportunityDecision } from "@/application/fit/ai-opportunity-assessment";
import { applyDuplicateOverride, importManualJobListing, reverseDuplicateOverride } from "@/domain/discovery/job-listings";
import { saveJobPreferences, type Country, type RoleIntent, type WorkStyle } from "@/domain/discovery/job-preferences";
import { createManualCareersPageSource, saveSourceConfiguration, type SourceAccessPath, type SourceType } from "@/domain/discovery/source-configurations";
import { calculateAndPersistFitAssessment } from "@/domain/fit/fit-assessment";
import { toSafeWorkspaceError, WorkspaceError } from "@/domain/workspace/types";
import { resolveAppDataPaths } from "@/files/app-data";
import { applyMigrations, openDatabase } from "@/persistence/database";
import { revalidatePath } from "next/cache";
import type { OpportunityAssessmentActionState, WorkspaceActionState } from "./action-state";

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

