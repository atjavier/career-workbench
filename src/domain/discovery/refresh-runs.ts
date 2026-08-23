import { createHash } from "node:crypto";

import { createAuditEvent, createUuidV7 } from "@/audit/audit-event";
import { adapterKey, sourceAdapterRegistry, type SourceAdapter, type SourceAdapterResult } from "@/adapters/sources/source-adapter";
import { validateSourceConfiguration, type SourceConfiguration } from "@/domain/discovery/source-configurations";
import { WorkspaceError } from "@/domain/workspace/types";
import { resolveAppDataPaths } from "@/files/app-data";
import { applyMigrations, openDatabase } from "@/persistence/database";
import { failRefreshRun, finalizeRefreshRun, insertRefreshRun, insertRefreshSourceOutcome, listRefreshRuns as listRefreshRunsRepository, type StoredRefreshSourceOutcome } from "@/persistence/refresh-runs-repository";
import { listCurrentSourceConfigurationRevisions } from "@/persistence/source-configurations-repository";
import { appendAuditEvent } from "@/persistence/workspace-repository";

type Options = { appDataRoot?: string; registry?: Map<string, SourceAdapter>; timeoutMs?: number };
export type RefreshSourceOutcome = Omit<StoredRefreshSourceOutcome, "contentDigest"> & { sourceName?: string };
export type RefreshRun = { id: string; status: "running" | "completed" | "partial" | "failed"; selectedSourceCount: number; startedAt: string; completedAt: string; outcomes: RefreshSourceOutcome[] };
export type RefreshRunsView = { runs: RefreshRun[]; eligibleSources: Array<Pick<SourceConfiguration, "sourceId" | "revisionId" | "values">> };
type Candidate = SourceConfiguration;

