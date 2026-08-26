export type ResumeAgentSkillId =
  | "resume.document-source-folder"
  | "resume.inspect-source"
  | "resume.extract-atomic-evidence"
  | "resume.compose-review-artifacts"
  | "resume.validate-documentation";

export type ResumeAgentSkillDefinition = Readonly<{
  skillId: ResumeAgentSkillId;
  inputSchema: string;
  outputSchema: string;
  requiresConsent: boolean;
  readableRoots: readonly string[];
  writableRoots: readonly string[];
  allowedExtensions: readonly string[];
  excludedDirectories: readonly string[];
  limits: Readonly<{ maxDepth: number; maxDirectories: number; maxEntries: number; maxFiles: number; maxFileBytes: number; maxSnapshotChars: number }>;
  prohibitedOperations: readonly string[];
}>;

const common = {
  readableRoots: ["selected-source-snapshot"] as const,
  writableRoots: ["private-staging-output"] as const,
  allowedExtensions: [".md", ".txt", ".js", ".mjs", ".cjs", ".jsx", ".ts", ".tsx", ".py", ".go", ".rs", ".java", ".kt", ".c", ".h", ".cpp", ".hpp", ".cs", ".rb", ".php", ".sql", ".sh", ".ps1", ".json", ".toml", ".ini", ".cfg", ".xml", ".yaml", ".yml"] as const,
  excludedDirectories: ["node_modules", ".git", ".hg", ".svn", "dist", "build", "out", ".next", "coverage", ".nyc_output", ".cache", "cache", "tmp", "temp", "vendor", "target", "__pycache__", ".venv", "venv", "generated"] as const,
  limits: { maxDepth: 20, maxDirectories: 200, maxEntries: 400, maxFiles: 60, maxFileBytes: 8_000, maxSnapshotChars: 12_000 } as const,
  prohibitedOperations: ["network", "shell", "watchers", "background-jobs", "credentials", "source-mutation", "unregistered-skills", "external-developer-prompts"] as const,
};

export const resumeAgentSkillRegistry: readonly ResumeAgentSkillDefinition[] = Object.freeze([
  { ...common, skillId: "resume.document-source-folder", inputSchema: "Consent + category + bounded source snapshot", outputSchema: "Exactly three proposed Markdown artifacts", requiresConsent: true },
  { ...common, skillId: "resume.inspect-source", inputSchema: "Bounded source snapshot", outputSchema: "Stable file manifest", requiresConsent: true },
  { ...common, skillId: "resume.extract-atomic-evidence", inputSchema: "Stable file manifest", outputSchema: "Atomic facts with provenance and unknowns", requiresConsent: true },
  { ...common, skillId: "resume.compose-review-artifacts", inputSchema: "Atomic facts", outputSchema: "Exactly three proposed Markdown artifacts", requiresConsent: true },
  { ...common, skillId: "resume.validate-documentation", inputSchema: "Three proposed Markdown artifacts", outputSchema: "Validated artifact set or safe error", requiresConsent: true },
]);

export function getResumeAgentSkill(skillId: string): ResumeAgentSkillDefinition {
  const skill = resumeAgentSkillRegistry.find((candidate) => candidate.skillId === skillId);
  if (!skill) throw new Error(`Unregistered resume agent skill: ${skillId}`);
  return skill;
}

export function assertResumeAgentSkill(skillId: ResumeAgentSkillId, requirement: (skill: ResumeAgentSkillDefinition) => boolean): ResumeAgentSkillDefinition {
  const skill = getResumeAgentSkill(skillId);
  if (!requirement(skill)) throw new Error(`Resume agent skill policy rejected: ${skillId}`);
  return skill;
}
