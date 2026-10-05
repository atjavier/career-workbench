import { createHash } from "node:crypto";

import { createAuditEvent, createUuidV7 } from "@/audit/audit-event";
import { captureOpportunityDraft } from "@/domain/opportunities/capture-draft";
import { WorkspaceError } from "@/domain/workspace/types";
import { resolveAppDataPaths } from "@/files/app-data";
import { applyMigrations, openDatabase } from "@/persistence/database";
import {
  findCapturedOpportunityByDuplicateKey,
  insertCapturedOpportunity,
  insertCapturedRevision,
  insertDuplicateSuggestion,
  listCapturedOpportunities as storedOpportunities,
  listCapturedRevisions,
  parseStoredRequirements,
} from "@/persistence/captured-opportunities-repository";
import { refineOpportunityDescription } from "./refined-description";
import { deleteOpportunityRecords, drainOpportunityFileCleanup } from "./opportunity-material-cleanup";
import { appendAuditEvent } from "@/persistence/workspace-repository";

type Options = { appDataRoot?: string };
export type ConfirmCapturedOpportunityInput = Options & {
  postingUrl: unknown;
  copiedDescription: unknown;
  refinedDescription?: unknown;
  capturedAt: unknown;
  title: unknown;
  company: unknown;
  location: unknown;
  workStyle: unknown;
  requirements: unknown;
  postedAt: unknown;
};
export type CapturedOpportunity = {
  id: string;
  title: string;
  company: string;
  location: string;
  workStyle: string;
  requirements: string[];
  postedAt: string;
  capturedAt: string;
  revisions: Array<{
    id: string;
    originalUrl: string;
    copiedDescription: string;
    contentDigest: string;
  }>;
};
export type CapturedOpportunityLibraryItem = {
  id: string;
  revisionId: string;
  title: string;
  company: string;
  location: string;
  workStyle: string;
  postedAt: string;
  capturedAt: string;
  originalUrl: string;
};
const digest = (value: unknown) =>
  `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
const normalize = (
  value: unknown,
  field: string,
  code:
    | "OPPORTUNITY_TITLE_INVALID"
    | "OPPORTUNITY_COMPANY_INVALID"
    | "OPPORTUNITY_LOCATION_INVALID"
    | "OPPORTUNITY_WORK_STYLE_INVALID"
    | "OPPORTUNITY_POSTED_DATE_INVALID",
  max: number,
) => {
  if (typeof value !== "string")
    throw new WorkspaceError(
      code,
      `Enter a valid ${field}.`,
      `Correct the ${field} and confirm again.`,
    );
  const result = value.replace(/\s+/g, " ").trim();
  if (!result || result.length > max)
    throw new WorkspaceError(
      code,
      `Enter a valid ${field}.`,
      `Correct the ${field} and confirm again.`,
    );
  return result;
};
function captureTimestamp(value: unknown) {
  if (
    typeof value !== "string" ||
    Number.isNaN(new Date(value).getTime()) ||
    new Date(value).toISOString() !== value
  )
    throw new WorkspaceError(
      "OPPORTUNITY_CAPTURE_INVALID",
      "The local capture needs to be reviewed again.",
      "Review the copied role details again before confirming.",
    );
  return value;
}
function values(input: ConfirmCapturedOpportunityInput) {
  const refinedDescription = input.refinedDescription === undefined || input.refinedDescription === "" ? undefined : input.refinedDescription;
  if (refinedDescription !== undefined && (typeof refinedDescription !== "string" || refinedDescription.length > 500_000 || !refinedDescription.trim() || /[\u0000\u007f-\u009f]/.test(refinedDescription))) throw new WorkspaceError("OPPORTUNITY_DRAFT_INVALID", "Check the formatted job description.", "Use up to 500,000 characters of reviewed job details.");
  const draft = captureOpportunityDraft({
    postingUrl: input.postingUrl,
    copiedDescription: input.copiedDescription,
  });
  const capturedAt = captureTimestamp(input.capturedAt);
  const title = normalize(
    input.title,
    "title",
    "OPPORTUNITY_TITLE_INVALID",
    300,
  );
  const company = normalize(
    input.company,
    "company",
    "OPPORTUNITY_COMPANY_INVALID",
    300,
  );
  const location = normalize(
    input.location,
    "location",
    "OPPORTUNITY_LOCATION_INVALID",
    300,
  );
  const workStyle = normalize(
    input.workStyle,
    "work style",
    "OPPORTUNITY_WORK_STYLE_INVALID",
    120,
  );
  const requirements =
    typeof input.requirements === "string"
      ? input.requirements
          .split(/\r?\n/)
          .map((value) => value.replace(/\s+/g, " ").trim())
          .filter(Boolean)
      : [];
  const serializedRequirements = JSON.stringify(requirements);
  if (
    requirements.length < 1 ||
    requirements.length > 20 ||
    requirements.some((value) => value.length > 1000) ||
    serializedRequirements.length > 20000
  )
    throw new WorkspaceError(
      "OPPORTUNITY_REQUIREMENTS_INVALID",
      "Enter up to 20 plain-text requirements.",
      "Correct the requirements and confirm again.",
    );
  const rawDate = normalize(
    input.postedAt,
    "posted date",
    "OPPORTUNITY_POSTED_DATE_INVALID",
    40,
  );
  const postedAt =
    rawDate === "Unknown"
      ? rawDate
      : (() => {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(rawDate))
            throw new WorkspaceError(
              "OPPORTUNITY_POSTED_DATE_INVALID",
              "Enter a valid posted date or Unknown.",
              "Correct the posted date and confirm again.",
            );
          const date = new Date(`${rawDate}T00:00:00.000Z`);
          if (
            Number.isNaN(date.getTime()) ||
            date.toISOString().slice(0, 10) !== rawDate
          )
            throw new WorkspaceError(
              "OPPORTUNITY_POSTED_DATE_INVALID",
              "Enter a valid posted date or Unknown.",
              "Correct the posted date and confirm again.",
            );
          return date.toISOString();
        })();
  return {
    ...draft,
    refinedDescription: refinedDescription as string | undefined,
    postingUrl: draft.postingUrl,
    copiedDescription: input.copiedDescription as string,
    capturedAt,
    title,
    company,
    location,
    workStyle,
    requirements,
    serializedRequirements,
    postedAt,
    duplicateKey: `${title.toLocaleLowerCase()}|${company.toLocaleLowerCase()}`,
  };
}
function projection(db: ReturnType<typeof openDatabase>): {
  opportunities: CapturedOpportunity[];
} {
  try {
    return {
      opportunities: storedOpportunities(db).map((opportunity) => {
        const revisions = listCapturedRevisions(db, opportunity.id);
        const latest = revisions.at(-1);
        if (!latest) throw new Error("missing revision");
        return {
          id: opportunity.id,
          title: latest.title,
          company: latest.company,
          location: latest.location,
          workStyle: latest.workStyle,
          requirements: parseStoredRequirements(latest.requirements),
          postedAt: latest.postedAt,
          capturedAt: latest.capturedAt,
          revisions: revisions.map((revision) => ({
            id: revision.id,
            originalUrl: revision.originalUrl,
            copiedDescription: revision.copiedDescription,
            contentDigest: revision.contentDigest,
          })),
        };
      }),
    };
  } catch {
    throw new WorkspaceError(
      "OPPORTUNITY_STORED_INVALID",
      "A saved opportunity cannot be read safely.",
      "Check local workspace storage, then try again.",
    );
  }
}
function libraryProjection(db: ReturnType<typeof openDatabase>): {
  opportunities: CapturedOpportunityLibraryItem[];
} {
  const captured = projection(db).opportunities;
  return {
    opportunities: captured.map(
      ({
        id,
        title,
        company,
        location,
        workStyle,
        postedAt,
        capturedAt,
        revisions,
      }) => {
        const latest = revisions.at(-1);
        if (!latest) throw new Error("missing revision");
        return {
          id,
          revisionId: latest.id,
          title,
          company,
          location,
          workStyle,
          postedAt,
          capturedAt,
          originalUrl: latest.originalUrl,
        };
      },
    ),
  };
}
export async function listCapturedOpportunities(options: Options = {}) {
  const paths = await resolveAppDataPaths(options.appDataRoot);
  const db = openDatabase(paths.databasePath);
  try {
    applyMigrations(db);
    await drainOpportunityFileCleanup(paths.root, paths.databasePath);
    return libraryProjection(db);
  } finally {
    db.close();
  }
}
export async function confirmCapturedOpportunity(
  input: ConfirmCapturedOpportunityInput,
): Promise<{
  opportunity: CapturedOpportunity;
  probableDuplicate?: Pick<
    CapturedOpportunity,
    "title" | "company" | "capturedAt"
  >;
}> {
  const item = values(input);
  const paths = await resolveAppDataPaths(input.appDataRoot);
  const db = openDatabase(paths.databasePath);
  try {
    applyMigrations(db);
    db.exec("BEGIN IMMEDIATE;");
    try {
      const now = new Date().toISOString();
      const opportunityId = createUuidV7();
      const revisionId = createUuidV7();
      const existing = findCapturedOpportunityByDuplicateKey(
        db,
        item.duplicateKey,
      );
      const existingRevision = existing
        ? listCapturedRevisions(db, existing.id).at(-1)
        : undefined;
      if (existing && !existingRevision)
        throw new WorkspaceError(
          "OPPORTUNITY_STORED_INVALID",
          "A saved opportunity cannot be read safely.",
          "Check local workspace storage, then try again.",
        );
      const revisionDigest = digest({
        opportunityId,
        capturedAt: item.capturedAt,
        originalUrl: item.postingUrl,
        copiedDescription: item.copiedDescription,
        refinedDescription: item.refinedDescription,
        title: item.title,
        company: item.company,
        location: item.location,
        workStyle: item.workStyle,
        requirements: item.requirements,
        postedAt: item.postedAt,
      });
      insertCapturedOpportunity(db, {
        id: opportunityId,
        duplicateKey: item.duplicateKey,
        createdAt: now,
      });
      insertCapturedRevision(db, {
        id: revisionId,
        opportunityId,
        capturedAt: item.capturedAt,
        originalUrl: item.postingUrl,
        copiedDescription: item.copiedDescription,
        title: item.title,
        company: item.company,
        location: item.location,
        workStyle: item.workStyle,
        requirements: item.serializedRequirements,
        postedAt: item.postedAt,
        contentDigest: revisionDigest,
        createdAt: now,
      });
      if (item.refinedDescription) db.prepare("INSERT INTO opportunity_revision_descriptions(revision_id, refined_description) VALUES (?, ?)").run(revisionId, item.refinedDescription);
      if (existing)
        insertDuplicateSuggestion(db, {
          id: createUuidV7(),
          opportunityId,
          probableDuplicateOpportunityId: existing.id,
          createdAt: now,
          contentDigest: digest({
            opportunityId,
            probableDuplicateOpportunityId: existing.id,
          }),
        });
      appendAuditEvent(
        db,
        createAuditEvent({
          actor: "local-os-user",
          action: "opportunity.captured",
          outcome: "success",
          entityId: opportunityId,
          contentHash: digest({
            opportunityId,
            revisionId,
            capturedAt: item.capturedAt,
          }),
        }),
      );
      db.exec("COMMIT;");
      const opportunity = projection(db).opportunities.find(
        (candidate) => candidate.id === opportunityId,
      )!;
      return {
        opportunity,
        probableDuplicate: existingRevision
          ? {
              title: existingRevision.title,
              company: existingRevision.company,
              capturedAt: existingRevision.capturedAt,
            }
          : undefined,
      };
    } catch (error) {
      db.exec("ROLLBACK;");
      throw error;
    }
  } finally {
    db.close();
  }
}

export type OpportunityDetails = CapturedOpportunityLibraryItem & {
  requirements: string[];
  copiedDescription: string;
  refinedDescription?: string;
  contentDigest: string;
  hasTailoredResume: boolean;
  tailoredResumeStale: boolean;
};
function requireLatest(db: ReturnType<typeof openDatabase>, id: string, expected?: string) {
  const revision = listCapturedRevisions(db, id).at(-1);
  if (!revision) throw new WorkspaceError("OPPORTUNITY_NOT_FOUND", "That opportunity is no longer available.", "Return to All Opportunities.");
  if (expected !== undefined && revision.id !== expected)
    throw new WorkspaceError("OPPORTUNITY_STALE", "This opportunity changed before your request was saved.", "Refresh the opportunity and review the latest details.");
  return revision;
}
export async function readOpportunityDetails(id: string, options: Options = {}): Promise<OpportunityDetails | undefined> {
  const paths = await resolveAppDataPaths(options.appDataRoot);
  const db = openDatabase(paths.databasePath);
  try {
    applyMigrations(db);
    const latest = listCapturedRevisions(db, id).at(-1);
    if (!latest) return undefined;
    const tailored = db.prepare("SELECT opportunity_revision_id FROM opportunity_tailored_resumes WHERE opportunity_id = ?").get(id) as { opportunity_revision_id: string } | undefined;
    return {
      id, revisionId: latest.id, title: latest.title, company: latest.company,
      location: latest.location, workStyle: latest.workStyle, postedAt: latest.postedAt,
      capturedAt: latest.capturedAt, originalUrl: latest.originalUrl,
      requirements: parseStoredRequirements(latest.requirements), copiedDescription: latest.copiedDescription,
      refinedDescription: (db.prepare("SELECT refined_description AS text FROM opportunity_revision_descriptions WHERE revision_id = ?").get(latest.id) as { text: string } | undefined)?.text,
      contentDigest: latest.contentDigest, hasTailoredResume: Boolean(tailored),
      tailoredResumeStale: Boolean(tailored && tailored.opportunity_revision_id !== latest.id),
    };
  } finally { db.close(); }
}
export async function readOpportunityDuplicate(id: string, options: Options = {}) {
  const paths = await resolveAppDataPaths(options.appDataRoot);
  const db = openDatabase(paths.databasePath);
  try {
    applyMigrations(db);
    const suggestion = db.prepare("SELECT probable_duplicate_opportunity_id AS id FROM captured_opportunity_duplicate_suggestions WHERE opportunity_id = ? ORDER BY created_at DESC, id DESC LIMIT 1").get(id) as { id: string } | undefined;
    if (!suggestion) return undefined;
    const latest = listCapturedRevisions(db, suggestion.id).at(-1);
    return latest ? { id: suggestion.id, title: latest.title, company: latest.company } : undefined;
  } finally { db.close(); }
}
export async function updateCapturedOpportunity(input: ConfirmCapturedOpportunityInput & {
  opportunityId: string; expectedRevisionId: string;
}) {
  const item = values(input);
  const paths = await resolveAppDataPaths(input.appDataRoot);
  const db = openDatabase(paths.databasePath);
  try {
    applyMigrations(db);
    db.exec("BEGIN IMMEDIATE");
    try {
      const previous = requireLatest(db, input.opportunityId, input.expectedRevisionId);
      // The transaction serializes edits; preserve write order even if the clock
      // stalls or moves backwards. UUID v7's random suffix cannot order ties.
      const now = new Date(Math.max(Date.now(), Date.parse(previous.createdAt) + 1)).toISOString();
      const revisionId = createUuidV7();
      const previousFormatted = (db.prepare("SELECT refined_description AS text FROM opportunity_revision_descriptions WHERE revision_id = ?").get(previous.id) as {text:string} | undefined)?.text;
      const sameText = (left: string | undefined, right: string | undefined) => left?.replace(/\r\n?/g, "\n") === right?.replace(/\r\n?/g, "\n");
      const sourceChanged = !sameText(item.copiedDescription, previous.copiedDescription);
      if (!sourceChanged) item.copiedDescription = previous.copiedDescription;
      const unchangedFormatting = input.refinedDescription === undefined || sameText(item.refinedDescription, previousFormatted ?? previous.copiedDescription);
      const duplicateLegacy = !previousFormatted && !sourceChanged && sameText(item.refinedDescription, previous.copiedDescription);
      const formatted = duplicateLegacy ? undefined : sourceChanged && unchangedFormatting ? refineOpportunityDescription({}, item.copiedDescription) : input.refinedDescription === "" ? undefined : item.refinedDescription ?? previousFormatted;
      insertCapturedRevision(db, {
        id: revisionId, opportunityId: input.opportunityId, capturedAt: previous.capturedAt,
        originalUrl: item.postingUrl, copiedDescription: item.copiedDescription,
        title: item.title, company: item.company, location: item.location, workStyle: item.workStyle,
        requirements: item.serializedRequirements, postedAt: item.postedAt,
        contentDigest: digest({ opportunityId: input.opportunityId, ...item, refinedDescription: formatted, capturedAt: previous.capturedAt }), createdAt: now,
      });
      if (formatted) db.prepare("INSERT INTO opportunity_revision_descriptions(revision_id, refined_description) VALUES (?, ?)").run(revisionId, formatted);
      appendAuditEvent(db, createAuditEvent({ actor: "local-os-user", action: "opportunity.updated", outcome: "success", entityId: input.opportunityId, contentHash: digest({ revisionId }) }));
      db.exec("COMMIT");
      return { revisionId, refinedDescription: formatted };
    } catch (error) { db.exec("ROLLBACK"); throw error; }
  } finally { db.close(); }
}
export async function deleteCapturedOpportunity(input: Options & {
  opportunityId: string; expectedRevisionId: string; confirmation: string;
}) {
  if (input.confirmation !== "DELETE")
    throw new WorkspaceError("OPPORTUNITY_DELETE_CONFIRMATION", "Confirm permanent deletion of this opportunity and its attached resume.", "Review the deletion dialog and select Delete opportunity to continue.");
  const paths = await resolveAppDataPaths(input.appDataRoot);
  const db = openDatabase(paths.databasePath);
  try {
    applyMigrations(db);
    db.exec("BEGIN IMMEDIATE");
    try {
      requireLatest(db, input.opportunityId, input.expectedRevisionId);
      deleteOpportunityRecords(db, input.opportunityId);
      appendAuditEvent(db, createAuditEvent({ actor: "local-os-user", action: "opportunity.deleted", outcome: "success", entityId: input.opportunityId, contentHash: digest({ opportunityId: input.opportunityId }) }));
      db.exec("COMMIT");
    } catch (error) { db.exec("ROLLBACK"); throw error; }
  } finally { db.close(); }
  return drainOpportunityFileCleanup(paths.root, paths.databasePath);
}
