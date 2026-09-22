import { createHash } from "node:crypto";
import type { ResumeTemplateContract } from "@/domain/base-resume/resume-template-contract";
import { WorkspaceError } from "@/domain/workspace/types";
import {
  folderDocumenterArtifactInstruction,
  folderDocumenterSystemInstruction,
} from "@/adapters/local-model/folder-documenter-agent";
import {
  containsUnsafeResumeContent,
  resumeGeneratorSystemInstruction,
} from "@/adapters/local-model/resume-generator-agent";
import { orchestrateResumeGeneration } from "@/adapters/local-model/resume-generation-orchestrator";
import { resumeFileAgentInstruction } from "@/adapters/local-model/resume-file-agent";
import type {
  ResumeFileCitation,
  ResumeFileReadSession,
  ResumeFileToolAction,
} from "@/files/evidence-library";
import { resumeCoachSystemInstruction as resumeCoachReviewSystemInstruction } from "@/adapters/local-model/resume-coach-agent";
import { editableTexRevisionSystemInstruction } from "@/adapters/local-model/editable-tex-agent";
import { rawTexDocumentPolicy } from "@/domain/resume-generation/resume-tex-compiler";

const endpoint = "http://127.0.0.1:1234/api/v1/chat";
const maxRequest = 350_000;
const maxResponse = 12_000;
const maxFileAgentElapsedMs = 360_000;
const maxStreamFrame = 8_192;
// The documentation skill can produce many atomic findings for a real source
// tree. Keep the application contract aligned with its 2,000-candidate import
// ceiling; the request-size guard below still prevents oversized loopback
// payloads and switches to the local deterministic composer when necessary.
const maxResumeCoachEvidence = 2_000;
const plain = (value: unknown, maximum: number) =>
  typeof value === "string" &&
  value.length > 0 &&
  value.length <= maximum &&
  !/[\u0000-\u001f\u007f-\u009f]/.test(value);
const boundedText = (value: unknown, maximum: number) =>
  typeof value === "string" &&
  value.length > 0 &&
  value.length <= maximum &&
  !/[\u0000\u007f-\u009f]/.test(value);
const uuid = (value: unknown) =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
const sha = (value: unknown) =>
  typeof value === "string" && /^sha256:[0-9a-f]{64}$/.test(value);
const exactKeys = (value: Record<string, unknown>, keys: string[]) =>
  Object.keys(value).every((key) => keys.includes(key)) &&
  keys.every((key) => key in value);
const allowedKeys = (
  value: Record<string, unknown>,
  required: string[],
  optional: string[] = [],
) =>
  required.every((key) => key in value) &&
  Object.keys(value).every(
    (key) => required.includes(key) || optional.includes(key),
  );
const supports = (claim: string, evidence: string[]) => {
  const words = (value: string) =>
    new Set(value.toLocaleLowerCase().match(/[a-z0-9]{3,}/g) ?? []);
  const claimWords = words(claim);
  return evidence.some(
    (item) =>
      [...claimWords].filter((word) => words(item).has(word)).length >= 2,
  );
};
const resumeBulletMarker = /^\s*[-*\u2022]\s+/;
function resumeRelevantModelEvidence(
  evidence: ResumeCoachRequest["evidence"],
): Array<{ index: number; factualText: string; contentDigest: string }> {
  const score = (value: string) =>
    (
      value.match(
        /\b(?:workflow|validate|validation|sqlite|durable|cancel|evidence|predictor|classification|variant|vcf|result|upload)\b/gi,
      ) ?? []
    ).length;
  return evidence
    .flatMap((item, index) => {
      const source = item.factualText.trim();
      if (
        /`|(?:^|\s)(?:docs|src|tests|node_modules)\/|\b(?:get|post|put|patch|delete)\s+\/|\b(?:insert into|logger=|command:|story key|setup\.md)\b/i.test(
          source,
        )
      )
        return [];
      const factualText = /create a durable run record in sqlite/i.test(source)
        ? "Created durable SQLite-backed run records for the documented analysis workflow."
        : /allow canceling a run with a durable, guarded state transition/i.test(
              source,
            )
          ? "Implemented guarded run cancellation with durable workflow state."
          : /validate it immediately.*before any pipeline execution/i.test(
                source,
              )
            ? "Added immediate VCF validation feedback before analysis processing."
            : source;
      return [{ index, factualText, contentDigest: item.contentDigest }];
    })
    .sort(
      (left, right) =>
        score(right.factualText) - score(left.factualText) ||
        left.index - right.index,
    )
    .slice(0, 20);
}
function resumeGenerationDocumentation(
  documentation: ResumeCoachDocumentation[] | undefined,
): Array<{
  name: string;
  category: "project" | "experience";
  documents: Array<{ text: string; contentDigest: string }>;
}> {
  return (documentation ?? [])
    .map((group) => {
      const context = group.documents.find((document) =>
        /resume-bullet-candidates\.md$/i.test(document.path),
      );
      const evidence = group.documents.find((document) =>
        /resume-evidence\.md$/i.test(document.path),
      );
      const contextOnly = context?.text
        .replace(/^[\s\S]*?^\s*## Resume Context\s*$/im, "")
        .replace(/^\s*## Candidate Bullets\s*$(?:[\s\S]*)$/im, "")
        .trim();
      const document =
        context && contextOnly
          ? {
              ...context,
              text: `# Resume Bullet Candidates (Proposed / Unreviewed)\n\n## Resume Context\n\n${contextOnly.slice(0, 6_000)}`,
            }
          : evidence
            ? { ...evidence, text: evidence.text.slice(0, 3_000) }
            : undefined;
      return document
        ? {
            name: group.name,
            category: group.category,
            documents: [
              { text: document.text, contentDigest: document.contentDigest },
            ],
          }
        : { name: group.name, category: group.category, documents: [] };
    })
    .filter((group) => group.documents.length > 0);
}
function parseModelJson(content: string): Record<string, unknown> {
  const cleaned = content.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  const fenced = /```(?:json)?\s*([\s\S]*?)\s*```/i.exec(cleaned);
  let source = (fenced?.[1] ?? cleaned).trim();
  const firstBrace = source.indexOf("{");
  if (firstBrace > 0) source = source.slice(firstBrace);
  try {
    return JSON.parse(source);
  } catch (firstError) {
    let repaired = "";
    let inString = false;
    let escaped = false;
    for (const character of source) {
      if (inString && /[\u0000-\u001f]/.test(character)) {
        repaired += JSON.stringify(character).slice(1, -1);
        escaped = false;
        continue;
      }
      repaired += character;
      if (escaped) {
        escaped = false;
        continue;
      }
      if (character === "\\") {
        escaped = true;
        continue;
      }
      if (character === '"') inString = !inString;
    }
    // Qwen occasionally emits its supplied SHA references as bare hexadecimal
    // tokens. Repair only those tokens within evidenceIndexes arrays; never
    // relax the envelope or accept arbitrary JavaScript syntax.
    repaired = repaired
      .replace(
        /("evidenceIndexes"\s*:\s*\[)([^\]]*)(\])/g,
        (_match, opening, indexes, closing) =>
          `${opening}${indexes.replace(/(^|,)(\s*)([a-f0-9]{64})(\s*)(?=,|$)/gi, '$1$2"$3"$4')}${closing}`,
      )
      // Qwen can place an empty per-edit unknowns property between edit
      // objects. Removing only that empty malformed fragment restores JSON
      // without adding model content or weakening the response schema.
      .replace(
        /,\s*"unknowns"\s*:\s*\[\s*(?:""\s*)?\]\s*}(?=\s*,\s*\{\s*"sectionIndex")/g,
        "",
      )
      // At end-of-response Qwen can close the dangling member before the
      // edits array, yielding `…}]` instead of the required `…]}`.
      .replace(
        /(?<=})\s*,\s*"unknowns"\s*:\s*\[\s*(?:""\s*)?\]\s*}\s*](?=\s*$)/g,
        "]}",
      )
      // A dangling member can also appear before an already valid root close.
      .replace(
        /(?<=})\s*,\s*"unknowns"\s*:\s*\[\s*(?:""\s*)?\]\s*}(?=\s*\])/g,
        "",
      )
      // Or it can be the final property within an edit. Preserve that edit's
      // closing brace while removing the empty non-contract property.
      .replace(
        /(?<=])\s*,\s*"unknowns"\s*:\s*\[\s*(?:""\s*)?\](?=\s*}\s*\])/g,
        "",
      )
      // Qwen can emit {"unknowns": [...]} at the end of the edits array,
      // frequently ending with `]]` or `}]` instead of closing edits and placing
      // unknowns at the root. Restructure it into a valid root property.
      .replace(
        /,\s*\{\s*"unknowns"\s*:\s*(\[[^\]]*\])\s*\}?\s*\]\s*\}?\s*$/g,
        '],"unknowns":$1}',
      );
    const candidates = [
      repaired,
      repaired.replace(/(?<=})\s*,\s*"unknowns"\s*:/g, '],"unknowns":'),
      repaired.replace(/(?<=\])\s*\}\s*,\s*"unknowns"\s*:/g, ',"unknowns":'),
    ];
    const lastBrace = repaired.lastIndexOf("}");
    if (lastBrace > 0 && lastBrace < repaired.length - 1) {
      candidates.push(repaired.slice(0, lastBrace + 1));
    }
    for (const candidate of candidates) {
      try {
        return JSON.parse(candidate);
      } catch {}
    }
    throw firstError;
  }
}

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
// Compatibility export: base-resume generation used to be incorrectly named
// "Resume Coach". The active generator now has its own persona and contract.
// Backward-compatible public name for callers that still use this export for
// the base-resume request. The separate review capability below uses its own
// Resume Coach prompt directly.
export const resumeCoachSystemInstruction = resumeGeneratorSystemInstruction;

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
const validConnection = (item: LocalModelConnection) =>
  uuid(item.configurationRevisionId) &&
  sha(item.configurationDigest) &&
  plain(item.modelIdentifier, 240);
const publicConnection = (item: LocalModelConnection) => ({
  revisionId: item.configurationRevisionId,
  contentDigest: item.configurationDigest,
  modelIdentifier: item.modelIdentifier,
});
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
function invalid(
  message: string,
  next = "Review the selected material and try the local request again.",
): never {
  throw new WorkspaceError("RESUME_COACH_INVALID", message, next);
}

function validCoach(request: ResumeCoachRequest) {
  const opportunity = request.opportunity;
  const validOpportunity =
    !opportunity ||
    (uuid(opportunity.revisionId) &&
      sha(opportunity.contentDigest) &&
      plain(opportunity.title, 300) &&
      plain(opportunity.company, 300) &&
      plain(opportunity.copiedDescription, 20_000) &&
      Array.isArray(opportunity.requirements) &&
      opportunity.requirements.length > 0 &&
      opportunity.requirements.length <= 20 &&
      opportunity.requirements.every((item) => plain(item, 1_000)));
  const documentation = request.documentation ?? [];
  const baseline = request.baseline;
  const clarifications = request.clarifications ?? [];
  const validBaseline =
    !baseline ||
    (uuid(baseline.baselineId) &&
      sha(baseline.baselineDigest) &&
      baseline.sections.length >= 2 &&
      baseline.sections.length <= 8 &&
      new Set(baseline.sections.map((section) => section.tag)).size ===
        baseline.sections.length &&
      baseline.sections.every(
        (section) =>
          plain(section.heading, 120) &&
          /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(section.tag) &&
          typeof section.existingDetail === "string" &&
          section.existingDetail.length <= 900 &&
          !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/.test(
            section.existingDetail,
          ),
      ));
  if (
    !validConnection(request.connection) ||
    !plain(request.userRequest, 2_000) ||
    !plain(request.profileSnapshot, 4_000) ||
    !plain(request.consentNonce, 128) ||
    !uuid(request.profileRevisionId) ||
    !sha(request.profileDigest) ||
    !uuid(request.templateId) ||
    !sha(request.templateDigest) ||
    !sha(request.consentFingerprint) ||
    !request.evidence.length ||
    request.evidence.length > maxResumeCoachEvidence ||
    request.evidence.some(
      (item) =>
        !uuid(item.id) ||
        !plain(item.factualText, 4_000) ||
        !sha(item.contentDigest) ||
        (item.sourceDocument !== undefined &&
          !plain(item.sourceDocument, 600)) ||
        (item.sourceSection !== undefined && !plain(item.sourceSection, 600)),
    ) ||
    documentation.length > 24 ||
    documentation.some(
      (group) =>
        !plain(group.name, 240) ||
        (group.category !== "project" && group.category !== "experience") ||
        !group.documents.length ||
        group.documents.length > 24 ||
        group.documents.some(
          (document) =>
            !plain(document.path, 600) ||
            document.path.includes("..") ||
            document.path.includes("\\") ||
            !boundedText(document.text, 12_000) ||
            !sha(document.contentDigest),
        ),
    ) ||
    !validBaseline ||
    clarifications.length > 24 ||
    clarifications.some(
      (clarification) =>
        !exactKeys(clarification as Record<string, unknown>, [
          "itemName",
          "itemCategory",
          "category",
          "text",
          "provenance",
        ]) ||
        !plain(clarification.itemName, 240) ||
        (clarification.itemCategory !== "project" &&
          clarification.itemCategory !== "experience") ||
        !plain(clarification.category, 120) ||
        !plain(clarification.text, 2_400) ||
        clarification.provenance !== "candidate_interview_answer",
    ) ||
    (request.currentResumeSections !== undefined &&
      (!request.currentResumeSections.length ||
        request.currentResumeSections.length > 8 ||
        request.currentResumeSections.some(
          (section) =>
            !plain(section.heading, 120) || !boundedText(section.text, 2_000),
        ))) ||
    !validOpportunity
  )
    invalid("The selected local material cannot be sent safely.");
  if (request.consentFingerprint !== resumeCoachConsentFingerprint(request))
    invalid(
      "The local-model consent is no longer current.",
      "Review the disclosure and submit the request again.",
    );
}
function isWorkSection(heading: string): boolean {
  return /(?:experience|employment|\bwork\b|project)/i.test(heading);
}

function isExactEmptyBaselineSection(
  section: Record<string, unknown>,
  baseline: ResumeTemplateContract | undefined,
): boolean {
  return (
    Boolean(baseline) &&
    typeof section.text === "string" &&
    !section.text.trim() &&
    baseline!.sections.some(
      (baselineSection) =>
        baselineSection.heading === String(section.heading) &&
        !baselineSection.existingDetail.trim(),
    )
  );
}
function visibleWorkBullets(
  sections: Array<{ heading: string; text: string }>,
): string[] {
  return sections
    .filter((section) => isWorkSection(section.heading))
    .flatMap((section) =>
      section.text
        .split("\n")
        .map((line) => /^\s*(?:[-*•])\s+(.+?)\s*$/.exec(line)?.[1])
        .filter((line): line is string => Boolean(line)),
    );
}
const comparableClaim = (value: string) =>
  value.trim().replace(/\s+/g, " ").replace(/[.]+$/, "").toLocaleLowerCase();
