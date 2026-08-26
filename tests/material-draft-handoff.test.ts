import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { handOffMaterialDraft, readMaterialDraft } from "../src/domain/resume-generation/material-draft-commands";
import { persistResumeCoachDraft } from "../src/domain/resume-generation/resume-coach-commands";
import { applyMigrations, openDatabase } from "../src/persistence/database";

const hash = (letter: string) => `sha256:${letter.repeat(64)}`;
const ids = { profile: "00000000-0000-7000-8000-000000000011", profileRevision: "00000000-0000-7000-8000-000000000012", template: "00000000-0000-7000-8000-000000000013", evidence: "00000000-0000-7000-8000-000000000014", evidenceRevision: "00000000-0000-7000-8000-000000000015" };

async function fixture() {
  const appDataRoot = await mkdtemp(join(tmpdir(), "material-draft-handoff-")); const databasePath = join(appDataRoot, "workspace.sqlite"); const timestamp = "2026-08-26T00:00:00.000Z";
  const db = openDatabase(databasePath); try { applyMigrations(db);
    db.prepare("INSERT INTO candidate_profiles (id, created_at) VALUES (?, ?)").run(ids.profile, timestamp);
    db.prepare("INSERT INTO candidate_profile_revisions (id, profile_id, revision_number, parent_revision_id, first_name, last_name, email, phone, school, program, graduation_year, canonical_content, content_digest, created_at) VALUES (?, ?, 1, NULL, 'A', 'J', 'a@example.test', '+639000000000', 'School', 'Program', 2026, '{}', ?, ?)").run(ids.profileRevision, ids.profile, hash("a"), timestamp);
    db.prepare("INSERT INTO resume_template_sources (id, origin, state, filename, content_type, content_digest, byte_size, storage_location, legacy_source_id, created_at) VALUES (?, 'bundled', 'verified', 'Resume.pdf', 'application/pdf', ?, 10, 'resume-templates/test/Resume.pdf', NULL, ?)").run(ids.template, hash("b"), timestamp);
    db.prepare("INSERT INTO evidence_records (id, created_at) VALUES (?, ?)").run(ids.evidence, timestamp);
    db.prepare("INSERT INTO evidence_revisions (id, evidence_id, revision_number, origin, source_document, source_section, factual_text, review_state, created_at, content_digest) VALUES (?, ?, 1, 'user_entered', 'Portfolio', 'Case study', 'Built TypeScript UI', 'approved', ?, ?)").run(ids.evidenceRevision, ids.evidence, timestamp, hash("c"));
  } finally { db.close(); }
  const draft = persistResumeCoachDraft({ databasePath, profileRevisionId: ids.profileRevision, profileDigest: hash("a"), templateId: ids.template, templateDigest: hash("b"), evidence: [{ id: ids.evidenceRevision, contentDigest: hash("c") }], requestText: "Tailor my resume", consentFingerprint: hash("d"), response: { schemaVersion: 1, selectionEcho: hash("d"), sections: [{ heading: "Strength", text: "Relevant TypeScript experience." }], claims: [{ text: "Built TypeScript UI", evidenceIndexes: [0] }], unknowns: ["Impact is not established."] } });
  return { appDataRoot, databasePath, draftId: draft.id };
}

test("a stored draft has a bounded readable projection and one metadata-only review handoff", async () => {
  const value = await fixture();
  try {
    const draft = await readMaterialDraft({ appDataRoot: value.appDataRoot, draftId: value.draftId });
    await assert.rejects(readMaterialDraft({ appDataRoot: value.appDataRoot, draftId: value.draftId, requireHandoff: true }), { code: "MATERIAL_DRAFT_INVALID" });
    assert.equal(draft.sections[0]?.text, "Relevant TypeScript experience.");
    assert.deepEqual(draft.claims[0]?.evidence, ["Approved evidence: Portfolio — Case study"]);
    assert.deepEqual(draft.evidenceLabels, ["Approved evidence: Portfolio — Case study"]);
    assert.equal(draft.templateLabel, "Resume.pdf");
    assert.equal("contentDigest" in draft, false);
    const handoff = await handOffMaterialDraft({ appDataRoot: value.appDataRoot, draftId: value.draftId });
    assert.equal(handoff.destination, "review");
    assert.equal((await readMaterialDraft({ appDataRoot: value.appDataRoot, draftId: value.draftId, requireHandoff: true })).handedOff, true);
    await assert.rejects(handOffMaterialDraft({ appDataRoot: value.appDataRoot, draftId: value.draftId }), { code: "MATERIAL_DRAFT_HANDOFF_DUPLICATE" });
    const db = openDatabase(value.databasePath); try {
      assert.equal((db.prepare("SELECT COUNT(*) AS count FROM material_draft_handoffs WHERE draft_id = ?").get(value.draftId) as { count: number }).count, 1);
      assert.equal((db.prepare("SELECT COUNT(*) AS count FROM material_versions").get() as { count: number }).count, 0);
      const audit = db.prepare("SELECT action, content_hash FROM audit_events WHERE entity_id = ? AND action = 'resume.material_draft_handed_off'").get(value.draftId) as { action: string; content_hash: string };
      assert.equal(audit.action, "resume.material_draft_handed_off"); assert.match(audit.content_hash, /^sha256:/); assert.doesNotMatch(JSON.stringify(audit), /Tailor|TypeScript|Portfolio/);
    } finally { db.close(); }
  } finally { await rm(value.appDataRoot, { recursive: true, force: true }); }
});

