import { createHash } from "node:crypto";
import { basename } from "node:path";
import {
  parseResumePdf,
  validateResumeDraftContent,
  type ResumeDraftContent,
} from "@/adapters/resume-parser/pdf-text-parser";
import { createAuditEvent, createUuidV7 } from "@/audit/audit-event";
import {
  cleanupCurrentBaseResume,
  readRetainedCurrentBaseResumePdf,
  stageCurrentBaseResume,
} from "@/files/current-base-resume";
import { resolveAppDataPaths } from "@/files/app-data";
import { listApprovedEvidence } from "@/persistence/evidence-repository";
import { WorkspaceError } from "@/domain/workspace/types";
import { applyMigrations, openDatabase } from "@/persistence/database";
import { appendAuditEvent } from "@/persistence/workspace-repository";
import {
  appendProposalDecision,
  currentDraft,
  findDraft,
  findSourceByDigest,
  insertDraft,
  insertProposal,
  insertSource,
  insertVersion,
  latestDraftForSource,
  listProposals,
  listSources,
  listVersions,
  type CurrentBaseResumeDraft,
  type CurrentBaseResumeProposal,
  type CurrentBaseResumeSource,
  type CurrentBaseResumeVersion,
} from "@/persistence/current-base-resume-repository";

type Options = { appDataRoot?: string };
const digest = (value: Uint8Array | string) =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;
const safeFilename = (name: string) =>
  basename(name) === name &&
  name.toLowerCase().endsWith(".pdf") &&
  !/[\u0000-\u001f]/.test(name) &&
  name.length <= 255;
function contentDigest(content: ResumeDraftContent): string {
  return digest(JSON.stringify(content));
}
function audit(
  db: ReturnType<typeof openDatabase>,
  action: Parameters<typeof createAuditEvent>[0]["action"],
  outcome: "success" | "failure",
  id?: string,
  hash?: string,
) {
  appendAuditEvent(
    db,
    createAuditEvent({
      actor: "local-os-user",
      action,
      outcome,
      entityId: id,
      contentHash: hash,
    }),
  );
}
function transaction<T>(
  root: string,
  work: (db: ReturnType<typeof openDatabase>) => T,
): T {
  const db = openDatabase(`${root}/workspace.sqlite`);
  try {
    applyMigrations(db);
    db.exec("BEGIN IMMEDIATE;");
    try {
      const result = work(db);
      db.exec("COMMIT;");
      return result;
    } catch (error) {
      db.exec("ROLLBACK;");
      throw error;
    }
  } finally {
    db.close();
  }
}
function legacyWritesAreHistoryOnly(): never {
  throw new WorkspaceError(
    "CURRENT_BASE_RESUME_HISTORY_ONLY",
    "Current Base Resume is retained as read-only history.",
    "Use the Profile-led Resume workspace for new resume details.",
  );
}

export async function importCurrentBaseResume(
  input: Options & { filename: string; bytes: Uint8Array },
): Promise<{ source: CurrentBaseResumeSource; draft: CurrentBaseResumeDraft }> {
  legacyWritesAreHistoryOnly();
  const paths = await resolveAppDataPaths(input.appDataRoot);
  const hash = digest(input.bytes);
  const id = createUuidV7();
  let final: string | undefined;
  try {
    if (!safeFilename(input.filename))
      throw new WorkspaceError(
        "CURRENT_BASE_RESUME_INVALID",
        "The selected file is not a resume PDF.",
        "Choose one text-readable PDF and try again.",
      );
    const parsed = await parseResumePdf(input.bytes);
    const existing = transaction(paths.root, (db) =>
      findSourceByDigest(db, hash),
    );
    if (existing)
      throw new WorkspaceError(
        "CURRENT_BASE_RESUME_DUPLICATE",
        "That PDF has already been imported.",
        "Review the existing Current Base Resume or choose a different PDF.",
      );
    const copied = await stageCurrentBaseResume(
      input.appDataRoot,
      id,
      input.filename,
      input.bytes,
    );
    final = copied.final;
    const now = new Date().toISOString();
    const source: CurrentBaseResumeSource = {
      id,
      filename: input.filename,
      contentDigest: hash,
      byteSize: input.bytes.byteLength,
      storageLocation: copied.storageLocation,
      importedAt: now,
    };
    const draft: CurrentBaseResumeDraft = {
      id: createUuidV7(),
      sourceId: id,
      revisionNumber: 1,
      content: parsed,
      contentDigest: contentDigest(parsed),
      createdAt: now,
    };
    transaction(paths.root, (db) => {
      insertSource(db, source);
      insertDraft(db, draft);
      audit(db, "current_base_resume.imported", "success", id, hash);
    });
    return { source, draft };
  } catch (error) {
    await cleanupCurrentBaseResume(final).catch(() => undefined);
    try {
      transaction(paths.root, (db) =>
        audit(
          db,
          "current_base_resume.import_failed",
          "failure",
          undefined,
          hash,
        ),
      );
    } catch {
      /* metadata-only best effort */
    }
    throw error;
  }
}
export async function saveCurrentBaseResumeDraft(
  _input: Options & { draftId: string; content: ResumeDraftContent },
): Promise<CurrentBaseResumeDraft> {
  return legacyWritesAreHistoryOnly();
}
export async function generateCurrentBaseResumeProposals(
  _input: Options & { draftId: string },
): Promise<CurrentBaseResumeProposal[]> {
  return legacyWritesAreHistoryOnly();
}
export async function resolveCurrentBaseResumeProposal(
  _input: Options & {
    proposalId: string;
    expectedDecisionRevisionId: string;
    decision: "approved" | "edited" | "rejected";
    text?: string;
  },
): Promise<void> {
  return legacyWritesAreHistoryOnly();
}
export async function approveCurrentBaseResumeVersion(
  _input: Options & { draftId: string; explicitApproval: boolean },
): Promise<CurrentBaseResumeVersion> {
  return legacyWritesAreHistoryOnly();
}
export async function listCurrentBaseResume(
  input: Options = {},
): Promise<{
  sources: CurrentBaseResumeSource[];
  draft?: CurrentBaseResumeDraft;
  proposals: CurrentBaseResumeProposal[];
  versions: CurrentBaseResumeVersion[];
}> {
  const paths = await resolveAppDataPaths(input.appDataRoot);
  return transaction(paths.root, (db) => {
    const draft = currentDraft(db);
    return {
      sources: listSources(db),
      draft,
      proposals: draft ? listProposals(db, draft.id) : [],
      versions: listVersions(db),
    };
  });
}

export async function readCurrentBaseResumePdf(
  input: Options & { sourceId: string },
): Promise<Uint8Array | undefined> {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      input.sourceId,
    )
  )
    return undefined;

  try {
    const paths = await resolveAppDataPaths(input.appDataRoot);
    const source = transaction(paths.root, (db) => {
      const draft = currentDraft(db);
      return draft?.sourceId === input.sourceId
        ? listSources(db).find((item) => item.id === input.sourceId)
        : undefined;
    });
    if (!source) return undefined;
    const bytes = await readRetainedCurrentBaseResumePdf(paths.root, source);
    if (
      !bytes ||
      bytes.byteLength !== source.byteSize ||
      digest(bytes) !== source.contentDigest
    )
      return undefined;
    return transaction(
      paths.root,
      (db) => currentDraft(db)?.sourceId === source.id,
    )
      ? bytes
      : undefined;
  } catch {
    return undefined;
  }
}
