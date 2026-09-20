import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, join, relative, resolve } from "node:path";

import { createAuditEvent, createUuidV7 } from "@/audit/audit-event";
import {
  editableTexRevisionConsentFingerprint,
  requestEditableTexRevision,
  type EditableTexArtifact,
  type FetchLike,
} from "@/adapters/local-model/local-model-gateway";
import { readEditableTexModelConfiguration } from "@/domain/resume-generation/local-model-configuration-commands";
import {
  compileRawTexDraftPdf,
  validateRawTexDocument,
} from "@/domain/resume-generation/resume-tex-compiler";
import { WorkspaceError } from "@/domain/workspace/types";
import { readManagedDocumentedArtifacts } from "@/files/evidence-library";
import { resolveAppDataPaths } from "@/files/app-data";
import { applyMigrations, openDatabase } from "@/persistence/database";
import {
  insertTexDraft,
  insertTexDraftRevision,
  readTexDraftRevisionForWorkspace,
  type StoredTexDraft,
} from "@/persistence/tex-draft-repository";
import { readActiveResumeWorkspace } from "@/persistence/resume-workspace-repository";
import { appendAuditEvent } from "@/persistence/workspace-repository";

const digest = (value: string | Uint8Array) =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;
const decoder = new TextDecoder("utf-8", { fatal: true });
const safeName = (value: string) => {
  const name = value.trim().replace(/\s+/g, " ");
  if (!name || name.length > 120 || /[\u0000-\u001f\u007f]/.test(name))
    throw new WorkspaceError(
      "RESUME_COACH_INVALID",
      "Enter a resume name of up to 120 plain-text characters.",
      "Name the editable TeX draft and try again.",
    );
  return name;
};
const inside = (root: string, path: string) => {
  const value = relative(root, path);
  return (
    Boolean(value) &&
    !value.startsWith("..") &&
    !value.includes("..\\") &&
    !value.includes("../")
  );
};
const insideOrEqual = (root: string, path: string) =>
  path === root || inside(root, path);

/** Reject links in every existing private-directory ancestor before file I/O. */
async function assertSafeDirectoryAncestors(
  root: string,
  target: string,
): Promise<void> {
  const resolvedRoot = resolve(root);
  const parent = resolve(target);
  if (!insideOrEqual(resolvedRoot, parent))
    throw new Error("unsafe TeX private path");
  let current = resolvedRoot;
  const rootMetadata = await lstat(current);
  if (!rootMetadata.isDirectory() || rootMetadata.isSymbolicLink())
    throw new Error("unsafe TeX private directory");
  const parts = relative(resolvedRoot, parent).split(/[\\/]/).filter(Boolean);
  for (const [index, part] of parts.entries()) {
    current = join(current, part);
    const metadata = await lstat(current).catch(
      (error: NodeJS.ErrnoException) =>
        error.code === "ENOENT" ? undefined : Promise.reject(error),
    );
    if (!metadata) return;
    if (
      metadata.isSymbolicLink() ||
      (!metadata.isDirectory() && index < parts.length - 1)
    )
      throw new Error("unsafe TeX private directory");
  }
}
async function ensureSafeDirectory(
  root: string,
  directory: string,
): Promise<void> {
  await assertSafeDirectoryAncestors(root, directory);
  await mkdir(directory, { recursive: true });
  await assertSafeDirectoryAncestors(root, directory);
}
async function removeSafeDirectory(
  root: string,
  directory: string,
): Promise<void> {
  await assertSafeDirectoryAncestors(root, directory);
  const metadata = await lstat(directory).catch(
    (error: NodeJS.ErrnoException) =>
      error.code === "ENOENT" ? undefined : Promise.reject(error),
  );
  if (!metadata) return;
  if (!metadata.isDirectory() || metadata.isSymbolicLink())
    throw new Error("unsafe TeX private directory");
  await rm(directory, { recursive: true, force: true });
}

type Baseline = {
  id: string;
  contentDigest: string;
  tex: string;
  bytes: Uint8Array;
};
type Artifact = EditableTexArtifact;
export type EditableTexDraftResult = {
  draftId: string;
  revisionId: string;
  displayName: string;
};
type EditableTexDraftDependencies = { compile?: typeof compileRawTexDraftPdf };

