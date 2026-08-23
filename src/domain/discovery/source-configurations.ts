import { createHash } from "node:crypto";

import { createAuditEvent, createUuidV7 } from "@/audit/audit-event";
import { WorkspaceError } from "@/domain/workspace/types";
import { resolveAppDataPaths } from "@/files/app-data";
import { applyMigrations, openDatabase } from "@/persistence/database";
import { currentSourceConfigurationRevision, insertSourceConfigurationRevision, listCurrentSourceConfigurationRevisions, setCurrentSourceConfigurationRevision, type StoredSourceConfigurationRevision } from "@/persistence/source-configurations-repository";
import { appendAuditEvent } from "@/persistence/workspace-repository";

const sourceTypes = ["job-platform", "company-careers", "public-employment-service"] as const;
const accessPaths = ["manual-browser-handoff", "official-api", "published-feed", "policy-reviewed-html"] as const;
const retrievalAccessPaths = ["official-api", "published-feed", "policy-reviewed-html"] as const;
export type SourceType = typeof sourceTypes[number];
export type SourceAccessPath = typeof accessPaths[number];
export type SourceConfigurationValues = { name: string; sourceType: SourceType; url: string; accessPath: SourceAccessPath; policyRevision: string; policyReviewedOn: string; policyApproved: boolean; requestBudget: number; rateLimitPerMinute: number; retentionRule: string; enabled: boolean; failureGuidance: string };
export type SourceConfiguration = { sourceId: string; revisionId: string; revisionNumber: number; createdAt: string; values: SourceConfigurationValues };
export type SourceConfigurationsView = { configurations: SourceConfiguration[] };
type Options = { appDataRoot?: string };

const manualRule = "No integration-fetched content; locally imported listings follow local lifecycle.";
const manualFailure = "Stop and use the normal site page or manually import a selected listing.";
const manualCareersPolicyRevision = "Manual browser handoff recorded locally.";
export const defaultSourceConfigurations: SourceConfigurationValues[] = ([
  ["LinkedIn Jobs", "https://www.linkedin.com/jobs/", "LinkedIn prohibited-software policy reviewed"], ["JobStreet Philippines", "https://ph.jobstreet.com/", "JobStreet website terms reviewed"], ["Bossjob Philippines", "https://bossjob.ph/", "Bossjob terms reviewed"], ["Indeed Philippines", "https://ph.indeed.com/", "Indeed terms reviewed"], ["Glassdoor", "https://www.glassdoor.com/", "Glassdoor terms reviewed"], ["Kalibrr", "https://www.kalibrr.com/", "Kalibrr terms reviewed"], ["PhilJobNet", "https://philjobnet.gov.ph/job-vacancies/", "PhilJobNet terms reviewed", "public-employment-service"], ["OnlineJobs.ph", "https://www.onlinejobs.ph/jobseekers/jobsearch", "OnlineJobs.ph terms reviewed"],
] as Array<[string, string, string, SourceType?]>)
  .map(([name, url, policyRevision, sourceType = "job-platform"]) => ({ name, sourceType, url, accessPath: "manual-browser-handoff", policyRevision, policyReviewedOn: "2026-08-23", policyApproved: true, requestBudget: 0, rateLimitPerMinute: 0, retentionRule: manualRule, enabled: false, failureGuidance: manualFailure }));

