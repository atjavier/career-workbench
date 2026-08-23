import { createHash } from "node:crypto";

import { createAuditEvent, createUuidV7 } from "@/audit/audit-event";
import { resolveAppDataPaths } from "@/files/app-data";
import { applyMigrations, openDatabase } from "@/persistence/database";
import { currentJobPreferenceRevision, insertJobPreferenceRevision, setCurrentJobPreferenceRevision, type StoredJobPreferenceRevision } from "@/persistence/job-preferences-repository";
import { appendAuditEvent } from "@/persistence/workspace-repository";
import { WorkspaceError } from "@/domain/workspace/types";

const roleIntentValues = ["fresh-graduate", "junior", "associate", "cadetship", "paid-training"] as const;
const countryValues = ["PH", "SG", "AU", "CA", "GB", "JP", "US"] as const;
const workStyleValues = ["remote", "hybrid", "onsite"] as const;
export type RoleIntent = typeof roleIntentValues[number];
export type Country = typeof countryValues[number];
export type WorkStyle = typeof workStyleValues[number];
export type JobPreferences = { roleIntents: RoleIntent[]; country: Country; workStyleOrder: WorkStyle[]; preferNcrHybridOnsite: boolean };
export type JobPreferencesState = { values: JobPreferences; revisionId?: string; revisionNumber?: number; createdAt?: string };
type Options = { appDataRoot?: string };

export const defaultJobPreferences: JobPreferences = { roleIntents: [...roleIntentValues], country: "PH", workStyleOrder: ["remote", "hybrid", "onsite"], preferNcrHybridOnsite: true };
const hash = (value: JobPreferences) => `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;

function invalid(message: string): never { throw new WorkspaceError("JOB_PREFERENCES_INVALID", message, "Correct the Search Preferences selections and try again."); }
function exactValues<T extends string>(values: unknown, allowed: readonly T[], label: string, minimum: number): T[] {
  if (!Array.isArray(values) || values.length < minimum || values.length > allowed.length || values.some((value) => typeof value !== "string" || !allowed.includes(value as T)) || new Set(values).size !== values.length) invalid(`Choose valid ${label} values.`);
  return [...values] as T[];
}

export function validateJobPreferences(value: JobPreferences): JobPreferences {
  const roleIntents = exactValues(value.roleIntents, roleIntentValues, "role intent", 1);
  const workStyleOrder = exactValues(value.workStyleOrder, workStyleValues, "work-style priority", workStyleValues.length);
  if (workStyleOrder.length !== workStyleValues.length || !countryValues.includes(value.country)) invalid("Choose a supported country and complete work-style priority.");
  if (typeof value.preferNcrHybridOnsite !== "boolean") invalid("Choose whether to prioritize NCR for Hybrid and Onsite roles.");
  return { roleIntents, country: value.country, workStyleOrder, preferNcrHybridOnsite: value.preferNcrHybridOnsite };
}

function toState(revision: StoredJobPreferenceRevision): JobPreferencesState {
  try {
    const values = validateJobPreferences({ roleIntents: JSON.parse(revision.roleIntents) as RoleIntent[], country: revision.country as Country, workStyleOrder: JSON.parse(revision.workStyleOrder) as WorkStyle[], preferNcrHybridOnsite: revision.preferNcrHybridOnsite === 1 });
    return { values, revisionId: revision.id, revisionNumber: revision.revisionNumber, createdAt: revision.createdAt };
  } catch {
    throw new WorkspaceError("JOB_PREFERENCES_UNAVAILABLE", "Stored Search Preferences are unavailable.", "Use Data & Storage to recover the local workspace, then refresh Search Preferences.", [revision.id]);
  }
}

function transact<T>(options: Options, work: (database: ReturnType<typeof openDatabase>) => T): Promise<T> {
  return resolveAppDataPaths(options.appDataRoot).then((paths) => {
    const database = openDatabase(paths.databasePath);
    try {
      applyMigrations(database); database.exec("BEGIN IMMEDIATE;");
      try { const result = work(database); database.exec("COMMIT;"); return result; } catch (error) { database.exec("ROLLBACK;"); throw error; }
    } finally { database.close(); }
  });
}

export async function listJobPreferences(options: Options = {}): Promise<JobPreferencesState> {
  const paths = await resolveAppDataPaths(options.appDataRoot);
  const database = openDatabase(paths.databasePath);
  try {
    applyMigrations(database);
    const current = currentJobPreferenceRevision(database);
    return current ? toState(current) : { values: { ...defaultJobPreferences, roleIntents: [...defaultJobPreferences.roleIntents], workStyleOrder: [...defaultJobPreferences.workStyleOrder] }, revisionId: undefined, revisionNumber: undefined, createdAt: undefined };
  } finally { database.close(); }
}

export async function saveJobPreferences(input: Options & { expectedRevisionId?: string; values: JobPreferences }): Promise<JobPreferencesState> {
  const values = validateJobPreferences(input.values);
  return transact(input, (database) => {
    const previous = currentJobPreferenceRevision(database);
    if (previous && input.expectedRevisionId !== previous.id) throw new WorkspaceError("JOB_PREFERENCES_STALE", "Search Preferences changed before this save completed.", "Refresh Search Preferences, review the latest saved values, and try again.", [previous.id]);
    if (!previous && input.expectedRevisionId) throw new WorkspaceError("JOB_PREFERENCES_STALE", "Search Preferences changed before this save completed.", "Refresh Search Preferences and try again.");
    const revision: StoredJobPreferenceRevision = { id: createUuidV7(), revisionNumber: (previous?.revisionNumber ?? 0) + 1, roleIntents: JSON.stringify(values.roleIntents), country: values.country, workStyleOrder: JSON.stringify(values.workStyleOrder), preferNcrHybridOnsite: values.preferNcrHybridOnsite ? 1 : 0, contentDigest: hash(values), createdAt: new Date().toISOString() };
    insertJobPreferenceRevision(database, revision);
    setCurrentJobPreferenceRevision(database, revision.id, revision.createdAt);
    appendAuditEvent(database, createAuditEvent({ actor: "local-os-user", action: "discovery.preferences_saved", outcome: "success", entityId: revision.id, contentHash: revision.contentDigest }));
    return toState(revision);
  });
}
