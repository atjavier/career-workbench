import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { adapterKey, type SourceAdapter } from "../src/adapters/sources/source-adapter";
import { listRefreshRuns, startRefreshRun } from "../src/domain/discovery/refresh-runs";
import { listSourceConfigurations, saveSourceConfiguration, type SourceConfigurationValues } from "../src/domain/discovery/source-configurations";
import { openDatabase } from "../src/persistence/database";

async function fixture() { const root = await mkdtemp(join(tmpdir(), "source-refresh-")); return { root, appDataRoot: join(root, "private") }; }
const approved = (name: string, budget = 2): SourceConfigurationValues => ({ name, sourceType: "public-employment-service", url: `https://${name.toLowerCase()}.example.test/feed`, accessPath: "published-feed", policyRevision: "Published feed policy reviewed", policyReviewedOn: "2026-08-23", policyApproved: true, requestBudget: budget, rateLimitPerMinute: budget, retentionRule: "Retain run metadata locally.", enabled: true, failureGuidance: "Use the approved public feed in a normal browser." });

test("manual baseline cannot start a refresh or make an adapter call", async () => {
  const value = await fixture(); let calls = 0;
  try {
    const manual = (await listSourceConfigurations(value)).configurations[0];
    const registry = new Map<string, SourceAdapter>();
    registry.set(adapterKey(manual.sourceId, manual.revisionId), { sourceId: manual.sourceId, sourceConfigurationRevisionId: manual.revisionId, async refresh() { calls += 1; return { status: "completed" }; } });
    await assert.rejects(startRefreshRun({ ...value, sourceIds: [manual.sourceId], confirmed: true, registry }), { code: "REFRESH_POLICY_UNRESOLVED" });
    assert.equal(calls, 0); assert.equal((await listRefreshRuns(value)).runs.length, 0);
    const database = openDatabase(join(value.appDataRoot, "workspace.sqlite"));
    try { assert.equal((database.prepare("SELECT COUNT(*) AS count FROM audit_events WHERE action LIKE 'discovery.refresh%' ").get() as { count: number }).count, 0); } finally { database.close(); }
  } finally { await rm(value.root, { recursive: true, force: true }); }
});

test("a compatible injected adapter creates a timestamped bounded completed run", async () => {
  const value = await fixture();
  try {
    const source = await saveSourceConfiguration({ ...value, values: approved("Alpha") }); let calls = 0;
    const registry = new Map<string, SourceAdapter>([[adapterKey(source.sourceId, source.revisionId), { sourceId: source.sourceId, sourceConfigurationRevisionId: source.revisionId, async refresh(context) { context.consumeRequest(); calls += 1; return { status: "completed" }; } }]]);
    const result = await startRefreshRun({ ...value, sourceIds: [source.sourceId], confirmed: true, registry });
    assert.equal(result.status, "completed"); assert.equal(result.outcomes[0].status, "completed"); assert.equal(result.outcomes[0].requestCount, 1); assert.equal(calls, 1); assert.match(result.id, /^[0-9a-f]{8}-[0-9a-f]{4}-7/i); assert.ok(!Number.isNaN(Date.parse(result.completedAt)));
    const view = await listRefreshRuns(value); assert.equal(view.runs[0].status, "completed"); assert.equal(view.runs[0].outcomes[0].sourceConfigurationRevisionId, source.revisionId);
  } finally { await rm(value.root, { recursive: true, force: true }); }
});

test("missing adapter blocks only that source while another selected source completes", async () => {
  const value = await fixture();
  try {
    const blocked = await saveSourceConfiguration({ ...value, values: approved("Blocked") }); const completed = await saveSourceConfiguration({ ...value, values: approved("Completed") });
    const registry = new Map<string, SourceAdapter>([[adapterKey(completed.sourceId, completed.revisionId), { sourceId: completed.sourceId, sourceConfigurationRevisionId: completed.revisionId, async refresh(context) { context.consumeRequest(); return { status: "completed" }; } }]]);
    const result = await startRefreshRun({ ...value, sourceIds: [blocked.sourceId, completed.sourceId], confirmed: true, registry });
    assert.equal(result.status, "partial"); assert.deepEqual(result.outcomes.map((outcome) => outcome.status).sort(), ["blocked", "completed"]);
    assert.equal(result.outcomes.find((outcome) => outcome.sourceId === blocked.sourceId)?.requestCount, 0);
  } finally { await rm(value.root, { recursive: true, force: true }); }
});

