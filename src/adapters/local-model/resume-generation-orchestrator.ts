import type { ResumeTemplateContract } from "@/domain/base-resume/resume-template-contract";
import {
  hasExactKeys,
  isBoundedText,
  isIndexArray,
  isRecord,
  type ResumeStageClaim,
  type ResumeStageEdit,
  type ResumeStageFinding,
  type ResumeStageReview,
  type ResumeStageSlot,
} from "@/domain/resume-agent/resume-generation-stages";

import { resumeEvidenceAnalystInstruction } from "@/adapters/local-model/resume-evidence-analyst-agent";
import { resumeIntegrityReviewerInstruction } from "@/adapters/local-model/resume-integrity-reviewer-agent";
import { resumeStrategistInstruction } from "@/adapters/local-model/resume-strategist-agent";
import { resumeWriterInstruction } from "@/adapters/local-model/resume-writer-agent";

export type ResumeGenerationStageRunner = (
  instruction: string,
  packet: unknown,
  maximumTokens: number,
) => Promise<Record<string, unknown>>;

type Evidence = {
  evidenceIndex: number;
  factualText: string;
  contentDigest: string;
};
type Clarification = {
  clarificationIndex: number;
  itemName: string;
  itemCategory: "project" | "experience";
  category: string;
  text: string;
  provenance: "candidate_interview_answer";
};

export type ResumeGenerationOrchestrationInput = {
  baseline: ResumeTemplateContract;
  selectionEcho: string;
  profile: unknown;
  evidence: Evidence[];
  candidateClarifications: Clarification[];
  documentation: unknown;
  projectIdentities: string[];
  opportunity: unknown;
  request: string;
};

export type OrchestratedResume = {
  schemaVersion: 1;
  selectionEcho: string;
  sections: Array<{ heading: string; text: string }>;
  claims: ResumeStageClaim[];
  unknowns: string[];
};

const workHeading = (heading: string) =>
  /(?:experience|employment|\bwork\b|project)/i.test(heading);
const bullet = /^\s*[-•]\s+(.+)$/;
const genericHeading =
  /^(summary|professional summary|skills|selected projects)$/i;

const indexesWithin = (indexes: number[], allowed: Set<number>) =>
  indexes.every((index) => allowed.has(index));

const hasOverlap = (left: string, right: string) => {
  const words = (value: string) =>
    new Set(value.toLocaleLowerCase().match(/[a-z0-9]{3,}/g) ?? []);
  const leftWords = words(left);
  return [...leftWords].some((word) => words(right).has(word));
};

function parseUnknowns(value: unknown): string[] {
  if (
    !Array.isArray(value) ||
    value.length > 12 ||
    !value.every(
      (item) =>
        typeof item === "string" && (!item.trim() || isBoundedText(item, 500)),
    )
  )
    throw new Error("invalid stage unknowns");
  const unknowns: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (trimmed) unknowns.push(trimmed);
  }
  return [...new Set(unknowns)];
}

function parseFindings(
  value: Record<string, unknown>,
  evidence: Evidence[],
  clarifications: Clarification[],
): { findings: ResumeStageFinding[]; unknowns: string[] } {
  if (
    !hasExactKeys(value, ["findings", "unknowns"]) ||
    !Array.isArray(value.findings) ||
    value.findings.length > 24
  )
    throw new Error("invalid analyst response");
  const evidenceIndexes = new Set(evidence.map((item) => item.evidenceIndex));
  const clarificationIndexes = new Set(
    clarifications.map((item) => item.clarificationIndex),
  );
  const findings = value.findings.map((item) => {
    if (
      !isRecord(item) ||
      !hasExactKeys(item, [
        "evidenceIndexes",
        "clarificationIndexes",
        "fact",
      ]) ||
      !isIndexArray(item.evidenceIndexes, 12) ||
      !isIndexArray(item.clarificationIndexes, 12) ||
      !isBoundedText(item.fact, 700)
    )
      throw new Error("invalid analyst finding");
    const finding = item as ResumeStageFinding;
    if (
      (!finding.evidenceIndexes.length &&
        !finding.clarificationIndexes.length) ||
      !indexesWithin(finding.evidenceIndexes, evidenceIndexes) ||
      !indexesWithin(finding.clarificationIndexes, clarificationIndexes)
    )
      throw new Error("unsupported analyst finding");
    const sources = [
      ...evidence
        .filter((entry) =>
          finding.evidenceIndexes.includes(entry.evidenceIndex),
        )
        .map((entry) => entry.factualText),
      ...clarifications
        .filter((entry) =>
          finding.clarificationIndexes.includes(entry.clarificationIndex),
        )
        .map((entry) => entry.text),
    ];
    if (!sources.some((source) => hasOverlap(finding.fact, source)))
      throw new Error("ungrounded analyst finding");
    return finding;
  });
  return { findings, unknowns: parseUnknowns(value.unknowns) };
}