async function verifiedCanonicalBaseline(
  root: string,
  databasePath: string,
): Promise<Baseline> {
  const db = openDatabase(databasePath);
  let record:
    | {
        id: string;
        primary_filename: string;
        primary_digest: string;
        storage_location: string;
      }
    | undefined;
  try {
    applyMigrations(db);
    record = db
      .prepare(
        "SELECT id, primary_filename, primary_digest, storage_location FROM base_resumes ORDER BY imported_at ASC, id ASC LIMIT 1",
      )
      .get() as typeof record;
  } finally {
    db.close();
  }
  if (
    !record ||
    record.storage_location.replaceAll("\\", "/") !==
      `base-resumes/${record.id}/${record.primary_filename}`
  )
    throw new WorkspaceError(
      "RESUME_COACH_INVALID",
      "The immutable resume.tex baseline is unavailable.",
      "Restore the imported resume.tex baseline and try again.",
    );
  const file = resolve(root, record.storage_location);
  try {
    await assertSafeDirectoryAncestors(root, file);
    const [directory, item, bytes] = await Promise.all([
      lstat(join(root, "base-resumes", record.id)),
      lstat(file),
      readFile(file),
    ]);
    if (
      !inside(root, file) ||
      basename(file) !== record.primary_filename ||
      directory.isSymbolicLink() ||
      item.isSymbolicLink() ||
      !directory.isDirectory() ||
      !item.isFile() ||
      digest(bytes) !== record.primary_digest
    )
      throw new Error("unsafe");
    return {
      id: record.id,
      contentDigest: record.primary_digest,
      tex: decoder.decode(bytes),
      bytes: new Uint8Array(bytes),
    };
  } catch {
    throw new WorkspaceError(
      "RESUME_COACH_INVALID",
      "The immutable resume.tex baseline is unavailable.",
      "Restore the imported resume.tex baseline and try again.",
    );
  }
}