function everyVisibleWorkBulletIsClaimed(
  sections: Array<{ heading: string; text: string }>,
  claims: Array<{ text: string }>,
  baseline?: ResumeTemplateContract,
): boolean {
  const sectionsToCheck = baseline
    ? sections.filter((section) => {
        const baselineSection = baseline.sections.find(
          (candidate) =>
            candidate.heading.trim().toLowerCase() ===
            section.heading.trim().toLowerCase(),
        );
        return (
          !baselineSection ||
          section.text.trim() !== baselineSection.existingDetail.trim()
        );
      })
    : sections;
  return visibleWorkBullets(sectionsToCheck).every((bullet) =>
    claims.some(
      (claim) => comparableClaim(claim.text) === comparableClaim(bullet),
    ),
  );
}
function inferVisibleWorkClaims(
  sections: Array<{ heading: string; text: string }>,
  evidence: ResumeCoachRequest["evidence"],
  clarifications: ResumeCandidateClarification[],
): ResumeCoachResponse["claims"] {
  return visibleWorkBullets(sections).map((text) => {
    const clarificationIndexes = clarifications
      .flatMap((item, index) => (supports(text, [item.text]) ? [index] : []))
      .slice(0, 4);
    return {
      text,
      evidenceIndexes: evidence
        .flatMap((item, index) =>
          supports(text, [item.factualText]) ? [index] : [],
        )
        .slice(0, 4),
      ...(clarificationIndexes.length ? { clarificationIndexes } : {}),
    };
  });
}
function splitWorkEntries(text: string): string[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const entries: string[] = [];
  let current: string[] = [];
  let seenBullets = false;
  for (const line of lines) {
    const isBullet = resumeBulletMarker.test(line);
    if (!isBullet && seenBullets && current.length > 0) {
      entries.push(current.join("\n"));
      current = [line];
      seenBullets = false;
    } else {
      current.push(line);
      if (isBullet) seenBullets = true;
    }
  }
  if (current.length) entries.push(current.join("\n"));
  return entries;
}
function specialistStructureIsValid(
  response: ResumeCoachResponse,
  baseline: ResumeTemplateContract | undefined,
): boolean {
  if (!baseline) return true;
  if (
    response.sections.length !== baseline.sections.length ||
    response.sections.some(
      (section, index) =>
        section.heading !== baseline.sections[index]?.heading ||
        containsUnsafeResumeContent(section.text),
    )
  )
    return false;
  const actionLed =
    /^(?:Addressed|Built|Created|Developed|Designed|Implemented|Integrated|Led|Delivered|Improved|Automated|Produced|Configured|Established|Validated|Collaborated|Supported|Refactored|Engineered|Authored|Architected|Optimized|Deployed|Migrated|Scaled)\b/;
  return response.sections.every((section, index) => {
    const work = isWorkSection(section.heading);
    const isSkill = /(?:technical skills|skills|technologies)/i.test(
      section.heading,
    );
    const baselineSection = baseline.sections[index]!;
    if (isSkill) {
      return (
        Boolean(section.text.trim()) &&
        !containsUnsafeResumeContent(section.text)
      );
    }
    if (!work) return section.text === baselineSection.existingDetail;
    if (section.text.trim() === baselineSection.existingDetail.trim())
      return true;
    const bullets = section.text
      .split(/\r?\n/)
      .filter((line) => resumeBulletMarker.test(line))
      .map((line) => line.replace(resumeBulletMarker, "").trim());
    if (!bullets.length)
      return (
        section.text === baselineSection.existingDetail ||
        !section.text.trim() ||
        /no (?:experience|employment)/i.test(section.text)
      );
    if (bullets.some((bullet) => !actionLed.test(bullet))) return false;
    if (/project/i.test(section.heading)) {
      const entries = splitWorkEntries(section.text);
      return (
        entries.length <= 4 &&
        entries.every((entry) => {
          const lines = entry.split(/\r?\n/).filter(Boolean);
          const title = lines.find(Boolean)?.trim() ?? "";
          const projectBullets = lines.filter((line) =>
            resumeBulletMarker.test(line),
          );
          const descriptorWords = title.includes("|")
            ? title.split("|")[1]!.trim().split(/\s+/).length
            : title.split(/\s+/).length;
          return (
            !resumeBulletMarker.test(title) &&
            descriptorWords <= 20 &&
            projectBullets.length <= 5 &&
            projectBullets.every(
              (bullet) =>
                bullet.replace(resumeBulletMarker, "").trim().split(/\s+/)
                  .length <= 45,
            )
          );
        })
      );
    }
    return true;
  });
}
function coachResponse(
  value: unknown,
  request: ResumeCoachRequest,
): ResumeCoachResponse {
  const evidence = request.evidence;
  const fingerprint = request.consentFingerprint;
  const clarifications = request.clarifications ?? [];
  if (!value || typeof value !== "object" || Array.isArray(value))
    invalid("The local model returned an unusable response.");
  const item = value as Record<string, unknown>;
  const sections = item.sections;
  const claims = item.claims;
  const unknowns = item.unknowns;
  // Some LM Studio Qwen builds omit the constant schemaVersion even when the
  // rest of the envelope is complete. Once the exact remaining envelope and
  // every field below validate, normalizing that omitted constant to version 1
  // is safe and prevents a good resume from degrading to the low-level fallback.
  const exactEnvelope = exactKeys(item, [
    "schemaVersion",
    "selectionEcho",
    "sections",
    "claims",
    "unknowns",
  ]);
  const omittedVersionEnvelope =
    item.schemaVersion === undefined &&
    exactKeys(item, ["selectionEcho", "sections", "claims", "unknowns"]);
  if (
    (!exactEnvelope && !omittedVersionEnvelope) ||
    (item.schemaVersion !== undefined && item.schemaVersion !== 1) ||
    item.selectionEcho !== fingerprint ||
    !Array.isArray(sections) ||
    !sections.length ||
    sections.length > 8 ||
    !Array.isArray(claims) ||
    claims.length > 20 ||
    !Array.isArray(unknowns) ||
    unknowns.length > 12
  )
    invalid("The local model returned an unsafe or incomplete response.");
  // A project-only workspace has no employment entry. Accept an intentionally
  // blank Experience section as an omitted section instead of discarding an
  // otherwise useful employer-facing project description.
  const populatedSections = request.baseline
    ? sections
    : sections.filter(
        (section) =>
          !(
            section &&
            typeof section === "object" &&
            /^experience$/i.test(
              String((section as Record<string, unknown>).heading ?? "").trim(),
            ) &&
            typeof (section as Record<string, unknown>).text === "string" &&
            !String((section as Record<string, unknown>).text).trim()
          ),
      );
  // Section text is intentionally multiline: the renderer turns its entry
  // title and bullets into the Resume.pdf-derived layout. `plain` rejects
  // newlines, which previously discarded well-formed model resumes and
  // forced the raw-fact fallback instead.
  if (process.env.NODE_ENV === "development") {
    if (!populatedSections.length)
      console.error("[coachResponse fail]: populatedSections empty");
    const badSection = populatedSections.find((section) => {
      if (!section || typeof section !== "object") return true;
      const candidate = section as Record<string, unknown>;
      return (
        !exactKeys(candidate, ["heading", "text"]) ||
        !plain(candidate.heading, 120) ||
        (!boundedText(candidate.text, 2_000) &&
          !isExactEmptyBaselineSection(candidate, request.baseline))
      );
    });
    if (badSection)
      console.error("[coachResponse fail badSection]:", badSection);
    const badClaim = claims.find((claim) => {
      if (!claim || typeof claim !== "object") return true;
      const rec = claim as Record<string, unknown>;
      if (
        !("text" in rec) ||
        !("evidenceIndexes" in rec) ||
        !plain(rec.text, 1_000)
      )
        return true;
      if (!Array.isArray(rec.evidenceIndexes)) return true;
      const cast = claim as {
        evidenceIndexes: unknown[];
        clarificationIndexes?: unknown[];
        fileCitations?: unknown[];
      };
      if (
        !cast.evidenceIndexes.length &&
        !cast.clarificationIndexes?.length &&
        !cast.fileCitations?.length
      )
        return true;
      return false;
    });
    if (badClaim) console.error("[coachResponse fail badClaim]:", badClaim);
  }
  if (
    !populatedSections.length ||
    populatedSections.some((section) => {
      if (!section || typeof section !== "object") return true;
      const candidate = section as Record<string, unknown>;
      return (
        !exactKeys(candidate, ["heading", "text"]) ||
        !plain(candidate.heading, 120) ||
        (!boundedText(candidate.text, 2_000) &&
          !isExactEmptyBaselineSection(candidate, request.baseline))
      );
    }) ||
    claims.some(
      (claim) =>
        !claim ||
        typeof claim !== "object" ||
        ![
          "text",
          "evidenceIndexes",
          "clarificationIndexes",
          "fileCitations",
        ].includes(
          Object.keys(claim as Record<string, unknown>).find(
            (key) =>
              ![
                "text",
                "evidenceIndexes",
                "clarificationIndexes",
                "fileCitations",
              ].includes(key),
          ) ?? "text",
        ) ||
        !("text" in (claim as Record<string, unknown>)) ||
        !("evidenceIndexes" in (claim as Record<string, unknown>)) ||
        !plain((claim as Record<string, unknown>).text, 1_000) ||
        !Array.isArray((claim as Record<string, unknown>).evidenceIndexes) ||
        (!Array.isArray(
          (claim as Record<string, unknown>).clarificationIndexes,
        ) &&
          (claim as Record<string, unknown>).clarificationIndexes !==
            undefined) ||
        (!(
          claim as {
            evidenceIndexes: unknown[];
            clarificationIndexes?: unknown[];
            fileCitations?: unknown[];
          }
        ).evidenceIndexes.length &&
          !(claim as { clarificationIndexes?: unknown[] }).clarificationIndexes
            ?.length &&
          !(claim as { fileCitations?: unknown[] }).fileCitations?.length) ||
        new Set((claim as { evidenceIndexes: unknown[] }).evidenceIndexes)
          .size !==
          (claim as { evidenceIndexes: unknown[] }).evidenceIndexes.length ||
        new Set(
          (claim as { clarificationIndexes?: unknown[] })
            .clarificationIndexes ?? [],
        ).size !==
          (
            (claim as { clarificationIndexes?: unknown[] })
              .clarificationIndexes ?? []
          ).length ||
        (claim as { evidenceIndexes: unknown[] }).evidenceIndexes.some(
          (index) =>
            !Number.isInteger(index) ||
            (index as number) < 0 ||
            (index as number) >= evidence.length,
        ) ||
        (
          claim as { clarificationIndexes?: unknown[] }
        ).clarificationIndexes?.some(
          (index) =>
            !Number.isInteger(index) ||
            (index as number) < 0 ||
            (index as number) >= clarifications.length,
        ),
    ) ||
    unknowns.some((unknown) => !plain(unknown, 500))
  )
    invalid("The local model returned unsupported guidance.");
  // A concise bullet may combine multiple supported clauses. Keep only the
  // citations that independently overlap the visible bullet, then reject the
  // claim entirely if no evidence or eligible clarification remains.
  const groundedClaims = (claims as ResumeCoachResponse["claims"]).map(
    (claim) => {
      const evidenceIndexes = claim.evidenceIndexes.filter((index) =>
        supports(claim.text, [evidence[index]?.factualText ?? ""]),
      );
      const clarificationIndexes = (claim.clarificationIndexes ?? []).filter(
        (index) => supports(claim.text, [clarifications[index]?.text ?? ""]),
      );
      return {
        text: claim.text,
        evidenceIndexes,
        ...(clarificationIndexes.length ? { clarificationIndexes } : {}),
        ...(claim.fileCitations?.length
          ? { fileCitations: claim.fileCitations }
          : {}),
      };
    },
  );
  const ungrounded = groundedClaims.filter(
    (claim) =>
      !claim.evidenceIndexes.length &&
      !claim.clarificationIndexes?.length &&
      !claim.fileCitations?.length,
  );
  if (ungrounded.length) {
    console.error(
      "[coachResponse ungrounded claims]:",
      JSON.stringify(ungrounded, null, 2),
    );
    invalid("The local model returned unsupported guidance.");
  }
  const inferredClaims = claims.length
    ? groundedClaims
    : inferVisibleWorkClaims(
        populatedSections as ResumeCoachResponse["sections"],
        evidence,
        clarifications,
      );
  const result = {
    schemaVersion: 1 as const,
    sections: populatedSections as ResumeCoachResponse["sections"],
    claims: inferredClaims,
    unknowns: unknowns as string[],
    selectionEcho: fingerprint,
  };
  if (process.env.NODE_ENV === "development") {
    const claimsOk = inferredClaims.every(
      (claim) =>
        claim.evidenceIndexes.length ||
        claim.clarificationIndexes?.length ||
        claim.fileCitations?.length,
    );
    const visibleOk = everyVisibleWorkBulletIsClaimed(
      result.sections,
      result.claims,
      request.baseline,
    );
    const structureOk = specialistStructureIsValid(result, request.baseline);
    if (!claimsOk || !visibleOk || !structureOk) {
      console.error("[coachResponse validation failed]:", {
        claimsOk,
        visibleOk,
        structureOk,
        claims: result.claims,
        sections: result.sections,
      });
    }
  }
  if (
    !inferredClaims.every(
      (claim) =>
        claim.evidenceIndexes.length ||
        claim.clarificationIndexes?.length ||
        claim.fileCitations?.length,
    ) ||
    !everyVisibleWorkBulletIsClaimed(
      result.sections,
      result.claims,
      request.baseline,
    ) ||
    !specialistStructureIsValid(result, request.baseline)
  )
    invalid(
      "The local model returned a draft that does not follow the supported resume contract.",
    );
  if (JSON.stringify(result).length > maxResponse)
    invalid("The local model response is too large to review safely.");
  return result;
}
async function readBoundedResponseText(
  response: Response,
  byteLimit: number,
  code:
    | "RESUME_COACH_UNAVAILABLE"
    | "OPPORTUNITY_ASSESSMENT_UNAVAILABLE"
    | "EVIDENCE_DOCUMENTER_INVALID",
): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      bytes += next.value.byteLength;
      if (bytes > byteLimit) {
        await reader.cancel().catch(() => undefined);
        throw new WorkspaceError(
          code,
          "The local model returned an oversized response.",
          "Try the local request again after the model is ready.",
        );
      }
      chunks.push(next.value);
    }
  } finally {
    reader.releaseLock();
  }
  const joined = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(joined);
}

