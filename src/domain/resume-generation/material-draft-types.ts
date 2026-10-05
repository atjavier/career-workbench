export type MaterialDraftCandidateClarification = {
  itemName: string;
  itemCategory: "project" | "experience";
  category: string;
  text: string;
  provenance: "candidate_interview_answer";
};
export type MaterialDraftFileCitation = {
  path: string;
  startLine: number;
  endLine: number;
  contentDigest: string;
};
export type MaterialDraftCandidateProfile = {
  firstName: string;
  middleName?: string | null;
  lastName: string;
  email: string;
  phone: string;
  school: string;
  program: string;
  graduationYear: number;
  gwa?: string | null;
  latinHonors?: string | null;
  linkedInUrl?: string | null;
  githubUrl?: string | null;
};
export type MaterialDraftView = {
  id: string;
  profileLabel: string;
  candidateProfile?: MaterialDraftCandidateProfile;
  templateLabel: string;
  templateId: string;
  templateDigest: string;
  opportunityLabel?: string;
  evidenceLabels: string[];
  sections: Array<{ heading: string; text: string }>;
  claims: Array<{
    text: string;
    evidence: string[];
    candidateClarifications: MaterialDraftCandidateClarification[];
    fileCitations: MaterialDraftFileCitation[];
  }>;
  candidateClarifications?: MaterialDraftCandidateClarification[];
  unknowns: string[];
  handedOff: boolean;
};
export type MaterialDraftHandoff = { destination: "review" };

