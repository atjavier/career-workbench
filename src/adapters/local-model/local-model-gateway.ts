/** Compatibility entry point; implementations are separated by feature. */
export { editableTexMaximumRequestBytes, editableTexMaximumResponseBytes, editableTexRequestBudget, editableTexRevisionConsentFingerprint, requestEditableTexRevision, validateEditableTexRevisionResponse } from "./editable-tex-gateway";
export { requestClarificationPlan, requestJobOpportunityReader, requestJobTailoringStage } from "./job-opportunity-gateway";
export type { EditableTexArtifact, EditableTexRevisionRequest, EditableTexRevisionResponse, FetchLike, LocalModelConnection, OpportunityAssessmentRequest, OpportunityAssessmentResponse, ResumeCandidateClarification, ResumeCoachDocumentation, ResumeCoachEvidence, ResumeCoachOpportunity, ResumeCoachRequest, ResumeCoachResponse, ResumeCoachReviewResponse, ResumeEvidenceDocumenterRequest, ResumeEvidenceDocumenterResponse, ResumeEvidenceSourceFile, ResumeInterviewCoachRequest, ResumeInterviewCoachResponse, ResumeInterviewCoachStreamResponse, ResumeInterviewTurnDecision } from "./local-model-contracts";
export { localModelCapabilityVersion, opportunityAssessmentConsentFingerprint, resumeCoachConsentFingerprint, resumeInterviewCoachConsentFingerprint } from "./model-consent";
export { parseModelJson, repairJsonBrackets } from "./model-json";
export { requestOpportunityAssessment, validateOpportunityAssessmentResponse } from "./opportunity-assessment-gateway";
export { classifyCapabilityPillar, contentTokens, convertFlatEntriesToEdits, enrichAndCompleteBullets, extractCandidateBulletsFromDocs, extractDateFromDocs, extractTechStackFromDocs, hasTechnicalSubstance, matchesDocGroupName, sanitizeBulletText, tokenSimilarity } from "./resume-composition";
export { buildResumeDocumentationSet, requestResumeEvidenceDocumentation, resumeEvidenceDocumenterConsentFingerprint } from "./resume-documentation-gateway";
export { requestBaseResumeGeneration, requestResumeCoach, resumeCoachSystemInstruction } from "./resume-generation-gateway";
export { requestResumeInterviewCoach, streamResumeInterviewCoach } from "./resume-interview-gateway";
export { requestResumeCoachReview } from "./resume-review-gateway";