async function approvedArtifactSnapshot(input: {
  databasePath: string;
  workspaceId: string;
  workspaceRoot?: string;
}): Promise<Artifact[]> {
  const db = openDatabase(input.databasePath);
  let owned: Array<{ id: string; path: string; digest: string }>;
  try {
    applyMigrations(db);
    owned = db
      .prepare(
        "SELECT d.id, d.library_path AS path, d.content_digest AS digest FROM evidence_library_documents d JOIN evidence_library_imports i ON i.id = d.import_id JOIN resume_workspace_imports w ON w.import_id = i.id WHERE w.workspace_id = ? ORDER BY d.library_path, d.id",
      )
      .all(input.workspaceId) as typeof owned;
  } finally {
    db.close();
  }
  const byPath = new Map(owned.map((item) => [item.path, item]));
  const groups = await readManagedDocumentedArtifacts(input.workspaceRoot);
  const artifacts: Artifact[] = [];
  for (const group of groups) {
    const groupDocuments = group.documents
      .map((document) => byPath.get(document.libraryPath))
      .filter((item): item is { id: string; path: string; digest: string } =>
        Boolean(item),
      );
    if (
      groupDocuments.length &&
      groupDocuments.length !== group.documents.length
    )
      throw new WorkspaceError(
        "RESUME_COACH_INVALID",
        "A workspace artifact set is incomplete and cannot be sent to local AI.",
        "Restore or refresh the complete documented artifact set, then try again.",
      );
    if (!groupDocuments.length) continue;
    // An approved finding makes its whole prepared documentation set approved
    // context; never send a selected subset of that set.
    const groupIds = groupDocuments.map((item) => item.id);
    const state = openDatabase(input.databasePath);
    let approved = false;
    try {
      approved = Boolean(
        state
          .prepare(
            `SELECT 1 FROM evidence_library_candidates c
             JOIN evidence_revisions initial_r ON initial_r.id = c.evidence_revision_id
             JOIN evidence_revisions r ON r.evidence_id = initial_r.evidence_id
             WHERE c.document_id IN (${groupIds.map(() => "?").join(",")})
               AND r.review_state = 'approved'
               AND NOT EXISTS (SELECT 1 FROM evidence_revisions n WHERE n.supersedes_revision_id = r.id)
             LIMIT 1`,
          )
          .get(...groupIds),
      );
    } finally {
      state.close();
    }
    if (!approved) continue;
    for (const document of group.documents) {
      const record = byPath.get(document.libraryPath)!;
      if (document.contentDigest !== record.digest)
        throw new WorkspaceError(
          "RESUME_COACH_INVALID",
          "An approved workspace artifact changed before it could be used.",
          "Refresh the documented artifact and try the editable TeX draft again.",
        );
      artifacts.push({
        documentId: record.id,
        path: record.path,
        contentDigest: record.digest,
        text: document.text,
      });
    }
  }
  if (!artifacts.length)
    throw new WorkspaceError(
      "RESUME_COACH_INVALID",
      "Approve documented workspace evidence before creating an editable TeX draft.",
      "Review at least one documented finding, then try again.",
    );
  return artifacts.sort((left, right) => left.path.localeCompare(right.path));
}
function snapshotDigest(artifacts: Artifact[]): string {
  return digest(
    artifacts
      .map(
        ({ documentId, path, contentDigest }) =>
          `${documentId}:${path}:${contentDigest}`,
      )
      .join("\n"),
  );
}
/** Recomputes the database side of the complete approved set while the write lock is held. */
function approvedArtifactSnapshotInDatabase(
  db: ReturnType<typeof openDatabase>,
  workspaceId: string,
): Array<{ documentId: string; path: string; contentDigest: string }> {
  const rows = db
    .prepare(
      `SELECT d.id AS document_id, d.library_path AS path, d.content_digest AS content_digest,
       EXISTS (
         SELECT 1 FROM evidence_library_candidates c
         JOIN evidence_revisions initial_r ON initial_r.id = c.evidence_revision_id
         JOIN evidence_revisions r ON r.evidence_id = initial_r.evidence_id
         WHERE c.document_id = d.id
           AND r.review_state = 'approved'
           AND NOT EXISTS (SELECT 1 FROM evidence_revisions n WHERE n.supersedes_revision_id = r.id)
       ) AS approved
       FROM evidence_library_documents d
       JOIN evidence_library_imports i ON i.id = d.import_id
       JOIN resume_workspace_imports w ON w.import_id = i.id
       WHERE w.workspace_id = ?
       ORDER BY d.library_path, d.id`,
    )
    .all(workspaceId) as Array<{
    document_id: string;
    path: string;
    content_digest: string;
    approved: number;
  }>;
  const groups = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = row.path.slice(0, row.path.lastIndexOf("/"));
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups.values()]
    .filter((group) => group.some((row) => row.approved === 1))
    .flatMap((group) =>
      group.map((row) => ({
        documentId: row.document_id,
        path: row.path,
        contentDigest: row.content_digest,
      })),
    )
    .sort((left, right) => left.path.localeCompare(right.path));
}
function sameSnapshot(
  left: Array<{ documentId: string; path: string; contentDigest: string }>,
  right: Array<{ documentId: string; path: string; contentDigest: string }>,
): boolean {
  return (
    left.length === right.length &&
    left.every(
      (item, index) =>
        item.documentId === right[index]?.documentId &&
        item.path === right[index]?.path &&
        item.contentDigest === right[index]?.contentDigest,
    )
  );
}
function activeWorkspace(root: string, expectedWorkspaceId?: string): string {
  const db = openDatabase(join(root, "workspace.sqlite"));
  try {
    applyMigrations(db);
    const workspace = readActiveResumeWorkspace(db).workspace;
    if (
      !workspace ||
      (expectedWorkspaceId && workspace.id !== expectedWorkspaceId)
    )
      throw new WorkspaceError(
        "RESUME_WORKSPACE_STALE",
        "The active resume workspace changed before the editable TeX draft started.",
        "Open the intended resume workspace and try again.",
      );
    return workspace.id;
  } finally {
    db.close();
  }
}

