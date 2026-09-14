import type { DatabaseSync } from "node:sqlite";

export type MaterialDraftRow = { id: string; profileRevisionId: string; profileDigest: string; templateId: string; templateDigest: string; opportunityRevisionId?: string; opportunityDigest?: string; requestText: string; requestDigest: string; contentJson: string; contentDigest: string; provenanceDigest: string; createdAt: string };

export function insertMaterialDraft(db: DatabaseSync, item: MaterialDraftRow): void {
  db.prepare("INSERT INTO material_drafts (id, kind, profile_revision_id, profile_content_digest, template_source_id, template_content_digest, opportunity_revision_id, opportunity_content_digest, request_text, request_digest, content_json, content_digest, provenance_digest, created_at) VALUES (?, 'resume', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(item.id, item.profileRevisionId, item.profileDigest, item.templateId, item.templateDigest, item.opportunityRevisionId ?? null, item.opportunityDigest ?? null, item.requestText, item.requestDigest, item.contentJson, item.contentDigest, item.provenanceDigest, item.createdAt);
}
export function insertMaterialDraftEvidence(db: DatabaseSync, draftId: string, evidenceRevisionId: string): void { db.prepare("INSERT INTO material_draft_evidence (draft_id, evidence_revision_id) VALUES (?, ?)").run(draftId, evidenceRevisionId); }
export function insertMaterialDraftClaim(db: DatabaseSync, item: { id: string; draftId: string; ordinal: number; text: string; createdAt: string }): void { db.prepare("INSERT INTO material_draft_claims (id, draft_id, ordinal, claim_text, created_at) VALUES (?, ?, ?, ?, ?)").run(item.id, item.draftId, item.ordinal, item.text, item.createdAt); }
export function insertMaterialClaimSupport(db: DatabaseSync, claimId: string, evidenceRevisionId: string): void { db.prepare("INSERT INTO material_claim_support (claim_id, evidence_revision_id) VALUES (?, ?)").run(claimId, evidenceRevisionId); }

export function findLatestWorkspaceMaterialDraftId(db: DatabaseSync, workspaceId: string): string | undefined {
  const row = db.prepare("SELECT d.id FROM material_drafts d JOIN resume_workspace_drafts w ON w.draft_id = d.id WHERE w.workspace_id = ? ORDER BY d.created_at DESC, d.id DESC LIMIT 1").get(workspaceId) as { id: string } | undefined;
  return row?.id;
}

export function isLatestWorkspaceMaterialDraftCurrent(db: DatabaseSync, input: { workspaceId: string; profileRevisionId: string; evidenceRevisionIds: string[] }): boolean {
  const draft = db.prepare("SELECT d.id, d.profile_revision_id AS profileRevisionId, d.content_json AS contentJson FROM material_drafts d JOIN resume_workspace_drafts w ON w.draft_id = d.id WHERE w.workspace_id = ? ORDER BY d.created_at DESC, d.id DESC LIMIT 1").get(input.workspaceId) as { id: string; profileRevisionId: string; contentJson: string } | undefined;
  if (!draft || draft.profileRevisionId !== input.profileRevisionId) return false;
  // Older drafts used one combined “Selected Experience & Projects” section
  // and were rendered as low-level source snippets. Treat them as stale so the
  // current Coach automatically regenerates the separated, template-ready
  // Experience and Projects sections when the Resume page is opened.
  try {
    const parsed = JSON.parse(draft.contentJson) as { sections?: Array<{ heading?: unknown }> };
    const headings = new Set((parsed.sections ?? []).map((section) => typeof section?.heading === "string" ? section.heading.trim().toLocaleLowerCase() : ""));
    // Project-only and experience-only candidates intentionally omit the
    // other work section. A current draft therefore needs at least one of the
    // standard work headings, not specifically Projects.
    if (!headings.has("projects") && !headings.has("project") && !headings.has("experience")) return false;
    // Drafts produced by the earlier documentation pass could contain source
    // paths, markdown code spans, or route snippets inside the resume text.
    // Keep the record for provenance, but force the active Resume page to
    // regenerate it through the current resume-ready composer.
    const serialized = JSON.stringify(parsed);
    if (/`|https?:\/\/|(?:^|[\s\"'])\/(?:api|src)\//i.test(serialized) || /(?:^|[\n\"'])[-*]\s+docs\//i.test(serialized)) return false;
  } catch {
    return false;
  }
  const expected = [...new Set(input.evidenceRevisionIds)].sort();
  const actual = (db.prepare("SELECT evidence_revision_id AS id FROM material_draft_evidence WHERE draft_id = ? ORDER BY evidence_revision_id").all(draft.id) as Array<{ id: string }>).map((item) => item.id);
  return expected.length === actual.length && expected.every((id, index) => id === actual[index]);
}

export type StoredMaterialDraftRead = {
  id: string;
  profileRevisionId: string;
  profileDigest: string;
  candidateProfileJson?: string;
  templateId: string;
  templateDigest: string;
  opportunityRevisionId?: string;
  opportunityDigest?: string;
  opportunityResolved: boolean;
  contentJson: string;
  contentDigest: string;
  provenanceDigest: string;
  templateFilename: string;
  opportunityLabel?: string;
  handedOffAt?: string;
  evidence: Array<{ id: string; contentDigest: string; label: string }>;
  claims: Array<{ id: string; ordinal: number; text: string; evidence: Array<{ id: string; label: string }> }>;
};

export function findMaterialDraftRead(db: DatabaseSync, draftId: string): StoredMaterialDraftRead | undefined {
  const row = db.prepare("SELECT d.id, d.profile_revision_id AS profileRevisionId, d.profile_content_digest AS profileDigest, p.canonical_content AS candidateProfileJson, d.template_source_id AS templateId, d.template_content_digest AS templateDigest, d.opportunity_revision_id AS opportunityRevisionId, d.opportunity_content_digest AS opportunityDigest, d.content_json AS contentJson, d.content_digest AS contentDigest, d.provenance_digest AS provenanceDigest, t.filename AS templateFilename, o.id AS opportunityResolved, CASE WHEN o.id IS NULL THEN NULL ELSE o.title || ' at ' || o.company END AS opportunityLabel, h.created_at AS handedOffAt FROM material_drafts d JOIN candidate_profile_revisions p ON p.id = d.profile_revision_id AND p.content_digest = d.profile_content_digest JOIN resume_template_sources t ON t.id = d.template_source_id AND t.content_digest = d.template_content_digest LEFT JOIN captured_opportunity_revisions o ON o.id = d.opportunity_revision_id AND o.content_digest = d.opportunity_content_digest LEFT JOIN material_draft_handoffs h ON h.draft_id = d.id WHERE d.id = ?").get(draftId) as { id: string; profileRevisionId: string; profileDigest: string; candidateProfileJson: string | null; templateId: string; templateDigest: string; opportunityRevisionId: string | null; opportunityDigest: string | null; contentJson: string; contentDigest: string; provenanceDigest: string; templateFilename: string; opportunityResolved: string | null; opportunityLabel: string | null; handedOffAt: string | null } | undefined;
  if (!row) return undefined;
  const evidence = (db.prepare("SELECT e.id, e.content_digest AS contentDigest, e.source_document AS sourceDocument, e.source_section AS sourceSection FROM material_draft_evidence d JOIN evidence_revisions e ON e.id = d.evidence_revision_id WHERE d.draft_id = ? ORDER BY e.source_document, e.source_section, e.id").all(draftId) as Array<{ id: string; contentDigest: string; sourceDocument: string; sourceSection: string }>).map((item) => ({ id: item.id, contentDigest: item.contentDigest, label: `Documented finding: ${item.sourceDocument} — ${item.sourceSection}` }));
  const claims = (db.prepare("SELECT id, ordinal, claim_text AS text FROM material_draft_claims WHERE draft_id = ? ORDER BY ordinal").all(draftId) as Array<{ id: string; ordinal: number; text: string }>).map((claim) => ({
    ...claim,
    evidence: (db.prepare("SELECT e.id, e.source_document AS sourceDocument, e.source_section AS sourceSection FROM material_claim_support s JOIN evidence_revisions e ON e.id = s.evidence_revision_id WHERE s.claim_id = ? ORDER BY e.source_document, e.source_section, e.id").all(claim.id) as Array<{ id: string; sourceDocument: string; sourceSection: string }>).map((item) => ({ id: item.id, label: `Documented finding: ${item.sourceDocument} — ${item.sourceSection}` })),
  }));
  return { id: row.id, profileRevisionId: row.profileRevisionId, profileDigest: row.profileDigest, candidateProfileJson: row.candidateProfileJson ?? undefined, templateId: row.templateId, templateDigest: row.templateDigest, opportunityRevisionId: row.opportunityRevisionId ?? undefined, opportunityDigest: row.opportunityDigest ?? undefined, opportunityResolved: row.opportunityResolved !== null, contentJson: row.contentJson, contentDigest: row.contentDigest, provenanceDigest: row.provenanceDigest, templateFilename: row.templateFilename, opportunityLabel: row.opportunityLabel ?? undefined, handedOffAt: row.handedOffAt ?? undefined, evidence, claims };
}

export function insertMaterialDraftHandoff(db: DatabaseSync, item: { id: string; draftId: string; createdAt: string }): void { db.prepare("INSERT INTO material_draft_handoffs (id, draft_id, destination, created_at) VALUES (?, ?, 'review', ?)").run(item.id, item.draftId, item.createdAt); }
