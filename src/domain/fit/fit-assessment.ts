import { createHash } from "node:crypto";
import { createAuditEvent, createUuidV7 } from "@/audit/audit-event";
import { listSourceRecords, getStoredJobListing } from "@/persistence/job-listings-repository";
import { currentJobPreferenceRevision } from "@/persistence/job-preferences-repository";
import { listApprovedEvidence, type EvidenceRevision } from "@/persistence/evidence-repository";
import { insertFitAssessment, type StoredFitAssessment } from "@/persistence/fit-assessment-repository";
import { appendAuditEvent } from "@/persistence/workspace-repository";
import type { DatabaseSync } from "node:sqlite";
import { WorkspaceError } from "@/domain/workspace/types";

export const FIT_RULESET = { id: "evidence-fit-v1", version: "1.0.0", materialGapThreshold: 1, significantMismatchThreshold: 2 } as const;
const digest = (value: unknown) => `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
const rulesetDigest = digest(FIT_RULESET);
export type FitLabel = "Strong" | "Potential" | "Stretch";
export type FitFactor = { factor: "requirements" | "gaps" | "seniority" | "location" | "workStyle" | "freshness"; state: "aligned" | "gap" | "mismatch" | "unknown" | "stale"; detail: string };
export type FitAssessmentInput = { listing: { id: string; title: string; company: string; workStyle?: string; location?: string; firstSeenAt: string; lastObservedAt: string; sourceRecords: unknown[] }; evidence: EvidenceRevision[]; preference: { id: string; revisionNumber: number; roleIntents: string; country: string; workStyleOrder: string; preferNcrHybridOnsite: number; contentDigest: string; createdAt: string }; calculatedAt?: string };
export type FitAssessment = Omit<StoredFitAssessment, "listingSnapshot" | "evidenceSnapshot" | "preferenceSnapshot" | "factorOutcomes"> & { listingSnapshot: unknown; evidenceSnapshot: unknown; preferenceSnapshot: unknown; factorOutcomes: FitFactor[] };
const words = (value: string) => new Set(value.toLocaleLowerCase().split(/[^a-z0-9+#.-]+/).filter((word) => word.length > 2));
function calculate(input: FitAssessmentInput): FitAssessment {
  const listingText = `${input.listing.title} ${input.listing.company}`; const listingWords = words(listingText);
  const evidenceText = input.evidence.map((item) => item.factualText).join(" "); const evidenceWords = words(evidenceText);
  const overlap = [...listingWords].filter((word) => evidenceWords.has(word));
  const roleIntents = JSON.parse(input.preference.roleIntents) as string[]; const roleMatch = roleIntents.some((intent) => listingText.toLocaleLowerCase().includes(intent.toLocaleLowerCase()));
  const workStyles = JSON.parse(input.preference.workStyleOrder) as string[]; const style = input.listing.workStyle?.toLocaleLowerCase();
  const factors: FitFactor[] = [
    { factor: "requirements", state: input.evidence.length && overlap.length ? "aligned" : "unknown", detail: input.evidence.length && overlap.length ? `${overlap.length} supported term overlap` : "No supported requirement alignment was established" },
    { factor: "gaps", state: input.evidence.length ? (overlap.length ? "aligned" : "gap") : "unknown", detail: input.evidence.length ? (overlap.length ? "No material gap identified from available evidence" : "Material gap or uncertainty remains") : "Approved evidence unavailable" },
    { factor: "seniority", state: /senior|lead|principal|manager/i.test(input.listing.title) ? "mismatch" : /junior|associate|entry|graduate|cadet/i.test(input.listing.title) ? "aligned" : "unknown", detail: /senior|lead|principal|manager/i.test(input.listing.title) ? "Title contains a seniority signal outside the v1 junior baseline" : /junior|associate|entry|graduate|cadet/i.test(input.listing.title) ? "Title contains a junior-level signal" : "No reliable seniority signal" },
    { factor: "location", state: input.listing.location ? (input.listing.location.toLocaleLowerCase().includes(input.preference.country.toLocaleLowerCase()) || input.listing.location.toLocaleLowerCase().includes("philippines") ? "aligned" : "mismatch") : "unknown", detail: input.listing.location ?? "Unknown location" },
    { factor: "workStyle", state: style ? (workStyles.includes(style) ? "aligned" : "mismatch") : "unknown", detail: style ?? "Unknown work style" },
    { factor: "freshness", state: Date.now() - Date.parse(input.listing.lastObservedAt) > 1000 * 60 * 60 * 24 * 30 ? "stale" : "aligned", detail: `Last observed ${input.listing.lastObservedAt}` },
  ];
  const mismatches = factors.filter((factor) => factor.state === "mismatch").length; const unknowns = factors.filter((factor) => factor.state === "unknown" || factor.state === "stale").length;
  const label: FitLabel = mismatches >= FIT_RULESET.significantMismatchThreshold ? "Stretch" : mismatches || unknowns || !roleMatch || !overlap.length ? "Potential" : "Strong";
  const confidence: FitAssessment["confidence"] = unknowns >= 2 || !input.evidence.length ? "low" : unknowns ? "medium" : "high";
  const now = input.calculatedAt ?? new Date().toISOString(); const listingSnapshot = { ...input.listing }; const evidenceSnapshot = input.evidence.map(({ id, evidenceId, revisionNumber, factualText, contentDigest, createdAt }) => ({ id, evidenceId, revisionNumber, factualText, contentDigest, createdAt })); const preferenceSnapshot = { ...input.preference };
  const factorOutcomes = factors; const contentDigest = digest({ listingSnapshot, evidenceSnapshot, preferenceSnapshot, factorOutcomes, label, confidence, rulesetDigest, calculatedAt: now });
  return { id: createUuidV7(), jobListingId: input.listing.id, preferenceRevisionId: input.preference.id, rulesetId: FIT_RULESET.id, rulesetVersion: FIT_RULESET.version, rulesetDigest, label, confidence, freshness: factors.find((factor) => factor.factor === "freshness")!.detail, calculatedAt: now, contentDigest, listingSnapshot, evidenceSnapshot, preferenceSnapshot, factorOutcomes };
}
export function calculateFitAssessment(input: FitAssessmentInput): FitAssessment { return calculate(input); }
export function calculateAndPersistFitAssessment(db: DatabaseSync, listingId: string): FitAssessment {
  const listing = getStoredJobListing(db, listingId); const preference = currentJobPreferenceRevision(db); if (!listing || !preference) throw new WorkspaceError("FIT_ASSESSMENT_INPUT_MISSING", "The saved opportunity or current preferences are unavailable.", "Review the saved opportunity and local preferences, then try again.");
  const sourceRecords = listSourceRecords(db, listingId); const evidence = listApprovedEvidence(db); const assessment = calculate({ listing: { ...listing, sourceRecords }, evidence, preference });
  const stored: StoredFitAssessment = { ...assessment, listingSnapshot: JSON.stringify(assessment.listingSnapshot), evidenceSnapshot: JSON.stringify(assessment.evidenceSnapshot), preferenceSnapshot: JSON.stringify(assessment.preferenceSnapshot), factorOutcomes: JSON.stringify(assessment.factorOutcomes) };
  db.exec("BEGIN IMMEDIATE;"); try { insertFitAssessment(db, stored); appendAuditEvent(db, createAuditEvent({ actor: "local-os-user", action: "fit.assessment_calculated", outcome: "success", entityId: assessment.id, contentHash: assessment.contentDigest })); db.exec("COMMIT;"); return assessment; } catch (error) { db.exec("ROLLBACK;"); throw error; }
}