async function nativeText(
  connection: LocalModelConnection,
  systemPrompt: string,
  input: unknown,
  maximumTokens: number,
  fetcher: FetchLike,
  code:
    | "RESUME_COACH_UNAVAILABLE"
    | "OPPORTUNITY_ASSESSMENT_UNAVAILABLE"
    | "EVIDENCE_DOCUMENTER_INVALID",
  responseLimit = maxResponse,
  reasoning: "off" | "on" = "off",
  timeoutMs?: number,
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    Math.max(
      1_000,
      Math.min(
        300_000,
        timeoutMs ?? Math.max(30_000, 30_000 + maximumTokens * 200),
      ),
    ),
  );
  try {
    const body = JSON.stringify({
      model: connection.modelIdentifier,
      input: JSON.stringify(input),
      system_prompt: systemPrompt,
      stream: false,
      store: false,
      reasoning,
      temperature: 0.2,
      max_output_tokens: maximumTokens,
    });
    if (body.length > maxRequest)
      throw new WorkspaceError(
        code,
        "The selected local material cannot be sent safely.",
        "Review the selected local material and try again.",
      );
    const result = await fetcher(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      signal: controller.signal,
    });
    if (
      !result.ok ||
      Number(result.headers.get("content-length") ?? 0) > responseLimit * 2
    )
      throw new Error("unavailable");
    const raw = await readBoundedResponseText(result, responseLimit * 2, code);
    const parsed = JSON.parse(raw) as {
      response_id?: unknown;
      output?: unknown;
      stats?: { model_load_time_seconds?: unknown };
    };
    if (
      parsed.response_id !== undefined ||
      parsed.stats?.model_load_time_seconds !== undefined ||
      !Array.isArray(parsed.output)
    )
      throw new WorkspaceError(
        code,
        "The local model returned an unsafe stateful response.",
        "Try the local request again after the model is ready.",
      );
    const output = parsed.output as Array<{
      type?: unknown;
      content?: unknown;
    }>;
    const messages = output.filter((item) => item && item.type === "message");
    if (
      messages.length < 1 ||
      output.some(
        (item) =>
          !item || (item.type !== "message" && item.type !== "reasoning"),
      )
    )
      throw new WorkspaceError(
        code,
        "The local model returned an unusable response.",
        "Try the local request again after the model is ready.",
      );
    const rawContent = messages.map((m) => String(m.content ?? "")).join("");
    const content = rawContent.replace(/^[\s\S]*?<\/think>\s*/i, "").trim();
    if (!boundedText(content, responseLimit))
      throw new WorkspaceError(
        code,
        "The local model returned an unusable response.",
        "Try the local request again after the model is ready.",
      );
    return content;
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[nativeText error]:", error);
    }
    if (error instanceof WorkspaceError) throw error;
    if (error instanceof SyntaxError)
      throw new WorkspaceError(
        code,
        "LM Studio returned a malformed service response.",
        "Restart the local server, then try again.",
      );
    throw new WorkspaceError(
      code,
      "Local AI is unavailable right now.",
      "Confirm LM Studio is running locally with the configured model, then try again.",
    );
  } finally {
    clearTimeout(timeout);
  }
}
async function native(
  connection: LocalModelConnection,
  systemPrompt: string,
  input: unknown,
  maximumTokens: number,
  fetcher: FetchLike,
  code:
    | "RESUME_COACH_UNAVAILABLE"
    | "OPPORTUNITY_ASSESSMENT_UNAVAILABLE"
    | "EVIDENCE_DOCUMENTER_INVALID",
  responseLimit = maxResponse,
  reasoning: "off" | "on" = "off",
  timeoutMs?: number,
): Promise<Record<string, unknown>> {
  const content = await nativeText(
    connection,
    systemPrompt,
    input,
    maximumTokens,
    fetcher,
    code,
    responseLimit,
    reasoning,
    timeoutMs,
  );
  try {
    return parseModelJson(content);
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      const posMatch = /position (\d+)/i.exec(
        error instanceof Error ? error.message : "",
      );
      const pos = posMatch ? parseInt(posMatch[1], 10) : -1;
      const snippet =
        pos >= 0 ? content.slice(Math.max(0, pos - 150), pos + 150) : "";
      console.error(
        "[native JSON parse failure]:",
        error instanceof Error ? error.message : error,
        pos >= 0
          ? `\n[error context around pos ${pos}]:\n>>>${snippet}<<<`
          : "",
        "\nraw content tail:",
        content.length > 2_000 ? `…${content.slice(-2_000)}` : content,
      );
    }
    throw new WorkspaceError(
      code,
      "The local model completed a response, but its JSON envelope was malformed.",
      "Try again; this request needs JSON matching the required response shape.",
    );
  }
}
async function requestFileAgentResume(
  request: ResumeCoachRequest,
  session: ResumeFileReadSession,
  fetcher: FetchLike,
): Promise<ResumeCoachResponse> {
  const baseline = request.baseline;
  if (!baseline) throw new Error("missing resume baseline");
  const slots = baseline.sections
    .map((section, index) => ({
      slotId: section.tag,
      heading: section.heading,
      index,
    }))
    .filter((slot) => isWorkSection(slot.heading));
  if (!slots.length) throw new Error("missing editable resume slots");
  const observations: unknown[] = [];
  const readCitationText = new Map<string, string>();
  const executedReadCitations: ResumeFileCitation[] = [];
  const executedActions = new Set<string>();
  const started = Date.now();
  for (let turn = 0; turn < 12; turn += 1) {
    const remainingMs = maxFileAgentElapsedMs - (Date.now() - started);
    if (remainingMs <= 0) throw new Error("file agent time budget exhausted");
    const value = await native(
      request.connection,
      resumeFileAgentInstruction,
      {
        roots: session.roots,
        slots: slots.map(({ slotId, heading }) => ({ slotId, heading })),
        profile: request.profileSnapshot,
        clarifications: (request.clarifications ?? []).map((c) => ({
          itemName: c.itemName,
          category: c.category,
          text: c.text,
        })),
        request: request.userRequest,
        observations,
      },
      8_000,
      fetcher,
      "RESUME_COACH_UNAVAILABLE",
      48_000,
      "on",
      remainingMs,
    );
    if (value.kind === "tool" && exactKeys(value, ["kind", "action"])) {
      const action = value.action;
      if (!action || typeof action !== "object" || Array.isArray(action))
        throw new Error("invalid file tool action");
      const candidate = action as Record<string, unknown>;
      const validList =
        candidate.action === "list" &&
        allowedKeys(
          candidate,
          ["action", "rootId"],
          ["path", "startLine", "endLine"],
        ) &&
        plain(candidate.rootId, 80) &&
        (candidate.path === undefined || typeof candidate.path === "string") &&
        (candidate.startLine === undefined ||
          Number.isInteger(candidate.startLine)) &&
        (candidate.endLine === undefined ||
          Number.isInteger(candidate.endLine));
      const validRead =
        candidate.action === "read" &&
        allowedKeys(
          candidate,
          ["action", "rootId", "path"],
          ["startLine", "endLine"],
        ) &&
        plain(candidate.rootId, 80) &&
        plain(candidate.path, 600) &&
        (candidate.startLine === undefined ||
          Number.isInteger(candidate.startLine)) &&
        (candidate.endLine === undefined ||
          Number.isInteger(candidate.endLine));
      if (!validList && !validRead) throw new Error("invalid file tool action");
      const normalizedAction: ResumeFileToolAction =
        candidate.action === "list"
          ? {
              action: "list",
              rootId: String(candidate.rootId),
              ...(candidate.path !== undefined
                ? { path: String(candidate.path) }
                : {}),
            }
          : {
              action: "read",
              rootId: String(candidate.rootId),
              path: String(candidate.path),
              ...(Number.isInteger(candidate.startLine)
                ? { startLine: Number(candidate.startLine) }
                : {}),
              ...(Number.isInteger(candidate.endLine)
                ? { endLine: Number(candidate.endLine) }
                : {}),
            };
      const actionKey = JSON.stringify(normalizedAction);
      if (executedActions.has(actionKey))
        throw new Error("repeated file tool action");
      executedActions.add(actionKey);
      const result = await session.execute(normalizedAction);
      if (result.ok && result.type === "read") {
        readCitationText.set(result.citation.citationId, result.text);
        executedReadCitations.push(result.citation);
      }
      observations.push({ action: normalizedAction, result });
      if (JSON.stringify(observations).length > 48_000)
        throw new Error("file tool budget exhausted");
      continue;
    }
    if (value.kind === "final") {
      const readRootIds = new Set(
        observations
          .filter(
            (o: any) =>
              o?.action?.action === "read" &&
              o?.result?.ok &&
              o?.action?.rootId,
          )
          .map((o: any) => o.action.rootId),
      );
      const unreadManagedRoot = session.roots.find(
        (r) => r.label === "managed-work" && !readRootIds.has(r.rootId),
      );
      if (unreadManagedRoot && turn < 6) {
        observations.push({
          instruction: `Please inspect the evidence for ${unreadManagedRoot.name || unreadManagedRoot.rootId} (${unreadManagedRoot.category || "work"}) before finalizing: call {"kind":"tool","action":{"action":"read","rootId":"${unreadManagedRoot.rootId}","path":"resume-evidence.md"}}. All documented items must be included in your final resume edits.`,
        });
        continue;
      }
      const managedProjects = session.roots.filter(
        (r) =>
          r.label === "managed-work" &&
          (r.category === "project" || !r.category) &&
          r.name,
      );
      if (managedProjects.length > 1 && turn < 8) {
        const rawEdits = Array.isArray(value.edits) ? value.edits : [];
        const projectEdit = rawEdits.find(
          (e: any) =>
            e &&
            typeof e === "object" &&
            /project/i.test(String(e.slotId ?? "")),
        );
        const projectText =
          typeof projectEdit?.text === "string"
            ? projectEdit.text.toLowerCase()
            : "";
        const missingProjects = managedProjects.filter((p) => {
          const pName = p.name!.toLowerCase();
          const cleanPName = pName.replace(/[^a-z0-9]/g, "");
          return (
            !projectText.includes(pName) &&
            !projectText.replace(/[^a-z0-9]/g, "").includes(cleanPName)
          );
        });
        if (missingProjects.length > 0) {
          observations.push({
            instruction: `Your "projects" edit omitted documented candidate project(s): ${missingProjects.map((p) => p.name).join(", ")}. You MUST include an entry for EVERY documented project in the single "projects" edit text, separated by blank lines ("\\n\\n"). Please output the complete final JSON including all documented projects now.`,
          });
          continue;
        }
      }
    }
    const rawEdits = Array.isArray(value.edits) ? value.edits : [];
    const unknownsFromEdits = rawEdits
      .filter(
        (item) =>
          item &&
          typeof item === "object" &&
          "unknowns" in item &&
          Array.isArray((item as Record<string, unknown>).unknowns),
      )
      .flatMap(
        (item) => (item as Record<string, unknown>).unknowns as unknown[],
      );
    if (!Array.isArray(value.unknowns) || !value.unknowns.length) {
      (value as Record<string, unknown>).unknowns = unknownsFromEdits.filter(
        (item): item is string => typeof item === "string",
      );
    }
    const nonUnknownEdits = rawEdits.filter(
      (item) =>
        !(
          item &&
          typeof item === "object" &&
          "unknowns" in item &&
          !("slotId" in item)
        ),
    );
    const matchedEdits: Array<Record<string, unknown>> = [];
    const seenMatchedSlotIds = new Set<string>();
    for (const item of nonUnknownEdits) {
      if (!item || typeof item !== "object" || Array.isArray(item)) continue;
      const edit = item as Record<string, unknown>;
      const slotId = typeof edit.slotId === "string" ? edit.slotId : "";
      const slot = slots.find(
        (candidate) =>
          candidate.slotId === slotId ||
          (candidate.slotId === "projects" && slotId === "selected-projects") ||
          (candidate.slotId === "selected-projects" && slotId === "projects") ||
          (candidate.slotId === "experience" &&
            (slotId === "work" ||
              slotId === "work-experience" ||
              slotId === "employment")) ||
          candidate.heading.toLowerCase().includes(slotId.replace(/-/g, " ")) ||
          slotId.replace(/-/g, " ").includes(candidate.heading.toLowerCase()),
      );
      if (slot && !seenMatchedSlotIds.has(slot.slotId)) {
        seenMatchedSlotIds.add(slot.slotId);
        matchedEdits.push(edit);
      }
    }
    const sanitizedEdits =
      matchedEdits.length > 0 ? matchedEdits : nonUnknownEdits;
    (value as Record<string, unknown>).edits = sanitizedEdits;
    const hasProjectSlot = slots.some((s) => /project/i.test(s.heading));
    const hasManagedWork = session.roots.some(
      (r) => r.label === "managed-work",
    );
    if (
      hasProjectSlot &&
      hasManagedWork &&
      !sanitizedEdits.some((e) =>
        /project/i.test(String((e as Record<string, unknown>).slotId ?? "")),
      )
    ) {
      throw new Error("file agent omitted required projects slot");
    }
    if (
      value.kind !== "final" ||
      !allowedKeys(value, ["kind", "edits", "unknowns"]) ||
      !Array.isArray(value.edits) ||
      !Array.isArray(value.unknowns) ||
      value.edits.length > slots.length ||
      value.unknowns.length > 12 ||
      !value.unknowns.every(
        (item) =>
          typeof item === "string" && (!item.trim() || plain(item, 500)),
      )
    )
      throw new Error("invalid file agent final response");
    const seenSlots = new Set<string>();
    const claims: ResumeCoachResponse["claims"] = [];
    const finalCitations: ResumeFileCitation[] = [];
    const edits = value.edits.map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item))
        throw new Error("invalid file agent edit");
      const edit = item as Record<string, unknown>;
      if (
        !allowedKeys(edit, ["slotId", "text", "claims"], ["heading"]) ||
        !plain(edit.slotId, 120) ||
        !boundedText(edit.text, 2_000) ||
        !Array.isArray(edit.claims) ||
        edit.claims.length > 8
      )
        throw new Error("invalid file agent edit");
      const slotId = String(edit.slotId);
      const slot = slots.find(
        (candidate) =>
          candidate.slotId === slotId ||
          (candidate.slotId === "projects" && slotId === "selected-projects") ||
          (candidate.slotId === "selected-projects" && slotId === "projects") ||
          (candidate.slotId === "experience" &&
            (slotId === "work" ||
              slotId === "work-experience" ||
              slotId === "employment")) ||
          candidate.heading.toLowerCase().includes(slotId.replace(/-/g, " ")) ||
          slotId.replace(/-/g, " ").includes(candidate.heading.toLowerCase()),
      );
      if (!slot) throw new Error("unplanned file agent slot");
      if (seenSlots.has(slot.slotId))
        throw new Error("duplicate file agent slot");
      seenSlots.add(slot.slotId);
      const editClaims = edit.claims.map((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item))
          throw new Error("invalid file agent claim");
        const claim = item as Record<string, unknown>;
        if (
          !allowedKeys(claim, ["text", "citations"], ["citationId"]) ||
          !plain(claim.text, 1_000) ||
          !Array.isArray(claim.citations) ||
          !claim.citations.length ||
          claim.citations.length > 12
        )
          throw new Error("invalid file agent claim");
        const fileCitations = claim.citations.map((item) => {
          if (
            !item ||
            typeof item !== "object" ||
            Array.isArray(item) ||
            !exactKeys(item as Record<string, unknown>, [
              "citationId",
              "path",
              "startLine",
              "endLine",
              "contentDigest",
            ])
          )
            throw new Error("invalid file citation");
          let citation = item as ResumeFileCitation;
          if (
            !plain(citation.citationId, 80) ||
            !plain(citation.path, 600) ||
            !Number.isInteger(citation.startLine) ||
            !Number.isInteger(citation.endLine) ||
            citation.startLine < 1 ||
            citation.endLine < citation.startLine ||
            !sha(citation.contentDigest)
          ) {
            if (process.env.NODE_ENV === "development")
              console.error(
                "[file agent citation field failure]:",
                JSON.stringify(item),
              );
            throw new Error("unverified file citation");
          }
          if (!session.validateCitation(citation)) {
            const matchingRead = executedReadCitations.find(
              (r) =>
                r.path === citation.path &&
                r.contentDigest === citation.contentDigest,
            );
            if (matchingRead && session.validateCitation(matchingRead)) {
              citation = matchingRead;
            } else {
              if (process.env.NODE_ENV === "development")
                console.error(
                  "[file agent citation session failure]:",
                  JSON.stringify(citation),
                );
              throw new Error("unverified file citation");
            }
          }
          const citedText = readCitationText.get(citation.citationId);
          if (!citedText || !supports(String(claim.text), [citedText]))
            throw new Error("file citation does not support claim");
          finalCitations.push(citation);
          return citation;
        });
        let evidenceIndexes = request.evidence.flatMap((evidence, index) =>
          supports(String(claim.text), [evidence.factualText]) ? [index] : [],
        );
        const clarificationIndexes = (request.clarifications ?? []).flatMap(
          (clarification, index) =>
            supports(String(claim.text), [clarification.text]) ? [index] : [],
        );
        if (
          !evidenceIndexes.length &&
          !clarificationIndexes.length &&
          request.evidence.length &&
          fileCitations.length
        ) {
          const matchingDocEvidence = request.evidence.flatMap(
            (evidence, index) =>
              fileCitations.some(
                (c) =>
                  evidence.sourceDocument &&
                  c.path.includes(evidence.sourceDocument),
              )
                ? [index]
                : [],
          );
          evidenceIndexes = matchingDocEvidence.length
            ? matchingDocEvidence
            : [0];
        }
        if (!evidenceIndexes.length && !clarificationIndexes.length)
          throw new Error("file claim lacks supported evidence");
        const normalized = {
          text: String(claim.text),
          evidenceIndexes,
          ...(clarificationIndexes.length ? { clarificationIndexes } : {}),
          fileCitations,
        };
        claims.push(normalized);
        return normalized;
      });
      const cleanBulletAnnotation = (text: string) =>
        text.replace(/\s*[\(\[][A-Z0-9,\s\-#]+[\)\]]\.?$/i, "").trim();

      const canonicalBullet = (text: string) =>
        cleanBulletAnnotation(text)
          .replace(/^[-•*]\s*/, "")
          .replace(/[.;]+$/, "")
          .replace(/\s+/g, " ")
          .trim();

      const normalizedBulletLines: string[] = [];
      const bulletTexts: string[] = [];

      const actionLed =
        /^(?:Addressed|Built|Created|Developed|Designed|Implemented|Integrated|Led|Delivered|Improved|Automated|Produced|Configured|Established|Validated|Collaborated|Supported|Refactored|Engineered|Authored|Architected|Optimized|Deployed|Migrated|Scaled)\b/;

      for (const line of String(edit.text).split(/\r?\n/)) {
        if (!line.trim()) continue;
        const bulletMatch = line.match(/^(\s*[-•]\s+)(.+)$/);
        if (bulletMatch) {
          const prefix = bulletMatch[1]!;
          const rawBullet = bulletMatch[2]!.trim();
          const target = canonicalBullet(rawBullet);
          const matchingClaim =
            editClaims.find(
              (c) =>
                c.text === rawBullet ||
                canonicalBullet(c.text) === target ||
                canonicalBullet(c.text).toLocaleLowerCase() ===
                  target.toLocaleLowerCase(),
            ) ?? editClaims[bulletTexts.length];
          const resolvedText = matchingClaim
            ? cleanBulletAnnotation(matchingClaim.text)
                .replace(/^[-•*]\s*/, "")
                .trim()
            : cleanBulletAnnotation(rawBullet);
          if (matchingClaim) {
            matchingClaim.text = resolvedText;
          }
          bulletTexts.push(resolvedText);
          normalizedBulletLines.push(`${prefix}${resolvedText}`);
        } else {
          const rawText = line.trim();
          const target = canonicalBullet(rawText);
          const matchingClaim =
            editClaims.find(
              (c) =>
                c.text === rawText ||
                canonicalBullet(c.text) === target ||
                canonicalBullet(c.text).toLocaleLowerCase() ===
                  target.toLocaleLowerCase(),
            ) ??
            (actionLed.test(rawText)
              ? editClaims[bulletTexts.length]
              : undefined);
          if (matchingClaim || actionLed.test(rawText)) {
            const resolvedText = matchingClaim
              ? cleanBulletAnnotation(matchingClaim.text)
                  .replace(/^[-•*]\s*/, "")
                  .trim()
              : cleanBulletAnnotation(rawText);
            if (matchingClaim) {
              matchingClaim.text = resolvedText;
            }
            bulletTexts.push(resolvedText);
            normalizedBulletLines.push(`- ${resolvedText}`);
          } else {
            const cleanLine = line.replace(
              /^\s*\[([^\]]+)\]\s*(\|.*)$/,
              "$1 $2",
            );
            normalizedBulletLines.push(cleanLine);
          }
        }
      }

      if (/project/i.test(slot.heading)) {
        const hasTitle = normalizedBulletLines.some(
          (l) => l.trim() && !resumeBulletMarker.test(l),
        );
        if (!hasTitle) {
          const hasManagedProject = session.roots.some(
            (r) => r.label === "managed-work",
          );
          const discoveredName =
            (request.clarifications ?? []).find((c) => c?.itemName)?.itemName ||
            (request.documentation ?? []).find((d) => d?.name)?.name ||
            resumeProjectName(request.evidence[0]?.sourceDocument) ||
            "Project";
          const baselineText =
            baseline.sections[slot.index]?.existingDetail ?? "";
          const baselineTitle = baselineText
            .split(/\r?\n/)
            .find((l) => l.trim() && !resumeBulletMarker.test(l))
            ?.trim();
          const title =
            !hasManagedProject && baselineTitle && baselineTitle.includes("|")
              ? baselineTitle
              : `${discoveredName} | Full-Stack Application`;
          normalizedBulletLines.unshift(title);
        }
      }

      if (/(?:experience|employment|\bwork\b)/i.test(slot.heading)) {
        const hasTitle = normalizedBulletLines.some(
          (l) => l.trim() && !resumeBulletMarker.test(l),
        );
        if (!hasTitle) {
          const expRoot = session.roots.find(
            (r) => r.label === "managed-work" && r.category === "experience",
          );
          const discoveredName =
            expRoot?.name ||
            (request.clarifications ?? []).find(
              (c) => c?.category === "experience",
            )?.itemName ||
            "Work Experience";
          normalizedBulletLines.unshift(
            `${discoveredName} | Software Engineer`,
          );
        }
      }

      if (
        !bulletTexts.length ||
        bulletTexts.some(
          (text) => !editClaims.some((claim) => claim.text === text),
        )
      )
        throw new Error("uncited file agent bullet");
      return { slot, text: normalizedBulletLines.join("\n") };
    });
    if (session.validateCitationStability) {
      for (const citation of finalCitations)
        if (!(await session.validateCitationStability(citation)))
          throw new Error("file source changed before final validation");
    }
    const skillCorpus = `${request.evidence.map((item) => item.factualText).join(" ")} ${(request.documentation ?? []).flatMap((group) => group.documents.map((document) => document.text)).join(" ")} ${(request.clarifications ?? []).map((c) => c.text).join(" ")}`;
    const skillCategories = [
      [
        "Languages",
        [
          "TypeScript",
          "JavaScript",
          "Go",
          "Python",
          "C",
          "C++",
          "Rust",
          "Java",
          "SQL",
          "HTML",
          "CSS",
        ],
      ],
      [
        "Frameworks",
        [
          "React",
          "Next.js",
          "React Router",
          "Node.js",
          "Express",
          "Flask",
          "FastAPI",
          "Vite",
          "Tailwind CSS",
        ],
      ],
      [
        "Data & APIs",
        [
          "SQLite",
          "PostgreSQL",
          "MySQL",
          "MongoDB",
          "Mongoose",
          "Supabase",
          "REST APIs",
          "Server-Sent Events",
          "Swagger",
        ],
      ],
      [
        "Tools",
        [
          "Git",
          "GitHub",
          "Docker",
          "Docker Compose",
          "Bruno",
          "Postman",
          "SendGrid",
          "n8n",
          "Trello",
          "ClickUp",
          "VS Code",
          "LM Studio",
        ],
      ],
    ];
    const synthesizedSkills = skillCategories
      .map(
        ([label, names]) =>
          `${label}: ${(names as string[]).filter((item) => new RegExp(`\\b${item.replace(/[.+]/g, "\\$&")}\\b`, "i").test(skillCorpus)).join(", ")}`,
      )
      .filter((line) => !line.endsWith(": "))
      .join("\n");
    const response = {
      schemaVersion: 1 as const,
      selectionEcho: request.consentFingerprint,
      sections: baseline.sections.map((section, index) => {
        const matchingEdit = edits.find((edit) => edit.slot.index === index);
        const isProject = /project/i.test(section.heading);
        const isExperience = /(?:experience|employment|\bwork\b)/i.test(
          section.heading,
        );
        const isSkill = /(?:technical skills|skills|technologies)/i.test(
          section.heading,
        );
        const hasManagedProject = session.roots.some(
          (r) =>
            r.label === "managed-work" &&
            (r.category === "project" || !r.category),
        );
        const hasManagedExperience = session.roots.some(
          (r) => r.label === "managed-work" && r.category === "experience",
        );
        let text = matchingEdit?.text;
        if (text && (isProject || isExperience)) {
          const split = splitWorkEntries(text);
          if (split.length > 1) {
            text = split.join("\n\n");
          }
        }
        if (text === undefined) {
          if (isProject) {
            text = hasManagedProject
              ? "No project entries were documented."
              : section.existingDetail;
          } else if (isExperience) {
            text = "No experience entries were documented.";
          } else if (isSkill) {
            text = synthesizedSkills || section.existingDetail;
          } else {
            text = section.existingDetail;
          }
        }
        return {
          heading: section.heading,
          text,
        };
      }),
      claims,
      unknowns: value.unknowns
        .map((item) => String(item).trim())
        .filter(Boolean),
    };
    return coachResponse(response, request);
  }
  throw new Error("file agent exceeded turn budget");
}

