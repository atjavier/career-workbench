import { folderDocumenterArtifactInstruction, folderDocumenterSystemInstruction } from "@/adapters/local-model/folder-documenter-agent";
import { WorkspaceError } from "@/domain/workspace/types";
import { createHash } from "node:crypto";
import type { FetchLike, ResumeEvidenceDocumenterRequest, ResumeEvidenceDocumenterResponse, ResumeEvidenceSourceFile } from "./local-model-contracts";
import { boundedText, exactKeys, plain, publicConnection, sha, validConnection } from "./model-boundaries";
import { localModelCapabilityVersion } from "./model-consent";
import { parseModelJson } from "./model-json";
import { nativeText } from "./native-transport";
import { extractDateFromDocs } from "./resume-composition";

const documenterSystemInstruction =
  "The specific Folder Documenter procedure is supplied for the selected category.";

function documenterInvalid(
  message: string,
  next = "Review the selected folder and try the local documentation action again.",
): never {
  throw new WorkspaceError("EVIDENCE_DOCUMENTER_INVALID", message, next);
}

function documenterFingerprint(
  request: Omit<ResumeEvidenceDocumenterRequest, "consentFingerprint">,
): string {
  return `sha256:${createHash("sha256")
    .update(
      JSON.stringify({
        capability: localModelCapabilityVersion("resume-evidence-documenter"),
        connection: publicConnection(request.connection),
        category: request.category,
        sourceDigest: request.sourceDigest,
        files: request.files
          .map(({ path, contentDigest }) => ({ path, contentDigest }))
          .sort((a, b) => a.path.localeCompare(b.path)),
      }),
    )
    .digest("hex")}`;
}

export const resumeEvidenceDocumenterConsentFingerprint = documenterFingerprint;

function validateDocumenterRequest(
  request: ResumeEvidenceDocumenterRequest,
): void {
  if (
    !validConnection(request.connection) ||
    !sha(request.sourceDigest) ||
    !sha(request.consentFingerprint) ||
    (request.category !== "project" && request.category !== "experience") ||
    !request.files.length ||
    request.files.length > 200 ||
    request.files.some(
      (file) =>
        !plain(file.path, 500) ||
        file.path.includes("\\") ||
        file.path.includes("..") ||
        /^(?:[a-z]:|\/|\\\\|[a-z][a-z0-9+.-]*:)/i.test(file.path) ||
        !boundedText(file.text, 500_000) ||
        !sha(file.contentDigest),
    ) ||
    JSON.stringify(request).length > 350_000 ||
    request.consentFingerprint !== documenterFingerprint(request)
  )
    documenterInvalid("The selected folder cannot be sent safely.");
}

