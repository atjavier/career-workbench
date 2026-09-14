import { createHash } from "node:crypto";

import { createAuditEvent, createUuidV7 } from "@/audit/audit-event";
import { WorkspaceError } from "@/domain/workspace/types";
import { resolveAppDataPaths } from "@/files/app-data";
import { readResumeGenerationState } from "@/persistence/candidate-profile-repository";
import { applyMigrations, openDatabase } from "@/persistence/database";
import {
  findLocalModelConfiguration,
  insertLocalModelConfiguration,
  selectLocalModelConfiguration,
  type LocalModelConfiguration,
} from "@/persistence/local-model-configuration-repository";
import { appendAuditEvent } from "@/persistence/workspace-repository";

const modelsEndpoint = "http://127.0.0.1:1234/api/v1/models";
const configurationEndpoint = "http://127.0.0.1:1234/v1" as const;
const plain = (value: unknown, maximum: number) =>
  typeof value === "string" &&
  value.length > 0 &&
  value.length <= maximum &&
  !/[\u0000-\u001f\u007f-\u009f]/.test(value);
const digest = (value: unknown) =>
  `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;

export type LocalModelReadiness = {
  ready: boolean;
  displayLabel?: "Qwen3.5-9B";
};
export type ConfigureLocalModelInput = {
  appDataRoot?: string;
  modelIdentifier: string;
  fetcher?: typeof fetch;
};
export type LocalModelGatewayConfiguration = Pick<
  LocalModelConfiguration,
  "id" | "modelIdentifier" | "configurationDigest"
> & { contextLimitTokens?: number };
export type EditableTexModelConfiguration = LocalModelGatewayConfiguration & {
  contextLimitTokens: number;
};

function unavailable(
  summary: string,
  next = "Open Settings and verify LM Studio on this computer.",
): never {
  throw new WorkspaceError(
    "LOCAL_MODEL_CONFIGURATION_UNAVAILABLE",
    summary,
    next,
  );
}
function invalid(
  summary: string,
  next = "Choose a loaded Qwen3.5-9B model and try again.",
): never {
  throw new WorkspaceError("LOCAL_MODEL_CONFIGURATION_INVALID", summary, next);
}
function validQwenIdentifier(value: string): boolean {
  return /qwen/i.test(value) && /3[._-]?5/i.test(value) && /9\s*b/i.test(value);
}

async function verifyModel(
  modelIdentifier: string,
  fetcher: typeof fetch,
): Promise<number> {
  let response: Response;
  try {
    response = await fetcher(modelsEndpoint, {
      method: "GET",
      headers: { accept: "application/json" },
    });
  } catch {
    unavailable("Local AI is unavailable right now.");
  }
  if (!response!.ok)
    unavailable("Local AI could not be verified right now.");
  let body: unknown;
  try {
    body = await response!.json();
  } catch {
    invalid("LM Studio returned an unsafe model list.");
  }
  const models =
    body &&
    typeof body === "object" &&
    Array.isArray((body as { models?: unknown }).models)
      ? (body as { models: unknown[] }).models
      : undefined;
  const matched = models?.find((candidate) => {
    if (!candidate || typeof candidate !== "object") return false;
    const model = candidate as {
      type?: unknown;
      key?: unknown;
      display_name?: unknown;
      params_string?: unknown;
      loaded_instances?: unknown;
    };
    return (
      model.type === "llm" &&
      model.key === modelIdentifier &&
      validQwenIdentifier(
        `${String(model.key)} ${String(model.display_name ?? "")} ${String(model.params_string ?? "")}`,
      ) &&
      Array.isArray(model.loaded_instances) &&
      model.loaded_instances.length > 0
    );
  }) as { loaded_instances: unknown[] } | undefined;
  if (!matched)
    invalid(
      "Choose a loaded Qwen3.5-9B model before saving Local AI settings.",
    );
  const contexts = matched.loaded_instances.map((instance) =>
    instance && typeof instance === "object"
      ? ((instance as { context_length?: unknown }).context_length ??
        (instance as { contextLength?: unknown }).contextLength)
      : undefined,
  );
  if (
    contexts.some(
      (value) =>
        typeof value !== "number" ||
        !Number.isInteger(value) ||
        value < 12_001,
    )
  )
    invalid(
      "Every loaded LM Studio instance must report its context limit before complete editable TeX drafts can be enabled.",
    );
  // LM Studio selects the serving instance. Budget against the smallest loaded
  // instance rather than assuming the first or largest instance receives it.
  return Math.min(...(contexts as number[]), 30_000);
}

export async function configureLocalModel(
  input: ConfigureLocalModelInput,
): Promise<LocalModelReadiness> {
  const modelIdentifier = input.modelIdentifier.trim();
  const fetcher = input.fetcher ?? fetch;
  if (!plain(modelIdentifier, 240) || !validQwenIdentifier(modelIdentifier))
    invalid("Enter a valid loaded Qwen3.5-9B model.");
  const contextLimitTokens = await verifyModel(modelIdentifier, fetcher);
  const paths = await resolveAppDataPaths(input.appDataRoot);
  const now = new Date().toISOString();
  const configuration: LocalModelConfiguration = {
    id: createUuidV7(),
    endpoint: configurationEndpoint,
    modelIdentifier,
    displayLabel: "Qwen3.5-9B",
    secretReference: createUuidV7(),
    configurationDigest: digest({
      endpoint: configurationEndpoint,
      modelIdentifier,
      displayLabel: "Qwen3.5-9B",
      contextLimitTokens,
    }),
    createdAt: now,
  };
  const db = openDatabase(paths.databasePath);
  try {
    applyMigrations(db);
    db.exec("BEGIN IMMEDIATE;");
    try {
      const state = readResumeGenerationState(db);
      insertLocalModelConfiguration(db, configuration);
      db.prepare(
        "INSERT INTO local_model_configuration_context_limits (configuration_id, context_limit_tokens, observed_at) VALUES (?, ?, ?)",
      ).run(configuration.id, contextLimitTokens, now);
      const next = selectLocalModelConfiguration(
        db,
        state.revisionNumber,
        configuration.id,
        now,
      );
      if (!next)
        throw new WorkspaceError(
          "LOCAL_MODEL_CONFIGURATION_STALE",
          "Local AI settings changed before they could be saved.",
          "Refresh Settings and verify the model again.",
        );
      appendAuditEvent(
        db,
        createAuditEvent({
          actor: "local-os-user",
          action: "local_model.configured",
          outcome: "success",
          entityId: configuration.id,
          contentHash: configuration.configurationDigest,
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
  return { ready: true, displayLabel: "Qwen3.5-9B" };
}

/** Shared local-model consumers remain compatible with pre-context-limit settings. */
export async function readLocalModelGatewayConfiguration(
  input: { appDataRoot?: string } = {},
): Promise<LocalModelGatewayConfiguration> {
  const paths = await resolveAppDataPaths(input.appDataRoot);
  const db = openDatabase(paths.databasePath);
  let item: LocalModelConfiguration | undefined;
  let contextLimitTokens: number | undefined;
  try {
    applyMigrations(db);
    const state = readResumeGenerationState(db);
    item = state.currentModelConfigurationRevisionId
      ? findLocalModelConfiguration(db, state.currentModelConfigurationRevisionId)
      : undefined;
    const row = item
      ? (db
          .prepare(
            "SELECT context_limit_tokens FROM local_model_configuration_context_limits WHERE configuration_id = ?",
          )
          .get(item.id) as { context_limit_tokens?: unknown } | undefined)
      : undefined;
    if (
      typeof row?.context_limit_tokens === "number" &&
      Number.isInteger(row.context_limit_tokens) &&
      row.context_limit_tokens >= 12_001 &&
      row.context_limit_tokens <= 30_000
    )
      contextLimitTokens = row.context_limit_tokens;
  } finally {
    db.close();
  }
  if (!item) unavailable("Local AI has not been configured on this computer.");
  return {
    id: item.id,
    modelIdentifier: item.modelIdentifier,
    configurationDigest: item.configurationDigest,
    contextLimitTokens,
  };
}

/** Complete TeX packets require a context limit observed during configuration. */
export async function readEditableTexModelConfiguration(
  input: { appDataRoot?: string } = {},
): Promise<EditableTexModelConfiguration> {
  const item = await readLocalModelGatewayConfiguration(input);
  if (item.contextLimitTokens === undefined)
    unavailable(
      "Local AI must be verified again before it can receive a complete editable TeX packet.",
      "Open Settings, verify the loaded model and its context limit, then try again.",
    );
  return { ...item, contextLimitTokens: item.contextLimitTokens };
}

export async function readLocalModelReadiness(
  input: { appDataRoot?: string } = {},
): Promise<LocalModelReadiness> {
  try {
    await readLocalModelGatewayConfiguration(input);
    return { ready: true, displayLabel: "Qwen3.5-9B" };
  } catch {
    return { ready: false };
  }
}
