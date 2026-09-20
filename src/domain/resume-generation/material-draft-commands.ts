import { createHash } from "node:crypto";

import { localModelCapabilityVersion } from "@/adapters/local-model/local-model-gateway";
import { createAuditEvent, createUuidV7 } from "@/audit/audit-event";
import { WorkspaceError } from "@/domain/workspace/types";
import { resolveAppDataPaths } from "@/files/app-data";
import { applyMigrations, openDatabase } from "@/persistence/database";
import {
  findMaterialDraftRead,
  insertMaterialDraftHandoff,
  type StoredMaterialDraftRead,
} from "@/persistence/material-draft-repository";
import {
  readActiveResumeWorkspace,
  workspaceOwnsDraft,
} from "@/persistence/resume-workspace-repository";
import { appendAuditEvent } from "@/persistence/workspace-repository";

type Options = { appDataRoot?: string };
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

const uuidV7 = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
const digest = (value: string) => /^sha256:[0-9a-f]{64}$/i.test(value);
const hash = (value: unknown) =>
  `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
const plain = (value: unknown, maximum: number) =>
  typeof value === "string" &&
  value.length > 0 &&
  value.length <= maximum &&
  !/[\u0000-\u001f\u007f-\u009f]/.test(value);
const exactKeys = (value: Record<string, unknown>, keys: string[]) =>
  Object.keys(value).every((key) => keys.includes(key)) &&
  keys.every((key) => key in value);
const supports = (claim: string, source: string) => {
  const words = (value: string) =>
    new Set(value.toLocaleLowerCase().match(/[a-z0-9]{3,}/g) ?? []);
  const claimWords = words(claim);
  return [...claimWords].filter((word) => words(source).has(word)).length >= 2;
};
// Resume sections intentionally preserve line breaks: the composer uses them
// for contact details, role metadata, and bullets. These are content, not a
// malformed control sequence; reject the remaining non-printing controls.
const textBlock = (value: unknown, maximum: number) =>
  typeof value === "string" &&
  value.length <= maximum &&
  !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/.test(value);
// Keep draft reads aligned with the Resume Coach/documentation contract. A
// brownfield source tree can legitimately produce up to the 2,000 findings
// accepted by the workspace import and coach request paths.
const maxResumeCoachEvidence = 2_000;
const invalid = (
  summary = "That material draft is unavailable.",
  next = "Return to Resume and generate local guidance again.",
): never => {
  throw new WorkspaceError("MATERIAL_DRAFT_INVALID", summary, next);
};

function parseStoredDraft(row: StoredMaterialDraftRead): MaterialDraftView {
  const selectedEvidenceIds = new Set(row.evidence.map((item) => item.id));
  const invalidClaims = row.claims.some(
    (claim, ordinal) =>
      !uuidV7(claim.id) ||
      claim.ordinal !== ordinal ||
      !plain(claim.text, 1_000) ||
      claim.evidence.length > maxResumeCoachEvidence ||
      claim.evidence.some(
        (item) =>
          !uuidV7(item.id) ||
          !selectedEvidenceIds.has(item.id) ||
          !plain(item.label, 600),
      ),
  );
  if (
    !uuidV7(row.id) ||
    !uuidV7(row.profileRevisionId) ||
    !digest(row.profileDigest) ||
    !uuidV7(row.templateId) ||
    !digest(row.templateDigest) ||
    (row.opportunityRevisionId === undefined) !==
      (row.opportunityDigest === undefined) ||
    (row.opportunityRevisionId !== undefined &&
      (!row.opportunityResolved ||
        !uuidV7(row.opportunityRevisionId) ||
        !digest(row.opportunityDigest!))) ||
    !digest(row.contentDigest) ||
    !digest(row.provenanceDigest) ||
    !plain(row.templateFilename, 255) ||
    !row.evidence.length ||
    row.evidence.length > maxResumeCoachEvidence ||
    row.evidence.some(
      (item) =>
        !uuidV7(item.id) ||
        !digest(item.contentDigest) ||
        !plain(item.label, 600),
    ) ||
    row.claims.length > 20 ||
    invalidClaims ||
    hash(row.contentJson) !== row.contentDigest
  )
    invalid();
  let response: unknown;
  try {
    response = JSON.parse(row.contentJson);
  } catch {
    invalid();
  }
  if (!response || typeof response !== "object" || Array.isArray(response))
    invalid();
  const value = response as {
    schemaVersion?: unknown;
    selectionEcho?: unknown;
    sections?: unknown;
    claims?: unknown;
    candidateClarifications?: unknown;
    unknowns?: unknown;
  };
  const sectionsInput = value.sections;
  const claimsInput = value.claims;
  const candidateClarificationsInput = value.candidateClarifications ?? [];
  const unknownsInput = value.unknowns;
  if (
    value.schemaVersion !== 1 ||
    !digest(String(value.selectionEcho ?? "")) ||
    row.provenanceDigest !==
      hash({
        capability: localModelCapabilityVersion("resume-coach"),
        profile: {
          revisionId: row.profileRevisionId,
          contentDigest: row.profileDigest,
        },
        template: { id: row.templateId, contentDigest: row.templateDigest },
        evidence: row.evidence
          .map(({ id, contentDigest }) => ({ id, contentDigest }))
          .sort((left, right) => left.id.localeCompare(right.id)),
        opportunity: row.opportunityRevisionId
          ? {
              revisionId: row.opportunityRevisionId,
              contentDigest: row.opportunityDigest,
            }
          : null,
        consent: value.selectionEcho,
      })
  )
    return invalid();
  if (
    !Array.isArray(sectionsInput) ||
    !sectionsInput.length ||
    sectionsInput.length > 8
  )
    return invalid();
  if (!Array.isArray(claimsInput) || claimsInput.length !== row.claims.length)
    return invalid();
  if (
    !Array.isArray(candidateClarificationsInput) ||
    candidateClarificationsInput.length > 24
  )
    return invalid();
  const candidateClarifications = candidateClarificationsInput.map((item) => {
    if (
      !item ||
      typeof item !== "object" ||
      Array.isArray(item) ||
      !exactKeys(item as Record<string, unknown>, [
        "itemName",
        "itemCategory",
        "category",
        "text",
        "provenance",
      ]) ||
      !plain((item as { itemName?: unknown }).itemName, 240) ||
      ((item as { itemCategory?: unknown }).itemCategory !== "project" &&
        (item as { itemCategory?: unknown }).itemCategory !== "experience") ||
      !plain((item as { category?: unknown }).category, 120) ||
      !plain((item as { text?: unknown }).text, 2_400) ||
      (item as { provenance?: unknown }).provenance !==
        "candidate_interview_answer"
    )
      invalid();
    return item as MaterialDraftCandidateClarification;
  });
  if (!Array.isArray(unknownsInput) || unknownsInput.length > 12)
    return invalid();
  const sections = sectionsInput.map((item) => {
    if (
      !item ||
      typeof item !== "object" ||
      !plain((item as { heading?: unknown }).heading, 120) ||
      !textBlock((item as { text?: unknown }).text, 2_000)
    )
      invalid();
    return {
      heading: (item as { heading: string }).heading,
      text: (item as { text: string }).text,
    };
  });
  const claims = claimsInput.map((item, ordinal) => {
    if (
      !item ||
      typeof item !== "object" ||
      Array.isArray(item) ||
      !plain((item as { text?: unknown }).text, 1_000) ||
      !Array.isArray((item as { evidenceIndexes?: unknown }).evidenceIndexes) ||
      (!Array.isArray(
        (item as { clarificationIndexes?: unknown }).clarificationIndexes,
      ) &&
        (item as { clarificationIndexes?: unknown }).clarificationIndexes !==
          undefined) ||
      row.claims[ordinal]?.text !== (item as { text: string }).text
    )
      invalid();
    const evidenceIndexes = (item as { evidenceIndexes: unknown[] })
      .evidenceIndexes;
    const clarificationIndexes =
      (item as { clarificationIndexes?: unknown[] }).clarificationIndexes ?? [];
    if (
      (!evidenceIndexes.length && !clarificationIndexes.length) ||
      new Set(evidenceIndexes).size !== evidenceIndexes.length ||
      new Set(clarificationIndexes).size !== clarificationIndexes.length ||
      evidenceIndexes.some(
        (index) =>
          !Number.isInteger(index) ||
          (index as number) < 0 ||
          (index as number) >= row.evidence.length,
      ) ||
      clarificationIndexes.some(
        (index) =>
          !Number.isInteger(index) ||
          (index as number) < 0 ||
          (index as number) >= candidateClarifications.length ||
          !supports(
            (item as { text: string }).text,
            candidateClarifications[index as number]!.text,
          ),
      ) ||
      row.claims[ordinal]!.evidence.length !== evidenceIndexes.length
    )
      invalid();
    const fileCitations =
      (item as { fileCitations?: unknown }).fileCitations ?? [];
    if (
      !Array.isArray(fileCitations) ||
      fileCitations.length > 12 ||
      fileCitations.some(
        (citation) =>
          !citation ||
          typeof citation !== "object" ||
          Array.isArray(citation) ||
          !exactKeys(citation as Record<string, unknown>, [
            "citationId",
            "path",
            "startLine",
            "endLine",
            "contentDigest",
          ]) ||
          !plain((citation as { path?: unknown }).path, 600) ||
          !Number.isInteger((citation as { startLine?: unknown }).startLine) ||
          !Number.isInteger((citation as { endLine?: unknown }).endLine) ||
          (citation as { startLine: number }).startLine < 1 ||
          (citation as { endLine: number }).endLine <
            (citation as { startLine: number }).startLine ||
          !digest(
            String(
              (citation as { contentDigest?: unknown }).contentDigest ?? "",
            ),
          ),
      )
    )
      invalid();
    const validatedFileCitations = fileCitations as Array<{
      path: string;
      startLine: number;
      endLine: number;
      contentDigest: string;
    }>;
    return {
      text: row.claims[ordinal]!.text,
      evidence: row.claims[ordinal]!.evidence.map((evidence) => evidence.label),
      candidateClarifications: clarificationIndexes.map(
        (index) => candidateClarifications[index as number]!,
      ),
      fileCitations: validatedFileCitations.map(
        ({ path, startLine, endLine, contentDigest }) => ({
          path,
          startLine,
          endLine,
          contentDigest,
        }),
      ),
    };
  });
  if (unknownsInput.some((item) => !plain(item, 500))) invalid();
  if (
    row.handedOffAt !== undefined &&
    Number.isNaN(new Date(row.handedOffAt).getTime())
  )
    invalid();
  let candidateProfile: MaterialDraftCandidateProfile | undefined;
  if (row.candidateProfileJson) {
    try {
      const parsed = JSON.parse(row.candidateProfileJson);
      if (parsed && typeof parsed === "object")
        candidateProfile = parsed as MaterialDraftCandidateProfile;
    } catch {
      /* Safe fallback if json unparseable */
    }
  }
  const candidateName = candidateProfile
    ? [
        candidateProfile.firstName,
        candidateProfile.middleName,
        candidateProfile.lastName,
      ]
        .filter(Boolean)
        .join(" ")
    : undefined;
  return {
    id: row.id,
    profileLabel: candidateName || "Saved Candidate Profile",
    candidateProfile,
    templateLabel: row.templateFilename,
    templateId: row.templateId,
    templateDigest: row.templateDigest,
    opportunityLabel: row.opportunityLabel,
    evidenceLabels: row.evidence.map((item) => item.label),
    sections,
    claims,
    candidateClarifications,
    unknowns: unknownsInput as string[],
    handedOff: row.handedOffAt !== undefined,
  };
}

function load(
  db: ReturnType<typeof openDatabase>,
  draftId: string,
): { stored: StoredMaterialDraftRead; view: MaterialDraftView } {
  const stored = findMaterialDraftRead(db, draftId);
  if (!stored) return invalid();
  return { stored, view: parseStoredDraft(stored) };
}

export async function readMaterialDraft(
  input: Options & { draftId: string; requireHandoff?: boolean },
): Promise<MaterialDraftView> {
  if (!uuidV7(input.draftId)) invalid();
  const paths = await resolveAppDataPaths(input.appDataRoot);
  const db = openDatabase(paths.databasePath);
  // A stored draft can be rendered from its immutable records without a
  // migration or write lock. Keeping reads read-only lets the PDF preview
  // remain available when Windows protects the private app-data directory.
  try {
    const view = load(db, input.draftId).view;
    if (input.requireHandoff && !view.handedOff) invalid();
    return view;
  } catch (error) {
    if (error instanceof WorkspaceError) throw error;
    return invalid();
  } finally {
    db.close();
  }
}

/** Read a draft only when it still belongs to the currently selected resume.
 * This protects a stale PDF iframe or copied route from showing another
 * workspace's private resume after the selector changes. */
export async function readActiveWorkspaceMaterialDraft(
  input: Options & { draftId: string; requireHandoff?: boolean },
): Promise<MaterialDraftView> {
  if (!uuidV7(input.draftId)) invalid();
  const paths = await resolveAppDataPaths(input.appDataRoot);
  const db = openDatabase(paths.databasePath);
  try {
    const workspace = readActiveResumeWorkspace(db).workspace;
    if (!workspace || !workspaceOwnsDraft(db, workspace.id, input.draftId))
      invalid();
    const view = load(db, input.draftId).view;
    if (input.requireHandoff && !view.handedOff) invalid();
    return view;
  } catch (error) {
    if (error instanceof WorkspaceError) throw error;
    return invalid();
  } finally {
    db.close();
  }
}

export async function handOffMaterialDraft(
  input: Options & { draftId: string },
): Promise<MaterialDraftHandoff> {
  if (!uuidV7(input.draftId)) invalid();
  const paths = await resolveAppDataPaths(input.appDataRoot);
  const db = openDatabase(paths.databasePath);
  try {
    applyMigrations(db);
    db.exec("BEGIN IMMEDIATE;");
    try {
      const { stored, view } = load(db, input.draftId);
      if (view.handedOff)
        throw new WorkspaceError(
          "MATERIAL_DRAFT_HANDOFF_DUPLICATE",
          "This material draft is already in review.",
          "Open the existing local review draft instead.",
        );
      const now = new Date().toISOString();
      insertMaterialDraftHandoff(db, {
        id: createUuidV7(),
        draftId: input.draftId,
        createdAt: now,
      });
      appendAuditEvent(
        db,
        createAuditEvent({
          actor: "local-os-user",
          action: "resume.material_draft_handed_off",
          outcome: "success",
          entityId: input.draftId,
          contentHash: stored.contentDigest,
        }),
      );
      db.exec("COMMIT;");
      return { destination: "review" };
    } catch (error) {
      db.exec("ROLLBACK;");
      if (error instanceof WorkspaceError) throw error;
      if (String(error).includes("UNIQUE constraint failed"))
        throw new WorkspaceError(
          "MATERIAL_DRAFT_HANDOFF_DUPLICATE",
          "This material draft is already in review.",
          "Open the existing local review draft instead.",
        );
      return invalid();
    }
  } finally {
    db.close();
  }
}
