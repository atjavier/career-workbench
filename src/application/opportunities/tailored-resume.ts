import { createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { createAuditEvent, createUuidV7 } from "@/audit/audit-event";
import { resolveAppDataPaths } from "@/files/app-data";
import { applyMigrations, openDatabase } from "@/persistence/database";
import { readActiveResumeWorkspace, listWorkspaceDocumentedEvidenceIds } from "@/persistence/resume-workspace-repository";
import { findLatestWorkspaceMaterialDraftId, isLatestWorkspaceMaterialDraftCurrent } from "@/persistence/material-draft-repository";
import { listCapturedRevisions } from "@/persistence/captured-opportunities-repository";
import { findLocalModelConfiguration } from "@/persistence/local-model-configuration-repository";
import { readMaterialDraft, type MaterialDraftView } from "@/application/resume-generation/material-draft-commands";
import { compileResumeDraftPdf, maximumResumePdfBytes } from "@/domain/resume-generation/resume-tex-compiler";
import { renderResumeDraftTex } from "@/domain/resume-generation/resume-tex";
import { requestJobTailoringStage, type LocalModelConnection } from "@/adapters/local-model/local-model-gateway";
import { appendAuditEvent } from "@/persistence/workspace-repository";
import { WorkspaceError } from "@/domain/workspace/types";
import { baseBullets, curateBaseResume, validateAnalysis, validateBulletOrder, validateVerdict, validateTailoredEdit, tailoringInvalid } from "@/domain/opportunities/tailoring-contract";

type Options = { appDataRoot?: string };
const hash = (value: unknown) => `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
function unavailable(summary = "Complete and generate your base resume before tailoring a job."): never {
  throw new WorkspaceError("TAILORED_RESUME_UNAVAILABLE", summary, "Open Resume or check your local AI settings.");
}
function stale(): never {
  throw new WorkspaceError("OPPORTUNITY_STALE", "The job, base resume, AI settings or tailored resume changed during this request.", "Refresh the opportunity and regenerate using the current details.");
}
function context(db: DatabaseSync, opportunityId: string) {
  const revision = listCapturedRevisions(db, opportunityId).at(-1);
  if (!revision) throw new WorkspaceError("OPPORTUNITY_NOT_FOUND", "That opportunity is no longer available.", "Return to All Opportunities.");
  const workspace = readActiveResumeWorkspace(db).workspace;
  if (!workspace?.activeProfileRevisionId) return unavailable();
  const baseDraftId = findLatestWorkspaceMaterialDraftId(db, workspace.id);
  if (!baseDraftId || !isLatestWorkspaceMaterialDraftCurrent(db, {
    workspaceId: workspace.id, profileRevisionId: workspace.activeProfileRevisionId,
    evidenceRevisionIds: listWorkspaceDocumentedEvidenceIds(db, workspace.id),
  })) return unavailable();
  const baseRow = db.prepare("SELECT content_digest, provenance_digest, opportunity_revision_id FROM material_drafts WHERE id = ?").get(baseDraftId) as { content_digest: string; provenance_digest: string; opportunity_revision_id: string | null };
  if (baseRow.opportunity_revision_id) return unavailable();
  const state = db.prepare("SELECT current_model_configuration_revision_id AS id FROM resume_generation_state WHERE singleton = 1").get() as { id?: string };
  const model = state.id ? findLocalModelConfiguration(db, state.id) : undefined;
  if (!model) return unavailable("Configure local AI in Settings before tailoring a resume.");
  const connection: LocalModelConnection = { configurationRevisionId: model.id, configurationDigest: model.configurationDigest, modelIdentifier: model.modelIdentifier };
  const current = db.prepare("SELECT generation_id FROM opportunity_tailored_resumes WHERE opportunity_id = ?").get(opportunityId) as { generation_id: string } | undefined;
  const fingerprint = hash({ capability: "job-tailoring-v1", workspace: workspace.id, revision: revision.id, jobDigest: revision.contentDigest, baseDraftId, base: baseRow.content_digest, provenance: baseRow.provenance_digest, connection });
  return { revision, baseDraftId, fingerprint, connection, generationId: current?.generation_id ?? "none" };
}
async function prepare(opportunityId: string, options: Options) {
  const paths = await resolveAppDataPaths(options.appDataRoot);
  const db = openDatabase(paths.databasePath);
  let input: ReturnType<typeof context>;
  try { applyMigrations(db); input = context(db, opportunityId); } finally { db.close(); }
  const base = await readMaterialDraft({ draftId: input.baseDraftId, appDataRoot: options.appDataRoot });
  return { ...input, base, paths };
}
export type TailoredResumeView = {
  generationId: string; updatedAt: string; stale: boolean;
  sections: MaterialDraftView["sections"]; unknowns: string[];
};
export async function readTailoredResume(opportunityId: string, options: Options = {}) {
  const paths = await resolveAppDataPaths(options.appDataRoot);
  const db = openDatabase(paths.databasePath);
  try {
    applyMigrations(db);
    const row = db.prepare("SELECT * FROM opportunity_tailored_resumes WHERE opportunity_id = ?").get(opportunityId) as {
      generation_id: string; updated_at: string; content_json: string; pdf: Uint8Array; tex: string; opportunity_revision_id: string; input_fingerprint: string;
    } | undefined;
    if (!row) return undefined;
    const content = JSON.parse(row.content_json) as MaterialDraftView;
    if (!Array.isArray(content.sections) || !Array.isArray(content.unknowns) || content.sections.some(section => typeof section.heading !== "string" || typeof section.text !== "string") || content.unknowns.some(item => typeof item !== "string") || Buffer.from(row.pdf.subarray(0, 5)).toString("ascii") !== "%PDF-") return tailoringInvalid();
    const current = listCapturedRevisions(db, opportunityId).at(-1);
    return { inputFingerprint: row.input_fingerprint, view: { generationId: row.generation_id, updatedAt: row.updated_at, stale: current?.id !== row.opportunity_revision_id, sections: content.sections, unknowns: content.unknowns } as TailoredResumeView, pdf: row.pdf, tex: row.tex };
  } finally { db.close(); }
}
export async function readTailoringState(opportunityId: string, options: Options = {}) {
  const result = await readTailoredResume(opportunityId, options);
  try {
    const input = await prepare(opportunityId, options);
    baseBullets(input.base);
    if (result && result.inputFingerprint !== input.fingerprint) result.view.stale = true;
    return { resume: result?.view, fingerprint: input.fingerprint, expectedGenerationId: input.generationId, modelLabel: input.connection.modelIdentifier, unavailable: undefined };
  } catch (error) {
    return { resume: result?.view, fingerprint: undefined, expectedGenerationId: result?.view.generationId ?? "none", modelLabel: undefined, unavailable: error instanceof WorkspaceError ? error.summary : "Your base resume is unavailable for tailoring." };
  }
}
type MutationInput = Options & { opportunityId: string; expectedFingerprint: string; expectedGenerationId: string; consent: boolean };
export type TailoringOptions = Options & {
  stage?: typeof requestJobTailoringStage;
  compiler?: (draft: MaterialDraftView) => Promise<Uint8Array>;
};
async function saveCandidate(input: MutationInput, prepared: Awaited<ReturnType<typeof prepare>>, candidate: MaterialDraftView, options: TailoringOptions) {
  const generationId = createUuidV7();
  candidate = { ...candidate, id: generationId, opportunityLabel: `${prepared.revision.title} at ${prepared.revision.company}` };
  const tex = renderResumeDraftTex(candidate);
  const pdf = await (options.compiler ?? compileResumeDraftPdf)(candidate);
  if (pdf.byteLength > maximumResumePdfBytes || Buffer.from(pdf.subarray(0, 5)).toString("ascii") !== "%PDF-") return tailoringInvalid();
  const db = openDatabase(prepared.paths.databasePath);
  try {
    db.exec("BEGIN IMMEDIATE");
    try {
      const latest = context(db, input.opportunityId);
      if (latest.fingerprint !== input.expectedFingerprint || latest.generationId !== input.expectedGenerationId) return stale();
      db.prepare(`INSERT INTO opportunity_tailored_resumes
        (opportunity_id, opportunity_revision_id, base_draft_id, input_fingerprint, generation_id, content_json, tex, pdf, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(opportunity_id) DO UPDATE SET
        opportunity_revision_id=excluded.opportunity_revision_id, base_draft_id=excluded.base_draft_id,
        input_fingerprint=excluded.input_fingerprint, generation_id=excluded.generation_id, content_json=excluded.content_json,
        tex=excluded.tex, pdf=excluded.pdf, updated_at=excluded.updated_at`).run(
        input.opportunityId, latest.revision.id, latest.baseDraftId, latest.fingerprint, generationId, JSON.stringify(candidate), tex, pdf, new Date().toISOString(),
      );
      appendAuditEvent(db, createAuditEvent({ actor: "local-os-user", action: "opportunity.resume_generated", outcome: "success", entityId: input.opportunityId, contentHash: hash({ generationId, fingerprint: latest.fingerprint }) }));
      db.exec("COMMIT");
      return { generationId };
    } catch (error) { db.exec("ROLLBACK"); throw error; }
  } finally { db.close(); }
}
export async function generateTailoredResume(input: MutationInput, options: TailoringOptions = {}) {
  if (!input.consent) return unavailable("Confirm that local AI may read this posting and your base resume for this request.");
  const prepared = await prepare(input.opportunityId, input);
  if (prepared.fingerprint !== input.expectedFingerprint || prepared.generationId !== input.expectedGenerationId) return stale();
  const bullets = baseBullets(prepared.base);
  const stage = options.stage ?? requestJobTailoringStage;
  const analysis = validateAnalysis(await stage(prepared.connection, "analyst", {
    copiedDescription: prepared.revision.copiedDescription, requirements: JSON.parse(prepared.revision.requirements), bullets,
  }), prepared.revision.copiedDescription, bullets.length);
  const groups = prepared.base.sections.filter(section => /experience|projects?/i.test(section.heading)).map(section => ({ heading: section.heading, text: section.text }));
  const order = validateBulletOrder(await stage(prepared.connection, "writer", { bullets, workEntries: groups, analysis }), bullets.length);
  const candidate = curateBaseResume(prepared.base, order);
  validateVerdict(await stage(prepared.connection, "reviewer", { bullets, analysis, sections: candidate.sections.filter(section => /experience|projects?/i.test(section.heading)) }));
  candidate.unknowns = [...new Set([...candidate.unknowns, ...analysis.unknowns])].slice(0, 20);
  return saveCandidate(input, prepared, candidate, options);
}
export async function editTailoredResume(input: MutationInput & { sectionTexts: string[] }, options: TailoringOptions = {}) {
  const prepared = await prepare(input.opportunityId, input);
  if (prepared.fingerprint !== input.expectedFingerprint || prepared.generationId !== input.expectedGenerationId || input.expectedGenerationId === "none") return stale();
  const current = await readTailoredResume(input.opportunityId, input);
  if (!current || current.view.stale || current.inputFingerprint !== prepared.fingerprint) return stale();
  const candidate = validateTailoredEdit(prepared.base, input.sectionTexts);
  candidate.unknowns = current.view.unknowns;
  return saveCandidate(input, prepared, candidate, options);
}
