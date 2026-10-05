import { WorkspaceError } from "@/domain/workspace/types";
import { createHash } from "node:crypto";
import type { OpportunityAssessmentRequest, ResumeCoachRequest, ResumeInterviewCoachRequest } from "./local-model-contracts";
import { publicConnection } from "./model-boundaries";



export function localModelCapabilityVersion(capability: string): string {
  if (capability === "resume-coach" || capability === "resume-generator")
    return "resume-coach-v8";
  if (capability === "resume-interview-coach")
    return "resume-interview-coach-v3";
  if (capability === "opportunity-assessment")
    return "opportunity-assessment-v1";
  if (capability === "editable-tex-revision") return "editable-tex-revision-v1";
  if (
    capability === "resume-evidence-documenter" ||
    capability === "folder-documenter"
  )
    return "resume-evidence-documenter-v1";
  invalid("That local AI capability is unavailable.");
}


export function resumeCoachConsentFingerprint(
  input: Omit<ResumeCoachRequest, "consentFingerprint">,
): string {
  return `sha256:${createHash("sha256")
    .update(
      JSON.stringify({
        capability: localModelCapabilityVersion("resume-coach"),
        connection: publicConnection(input.connection),
        profile: {
          revisionId: input.profileRevisionId,
          contentDigest: input.profileDigest,
          snapshot: input.profileSnapshot,
        },
        template: { id: input.templateId, contentDigest: input.templateDigest },
        evidence: input.evidence
          .map(({ id, contentDigest, sourceDocument, sourceSection }) => ({
            id,
            contentDigest,
            sourceDocument,
            sourceSection,
          }))
          .sort((a, b) => a.id.localeCompare(b.id)),
        documentation:
          input.documentation
            ?.map((group) => ({
              name: group.name,
              category: group.category,
              documents: group.documents
                .map(({ path, contentDigest }) => ({ path, contentDigest }))
                .sort((a, b) => a.path.localeCompare(b.path)),
            }))
            .sort((a, b) =>
              `${a.category}/${a.name}`.localeCompare(
                `${b.category}/${b.name}`,
              ),
            ) ?? null,
        baseline: input.baseline
          ? {
              id: input.baseline.baselineId,
              digest: input.baseline.baselineDigest,
              sections: input.baseline.sections,
            }
          : null,
        clarifications:
          input.clarifications?.map(
            ({ itemName, itemCategory, category, text, provenance }) => ({
              itemName,
              itemCategory,
              category,
              text,
              provenance,
            }),
          ) ?? null,
        opportunity: input.opportunity
          ? {
              revisionId: input.opportunity.revisionId,
              contentDigest: input.opportunity.contentDigest,
            }
          : null,
        currentResumeSections: input.currentResumeSections ?? null,
        request: input.userRequest,
        consentNonce: input.consentNonce,
      }),
    )
    .digest("hex")}`;
}


export function resumeInterviewCoachConsentFingerprint(
  input: Omit<ResumeInterviewCoachRequest, "consentFingerprint">,
): string {
  return `sha256:${createHash("sha256")
    .update(
      JSON.stringify({
        capability: localModelCapabilityVersion("resume-interview-coach"),
        connection: publicConnection(input.connection),
        workspaceId: input.workspaceId,
        taskId: input.taskId,
        question: input.question,
        context: input.context,
        transcript: input.transcript,
        opening: input.opening === true,
        clarificationUsed: input.clarificationUsed === true,
        consentNonce: input.consentNonce,
      }),
    )
    .digest("hex")}`;
}


export function opportunityAssessmentConsentFingerprint(
  input: Omit<OpportunityAssessmentRequest, "consentFingerprint">,
): string {
  return `sha256:${createHash("sha256")
    .update(
      JSON.stringify({
        capability: localModelCapabilityVersion("opportunity-assessment"),
        connection: publicConnection(input.connection),
        profile: input.profileDigest,
        template: input.templateDigest,
        opportunity: input.opportunity.contentDigest,
        evidence: input.evidence.map((item) => item.contentDigest).sort(),
      }),
    )
    .digest("hex")}`;
}


export function invalid(
  message: string,
  next = "Review the selected material and try the local request again.",
): never {
  throw new WorkspaceError("RESUME_COACH_INVALID", message, next);
}