function invalid(summary: string): never { throw new WorkspaceError("SOURCE_CONFIGURATION_INVALID", summary, "Correct the source policy details and try again."); }
function text(value: unknown, label: string, maximum: number): string { if (typeof value !== "string") invalid(`Enter a valid ${label}.`); const normalized = value.trim(); if (!normalized || normalized.length > maximum) invalid(`Enter a valid ${label}.`); return normalized; }
function number(value: unknown, label: string): number { if (!Number.isInteger(value) || typeof value !== "number" || value < 0 || value > 1000) invalid(`Enter a bounded ${label}.`); return value; }
function date(value: unknown): string { const normalized = text(value, "policy review date", 10); const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized); const now = new Date(); const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`; if (!match) invalid("Enter a valid policy review date that is not in the future."); const parsed = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])); if (parsed.getFullYear() !== Number(match[1]) || parsed.getMonth() !== Number(match[2]) - 1 || parsed.getDate() !== Number(match[3]) || normalized > today) invalid("Enter a valid policy review date that is not in the future."); return normalized; }
function unavailable(revisionId?: string): never { throw new WorkspaceError("SOURCE_CONFIGURATION_UNAVAILABLE", "Stored Permitted Sources are unavailable.", "Use Data & Storage to recover the local workspace, then refresh Permitted Sources.", revisionId ? [revisionId] : []); }

export function validateSourceConfiguration(value: SourceConfigurationValues): SourceConfigurationValues {
  const name = text(value.name, "source name", 120); const policyRevision = text(value.policyRevision, "policy revision", 500); const retentionRule = text(value.retentionRule, "retention rule", 500); const failureGuidance = text(value.failureGuidance, "failure guidance", 500);
  if (!sourceTypes.includes(value.sourceType)) invalid("Choose a supported source type.");
  if (!accessPaths.includes(value.accessPath)) invalid("Choose a supported access path.");
  let parsed: URL; try { parsed = new URL(text(value.url, "source URL", 2048)); } catch { invalid("Enter a valid HTTPS source URL."); }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password) invalid("Enter a valid HTTPS source URL.");
  const policyReviewedOn = date(value.policyReviewedOn); const requestBudget = number(value.requestBudget, "request budget"); const rateLimitPerMinute = number(value.rateLimitPerMinute, "rate limit");
  if (typeof value.policyApproved !== "boolean" || typeof value.enabled !== "boolean") invalid("Choose a valid source-policy state.");
  if (value.accessPath === "manual-browser-handoff") {
    if (requestBudget !== 0 || rateLimitPerMinute !== 0 || value.enabled) throw new WorkspaceError("SOURCE_CONFIGURATION_POLICY_UNRESOLVED", "Manual-browser sources cannot be enabled for automated retrieval.", "Keep the source disabled and use the normal site page or manually import a selected listing.");
  } else {
    if (!retrievalAccessPaths.includes(value.accessPath) || requestBudget < 1 || requestBudget > 1000 || rateLimitPerMinute < 1 || rateLimitPerMinute > 120) invalid("Retrieval sources require positive bounded request and rate limits.");
    if (value.enabled && !value.policyApproved) throw new WorkspaceError("SOURCE_CONFIGURATION_POLICY_UNRESOLVED", "This source cannot be enabled until its access policy is explicitly approved.", "Keep the source disabled and use the normal site page or manually import a selected listing.");
    if (value.enabled && Date.parse(`${policyReviewedOn}T00:00:00.000Z`) < Date.now() - 366 * 24 * 60 * 60 * 1000) throw new WorkspaceError("SOURCE_CONFIGURATION_POLICY_UNRESOLVED", "This source policy review is too old to enable retrieval.", "Review the source policy again, or keep the source disabled and use the normal site page.");
  }
  return { name, sourceType: value.sourceType, url: parsed.toString(), accessPath: value.accessPath, policyRevision, policyReviewedOn, policyApproved: value.policyApproved, requestBudget, rateLimitPerMinute, retentionRule, enabled: value.enabled, failureGuidance };
}

export function createManualCareersPageSource(url: unknown, policyReviewedOn = new Date().toISOString().slice(0, 10)): SourceConfigurationValues {
  if (typeof url !== "string" || !url.trim() || url.trim().length > 2048) throw new WorkspaceError("SOURCE_CONFIGURATION_INVALID", "Enter a valid HTTPS careers-page URL without embedded credentials.", "Enter an HTTPS careers-page URL without a username or password.");
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) throw new Error("invalid careers page URL");
  } catch {
    throw new WorkspaceError("SOURCE_CONFIGURATION_INVALID", "Enter a valid HTTPS careers-page URL without embedded credentials.", "Enter an HTTPS careers-page URL without a username or password.");
  }
  return validateSourceConfiguration({
    name: "Company careers page",
    sourceType: "company-careers",
    url,
    accessPath: "manual-browser-handoff",
    policyRevision: manualCareersPolicyRevision,
    policyReviewedOn,
    policyApproved: false,
    requestBudget: 0,
    rateLimitPerMinute: 0,
    retentionRule: manualRule,
    enabled: false,
    failureGuidance: manualFailure,
  });
}

function hash(value: SourceConfigurationValues): string { return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`; }
function toView(revision: StoredSourceConfigurationRevision): SourceConfiguration {
  try {
    return { sourceId: revision.sourceId, revisionId: revision.id, revisionNumber: revision.revisionNumber, createdAt: revision.createdAt, values: validateSourceConfiguration({ name: revision.name, sourceType: revision.sourceType as SourceType, url: revision.url, accessPath: revision.accessPath as SourceAccessPath, policyRevision: revision.policyRevision, policyReviewedOn: revision.policyReviewedOn, policyApproved: revision.policyApproved === 1, requestBudget: revision.requestBudget, rateLimitPerMinute: revision.rateLimitPerMinute, retentionRule: revision.retentionRule, enabled: revision.enabled === 1, failureGuidance: revision.failureGuidance }) };
  } catch { unavailable(revision.id); }
}
function transact<T>(options: Options, work: (database: ReturnType<typeof openDatabase>) => T): Promise<T> { return resolveAppDataPaths(options.appDataRoot).then((paths) => { const database = openDatabase(paths.databasePath); try { applyMigrations(database); database.exec("BEGIN IMMEDIATE;"); try { const result = work(database); database.exec("COMMIT;"); return result; } catch (error) { database.exec("ROLLBACK;"); throw error; } } finally { database.close(); } }); }