test("corrupt material drafts cannot be read or handed off", async () => {
  const value = await fixture(); const corruptId = "00000000-0000-7000-8000-000000000016";
  try {
    const contentJson = JSON.stringify({ schemaVersion: 1, selectionEcho: hash("d"), sections: [{ heading: "Strength", text: "Relevant TypeScript experience." }], claims: [], unknowns: [] });
    const db = openDatabase(value.databasePath); try {
      db.prepare("INSERT INTO material_drafts (id, kind, profile_revision_id, profile_content_digest, template_source_id, template_content_digest, opportunity_revision_id, opportunity_content_digest, request_text, request_digest, content_json, content_digest, provenance_digest, created_at) VALUES (?, 'resume', ?, ?, ?, ?, NULL, NULL, 'Tailor my resume', ?, ?, ?, ?, ?)").run(corruptId, ids.profileRevision, hash("a"), ids.template, hash("b"), hash("c"), contentJson, hash("e"), hash("f"), "2026-08-26T00:00:00.000Z");
    } finally { db.close(); }
    await assert.rejects(readMaterialDraft({ appDataRoot: value.appDataRoot, draftId: corruptId }), { code: "MATERIAL_DRAFT_INVALID" });
    await assert.rejects(handOffMaterialDraft({ appDataRoot: value.appDataRoot, draftId: corruptId }), { code: "MATERIAL_DRAFT_INVALID" });
    const verify = openDatabase(value.databasePath); try { assert.equal((verify.prepare("SELECT COUNT(*) AS count FROM material_draft_handoffs WHERE draft_id = ?").get(corruptId) as { count: number }).count, 0); } finally { verify.close(); }
  } finally { await rm(value.appDataRoot, { recursive: true, force: true }); }
});

test("claim support outside the draft's selected evidence rejects the entire draft", async () => {
  const value = await fixture(); const secondEvidence = "00000000-0000-7000-8000-000000000017"; const secondRevision = "00000000-0000-7000-8000-000000000018";
  try {
    const db = openDatabase(value.databasePath); try {
      db.prepare("INSERT INTO evidence_records (id, created_at) VALUES (?, ?)").run(secondEvidence, "2026-08-26T00:00:00.000Z");
      db.prepare("INSERT INTO evidence_revisions (id, evidence_id, revision_number, origin, source_document, source_section, factual_text, review_state, created_at, content_digest) VALUES (?, ?, 1, 'user_entered', 'Portfolio', 'Unselected case study', 'Unselected factual support', 'approved', ?, ?)").run(secondRevision, secondEvidence, "2026-08-26T00:00:00.000Z", hash("e"));
      const claim = db.prepare("SELECT id FROM material_draft_claims WHERE draft_id = ?").get(value.draftId) as { id: string };
      db.prepare("INSERT INTO material_claim_support (claim_id, evidence_revision_id) VALUES (?, ?)").run(claim.id, secondRevision);
    } finally { db.close(); }
    await assert.rejects(readMaterialDraft({ appDataRoot: value.appDataRoot, draftId: value.draftId }), { code: "MATERIAL_DRAFT_INVALID" });
    await assert.rejects(handOffMaterialDraft({ appDataRoot: value.appDataRoot, draftId: value.draftId }), { code: "MATERIAL_DRAFT_INVALID" });
  } finally { await rm(value.appDataRoot, { recursive: true, force: true }); }
});

test("concurrent or malformed review handoffs fail without extra records", async () => {
  const value = await fixture();
  try {
    const results = await Promise.allSettled([handOffMaterialDraft({ appDataRoot: value.appDataRoot, draftId: value.draftId }), handOffMaterialDraft({ appDataRoot: value.appDataRoot, draftId: value.draftId })]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(results.filter((result) => result.status === "rejected").length, 1);
    await assert.rejects(readMaterialDraft({ appDataRoot: value.appDataRoot, draftId: "not-a-uuid" }), { code: "MATERIAL_DRAFT_INVALID" });
    const db = openDatabase(value.databasePath); try { assert.equal((db.prepare("SELECT COUNT(*) AS count FROM material_draft_handoffs").get() as { count: number }).count, 1); assert.equal((db.prepare("SELECT COUNT(*) AS count FROM audit_events WHERE action = 'resume.material_draft_handed_off'").get() as { count: number }).count, 1); } finally { db.close(); }
  } finally { await rm(value.appDataRoot, { recursive: true, force: true }); }
});
