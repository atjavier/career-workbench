import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { confirmCapturedOpportunity, listCapturedOpportunities } from "../src/domain/opportunities/captured-opportunities";
import { openDatabase } from "../src/persistence/database";

const copiedDescription = "Product Designer role at Northstar Studio with accessibility, research, and collaboration responsibilities. This copied description is intentionally long enough to be a valid local capture.";
const input = { postingUrl: "https://jobs.example.test/product-designer", copiedDescription, title: "Product Designer", company: "Northstar Studio", location: "Makati", workStyle: "Hybrid", requirements: "Accessible design\nResearch", postedAt: "2026-08-20" };
async function fixture() { const root = await mkdtemp(join(tmpdir(), "captured-opportunities-")); return { root, appDataRoot: join(root, "private") }; }

test("confirmation persists one immutable local revision and metadata-only audit event", async () => {
  const value = await fixture();
  try {
    const result = await confirmCapturedOpportunity({ ...value, ...input });
    assert.equal(result.opportunity.title, "Product Designer");
    assert.match(result.opportunity.id, /^[0-9a-f-]+$/i);
    assert.equal((await listCapturedOpportunities(value)).opportunities.length, 1);
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
    assert.equal(second.probableDuplicate, true);
    const view = await listCapturedOpportunities(value);
    assert.equal(view.opportunities.length, 2); assert.equal(view.opportunities.filter((item) => item.revisions.length === 1).length, 2);
    assert.ok(view.opportunities.some((item) => item.id === first.opportunity.id));
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
