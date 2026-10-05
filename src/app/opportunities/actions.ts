"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { deleteCapturedOpportunity, updateCapturedOpportunity } from "@/domain/opportunities/captured-opportunities";
import { OpportunityCaptureValidationError } from "@/domain/opportunities/capture-draft";
import { createFormattedOpportunity } from "@/application/opportunities/create-formatted-opportunity";
import { reviewedOpportunitySource } from "@/domain/opportunities/opportunity-source";
import { toSafeWorkspaceError } from "@/domain/workspace/types";

export type OpportunityMutationState = {
  status: "idle" | "success" | "error";
  summary: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
};
const fields = ["postingUrl", "copiedDescription", "refinedDescription", "capturedAt", "title", "company", "location", "workStyle", "requirements", "postedAt"] as const;
export async function updateOpportunityAction(_: OpportunityMutationState, form: FormData): Promise<OpportunityMutationState> {
  const values = Object.fromEntries(fields.map(name => [name, String(form.get(name) ?? "")]));
  try {
    const updated = await updateCapturedOpportunity({
      postingUrl: values.postingUrl, copiedDescription: values.copiedDescription,
      refinedDescription: values.refinedDescription, capturedAt: values.capturedAt, title: values.title, company: values.company,
      location: values.location, workStyle: values.workStyle, requirements: values.requirements,
      postedAt: values.postedAt, opportunityId: String(form.get("opportunityId") ?? ""),
      expectedRevisionId: String(form.get("expectedRevisionId") ?? ""),
    });
    revalidatePath("/");
    revalidatePath(`/opportunities/${String(form.get("opportunityId"))}`);
    return { status: "success", summary: "Opportunity updated. Regenerate its tailored resume to reflect the changes.", values: { ...values, refinedDescription: updated.refinedDescription ?? "" } };
  } catch (error) {
    return mutationFailure(error, values);
  }
}
function mutationFailure(error: unknown, values: Record<string, string>): OpportunityMutationState {
  const safe = toSafeWorkspaceError(error);
  const field = error instanceof OpportunityCaptureValidationError ? error.field : ({
    OPPORTUNITY_TITLE_INVALID: "title", OPPORTUNITY_COMPANY_INVALID: "company", OPPORTUNITY_LOCATION_INVALID: "location",
    OPPORTUNITY_WORK_STYLE_INVALID: "workStyle", OPPORTUNITY_REQUIREMENTS_INVALID: "requirements", OPPORTUNITY_POSTED_DATE_INVALID: "postedAt",
  } as Record<string, string>)[safe.code];
  return { status: "error", summary: `${safe.summary} ${safe.safeNextAction}`, values, fieldErrors: field ? { [field]: safe.summary } : undefined };
}

export async function createOpportunityAction(_: OpportunityMutationState, form: FormData): Promise<OpportunityMutationState> {
  const values = { postingUrl: String(form.get("postingUrl") ?? ""), copiedDescription: String(form.get("copiedDescription") ?? "") };
  let id: string;
  const source = reviewedOpportunitySource(form.get("sourceSnapshot"), values) ?? values;
  try {
    const result = await createFormattedOpportunity(source);
    id = result.opportunity.id;
    revalidatePath("/");
  } catch (error) { return mutationFailure(error, values); }
  redirect(`/opportunities/${id}?added=1`);
}

export async function deleteOpportunityAction(_: OpportunityMutationState, form: FormData): Promise<OpportunityMutationState> {
  let cleanupIncomplete = false;
  try {
    const result = await deleteCapturedOpportunity({ opportunityId: String(form.get("opportunityId") ?? ""), expectedRevisionId: String(form.get("expectedRevisionId") ?? ""), confirmation: String(form.get("confirmation") ?? "") });
    revalidatePath("/");
    revalidatePath(`/opportunities/${String(form.get("opportunityId"))}`);
    cleanupIncomplete = result.cleanupIncomplete;
  } catch (error) {
    const safe = toSafeWorkspaceError(error);
    return { status: "error", summary: `${safe.summary} ${safe.safeNextAction}` };
  }
  redirect(cleanupIncomplete ? "/?deleted=cleanup-pending" : "/?deleted=success");
}

export async function tailorOpportunityAction(_: OpportunityMutationState, form: FormData): Promise<OpportunityMutationState> {
  try {
    const { generateTailoredResume, editTailoredResume } = await import("@/application/opportunities/tailored-resume");
    const input = { opportunityId: String(form.get("opportunityId") ?? ""), expectedFingerprint: String(form.get("fingerprint") ?? ""), expectedGenerationId: String(form.get("generationId") ?? ""), consent: form.get("consent") === "on" };
    if (form.get("mode") === "edit") await editTailoredResume({ ...input, sectionTexts: form.getAll("sectionText").map(String) });
    else await generateTailoredResume(input);
    revalidatePath(`/opportunities/${input.opportunityId}`);
    return { status: "success", summary: "Tailored resume saved. Review it before downloading." };
  } catch (error) {
    const safe = toSafeWorkspaceError(error);
    return { status: "error", summary: `${safe.summary} ${safe.safeNextAction}` };
  }
}