/** Sends the complete immutable baseline and complete approved artifact packet. */
export async function generateEditableTexDraft(
  input: {
    appDataRoot?: string;
    workspaceRoot?: string;
    expectedWorkspaceId?: string;
    displayName: string;
    consented: boolean;
    fetcher?: FetchLike;
  },
  dependencies: EditableTexDraftDependencies = {},
): Promise<EditableTexDraftResult> {
  if (!input.consented)
    throw new WorkspaceError(
      "RESUME_COACH_INVALID",
      "Confirm that the complete resume template and approved artifacts may be sent to your local AI.",
      "Review the local AI disclosure and confirm before generating an editable TeX draft.",
    );
  const displayName = safeName(input.displayName);
  const paths = await resolveAppDataPaths(input.appDataRoot);
  const workspaceId = activeWorkspace(paths.root, input.expectedWorkspaceId);
  const [baseline, artifacts, configuration] = await Promise.all([
    verifiedCanonicalBaseline(paths.root, paths.databasePath),
    approvedArtifactSnapshot({
      databasePath: paths.databasePath,
      workspaceId,
      workspaceRoot: input.workspaceRoot,
    }),
    readEditableTexModelConfiguration({ appDataRoot: paths.root }),
  ]);
  const draftId = createUuidV7();
  const staging = join(paths.root, ".tex-draft-staging", draftId);
  const copiedBaselinePath = join(staging, "resume.tex");
  try {
    await ensureSafeDirectory(paths.root, staging);
  } catch {
    throw new WorkspaceError(
      "RESUME_COACH_INVALID",
      "The editable TeX draft staging location is unavailable.",
      "Check private workspace storage and try again.",
    );
  }
  try {
    await assertSafeDirectoryAncestors(paths.root, copiedBaselinePath);
    await writeFile(copiedBaselinePath, baseline.bytes, { flag: "wx" });
    await assertSafeDirectoryAncestors(paths.root, copiedBaselinePath);
    const copiedMetadata = await lstat(copiedBaselinePath);
    if (!copiedMetadata.isFile() || copiedMetadata.isSymbolicLink())
      throw new Error("unsafe baseline copy");
    const copied = new Uint8Array(await readFile(copiedBaselinePath));
    if (digest(copied) !== baseline.contentDigest)
      throw new Error("baseline copy mismatch");
  } catch {
    await removeSafeDirectory(paths.root, staging).catch(() => undefined);
    throw new WorkspaceError(
      "RESUME_COACH_INVALID",
      "The immutable resume.tex baseline could not be copied safely.",
      "Restore the imported resume.tex baseline and try again.",
    );
  }
  const consentNonce = createUuidV7();
  const connection = {
    configurationRevisionId: configuration.id,
    configurationDigest: configuration.configurationDigest,
    modelIdentifier: configuration.modelIdentifier,
  };
  const unsigned = {
    connection,
    workspaceId,
    displayName,
    baseline,
    artifacts,
    consentNonce,
    contextLimitTokens: configuration.contextLimitTokens,
  };
  const consentFingerprint = editableTexRevisionConsentFingerprint(unsigned);
  let response;
  try {
    response = await requestEditableTexRevision(
      { ...unsigned, consentFingerprint },
      input.fetcher,
    );
    validateRawTexDocument(response.tex, baseline.tex);
  } finally {
    await removeSafeDirectory(paths.root, staging).catch(() => undefined);
  }
  const revisionId = createUuidV7();
  const directory = join(
    paths.root,
    "tex-drafts",
    draftId,
    "revisions",
    revisionId,
  );
  if (!inside(resolve(paths.root, "tex-drafts"), directory))
    throw new WorkspaceError(
      "RESUME_COACH_INVALID",
      "The editable TeX draft could not be stored safely.",
      "Try creating the draft again.",
    );
  let created = false;
  try {
    const pdf = await (dependencies.compile ?? compileRawTexDraftPdf)({
      tex: response.tex,
      immutableBaseline: baseline.tex,
      draftId: revisionId,
      appDataRoot: paths.root,
    });
    // Re-read the complete artifact filesystem snapshot immediately before the
    // host write. Nothing is persisted if any file, approval, or membership
    // changed while inference/compilation was running.
    const [finalBaseline, finalArtifacts] = await Promise.all([
      verifiedCanonicalBaseline(paths.root, paths.databasePath),
      approvedArtifactSnapshot({
        databasePath: paths.databasePath,
        workspaceId,
        workspaceRoot: input.workspaceRoot,
      }),
    ]);
    if (
      finalBaseline.id !== baseline.id ||
      finalBaseline.contentDigest !== baseline.contentDigest ||
      digest(finalBaseline.bytes) !== digest(baseline.bytes) ||
      !sameSnapshot(artifacts, finalArtifacts)
    )
      throw new WorkspaceError(
        "RESUME_WORKSPACE_STALE",
        "The immutable baseline or approved workspace artifacts changed while the editable TeX draft was generated.",
        "Review the current workspace and generate a new draft.",
      );
    await ensureSafeDirectory(paths.root, directory);
    created = true;
    const sourceLocation = `tex-drafts/${draftId}/revisions/${revisionId}/resume.tex`;
    const pdfLocation = `tex-drafts/${draftId}/revisions/${revisionId}/resume.pdf`;
    const sourcePath = join(directory, "resume.tex");
    const pdfPath = join(directory, "resume.pdf");
    await assertSafeDirectoryAncestors(paths.root, sourcePath);
    await writeFile(sourcePath, response.tex, { encoding: "utf8", flag: "wx" });
    await assertSafeDirectoryAncestors(paths.root, pdfPath);
    await writeFile(pdfPath, pdf, { flag: "wx" });
    const db = openDatabase(paths.databasePath);
    try {
      applyMigrations(db);
      db.exec("BEGIN IMMEDIATE;");
      try {
        if (readActiveResumeWorkspace(db).workspace?.id !== workspaceId)
          throw new WorkspaceError(
            "RESUME_WORKSPACE_STALE",
            "The active resume workspace changed while the editable TeX draft was generated.",
            "Open the intended workspace and generate a new draft.",
          );
        const currentBaseline = db
          .prepare(
            "SELECT 1 FROM base_resumes WHERE id = ? AND primary_digest = ?",
          )
          .get(baseline.id, baseline.contentDigest);
        const currentArtifacts = approvedArtifactSnapshotInDatabase(
          db,
          workspaceId,
        );
        if (!currentBaseline || !sameSnapshot(artifacts, currentArtifacts))
          throw new WorkspaceError(
            "RESUME_WORKSPACE_STALE",
            "The approved workspace artifact snapshot changed while the editable TeX draft was generated.",
            "Review the current workspace and generate a new draft.",
          );
        const now = new Date().toISOString();
        const stored: StoredTexDraft = {
          id: draftId,
          workspaceId,
          displayName,
          storageLocation: `tex-drafts/${draftId}`,
          baselineId: baseline.id,
          baselineDigest: baseline.contentDigest,
          createdAt: now,
        };
        insertTexDraft(db, stored);
        insertTexDraftRevision(
          db,
          {
            id: revisionId,
            draftId,
            revisionNumber: 1,
            sourceLocation,
            pdfLocation,
            sourceDigest: digest(response.tex),
            pdfDigest: digest(pdf),
            baselineId: baseline.id,
            baselineDigest: baseline.contentDigest,
            artifactSnapshotDigest: snapshotDigest(artifacts),
            modelConfigurationId: configuration.id,
            modelConfigurationDigest: configuration.configurationDigest,
            consentFingerprint,
            contextLimitTokens: configuration.contextLimitTokens,
            createdAt: now,
          },
          artifacts.map(({ documentId, path, contentDigest }) => ({
            documentId,
            libraryPath: path,
            contentDigest,
          })),
        );
        appendAuditEvent(
          db,
          createAuditEvent({
            actor: "local-os-user",
            action: "resume.tex_draft_created",
            outcome: "success",
            entityId: revisionId,
            contentHash: digest(response.tex),
          }),
        );
        db.exec("COMMIT;");
      } catch (error) {
        db.exec("ROLLBACK;");
        throw error;
      }
    } finally {
      db.close();
    }
    return { draftId, revisionId, displayName };
  } catch (error) {
    if (created)
      await removeSafeDirectory(
        paths.root,
        join(paths.root, "tex-drafts", draftId),
      ).catch(() => undefined);
    throw error;
  }
}