function parseStrategy(
  value: Record<string, unknown>,
  editableSlots: Set<number>,
  findings: ResumeStageFinding[],
): { slots: ResumeStageSlot[]; unknowns: string[] } {
  if (
    !hasExactKeys(value, ["slots", "unknowns"]) ||
    !Array.isArray(value.slots) ||
    value.slots.length > editableSlots.size
  )
    throw new Error("invalid strategist response");
  const slots = value.slots.flatMap((item) => {
    if (
      !isRecord(item) ||
      !hasExactKeys(item, ["sectionIndex", "findingIndexes"]) ||
      !Number.isInteger(item.sectionIndex) ||
      !Array.isArray(item.findingIndexes) ||
      item.findingIndexes.length === 0 ||
      item.findingIndexes.length > 24 ||
      !item.findingIndexes.every(
        (index) => Number.isInteger(index) && index >= 0,
      )
    )
      throw new Error("invalid strategist slot");
    const slot = item as ResumeStageSlot;
    const suppliedIndexes = [...new Set(slot.findingIndexes)];
    // Qwen may repeat source evidence IDs instead of Analyst-array positions.
    // If any ID is outside that array's range, treat the complete list as
    // source IDs so small source IDs cannot be mistaken for finding positions.
    const sourceIndexMode = suppliedIndexes.some(
      (index) => index >= findings.length,
    );
    const findingIndexes = [
      ...new Set(
        suppliedIndexes.flatMap((index) => {
          if (!sourceIndexMode) return [index];
          return findings.flatMap((finding, findingIndex) =>
            finding.evidenceIndexes.includes(index) ||
            finding.clarificationIndexes.includes(index)
              ? [findingIndex]
              : [],
          );
        }),
      ),
    ];
    return editableSlots.has(slot.sectionIndex) && findingIndexes.length
      ? [{ sectionIndex: slot.sectionIndex, findingIndexes }]
      : [];
  });
  if (!slots.length && value.slots.length)
    throw new Error("strategist selected no usable editable slot");
  if (new Set(slots.map((slot) => slot.sectionIndex)).size !== slots.length)
    throw new Error("duplicate strategist slot");
  return { slots, unknowns: parseUnknowns(value.unknowns) };
}

