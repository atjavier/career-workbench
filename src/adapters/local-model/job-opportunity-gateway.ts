import type { OpportunityReaderRetry } from "@/domain/opportunities/job-opportunity-reader-contract";
import type { ClarificationPlanningInput } from "@/domain/resume-generation/clarification-plan";
import { WorkspaceError } from "@/domain/workspace/types";
import { jobOpportunityReaderInstruction } from "./job-opportunity-reader-agent";
import type { FetchLike, LocalModelConnection } from "./local-model-contracts";
import { boundedText, plain, validConnection } from "./model-boundaries";
import { native, nativeText } from "./native-transport";
import { buildClarificationPlanningPrompt } from "./resume-clarification-planner-agent";

/** Reuse the bounded stateless loopback transport for each tailoring stage. */
export async function requestJobTailoringStage(
  connection: LocalModelConnection,
  stage: import("@/domain/opportunities/tailoring-contract").TailoringStage,
  packet: unknown,
  fetcher: FetchLike = fetch,
): Promise<Record<string, unknown>> {
  if (!validConnection(connection) || !["analyst", "writer", "reviewer"].includes(stage))
    throw new WorkspaceError("TAILORED_RESUME_INVALID", "The local tailoring request is invalid.", "Check local AI settings and try again.");
  const { jobTailoringInstructions } = await import("./job-tailoring-agents");
  return native(connection, jobTailoringInstructions[stage], packet, stage === "analyst" ? 1600 : 900, fetcher, "RESUME_COACH_UNAVAILABLE", 16000);
}

/** Source-only opportunity extraction; no tools, state, evidence, URL or resume packet. */
export async function requestJobOpportunityReader(connection: LocalModelConnection, description: string, fetcher: FetchLike = fetch, retry?: OpportunityReaderRetry): Promise<Record<string, unknown>> {
  if (!validConnection(connection)) throw new WorkspaceError("OPPORTUNITY_DRAFT_UNAVAILABLE", "Local AI is not configured.", "Open Settings to configure local AI, then try again.");
  const packet = retry ? { copiedDescription: description, unresolvedFields: retry.unresolvedFields } : { copiedDescription: description };
  const content = await nativeText(connection, jobOpportunityReaderInstruction, packet, retry ? 1000 : 5000, fetcher, "RESUME_COACH_UNAVAILABLE", 250000, "off", 150_000);
  const fenced = /^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i.exec(content.trim());
  try { return JSON.parse((fenced?.[1] ?? content).trim()); } catch { throw new WorkspaceError("OPPORTUNITY_DRAFT_INVALID", "Local AI could not prepare the job details.", "Try adding the opportunity again."); }
}

export async function requestClarificationPlan(connection: LocalModelConnection, input: ClarificationPlanningInput, fetcher: FetchLike = fetch): Promise<Record<string, unknown>> {
  if (!validConnection(connection) || !["project", "experience"].includes(input.category) || !plain(input.name, 300) || !boundedText(input.facts, 200_000)) throw new WorkspaceError("RESUME_COACH_INVALID", "The evidence question request is invalid.", "Review the documented evidence and try again.");
  return native(connection, buildClarificationPlanningPrompt(input), input, 1800, fetcher, "RESUME_COACH_UNAVAILABLE", 16000, "off", 150_000);
}

