import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { addManualEvidence, approveEvidence, editEvidence, extractEvidenceFromBaseResume, listClaimEligibleEvidence, rejectEvidence, removeEvidence } from "../src/domain/evidence/evidence-commands";
import { importBaseResume } from "../src/domain/base-resume/import-base-resume";

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "evidence-test-"));
  const source = join(root, "resume.tex");
  await writeFile(source, "Skills: TypeScript\nBuilt a local workspace", "utf8");
  const appDataRoot = join(root, "private");
  const baseResume = await importBaseResume({ appDataRoot, files: [{ name: "resume.tex", bytes: await readFile(source) }] });
  return { root, source, appDataRoot, baseResume };
}

test("evidence revisions are immutable and only a current approved revision is claim eligible", async () => {
  const value = await fixture();
  try {
    const added = await addManualEvidence({ appDataRoot: value.appDataRoot, factualText: "Built an accessible local workspace", sourceDocument: "Adrian interview notes", sourceSection: "Projects" });
    assert.equal(added.origin, "user_entered");
    assert.equal(added.reviewState, "unreviewed");
    assert.equal((await listClaimEligibleEvidence({ appDataRoot: value.appDataRoot })).length, 0);
    const approved = await approveEvidence({ appDataRoot: value.appDataRoot, evidenceId: added.evidenceId, expectedRevisionId: added.id });
    assert.equal(approved.revisionNumber, 2);
    assert.equal((await listClaimEligibleEvidence({ appDataRoot: value.appDataRoot }))[0].id, approved.id);
    const edited = await editEvidence({ appDataRoot: value.appDataRoot, evidenceId: added.evidenceId, expectedRevisionId: approved.id, factualText: "Built an accessible local-first workspace" });
    assert.equal(edited.reviewState, "unreviewed");
    assert.equal((await listClaimEligibleEvidence({ appDataRoot: value.appDataRoot })).length, 0);
    await assert.rejects(approveEvidence({ appDataRoot: value.appDataRoot, evidenceId: added.evidenceId, expectedRevisionId: approved.id }), { code: "EVIDENCE_STALE" });
  } finally { await rm(value.root, { recursive: true, force: true }); }
});

test("extraction reads only the copied Base Resume and reject/remove retain ineligible history", async () => {
  const value = await fixture();
  try {
    const before = await readFile(value.source, "utf8");
    const extracted = await extractEvidenceFromBaseResume({ appDataRoot: value.appDataRoot, baseResumeId: value.baseResume.baseResume.id });
    assert.equal(extracted[0].origin, "extracted");
    assert.match(extracted[0].sourceSection, /line 1/);
    assert.equal(await readFile(value.source, "utf8"), before);
    const rejected = await rejectEvidence({ appDataRoot: value.appDataRoot, evidenceId: extracted[0].evidenceId, expectedRevisionId: extracted[0].id });
    const removed = await removeEvidence({ appDataRoot: value.appDataRoot, evidenceId: extracted[1].evidenceId, expectedRevisionId: extracted[1].id });
    assert.equal(rejected.reviewState, "rejected");
    assert.equal(removed.reviewState, "removed");
    assert.equal((await listClaimEligibleEvidence({ appDataRoot: value.appDataRoot })).length, 0);
  } finally { await rm(value.root, { recursive: true, force: true }); }
});