function parseWriter(
  value: Record<string, unknown>,
  plannedSlots: Set<number>,
  projectSlots: Set<number>,
  projectIdentities: string[],
  evidence: Evidence[],
  clarifications: Clarification[],
): { edits: ResumeStageEdit[]; unknowns: string[] } {
  if (
    (!hasExactKeys(value, ["edits", "unknowns"]) &&
      !hasExactKeys(value, ["edits"])) ||
    !Array.isArray(value.edits) ||
    value.edits.length > 8
  )
    throw new Error("invalid writer response");
  const evidenceIndexes = new Set(evidence.map((item) => item.evidenceIndex));
  const clarificationIndexes = new Set(
    clarifications.map((item) => item.clarificationIndex),
  );
  const edits = value.edits.flatMap((item) => {
    if (
      !isRecord(item) ||
      !hasExactKeys(item, ["sectionIndex", "text", "claims"]) ||
      !Number.isInteger(item.sectionIndex) ||
      !isBoundedText(item.text, 2_000) ||
      !Array.isArray(item.claims) ||
      item.claims.length > 12
    )
      throw new Error("invalid writer edit");
    const edit = item as ResumeStageEdit;
    if (
      !plannedSlots.has(edit.sectionIndex) ||
      genericHeading.test(edit.text.trim())
    )
      return [];
    if (projectSlots.has(edit.sectionIndex) && projectIdentities.length) {
      const title = edit.text
        .split(/\r?\n/)
        .find(Boolean)
        ?.split("|")[0]
        ?.trim();
      if (!title || !projectIdentities.includes(title))
        throw new Error("renamed or invented project identity");
    }
    // The Strategist controls which slot may be written. Citation grounding is
    // deliberately checked against the complete host-curated packet: a Writer
    // may pair a selected finding with another eligible fact or clarification
    // needed to support the same concise bullet.
    const claims = edit.claims.map((claim) => {
      if (
        !isRecord(claim) ||
        !hasExactKeys(claim, [
          "text",
          "evidenceIndexes",
          "clarificationIndexes",
        ]) ||
        !isBoundedText(claim.text, 1_000) ||
        !isIndexArray(claim.evidenceIndexes, 12) ||
        !isIndexArray(claim.clarificationIndexes, 12)
      )
        throw new Error("invalid writer claim");
      const parsed = claim as ResumeStageClaim;
      if (
        (!parsed.evidenceIndexes.length &&
          !parsed.clarificationIndexes.length) ||
        !indexesWithin(parsed.evidenceIndexes, evidenceIndexes) ||
        !indexesWithin(parsed.clarificationIndexes, clarificationIndexes)
      )
        throw new Error("unsupported writer claim");
      return parsed;
    });
    // Qwen sometimes returns the entry heading in text and the actual
    // provenance-backed bullets only in claims. The host may render those
    // validated claims as bullets; no uncited model prose is synthesized.
    const text = edit.text.split(/\r?\n/).some((line) => bullet.test(line))
      ? edit.text
      : `${edit.text.trim()}\n${claims.map((claim) => `- ${claim.text}`).join("\n")}`;
    const visibleBullets = text.split(/\r?\n/).flatMap((line) => {
      const bulletText = line.match(bullet)?.[1]?.trim();
      return bulletText ? [bulletText] : [];
    });
    if (
      !visibleBullets.length ||
      visibleBullets.some(
        (bulletText) => !claims.some((claim) => claim.text === bulletText),
      )
    )
      throw new Error("uncited writer bullet");
    return [{ ...edit, text, claims }];
  });
  if (!edits.length && value.edits.length)
    throw new Error("writer returned no usable planned edit");
  if (new Set(edits.map((edit) => edit.sectionIndex)).size !== edits.length)
    throw new Error("duplicate writer edit");
  return {
    edits,
    unknowns: value.unknowns === undefined ? [] : parseUnknowns(value.unknowns),
  };
}

function parseReview(value: Record<string, unknown>): ResumeStageReview {
  const reasons = value.reasons;
  const reasonCodes = value.reason_codes;
  const hasDuplicateReasonCodes =
    hasExactKeys(value, ["verdict", "reasons", "reason_codes"]) &&
    Array.isArray(reasonCodes) &&
    Array.isArray(reasons) &&
    reasonCodes.length === reasons.length &&
    reasonCodes.every((reason, index) => reason === reasons[index]);
  if (
    (!hasExactKeys(value, ["verdict", "reasons"]) &&
      !hasDuplicateReasonCodes) ||
    (value.verdict !== "accept" && value.verdict !== "reject") ||
    !Array.isArray(value.reasons) ||
    value.reasons.length > 8 ||
    !value.reasons.every((reason) => isBoundedText(reason, 120))
  )
    throw new Error("invalid integrity review");
  const review = value as ResumeStageReview;
  if (
    (review.verdict === "accept" && review.reasons.length) ||
    (review.verdict === "reject" && !review.reasons.length) ||
    new Set(review.reasons).size !== review.reasons.length
  )
    throw new Error("invalid integrity verdict");
  return review;
}