export async function listSourceConfigurations(options: Options = {}): Promise<SourceConfigurationsView> { const paths = await resolveAppDataPaths(options.appDataRoot); const database = openDatabase(paths.databasePath); try { applyMigrations(database); return { configurations: listCurrentSourceConfigurationRevisions(database).map(toView) }; } finally { database.close(); } }
export async function saveSourceConfiguration(input: Options & { sourceId?: string; expectedRevisionId?: string; values: SourceConfigurationValues }): Promise<SourceConfiguration> {
  const values = validateSourceConfiguration(input.values);
  return transact(input, (database) => {
    const sourceId = input.sourceId || createUuidV7(); const previous = currentSourceConfigurationRevision(database, sourceId);
    if (previous && input.expectedRevisionId !== previous.id) throw new WorkspaceError("SOURCE_CONFIGURATION_STALE", "Permitted Sources changed before this save completed.", "Refresh Permitted Sources, review the latest saved value, and try again.", [previous.id]);
    if (!previous && input.expectedRevisionId) throw new WorkspaceError("SOURCE_CONFIGURATION_STALE", "Permitted Sources changed before this save completed.", "Refresh Permitted Sources and try again.");
    const createdAt = new Date().toISOString(); const revision: StoredSourceConfigurationRevision = { id: createUuidV7(), sourceId, revisionNumber: (previous?.revisionNumber ?? 0) + 1, name: values.name, sourceType: values.sourceType, url: values.url, accessPath: values.accessPath, policyRevision: values.policyRevision, policyReviewedOn: values.policyReviewedOn, policyApproved: values.policyApproved ? 1 : 0, requestBudget: values.requestBudget, rateLimitPerMinute: values.rateLimitPerMinute, retentionRule: values.retentionRule, enabled: values.enabled ? 1 : 0, failureGuidance: values.failureGuidance, contentDigest: hash(values), createdAt };
    insertSourceConfigurationRevision(database, revision); setCurrentSourceConfigurationRevision(database, sourceId, revision.id, createdAt); appendAuditEvent(database, createAuditEvent({ actor: "local-os-user", action: "discovery.source_configuration_saved", outcome: "success", entityId: revision.id, contentHash: revision.contentDigest })); return toView(revision);
  });
}
