import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { documentFolderForResume, listDocumenterProposals, resolveDocumenterProposal } from "../src/domain/evidence/evidence-documenter";
import { listClaimEligibleEvidence, listEvidence } from "../src/domain/evidence/evidence-commands";
import { openDatabase } from "../src/persistence/database";

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "evidence-documenter-"));
  const source = join(root, "source");
  await (await import("node:fs/promises")).mkdir(source);
  await writeFile(join(source, "notes.md"), "# Results\nBuilt a local, accessible workspace.", "utf8");
  return { root, source, appDataRoot: join(root, "private") };
}

function localModel() {
  return async (documents: Array<{ path: string }>) => [{ factualText: "Built a local, accessible workspace.", sourcePaths: [documents[0].path], unknowns: ["Measured outcome not supplied"], contentDigest: "sha256:1111111111111111111111111111111111111111111111111111111111111111" }];
}

test("documenter proposals are append-only, idempotent, metadata-audited, and individually stale-safe", async () => {
  const value = await fixture();
  try {
    const before = await readFile(join(value.source, "notes.md"));
    const first = await documentFolderForResume({ ...value, sourceDirectory: value.source, disclosed: true, document: async (documents) => [{ factualText: "Built a local, accessible workspace.", sourcePaths: [documents[0].path], unknowns: ["Measured outcome not supplied"], contentDigest: "sha256:1111111111111111111111111111111111111111111111111111111111111111" }, { factualText: "Built a local, accessible workspace.", sourcePaths: [documents[0].path], unknowns: ["Owner not supplied"], contentDigest: "sha256:2222222222222222222222222222222222222222222222222222222222222222" }] });
    const second = await documentFolderForResume({ ...value, sourceDirectory: value.source, disclosed: true, document: localModel() });
    assert.equal(first.length, 1); assert.match(first[0].contentDigest, /^sha256:(?!1111)[0-9a-f]{64}$/); assert.equal(second[0].id, first[0].id);
    assert.deepEqual(await readFile(join(value.source, "notes.md")), before);
    const accepted = await resolveDocumenterProposal({ appDataRoot: value.appDataRoot, proposalId: first[0].id, expectedRevisionId: first[0].revisionId, decision: "accepted" });
    assert.equal(accepted.state, "accepted");
    assert.equal((await listEvidence({ appDataRoot: value.appDataRoot }))[0].reviewState, "unreviewed");
    assert.equal((await listClaimEligibleEvidence({ appDataRoot: value.appDataRoot })).length, 0);
    await assert.rejects(resolveDocumenterProposal({ appDataRoot: value.appDataRoot, proposalId: first[0].id, expectedRevisionId: first[0].revisionId, decision: "rejected" }), { code: "EVIDENCE_DOCUMENTER_STALE" });
    await writeFile(join(value.source, "edited.md"), "# Detail\nEdited evidence.", "utf8");
    const editedProposal = (await documentFolderForResume({ ...value, sourceDirectory: value.source, disclosed: true, document: localModel() }))[0];
    const edited = await resolveDocumenterProposal({ appDataRoot: value.appDataRoot, proposalId: editedProposal.id, expectedRevisionId: editedProposal.revisionId, decision: "edited", factualText: "Edited factual evidence." });
    assert.equal(edited.state, "edited"); assert.ok((await listEvidence({ appDataRoot: value.appDataRoot })).some((item) => item.factualText === "Edited factual evidence." && item.reviewState === "unreviewed"));
    await writeFile(join(value.source, "rejected.md"), "# Detail\nRejected evidence.", "utf8");
    const rejectedProposal = (await documentFolderForResume({ ...value, sourceDirectory: value.source, disclosed: true, document: localModel() }))[0];
    const countBeforeReject = (await listEvidence({ appDataRoot: value.appDataRoot })).length;
    const rejected = await resolveDocumenterProposal({ appDataRoot: value.appDataRoot, proposalId: rejectedProposal.id, expectedRevisionId: rejectedProposal.revisionId, decision: "rejected" });
    assert.equal(rejected.state, "rejected"); assert.equal((await listEvidence({ appDataRoot: value.appDataRoot })).length, countBeforeReject);
    const db = openDatabase(join(value.appDataRoot, "workspace.sqlite"));
    try {
      assert.throws(() => db.exec("UPDATE evidence_documenter_proposals SET factual_text = 'changed'"), /immutable/i);
      const audit = db.prepare("SELECT action, entity_id, content_hash FROM audit_events WHERE action LIKE 'evidence.documenter_%'").all() as Array<Record<string, string>>;
      assert.ok(audit.length >= 2); assert.ok(audit.every((event) => Object.keys(event).every((key) => ["action", "entity_id", "content_hash"].includes(key))));
      assert.equal(JSON.stringify(audit).includes("Built a local"), false);
    } finally { db.close(); }
  } finally { await rm(value.root, { recursive: true, force: true }); }
});

test("documenter refuses absent consent or model failure without proposal state", async () => {
  const value = await fixture();
  try {
    await assert.rejects(documentFolderForResume({ ...value, sourceDirectory: value.source, disclosed: false, document: localModel() }), { code: "EVIDENCE_DOCUMENTER_INVALID" });
    await assert.rejects(documentFolderForResume({ ...value, sourceDirectory: value.source, disclosed: true, document: async () => [{ factualText: "unsafe", sourcePaths: ["../outside.md"], unknowns: [], contentDigest: "sha256:2222222222222222222222222222222222222222222222222222222222222222" }] }), { code: "EVIDENCE_DOCUMENTER_INVALID" });
    await assert.rejects(documentFolderForResume({ ...value, sourceDirectory: value.source, disclosed: true, document: async () => { throw new Error("unavailable"); } }));
    assert.deepEqual(await listDocumenterProposals({ appDataRoot: value.appDataRoot }), []);
  } finally { await rm(value.root, { recursive: true, force: true }); }
});