test("budget, rate, and HTTP policy outcomes stop the individual source", async () => {
  const value = await fixture();
  try {
    const limited = await saveSourceConfiguration({ ...value, values: approved("Limited", 1) }); const throttled = await saveSourceConfiguration({ ...value, values: approved("Throttled") }); const blocked = await saveSourceConfiguration({ ...value, values: approved("BlockedHttp") });
    const registry = new Map<string, SourceAdapter>([
      [adapterKey(limited.sourceId, limited.revisionId), { sourceId: limited.sourceId, sourceConfigurationRevisionId: limited.revisionId, async refresh(context) { context.consumeRequest(); context.consumeRequest(); return { status: "completed" }; } }],
      [adapterKey(throttled.sourceId, throttled.revisionId), { sourceId: throttled.sourceId, sourceConfigurationRevisionId: throttled.revisionId, async refresh(context) { context.consumeRequest(); return { status: "completed", httpStatus: 429 }; } }],
      [adapterKey(blocked.sourceId, blocked.revisionId), { sourceId: blocked.sourceId, sourceConfigurationRevisionId: blocked.revisionId, async refresh(context) { context.consumeRequest(); return { status: "completed", httpStatus: 403 }; } }],
    ]);
    const result = await startRefreshRun({ ...value, sourceIds: [limited.sourceId, throttled.sourceId, blocked.sourceId], confirmed: true, registry });
    assert.deepEqual(result.outcomes.map((outcome) => outcome.status).sort(), ["blocked", "throttled", "throttled"]);
    assert.equal(result.outcomes.find((outcome) => outcome.sourceId === limited.sourceId)?.requestCount, 1);
  } finally { await rm(value.root, { recursive: true, force: true }); }
});

test("refresh requires confirmation and no generic retrieval surface is introduced", async () => {
  const value = await fixture();
  try { await assert.rejects(startRefreshRun({ ...value, sourceIds: ["anything"], confirmed: false }), { code: "REFRESH_INVALID" }); } finally { await rm(value.root, { recursive: true, force: true }); }
  const source = await (await import("node:fs/promises")).readFile(new URL("../src/domain/discovery/refresh-runs.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /fetch\s*\(|setInterval|setTimeout|window\.|proxy|credential (?:store|access)|browser automation/i);
});

test("timeout, adapter identity, and malformed results become bounded safe outcomes", async () => {
  const value = await fixture();
  try {
    const source = await saveSourceConfiguration({ ...value, values: approved("Timeout") });
    const timeoutRegistry = new Map([[adapterKey(source.sourceId, source.revisionId), { sourceId: source.sourceId, sourceConfigurationRevisionId: source.revisionId, async refresh() { return await new Promise<never>(() => undefined); } } as SourceAdapter]]);
    const timed = await startRefreshRun({ ...value, sourceIds: [source.sourceId], confirmed: true, timeoutMs: 5, registry: timeoutRegistry });
    assert.equal(timed.status, "failed"); assert.equal(timed.outcomes[0].status, "failed");

    const mismatched = await saveSourceConfiguration({ ...value, values: approved("Mismatch") });
    let calls = 0;
    const mismatchRegistry = new Map([[adapterKey(mismatched.sourceId, mismatched.revisionId), { sourceId: "00000000-0000-7000-8000-000000009999", sourceConfigurationRevisionId: mismatched.revisionId, async refresh() { calls += 1; return { status: "completed" }; } } as SourceAdapter]]);
    const blocked = await startRefreshRun({ ...value, sourceIds: [mismatched.sourceId], confirmed: true, registry: mismatchRegistry });
    assert.equal(blocked.outcomes[0].status, "blocked"); assert.equal(calls, 0);

    const malformed = await saveSourceConfiguration({ ...value, values: approved("Malformed") });
    const malformedRegistry = new Map([[adapterKey(malformed.sourceId, malformed.revisionId), { sourceId: malformed.sourceId, sourceConfigurationRevisionId: malformed.revisionId, async refresh() { return { status: "not-a-status" } as unknown as { status: "completed" }; } } as SourceAdapter]]);
    const failed = await startRefreshRun({ ...value, sourceIds: [malformed.sourceId], confirmed: true, registry: malformedRegistry });
    assert.equal(failed.outcomes[0].status, "failed"); assert.ok(failed.outcomes[0].recoveryGuidance.length > 0);
  } finally { await rm(value.root, { recursive: true, force: true }); }
});

test("outcome persistence failure marks the run failed instead of leaving it running", async () => {
  const value = await fixture();
  try {
    const source = await saveSourceConfiguration({ ...value, values: approved("PersistenceFailure") });
    const database = openDatabase(join(value.appDataRoot, "workspace.sqlite"));
    try { database.exec("CREATE TRIGGER test_refresh_outcome_failure BEFORE INSERT ON refresh_source_outcomes BEGIN SELECT RAISE(ABORT, 'simulated refresh persistence failure'); END;"); } finally { database.close(); }
    const registry = new Map([[adapterKey(source.sourceId, source.revisionId), { sourceId: source.sourceId, sourceConfigurationRevisionId: source.revisionId, async refresh(context: { consumeRequest: () => void }) { context.consumeRequest(); return { status: "completed" as const }; } } as SourceAdapter]]);
    await assert.rejects(startRefreshRun({ ...value, sourceIds: [source.sourceId], confirmed: true, registry }), /simulated refresh persistence failure/);
    const view = await listRefreshRuns(value); assert.equal(view.runs[0].status, "failed");
  } finally { await rm(value.root, { recursive: true, force: true }); }
});
