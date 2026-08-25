import { createHash } from "node:crypto";
import { basename } from "node:path";
import { parseResumePdf, validateResumeDraftContent, type ResumeDraftContent } from "@/adapters/resume-parser/pdf-text-parser";
import { createAuditEvent, createUuidV7 } from "@/audit/audit-event";
import { cleanupCurrentBaseResume, readRetainedCurrentBaseResumePdf, stageCurrentBaseResume } from "@/files/current-base-resume";
import { resolveAppDataPaths } from "@/files/app-data";
import { listApprovedEvidence } from "@/persistence/evidence-repository";
import { WorkspaceError } from "@/domain/workspace/types";
import { applyMigrations, openDatabase } from "@/persistence/database";
import { appendAuditEvent } from "@/persistence/workspace-repository";
import { appendProposalDecision, currentDraft, findDraft, findSourceByDigest, insertDraft, insertProposal, insertSource, insertVersion, latestDraftForSource, listProposals, listSources, listVersions, type CurrentBaseResumeDraft, type CurrentBaseResumeProposal, type CurrentBaseResumeSource, type CurrentBaseResumeVersion } from "@/persistence/current-base-resume-repository";

type Options = { appDataRoot?: string };
const digest = (value: Uint8Array | string) => `sha256:${createHash("sha256").update(value).digest("hex")}`;
const safeFilename = (name: string) => basename(name) === name && name.toLowerCase().endsWith(".pdf") && !/[\u0000-\u001f]/.test(name) && name.length <= 255;
function contentDigest(content: ResumeDraftContent): string { return digest(JSON.stringify(content)); }
function audit(db: ReturnType<typeof openDatabase>, action: Parameters<typeof createAuditEvent>[0]["action"], outcome: "success" | "failure", id?: string, hash?: string) { appendAuditEvent(db, createAuditEvent({ actor: "local-os-user", action, outcome, entityId: id, contentHash: hash })); }
function transaction<T>(root: string, work: (db: ReturnType<typeof openDatabase>) => T): T { const db = openDatabase(`${root}/workspace.sqlite`); try { applyMigrations(db); db.exec("BEGIN IMMEDIATE;"); try { const result = work(db); db.exec("COMMIT;"); return result; } catch (error) { db.exec("ROLLBACK;"); throw error; } } finally { db.close(); } }

