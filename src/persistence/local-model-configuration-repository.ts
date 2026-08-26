import type { DatabaseSync } from "node:sqlite";

import type { ResumeGenerationState } from "@/persistence/candidate-profile-repository";

export type LocalModelConfiguration = { id: string; endpoint: "http://127.0.0.1:1234/v1"; modelIdentifier: string; displayLabel: "Qwen3.5-9B"; secretReference: string; configurationDigest: string; createdAt: string };

function config(row: Record<string, unknown>): LocalModelConfiguration {
  return { id: String(row.id), endpoint: "http://127.0.0.1:1234/v1", modelIdentifier: String(row.model_identifier), displayLabel: "Qwen3.5-9B", secretReference: String(row.secret_reference), configurationDigest: String(row.configuration_digest), createdAt: String(row.created_at) };
}

export function findLocalModelConfiguration(db: DatabaseSync, id: string): LocalModelConfiguration | undefined {
  const row = db.prepare("SELECT id, endpoint, model_identifier, display_label, secret_reference, configuration_digest, created_at FROM local_model_configuration_revisions WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  return row ? config(row) : undefined;
}

export function insertLocalModelConfiguration(db: DatabaseSync, item: LocalModelConfiguration): void {
  db.prepare("INSERT INTO local_model_configuration_revisions (id, endpoint, model_identifier, display_label, secret_reference, configuration_digest, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(item.id, item.endpoint, item.modelIdentifier, item.displayLabel, item.secretReference, item.configurationDigest, item.createdAt);
}

export function selectLocalModelConfiguration(db: DatabaseSync, expectedRevisionNumber: number, configurationId: string, updatedAt: string): ResumeGenerationState | undefined {
  const result = db.prepare("UPDATE resume_generation_state SET current_model_configuration_revision_id = ?, revision_number = revision_number + 1, updated_at = ? WHERE singleton = 1 AND revision_number = ?").run(configurationId, updatedAt, expectedRevisionNumber);
  if (result.changes !== 1) return undefined;
  const row = db.prepare("SELECT active_profile_revision_id, designated_template_id, current_model_configuration_revision_id, revision_number, updated_at FROM resume_generation_state WHERE singleton = 1").get() as Record<string, unknown>;
  return { activeProfileRevisionId: row.active_profile_revision_id ? String(row.active_profile_revision_id) : undefined, designatedTemplateId: row.designated_template_id ? String(row.designated_template_id) : undefined, currentModelConfigurationRevisionId: row.current_model_configuration_revision_id ? String(row.current_model_configuration_revision_id) : undefined, revisionNumber: Number(row.revision_number), updatedAt: String(row.updated_at) };
}
