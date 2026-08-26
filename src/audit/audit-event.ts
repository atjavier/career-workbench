import { randomBytes } from "node:crypto";

import { WorkspaceError } from "@/domain/workspace/types";

export type AuditEventInput = {
  actor: "local-os-user";
  action: "workspace.initialized" | "workspace.validated" | "base_resume.imported" | "base_resume.import_failed" | "current_base_resume.imported" | "current_base_resume.import_failed" | "current_base_resume.draft_saved" | "current_base_resume.proposals_generated" | "current_base_resume.proposal_resolved" | "current_base_resume.version_approved" | "current_base_resume.failed" | "resume.profile_saved" | "resume.template_designated" | "resume.coach_requested" | "resume.coach_failed" | "resume.material_draft_created" | "resume.material_draft_handed_off" | "local_model.configured" | "evidence.added" | "evidence.extracted" | "evidence.approved" | "evidence.edited" | "evidence.rejected" | "evidence.removed" | "evidence.failed" | "evidence.library_imported" | "evidence.library_candidate_created" | "evidence.library_failed" | "evidence.documenter_proposed" | "evidence.documenter_resolved" | "evidence.documenter_failed" | "discovery.preferences_saved" | "discovery.source_configuration_saved" | "discovery.refresh_started" | "discovery.refresh_finished" | "discovery.refresh_failed" | "discovery.job_listing_imported" | "discovery.duplicate_override_applied" | "discovery.duplicate_override_reversed" | "opportunity.captured" | "fit.assessment_calculated" | "opportunity.assessment_calculated" | "opportunity.decision_recorded" | "data.backup_created" | "data.history_exported" | "data.trashed" | "data.restored" | "data.expired_cleanup" | "data.permanently_deleted" | "data.failed";
  outcome: "success" | "failure";
  entityId?: string;
  contentHash?: string;
};

export type AuditEvent = AuditEventInput & {
  id: string;
  occurredAt: string;
};

const forbiddenAuditKeys = new Set([
  "credential",
  "credentials",
  "document",
  "prompt",
  "response",
  "resume",
  "token",
  "unsafePayload",
]);

export function createUuidV7(): string {
  const bytes = randomBytes(16);
  const timestamp = BigInt(Date.now());

  for (let index = 0; index < 6; index += 1) {
    bytes[index] = Number((timestamp >> BigInt((5 - index) * 8)) & 0xffn);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function createAuditEvent(input: AuditEventInput): AuditEvent {
  const allowedKeys = new Set(["actor", "action", "outcome", "entityId", "contentHash"]);
  if (Object.keys(input).some((key) => forbiddenAuditKeys.has(key) || !allowedKeys.has(key))) {
    throw new WorkspaceError(
      "AUDIT_PAYLOAD_FORBIDDEN",
      "Sensitive content cannot be written to the audit trail.",
      "Remove sensitive content and record metadata only.",
    );
  }

  if (input.entityId && !/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.entityId)) {
    throw new WorkspaceError("AUDIT_PAYLOAD_FORBIDDEN", "Audit entity IDs must be UUIDv7 values.", "Record a UUIDv7 entity identifier.");
  }
  if (input.contentHash && !/^sha256:[0-9a-f]{64}$/i.test(input.contentHash)) {
    throw new WorkspaceError("AUDIT_PAYLOAD_FORBIDDEN", "Audit content hashes must be SHA-256 digests.", "Record a SHA-256 digest instead of content.");
  }

  return { ...input, id: createUuidV7(), occurredAt: new Date().toISOString() };
}