/** Runs four distinct local-model roles; all untrusted output is schema-checked here. */
export async function orchestrateResumeGeneration(
  input: ResumeGenerationOrchestrationInput,
  runStage: ResumeGenerationStageRunner,
): Promise<OrchestratedResume> {
  const editable = input.baseline.sections
    .map((section, sectionIndex) => ({ section, sectionIndex }))
    .filter(({ section }) => workHeading(section.heading));
  const editableSlots = new Set(
    editable.map(({ sectionIndex }) => sectionIndex),
  );
  const analyst = parseFindings(
    await runStage(
      resumeEvidenceAnalystInstruction,
      {
        evidence: input.evidence,
        candidateClarifications: input.candidateClarifications,
        documentation: input.documentation,
        projectIdentities: input.projectIdentities,
        responseShape: {
          findings: [
            { evidenceIndexes: [0], clarificationIndexes: [], fact: "string" },
          ],
          unknowns: ["string"],
        },
      },
      900,
    ),
    input.evidence,
    input.candidateClarifications,
  );
  const strategist = parseStrategy(
    await runStage(
      resumeStrategistInstruction,
      {
        editableSlots: editable.map(({ section, sectionIndex }) => ({
          sectionIndex,
          heading: section.heading,
          maximumCharacters: 2_000,
        })),
        findings: analyst.findings,
        profile: input.profile,
        opportunity: input.opportunity,
        request: input.request,
        responseShape: {
          slots: [{ sectionIndex: 0, findingIndexes: [0] }],
          unknowns: ["string"],
        },
      },
      700,
    ),
    editableSlots,
    analyst.findings,
  );
  const writer = parseWriter(
    await runStage(
      resumeWriterInstruction,
      {
        plannedSlots: strategist.slots,
        findings: analyst.findings,
        evidence: input.evidence,
        candidateClarifications: input.candidateClarifications,
        projectIdentities: input.projectIdentities,
        projectEntryLimits: {
          maximumEntries: 4,
          descriptorMaximumWords: 12,
          maximumBulletsPerEntry: 3,
          maximumWordsPerBullet: 30,
        },
        responseShape: {
          edits: [
            {
              sectionIndex: 0,
              text: "string",
              claims: [
                {
                  text: "string",
                  evidenceIndexes: [0],
                  clarificationIndexes: [],
                },
              ],
            },
          ],
          unknowns: ["string"],
        },
      },
      1_200,
    ),
    new Set(strategist.slots.map((slot) => slot.sectionIndex)),
    new Set(
      editable
        .filter(({ section }) => /project/i.test(section.heading))
        .map(({ sectionIndex }) => sectionIndex),
    ),
    input.projectIdentities,
    input.evidence,
    input.candidateClarifications,
  );
  const editBySection = new Map(
    writer.edits.map((edit) => [edit.sectionIndex, edit]),
  );
  const response: OrchestratedResume = {
    schemaVersion: 1,
    selectionEcho: input.selectionEcho,
    sections: input.baseline.sections.map((section, sectionIndex) => ({
      heading: section.heading,
      text: editBySection.get(sectionIndex)?.text ?? section.existingDetail,
    })),
    claims: writer.edits.flatMap((edit) => edit.claims),
    unknowns: [
      ...new Set([
        ...analyst.unknowns,
        ...strategist.unknowns,
        ...writer.unknowns,
      ]),
    ].slice(0, 12),
  };
  const review = parseReview(
    await runStage(
      resumeIntegrityReviewerInstruction,
      {
        requiredSectionSequence: input.baseline.sections.map(
          (section) => section.heading,
        ),
        sections: response.sections.map((section, sectionIndex) => ({
          ...section,
          immutable: !editableSlots.has(sectionIndex),
        })),
        claims: response.claims,
        unknowns: response.unknowns,
        responseShape: { verdict: "accept", reasons: [] },
      },
      350,
    ),
  );
  const retainedEditableBaseline = input.baseline.sections.some(
    (section, sectionIndex) =>
      editableSlots.has(sectionIndex) &&
      response.sections[sectionIndex]?.text === section.existingDetail,
  );
  // The host has already proven section order, immutable preservation, and
  // exact visible-bullet-to-claim coverage. A model-only report of either
  // verified condition is advisory; provenance uncertainty remains blocking.
  const reasonsAlreadyVerifiedByHost = review.reasons.every(
    (reason) =>
      (retainedEditableBaseline &&
        reason === "incomplete-editable-section-content") ||
      /^uncited-bullet(?:-|$)/.test(reason),
  );
  if (review.verdict !== "accept" && !reasonsAlreadyVerifiedByHost)
    throw new Error("integrity reviewer rejected resume");
  return response;
}