const digest = (value: unknown) => `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
const failedGuidance = "Review the source outcome and try a later explicit refresh after resolving the source issue.";
const timeoutGuidance = "The bounded source attempt timed out. Review the source policy and try a later explicit refresh.";
const runStatus = (outcomes: RefreshSourceOutcome[]): Exclude<RefreshRun["status"], "running"> => outcomes.every((outcome) => outcome.status === "failed" || outcome.status === "blocked" || outcome.status === "throttled") ? "failed" : outcomes.some((outcome) => outcome.status !== "completed") ? "partial" : "completed";
const sourceLocks = new Map<string, Promise<void>>();

function toConfiguration(value: ReturnType<typeof listCurrentSourceConfigurationRevisions>[number]): SourceConfiguration {
  const values = validateSourceConfiguration({ name: value.name, sourceType: value.sourceType as SourceConfiguration["values"]["sourceType"], url: value.url, accessPath: value.accessPath as SourceConfiguration["values"]["accessPath"], policyRevision: value.policyRevision, policyReviewedOn: value.policyReviewedOn, policyApproved: value.policyApproved === 1, requestBudget: value.requestBudget, rateLimitPerMinute: value.rateLimitPerMinute, retentionRule: value.retentionRule, enabled: value.enabled === 1, failureGuidance: value.failureGuidance });
  return { sourceId: value.sourceId, revisionId: value.id, revisionNumber: value.revisionNumber, createdAt: value.createdAt, values };
}

async function withDatabase<T>(options: Options, write: boolean, work: (database: ReturnType<typeof openDatabase>) => T): Promise<T> {
  const paths = await resolveAppDataPaths(options.appDataRoot); const database = openDatabase(paths.databasePath);
  try { applyMigrations(database); if (!write) return work(database); database.exec("BEGIN IMMEDIATE;"); try { const result = work(database); database.exec("COMMIT;"); return result; } catch (error) { database.exec("ROLLBACK;"); throw error; } } finally { database.close(); }
}

function eligible(source: SourceConfiguration): boolean { return source.values.enabled && source.values.policyApproved && source.values.accessPath !== "manual-browser-handoff" && source.values.requestBudget > 0 && source.values.rateLimitPerMinute > 0; }
function toOutcome(source: Candidate, refreshRunId: string, status: RefreshSourceOutcome["status"], requestCount: number, recoveryGuidance: string, startedAt: string): RefreshSourceOutcome { const guidance = recoveryGuidance.trim().slice(0, 500) || failedGuidance; return { id: createUuidV7(), refreshRunId, sourceId: source.sourceId, sourceConfigurationRevisionId: source.revisionId, sourceName: source.values.name, status, requestCount, recoveryGuidance: guidance, startedAt, completedAt: new Date().toISOString() }; }
function validStatus(value: unknown): value is SourceAdapterResult["status"] { return value === "completed" || value === "partial" || value === "failed" || value === "blocked" || value === "throttled"; }
function normalizeResult(result: SourceAdapterResult): { status: RefreshSourceOutcome["status"]; recoveryGuidance: string } {
  if (!result || typeof result !== "object" || !validStatus(result.status)) return { status: "failed", recoveryGuidance: failedGuidance };
  if (result.httpStatus === 429) return { status: "throttled", recoveryGuidance: result.recoveryGuidance ?? failedGuidance };
  if (result.httpStatus === 401 || result.httpStatus === 403) return { status: "blocked", recoveryGuidance: result.recoveryGuidance ?? failedGuidance };
  return { status: result.status, recoveryGuidance: result.recoveryGuidance ?? failedGuidance };
}
async function withSourceLock<T>(key: string, work: () => Promise<T>): Promise<T> {
  const previous = sourceLocks.get(key) ?? Promise.resolve(); let release!: () => void; const current = new Promise<void>((resolve) => { release = resolve; }); sourceLocks.set(key, previous.then(() => current));
  await previous; try { return await work(); } finally { release(); if (sourceLocks.get(key) === current) sourceLocks.delete(key); }
}
async function runAdapter(adapter: SourceAdapter, source: Candidate, timeoutMs: number, consumeRequest: () => void): Promise<{ status: RefreshSourceOutcome["status"]; recoveryGuidance: string }> {
  if (adapter.sourceId !== source.sourceId || adapter.sourceConfigurationRevisionId !== source.revisionId) return { status: "blocked", recoveryGuidance: source.values.failureGuidance };
  const signal = AbortSignal.timeout(timeoutMs); const timeout = new Promise<never>((_, reject) => signal.addEventListener("abort", () => reject(new WorkspaceError("REFRESH_UNAVAILABLE", timeoutGuidance, timeoutGuidance)), { once: true }));
  const result = await Promise.race([adapter.refresh({ source, signal, consumeRequest }), timeout]);
  return normalizeResult(result);
}

export async function listRefreshRuns(options: Options = {}): Promise<RefreshRunsView> {
  return withDatabase(options, false, (database) => {
    const sources = listCurrentSourceConfigurationRevisions(database).map(toConfiguration);
    const sourceNames = new Map(sources.map((source) => [source.sourceId, source.values.name]));
    const runs = listRefreshRunsRepository(database).map((run) => ({ id: run.id, status: run.status, selectedSourceCount: run.selectedSourceCount, startedAt: run.startedAt, completedAt: run.completedAt ?? run.startedAt, outcomes: run.outcomes.map(({ contentDigest: _digest, ...outcome }) => ({ ...outcome, sourceName: sourceNames.get(outcome.sourceId) ?? outcome.sourceId })) }));
    return { runs, eligibleSources: sources.filter(eligible).map((source) => ({ sourceId: source.sourceId, revisionId: source.revisionId, values: source.values })) };
  });
}

export async function startRefreshRun(input: Options & { sourceIds: string[]; confirmed: boolean }): Promise<RefreshRun> {
  if (!input.confirmed) throw new WorkspaceError("REFRESH_INVALID", "Confirm the selected source scope before Refresh now can start.", "Review the selected sources, select Confirm refresh, and try again.");
  if (!Array.isArray(input.sourceIds) || input.sourceIds.length === 0 || input.sourceIds.length > 100 || input.sourceIds.some((id) => typeof id !== "string") || new Set(input.sourceIds).size !== input.sourceIds.length) throw new WorkspaceError("REFRESH_INVALID", "Choose one or more distinct permitted sources to refresh.", "Select enabled permitted sources, then confirm Refresh now.");
  const { runId, startedAt, candidates, registry } = await withDatabase(input, true, (database) => {
    const current = new Map(listCurrentSourceConfigurationRevisions(database).map((value) => [value.sourceId, toConfiguration(value)]));
    const candidates = input.sourceIds.map((id) => current.get(id)).filter((source): source is Candidate => Boolean(source));
    if (candidates.length !== input.sourceIds.length) throw new WorkspaceError("REFRESH_POLICY_UNRESOLVED", "A selected Permitted Source changed or is unavailable.", "Refresh Permitted Sources, review its policy state, and select the current enabled source.");
    if (candidates.some((source) => !eligible(source))) throw new WorkspaceError("REFRESH_POLICY_UNRESOLVED", "Selected sources are not enabled for policy-approved retrieval.", "Use Permitted Sources or the normal browser/manual-import path; no retrieval was started.");
    const runId = createUuidV7(); const startedAt = new Date().toISOString();
    insertRefreshRun(database, { id: runId, selectedSourceCount: candidates.length, status: "running", contentDigest: digest(candidates.map((source) => ({ sourceId: source.sourceId, revisionId: source.revisionId }))), startedAt });
    appendAuditEvent(database, createAuditEvent({ actor: "local-os-user", action: "discovery.refresh_started", outcome: "success", entityId: runId, contentHash: digest({ runId, selectedSourceCount: candidates.length }) }));
    return { runId, startedAt, candidates, registry: input.registry ?? sourceAdapterRegistry };
  });
  const outcomes: RefreshSourceOutcome[] = [];
  for (const source of candidates) {
    const adapter = registry.get(adapterKey(source.sourceId, source.revisionId));
    if (!adapter) { outcomes.push(toOutcome(source, runId, "blocked", 0, source.values.failureGuidance, startedAt)); continue; }
    let requestCount = 0; const attempts: number[] = [];
    const consumeRequest = () => { const now = Date.now(); while (attempts.length && attempts[0] <= now - 60_000) attempts.shift(); if (requestCount >= source.values.requestBudget) throw new WorkspaceError("REFRESH_POLICY_UNRESOLVED", "The source request budget was reached.", source.values.failureGuidance); if (attempts.length >= source.values.rateLimitPerMinute) throw new WorkspaceError("REFRESH_POLICY_UNRESOLVED", "The source rate limit was reached.", source.values.failureGuidance); requestCount += 1; attempts.push(now); };
    const outcome = await withSourceLock(adapterKey(source.sourceId, source.revisionId), async () => {
      try {
        const result = await runAdapter(adapter, source, input.timeoutMs ?? 10_000, consumeRequest);
        return toOutcome(source, runId, result.status, requestCount, result.recoveryGuidance, startedAt);
      } catch (error) {
        const status = error instanceof WorkspaceError && error.code === "REFRESH_POLICY_UNRESOLVED" ? "throttled" : "failed";
        return toOutcome(source, runId, status, requestCount, error instanceof WorkspaceError ? error.safeNextAction : failedGuidance, startedAt);
      }
    });
    try {
      await withDatabase(input, true, (database) => insertRefreshSourceOutcome(database, { ...outcome, contentDigest: digest({ refreshRunId: outcome.refreshRunId, sourceId: outcome.sourceId, revisionId: outcome.sourceConfigurationRevisionId, status: outcome.status, requestCount: outcome.requestCount }) }));
      outcomes.push(outcome);
    } catch (error) {
      await withDatabase(input, true, (database) => { failRefreshRun(database, runId, new Date().toISOString()); appendAuditEvent(database, createAuditEvent({ actor: "local-os-user", action: "discovery.refresh_failed", outcome: "failure", entityId: runId, contentHash: digest({ runId, sourceId: source.sourceId }) })); }).catch(() => undefined);
      throw error;
    }
  }
  const status = runStatus(outcomes); const completedAt = new Date().toISOString();
  try { await withDatabase(input, true, (database) => { finalizeRefreshRun(database, runId, status, completedAt); appendAuditEvent(database, createAuditEvent({ actor: "local-os-user", action: status === "failed" ? "discovery.refresh_failed" : "discovery.refresh_finished", outcome: status === "failed" ? "failure" : "success", entityId: runId, contentHash: digest({ runId, status }) })); }); } catch (error) { await withDatabase(input, true, (database) => { failRefreshRun(database, runId, new Date().toISOString()); appendAuditEvent(database, createAuditEvent({ actor: "local-os-user", action: "discovery.refresh_failed", outcome: "failure", entityId: runId, contentHash: digest({ runId, status: "failed" }) })); }).catch(() => undefined); throw error; }
  return { id: runId, status, selectedSourceCount: candidates.length, startedAt, completedAt, outcomes };
}