export async function importCurrentBaseResume(input: Options & { filename: string; bytes: Uint8Array }): Promise<{ source: CurrentBaseResumeSource; draft: CurrentBaseResumeDraft }> {
  const paths = await resolveAppDataPaths(input.appDataRoot); const hash = digest(input.bytes); const id = createUuidV7(); let final: string | undefined;
  try {
    if (!safeFilename(input.filename)) throw new WorkspaceError("CURRENT_BASE_RESUME_INVALID", "The selected file is not a resume PDF.", "Choose one text-readable PDF and try again.");
    const parsed = await parseResumePdf(input.bytes);
    const existing = transaction(paths.root, (db) => findSourceByDigest(db, hash));
    if (existing) throw new WorkspaceError("CURRENT_BASE_RESUME_DUPLICATE", "That PDF has already been imported.", "Review the existing Current Base Resume or choose a different PDF.");
    const copied = await stageCurrentBaseResume(input.appDataRoot, id, input.filename, input.bytes); final = copied.final;
    const now = new Date().toISOString(); const source: CurrentBaseResumeSource = { id, filename: input.filename, contentDigest: hash, byteSize: input.bytes.byteLength, storageLocation: copied.storageLocation, importedAt: now };
    const draft: CurrentBaseResumeDraft = { id: createUuidV7(), sourceId: id, revisionNumber: 1, content: parsed, contentDigest: contentDigest(parsed), createdAt: now };
    transaction(paths.root, (db) => { insertSource(db, source); insertDraft(db, draft); audit(db, "current_base_resume.imported", "success", id, hash); });
    return { source, draft };
  } catch (error) {
    await cleanupCurrentBaseResume(final).catch(() => undefined);
    try { transaction(paths.root, (db) => audit(db, "current_base_resume.import_failed", "failure", undefined, hash)); } catch { /* metadata-only best effort */ }
    throw error;
  }
}
export async function saveCurrentBaseResumeDraft(input: Options & { draftId: string; content: ResumeDraftContent }): Promise<CurrentBaseResumeDraft> { const content = validateResumeDraftContent(input.content); const paths = await resolveAppDataPaths(input.appDataRoot); return transaction(paths.root, (db) => { const previous = findDraft(db, input.draftId); if (!previous || currentDraft(db)?.id !== input.draftId) throw new WorkspaceError("CURRENT_BASE_RESUME_STALE", "The draft changed before it could be saved.", "Refresh the Current Base Resume and try again."); const item: CurrentBaseResumeDraft = { id: createUuidV7(), sourceId: previous.sourceId, parentDraftId: previous.id, revisionNumber: (latestDraftForSource(db, previous.sourceId)?.revisionNumber ?? 0) + 1, content, contentDigest: contentDigest(content), createdAt: new Date().toISOString() }; insertDraft(db, item); audit(db, "current_base_resume.draft_saved", "success", item.id, item.contentDigest); return item; }); }
export async function generateCurrentBaseResumeProposals(input: Options & { draftId: string }): Promise<CurrentBaseResumeProposal[]> { const paths = await resolveAppDataPaths(input.appDataRoot); return transaction(paths.root, (db) => { const draft = findDraft(db, input.draftId); if (!draft || currentDraft(db)?.id !== draft.id) throw new WorkspaceError("CURRENT_BASE_RESUME_STALE", "The draft changed before proposals were generated.", "Refresh the Current Base Resume and try again."); const existing = listProposals(db, draft.id); for (const evidence of listApprovedEvidence(db)) if (!existing.some((item) => item.evidenceRevisionId === evidence.id)) { const item = { id: createUuidV7(), draftId: draft.id, evidenceRevisionId: evidence.id, kind: "addition" as const, proposedText: evidence.factualText, contentDigest: digest(evidence.factualText), createdAt: new Date().toISOString() }; insertProposal(db, item, createUuidV7()); } const proposals = listProposals(db, draft.id); audit(db, "current_base_resume.proposals_generated", "success", draft.id, draft.contentDigest); return proposals; }); }
export async function resolveCurrentBaseResumeProposal(input: Options & { proposalId: string; expectedDecisionRevisionId: string; decision: "approved" | "edited" | "rejected"; text?: string }): Promise<void> { if (!(["approved", "edited", "rejected"] as const).includes(input.decision)) throw new WorkspaceError("CURRENT_BASE_RESUME_INVALID", "The proposed change decision is unavailable.", "Choose approve, save edited, or reject and try again."); const paths = await resolveAppDataPaths(input.appDataRoot); transaction(paths.root, (db) => { const proposal = db.prepare("SELECT draft_id FROM current_base_resume_proposals WHERE id = ?").get(input.proposalId) as { draft_id: string } | undefined; if (!proposal) throw new WorkspaceError("CURRENT_BASE_RESUME_NOT_FOUND", "That proposed change is unavailable.", "Refresh proposed changes and try again."); if (currentDraft(db)?.id !== proposal.draft_id) throw new WorkspaceError("CURRENT_BASE_RESUME_STALE", "The draft changed before this proposed change could be resolved.", "Refresh proposed changes and try again."); const item = listProposals(db, proposal.draft_id).find((value) => value.id === input.proposalId); if (!item || item.decisionRevisionId !== input.expectedDecisionRevisionId || item.decision !== "open") throw new WorkspaceError("CURRENT_BASE_RESUME_STALE", "That proposed change was already resolved.", "Refresh proposed changes and try again."); if (input.decision === "edited" && !input.text?.trim()) throw new WorkspaceError("CURRENT_BASE_RESUME_INVALID", "An edited proposed change needs text.", "Enter the reviewed wording or reject the proposal."); appendProposalDecision(db, item, createUuidV7(), input.decision, input.text?.trim(), new Date().toISOString()); audit(db, "current_base_resume.proposal_resolved", "success", item.id, item.contentDigest); }); }
export async function approveCurrentBaseResumeVersion(input: Options & { draftId: string; explicitApproval: boolean }): Promise<CurrentBaseResumeVersion> { if (!input.explicitApproval) throw new WorkspaceError("CURRENT_BASE_RESUME_UNRESOLVED", "Explicit approval is required before creating a Current Base Resume version.", "Review all proposed changes and approve the version explicitly."); const paths = await resolveAppDataPaths(input.appDataRoot); return transaction(paths.root, (db) => { const draft = findDraft(db, input.draftId); if (!draft || currentDraft(db)?.id !== input.draftId) throw new WorkspaceError("CURRENT_BASE_RESUME_STALE", "The draft changed before version approval.", "Refresh the Current Base Resume and try again."); if (listVersions(db).some((version) => version.draftId === draft.id)) throw new WorkspaceError("CURRENT_BASE_RESUME_STALE", "That Current Base Resume version was already approved.", "Refresh the retained versions and create a new draft revision if needed."); const proposals = listProposals(db, draft.id); if (proposals.some((proposal) => proposal.decision === "open")) throw new WorkspaceError("CURRENT_BASE_RESUME_UNRESOLVED", "All proposed changes must be resolved before approval.", "Approve, edit, or reject each proposed change first."); const support = proposals.filter((proposal) => proposal.decision === "approved" || proposal.decision === "edited").map((proposal) => proposal.evidenceRevisionId).sort(); const source = db.prepare("SELECT filename FROM current_base_resume_sources WHERE id = ?").get(draft.sourceId) as { filename: string }; const item: CurrentBaseResumeVersion = { id: createUuidV7(), sourceId: draft.sourceId, sourceFilename: source.filename, draftId: draft.id, draftRevisionNumber: draft.revisionNumber, approvedAt: new Date().toISOString(), contentDigest: draft.contentDigest, evidenceRevisionIds: support }; insertVersion(db, item); audit(db, "current_base_resume.version_approved", "success", item.id, item.contentDigest); return item; }); }
export async function listCurrentBaseResume(input: Options = {}): Promise<{ sources: CurrentBaseResumeSource[]; draft?: CurrentBaseResumeDraft; proposals: CurrentBaseResumeProposal[]; versions: CurrentBaseResumeVersion[] }> { const paths = await resolveAppDataPaths(input.appDataRoot); return transaction(paths.root, (db) => { const draft = currentDraft(db); return { sources: listSources(db), draft, proposals: draft ? listProposals(db, draft.id) : [], versions: listVersions(db) }; }); }

export async function readCurrentBaseResumePdf(input: Options & { sourceId: string }): Promise<Uint8Array | undefined> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.sourceId)) return undefined;

  try {
    const paths = await resolveAppDataPaths(input.appDataRoot);
    const source = transaction(paths.root, (db) => {
      const draft = currentDraft(db);
      return draft?.sourceId === input.sourceId ? listSources(db).find((item) => item.id === input.sourceId) : undefined;
    });
    if (!source) return undefined;
    const bytes = await readRetainedCurrentBaseResumePdf(paths.root, source);
    if (!bytes || bytes.byteLength !== source.byteSize || digest(bytes) !== source.contentDigest) return undefined;
    return transaction(paths.root, (db) => currentDraft(db)?.sourceId === source.id) ? bytes : undefined;
  } catch {
    return undefined;
  }
}
