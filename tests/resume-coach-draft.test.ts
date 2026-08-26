import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { persistResumeCoachDraft } from "../src/domain/resume-generation/resume-coach-commands";
import { applyMigrations, openDatabase } from "../src/persistence/database";

const hash = (letter: string) => `sha256:${letter.repeat(64)}`;
const ids = { profile: "00000000-0000-7000-8000-000000000001", profileRevision: "00000000-0000-7000-8000-000000000002", template: "00000000-0000-7000-8000-000000000003", evidence: "00000000-0000-7000-8000-000000000004", evidenceRevision: "00000000-0000-7000-8000-000000000005", opportunity: "00000000-0000-7000-8000-000000000006", opportunityRevision: "00000000-0000-7000-8000-000000000007" };

test("Coach response becomes an immutable provenance-backed draft with metadata-only audit", async () => {
  const root = await mkdtemp(join(tmpdir(), "resume-coach-draft-")); const databasePath = join(root, "workspace.sqlite"); const timestamp = "2026-08-25T00:00:00.000Z";
  try {
    const db = openDatabase(databasePath); try { applyMigrations(db);
      db.prepare("INSERT INTO candidate_profiles (id, created_at) VALUES (?, ?)").run(ids.profile, timestamp);
      db.prepare("INSERT INTO candidate_profile_revisions (id, profile_id, revision_number, parent_revision_id, first_name, last_name, email, phone, school, program, graduation_year, canonical_content, content_digest, created_at) VALUES (?, ?, 1, NULL, 'A', 'J', 'a@example.test', '+639000000000', 'School', 'Program', 2026, '{}', ?, ?)").run(ids.profileRevision, ids.profile, hash("a"), timestamp);
      db.prepare("INSERT INTO resume_template_sources (id, origin, state, filename, content_type, content_digest, byte_size, storage_location, legacy_source_id, created_at) VALUES (?, 'bundled', 'verified', 'Resume.pdf', 'application/pdf', ?, 10, 'resume-templates/test/Resume.pdf', NULL, ?)").run(ids.template, hash("b"), timestamp);
      db.prepare("INSERT INTO evidence_records (id, created_at) VALUES (?, ?)").run(ids.evidence, timestamp);
      db.prepare("INSERT INTO evidence_revisions (id, evidence_id, revision_number, origin, source_document, source_section, factual_text, review_state, created_at, content_digest) VALUES (?, ?, 1, 'user_entered', 'Experience', 'Project', 'Built TypeScript UI', 'approved', ?, ?)").run(ids.evidenceRevision, ids.evidence, timestamp, hash("c"));
      db.prepare("INSERT INTO captured_opportunities (id, duplicate_key, created_at) VALUES (?, 'frontend engineer|example', ?)").run(ids.opportunity, timestamp);
      db.prepare("INSERT INTO captured_opportunity_revisions (id, opportunity_id, captured_at, original_url, copied_description, title, company, location, work_style, requirements, posted_at, content_digest, created_at) VALUES (?, ?, ?, 'https://jobs.example.test/frontend-engineer', 'Frontend Engineer role with TypeScript, accessibility, collaboration, testing, and local work. This description is intentionally long enough to be a valid local capture.', 'Frontend Engineer', 'Example', 'Manila', 'Hybrid', '[\"TypeScript\"]', '2026-08-25T00:00:00.000Z', ?, ?)").run(ids.opportunityRevision, ids.opportunity, timestamp, hash("e"), timestamp);
    } finally { db.close(); }
    const result = persistResumeCoachDraft({ databasePath, profileRevisionId: ids.profileRevision, profileDigest: hash("a"), templateId: ids.template, templateDigest: hash("b"), evidence: [{ id: ids.evidenceRevision, contentDigest: hash("c") }], opportunity: { revisionId: ids.opportunityRevision, contentDigest: hash("e") }, requestText: "Tailor my resume", consentFingerprint: hash("d"), response: { schemaVersion: 1, selectionEcho: hash("d"), sections: [{ heading: "Strength", text: "Relevant TypeScript experience." }], claims: [{ text: "Built TypeScript UI", evidenceIndexes: [0] }], unknowns: [] } });
    const verify = openDatabase(databasePath); try {
      assert.equal((verify.prepare("SELECT COUNT(*) AS count FROM material_drafts").get() as { count: number }).count, 1); assert.equal((verify.prepare("SELECT COUNT(*) AS count FROM material_draft_evidence").get() as { count: number }).count, 1); assert.equal((verify.prepare("SELECT COUNT(*) AS count FROM material_claim_support").get() as { count: number }).count, 1);
      const opportunity = verify.prepare("SELECT opportunity_revision_id AS revisionId, opportunity_content_digest AS digest FROM material_drafts WHERE id = ?").get(result.id) as { revisionId: string; digest: string };
      assert.equal(opportunity.revisionId, ids.opportunityRevision); assert.equal(opportunity.digest, hash("e"));
      const audit = verify.prepare("SELECT action, content_hash FROM audit_events WHERE entity_id = ?").get(result.id) as { action: string; content_hash: string }; assert.equal(audit.action, "resume.material_draft_created"); assert.match(audit.content_hash, /^sha256:/); assert.doesNotMatch(JSON.stringify(audit), /Tailor|TypeScript/); assert.throws(() => verify.prepare("UPDATE material_drafts SET request_text = 'changed' WHERE id = ?").run(result.id), /immutable/);
    } finally { verify.close(); }
  } finally { await rm(root, { recursive: true, force: true }); }
});
