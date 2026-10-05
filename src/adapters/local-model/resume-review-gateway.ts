import { resumeCoachSystemInstruction as resumeCoachReviewSystemInstruction } from "@/adapters/local-model/resume-coach-agent";
import type { FetchLike, ResumeCoachRequest, ResumeCoachReviewResponse } from "./local-model-contracts";
import { exactKeys, maxRequest, plain } from "./model-boundaries";
import { invalid } from "./model-consent";
import { native } from "./native-transport";
import { resumeRelevantModelEvidence } from "./resume-generation-gateway";
import { validCoach } from "./resume-response-validation";

function coachReviewResponse(
  value: unknown,
  request: ResumeCoachRequest,
): ResumeCoachReviewResponse {
  if (!value || typeof value !== "object" || Array.isArray(value))
    invalid("The Resume Coach returned an unusable response.");
  const item = value as Record<string, unknown>;
  const ratings = item.ratings;
  const strengths = item.strengths;
  const concerns = item.concerns;
  const recommendations = item.recommendations;
  const allowedAreas = new Set([
    "clarity",
    "relevance",
    "credibility",
    "specificity",
    "atsReadability",
  ]);
  if (
    !exactKeys(item, [
      "schemaVersion",
      "selectionEcho",
      "ratings",
      "strengths",
      "concerns",
      "recommendations",
    ]) ||
    item.schemaVersion !== 1 ||
    item.selectionEcho !== request.consentFingerprint ||
    !Array.isArray(ratings) ||
    ratings.length !== 5 ||
    new Set(ratings.map((entry) => String((entry as { area?: unknown }).area)))
      .size !== 5 ||
    ratings.some(
      (entry) =>
        !entry ||
        typeof entry !== "object" ||
        !allowedAreas.has(String((entry as { area?: unknown }).area)) ||
        !Number.isInteger((entry as { score?: unknown }).score) ||
        (entry as { score: number }).score < 1 ||
        (entry as { score: number }).score > 5 ||
        !plain((entry as { rationale?: unknown }).rationale, 600),
    ) ||
    !Array.isArray(strengths) ||
    strengths.length > 8 ||
    !Array.isArray(concerns) ||
    concerns.length > 8 ||
    !Array.isArray(recommendations) ||
    recommendations.length > 8 ||
    [...strengths, ...concerns, ...recommendations].some(
      (entry) => !plain(entry, 700),
    )
  )
    invalid("The Resume Coach returned malformed or ambiguous feedback.");
  return {
    schemaVersion: 1,
    ratings: ratings as ResumeCoachReviewResponse["ratings"],
    strengths: strengths as string[],
    concerns: concerns as string[],
    recommendations: recommendations as string[],
    selectionEcho: request.consentFingerprint,
  };
}

export async function requestResumeCoachReview(
  request: ResumeCoachRequest,
  fetcher: FetchLike = fetch,
): Promise<ResumeCoachReviewResponse> {
  validCoach(request);
  const input = {
    schemaVersion: 1,
    selectionEcho: request.consentFingerprint,
    focus: request.userRequest,
    currentResumeSections: request.currentResumeSections ?? [],
    profile: request.profileSnapshot,
    documentation: request.documentation ?? [],
    evidence: resumeRelevantModelEvidence(request.evidence),
    responseShape: {
      schemaVersion: 1,
      ratings: [
        { area: "clarity", score: 1, rationale: "string" },
        { area: "relevance", score: 1, rationale: "string" },
        { area: "credibility", score: 1, rationale: "string" },
        { area: "specificity", score: 1, rationale: "string" },
        { area: "atsReadability", score: 1, rationale: "string" },
      ],
      strengths: ["string"],
      concerns: ["string"],
      recommendations: ["string"],
      selectionEcho: request.consentFingerprint,
    },
  };
  if (JSON.stringify(input).length > maxRequest)
    return {
      schemaVersion: 1,
      selectionEcho: request.consentFingerprint,
      ratings: [
        "clarity",
        "relevance",
        "credibility",
        "specificity",
        "atsReadability",
      ].map((area) => ({
        area: area as ResumeCoachReviewResponse["ratings"][number]["area"],
        score: 3,
        rationale:
          "The bounded local review packet is too large for a model call; review the saved evidence in smaller workspace groups.",
      })),
      strengths: [],
      concerns: [
        "The documented work is too large for one local-model review packet.",
      ],
      recommendations: [
        "Review one project or experience collection at a time before requesting another coach review.",
      ],
    };
  return coachReviewResponse(
    await native(
      request.connection,
      resumeCoachReviewSystemInstruction,
      input,
      1_200,
      fetcher,
      "RESUME_COACH_UNAVAILABLE",
    ),
    request,
  );
}

