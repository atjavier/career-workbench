import type { DatabaseSync } from "node:sqlite";

export type StoredTexDraft = {
  id: string;
  workspaceId: string;
  displayName: string;
  storageLocation: string;
  baselineId: string;
  baselineDigest: string;
  createdAt: string;
};
export type StoredTexDraftRevision = {
  id: string;
  draftId: string;
  revisionNumber: number;
  sourceLocation: string;
  pdfLocation: string;
  sourceDigest: string;
  pdfDigest: string;
  baselineId: string;
  baselineDigest: string;
  artifactSnapshotDigest: string;
  modelConfigurationId: string;
  modelConfigurationDigest: string;
  consentFingerprint: string;
  contextLimitTokens: number;
  createdAt: string;
};

type DraftRow = {
  id: string;
  workspace_id: string;
  display_name: string;
  storage_location: string;
  baseline_id: string;
  baseline_digest: string;
  created_at: string;
};
type RevisionRow = {
  id: string;
  draft_id: string;
  revision_number: number;
  source_location: string;
  pdf_location: string;
  source_digest: string;
  pdf_digest: string;
  baseline_id: string;
  baseline_digest: string;
  artifact_snapshot_digest: string;
  model_configuration_id: string;
  model_configuration_digest: string;
  consent_fingerprint: string;
  context_limit_tokens: number;
  created_at: string;
};

const draft = (row: DraftRow): StoredTexDraft => ({
  id: row.id,
  workspaceId: row.workspace_id,
  displayName: row.display_name,
  storageLocation: row.storage_location,
  baselineId: row.baseline_id,
  baselineDigest: row.baseline_digest,
  createdAt: row.created_at,
});
const revision = (row: RevisionRow): StoredTexDraftRevision => ({
  id: row.id,
  draftId: row.draft_id,
  revisionNumber: row.revision_number,
  sourceLocation: row.source_location,
  pdfLocation: row.pdf_location,
  sourceDigest: row.source_digest,
  pdfDigest: row.pdf_digest,
  baselineId: row.baseline_id,
  baselineDigest: row.baseline_digest,
  artifactSnapshotDigest: row.artifact_snapshot_digest,
  modelConfigurationId: row.model_configuration_id,
  modelConfigurationDigest: row.model_configuration_digest,
  consentFingerprint: row.consent_fingerprint,
  contextLimitTokens: row.context_limit_tokens,
  createdAt: row.created_at,
});

export function insertTexDraft(db: DatabaseSync, item: StoredTexDraft): void {
  db.prepare(
    "INSERT INTO tex_drafts (id, workspace_id, display_name, storage_location, baseline_id, baseline_digest, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).run(
    item.id,
    item.workspaceId,
    item.displayName,
    item.storageLocation,
    item.baselineId,
    item.baselineDigest,
    item.createdAt,
  );
}

export function insertTexDraftRevision(
  db: DatabaseSync,
  item: StoredTexDraftRevision,
  artifacts: Array<{
    documentId: string;
    libraryPath: string;
    contentDigest: string;
  }>,
): void {
  db.prepare(
    "INSERT INTO tex_draft_revisions (id, draft_id, revision_number, source_location, pdf_location, source_digest, pdf_digest, baseline_id, baseline_digest, artifact_snapshot_digest, model_configuration_id, model_configuration_digest, consent_fingerprint, context_limit_tokens, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  ).run(
    item.id,
    item.draftId,
    item.revisionNumber,
    item.sourceLocation,
    item.pdfLocation,
    item.sourceDigest,
    item.pdfDigest,
    item.baselineId,
    item.baselineDigest,
    item.artifactSnapshotDigest,
    item.modelConfigurationId,
    item.modelConfigurationDigest,
    item.consentFingerprint,
    item.contextLimitTokens,
    item.createdAt,
  );
  const insert = db.prepare(
    "INSERT INTO tex_draft_revision_artifacts (revision_id, document_id, library_path, content_digest) VALUES (?, ?, ?, ?)",
  );
  for (const artifact of artifacts)
    insert.run(
      item.id,
      artifact.documentId,
      artifact.libraryPath,
      artifact.contentDigest,
    );
}

export function readTexDraftRevisionForWorkspace(
  db: DatabaseSync,
  workspaceId: string,
  revisionId: string,
): { draft: StoredTexDraft; revision: StoredTexDraftRevision } | undefined {
  const row = db
    .prepare(
      "SELECT d.id AS d_id, d.workspace_id, d.display_name, d.storage_location, d.baseline_id AS d_baseline_id, d.baseline_digest AS d_baseline_digest, d.created_at AS d_created_at, r.id, r.draft_id, r.revision_number, r.source_location, r.pdf_location, r.source_digest, r.pdf_digest, r.baseline_id, r.baseline_digest, r.artifact_snapshot_digest, r.model_configuration_id, r.model_configuration_digest, r.consent_fingerprint, r.context_limit_tokens, r.created_at FROM tex_drafts d JOIN tex_draft_revisions r ON r.draft_id = d.id WHERE d.workspace_id = ? AND r.id = ?",
    )
    .get(workspaceId, revisionId) as
    | (RevisionRow & {
        d_id: string;
        workspace_id: string;
        display_name: string;
        storage_location: string;
        d_baseline_id: string;
        d_baseline_digest: string;
        d_created_at: string;
      })
    | undefined;
  return row
    ? {
        draft: draft({
          id: row.d_id,
          workspace_id: row.workspace_id,
          display_name: row.display_name,
          storage_location: row.storage_location,
          baseline_id: row.d_baseline_id,
          baseline_digest: row.d_baseline_digest,
          created_at: row.d_created_at,
        }),
        revision: revision(row),
      }
    : undefined;
}

export function findLatestTexDraftForWorkspace(
  db: DatabaseSync,
  workspaceId: string,
): { revisionId: string; displayName: string } | undefined {
  const row = db
    .prepare(
      "SELECT r.id AS revision_id, d.display_name FROM tex_drafts d JOIN tex_draft_revisions r ON r.draft_id = d.id WHERE d.workspace_id = ? ORDER BY r.created_at DESC, r.id DESC LIMIT 1",
    )
    .get(workspaceId) as
    | { revision_id: string; display_name: string }
    | undefined;
  return row
    ? { revisionId: row.revision_id, displayName: row.display_name }
    : undefined;
}

