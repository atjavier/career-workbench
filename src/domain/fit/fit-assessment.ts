import { createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { createAuditEvent, createUuidV7 } from "@/audit/audit-event";
import { WorkspaceError } from "@/domain/workspace/types";
import {
  listCapturedOpportunities,
  listCapturedRevisions,
  parseStoredRequirements,
} from "@/persistence/captured-opportunities-repository";
import {
  listApprovedEvidence,
  type EvidenceRevision,
} from "@/persistence/evidence-repository";
import {
  insertCapturedFitAssessment,
  insertCapturedFitAssessmentEvidence,
  latestCapturedFitAssessment,
  type StoredCapturedFitAssessment,
} from "@/persistence/fit-assessment-repository";
import { currentJobPreferenceRevision } from "@/persistence/job-preferences-repository";
import { appendAuditEvent } from "@/persistence/workspace-repository";

export const FIT_RULESET = {
  id: "evidence-fit-v2",
  version: "2.0.0",
  materialGapThreshold: 1,
  significantMismatchThreshold: 2,
} as const;
const hash = (value: unknown) =>
  `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
const rulesetDigest = hash(FIT_RULESET);
const maxEvidenceSnapshotChars = 450_000;
const countryNames: Record<string, string[]> = {
  PH: ["philippines", "philippine"],
  SG: ["singapore"],
  AU: ["australia"],
  CA: ["canada"],
  GB: ["united kingdom", "great britain", "uk"],
  JP: ["japan"],
  US: ["united states", "usa", "u.s."],
};
export type FitLabel = "Strong" | "Potential" | "Stretch";
export type FitFactor = {
  factor:
    | "requirements"
    | "gaps"
    | "seniority"
    | "location"
    | "workStyle"
    | "freshness";
  state: "aligned" | "gap" | "mismatch" | "unknown" | "stale";
  detail: string;
};
type Opportunity = {
  id: string;
  revisionId: string;
  contentDigest: string;
  title: string;
  company: string;
  location: string;
  workStyle: string;
  postedAt: string;
  capturedAt: string;
  requirements: string[];
  copiedDescription: string;
};
type Preference = {
  id: string;
  revisionNumber: number;
  roleIntents: string;
  country: string;
  workStyleOrder: string;
  preferNcrHybridOnsite: number;
  contentDigest: string;
  createdAt: string;
};
export type CapturedFitAssessment = Omit<
  StoredCapturedFitAssessment,
  "opportunitySnapshot" | "preferenceSnapshot" | "factorOutcomes"
> & {
  opportunitySnapshot: unknown;
  preferenceSnapshot: unknown;
  factorOutcomes: FitFactor[];
};
const words = (value: string) =>
  new Set(
    value
      .toLocaleLowerCase()
      .split(/[^a-z0-9+#.-]+/)
      .filter((word) => word.length > 2),
  );
const hasCountry = (location: string, country: string) =>
  countryNames[country]?.some((name) =>
    location.toLocaleLowerCase().includes(name),
  ) ?? false;
const date = (value: string) => {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export function calculateCapturedFitAssessment(input: {
  opportunity: Opportunity;
  evidence: EvidenceRevision[];
  preference: Preference;
  calculatedAt: string;
}): CapturedFitAssessment {
  const calculated = date(input.calculatedAt);
  if (!calculated || new Date(calculated).toISOString() !== input.calculatedAt)
    throw new WorkspaceError(
      "FIT_ASSESSMENT_INPUT_MISSING",
      "The fit calculation time is invalid.",
      "Try calculating fit again.",
    );
  const evidenceText = input.evidence.map((item) => item.factualText).join(" ");
  const evidenceWords = words(evidenceText);
  const requirementWords = words(input.opportunity.requirements.join(" "));
  const overlap = [...requirementWords].filter((word) =>
    evidenceWords.has(word),
  );
  const roleIntents = JSON.parse(input.preference.roleIntents) as string[];
  const roleText =
    `${input.opportunity.title} ${input.opportunity.company}`.toLocaleLowerCase();
  const roleMatch = roleIntents.some((intent) =>
    roleText.includes(intent.replace(/-/g, " ").toLocaleLowerCase()),
  );
  const workStyles = JSON.parse(input.preference.workStyleOrder) as string[];
  const workStyle = input.opportunity.workStyle.toLocaleLowerCase();
  const ncrRequired =
    input.preference.country === "PH" &&
    input.preference.preferNcrHybridOnsite === 1 &&
    (workStyle === "hybrid" || workStyle === "onsite");
  const hasRequirements = requirementWords.size > 0;
  const supportedRequirements =
    hasRequirements && overlap.length >= FIT_RULESET.materialGapThreshold;
  const posted =
    input.opportunity.postedAt === "Unknown"
      ? undefined
      : date(input.opportunity.postedAt);
  const locationState =
    input.opportunity.location === "Unknown"
      ? "unknown"
      : !hasCountry(input.opportunity.location, input.preference.country)
        ? "mismatch"
        : ncrRequired &&
            !/\b(ncr|metro manila|manila)\b/i.test(input.opportunity.location)
          ? "mismatch"
          : "aligned";
  const factors: FitFactor[] = [
    {
      factor: "requirements",
      state: !hasRequirements
        ? "unknown"
        : supportedRequirements
          ? "aligned"
          : "gap",
      detail: !hasRequirements
        ? "Captured requirements are unavailable"
        : supportedRequirements
          ? `${overlap.length} requirement terms have approved-evidence support`
          : "No captured requirement has approved-evidence support",
    },
    {
      factor: "gaps",
      state: !hasRequirements
        ? "unknown"
        : supportedRequirements
          ? "aligned"
          : "gap",
      detail: supportedRequirements
        ? "No material requirement gap identified from captured requirements"
        : "A material captured requirement gap remains",
    },
    {
      factor: "seniority",
      state: /\b(senior|lead|principal|manager)\b/i.test(
        input.opportunity.title,
      )
        ? "mismatch"
        : /\b(junior|associate|entry|graduate|cadet)\b/i.test(
              input.opportunity.title,
            )
          ? "aligned"
          : "unknown",
      detail: /\b(senior|lead|principal|manager)\b/i.test(
        input.opportunity.title,
      )
        ? "Title contains a seniority signal outside the selected baseline"
        : /\b(junior|associate|entry|graduate|cadet)\b/i.test(
              input.opportunity.title,
            )
          ? "Title contains a selected entry-level signal"
          : "No reliable seniority signal",
    },
    {
      factor: "location",
      state: locationState,
      detail:
        locationState === "unknown"
          ? "Unknown location"
          : locationState === "mismatch"
            ? "Location does not meet saved country or NCR preference"
            : input.opportunity.location,
    },
    {
      factor: "workStyle",
      state: workStyles.includes(workStyle) ? "aligned" : "mismatch",
      detail: workStyles.includes(workStyle)
        ? input.opportunity.workStyle
        : `Work style ${input.opportunity.workStyle} is not permitted by saved preferences`,
    },
    {
      factor: "freshness",
      state: !posted
        ? "unknown"
        : calculated - posted > 1000 * 60 * 60 * 24 * 30
          ? "stale"
          : "aligned",
      detail: !posted
        ? "Posting date is Unknown"
        : `Captured posting date ${input.opportunity.postedAt}`,
    },
  ];
  const mismatches = factors.filter(
    (factor) => factor.state === "mismatch",
  ).length;
  const unknowns = factors.filter(
    (factor) => factor.state === "unknown" || factor.state === "stale",
  ).length;
  const label: FitLabel =
    mismatches >= FIT_RULESET.significantMismatchThreshold
      ? "Stretch"
      : mismatches || unknowns || !roleMatch || !supportedRequirements
        ? "Potential"
        : "Strong";
  const confidence: CapturedFitAssessment["confidence"] =
    unknowns >= 2 || !input.evidence.length
      ? "low"
      : unknowns
        ? "medium"
        : "high";
  const opportunitySnapshot = { ...input.opportunity };
  const preferenceSnapshot = { ...input.preference };
  const contentDigest = hash({
    opportunitySnapshot,
    preferenceSnapshot,
    evidence: input.evidence.map(({ id, contentDigest }) => ({
      id,
      contentDigest,
    })),
    factors,
    label,
    confidence,
    rulesetDigest,
    calculatedAt: input.calculatedAt,
  });
  return {
    id: createUuidV7(),
    opportunityId: input.opportunity.id,
    opportunityRevisionId: input.opportunity.revisionId,
    opportunityContentDigest: input.opportunity.contentDigest,
    preferenceRevisionId: input.preference.id,
    preferenceContentDigest: input.preference.contentDigest,
    rulesetId: FIT_RULESET.id,
    rulesetVersion: FIT_RULESET.version,
    rulesetDigest,
    label,
    confidence,
    calculatedAt: input.calculatedAt,
    contentDigest,
    opportunitySnapshot,
    preferenceSnapshot,
    factorOutcomes: factors,
  };
}

export function calculateAndPersistFitAssessment(
  db: DatabaseSync,
  opportunityId: string,
): CapturedFitAssessment {
  const opportunity = listCapturedOpportunities(db).find(
    (item) => item.id === opportunityId,
  );
  const revision = opportunity
    ? listCapturedRevisions(db, opportunity.id).at(-1)
    : undefined;
  const preference = currentJobPreferenceRevision(db);
  const evidence = listApprovedEvidence(db);
  if (!opportunity || !revision || !preference || !evidence.length)
    throw new WorkspaceError(
      "FIT_ASSESSMENT_INPUT_MISSING",
      "Fit assessment needs a captured opportunity, saved Search Preferences, and approved evidence.",
      "Save the missing local material, then calculate fit again.",
    );
  const assessment = calculateCapturedFitAssessment({
    opportunity: {
      id: opportunity.id,
      revisionId: revision.id,
      contentDigest: revision.contentDigest,
      title: revision.title,
      company: revision.company,
      location: revision.location,
      workStyle: revision.workStyle,
      postedAt: revision.postedAt,
      capturedAt: revision.capturedAt,
      requirements: parseStoredRequirements(revision.requirements),
      copiedDescription: revision.copiedDescription,
    },
    evidence,
    preference,
    calculatedAt: new Date().toISOString(),
  });
  const opportunitySnapshot = JSON.stringify(assessment.opportunitySnapshot);
  const preferenceSnapshot = JSON.stringify(assessment.preferenceSnapshot);
  if (
    opportunitySnapshot.length > 500_000 ||
    preferenceSnapshot.length > 200_000 ||
    evidence.reduce((size, item) => size + item.factualText.length, 0) >
      maxEvidenceSnapshotChars
  )
    throw new WorkspaceError(
      "FIT_ASSESSMENT_INPUT_MISSING",
      "The selected approved evidence is too large for one fit assessment.",
      "Review and shorten approved evidence, then calculate fit again.",
    );
  const stored: StoredCapturedFitAssessment = {
    ...assessment,
    opportunitySnapshot,
    preferenceSnapshot,
    factorOutcomes: JSON.stringify(assessment.factorOutcomes),
  };
  db.exec("BEGIN IMMEDIATE;");
  try {
    insertCapturedFitAssessment(db, stored);
    insertCapturedFitAssessmentEvidence(db, stored.id, evidence);
    appendAuditEvent(
      db,
      createAuditEvent({
        actor: "local-os-user",
        action: "fit.assessment_calculated",
        outcome: "success",
        entityId: stored.id,
        contentHash: stored.contentDigest,
      }),
    );
    db.exec("COMMIT;");
    return assessment;
  } catch (error) {
    db.exec("ROLLBACK;");
    throw error;
  }
}

export function latestCapturedFitAssessmentView(
  db: DatabaseSync,
  opportunityId: string,
):
  | {
      label: FitLabel;
      confidence: "high" | "medium" | "low";
      calculatedAt: string;
      factors: FitFactor[];
    }
  | undefined {
  const result = latestCapturedFitAssessment(db, opportunityId);
  if (!result) return undefined;
  try {
    const factors = JSON.parse(result.factorOutcomes) as FitFactor[];
    if (!Array.isArray(factors)) throw new Error();
    return {
      label: result.label,
      confidence: result.confidence,
      calculatedAt: result.calculatedAt,
      factors,
    };
  } catch {
    throw new WorkspaceError(
      "FIT_ASSESSMENT_INPUT_MISSING",
      "A saved fit assessment cannot be read safely.",
      "Calculate fit again after reviewing local storage.",
    );
  }
}