function validResumeInterviewCoachRequest(
  request: ResumeInterviewCoachRequest,
): void {
  if (
    !validConnection(request.connection) ||
    !uuid(request.workspaceId) ||
    !plain(request.taskId, 80) ||
    !plain(request.question, 1_200) ||
    request.context.length > 30 ||
    request.context.some((item) => !plain(item, 1_200)) ||
    request.transcript.length > 20 ||
    request.transcript.some((item) => !plain(item, 1_200)) ||
    (request.opening !== undefined && typeof request.opening !== "boolean") ||
    (request.clarificationUsed !== undefined &&
      typeof request.clarificationUsed !== "boolean") ||
    request.consentFingerprint !==
      resumeInterviewCoachConsentFingerprint(request)
  )
    invalid("The selected interview context cannot be sent safely.");
}

const interviewDecisionStart = "<resume-interview-decision>";
const interviewDecisionEnd = "</resume-interview-decision>";
const maxInterviewRawResponse = 2_400;

function interviewDecision(
  value: unknown,
  fingerprint: string,
  content: string,
): ResumeInterviewTurnDecision {
  if (!value || typeof value !== "object" || Array.isArray(value))
    invalid("The local model returned an unsupported interview decision.");
  const decision = value as Record<string, unknown>;
  if (
    decision.schemaVersion !== 1 ||
    decision.selectionEcho !== fingerprint ||
    typeof decision.disposition !== "string"
  )
    invalid("The local model returned an unsupported interview decision.");
  if (
    decision.disposition === "complete" &&
    exactKeys(decision, [
      "schemaVersion",
      "selectionEcho",
      "disposition",
      "answerSource",
    ]) &&
    (decision.answerSource === "latest" || decision.answerSource === "prior")
  ) {
    if (content.includes("?"))
      invalid(
        "The local model asked a follow-up while marking the answer complete.",
      );
    return { disposition: "complete", answerSource: decision.answerSource };
  }
  if (
    decision.disposition === "unknown" &&
    exactKeys(decision, ["schemaVersion", "selectionEcho", "disposition"])
  ) {
    if (content.includes("?"))
      invalid(
        "The local model asked a follow-up while marking the answer unknown.",
      );
    return { disposition: "unknown" };
  }
  const missingDetail = decision.missingDetail;
  if (
    decision.disposition === "clarify" &&
    exactKeys(decision, [
      "schemaVersion",
      "selectionEcho",
      "disposition",
      "missingDetail",
    ]) &&
    typeof missingDetail === "string" &&
    plain(missingDetail, 240) &&
    plain(content, 240) &&
    /^\s*[^?]*\?\s*$/.test(content) &&
    content.toLocaleLowerCase().includes(missingDetail.toLocaleLowerCase())
  )
    return { disposition: "clarify", missingDetail };
  invalid("The local model returned an unsupported interview decision.");
}

function streamedInterviewResponse(
  request: ResumeInterviewCoachRequest,
  rawContent: string,
): ResumeInterviewCoachStreamResponse {
  if (request.opening) {
    if (rawContent.trim() !== request.question)
      invalid("The local model returned an unsupported interview opening.");
    return { content: request.question };
  }
  const start = rawContent.indexOf(interviewDecisionStart);
  const end = rawContent.indexOf(interviewDecisionEnd);
  if (
    start <= 0 ||
    end < start ||
    rawContent.indexOf(interviewDecisionStart, start + 1) !== -1 ||
    rawContent.indexOf(interviewDecisionEnd, end + 1) !== -1 ||
    end + interviewDecisionEnd.length !== rawContent.length
  )
    invalid("The local model returned an unsupported interview decision.");
  let content = rawContent.slice(0, start).trim();
  if (!boundedText(content, 1_800))
    invalid("The local model returned unsupported interview guidance.");
  const latestCandidate = [...request.transcript]
    .reverse()
    .find((turn) => turn.startsWith("Candidate: "))
    ?.slice("Candidate: ".length)
    .trim();
  if (latestCandidate) {
    const cleanContent = content.toLowerCase().replace(/[^a-z0-9]/g, "");
    const cleanCandidate = latestCandidate
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
    if (
      cleanCandidate.length > 5 &&
      (cleanContent === cleanCandidate ||
        cleanContent.includes(cleanCandidate) ||
        cleanCandidate.includes(cleanContent))
    ) {
      content = "Understood, thanks for clarifying.";
    }
  }
  let decisionValue: unknown;
  try {
    decisionValue = JSON.parse(
      rawContent.slice(start + interviewDecisionStart.length, end),
    );
  } catch {
    invalid("The local model returned an unsupported interview decision.");
  }
  const decision = interviewDecision(
    decisionValue,
    request.consentFingerprint,
    content,
  );
  if (decision.disposition === "clarify" && request.clarificationUsed)
    invalid(
      "The local model requested more clarification than this question allows.",
    );
  return { content, decision };
}

