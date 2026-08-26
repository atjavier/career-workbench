import { createHash } from "node:crypto";

import { createAuditEvent, createUuidV7 } from "@/audit/audit-event";
import { localModelCapabilityVersion } from "@/adapters/local-model/local-model-gateway";
import type { ResumeCoachResponse } from "@/adapters/local-model/local-model-gateway";
import { applyMigrations, openDatabase } from "@/persistence/database";
import { insertMaterialClaimSupport, insertMaterialDraft, insertMaterialDraftClaim, insertMaterialDraftEvidence } from "@/persistence/material-draft-repository";
import { appendAuditEvent } from "@/persistence/workspace-repository";

const digest = (value: unknown) => `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
export type PersistResumeCoachDraftInput = { databasePath: string; profileRevisionId: string; profileDigest: string; templateId: string; templateDigest: string; evidence: Array<{ id: string; contentDigest: string }>; opportunity?: { revisionId: string; contentDigest: string }; requestText: string; consentFingerprint: string; response: ResumeCoachResponse };

export function persistResumeCoachDraft(input: PersistResumeCoachDraftInput): { id: string } {
  const db = openDatabase(input.databasePath); const now = new Date().toISOString(); const id = createUuidV7();
  try { applyMigrations(db); db.exec("BEGIN IMMEDIATE;"); try {
    const contentJson = JSON.stringify(input.response); const requestDigest = digest(input.requestText); const contentDigest = digest(contentJson); const provenanceDigest = digest({ capability: localModelCapabilityVersion("resume-coach"), profile: { revisionId: input.profileRevisionId, contentDigest: input.profileDigest }, template: { id: input.templateId, contentDigest: input.templateDigest }, evidence: input.evidence.map(({ id, contentDigest }) => ({ id, contentDigest })).sort((left, right) => left.id.localeCompare(right.id)), opportunity: input.opportunity ? { revisionId: input.opportunity.revisionId, contentDigest: input.opportunity.contentDigest } : null, consent: input.consentFingerprint });
    insertMaterialDraft(db, { id, profileRevisionId: input.profileRevisionId, profileDigest: input.profileDigest, templateId: input.templateId, templateDigest: input.templateDigest, opportunityRevisionId: input.opportunity?.revisionId, opportunityDigest: input.opportunity?.contentDigest, requestText: input.requestText, requestDigest, contentJson, contentDigest, provenanceDigest, createdAt: now });
    for (const evidence of input.evidence) insertMaterialDraftEvidence(db, id, evidence.id);
    input.response.claims.forEach((claim, ordinal) => { const claimId = createUuidV7(); insertMaterialDraftClaim(db, { id: claimId, draftId: id, ordinal, text: claim.text, createdAt: now }); for (const index of [...new Set(claim.evidenceIndexes)]) insertMaterialClaimSupport(db, claimId, input.evidence[index]!.id); });
    appendAuditEvent(db, createAuditEvent({ actor: "local-os-user", action: "resume.material_draft_created", outcome: "success", entityId: id, contentHash: contentDigest })); db.exec("COMMIT;"); return { id };
  } catch (error) { db.exec("ROLLBACK;"); throw error; }
  } finally { db.close(); }
}
