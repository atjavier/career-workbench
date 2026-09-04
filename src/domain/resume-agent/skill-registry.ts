export type ResumeAgentSkillId =
  | "resume.document-source-folder"
  | "resume.inspect-source"
  | "resume.extract-atomic-evidence"
  | "resume.compose-review-artifacts"
  | "resume.validate-documentation"
  | "resume.generate-base-resume"
  | "resume.coach-resume";

export type ResumeAgentSkillDefinition = Readonly<{
  skillId: ResumeAgentSkillId;
  inputSchema: string;
  outputSchema: string;
  workflow: readonly string[];
  requiresConsent: boolean;
  readableRoots: readonly string[];
  writableRoots: readonly string[];
  allowedExtensions: readonly string[];
  excludedDirectories: readonly string[];
  limits: Readonly<{
    maxDepth: number;
    maxDirectories: number;
    maxEntries: number;
    maxFiles: number;
    maxFileBytes: number;
    maxSnapshotChars: number;
  }>;
  prohibitedOperations: readonly string[];
}>;

const common = {
  readableRoots: ["selected-source-snapshot"] as const,
  writableRoots: ["private-staging-output"] as const,
  allowedExtensions: [
    ".md",
    ".txt",
    ".js",
    ".mjs",
    ".cjs",
    ".jsx",
    ".ts",
    ".tsx",
    ".py",
    ".go",
    ".rs",
    ".java",
    ".kt",
    ".c",
    ".h",
    ".cpp",
    ".hpp",
    ".cs",
    ".rb",
    ".php",
    ".sql",
    ".sh",
    ".ps1",
    ".json",
    ".toml",
    ".ini",
    ".cfg",
    ".xml",
    ".yaml",
    ".yml",
  ] as const,
  excludedDirectories: [
    "node_modules",
    ".git",
    ".hg",
    ".svn",
    ".agents",
    "_bmad",
    ".codex",
    "dist",
    "build",
    "out",
    ".next",
    "coverage",
    ".nyc_output",
    ".cache",
    "cache",
    "tmp",
    "temp",
    "vendor",
    "target",
    "__pycache__",
    ".venv",
    "venv",
    "generated",
  ] as const,
  limits: {
    maxDepth: 20,
    maxDirectories: 300,
    maxEntries: 900,
    maxFiles: 120,
    maxFileBytes: 8_000,
    maxSnapshotChars: 48_000,
  } as const,
  prohibitedOperations: [
    "network",
    "shell",
    "watchers",
    "background-jobs",
    "credentials",
    "source-mutation",
    "unregistered-skills",
    "external-developer-prompts",
  ] as const,
};

export const resumeAgentSkillRegistry: readonly ResumeAgentSkillDefinition[] =
  Object.freeze([
    {
      ...common,
      skillId: "resume.document-source-folder",
      inputSchema: "Consent + category + bounded source snapshot",
      outputSchema:
        "Category-specific BMad-style documentation set plus provenance-backed resume handoff",
      workflow: [
        "for a project: classify repository shape, then inventory documentation, manifests, entry points, services, data, client flow, integrations, operations, and tests",
        "for an experience: identify documented role, organization, period, assignments, deliverables, collaboration, tools, and explicit outcomes",
        "compose an indexed documentation set with conditional supporting guides",
        "extract atomic provenance-backed facts and explicit unknowns as the later resume-generation handoff",
        "validate that starter-template and boilerplate material plus unsupported attribution are excluded",
      ],
      requiresConsent: true,
    },
    {
      ...common,
      skillId: "resume.inspect-source",
      inputSchema: "Bounded source snapshot",
      outputSchema: "Stable file manifest",
      workflow: [
        "inventory manifests and structure",
        "trace entry points and architecture",
      ],
      requiresConsent: true,
    },
    {
      ...common,
      skillId: "resume.extract-atomic-evidence",
      inputSchema: "Stable file manifest",
      outputSchema: "Atomic facts with provenance and unknowns",
      workflow: [
        "inspect routes, services, models, client flow, workflows, and tests",
        "extract atomic provenance-backed facts",
      ],
      requiresConsent: true,
    },
    {
      ...common,
      skillId: "resume.compose-review-artifacts",
      inputSchema: "Documented, atomic facts",
      outputSchema:
        "Resume-description handoff and three proposed Markdown artifacts",
      workflow: [
        "compose project overview",
        "preserve provenance-locked resume evidence for later base-resume synthesis",
        "compose conservative bullet candidates",
      ],
      requiresConsent: true,
    },
    {
      ...common,
      skillId: "resume.validate-documentation",
      inputSchema: "Three proposed Markdown artifacts",
      outputSchema: "Validated artifact set or safe error",
      workflow: ["validate provenance", "exclude unsafe or boilerplate claims"],
      requiresConsent: true,
    },
    {
      ...common,
      skillId: "resume.generate-base-resume",
      inputSchema:
        "Saved profile, host-issued application/work root IDs, and bounded local read results",
      outputSchema:
        "Oboda v22 ordered base-resume sections, path-and-line-cited claims, and explicit unknowns",
      workflow: [
        "use only host-issued root IDs with bounded list/read actions; never inspect folders outside those roots or choose tools beyond the registered reader",
        "mine documented purpose, problem, users or workflow, rationale, contribution, implementation evidence, and supported qualitative result",
        "position the candidate truthfully without inventing a target role, seniority, fit, or professional summary",
        "select the strongest direct evidence and compose Experience, Education, Projects, and Technical Skills in Oboda v22 order",
        "make every visible Experience or Projects bullet candidate-facing, outcome-oriented, and linked to a host-validated file citation",
        "list missing ownership, metrics, dates, users, outcomes, scope, and skills as unknowns",
        "return a reviewable draft; the host persists and compiles it without source mutation or rerunning on page visit",
      ],
      requiresConsent: true,
      readableRoots: [
        "host-issued-application-root",
        "host-issued-managed-work-root",
      ],
      writableRoots: ["private-staging-output"],
    },
    {
      ...common,
      skillId: "resume.coach-resume",
      inputSchema:
        "Saved ordered draft plus workspace-owned resume-evidence.md and resume-bullet-candidates.md handoffs",
      outputSchema:
        "Independent recruiter, hiring-manager, ATS, and integrity critique with narrowly scoped supported revisions",
      workflow: [
        "receive the host-curated structured draft and the same two resume handoffs used for generation; never inspect folders or choose tools",
        "review clarity, relevance, credibility, specificity, hierarchy, ATS readability, and candidate truth",
        "identify whether purpose, rationale, contribution, and supported qualitative result are visible rather than raw implementation detail",
        "give independent prioritized criticism and advice without silently rebuilding the base resume",
        "apply only a material user-requested revision whose visible work claims remain evidence-linked",
        "defer job-description tailoring and expanded intake until the user explicitly selects that future workflow",
      ],
      requiresConsent: true,
    },
  ]);

export function getResumeAgentSkill(
  skillId: string,
): ResumeAgentSkillDefinition {
  const skill = resumeAgentSkillRegistry.find(
    (candidate) => candidate.skillId === skillId,
  );
  if (!skill) throw new Error(`Unregistered resume agent skill: ${skillId}`);
  return skill;
}

export function assertResumeAgentSkill(
  skillId: ResumeAgentSkillId,
  requirement: (skill: ResumeAgentSkillDefinition) => boolean,
): ResumeAgentSkillDefinition {
  const skill = getResumeAgentSkill(skillId);
  if (!requirement(skill))
    throw new Error(`Resume agent skill policy rejected: ${skillId}`);
  return skill;
}