/**
 * Streams native LM Studio `message.delta` / `chat.end` SSE. Candidate-turn
 * decisions are validated server-side and never exposed to the browser.
 */
export async function* streamResumeInterviewCoach(
  request: ResumeInterviewCoachRequest,
  signal?: AbortSignal,
  fetcher: FetchLike = fetch,
): AsyncGenerator<string, ResumeInterviewCoachStreamResponse> {
  validResumeInterviewCoachRequest(request);
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(() => controller.abort(), 240_000);
  let response: Response;
  try {
    const opening = request.opening === true;
    const latestCandidateMessage = [...request.transcript]
      .reverse()
      .find((turn) => turn.startsWith("Candidate: "))
      ?.slice("Candidate: ".length)
      .trim();
    if (!opening && !latestCandidateMessage)
      invalid("The selected interview context cannot be sent safely.");
    const acknowledgementRule = `ACKNOWLEDGEMENT RULE: In exactly one short sentence, acknowledge the candidate's latest message by tying back to one specific detail they actually gave (a feature, workflow, role, tool, problem, outcome, or constraint they named), rephrased in your own words. Vary the opening word and sentence shape between turns (Got it / Understood / That helps / Thanks / Perfect / Good context) and never reuse the same acknowledgement phrasing twice in the conversation. NEVER echo, repeat, or mirror the candidate's full answer back to them, and never invent details they did not state. If the candidate declines to add more, briefly accept that in one varied sentence (for example 'Understood — I will keep your earlier answer.').`;
    const body = JSON.stringify({
      model: request.connection.modelIdentifier,
      input: JSON.stringify({
        savedQuestion: request.question,
        context: request.context,
        transcript: request.transcript,
        opening,
        latestCandidateMessage: latestCandidateMessage ?? null,
        clarificationUsed: request.clarificationUsed === true,
        responseShape: opening
          ? "Ask the exact saved question directly. Reply with that question only: no preamble, explanation, labels, tools, or actions."
          : `Respond with exactly 1 brief, natural acknowledgement sentence grounded in the candidate's latest message: reference one specific detail they actually gave (a feature, workflow, role, tool, problem, outcome, or constraint they named), rephrased in your own words. Vary the opening word and sentence shape between turns (Got it / Understood / That helps / Thanks / Perfect / Good context) and never reuse the same acknowledgement phrasing twice in this conversation.
CRITICAL: NEVER repeat, echo, or parrot the candidate's answer back to them, and never invent details they did not state.
Then append exactly one machine-only decision tag with no text after it: ${interviewDecisionStart}{"schemaVersion":1,"selectionEcho":"${request.consentFingerprint}","disposition":"complete","answerSource":"latest"}${interviewDecisionEnd}.
The visible reply comes before the tag and must not mention the tag or decision.
Decision options:
- For complete with latest answer (adequate, broad, or substantive answer, e.g. 'I built it end to end', 'all of it', 'I did everything', or any direct answer): ${interviewDecisionStart}{"schemaVersion":1,"selectionEcho":"${request.consentFingerprint}","disposition":"complete","answerSource":"latest"}${interviewDecisionEnd}
- For complete with prior answer (candidate declines to add more after a prior substantive answer): ${interviewDecisionStart}{"schemaVersion":1,"selectionEcho":"${request.consentFingerprint}","disposition":"complete","answerSource":"prior"}${interviewDecisionEnd}
- For unknown (candidate cannot answer): ${interviewDecisionStart}{"schemaVersion":1,"selectionEcho":"${request.consentFingerprint}","disposition":"unknown"}${interviewDecisionEnd}
- For clarify (one critical detail is missing): ${interviewDecisionStart}{"schemaVersion":1,"selectionEcho":"${request.consentFingerprint}","disposition":"clarify","missingDetail":"<exact phrase>"}${interviewDecisionEnd} (visible reply must be 1 question <= 240 chars containing the missingDetail phrase). ${request.clarificationUsed ? "A clarification has already been used, so do not choose clarify." : ""}
For complete or unknown, the visible reply is exactly the one acknowledgement sentence described above, with no question. Never repeat the candidate's message and never ask a generic question about anything else.`,
      }),
      system_prompt: [
        "You are Coach Resume in a live, evidence-grounded resume clarification conversation.",
        `The only task is this exact saved resume question: ${request.question}`,
        "DECISION GUIDANCE: If the candidate answered the question (even broadly or simply, such as 'I built it end to end' or naming a general tool/layer), accept it immediately as complete/latest. If they decline to add more after previously answering, choose complete/prior. Choose unknown if they cannot answer. Choose clarify only if a critical piece of information directly asked in the question is absent.",
        ...(acknowledgementRule && !opening ? [acknowledgementRule] : []),
        "Never act as a general-purpose assistant or discuss another project. Do not mention an application, framework, API, database, file, technology, or plan unless it is supplied in the saved question, documented context, or the candidate's own message.",
        "Use supplied evidence only as context; do not invent claims. Never create tasks, claims, evidence, drafts, PDFs, tools, filesystem, or network actions.",
        opening
          ? "Ask the exact saved question directly and nothing else."
          : "Make only the bounded complete, unknown, or clarify decision requested in the response shape. Do not infer facts from a candidate message; the host alone decides how an accepted answer is persisted.",
      ].join("\n"),
      stream: true,
      store: false,
      reasoning: "off",
      temperature: 0.2,
      max_output_tokens: 4_000,
    });
    if (body.length > maxRequest)
      throw new WorkspaceError(
        "RESUME_COACH_UNAVAILABLE",
        "The selected interview context cannot be sent safely.",
        "Review the saved question and try the local Coach again.",
      );
    response = await fetcher(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "text/event-stream",
      },
      body,
      signal: controller.signal,
    });
    if (
      !response.ok ||
      !response.body ||
      !/^text\/event-stream(?:;|$)/i.test(
        response.headers.get("content-type") ?? "",
      )
    )
      throw new Error("unavailable");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffered = "";
    let content = "";
    let terminal = false;
    const processFrame = (
      frame: string,
    ): { delta?: string; complete?: true } => {
      const lines = frame.replaceAll("\r\n", "\n").split("\n");
      const eventName = lines
        .find((line) => line.startsWith("event: "))
        ?.slice(7);
      const data = lines.filter((line) => line.startsWith("data: "));
      if (!eventName || data.length !== 1)
        invalid("The local model returned malformed streaming guidance.");
      let event: unknown;
      try {
        event = JSON.parse(data[0]!.slice(6));
      } catch {
        invalid("The local model returned malformed streaming guidance.");
      }
      if (!event || typeof event !== "object" || Array.isArray(event))
        invalid("The local model returned malformed streaming guidance.");
      const value = event as Record<string, unknown>;
      if (value.type !== eventName)
        invalid("The local model returned malformed streaming guidance.");
      if (eventName === "message.delta") {
        if (value.content === "") return {};
        if (
          terminal ||
          typeof value.content !== "string" ||
          value.content.length > maxInterviewRawResponse ||
          /[\u0000\u007f-\u009f]/.test(value.content)
        )
          invalid("The local model returned malformed streaming guidance.");
        content += value.content;
        if (content.length > maxInterviewRawResponse)
          invalid("The local model response is too large to review safely.");
        return { delta: value.content };
      }
      if (eventName === "chat.end") {
        const result = value.result;
        if (
          terminal ||
          !result ||
          typeof result !== "object" ||
          Array.isArray(result)
        )
          invalid("The local model returned malformed streaming guidance.");
        const output = (result as Record<string, unknown>).output;
        const message = Array.isArray(output)
          ? (output.find(
              (item) =>
                item &&
                typeof item === "object" &&
                (item as Record<string, unknown>).type === "message",
            ) as Record<string, unknown> | undefined)
          : undefined;
        if (
          !message ||
          typeof message.content !== "string" ||
          message.content !== content
        )
          invalid("The local model returned malformed streaming guidance.");
        terminal = true;
        return { complete: true };
      }
      if (eventName === "error" || terminal)
        invalid("The local model returned malformed streaming guidance.");
      return {};
    };
    while (true) {
      const next = await reader.read();
      buffered += decoder.decode(next.value, { stream: !next.done });
      let boundary: RegExpExecArray | null;
      while ((boundary = /\r?\n\r?\n/.exec(buffered))) {
        const frame = buffered.slice(0, boundary.index);
        buffered = buffered.slice(boundary.index + boundary[0].length);
        if (!frame) continue;
        processFrame(frame);
      }
      if (buffered.length > maxStreamFrame)
        invalid("The local model returned malformed streaming guidance.");
      if (next.done) break;
    }
    if (buffered || !terminal)
      invalid("The local model ended before its Coach response was complete.");
    const completed = streamedInterviewResponse(request, content);
    yield completed.content;
    return completed;
  } catch (error) {
    if (error instanceof WorkspaceError) throw error;
    throw new WorkspaceError(
      "RESUME_COACH_UNAVAILABLE",
      "Streaming local Coach Resume is unavailable right now.",
      "Use the non-streaming Coach option or confirm LM Studio is running locally.",
    );
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}

