import { WorkspaceError } from "@/domain/workspace/types";
import type { FetchLike, OpportunityAssessmentRequest, OpportunityAssessmentResponse } from "./local-model-contracts";
import { maxResponse, plain, sha, validConnection } from "./model-boundaries";
import { opportunityAssessmentConsentFingerprint } from "./model-consent";
import { native } from "./native-transport";

function assessmentInvalid(
  message: string,
  next = "Review the selected opportunity material and try the assessment again.",
): never {
  throw new WorkspaceError("OPPORTUNITY_ASSESSMENT_INVALID", message, next);
}

export function validateOpportunityAssessmentResponse(
  value: unknown,
  request: OpportunityAssessmentRequest,
): OpportunityAssessmentResponse {
  if (!value || typeof value !== "object" || Array.isArray(value))
    assessmentInvalid("The local model returned an unusable assessment.");
  const item = value as Record<string, unknown>;
  const strengths = item.strengths;
  const gaps = item.gaps;
  const unknowns = item.unknowns;
  const excerpt = (value: unknown) => {
    if (!value || typeof value !== "object") return false;
    const range = value as { start?: unknown; end?: unknown };
    return (
      Number.isInteger(range.start) &&
      Number.isInteger(range.end) &&
      (range.start as number) >= 0 &&
      (range.end as number) > (range.start as number) &&
      (range.end as number) <= request.opportunity.copiedDescription.length &&
      (range.end as number) - (range.start as number) <= 500
    );
  };
  const predicts = (text: unknown) =>
    typeof text === "string" &&
    /\b(hired|hire|interview|offer|employer intent|will get)\b/i.test(text);
  if (
    item.schemaVersion !== 1 ||
    item.selectionEcho !== request.consentFingerprint ||
    !Array.isArray(strengths) ||
    strengths.length > 12 ||
    !Array.isArray(gaps) ||
    gaps.length > 12 ||
    !Array.isArray(unknowns) ||
    unknowns.length > 12 ||
    strengths.some(
      (entry) =>
        !entry ||
        typeof entry !== "object" ||
        !plain((entry as { text?: unknown }).text, 900) ||
        predicts((entry as { text?: unknown }).text) ||
        !excerpt((entry as { excerpt?: unknown }).excerpt) ||
        !Array.isArray(
          (entry as { evidenceIndexes?: unknown }).evidenceIndexes,
        ) ||
        !(entry as { evidenceIndexes: unknown[] }).evidenceIndexes.length ||
        (entry as { evidenceIndexes: unknown[] }).evidenceIndexes.some(
          (index) =>
            !Number.isInteger(index) ||
            (index as number) < 0 ||
            (index as number) >= request.evidence.length,
        ),
    ) ||
    gaps.some(
      (entry) =>
        !entry ||
        typeof entry !== "object" ||
        !plain((entry as { text?: unknown }).text, 900) ||
        predicts((entry as { text?: unknown }).text) ||
        !excerpt((entry as { excerpt?: unknown }).excerpt),
    ) ||
    unknowns.some((entry) => !plain(entry, 500) || predicts(entry))
  )
    assessmentInvalid("The local model returned unsafe assessment guidance.");
  const result = {
    schemaVersion: 1 as const,
    strengths: strengths as OpportunityAssessmentResponse["strengths"],
    gaps: gaps as OpportunityAssessmentResponse["gaps"],
    unknowns: unknowns as string[],
    selectionEcho: request.consentFingerprint,
  };
  if (JSON.stringify(result).length > maxResponse)
    assessmentInvalid(
      "The local model assessment is too large to review safely.",
    );
  return result;
}

export async function requestOpportunityAssessment(
  request: OpportunityAssessmentRequest,
  fetcher: FetchLike = fetch,
): Promise<OpportunityAssessmentResponse> {
  if (
    !validConnection(request.connection) ||
    !plain(request.profileSummary, 4_000) ||
    !sha(request.profileDigest) ||
    !sha(request.templateDigest) ||
    !plain(request.opportunity.id, 64) ||
    !sha(request.opportunity.contentDigest) ||
    !plain(request.opportunity.copiedDescription, 20_000) ||
    !request.opportunity.requirements.length ||
    request.opportunity.requirements.length > 20 ||
    request.opportunity.requirements.some((item) => !plain(item, 1_000)) ||
    !request.evidence.length ||
    request.evidence.length > 50 ||
    request.evidence.some(
      (item) =>
        !plain(item.id, 64) ||
        !plain(item.factualText, 4_000) ||
        !sha(item.contentDigest),
    ) ||
    request.consentFingerprint !==
      opportunityAssessmentConsentFingerprint(request)
  )
    assessmentInvalid(
      "The selected local assessment material cannot be sent safely.",
    );
  return validateOpportunityAssessmentResponse(
    await native(
      request.connection,
      "Return only JSON. Assess semantic resume-to-opportunity fit using supplied evidence. Never predict hiring, interviews, offers, or employer intent.",
      {
        schemaVersion: 1,
        selectionEcho: request.consentFingerprint,
        profile: request.profileSummary,
        opportunity: {
          title: request.opportunity.title,
          company: request.opportunity.company,
          requirements: request.opportunity.requirements,
          copiedDescription: request.opportunity.copiedDescription,
        },
        evidence: request.evidence.map(({ factualText, contentDigest }) => ({
          factualText,
          contentDigest,
        })),
        responseShape: {
          strengths: [
            {
              text: "string",
              evidenceIndexes: [0],
              excerpt: { start: 0, end: 1 },
            },
          ],
          gaps: [{ text: "string", excerpt: { start: 0, end: 1 } }],
          unknowns: ["string"],
          selectionEcho: request.consentFingerprint,
        },
      },
      1100,
      fetcher,
      "OPPORTUNITY_ASSESSMENT_UNAVAILABLE",
    ),
    request,
  );
}

