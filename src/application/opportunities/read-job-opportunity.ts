import { jobOpportunityReaderDefinition, validateJobOpportunityReaderOutput } from "@/domain/opportunities/job-opportunity-reader-contract";
import { resolveAppDataPaths } from "@/files/app-data";
import { openDatabase } from "@/persistence/database";
import { findLocalModelConfiguration } from "@/persistence/local-model-configuration-repository";
import { requestJobOpportunityReader, type LocalModelConnection } from "@/adapters/local-model/local-model-gateway";
import { WorkspaceError } from "@/domain/workspace/types";
import { validateOpportunitySource, type OpportunitySource } from "@/domain/opportunities/opportunity-source";
import { formatRoleTitle, refineOpportunityDescription } from "@/domain/opportunities/refined-description";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { privateAppDataRoot } from "@/files/app-data";
export async function readJobOpportunity(input: OpportunitySource, options: { appDataRoot?: string; connection?: LocalModelConnection; request?: typeof requestJobOpportunityReader } = {}) {
  validateOpportunitySource(input);
  let connection = options.connection;
  if (!connection) {
    const root = options.appDataRoot ?? privateAppDataRoot();
    if (!existsSync(join(root, "workspace.sqlite"))) throw new WorkspaceError("OPPORTUNITY_DRAFT_UNAVAILABLE", "Set up local AI before adding opportunities with AI.", "Open Settings to configure local AI, then try again.");
    const paths = await resolveAppDataPaths(root);
    const db = openDatabase(paths.databasePath);
    try {
      const state = db.prepare("SELECT current_model_configuration_revision_id AS id FROM resume_generation_state WHERE singleton = 1").get() as { id?: string } | undefined;
      const model = state?.id ? findLocalModelConfiguration(db, state.id) : undefined;
      if (!model) throw new WorkspaceError("OPPORTUNITY_DRAFT_UNAVAILABLE", "Local AI is not configured.", "Open Settings to configure local AI, then try again.");
      connection = { configurationRevisionId: model.id, configurationDigest: model.configurationDigest, modelIdentifier: model.modelIdentifier };
    } finally { db.close(); }
  }
  // The reference URL never enters the model packet or a web retrieval path.
  const read = options.request ?? requestJobOpportunityReader;
  const output = await read(connection, input.copiedDescription);
  const fields = validateJobOpportunityReaderOutput(output, input.copiedDescription);
  const unresolvedFields = jobOpportunityReaderDefinition.identityFields.filter(field => !fields[field]);
  if (unresolvedFields.length) {
    try {
      const retry = await read(connection, input.copiedDescription, undefined, { unresolvedFields });
      const recovered = validateJobOpportunityReaderOutput(retry, input.copiedDescription);
      for (const field of unresolvedFields) fields[field] = recovered[field];
    } catch { /* Preserve validated fields and genuine unknowns if recovery fails. */ }
  }
  return { ...fields, title: formatRoleTitle(fields.title), refinedDescription: refineOpportunityDescription(output, input.copiedDescription) };
}
