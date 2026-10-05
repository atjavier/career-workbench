import { type ResumeCoachResponse, type ResumeCoachReviewResponse } from "@/adapters/local-model/local-model-gateway";
import { type OpportunityAssessmentView } from "@/application/fit/ai-opportunity-assessment";
import { type CandidateProfileInput } from "@/domain/resume-generation/candidate-profile-commands";

export type WorkspaceActionState = {
  status: "idle" | "success" | "error";
  summary: string;
  safeNextAction?: string;
  workspaceId?: string;
  nextUrl?: string;
};

export type CandidateProfileField = keyof CandidateProfileInput;

export type CandidateProfileActionState = WorkspaceActionState & {
  fieldErrors?: Partial<Record<CandidateProfileField, string>>;
};

export type ResumeCoachActionState = WorkspaceActionState & {
  response?: ResumeCoachResponse;
  draftId?: string;
  evidenceLabels?: string[];
  texRevisionId?: string;
};

export type ResumeInterviewActionState = WorkspaceActionState;

export type ResumeCoachReviewActionState = WorkspaceActionState & {
  review?: ResumeCoachReviewResponse;
};

export type MaterialDraftHandoffActionState = WorkspaceActionState & {
  draftId?: string;
};

export type OpportunityAssessmentActionState = WorkspaceActionState & {
  assessment?: OpportunityAssessmentView;
  decisionId?: string;
};

export type EditableTexDraftActionState = WorkspaceActionState & {
  revisionId?: string;
  displayName?: string;
};

export type FolderPickerActionState = WorkspaceActionState & {
  folderPath?: string;
  folderName?: string;
};