const containsAbsolutePath = (value: string) =>
  /(?:\b[a-z]:[\\/]|\\\\|\bfile:(?:\/\/+|\/?[a-z]:)|(?:^|[\s[(])\/(?:Users?|home|var|tmp|etc|opt|mnt|private|root)(?:\/|\b))/im.test(
    value,
  );

function validateDocumenterResponse(
  value: unknown,
  request: ResumeEvidenceDocumenterRequest,
): ResumeEvidenceDocumenterResponse {
  if (!value || typeof value !== "object" || Array.isArray(value))
    documenterInvalid(
      "The local documentation skill returned an unusable result.",
    );
  const item = value as Record<string, unknown>;
  const artifacts = item.artifacts;
  if (
    item.schemaVersion !== 1 ||
    item.selectionEcho !== request.consentFingerprint ||
    !artifacts ||
    typeof artifacts !== "object" ||
    Array.isArray(artifacts) ||
    !exactKeys(artifacts as Record<string, unknown>, [
      "project-overview.md",
      "resume-evidence.md",
      "resume-bullet-candidates.md",
      "resume-summary.md",
    ])
  )
    documenterInvalid(
      "The local documentation skill returned an incomplete result.",
    );
  const output = artifacts as Record<string, unknown>;
  if (
    Object.values(output).some(
      (text) =>
        !boundedText(text, 48_000) ||
        !/Proposed \/ Unreviewed/i.test(text as string) ||
        containsAbsolutePath(text as string),
    )
  )
    documenterInvalid(
      "The local documentation skill returned unsafe review artifacts.",
    );
  return {
    schemaVersion: 1,
    selectionEcho: request.consentFingerprint,
    artifacts: output as ResumeEvidenceDocumenterResponse["artifacts"],
  };
}

const artifactInstructions: Record<
  keyof ResumeEvidenceDocumenterResponse["artifacts"],
  string
> = {
  "project-overview.md":
    "Write the requested category overview only. Do not create, summarize, or mention any other artifact.",
  "resume-evidence.md":
    "Write only resume-evidence.md. Begin exactly with '# Resume Evidence (Proposed / Unreviewed)'. For each supported fact use exactly: '### E-001', '- Fact: <verbatim or direct source fact>', '- Provenance: <relative source path>, <nearest heading>, line <one-based number>', '- Explicit unknowns: <unknowns>', '- Status: Proposed / unreviewed'. Use consecutive E identifiers. If there are no supported facts, write only '- No supported evidence items found.' after the heading. Do not create, summarize, or mention any other artifact.",
  "resume-bullet-candidates.md":
    "Write only resume-bullet-candidates.md. Begin exactly with '# Resume Bullet Candidates (Proposed / Unreviewed)'. Immediately add a '## Resume Context' section with concise research notes headed Purpose, User or workflow, Design rationale, Directly stated outcome, and Explicit gaps. Synthesize those notes from the supplied factual handoff and provenance-backed evidence; keep technical mechanisms subordinate to why they matter. State 'Not directly evidenced' rather than inventing purpose, users, rationale, or outcomes. This context is research for a later resume writer, never a candidate claim: do not include source paths, filenames, configuration values, commands, routes, API syntax, or setup instructions. Then add '## Candidate Bullets'. Do not impose an arbitrary candidate count; include every distinct, directly supported candidate that materially helps describe the project. Formulate each candidate starting with a past-tense engineering action verb (e.g. Built, Designed, Implemented, Developed, Engineered, Refactored, Integrated), stating the concrete technical capability delivered and its practical workflow or system outcome. For every candidate use exactly: '### B-001', '- Candidate: <candidate bullet>', '- Supporting evidence: E-001', '- Explicit unknowns: <unknowns>', '- Status: Proposed / unreviewed; not claim-eligible'. Use consecutive B identifiers and only E identifiers in the supplied resume-evidence.md. If no candidates are supported, write only '- No supported bullet candidates found.' after the Candidate Bullets heading. Do not create, summarize, or mention any other artifact.",
  "resume-summary.md":
    "Write the requested category resume handoff only. Do not create, summarize, or mention any other artifact.",
};

const artifactMaximumTokens: Record<
  keyof ResumeEvidenceDocumenterResponse["artifacts"],
  number
> = {
  "project-overview.md": 1_800,
  "resume-evidence.md": 0,
  "resume-bullet-candidates.md": 3_000,
  "resume-summary.md": 3_000,
};

function sourceHeading(value: string): string {
  return (
    value
      .replace(/[\u0000-\u001f]/g, " ")
      .replace(/\.\./g, "…")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 300) || "document"
  );
}

function sourcePriority(path: string): number {
  const normalized = path.toLowerCase();
  if (
    /^(readme|overview|architecture|design|requirements?|documentation)\.(md|txt)$/.test(
      normalized,
    ) ||
    /\.(?:pdf)$/.test(normalized) ||
    /(?:^|\/)(?:week[_-]?\d+|log[s]?|reports?|evaluations?|certificates?|notes?|tasks?|summary|context|deliverables?)\.(?:ya?ml|md|txt|json|pdf)$/.test(
      normalized,
    )
  )
    return 0;
  if (/(^|\/)(package|composer|pyproject|cargo)\.(json|toml)$/.test(normalized))
    return 1;
  if (
    /(^|\/)(src|server|api|routes?|controllers?|models?|services?|components?)\//.test(
      normalized,
    )
  )
    return 2;
  if (/(^|\/)(docs?|documentation|reports?|logs?)\//.test(normalized)) return 3;
  if (/(^|\/)(tests?|__tests__)\//.test(normalized)) return 4;
  if (/(^|\/)(eslint|vite|webpack|babel|tsconfig|prettier)\b/.test(normalized))
    return 9;
  return 4;
}

export function isBoilerplateEvidence(text: string): boolean {
  return /^(?:import\s|export\s*\{|import\s+type\b|["'](?:react|react-dom|vite|@vitejs|eslint|globals|swc|babel)|const \[count, setCount\]|this template provides|currently, two official plugins|.*fast refresh|.*minimal setup|.*eslint rules|.*vite preview|.*vite build|.*react logo|.*standard vite example|.*bootstrapped with vite)/i.test(
    text,
  );
}

function isSourceFact(text: string, path: string): boolean {
  if (containsAbsolutePath(text)) return false;
  if (isBoilerplateEvidence(text)) return false;
  // A bounded source scan may see README setup notes and environment defaults.
  // They are useful to the technical documentation set, never resume evidence.
  if (
    /^`?[A-Z][A-Z0-9_]*_[A-Z0-9_]+`?\s*(?:\(|=|:)/.test(text) ||
    /\b(?:for development and runtime instructions|see (?:the )?(?:code\/)?setup\.md|default host|default port)\b/i.test(
      text,
    )
  )
    return false;
  if (
    /^\[?\d+\s*,\s*(?:AY|academic year)\b/i.test(text) ||
    /\benrolled\s+(?:in\s+)?[A-Z]{2,}\s*\d{2,}/i.test(text)
  )
    return false;
  if (/(?:\s*\.\s*){3,}|\.{3,}\s*\d+$/i.test(text)) return false;
  if (
    /^(?:week narrative report|weekly assigned tasks|technical highlights|tools and technologies used|internship report|table of contents)\b/i.test(
      text,
    )
  )
    return false;
  if (/(?:^|\/)package\.json$/i.test(path))
    return /"(?:name|private|type)"\s*:|"(?:dev|start|build|test|lint|preview)"\s*:|"(?:express|mongoose|mongodb|bcrypt|jsonwebtoken|cors|react|next|vite|prisma|sequelize|typeorm)"\s*:/.test(
      text,
    );
  if (/\.(?:js|jsx|ts|tsx)$/i.test(path))
    return /\b(?:app|router)\.(?:get|post|put|patch|delete|use)\b|\b(?:mongoose\.(?:model|connect)|bcrypt\.(?:hash|compare)|jwt\.(?:sign|verify)|express\(|createSchema|new Schema|Schema\(|async function|function [A-Z]|fetch\(|axios\.|use(?:State|Effect|Context)\(|createContext\(|describe\(|it\(|test\(|expect\()|\b(?:module\.)?exports\b|\bclass\s+[A-Z]|\b(?:User|Product|Order)\.(?:find|findOne|create|save)\b/.test(
      text,
    );
  if (/\.(?:py|go|rs|java|kt|cs|rb|php|sql)$/i.test(path))
    return /\b(?:route|router|app|api|model|schema|migration|create table|select |insert |update |delete |test|describe|assert|auth|login|register|password|token)\b/i.test(
      text,
    );
  if (/(?:^|\/)(?:\.github\/workflows|docker-compose(?:\.ya?ml)?)/i.test(path))
    return /\b(?:services?:|image:|command:|depends_on:|workflow|jobs:|steps:|test|build|deploy|docker|node|python)\b/i.test(
      text,
    );
  if (/\.(?:ya?ml|toml|ini|cfg|xml|sh|ps1)$/i.test(path)) {
    if (
      /\b(?:services?:|image:|command:|depends_on:|workflow|jobs:|steps:|test|build|deploy|docker|node|python)\b/i.test(
        text,
      )
    )
      return true;
    return (
      text.length >= 20 &&
      /[a-zA-Z]{3,}/.test(text) &&
      !/^[-:]+$/.test(text) &&
      !/^\s*(?:version|schema|format):\s*/i.test(text)
    );
  }
  return true;
}

function anchoredEvidenceArtifact(
  request: ResumeEvidenceDocumenterRequest,
): string {
  const entries: Array<{
    fact: string;
    path: string;
    heading: string;
    line: number;
  }> = [];
  for (const file of [...request.files].sort(
    (left, right) =>
      sourcePriority(left.path) - sourcePriority(right.path) ||
      left.path.localeCompare(right.path),
  )) {
    let heading = "document";
    let fence: { marker: string; length: number } | undefined;
    let taken = 0;
    const fileLimit = sourcePriority(file.path) <= 2 ? 8 : 5;
    for (const [index, raw] of file.text.split(/\r?\n/).entries()) {
      const text = raw.trim();
      const fenceMatch = /^(`{3,}|~{3,})(.*)$/.exec(text);
      if (fence) {
        if (
          fenceMatch &&
          fenceMatch[1][0] === fence.marker &&
          fenceMatch[1].length >= fence.length &&
          !fenceMatch[2].trim()
        )
          fence = undefined;
        continue;
      }
      if (fenceMatch) {
        fence = { marker: fenceMatch[1][0], length: fenceMatch[1].length };
        continue;
      }
      const headingMatch = /^(#{1,6})\s+(.+)$/.exec(text);
      if (headingMatch) {
        heading = sourceHeading(headingMatch[2]);
        continue;
      }
      const fact = text
        .replace(/^[-*+]\s+/, "")
        .replace(/^\d+[.)]\s+/, "")
        .trim();
      if (
        !fact ||
        fact.length < 20 ||
        fact.length > 1_000 ||
        fact.startsWith("|") ||
        /^[-:| ]+$/.test(fact) ||
        !/[a-z]{3}/i.test(fact) ||
        /^\s*(?:BEFORE|AFTER)\s+(?:INSERT|UPDATE|DELETE)\s+ON\b/i.test(fact) ||
        /^\s*(?:CREATE|DROP)\s+TRIGGER\b/i.test(fact) ||
        /^\s*(?:BEGIN|COMMIT|ROLLBACK|END);?\s*$/i.test(fact) ||
        !isSourceFact(fact, file.path)
      )
        continue;
      entries.push({ fact, path: file.path, heading, line: index + 1 });
      taken += 1;
      if (taken >= fileLimit || entries.length >= 60) break;
    }
    if (entries.length >= 60) break;
  }
  if (!entries.length)
    return "# Resume Evidence (Proposed / Unreviewed)\n\n- No supported evidence items found.";
  return `# Resume Evidence (Proposed / Unreviewed)\n\n${entries.map((entry, index) => `### E-${String(index + 1).padStart(3, "0")}\n- Fact: ${entry.fact}\n- Provenance: ${entry.path}, ${entry.heading}, line ${entry.line}\n- Explicit unknowns: Ownership, metrics, users, dates, and outcomes are not established by this source line.\n- Status: Proposed / unreviewed`).join("\n\n")}`;
}

function fallbackProjectOverviewArtifact(
  request: ResumeEvidenceDocumenterRequest,
): string {
  const facts = [
    ...anchoredEvidenceArtifact(request).matchAll(/^- Fact:\s*(.+)$/gm),
  ]
    .map((match) => match[1])
    .slice(0, 5);
  const overview = request.category === "experience" ? "Experience" : "Project";
  return `# ${overview} Overview (Proposed / Unreviewed)\n\n## Directly supported implementation facts\n\n${facts.length ? facts.map((fact) => `- ${fact}`).join("\n") : "- No supported implementation facts were found in the bounded scan."}\n\n## Explicit unknowns\n\n- Ownership, metrics, users, dates, deployment status, outcomes, and skills are not established by the selected source.`;
}

function deriveExperienceOverviewArtifact(
  summary: string,
  request: ResumeEvidenceDocumenterRequest,
): string {
  const lines = summary.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const bullets: string[] = [];
  for (const line of lines) {
    if (line.startsWith("#")) continue;
    if (/^\*\*(?:Role|Organization|Period|Assignment):\*\*/i.test(line)) {
      bullets.push(line.replace(/^\*\*/, "").replace(/:\*\*/, ":"));
    } else if (/^[-*]\s+/.test(line)) {
      const clean = line.replace(/^[-*]\s+/, "").trim();
      if (clean && !clean.startsWith("#")) {
        bullets.push(clean);
      }
    }
    if (bullets.length >= 8) break;
  }
  if (!bullets.length) {
    return fallbackProjectOverviewArtifact(request);
  }
  return `# Experience Overview (Proposed / Unreviewed)\n\n${bullets.map((b) => `- ${b}`).join("\n")}`;
}

function fallbackBulletCandidatesArtifact(): string {
  return "# Resume Bullet Candidates (Proposed / Unreviewed)\n\n- No supported bullet candidates found.";
}

function fallbackResumeSummaryArtifact(
  request: ResumeEvidenceDocumenterRequest,
): string {
  const facts = [
    ...anchoredEvidenceArtifact(request).matchAll(/^- Fact:\s*(.+)$/gm),
  ].map((match) => match[1]);
  return `# Resume Summary (Proposed / Unreviewed)\n\n${facts.length ? facts.map((fact) => `- ${fact}`).join("\n") : "- No supported project description was found in the bounded scan."}\n\n## Explicit unknowns\n\n- Personal ownership, metrics, users, dates, deployment status, outcomes, and skills are not established by the selected source.`;
}

function bmadProjectScanContext(
  files: ResumeEvidenceDocumenterRequest["files"],
): Record<string, unknown> {
  const grouped = {
    manifests: [] as string[],
    documentation: [] as string[],
    entryPoints: [] as string[],
    apiAndServices: [] as string[],
    dataModels: [] as string[],
    clientAndUi: [] as string[],
    operations: [] as string[],
    tests: [] as string[],
  };
  for (const { path } of files) {
    const normalized = path.toLowerCase();
    if (
      /(?:^|\/)(?:package\.json|pyproject\.toml|cargo\.toml|composer\.json|go\.mod|pom\.xml|requirements(?:\.txt)?|dockerfile|docker-compose(?:\.ya?ml)?)$/.test(
        normalized,
      )
    )
      grouped.manifests.push(path);
    if (
      /(?:^|\/)(?:readme|overview|architecture|design|requirements?|documentation)\.(?:md|txt)$|(?:^|\/)(?:docs?|documentation)\//.test(
        normalized,
      )
    )
      grouped.documentation.push(path);
    if (
      /(?:^|\/)(?:main|index|app|server|application)\.(?:[cm]?[jt]sx?|py|go|rs|java|kt|cs|rb|php)$/.test(
        normalized,
      )
    )
      grouped.entryPoints.push(path);
    if (
      /(?:^|\/)(?:routes?|controllers?|handlers?|api|services?)(?:\/|\.)/.test(
        normalized,
      )
    )
      grouped.apiAndServices.push(path);
    if (
      /(?:^|\/)(?:models?|schemas?|entities|migrations?|prisma|database|db)(?:\/|\.)/.test(
        normalized,
      )
    )
      grouped.dataModels.push(path);
    if (
      /(?:^|\/)(?:components?|pages?|views?|client|frontend|ui)(?:\/|\.)/.test(
        normalized,
      )
    )
      grouped.clientAndUi.push(path);
    if (
      /(?:^|\/)(?:\.github\/workflows|scripts?|infra|terraform|k8s|helm)(?:\/|\.)/.test(
        normalized,
      ) ||
      /(?:^|\/)(?:dockerfile|docker-compose(?:\.ya?ml)?)$/.test(normalized)
    )
      grouped.operations.push(path);
    if (/(?:^|\/)(?:tests?|__tests__|spec)(?:\/|\.)/.test(normalized))
      grouped.tests.push(path);
  }
  const trim = (items: string[]) =>
    items.sort((left, right) => left.localeCompare(right)).slice(0, 20);
  const parts = new Set(
    files
      .map(({ path }) => path.split("/")[0])
      .filter((part) =>
        /^(?:client|frontend|web|server|backend|api|app|mobile)$/i.test(part),
      ),
  );
  return {
    scanLevel: "bounded-deep",
    repositoryShape:
      parts.size >= 2 ? "multi-part candidate" : "single-part candidate",
    categories: Object.fromEntries(
      Object.entries(grouped).map(([name, paths]) => [name, trim(paths)]),
    ),
    filesInspected: files.length,
  };
}

function directMarkdownArtifact(
  content: string,
  name: keyof ResumeEvidenceDocumenterResponse["artifacts"],
): string {
  const expectedHeading: Record<
    keyof ResumeEvidenceDocumenterResponse["artifacts"],
    string
  > = {
    "project-overview.md": "# Project Overview (Proposed / Unreviewed)",
    "resume-evidence.md": "# Resume Evidence (Proposed / Unreviewed)",
    "resume-bullet-candidates.md":
      "# Resume Bullet Candidates (Proposed / Unreviewed)",
    "resume-summary.md": "# Resume Summary (Proposed / Unreviewed)",
  };
  const trimmed = content.trim();
  const fenced = /^```(?:(?:markdown|md)\s*\n|\s*\n)([\s\S]*?)\s*```$/i.exec(
    trimmed,
  );
  const candidate = (fenced?.[1] ?? trimmed).trim();
  try {
    const parsed = parseModelJson(candidate);
    if (
      parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed) &&
      exactKeys(parsed as Record<string, unknown>, ["artifact"]) &&
      boundedText((parsed as Record<string, unknown>).artifact, 48_000)
    )
      return directMarkdownArtifact(
        String((parsed as Record<string, unknown>).artifact),
        name,
      );
  } catch {
    /* Direct Markdown is intentionally allowed for this artifact-only endpoint. */
  }
  const expected =
    name === "project-overview.md"
      ? /# (?:Project|Experience) Overview \(Proposed \/ Unreviewed\)/.test(
          candidate,
        )
      : candidate.startsWith(expectedHeading[name]);
  if (!boundedText(candidate, 48_000) || !expected)
    documenterInvalid(
      "The local documentation skill returned an incomplete result.",
    );
  return candidate;
}

function pruneFilesForOverview(
  files: ResumeEvidenceDocumenterRequest["files"],
): Array<{ path: string; text: string }> {
  const sorted = [...files].sort(
    (left, right) => sourcePriority(left.path) - sourcePriority(right.path),
  );
  let totalChars = 0;
  const maxTotalChars = 24_000;
  return sorted.map(({ path, text }) => {
    const priority = sourcePriority(path);
    const perFileLimit = priority === 0 ? 5_000 : priority <= 2 ? 2_000 : 800;
    const remainingBudget = Math.max(0, maxTotalChars - totalChars);
    const sliceLen = Math.min(text.length, perFileLimit, remainingBudget);
    const sliced =
      text.length > sliceLen
        ? `${text.slice(0, sliceLen)}\n...[content truncated for overview]`
        : text;
    totalChars += sliced.length;
    return { path, text: sliced };
  });
}

async function documentArtifact(
  request: ResumeEvidenceDocumenterRequest,
  name: keyof ResumeEvidenceDocumenterResponse["artifacts"],
  fetcher: FetchLike,
  curatedHandoff?: { evidence: string; summary: string },
): Promise<string> {
  const fallback = () =>
    name === "project-overview.md"
      ? fallbackProjectOverviewArtifact(request)
      : name === "resume-summary.md"
        ? fallbackResumeSummaryArtifact(request)
        : fallbackBulletCandidatesArtifact();
  try {
    const categorySpecific =
      name === "project-overview.md" || name === "resume-summary.md"
        ? folderDocumenterArtifactInstruction(request.category, name)
        : artifactInstructions[name];
    const input = curatedHandoff
      ? {
          category: request.category,
          sourceDigest: request.sourceDigest,
          resumeEvidence: curatedHandoff.evidence,
          resumeSummary: curatedHandoff.summary,
        }
      : {
          category: request.category,
          sourceDigest: request.sourceDigest,
          projectScan: bmadProjectScanContext(request.files),
          files: pruneFilesForOverview(request.files),
        };
    const content = await nativeText(
      request.connection,
      `${folderDocumenterSystemInstruction(request.category)} ${documenterSystemInstruction} ${categorySpecific} Return only the requested Markdown artifact: no JSON envelope, no code fence, and no explanation before or after it.`,
      input,
      artifactMaximumTokens[name],
      fetcher,
      "EVIDENCE_DOCUMENTER_INVALID",
      50_000,
    );
    const artifact = directMarkdownArtifact(content, name);
    return containsAbsolutePath(artifact) ? fallback() : artifact;
  } catch (error) {
    if (
      error instanceof WorkspaceError &&
      error.code === "EVIDENCE_DOCUMENTER_INVALID"
    )
      return fallback();
    throw error;
  }
}

export async function requestResumeEvidenceDocumentation(
  request: ResumeEvidenceDocumenterRequest,
  fetcher: FetchLike = fetch,
): Promise<ResumeEvidenceDocumenterResponse> {
  validateDocumenterRequest(request);
  const evidence = anchoredEvidenceArtifact(request);
  const summary = await documentArtifact(request, "resume-summary.md", fetcher);
  const overview =
    request.category === "experience"
      ? deriveExperienceOverviewArtifact(summary, request)
      : await documentArtifact(request, "project-overview.md", fetcher);
  const artifacts = {
    "project-overview.md": overview,
    "resume-evidence.md": evidence,
    "resume-bullet-candidates.md": await documentArtifact(
      request,
      "resume-bullet-candidates.md",
      fetcher,
      { evidence, summary },
    ),
    "resume-summary.md": summary,
  };
  return validateDocumenterResponse(
    { schemaVersion: 1, selectionEcho: request.consentFingerprint, artifacts },
    request,
  );
}

export function buildResumeDocumentationSet(
  request: ResumeEvidenceDocumenterRequest,
): Record<string, string> {
  const paths = [...request.files]
    .map((file) => file.path)
    .sort((left, right) => left.localeCompare(right));
  const by = (pattern: RegExp) =>
    request.files.filter((file) => pattern.test(file.path));
  const sourceMap = (files: ResumeEvidenceSourceFile[], maximum = 36) =>
    files
      .flatMap((file) =>
        file.text
          .split(/\r?\n/)
          .map((raw, index) => ({
            text: raw.trim(),
            line: index + 1,
            path: file.path,
          }))
          .filter(
            (item) =>
              item.text.length >= 20 &&
              item.text.length <= 800 &&
              isSourceFact(item.text, item.path),
          )
          .slice(0, 5),
      )
      .slice(0, maximum)
      .map(
        (item) =>
          `- ${item.text}\n  - Source: \`${item.path}\`, document, line ${item.line}`,
      )
      .join("\n");
  const list = (items: string[]) =>
    items.length
      ? items.map((path) => `- \`${path}\``).join("\n")
      : "- No matching files were found in the bounded scan.";
  const api = by(
    /(?:^|\/)(?:routes?|controllers?|handlers?|api|services?)(?:\/|\.)/i,
  );
  const data = by(
    /(?:^|\/)(?:models?|schemas?|entities|migrations?|prisma|database|db)(?:\/|\.)/i,
  );
  const ui = by(
    /(?:^|\/)(?:components?|pages?|views?|client|frontend|ui)(?:\/|\.)/i,
  );
  const operations = by(
    /(?:^|\/)(?:\.github\/workflows|scripts?|infra|terraform|k8s|helm)(?:\/|\.)/i,
  ).concat(by(/(?:^|\/)(?:dockerfile|docker-compose(?:\.ya?ml)?)$/i));
  const entry = by(
    /(?:^|\/)(?:main|index|app|server|application)\.(?:[cm]?[jt]sx?|py|go|rs|java|kt|cs|rb|php)$/i,
  );
  const manifests = by(
    /(?:^|\/)(?:package\.json|pyproject\.toml|cargo\.toml|composer\.json|go\.mod|pom\.xml|requirements(?:\.txt)?|dockerfile|docker-compose(?:\.ya?ml)?)$/i,
  );
  const documentation = by(
    /(?:^|\/)(?:readme|overview|architecture|design|requirements?|documentation|contributing|deployment|evaluation|certificate|report|notes?|summary|context|deliverables?|week[_-]?\d+)\.(?:md|txt|ya?ml|pdf)$/i,
  ).concat(by(/(?:^|\/)(?:docs?|documentation|reports?|logs?)\//i));
  const tests = by(/(?:^|\/)(?:tests?|__tests__|spec)(?:\/|\.)/i);
  const contribution = by(
    /(?:^|\/)(?:contributing|code_of_conduct)\.(?:md|txt)$/i,
  );
  const topLevelParts = [
    ...new Set(
      paths
        .map((path) => path.split("/")[0])
        .filter((part) =>
          /^(?:client|frontend|web|server|backend|api|app|mobile)$/i.test(part),
        ),
    ),
  ].sort((left, right) => left.localeCompare(right));
  const multiPart = topLevelParts.length >= 2;
  const projectScan = bmadProjectScanContext(request.files);
  const technologyCategory = (name: string, development = false) => {
    if (development) return "Development tooling";
    const clean = name.toLowerCase().replace(/^@types\//, "").replace(/^@/, "");
    if (
      clean.endsWith("-dom") ||
      clean.includes("-rate-limit") ||
      clean.includes("-oauth") ||
      clean.includes("-toast") ||
      clean.includes("-memory-server") ||
      clean === "cross-env" ||
      clean === "dotenv" ||
      clean === "nodemon" ||
      clean === "supertest" ||
      clean === "jest" ||
      clean.includes("faker")
    )
      return "Application dependency";
    if (
      /^(?:react|next|vue|nuxt|angular|svelte|express|fastify|nestjs|flask|django|fastapi|spring|rails|laravel)$/i.test(
        clean,
      ) ||
      /^(?:react-router|react-router-dom)$/i.test(clean)
    )
      return "Framework";
    if (
      /^(?:postgres|postgresql|pg|mysql|mariadb|mongo|mongodb|mongoose|sqlite|sqlite3|prisma|sequelize|typeorm|redis|supabase)$/i.test(
        clean,
      )
    )
      return "Data store or data tooling";
    if (/^(?:docker|docker-compose|kubernetes|terraform|helm)$/i.test(clean))
      return "Operational tooling";
    if (/^(?:pytest|jest|vitest|playwright|cypress)$/i.test(clean))
      return "Test tooling";
    return "Application dependency";
  };
  const stackFacts = (() => {
    const facts: Array<{
      category: string;
      detail: string;
      path: string;
      line: number;
    }> = [];
    const push = (
      category: string,
      detail: string,
      path: string,
      line: number,
    ) => {
      if (detail && !containsAbsolutePath(detail) && facts.length < 40)
        facts.push({
          category,
          detail: detail.replaceAll("|", "\\|"),
          path,
          line,
        });
    };
    for (const file of manifests) {
      const normalized = file.path.toLowerCase();
      let packageSection: "dependencies" | "devDependencies" | "" = "";
      for (const [index, raw] of file.text.split(/\r?\n/).entries()) {
        const text = raw.trim();
        const line = index + 1;
        if (!text || text.startsWith("#") || text.startsWith("//")) continue;
        if (
          /requirements(?:\.txt)?$/i.test(normalized) &&
          /^[a-z][a-z0-9_.-]*(?:\[[^\]]+\])?(?:[<>=!~].*)?$/i.test(text)
        ) {
          const pkg = text.split(/[<>=!~]/)[0]!.trim();
          push(technologyCategory(pkg), text, file.path, line);
          continue;
        }
        if (/package\.json$/i.test(normalized)) {
          const section = /^"(dependencies|devDependencies)"\s*:\s*\{/.exec(
            text,
          );
          if (section) {
            packageSection = section[1] as "dependencies" | "devDependencies";
            continue;
          }
          if (packageSection && /^},?$/.test(text)) {
            packageSection = "";
            continue;
          }
          const dependency = /^"([^"\s]+)"\s*:\s*"([^"\s]+)"[,]?$/.exec(text);
          if (packageSection && dependency)
            push(
              technologyCategory(
                dependency[1],
                packageSection === "devDependencies",
              ),
              `\`${dependency[1]}\` ${dependency[2]}`,
              file.path,
              line,
            );
          continue;
        }
        if (/dockerfile$/i.test(normalized) && /^FROM\s+.+/i.test(text)) {
          push("Container runtime image", text, file.path, line);
          continue;
        }
        if (
          /docker-compose(?:\.ya?ml)?$/i.test(normalized) &&
          /^(?:image|build):\s*.+/i.test(text)
        ) {
          push("Container orchestration", text, file.path, line);
          continue;
        }
        if (
          /pyproject\.toml$/i.test(normalized) &&
          /^(?:requires-python|python)\s*=\s*.+/i.test(text)
        ) {
          push("Language runtime", text, file.path, line);
          continue;
        }
        if (/go\.mod$/i.test(normalized) && /^go\s+\d/.test(text)) {
          push("Language runtime", text, file.path, line);
          continue;
        }
        if (
          /cargo\.toml$/i.test(normalized) &&
          /^(?:edition|rust-version)\s*=\s*.+/i.test(text)
        ) {
          push("Language runtime", text, file.path, line);
        }
      }
    }

    // Language runtimes and operational tools evidenced by manifests or entrypoints
    if (
      manifests.some((m) => /requirements(?:\.txt)?|pyproject\.toml$/i.test(m.path)) ||
      paths.some((p) => /\.py$/i.test(p))
    ) {
      push("Language runtime", "Python", manifests[0]?.path ?? "project", 1);
    }
    if (manifests.some((m) => /package\.json$/i.test(m.path))) {
      const isTs =
        paths.some((p) => /\.tsx?$/i.test(p) || /tsconfig\.json$/i.test(p)) ||
        manifests.some((m) => /typescript/i.test(m.text));
      push("Language runtime", isTs ? "TypeScript" : "JavaScript", "package.json", 1);
    }
    if (manifests.some((m) => /go\.mod$/i.test(m.path)) || paths.some((p) => /\.go$/i.test(p))) {
      push("Language runtime", "Go", "go.mod", 1);
    }
    if (manifests.some((m) => /dockerfile|docker-compose(?:\.ya?ml)?$/i.test(m.path))) {
      push("Operational tooling", "Docker", "docker-compose.yml", 1);
    }
    if (
      paths.some((p) => /(?:db|database|storage)\.py$/i.test(p)) &&
      request.files.some((f) => /sqlite/i.test(f.text))
    ) {
      push("Data store or data tooling", "SQLite", "src/storage/db.py", 1);
    }

    // Experience folders or document-only projects without package manifests
    if (manifests.length === 0) {
      const knownTechMap: Array<[RegExp, string, string]> = [
        [/\bReact\b(?!\s*Router)/, "React", "Framework"],
        [/\bReact\s*Router(?:\s*7)?\b/i, "React Router", "Framework"],
        [/\bTypeScript\b/i, "TypeScript", "Language runtime"],
        [/\bJavaScript\b/i, "JavaScript", "Language runtime"],
        [/\bGo(?:lang)?\b|\busing Go\b/i, "Go", "Language runtime"],
        [/\bPython\b/i, "Python", "Language runtime"],
        [/\bTailwind(?:CSS)?\b/i, "Tailwind CSS", "Framework"],
        [/\bNext\.?js\b/i, "Next.js", "Framework"],
        [/\bExpress(?:\.js)?\b/i, "Express", "Framework"],
        [/\bFlask\b/i, "Flask", "Framework"],
        [/\bFastAPI\b/i, "FastAPI", "Framework"],
        [/\bDjango\b/i, "Django", "Framework"],
        [/\bSQLite\b/i, "SQLite", "Data store or data tooling"],
        [/\bPostgre(?:SQL)?\b/i, "PostgreSQL", "Data store or data tooling"],
        [/\bMongo(?:DB)?\b/i, "MongoDB", "Data store or data tooling"],
        [/\bMongoose\b/i, "Mongoose", "Data store or data tooling"],
        [/\bDocker\b/i, "Docker", "Operational tooling"],
        [/\bSupabase\b/i, "Supabase", "Data store or data tooling"],
      ];
      for (const [pattern, tech, cat] of knownTechMap) {
        const matchingFile = request.files.find((f) => pattern.test(f.text));
        if (matchingFile) {
          push(cat, tech, matchingFile.path, 1);
        }
      }
    }

    return facts;
  })();
  const coreTech = (() => {
    const frameworkNames = new Set<string>();
    const languageNames = new Set<string>();
    const dataNames = new Set<string>();
    const toolingNames = new Set<string>();

    const normalize = (item: string) => {
      const lower = item.toLowerCase();
      if (lower === "next") return "Next.js";
      if (lower === "react") return "React";
      if (lower === "react-router" || lower === "react-router-dom") return "React Router";
      if (lower === "python") return "Python";
      if (lower === "typescript") return "TypeScript";
      if (lower === "javascript") return "JavaScript";
      if (lower === "flask") return "Flask";
      if (lower === "fastapi") return "FastAPI";
      if (lower === "django") return "Django";
      if (lower === "sqlite" || lower === "sqlite3") return "SQLite";
      if (lower === "postgres" || lower === "postgresql" || lower === "pg") return "PostgreSQL";
      if (lower === "docker" || lower === "dockerfile" || lower === "docker-compose") return "Docker";
      if (lower === "node" || lower === "nodejs") return "Node.js";
      if (lower === "tailwind" || lower === "tailwindcss") return "Tailwind CSS";
      if (lower === "mongodb") return "MongoDB";
      if (lower === "mongoose") return "Mongoose";
      if (lower === "go" || lower === "golang") return "Go";
      if (lower === "rust") return "Rust";
      if (lower === "express") return "Express";
      if (lower === "supabase") return "Supabase";
      return item.charAt(0).toUpperCase() + item.slice(1);
    };

    for (const fact of stackFacts) {
      const match = /`?([a-zA-Z0-9_\-.]+)/.exec(
        fact.detail.replace(/^(?:FROM|image:\s*|build:\s*)/i, "").trim(),
      );
      if (!match) continue;
      const rawName = match[1]!.replace(/^@types\//, "").replace(/^@/, "");
      if (
        !rawName ||
        /^(?:true|false|latest|slim|alpine|bookworm|local)$/i.test(rawName)
      )
        continue;
      if (
        rawName.endsWith("-dom") ||
        rawName.includes("-rate-limit") ||
        rawName.includes("-oauth") ||
        rawName.includes("-toast") ||
        rawName.includes("-memory-server") ||
        rawName === "cross-env" ||
        rawName === "dotenv" ||
        rawName === "nodemon" ||
        rawName === "supertest" ||
        rawName === "jest" ||
        rawName.includes("faker") ||
        rawName.includes("sp-local")
      )
        continue;

      const norm = normalize(rawName);
      if (fact.category === "Framework") frameworkNames.add(norm);
      else if (fact.category === "Language runtime") languageNames.add(norm);
      else if (fact.category === "Data store or data tooling") dataNames.add(norm);
      else if (fact.category === "Operational tooling" || fact.category === "Container orchestration") toolingNames.add(norm);
    }

    const ordered = [
      ...Array.from(frameworkNames),
      ...Array.from(languageNames),
      ...Array.from(dataNames),
      ...Array.from(toolingNames),
    ];
    return [...new Set(ordered)].slice(0, 5);
  })();
  const coreTechSection = coreTech.length
    ? `## Core Technologies\n\n${coreTech.join(", ")}\n\n`
    : "";
  const stackTable = stackFacts.length
    ? `| Category | Directly supported detail | Source |\n| --- | --- | --- |\n${stackFacts.map((fact) => `| ${fact.category} | ${fact.detail} | \`${fact.path}\`, line ${fact.line} |`).join("\n")}`
    : "No framework, dependency, runtime, or tooling entries were directly identified in the inspected manifest lines.";
  const heading = (title: string) =>
    `# ${title}\n\n> Generated from a bounded, read-only local project scan. Paths are relative to the selected folder.\n`;
  const documents: Record<string, string> = {
    "source-tree-analysis.md": `${heading("Source Tree Analysis")}## Inspected paths\n\n${list(paths)}\n\n## Critical areas\n\n${list([...entry, ...api, ...data, ...ui, ...operations, ...tests].map((file) => file.path))}\n\n## Entry points\n\n${list(entry.map((file) => file.path))}`,
    "technology-stack.md": `${heading("Technology Stack")}${coreTechSection}## Manifests and configuration\n\n${list(manifests.map((file) => file.path))}\n\n## Technology inventory\n\n${stackTable}\n\n## Classification notes\n\n- Runtime commands, service commands, and deployment steps are intentionally documented in \`development-guide.md\` or \`deployment-guide.md\`, not treated as stack entries.\n- This inventory lists only directly supported manifest or container-runtime details; it does not infer deployed services, ownership, scale, or outcomes.`,
    "architecture.md": `${heading("Architecture")}## Project shape\n\n- ${String(projectScan.repositoryShape)}\n\n## Existing documentation\n\n${list(documentation.map((file) => file.path))}\n\n## Entry points\n\n${list(entry.map((file) => file.path))}\n\n## Architecture evidence\n\n${sourceMap([...entry, ...api, ...data, ...ui], 45) || "- No supported architecture facts were found."}\n\n## Testing strategy material\n\n${list(tests.map((file) => file.path))}`,
    "development-guide.md": `${heading("Development Guide")}## Development and test material\n\n${list([...manifests, ...tests].map((file) => file.path))}\n\n## Directly supported commands and workflow details\n\n${sourceMap([...manifests, ...tests], 36) || "- No supported development workflow details were found."}`,
  };
  if (api.length)
    documents["api-contracts.md"] =
      `${heading("API Contracts")}## API and service files\n\n${list(api.map((file) => file.path))}\n\n## Directly supported contracts\n\n${sourceMap(api, 48) || "- No supported API contracts were found."}`;
  if (data.length)
    documents["data-models.md"] =
      `${heading("Data Models")}## Model and schema files\n\n${list(data.map((file) => file.path))}\n\n## Directly supported model details\n\n${sourceMap(data, 48) || "- No supported data-model details were found."}`;
  if (ui.length)
    documents["component-inventory.md"] =
      `${heading("Component Inventory")}## Client and UI files\n\n${list(ui.map((file) => file.path))}\n\n## Directly supported component details\n\n${sourceMap(ui, 48) || "- No supported UI details were found."}`;
  if (operations.length)
    documents["deployment-guide.md"] =
      `${heading("Operations and Deployment")}## Operational files\n\n${list(operations.map((file) => file.path))}\n\n## Directly supported operational details\n\n${sourceMap(operations, 36) || "- No supported operational details were found."}`;
  if (contribution.length)
    documents["contribution-guide.md"] =
      `${heading("Contribution Guide")}## Contribution material\n\n${list(contribution.map((file) => file.path))}\n\n## Directly supported contribution practices\n\n${sourceMap(contribution, 30) || "- No supported contribution details were found."}`;
  if (multiPart) {
    documents["project-parts.md"] =
      `${heading("Project Parts")}## Detected parts\n\n${topLevelParts.map((part) => `- \`${part}/\``).join("\n")}\n\n## Part-specific files\n\n${list(request.files.filter((file) => topLevelParts.includes(file.path.split("/")[0]!)).map((file) => file.path))}`;
    documents["integration-architecture.md"] =
      `${heading("Integration Architecture")}## Detected parts\n\n${topLevelParts.map((part) => `- \`${part}/\``).join("\n")}\n\n## Interface and integration material\n\n${list([...api, ...ui, ...entry].map((file) => file.path))}\n\n## Directly supported integration details\n\n${sourceMap([...api, ...ui], 40) || "- No supported cross-part interface details were found."}`;
  }
  if (request.category === "experience") {
    const dateRange = extractDateFromDocs(request.files);
    const dateSection = dateRange ? `## Documented Period\n\n- ${dateRange}\n\n` : "";
    documents["experience-context.md"] =
      `${heading("Experience Context")}${dateSection}## Documented role context\n\n${sourceMap([...documentation, ...manifests], 36) || "- No documented role, organization, or period was found in the bounded scan."}\n\n## Explicit gaps\n\n- Treat role title, organization, period, personal attribution, and employment status as unknown unless the selected material states them directly.`;
    documents["work-deliverables.md"] =
      `${heading("Work Deliverables")}## Directly supported work outputs\n\n${sourceMap([...entry, ...api, ...data, ...ui, ...documentation], 54) || "- No direct work-output facts were found."}\n\n## Interpretation boundary\n\n- Source code or a file's presence is context only; it does not establish that the candidate owned or delivered the work.`;
    documents["collaboration-and-process.md"] =
      `${heading("Collaboration and Process")}## Process and collaboration material\n\n${sourceMap([...documentation, ...tests, ...operations], 40) || "- No direct collaboration, review, or process facts were found."}\n\n## Explicit gaps\n\n- Team size, review role, stakeholder interaction, and delivery impact remain unknown unless directly documented.`;
  }
  const overviewArtifact =
    request.category === "experience"
      ? "experience-overview.md"
      : "project-overview.md";
  const documentationLinks = [
    overviewArtifact,
    "resume-evidence.md",
    "resume-bullet-candidates.md",
    "resume-summary.md",
    ...Object.keys(documents).sort((left, right) => left.localeCompare(right)),
  ]
    .map((name) => `- [${name}](./${name})`)
    .join("\n");
  const indexTitle =
    request.category === "experience"
      ? "Experience Documentation Index"
      : "Project Documentation Index";
  const handoff =
    request.category === "experience"
      ? "Use this documentation set to understand the documented work context before creating a base-resume description. Resume claims must be summarized from the provenance-locked facts in `resume-evidence.md`; source files do not prove personal ownership, employment terms, or impact on their own."
      : "Use this documentation set to understand the project before creating a base-resume description. Resume claims must be summarized from the provenance-locked facts in `resume-evidence.md`; the surrounding documentation provides architecture and implementation context, not unsupported ownership, impact, or metric claims.";
  documents["index.md"] =
    `${heading(indexTitle)}## ${request.category === "experience" ? "Experience" : "Project"} overview\n\n- Classification: ${String(projectScan.repositoryShape)}\n- Files inspected: ${request.files.length}\n\n## Documentation set\n\n${documentationLinks}\n\n## Resume-description handoff\n\n${handoff}`;
  return documents;
}

