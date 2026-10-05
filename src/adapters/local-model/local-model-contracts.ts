import type { ResumeTemplateContract } from "@/domain/base-resume/resume-template-contract";
import type { ResumeFileCitation, ResumeFileReadSession } from "@/files/evidence-library";

export type LocalModelConnection = {
  configurationRevisionId: string;
  configurationDigest: string;
  modelIdentifier: string;
};

export type ResumeCoachOpportunity = {
  revisionId: string;
  contentDigest: string;
  title: string;
  company: string;
  requirements: string[];
  copiedDescription: string;
};

export type ResumeCoachEvidence = {
  id: string;
  contentDigest: string;
  factualText: string;
  sourceDocument?: string;
  sourceSection?: string;
};

export type ResumeCoachDocumentation = {
  name: string;
  category: "project" | "experience";
  documents: Array<{ path: string; text: string; contentDigest: string }>;
};

export type ResumeCandidateClarification = {
  itemName: string;
  itemCategory: "project" | "experience";
  category: string;
  text: string;
  provenance: "candidate_interview_answer";
};

export type ResumeCoachRequest = {
  connection: LocalModelConnection;
  profileRevisionId: string;
  profileDigest: string;
  profileSnapshot: string;
  templateId: string;
  templateDigest: string;
  evidence: ResumeCoachEvidence[];
  documentation?: ResumeCoachDocumentation[];
  baseline?: ResumeTemplateContract;
  clarifications?: ResumeCandidateClarification[];
  opportunity?: ResumeCoachOpportunity;
  currentResumeSections?: Array<{ heading: string; text: string }>;
  userRequest: string;
  consentNonce: string;
  consentFingerprint: string;
  fileReadSession?: ResumeFileReadSession;
};

export type ResumeCoachResponse = {
  schemaVersion: 1;
  sections: Array<{ heading: string; text: string }>;
  claims: Array<{
    text: string;
    evidenceIndexes: number[];
    clarificationIndexes?: number[];
    fileCitations?: ResumeFileCitation[];
  }>;
  candidateClarifications?: ResumeCandidateClarification[];
  unknowns: string[];
  selectionEcho: string;
};

export type OpportunityAssessmentRequest = {
  connection: LocalModelConnection;
  profileDigest: string;
  templateDigest: string;
  profileSummary: string;
  opportunity: {
    id: string;
    contentDigest: string;
    title: string;
    company: string;
    requirements: string[];
    copiedDescription: string;
  };
  evidence: Array<{ id: string; contentDigest: string; factualText: string }>;
  consentFingerprint: string;
};

export type OpportunityAssessmentResponse = {
  schemaVersion: 1;
  strengths: Array<{
    text: string;
    evidenceIndexes: number[];
    excerpt: { start: number; end: number };
  }>;
  gaps: Array<{ text: string; excerpt: { start: number; end: number } }>;
  unknowns: string[];
  selectionEcho: string;
};

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export type ResumeInterviewCoachRequest = {
  connection: LocalModelConnection;
  workspaceId: string;
  taskId: string;
  question: string;
  context: string[];
  transcript: string[];
  opening?: boolean;
  clarificationUsed?: boolean;
  consentNonce: string;
  consentFingerprint: string;
};

export type ResumeInterviewTurnDecision =
  | { disposition: "complete"; answerSource: "latest" | "prior" }
  | { disposition: "unknown" }
  | { disposition: "clarify"; missingDetail: string };

export type ResumeInterviewCoachResponse = {
  schemaVersion: 1;
  question: string;
  followUp?: string;
  selectionEcho: string;
};

export type ResumeInterviewCoachStreamResponse = {
  content: string;
  decision?: ResumeInterviewTurnDecision;
};

export type ResumeProfileSnapshot = {
  firstName?: unknown;
  middleName?: unknown;
  lastName?: unknown;
  email?: unknown;
  phone?: unknown;
  school?: unknown;
  program?: unknown;
  graduationYear?: unknown;
  gwa?: unknown;
  latinHonors?: unknown;
  linkedInUrl?: unknown;
  githubUrl?: unknown;
};

export type ResumeCoachReviewResponse = {
  schemaVersion: 1;
  ratings: Array<{
    area:
      | "clarity"
      | "relevance"
      | "credibility"
      | "specificity"
      | "atsReadability";
    score: number;
    rationale: string;
  }>;
  strengths: string[];
  concerns: string[];
  recommendations: string[];
  selectionEcho: string;
};

export type ResumeEvidenceSourceFile = {
  path: string;
  text: string;
  contentDigest: string;
};

export type ResumeEvidenceDocumenterRequest = {
  connection: LocalModelConnection;
  category: "project" | "experience";
  sourceDigest: string;
  files: ResumeEvidenceSourceFile[];
  consentFingerprint: string;
};

export type ResumeEvidenceDocumenterResponse = {
  schemaVersion: 1;
  selectionEcho: string;
  artifacts: {
    "project-overview.md": string;
    "resume-evidence.md": string;
    "resume-bullet-candidates.md": string;
    "resume-summary.md": string;
  };
};

export type EditableTexArtifact = {
  documentId: string;
  path: string;
  contentDigest: string;
  text: string;
};

export type EditableTexRevisionRequest = {
  connection: LocalModelConnection;
  workspaceId: string;
  displayName: string;
  baseline: { id: string; contentDigest: string; tex: string };
  artifacts: EditableTexArtifact[];
  consentNonce: string;
  consentFingerprint: string;
  /** Observed from the configured loaded LM Studio instance. */
  contextLimitTokens: number;
};

export type EditableTexRevisionResponse = {
  schemaVersion: 1;
  selectionEcho: string;
  tex: string;
  artifactCitations: Array<{ path: string; contentDigest: string }>;
};