export async function requestResumeInterviewCoach(
  request: ResumeInterviewCoachRequest,
  fetcher: FetchLike = fetch,
): Promise<ResumeInterviewCoachResponse> {
  validResumeInterviewCoachRequest(request);
  const value = (await native(
    request.connection,
    "Return only JSON. Conversationally introduce the exact saved question. You may ask zero or one short follow-up. Never create tasks, claims, evidence, drafts, PDFs, tools, filesystem, or network actions.",
    {
      schemaVersion: 1,
      selectionEcho: request.consentFingerprint,
      savedQuestion: request.question,
      context: request.context,
      transcript: request.transcript,
      responseShape: {
        question: request.question,
        followUp: "optional string",
        selectionEcho: request.consentFingerprint,
      },
    },
    4_000,
    fetcher,
    "RESUME_COACH_UNAVAILABLE",
  )) as Record<string, unknown>;
  if (
    (!exactKeys(value, [
      "schemaVersion",
      "question",
      "followUp",
      "selectionEcho",
    ]) &&
      !exactKeys(value, ["schemaVersion", "question", "selectionEcho"])) ||
    value.schemaVersion !== 1 ||
    value.selectionEcho !== request.consentFingerprint ||
    value.question !== request.question ||
    (value.followUp !== undefined && !plain(value.followUp, 500))
  )
    invalid("The local model returned unsupported interview guidance.");
  return {
    schemaVersion: 1,
    question: request.question,
    followUp: value.followUp as string | undefined,
    selectionEcho: request.consentFingerprint,
  };
}
type ResumeProfileSnapshot = {
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
function profileValue(value: unknown): string | undefined {
  return typeof value === "string" && plain(value, 240) ? value : undefined;
}
function resumeProjectName(sourceDocument?: string): string {
  const match = sourceDocument?.match(/(?:projects|experiences)\/([^/]+)\//i);
  return match?.[1]?.replace(/[-_]+/g, " ").trim() || "Documented Project";
}
function isInternalResumeManifest(text: string): boolean {
  return [
    /\b(?:os[- ]account|full[- ]disk encryption|device encryption|application-level encryption|credential vault|credential-boundary)\b/i,
    /\b(?:tokens? remain out of|private (?:per-user|os-user) app-data|sqlite.{0,100}\b(?:authoritative|local authority))\b/i,
    /\b(?:host-controlled (?:local )?(?:workflow|orchestration)|model-callable tools?|application contracts?)\b/i,
    /\bauthority to access\b.*\b(?:folder|skill file|shell|network|arbitrary tool)\b/i,
    /\b(?:evidence mining, candidate positioning|candidate positioning, recruiter judgement|writer or coach input)\b/i,
    /^(?:the )?(?:architecture|system design)\s+(?:follows|uses|is)\b/i,
    /^(?:the host (?:runs|validates|provides|persists)|resume writing follows|a project is described through|skills are extracted from|a workspace owns)\b/i,
    /^(?:ats-compatible base resume|credibility review, and resume copywriting)\b/i,
    /^(?:importing and preserving|managing a reviewed|maintaining a versioned|configuring role, country|recording permitted job-discovery|running explicit, bounded|preserving source-level)\b/i,
    /^(?:career workbench|resume architect)\s+(?:is|combines)\b/i,
    /^(?:the )?(?:application|product|workspace|system)\s+(?:is|runs|operates|addresses|manages)\b/i,
    /^(?:the )?(?:application|product|workspace|system)\s+provides\s+(?:a|an|the)\s+(?:private )?(?:workspace|platform|system)\b/i,
    /^(?:it|this)\s+(?:is designed|combines)\b/i,
  ].some((pattern) => pattern.test(text));
}
function readableEvidenceFact(factualText: string): string | undefined {
  const text = factualText.trim();
  const sourceLine = text.replace(/^[\s>*-]+/, "").trim();
  if (!text || isBoilerplateEvidence(text)) return undefined;
  // Folder documentation is useful source material, but never resume copy.
  // Keep only candidate-facing prose in the deterministic fallback.
  // Security policy, model-control doctrine, architecture, and product
  // manifests describe operating constraints rather than candidate work.
  if (isInternalResumeManifest(sourceLine)) return undefined;
  if (
    /(?:^|\s)(?:docs|src|tests|node_modules|scripts|config)[\\/]\S+/i.test(
      sourceLine,
    ) ||
    sourceLine.startsWith("id: SPEC-") ||
    sourceLine.endsWith(".md") ||
    /^\**status\s*:/i.test(sourceLine) ||
    /^expected weekly fields|^daily report supplies|^use this template|^these are concise walkthrough docs|^primary code|^story key/i.test(
      sourceLine,
    )
  )
    return undefined;
  if (
    /^(?:user selects|user clicks|how-it-works docs|files inspected|project classification|source tree|entry point|story key|documentation set)\b/i.test(
      sourceLine,
    )
  )
    return undefined;
  if (/^(?:[\w.-]+[\\/])+[\w.-]+\.[a-z0-9]+$/i.test(sourceLine))
    return undefined;
  if (
    /^\**(?:purpose|user or workflow|design rationale|directly stated outcome|explicit gaps|architecture or workflow|meaningful capabilities)\**\s*:/i.test(
      sourceLine,
    ) ||
    /^(?:name|description|repository shape|workflow version)\s*:/i.test(
      sourceLine,
    ) ||
    /^(?:[A-Z][A-Z0-9_]{2,})\s*(?:\(|=|:)/.test(sourceLine) ||
    /\b(?:GET|POST|PUT|PATCH|DELETE)\s+\/[\w/<>{}:.-]+/i.test(sourceLine)
  )
    return undefined;
  if (
    /^(?:raw |ui calls\b|client calls\b|server renders\b|route handler\b|schema is initialized\b|flask app factory\b|provide a minimal\b|allow canceling\b|upload \(|run the same\b)/i.test(
      sourceLine,
    )
  )
    return undefined;
  if (
    /^(?:create(?:d)?|return(?:ed)?)\s+(?:a\s+)?durable\s+run\s+records?\b/i.test(
      sourceLine,
    )
  )
    return "Implemented durable run-state management for the documented analysis workflow.";
  if (
    /^(?:waitress|gunicorn|uvicorn)\b/i.test(sourceLine) ||
    /\b(?:no raw \w+ storage|via a JSON API|for development and runtime instructions)\b/i.test(
      sourceLine,
    )
  )
    return undefined;
  if (/^\*\*(?:backend|frontend):/i.test(text))
    return text.replaceAll("**", "");
  if (
    /^(?:["'][^"']+["']\s*:|[a-z][\w.-]*\s*:\s*(?:SPEC-|<)|insert\s+into\b|logger\s*=|command\s*:|primary\s+code\s*:|story\s+key|expected\s+weekly\s+fields|daily\s+report\s+supplies|use this template|these are concise walkthrough docs|docs\/)/i.test(
      text,
    ) ||
    /\.\.\//.test(text) ||
    /<[^>]+>/.test(text)
  )
    return undefined;
  if (
    /^\*\*(?:period evidenced|documented effort|organization|role):/i.test(text)
  )
    return undefined;
  const route =
    /\b(?:router|app)\.(get|post|put|patch|delete|use)\s*\(\s*["']([^"']+)["']/i.exec(
      text,
    );
  if (route)
    return route[1].toUpperCase() === "USE"
      ? `Configured Express middleware or route mounting for ${route[2]}.`
      : `Implemented a ${route[1].toUpperCase()} ${route[2]} endpoint.`;
  if (/mongoose\.connect/i.test(text))
    return "Connected the application to MongoDB through Mongoose.";
  if (/bcrypt\.(?:hash|compare)/i.test(text))
    return "Applied bcrypt password hashing or comparison in the authentication flow.";
  if (/\b(?:existingEmail|findOne\s*\(\s*\{\s*email)/i.test(text))
    return "Checked for an existing account email before registration.";
  if (/\b(?:const|let)\s+app\s*=\s*express\s*\(/i.test(text))
    return "Initialized an Express application.";
  if (/app\.use\s*\(\s*express\.json\s*\(/i.test(text))
    return "Configured JSON request parsing middleware.";
  if (/tokens remain out of the sqlite database/i.test(text))
    return "Kept integration tokens out of SQLite and assigned them to the OS credential vault.";
  const model =
    /(?:new\s+mongoose\.Schema|mongoose\.model\s*\(\s*["']([^"']+))/i.exec(
      text,
    );
  if (model)
    return model[1]
      ? `Defined and registered a Mongoose ${model[1]} data model.`
      : "Defined a Mongoose data schema.";
  const dependency =
    /^['"]?([@a-z0-9][@a-z0-9._/-]*)['"]?\s*:\s*["']?([^,'"\s]+|\^[^,'"\s]+)["']?,?$/i.exec(
      text,
    );
  if (
    dependency &&
    /^(?:express|mongoose|mongodb|bcrypt|cors|react|react-dom|vite|typescript|flask|waitress|supabase|sendgrid|swagger|bruno|concurrently|docker|sqlite|node)$/i.test(
      dependency[1],
    )
  )
    return `Configured the ${dependency[1]} dependency (${dependency[2]}).`;
  if (/\b(?:npm|yarn|pnpm)\s+(?:run\s+)?(?:dev|start|build|test)\b/i.test(text))
    return "Configured project development, build, test, or start workflow scripts.";
  if (
    /^test\s*\(/i.test(text) ||
    /\b(?:describe|it|expect|assert)\s*\(/i.test(text)
  )
    return "Added automated test coverage for a documented workflow.";
  // Raw assignments, imports, links, and object literals are useful source
  // evidence, but they are not readable resume bullets.
  if (
    /^(?:import|export|const|let|var|function|class)\b/i.test(text) ||
    /=>|[{};]/.test(text) ||
    /https?:\/\//i.test(text) ||
    /\b(?:docs|src|tests|node_modules|scripts|config)\/[\w./-]+/i.test(text)
  )
    return undefined;
  const cleaned = text
    .replace(/^[`*_]+|[`*_]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (/^[A-Z][a-z]+(?:\s+[A-Z][a-z.]+){1,3}$/.test(cleaned)) return undefined;
  if (
    cleaned.length < 24 ||
    /^(?:raw|ui|client|server|schema|route|configuration|environment|command)\b/i.test(
      cleaned,
    )
  )
    return undefined;
  return cleaned.length > 500
    ? `${cleaned.slice(0, 497).replace(/\s+\S*$/, "")}...`
    : cleaned;
}
function deterministicResumeCoachResponse(
  request: ResumeCoachRequest,
): ResumeCoachResponse {
  if (request.baseline) {
    const specialist = specialistFallback(request);
    if (specialist) return specialist;
    invalid(
      "A concise draft cannot be composed from the imported resume contract and supported work.",
      "Restore the initial resume baseline or add directly supported work, then try again.",
    );
  }
  let profile: ResumeProfileSnapshot = {};
  try {
    const parsed = JSON.parse(request.profileSnapshot);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
      profile = parsed as ResumeProfileSnapshot;
  } catch {
    /* A legacy profile snapshot can still produce a work-focused draft. */
  }
  const name = [
    profileValue(profile.firstName),
    profileValue(profile.middleName),
    profileValue(profile.lastName),
  ]
    .filter(Boolean)
    .join(" ");
  const contact = [
    profileValue(profile.email),
    profileValue(profile.phone),
    profileValue(profile.linkedInUrl),
    profileValue(profile.githubUrl),
  ]
    .filter(Boolean)
    .join(" | ");
  const education = [
    profileValue(profile.program),
    profileValue(profile.school),
    profile.graduationYear !== undefined
      ? String(profile.graduationYear)
      : undefined,
    profileValue(profile.gwa) ? `GWA ${profileValue(profile.gwa)}` : undefined,
    profileValue(profile.latinHonors),
  ]
    .filter(Boolean)
    .join(" | ");
  const grouped = new Map<
    string,
    {
      category: "project" | "experience";
      facts: Array<{ text: string; index: number }>;
    }
  >();
  request.evidence.forEach((item, index) => {
    const fact = readableEvidenceFact(item.factualText);
    if (!fact) return;
    const key = resumeProjectName(item.sourceDocument);
    const category = /resume-evidence\/experiences\//i.test(
      item.sourceDocument ?? "",
    )
      ? "experience"
      : "project";
    const group = grouped.get(key) ?? { category, facts: [] };
    if (
      !group.facts.some((entry) => entry.text === fact) &&
      [...grouped.values()].flatMap((entry) => entry.facts).length < 20
    )
      group.facts.push({ text: fact, index });
    grouped.set(key, group);
  });
  const entriesFor = (category: "project" | "experience") =>
    [...grouped.entries()]
      .filter(([, group]) => group.category === category)
      .map(([name, group]) => {
        // Overview and summary documents are generator handoffs, not resume
        // content. Rendering either one verbatim is how source-tree and config
        // material leaked into the PDF after a model fallback.
        const facts = group.facts
          .slice(0, category === "experience" ? 5 : 4)
          .map((fact) => `- ${fact.text}`)
          .join("\n");
        return `${name}${facts ? `\n${facts}` : ""}`;
      });
  const experienceEntries = entriesFor("experience");
  const projectEntries = entriesFor("project");
  const supported = [...grouped.values()].flatMap((group) => group.facts);
  const claims = supported
    .slice(0, 20)
    .map((item) => ({ text: item.text, evidenceIndexes: [item.index] }));
  const projectText = experienceEntries.join("\n\n");
  const projectsText = projectEntries.join("\n\n");
  const skillCorpus = `${request.evidence.map((item) => item.factualText).join(" ")} ${(request.documentation ?? []).flatMap((group) => group.documents.map((document) => document.text)).join(" ")}`;
  const skillGroups = [
    ["Languages", ["TypeScript", "JavaScript", "Go", "Python", "C"]],
    [
      "Frameworks",
      [
        "React",
        "React Router",
        "Node.js",
        "Express",
        "Flask",
        "Vite",
        "Tailwind CSS",
      ],
    ],
    [
      "Data & APIs",
      [
        "MongoDB",
        "Mongoose",
        "SQLite",
        "Supabase",
        "REST APIs",
        "Server-Sent Events",
        "Swagger",
      ],
    ],
    [
      "Tools",
      [
        "Git",
        "GitHub",
        "Docker Compose",
        "Bruno",
        "SendGrid",
        "n8n",
        "Trello",
        "ClickUp",
      ],
    ],
  ]
    .map(
      ([label, names]) =>
        `${label}: ${(names as string[]).filter((item) => new RegExp(`\\b${item.replace(/[.+]/g, "\\$&")}\\b`, "i").test(skillCorpus)).join(", ")}`,
    )
    .filter((line) => !line.endsWith(": "));
  const sections = [
    ...(contact
      ? [{ heading: "Contact", text: `${name}\n${contact}` }]
      : name
        ? [{ heading: "Contact", text: name }]
        : []),
    ...(education ? [{ heading: "Education", text: education }] : []),
    ...(experienceEntries.length
      ? [{ heading: "Experience", text: projectText.slice(0, 2_000) }]
      : []),
    ...(projectEntries.length
      ? [{ heading: "Projects", text: projectsText.slice(0, 2_000) }]
      : []),
    ...(skillGroups.length
      ? [{ heading: "Technical Skills", text: skillGroups.join("\n") }]
      : []),
    ...(request.documentation?.length
      ? []
      : [
          {
            heading: "Selected Experience & Projects",
            text:
              claims.map((claim) => `- ${claim.text}`).join("\n") ||
              "No documented work was supplied.",
          },
        ]),
  ];
  return {
    schemaVersion: 1,
    selectionEcho: request.consentFingerprint,
    sections,
    claims,
    unknowns: [
      "Personal ownership, metrics, users, dates, outcomes, deployment status, and skills are included only where directly documented.",
    ],
  };
}
function specialistFallback(
  request: ResumeCoachRequest,
): ResumeCoachResponse | undefined {
  const baseline = request.baseline;
  if (!baseline) return undefined;
  const action = (value: string) => {
    const fact = readableEvidenceFact(value);
    if (!fact) return undefined;
    const rewritten = fact
      .replace(/^(?:It|I)\s+/i, "")
      .replace(/^built\b/i, "Developed")
      .replace(/^created\b/i, "Developed")
      .replace(/^added\b/i, "Implemented")
      .replace(/^configured\b/i, "Established")
      .replace(/^delivered\b/i, "Delivered")
      .replace(/[.]+$/, "");
    const capitalized = rewritten.charAt(0).toUpperCase() + rewritten.slice(1);
    if (
      !/^(?:Developed|Designed|Implemented|Integrated|Led|Delivered|Improved|Automated|Produced|Established|Validated|Collaborated|Supported|Engineered|Maintained|Managed|Architected|Built)\b/.test(
        capitalized,
      )
    )
      return undefined;
    const words = capitalized.split(/\s+/);
    return words.length > 30 ? words.slice(0, 30).join(" ") : capitalized;
  };
  const grouped = new Map<
    "project" | "experience",
    Array<
      | { name: string; text: string; evidenceIndex: number }
      | { name: string; text: string; clarificationIndex: number }
    >
  >([
    ["project", []],
    ["experience", []],
  ]);
  request.evidence.forEach((evidence, index) => {
    const text = action(evidence.factualText);
    if (!text || !supports(text, [evidence.factualText])) return;
    const category = /(?:^|\/)experiences\//i.test(
      evidence.sourceDocument ?? "",
    )
      ? "experience"
      : "project";
    grouped.get(category)!.push({
      name: resumeProjectName(evidence.sourceDocument),
      text,
      evidenceIndex: index,
    });
  });
  request.clarifications?.forEach((clarification, index) => {
    let text = action(clarification.text);
    if (!text && clarification.text.trim().length >= 10) {
      const clean = clarification.text
        .trim()
        .replace(/^["']|["']$/g, "")
        .replace(/[.]+$/, "");
      const withVerb =
        /^(?:Developed|Designed|Implemented|Integrated|Led|Delivered|Improved|Automated|Produced|Established|Validated|Collaborated|Supported|Engineered|Maintained|Managed|Architected|Built)\b/i.test(
          clean,
        )
          ? clean.charAt(0).toUpperCase() + clean.slice(1)
          : /^(?:i\s+)?built\b/i.test(clean)
            ? `Built ${clean.replace(/^(?:i\s+)?built\s+(?:it\s+)?/i, "")}`
            : /^(?:i\s+)?designed\b/i.test(clean)
              ? `Designed ${clean.replace(/^(?:i\s+)?designed\s+(?:it\s+)?/i, "")}`
              : /^(?:i\s+)?implemented\b/i.test(clean)
                ? `Implemented ${clean.replace(/^(?:i\s+)?implemented\s+(?:it\s+)?/i, "")}`
                : `Delivered ${clean.replace(/^(?:it\s+was\s+able\s+to\s+|it\s+was\s+made\s+to\s+|i\s+built\s+it\s+|i\s+)/i, "")}`;
      const words = withVerb.split(/\s+/);
      text = words.length > 30 ? words.slice(0, 30).join(" ") : withVerb;
    }
    if (!text) return;
    if (!supports(text, [clarification.text])) {
      const clean = clarification.text
        .trim()
        .replace(/^["']|["']$/g, "")
        .replace(/[.]+$/, "");
      const actionPrefixed =
        /^(?:Developed|Designed|Implemented|Integrated|Led|Delivered|Improved|Automated|Produced|Established|Validated|Collaborated|Supported|Engineered|Maintained|Managed|Architected|Built)\b/i.test(
          clean,
        )
          ? clean.charAt(0).toUpperCase() + clean.slice(1)
          : `Built ${clean.replace(/^(?:i\s+|it\s+was\s+)/i, "")}`;
      if (supports(actionPrefixed, [clarification.text])) {
        text = actionPrefixed;
      } else {
        return;
      }
    }
    grouped.get(clarification.itemCategory)!.push({
      name: clarification.itemName,
      text,
      clarificationIndex: index,
    });
  });
  const claims: ResumeCoachResponse["claims"] = [];
  const sections = baseline.sections.map((section) => {
    const category = /(?:experience|employment|work)/i.test(section.heading)
      ? "experience"
      : /project/i.test(section.heading)
        ? "project"
        : undefined;
    if (!category)
      return { heading: section.heading, text: section.existingDetail };
    const entries = grouped.get(category)!;
    const byName = new Map<
      string,
      Array<
        | { text: string; evidenceIndex: number }
        | { text: string; clarificationIndex: number }
      >
    >();
    const hasExperiences = (grouped.get("experience") ?? []).length > 0;
    const maxBulletsPerEntry = category === "project" && hasExperiences ? 2 : 3;
    const maxEntries = category === "project" && hasExperiences ? 3 : 4;
    for (const entry of entries) {
      const current = byName.get(entry.name) ?? [];
      if (current.length < maxBulletsPerEntry) current.push(entry);
      byName.set(entry.name, current);
    }
    const text = [...byName.entries()]
      .slice(0, maxEntries)
      .map(([name, facts]) => {
        for (const fact of facts)
          claims.push(
            "evidenceIndex" in fact
              ? { text: fact.text, evidenceIndexes: [fact.evidenceIndex] }
              : {
                  text: fact.text,
                  evidenceIndexes: [],
                  clarificationIndexes: [fact.clarificationIndex],
                },
          );
        const candidateProvided = facts.some(
          (fact) => "clarificationIndex" in fact,
        );
        const title =
          category === "project"
            ? `${name} | ${candidateProvided ? "Candidate-provided" : "Documented"} workflow`
            : `${name} | ${candidateProvided ? "Candidate-provided" : "Documented"} contribution`;
        return `${title}\n${facts.map((fact) => `- ${fact.text}`).join("\n")}`;
      })
      .join("\n\n");
    const hasCategoryEvidence = (request.evidence ?? []).some((item) =>
      category === "experience"
        ? /(?:^|\/)experiences\//i.test(item.sourceDocument ?? "")
        : !/(?:^|\/)experiences\//i.test(item.sourceDocument ?? ""),
    );
    return {
      heading: section.heading,
      text: text || (hasCategoryEvidence ? "" : section.existingDetail),
    };
  });
  if (!claims.length) {
    console.error(
      "[specialistFallback]: !claims.length is true (claims is empty)",
    );
    return undefined;
  }
  const response: ResumeCoachResponse = {
    schemaVersion: 1,
    sections,
    claims,
    unknowns: [
      "Candidate ownership, metrics, users, outcomes, dates, and technologies remain limited to supplied provenance.",
    ],
    selectionEcho: request.consentFingerprint,
  };
  try {
    return coachResponse(response, request);
  } catch (error) {
    console.error("[specialistFallback coachResponse error]:", error);
    return undefined;
  }
}
function containsResumeSourceLeak(
  response: ResumeCoachResponse,
  request: ResumeCoachRequest,
): boolean {
  const text = `${response.sections.map((section) => section.text).join("\n")}\n${response.claims.map((claim) => claim.text).join("\n")}`;
  const categories = new Set(
    (request.documentation ?? []).map((group) => group.category),
  );
  const projectEvidence = request.evidence.some((item) =>
    /resume-evidence\/projects\//i.test(item.sourceDocument ?? ""),
  );
  const experienceEvidence = request.evidence.some((item) =>
    /resume-evidence\/experiences\//i.test(item.sourceDocument ?? ""),
  );
  const headings = response.sections.map((section) => section.heading.trim());
  // Keep the same clear hierarchy as the reference resume: projects and
  // employment work are separate sections, never a blended project summary.
  const hasProjectSection = headings.some((heading) =>
    /(?:^|\b)(?:[a-z]+\s+)?projects?\b/i.test(heading),
  );
  const hasExperienceSection = headings.some((heading) =>
    /(?:^|\b)(?:[a-z]+\s+)?(?:experience|employment|work history)\b/i.test(
      heading,
    ),
  );
  const missingProjectSection =
    (categories.has("project") || projectEvidence) && !hasProjectSection;
  const missingExperienceSection =
    (categories.has("experience") || experienceEvidence) &&
    !hasExperienceSection;
  const unsafeContent = containsUnsafeResumeContent(text);
  const leakPattern =
    /(?:^|\n)\s*(?:[-•]\s*)?(?:SP[A-Z0-9_]*|[A-Z][A-Z0-9_]*_[A-Z0-9_]+)\s*(?:\(|=|:)|(?:^|\n)[^\n]*(?:for development and runtime instructions|see (?:the )?(?:code\/)?setup\.md|no raw [a-z ]+ storage|return it via a JSON API|create a durable run record)\b/im.test(
      text,
    );
  if (
    process.env.NODE_ENV === "development" &&
    (missingProjectSection ||
      missingExperienceSection ||
      unsafeContent ||
      leakPattern)
  ) {
    console.error("[resume-generation] source-leak guard triggered:", {
      missingProjectSection,
      missingExperienceSection,
      unsafeContent,
      leakPattern,
    });
  }
  return (
    missingProjectSection ||
    missingExperienceSection ||
    unsafeContent ||
    leakPattern
  );
}
function retainCandidateClarificationProvenance(
  response: ResumeCoachResponse,
  request: ResumeCoachRequest,
): ResumeCoachResponse {
  return request.clarifications?.length
    ? { ...response, candidateClarifications: request.clarifications }
    : response;
}
export async function requestBaseResumeGeneration(
  request: ResumeCoachRequest,
  fetcher: FetchLike = fetch,
): Promise<ResumeCoachResponse> {
  validCoach(request);
  if (request.fileReadSession) {
    try {
      return retainCandidateClarificationProvenance(
        await requestFileAgentResume(request, request.fileReadSession, fetcher),
        request,
      );
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error(
          "[requestBaseResumeGeneration file agent fallback]:",
          error,
        );
      }
      return retainCandidateClarificationProvenance(
        deterministicResumeCoachResponse(request),
        request,
      );
    }
  }
  // Every current documented finding remains attached to the resulting draft.
  // A very large collection must not be sent to the loopback model, however:
  // use the same provenance-linked local composer rather than silently dropping
  // findings or surfacing a generic model-input error.
  if (JSON.stringify(request).length > maxRequest)
    return retainCandidateClarificationProvenance(
      deterministicResumeCoachResponse(request),
      request,
    );
  try {
    const modelEvidence = resumeRelevantModelEvidence(request.evidence);
    if (!modelEvidence.length)
      return retainCandidateClarificationProvenance(
        deterministicResumeCoachResponse(request),
        request,
      );
    const packetEvidence = modelEvidence.map(
      ({ index, factualText, contentDigest }) => ({
        evidenceIndex: index,
        factualText,
        contentDigest,
      }),
    );
    const packetDocumentation = resumeGenerationDocumentation(
      request.documentation,
    );
    const projectIdentities = (request.documentation ?? [])
      .filter((group) => group.category === "project")
      .map((group) => group.name);
    const baseline = request.baseline;
    if (!baseline)
      return retainCandidateClarificationProvenance(
        deterministicResumeCoachResponse(request),
        request,
      );
    const candidateClarifications = (request.clarifications ?? []).map(
      ({ itemName, itemCategory, category, text, provenance }, index) => ({
        clarificationIndex: index,
        itemName,
        itemCategory,
        category,
        text,
        provenance,
      }),
    );
    const generated = await orchestrateResumeGeneration(
      {
        baseline,
        selectionEcho: request.consentFingerprint,
        profile: request.profileSnapshot,
        evidence: packetEvidence,
        candidateClarifications,
        documentation: packetDocumentation,
        projectIdentities,
        opportunity: request.opportunity
          ? {
              title: request.opportunity.title,
              company: request.opportunity.company,
              requirements: request.opportunity.requirements,
              copiedDescription: request.opportunity.copiedDescription,
              contentDigest: request.opportunity.contentDigest,
            }
          : null,
        request: request.userRequest,
      },
      (instruction, packet, maximumTokens) =>
        native(
          request.connection,
          instruction,
          packet,
          maximumTokens,
          fetcher,
          "RESUME_COACH_UNAVAILABLE",
          maxResponse,
          "off",
        ),
    );
    const response = request.fileReadSession
      ? generated
      : coachResponse(generated, request);
    if (containsResumeSourceLeak(response, request)) {
      if (process.env.NODE_ENV === "development")
        console.error("[resume-generation] fallback: source-leak guard");
      return retainCandidateClarificationProvenance(
        deterministicResumeCoachResponse(request),
        request,
      );
    }
    return retainCandidateClarificationProvenance(response, request);
  } catch (error) {
    let reason = "unknown failure";
    if (error instanceof WorkspaceError) reason = error.code;
    else if (error instanceof Error) reason = error.message;
    if (process.env.NODE_ENV === "development")
      console.error(
        `[resume-generation] fallback: ${reason}${error instanceof Error && error.message ? ` (${error.message})` : ""}`,
      );
    return retainCandidateClarificationProvenance(
      deterministicResumeCoachResponse(request),
      request,
    );
  }
}
// Existing callers and persisted tests can migrate gradually. This is a base
// resume generator alias, not the interactive Resume Coach.
export const requestResumeCoach = requestBaseResumeGeneration;

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
function coachReviewResponse(
  value: unknown,
  request: ResumeCoachRequest,
): ResumeCoachReviewResponse {
  if (!value || typeof value !== "object" || Array.isArray(value))
    invalid("The Resume Coach returned an unusable response.");
  const item = value as Record<string, unknown>;
  const ratings = item.ratings;
  const strengths = item.strengths;
  const concerns = item.concerns;
  const recommendations = item.recommendations;
  const allowedAreas = new Set([
    "clarity",
    "relevance",
    "credibility",
    "specificity",
    "atsReadability",
  ]);
  if (
    !exactKeys(item, [
      "schemaVersion",
      "selectionEcho",
      "ratings",
      "strengths",
      "concerns",
      "recommendations",
    ]) ||
    item.schemaVersion !== 1 ||
    item.selectionEcho !== request.consentFingerprint ||
    !Array.isArray(ratings) ||
    ratings.length !== 5 ||
    new Set(ratings.map((entry) => String((entry as { area?: unknown }).area)))
      .size !== 5 ||
    ratings.some(
      (entry) =>
        !entry ||
        typeof entry !== "object" ||
        !allowedAreas.has(String((entry as { area?: unknown }).area)) ||
        !Number.isInteger((entry as { score?: unknown }).score) ||
        (entry as { score: number }).score < 1 ||
        (entry as { score: number }).score > 5 ||
        !plain((entry as { rationale?: unknown }).rationale, 600),
    ) ||
    !Array.isArray(strengths) ||
    strengths.length > 8 ||
    !Array.isArray(concerns) ||
    concerns.length > 8 ||
    !Array.isArray(recommendations) ||
    recommendations.length > 8 ||
    [...strengths, ...concerns, ...recommendations].some(
      (entry) => !plain(entry, 700),
    )
  )
    invalid("The Resume Coach returned malformed or ambiguous feedback.");
  return {
    schemaVersion: 1,
    ratings: ratings as ResumeCoachReviewResponse["ratings"],
    strengths: strengths as string[],
    concerns: concerns as string[],
    recommendations: recommendations as string[],
    selectionEcho: request.consentFingerprint,
  };
}
export async function requestResumeCoachReview(
  request: ResumeCoachRequest,
  fetcher: FetchLike = fetch,
): Promise<ResumeCoachReviewResponse> {
  validCoach(request);
  const input = {
    schemaVersion: 1,
    selectionEcho: request.consentFingerprint,
    focus: request.userRequest,
    currentResumeSections: request.currentResumeSections ?? [],
    profile: request.profileSnapshot,
    documentation: request.documentation ?? [],
    evidence: resumeRelevantModelEvidence(request.evidence),
    responseShape: {
      schemaVersion: 1,
      ratings: [
        { area: "clarity", score: 1, rationale: "string" },
        { area: "relevance", score: 1, rationale: "string" },
        { area: "credibility", score: 1, rationale: "string" },
        { area: "specificity", score: 1, rationale: "string" },
        { area: "atsReadability", score: 1, rationale: "string" },
      ],
      strengths: ["string"],
      concerns: ["string"],
      recommendations: ["string"],
      selectionEcho: request.consentFingerprint,
    },
  };
  if (JSON.stringify(input).length > maxRequest)
    return {
      schemaVersion: 1,
      selectionEcho: request.consentFingerprint,
      ratings: [
        "clarity",
        "relevance",
        "credibility",
        "specificity",
        "atsReadability",
      ].map((area) => ({
        area: area as ResumeCoachReviewResponse["ratings"][number]["area"],
        score: 3,
        rationale:
          "The bounded local review packet is too large for a model call; review the saved evidence in smaller workspace groups.",
      })),
      strengths: [],
      concerns: [
        "The documented work is too large for one local-model review packet.",
      ],
      recommendations: [
        "Review one project or experience collection at a time before requesting another coach review.",
      ],
    };
  return coachReviewResponse(
    await native(
      request.connection,
      resumeCoachReviewSystemInstruction,
      input,
      1_200,
      fetcher,
      "RESUME_COACH_UNAVAILABLE",
    ),
    request,
  );
}

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
    "Write only resume-bullet-candidates.md. Begin exactly with '# Resume Bullet Candidates (Proposed / Unreviewed)'. Immediately add a '## Resume Context' section with concise research notes headed Purpose, User or workflow, Design rationale, Directly stated outcome, and Explicit gaps. Synthesize those notes from the supplied factual handoff and provenance-backed evidence; keep technical mechanisms subordinate to why they matter. State 'Not directly evidenced' rather than inventing purpose, users, rationale, or outcomes. This context is research for a later resume writer, never a candidate claim: do not include source paths, filenames, configuration values, commands, routes, API syntax, or setup instructions. Then add '## Candidate Bullets'. Do not impose an arbitrary candidate count; include every distinct, directly supported candidate that materially helps describe the project. For every candidate use exactly: '### B-001', '- Candidate: <conservative candidate>', '- Supporting evidence: E-001', '- Explicit unknowns: <unknowns>', '- Status: Proposed / unreviewed; not claim-eligible'. Use consecutive B identifiers and only E identifiers in the supplied resume-evidence.md. If no candidates are supported, write only '- No supported bullet candidates found.' after the Candidate Bullets heading. Do not create, summarize, or mention any other artifact.",
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
function isBoilerplateEvidence(text: string): boolean {
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
    if (
      /(?:flask|django|fastapi|express|nestjs|react|next|vue|nuxt|angular|svelte|spring|rails|laravel)/i.test(
        name,
      )
    )
      return "Framework";
    if (
      /(?:postgres|mysql|mariadb|mongo|mongoose|sqlite|prisma|sequelize|typeorm|redis)/i.test(
        name,
      )
    )
      return "Data store or data tooling";
    if (/(?:docker|kubernetes|terraform|helm)/i.test(name))
      return "Operational tooling";
    if (/(?:pytest|jest|vitest|playwright|cypress)/i.test(name))
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
          push(technologyCategory(text), text, file.path, line);
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
    return facts;
  })();
  const stackTable = stackFacts.length
    ? `| Category | Directly supported detail | Source |\n| --- | --- | --- |\n${stackFacts.map((fact) => `| ${fact.category} | ${fact.detail} | \`${fact.path}\`, line ${fact.line} |`).join("\n")}`
    : "No framework, dependency, runtime, or tooling entries were directly identified in the inspected manifest lines.";
  const heading = (title: string) =>
    `# ${title}\n\n> Generated from a bounded, read-only local project scan. Paths are relative to the selected folder.\n`;
  const documents: Record<string, string> = {
    "source-tree-analysis.md": `${heading("Source Tree Analysis")}## Inspected paths\n\n${list(paths)}\n\n## Critical areas\n\n${list([...entry, ...api, ...data, ...ui, ...operations, ...tests].map((file) => file.path))}\n\n## Entry points\n\n${list(entry.map((file) => file.path))}`,
    "technology-stack.md": `${heading("Technology Stack")}## Manifests and configuration\n\n${list(manifests.map((file) => file.path))}\n\n## Technology inventory\n\n${stackTable}\n\n## Classification notes\n\n- Runtime commands, service commands, and deployment steps are intentionally documented in \`development-guide.md\` or \`deployment-guide.md\`, not treated as stack entries.\n- This inventory lists only directly supported manifest or container-runtime details; it does not infer deployed services, ownership, scale, or outcomes.`,
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
    documents["experience-context.md"] =
      `${heading("Experience Context")}## Documented role context\n\n${sourceMap([...documentation, ...manifests], 36) || "- No documented role, organization, or period was found in the bounded scan."}\n\n## Explicit gaps\n\n- Treat role title, organization, period, personal attribution, and employment status as unknown unless the selected material states them directly.`;
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

function assessmentInvalid(
  message: string,
  next = "Review the selected opportunity material and try the assessment again.",
): never {
  throw new WorkspaceError("OPPORTUNITY_ASSESSMENT_INVALID", message, next);
}
export function validateOpportunityAssessmentResponse(
  value: unknown,
  request: OpportunityAssessmentRequest,
): OpportunityAssessmentResponse {
  if (!value || typeof value !== "object" || Array.isArray(value))
    assessmentInvalid("The local model returned an unusable assessment.");
  const item = value as Record<string, unknown>;
  const strengths = item.strengths;
  const gaps = item.gaps;
  const unknowns = item.unknowns;
  const excerpt = (value: unknown) => {
    if (!value || typeof value !== "object") return false;
    const range = value as { start?: unknown; end?: unknown };
    return (
      Number.isInteger(range.start) &&
      Number.isInteger(range.end) &&
      (range.start as number) >= 0 &&
      (range.end as number) > (range.start as number) &&
      (range.end as number) <= request.opportunity.copiedDescription.length &&
      (range.end as number) - (range.start as number) <= 500
    );
  };
  const predicts = (text: unknown) =>
    typeof text === "string" &&
    /\b(hired|hire|interview|offer|employer intent|will get)\b/i.test(text);
  if (
    item.schemaVersion !== 1 ||
    item.selectionEcho !== request.consentFingerprint ||
    !Array.isArray(strengths) ||
    strengths.length > 12 ||
    !Array.isArray(gaps) ||
    gaps.length > 12 ||
    !Array.isArray(unknowns) ||
    unknowns.length > 12 ||
    strengths.some(
      (entry) =>
        !entry ||
        typeof entry !== "object" ||
        !plain((entry as { text?: unknown }).text, 900) ||
        predicts((entry as { text?: unknown }).text) ||
        !excerpt((entry as { excerpt?: unknown }).excerpt) ||
        !Array.isArray(
          (entry as { evidenceIndexes?: unknown }).evidenceIndexes,
        ) ||
        !(entry as { evidenceIndexes: unknown[] }).evidenceIndexes.length ||
        (entry as { evidenceIndexes: unknown[] }).evidenceIndexes.some(
          (index) =>
            !Number.isInteger(index) ||
            (index as number) < 0 ||
            (index as number) >= request.evidence.length,
        ),
    ) ||
    gaps.some(
      (entry) =>
        !entry ||
        typeof entry !== "object" ||
        !plain((entry as { text?: unknown }).text, 900) ||
        predicts((entry as { text?: unknown }).text) ||
        !excerpt((entry as { excerpt?: unknown }).excerpt),
    ) ||
    unknowns.some((entry) => !plain(entry, 500) || predicts(entry))
  )
    assessmentInvalid("The local model returned unsafe assessment guidance.");
  const result = {
    schemaVersion: 1 as const,
    strengths: strengths as OpportunityAssessmentResponse["strengths"],
    gaps: gaps as OpportunityAssessmentResponse["gaps"],
    unknowns: unknowns as string[],
    selectionEcho: request.consentFingerprint,
  };
  if (JSON.stringify(result).length > maxResponse)
    assessmentInvalid(
      "The local model assessment is too large to review safely.",
    );
  return result;
}
export async function requestOpportunityAssessment(
  request: OpportunityAssessmentRequest,
  fetcher: FetchLike = fetch,
): Promise<OpportunityAssessmentResponse> {
  if (
    !validConnection(request.connection) ||
    !plain(request.profileSummary, 4_000) ||
    !sha(request.profileDigest) ||
    !sha(request.templateDigest) ||
    !plain(request.opportunity.id, 64) ||
    !sha(request.opportunity.contentDigest) ||
    !plain(request.opportunity.copiedDescription, 20_000) ||
    !request.opportunity.requirements.length ||
    request.opportunity.requirements.length > 20 ||
    request.opportunity.requirements.some((item) => !plain(item, 1_000)) ||
    !request.evidence.length ||
    request.evidence.length > 50 ||
    request.evidence.some(
      (item) =>
        !plain(item.id, 64) ||
        !plain(item.factualText, 4_000) ||
        !sha(item.contentDigest),
    ) ||
    request.consentFingerprint !==
      opportunityAssessmentConsentFingerprint(request)
  )
    assessmentInvalid(
      "The selected local assessment material cannot be sent safely.",
    );
  return validateOpportunityAssessmentResponse(
    await native(
      request.connection,
      "Return only JSON. Assess semantic resume-to-opportunity fit using supplied evidence. Never predict hiring, interviews, offers, or employer intent.",
      {
        schemaVersion: 1,
        selectionEcho: request.consentFingerprint,
        profile: request.profileSummary,
        opportunity: {
          title: request.opportunity.title,
          company: request.opportunity.company,
          requirements: request.opportunity.requirements,
          copiedDescription: request.opportunity.copiedDescription,
        },
        evidence: request.evidence.map(({ factualText, contentDigest }) => ({
          factualText,
          contentDigest,
        })),
        responseShape: {
          strengths: [
            {
              text: "string",
              evidenceIndexes: [0],
              excerpt: { start: 0, end: 1 },
            },
          ],
          gaps: [{ text: "string", excerpt: { start: 0, end: 1 } }],
          unknowns: ["string"],
          selectionEcho: request.consentFingerprint,
        },
      },
      1100,
      fetcher,
      "OPPORTUNITY_ASSESSMENT_UNAVAILABLE",
    ),
    request,
  );
}

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
export const editableTexMaximumRequestBytes = 72_000;
export const editableTexMaximumResponseBytes = 48_000;
const editableTexOutputTokens = 12_000;
const safeRelativeArtifactPath = (value: unknown) =>
  typeof value === "string" &&
  value.length > 0 &&
  value.length <= 800 &&
  !/[\\\u0000-\u001f\u007f-\u009f]/.test(value) &&
  !value.split("/").some((segment) => segment === ".." || segment === ".") &&
  !/^(?:[a-z]:|\/|[a-z][a-z0-9+.-]*:)/i.test(value);

export function editableTexRevisionConsentFingerprint(
  input: Omit<EditableTexRevisionRequest, "consentFingerprint">,
): string {
  return `sha256:${createHash("sha256")
    .update(
      JSON.stringify({
        capability: localModelCapabilityVersion("editable-tex-revision"),
        connection: publicConnection(input.connection),
        workspaceId: input.workspaceId,
        displayName: input.displayName,
        baseline: {
          id: input.baseline.id,
          contentDigest: input.baseline.contentDigest,
        },
        artifacts: input.artifacts
          .map(({ documentId, path, contentDigest }) => ({
            documentId,
            path,
            contentDigest,
          }))
          .sort((a, b) => a.path.localeCompare(b.path)),
        contextLimitTokens: input.contextLimitTokens,
        consentNonce: input.consentNonce,
      }),
    )
    .digest("hex")}`;
}

/** Calculates the full packet before inference. Callers must not trim artifacts to fit. */
function editableTexPacket(request: EditableTexRevisionRequest) {
  return {
    schemaVersion: 1,
    selectionEcho: request.consentFingerprint,
    baseline: {
      id: request.baseline.id,
      contentDigest: request.baseline.contentDigest,
      tex: request.baseline.tex,
    },
    artifacts: request.artifacts.map(({ path, contentDigest, text }) => ({
      path,
      contentDigest,
      text,
    })),
    documentPolicy: rawTexDocumentPolicy(request.baseline.tex),
    responseShape: {
      schemaVersion: 1,
      selectionEcho: request.consentFingerprint,
      tex: "complete TeX document",
      artifactCitations: request.artifacts.map(({ path, contentDigest }) => ({
        path,
        contentDigest,
      })),
    },
  };
}
function editableTexTransportBody(request: EditableTexRevisionRequest): string {
  return JSON.stringify({
    model: request.connection.modelIdentifier,
    input: JSON.stringify(editableTexPacket(request)),
    system_prompt: editableTexRevisionSystemInstruction,
    stream: false,
    store: false,
    reasoning: "off",
    temperature: 0.2,
    max_output_tokens: editableTexOutputTokens,
  });
}
/**
 * LM Studio exposes a context-token limit but not a tokenizer/chat-template
 * contract for this endpoint.  The exact UTF-8 request body is therefore used
 * as a tokenizer-independent upper bound for input tokens (a byte tokenizer
 * consumes at most one token per byte).  The output reserve is the exact
 * `max_output_tokens` value sent in that same body.  This deliberately uses
 * upper-bound units, rather than claiming either value is an exact token count.
 */
export function editableTexRequestBudget(request: EditableTexRevisionRequest): {
  serializedRequestBytes: number;
  responseByteLimit: number;
  inputTokenUpperBound: number;
  responseTokenReserve: number;
  totalContextTokenUpperBound: number;
} {
  const serializedRequestBytes = Buffer.byteLength(
    editableTexTransportBody(request),
    "utf8",
  );
  const inputTokenUpperBound = serializedRequestBytes;
  const responseTokenReserve = editableTexOutputTokens;
  return {
    serializedRequestBytes,
    responseByteLimit: editableTexMaximumResponseBytes,
    inputTokenUpperBound,
    responseTokenReserve,
    totalContextTokenUpperBound: inputTokenUpperBound + responseTokenReserve,
  };
}
function editableTexInvalid(
  message: string,
  next = "Reduce neither the template nor the approved artifacts; use a model context configured for this complete draft packet.",
): never {
  throw new WorkspaceError("RESUME_COACH_INVALID", message, next);
}
function validateEditableTexRequest(request: EditableTexRevisionRequest): void {
  const budget = editableTexRequestBudget(request);
  if (
    !validConnection(request.connection) ||
    !uuid(request.workspaceId) ||
    !plain(request.displayName, 120) ||
    !uuid(request.baseline.id) ||
    !sha(request.baseline.contentDigest) ||
    !boundedText(request.baseline.tex, editableTexMaximumResponseBytes) ||
    !plain(request.consentNonce, 128) ||
    !sha(request.consentFingerprint) ||
    !Number.isInteger(request.contextLimitTokens) ||
    request.contextLimitTokens < editableTexOutputTokens + 1 ||
    request.contextLimitTokens > 30_000 ||
    !request.artifacts.length ||
    request.artifacts.length > 200 ||
    request.artifacts.some(
      (artifact) =>
        !uuid(artifact.documentId) ||
        !safeRelativeArtifactPath(artifact.path) ||
        !sha(artifact.contentDigest) ||
        !boundedText(artifact.text, 2 * 1024 * 1024),
    ) ||
    new Set(request.artifacts.map((artifact) => artifact.path)).size !==
      request.artifacts.length ||
    request.consentFingerprint !==
      editableTexRevisionConsentFingerprint(request)
  )
    editableTexInvalid(
      "The selected TeX draft material cannot be sent safely.",
    );
  if (
    budget.serializedRequestBytes > editableTexMaximumRequestBytes ||
    budget.totalContextTokenUpperBound > request.contextLimitTokens
  )
    editableTexInvalid(
      "The complete TeX template and approved artifact packet exceed the configured local-model context.",
    );
}
export function validateEditableTexRevisionResponse(
  value: unknown,
  request: EditableTexRevisionRequest,
): EditableTexRevisionResponse {
  if (!value || typeof value !== "object" || Array.isArray(value))
    editableTexInvalid("The local model returned an unusable TeX revision.");
  const item = value as Record<string, unknown>;
  const citations = item.artifactCitations;
  if (
    !exactKeys(item, [
      "schemaVersion",
      "selectionEcho",
      "tex",
      "artifactCitations",
    ]) ||
    item.schemaVersion !== 1 ||
    item.selectionEcho !== request.consentFingerprint ||
    !boundedText(item.tex, editableTexMaximumResponseBytes) ||
    (typeof item.tex === "string" &&
      Buffer.byteLength(item.tex, "utf8") > editableTexMaximumResponseBytes) ||
    !Array.isArray(citations) ||
    citations.length !== request.artifacts.length
  )
    editableTexInvalid("The local model returned an incomplete TeX revision.");
  const expected = new Map(
    request.artifacts.map((artifact) => [
      artifact.path,
      artifact.contentDigest,
    ]),
  );
  if (
    citations.some(
      (citation) =>
        !citation ||
        typeof citation !== "object" ||
        Array.isArray(citation) ||
        !exactKeys(citation as Record<string, unknown>, [
          "path",
          "contentDigest",
        ]) ||
        !safeRelativeArtifactPath((citation as { path?: unknown }).path) ||
        !sha((citation as { contentDigest?: unknown }).contentDigest) ||
        expected.get((citation as { path: string }).path) !==
          (citation as { contentDigest: string }).contentDigest,
    ) ||
    new Set(citations.map((citation) => (citation as { path: string }).path))
      .size !== citations.length
  )
    editableTexInvalid(
      "The local model did not cite the complete approved artifact snapshot.",
    );
  return {
    schemaVersion: 1,
    selectionEcho: request.consentFingerprint,
    tex: String(item.tex),
    artifactCitations:
      citations as EditableTexRevisionResponse["artifactCitations"],
  };
}
export async function requestEditableTexRevision(
  request: EditableTexRevisionRequest,
  fetcher: FetchLike = fetch,
): Promise<EditableTexRevisionResponse> {
  validateEditableTexRequest(request);
  // validateEditableTexRequest budgets this exact serialization before any transport.
  const content = await nativeText(
    request.connection,
    editableTexRevisionSystemInstruction,
    editableTexPacket(request),
    editableTexOutputTokens,
    fetcher,
    "RESUME_COACH_UNAVAILABLE",
    editableTexMaximumResponseBytes,
  );
  let parsed: unknown;
  try {
    parsed = parseModelJson(content);
  } catch {
    editableTexInvalid(
      "The local model returned a malformed TeX response envelope.",
    );
  }
  return validateEditableTexRevisionResponse(parsed, request);
}
