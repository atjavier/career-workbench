import assert from "node:assert/strict";
import test from "node:test";
import { calculateFitAssessment, FIT_RULESET } from "../src/domain/fit/fit-assessment";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase, applyMigrations } from "../src/persistence/database";
import { insertFitAssessment } from "../src/persistence/fit-assessment-repository";

const preference = { id: "00000000-0000-7000-8000-000000000001", revisionNumber: 1, roleIntents: JSON.stringify(["software", "developer"]), country: "PH", workStyleOrder: JSON.stringify(["remote", "hybrid", "onsite"]), preferNcrHybridOnsite: 1, contentDigest: `sha256:${"a".repeat(64)}`, createdAt: "2026-08-23T00:00:00.000Z" };
const evidence = [{ id: "00000000-0000-7000-8000-000000000002", evidenceId: "00000000-0000-7000-8000-000000000003", revisionNumber: 1, origin: "user_entered" as const, sourceDocument: "resume.tex", sourceSection: "Skills", factualText: "Software developer with TypeScript experience", reviewState: "approved" as const, createdAt: "2026-08-23T00:00:00.000Z", contentDigest: `sha256:${"b".repeat(64)}` }];
const listing = { id: "00000000-0000-7000-8000-000000000004", title: "Junior Software Developer", company: "Example", workStyle: "remote", location: "Philippines", firstSeenAt: "2026-08-23T00:00:00.000Z", lastObservedAt: "2026-08-23T00:00:00.000Z", sourceRecords: [{ id: "source" }] };

test("calculates a versioned evidence fit without predictive language", () => {
  const result = calculateFitAssessment({ listing, evidence, preference, calculatedAt: "2026-08-23T00:00:00.000Z" });
  assert.equal(result.rulesetId, FIT_RULESET.id); assert.equal(result.rulesetVersion, FIT_RULESET.version); assert.equal(result.label, "Strong"); assert.equal(result.confidence, "high");
  assert.equal(result.listingSnapshot.id, listing.id); assert.equal((result.evidenceSnapshot as Array<{ id: string }>)[0].id, evidence[0].id); assert.ok(result.contentDigest.startsWith("sha256:"));
  assert.doesNotMatch(JSON.stringify(result), /interview|offer|hiring|prediction/i);
});

test("unknown evidence and stale listing lower confidence and never become Strong", () => {
  const result = calculateFitAssessment({ listing: { ...listing, workStyle: undefined, location: undefined, lastObservedAt: "2020-01-01T00:00:00.000Z" }, evidence: [], preference, calculatedAt: "2026-08-23T00:00:00.000Z" });
  assert.notEqual(result.label, "Strong"); assert.equal(result.confidence, "low"); assert.ok(result.factorOutcomes.some((factor) => factor.state === "unknown")); assert.ok(result.factorOutcomes.some((factor) => factor.state === "stale"));
});

test("seniority and location mismatches produce Stretch", () => {
  const result = calculateFitAssessment({ listing: { ...listing, title: "Senior Lead Principal Developer", location: "United States" }, evidence, preference, calculatedAt: "2026-08-23T00:00:00.000Z" });
  assert.equal(result.label, "Stretch"); assert.ok(result.factorOutcomes.some((factor) => factor.factor === "seniority" && factor.state === "mismatch"));
});

test("fit assessment migration stores immutable snapshots", async () => {
  const root = await mkdtemp(join(tmpdir(), "fit-assessment-")); const db = openDatabase(join(root, "workspace.sqlite"));
  try {
    applyMigrations(db);
    db.prepare("INSERT INTO job_listings (id, title, company, duplicate_key, duplicate_group_id, first_seen_at, last_observed_at, content_digest) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(listing.id, listing.title, listing.company, "junior software developer|example", listing.id, listing.firstSeenAt, listing.lastObservedAt, `sha256:${"c".repeat(64)}`);
    db.prepare("INSERT INTO job_preference_revisions (id, revision_number, role_intents, country, work_style_order, prefer_ncr_hybrid_onsite, content_digest, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(preference.id, 1, preference.roleIntents, preference.country, preference.workStyleOrder, 1, preference.contentDigest, preference.createdAt);
    const result = calculateFitAssessment({ listing, evidence, preference, calculatedAt: "2026-08-23T00:00:00.000Z" });
    insertFitAssessment(db, { ...result, listingSnapshot: JSON.stringify(result.listingSnapshot), evidenceSnapshot: JSON.stringify(result.evidenceSnapshot), preferenceSnapshot: JSON.stringify(result.preferenceSnapshot), factorOutcomes: JSON.stringify(result.factorOutcomes) });
    assert.equal((db.prepare("SELECT COUNT(*) AS count FROM fit_assessments").get() as { count: number }).count, 1);
    assert.throws(() => db.prepare("UPDATE fit_assessments SET label = 'Stretch' WHERE id = ?").run(result.id), /immutable/);
    assert.throws(() => db.prepare("DELETE FROM fit_assessments WHERE id = ?").run(result.id), /immutable/);
  } finally { db.close(); await rm(root, { recursive: true, force: true }); }
});
