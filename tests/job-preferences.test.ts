import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { defaultJobPreferences, listJobPreferences, saveJobPreferences } from "../src/domain/discovery/job-preferences";
import { openDatabase } from "../src/persistence/database";

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "job-preferences-"));
  return { root, appDataRoot: join(root, "private") };
}

test("first use returns the required defaults without writing a revision or audit event", async () => {
  const value = await fixture();
  try {
    const preferences = await listJobPreferences(value);
    assert.deepEqual(preferences, { values: defaultJobPreferences, revisionId: undefined, revisionNumber: undefined, createdAt: undefined });
    const database = openDatabase(join(value.appDataRoot, "workspace.sqlite"));
    try {
      assert.equal((database.prepare("SELECT COUNT(*) AS count FROM job_preference_revisions").get() as { count: number }).count, 0);
      assert.equal((database.prepare("SELECT COUNT(*) AS count FROM audit_events WHERE action LIKE 'discovery.preferences%'").get() as { count: number }).count, 0);
    } finally { database.close(); }
  } finally { await rm(value.root, { recursive: true, force: true }); }
});

test("reading preferences does not begin an immediate write transaction", async () => {
  const source = await (await import("node:fs/promises")).readFile(new URL("../src/domain/discovery/job-preferences.ts", import.meta.url), "utf8");
  const listFunction = source.slice(source.indexOf("export async function listJobPreferences"), source.indexOf("export async function saveJobPreferences"));
  assert.doesNotMatch(listFunction, /transact\(/); assert.doesNotMatch(listFunction, /BEGIN IMMEDIATE/);
});

test("saving creates append-only, auditable local revisions and reload returns the latest", async () => {
  const value = await fixture();
  try {
    const first = await saveJobPreferences({ ...value, values: defaultJobPreferences });
    assert.match(first.revisionId, /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    assert.equal(first.revisionNumber, 1);
    assert.ok(!Number.isNaN(Date.parse(first.createdAt)));
    const second = await saveJobPreferences({ ...value, expectedRevisionId: first.revisionId, values: { ...defaultJobPreferences, country: "SG", workStyleOrder: ["remote", "onsite", "hybrid"] } });
    assert.equal(second.revisionNumber, 2);
    assert.notEqual(second.revisionId, first.revisionId);
    assert.deepEqual((await listJobPreferences(value)).values, second.values);
    const database = openDatabase(join(value.appDataRoot, "workspace.sqlite"));
    try {
      assert.equal((database.prepare("SELECT COUNT(*) AS count FROM job_preference_revisions").get() as { count: number }).count, 2);
      const event = database.prepare("SELECT entity_id, content_hash FROM audit_events WHERE action = 'discovery.preferences_saved' ORDER BY occurred_at DESC LIMIT 1").get() as { entity_id: string; content_hash: string };
      assert.equal(event.entity_id, second.revisionId); assert.match(event.content_hash, /^sha256:[0-9a-f]{64}$/);
    } finally { database.close(); }
  } finally { await rm(value.root, { recursive: true, force: true }); }
});

test("invalid or stale saves preserve the current revision and expose recovery", async () => {
  const value = await fixture();
  try {
    const first = await saveJobPreferences({ ...value, values: defaultJobPreferences });
    await assert.rejects(saveJobPreferences({ ...value, expectedRevisionId: first.revisionId, values: { ...defaultJobPreferences, roleIntents: [], country: "XX" } }), { code: "JOB_PREFERENCES_INVALID" });
    const second = await saveJobPreferences({ ...value, expectedRevisionId: first.revisionId, values: { ...defaultJobPreferences, country: "SG" } });
    await assert.rejects(saveJobPreferences({ ...value, expectedRevisionId: first.revisionId, values: defaultJobPreferences }), { code: "JOB_PREFERENCES_STALE" });
    assert.equal((await listJobPreferences(value)).revisionId, second.revisionId);
    const database = openDatabase(join(value.appDataRoot, "workspace.sqlite"));
    try { assert.equal((database.prepare("SELECT COUNT(*) AS count FROM job_preference_revisions").get() as { count: number }).count, 2); } finally { database.close(); }
  } finally { await rm(value.root, { recursive: true, force: true }); }
});

test("a persistence failure rolls back without replacing the prior revision", async () => {
  const value = await fixture();
  try {
    const first = await saveJobPreferences({ ...value, values: defaultJobPreferences });
    const database = openDatabase(join(value.appDataRoot, "workspace.sqlite"));
    try { database.exec("CREATE TRIGGER test_job_preferences_insert_failure BEFORE INSERT ON job_preference_revisions BEGIN SELECT RAISE(ABORT, 'simulated persistence failure'); END;"); } finally { database.close(); }
    await assert.rejects(saveJobPreferences({ ...value, expectedRevisionId: first.revisionId, values: { ...defaultJobPreferences, country: "SG" } }), /simulated persistence failure/);
    assert.equal((await listJobPreferences(value)).revisionId, first.revisionId);
    const verified = openDatabase(join(value.appDataRoot, "workspace.sqlite"));
    try {
      assert.equal((verified.prepare("SELECT COUNT(*) AS count FROM job_preference_revisions").get() as { count: number }).count, 1);
      assert.equal((verified.prepare("SELECT COUNT(*) AS count FROM audit_events WHERE action = 'discovery.preferences_saved'").get() as { count: number }).count, 1);
    } finally { verified.close(); }
  } finally { await rm(value.root, { recursive: true, force: true }); }
});

test("invalid persisted preference content is reported as recoverable instead of reaching the UI", async () => {
  const value = await fixture();
  try {
    await listJobPreferences(value);
    const database = openDatabase(join(value.appDataRoot, "workspace.sqlite"));
    try {
      database.prepare("INSERT INTO job_preference_revisions (id, revision_number, role_intents, country, work_style_order, prefer_ncr_hybrid_onsite, content_digest, created_at) VALUES (?, 1, ?, 'PH', ?, 1, ?, ?)").run("00000000-0000-7000-8000-000000000001", "null", '[\"remote\",\"hybrid\",\"onsite\"]', `sha256:${"a".repeat(64)}`, new Date().toISOString());
      database.prepare("INSERT INTO job_preferences_current (singleton, revision_id, updated_at) VALUES (1, ?, ?)").run("00000000-0000-7000-8000-000000000001", new Date().toISOString());
    } finally { database.close(); }
    await assert.rejects(listJobPreferences(value), { code: "JOB_PREFERENCES_UNAVAILABLE" });
  } finally { await rm(value.root, { recursive: true, force: true }); }
});

test("preference modules stay local and do not introduce discovery retrieval APIs", async () => {
  const source = await (await import("node:fs/promises")).readFile(new URL("../src/domain/discovery/job-preferences.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /fetch\s*\(|https?:\/\/|setInterval|setTimeout|watch\s*\(|retry|adapter|source configuration/i);
});
