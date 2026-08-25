import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { confirmCapturedOpportunity, listCapturedOpportunities } from "../src/domain/opportunities/captured-opportunities";
import { openDatabase } from "../src/persistence/database";
import { migrations } from "../src/persistence/migrations";

const copiedDescription = "Product Designer role at Northstar Studio with accessibility, research, and collaboration responsibilities. This copied description is intentionally long enough to be a valid local capture.";
const input = { postingUrl: "https://jobs.example.test/product-designer", copiedDescription, capturedAt: "2026-08-20T10:30:00.000Z", title: "Product Designer", company: "Northstar Studio", location: "Makati", workStyle: "Hybrid", requirements: "Accessible design\nResearch", postedAt: "2026-08-20" };
async function fixture() { const root = await mkdtemp(join(tmpdir(), "captured-opportunities-")); return { root, appDataRoot: join(root, "private") }; }
async function migrateThrough0019(appDataRoot: string) {
  await mkdir(appDataRoot, { recursive: true });
  const database = openDatabase(join(appDataRoot, "workspace.sqlite"));
  try {
    database.exec("CREATE TABLE schema_migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL);");
    const record = database.prepare("INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)");
    for (const migration of migrations.slice(0, -1)) {
      database.exec(migration.sql);
      record.run(migration.id, "2026-08-20T00:00:00.000Z");
    }
  } finally { database.close(); }
}

test("confirmation persists one immutable local revision and metadata-only audit event", async () => {
  const value = await fixture();
  try {
    const result = await confirmCapturedOpportunity({ ...value, ...input });
    assert.equal(result.opportunity.title, "Product Designer");
    assert.equal(result.opportunity.capturedAt, input.capturedAt);
    assert.match(result.opportunity.id, /^[0-9a-f-]+$/i);
    const library = await listCapturedOpportunities(value);
    assert.equal(library.opportunities.length, 1);
    assert.deepEqual(library.opportunities[0], { title: "Product Designer", company: "Northstar Studio", location: "Makati", workStyle: "Hybrid", postedAt: "2026-08-20T00:00:00.000Z", capturedAt: input.capturedAt, originalUrl: input.postingUrl });
    assert.doesNotMatch(JSON.stringify(library), /copiedDescription|contentDigest|This copied description/);
    const database = openDatabase(join(value.appDataRoot, "workspace.sqlite"));
    try {
      const audit = database.prepare("SELECT action, content_hash FROM audit_events WHERE action = 'opportunity.captured'").get() as { action: string; content_hash: string };
      assert.equal(audit.action, "opportunity.captured"); assert.match(audit.content_hash, /^sha256:/); assert.doesNotMatch(JSON.stringify(audit), /jobs\.example|Northstar|Accessible/);
      assert.throws(() => database.prepare("UPDATE captured_opportunity_revisions SET title = 'Changed'").run());
      assert.throws(() => database.prepare("DELETE FROM captured_opportunities").run());
    } finally { database.close(); }
  } finally { await rm(value.root, { recursive: true, force: true }); }
});

test("same normalized title and company makes a non-destructive local duplicate suggestion", async () => {
  const value = await fixture();
  try {
    const first = await confirmCapturedOpportunity({ ...value, ...input });
    const second = await confirmCapturedOpportunity({ ...value, ...input, postingUrl: "https://jobs.example.test/other", title: " product designer ", company: " northstar studio " });
    assert.deepEqual(second.probableDuplicate, { title: "Product Designer", company: "Northstar Studio", capturedAt: input.capturedAt });
    const view = await listCapturedOpportunities(value);
    assert.equal(view.opportunities.length, 2); assert.equal(view.opportunities.filter((item) => item.originalUrl.startsWith("https://jobs.example.test/")).length, 2);
    assert.ok(first.opportunity.id);
  } finally { await rm(value.root, { recursive: true, force: true }); }
});

test("invalid confirmation leaves no partial opportunity, revision, suggestion, or audit row", async () => {
  const value = await fixture();
  try {
    await assert.rejects(confirmCapturedOpportunity({ ...value, ...input, title: "" }), { code: "OPPORTUNITY_TITLE_INVALID" });
    await listCapturedOpportunities(value);
    const database = openDatabase(join(value.appDataRoot, "workspace.sqlite"));
    try { for (const table of ["captured_opportunities", "captured_opportunity_revisions", "captured_opportunity_duplicate_suggestions", "audit_events"]) assert.equal((database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number }).count, 0); } finally { database.close(); }
  } finally { await rm(value.root, { recursive: true, force: true }); }
});

test("confirmation accepts an @ outside HTTPS credentials and bounds serialized requirements", async () => {
  const value = await fixture();
  try {
    const saved = await confirmCapturedOpportunity({ ...value, ...input, postingUrl: "https://jobs.example.test/search?contact=jobs@example.test" });
    assert.equal(saved.opportunity.revisions[0]?.originalUrl, "https://jobs.example.test/search?contact=jobs@example.test");
    await assert.rejects(confirmCapturedOpportunity({ ...value, ...input, requirements: Array.from({ length: 20 }, () => "x".repeat(1000)).join("\n") }), { code: "OPPORTUNITY_REQUIREMENTS_INVALID" });
  } finally { await rm(value.root, { recursive: true, force: true }); }
});

test("the forward-only URL migration upgrades an existing 0019 workspace", async () => {
  const value = await fixture();
  try {
    await migrateThrough0019(value.appDataRoot);
    const saved = await confirmCapturedOpportunity({ ...value, ...input, postingUrl: "https://jobs.example.test/search?contact=jobs@example.test" });
    assert.equal(saved.opportunity.revisions[0]?.originalUrl, "https://jobs.example.test/search?contact=jobs@example.test");
  } finally { await rm(value.root, { recursive: true, force: true }); }
});