export async function readEditableTexDraftRevision(input: {
  appDataRoot?: string;
  revisionId: string;
}): Promise<{ displayName: string; tex: Uint8Array; pdf: Uint8Array }> {
  const paths = await resolveAppDataPaths(input.appDataRoot);
  const db = openDatabase(paths.databasePath);
  let item;
  try {
    applyMigrations(db);
    const workspace = readActiveResumeWorkspace(db).workspace;
    item = workspace
      ? readTexDraftRevisionForWorkspace(db, workspace.id, input.revisionId)
      : undefined;
  } finally {
    db.close();
  }
  if (!item)
    throw new WorkspaceError(
      "RESUME_COACH_INVALID",
      "That editable TeX draft is unavailable.",
      "Open its resume workspace and try again.",
    );
  const source = resolve(paths.root, item.revision.sourceLocation);
  const pdf = resolve(paths.root, item.revision.pdfLocation);
  try {
    await Promise.all([
      assertSafeDirectoryAncestors(paths.root, source),
      assertSafeDirectoryAncestors(paths.root, pdf),
    ]);
    const [sourceStat, pdfStat, tex, pdfBytes] = await Promise.all([
      lstat(source),
      lstat(pdf),
      readFile(source),
      readFile(pdf),
    ]);
    if (
      !inside(paths.root, source) ||
      !inside(paths.root, pdf) ||
      sourceStat.isSymbolicLink() ||
      pdfStat.isSymbolicLink() ||
      !sourceStat.isFile() ||
      !pdfStat.isFile() ||
      digest(tex) !== item.revision.sourceDigest ||
      digest(pdfBytes) !== item.revision.pdfDigest
    )
      throw new Error("unsafe");
    return {
      displayName: item.draft.displayName,
      tex: new Uint8Array(tex),
      pdf: new Uint8Array(pdfBytes),
    };
  } catch {
    throw new WorkspaceError(
      "RESUME_COACH_INVALID",
      "That editable TeX draft is unavailable.",
      "Generate a new editable TeX draft from the current workspace.",
    );
  }
}
