import assert from "node:assert/strict";
import { lstat, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { addExperienceToEvidenceLibrary, addProjectToEvidenceLibrary, listEvidenceLibrary, refreshEvidenceLibrary } from "../src/domain/evidence/evidence-library";
import { approveEvidence, listClaimEligibleEvidence } from "../src/domain/evidence/evidence-commands";

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "evidence-library-test-")); const source = join(root, "source-project");
  await (await import("node:fs/promises")).mkdir(join(source, "notes"), { recursive: true });
  await writeFile(join(source, "resume-project-summary.md"), "# Overview\n- Built an accessible dashboard\n\n# Results\nReduced manual review time.", "utf8");
  await writeFile(join(source, "notes", "detail.md"), "# Contribution\nImplemented local provenance.", "utf8");
  return { root, source, appDataRoot: join(root, "private"), workspaceRoot: join(root, "workspace") };
}

test("Add Project copies only Markdown into the managed library, preserves source bytes, and creates unreviewed provenance candidates", async () => {
  const value = await fixture(); try {
    const before = await readFile(join(value.source, "resume-project-summary.md"));
    const result = await addProjectToEvidenceLibrary({ ...value, sourceDirectory: value.source, name: "ARTEMIS" });
    assert.equal(result.documentsAdded, 2); assert.ok(result.candidatesAdded >= 3);
    assert.deepEqual(await readFile(join(value.source, "resume-project-summary.md")), before);
    assert.equal((await lstat(join(value.workspaceRoot, "resume-evidence", "projects", "ARTEMIS", "resume-project-summary.md"))).isFile(), true);
    const inventory = await listEvidenceLibrary(value); assert.equal(inventory.length, 2); assert.match(inventory[0].libraryPath, /^resume-evidence\/projects\//);
    const eligible = await listClaimEligibleEvidence({ appDataRoot: value.appDataRoot }); assert.equal(eligible.length, 0);
    const evidence = (await (await import("../src/domain/evidence/evidence-commands")).listEvidence({ appDataRoot: value.appDataRoot }))[0];
    assert.match(evidence.sourceDocument, /^resume-evidence\/projects\//); assert.match(evidence.sourceSection, /line \d+/);
    await approveEvidence({ appDataRoot: value.appDataRoot, evidenceId: evidence.evidenceId, expectedRevisionId: evidence.id });
    assert.equal((await listClaimEligibleEvidence({ appDataRoot: value.appDataRoot })).length, 1);
  } finally { await rm(value.root, { recursive: true, force: true }); }
});

test("Add Experience requires Markdown content, copies it into the managed library, and refresh is idempotent", async () => {
  const value = await fixture(); try {
    await assert.rejects(addExperienceToEvidenceLibrary({ ...value, name: "Internship", markdown: "" }), { code: "EVIDENCE_LIBRARY_INVALID" });
    const added = await addExperienceToEvidenceLibrary({ ...value, name: "Internship", markdown: "# Role\n- Built test automation." });
    assert.equal(added.documentsAdded, 1); assert.ok(added.candidatesAdded > 0);
    const first = await refreshEvidenceLibrary(value); const second = await refreshEvidenceLibrary(value);
    assert.equal(first.candidatesAdded, 0); assert.equal(second.candidatesAdded, 0);
    assert.equal((await lstat(join(value.workspaceRoot, "resume-evidence", "experiences", "Internship.md"))).isFile(), true);
  } finally { await rm(value.root, { recursive: true, force: true }); }
});

test("unsafe or duplicate additions leave existing managed evidence intact", async () => {
  const value = await fixture(); try {
    await addProjectToEvidenceLibrary({ ...value, sourceDirectory: value.source, name: "AgriMart" });
    const before = await listEvidenceLibrary(value);
    await assert.rejects(addProjectToEvidenceLibrary({ ...value, sourceDirectory: value.source, name: "AgriMart" }), { code: "EVIDENCE_LIBRARY_DUPLICATE" });
    await assert.rejects(addProjectToEvidenceLibrary({ ...value, sourceDirectory: value.source, name: "Renamed AgriMart" }), { code: "EVIDENCE_LIBRARY_DUPLICATE" });
    await assert.rejects(addProjectToEvidenceLibrary({ ...value, sourceDirectory: join(value.workspaceRoot, "resume-evidence"), name: "Nested" }), { code: "EVIDENCE_LIBRARY_INVALID" });
    await assert.rejects(addProjectToEvidenceLibrary({ ...value, sourceDirectory: join(value.root, "missing"), name: "Missing" }), { code: "EVIDENCE_LIBRARY_INVALID" });
    assert.equal((await listEvidenceLibrary(value)).length, before.length);
    const linked = join(value.source, "linked.md");
    try { await symlink(join(value.source, "resume-project-summary.md"), linked); await assert.rejects(addProjectToEvidenceLibrary({ ...value, sourceDirectory: value.source, name: "Linked" }), { code: "EVIDENCE_LIBRARY_INVALID" }); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "EPERM") throw error; }
  } finally { await rm(value.root, { recursive: true, force: true }); }
});

test("failed persistence cleans a newly copied library entry and concurrent project adds have one winner", async () => {
  const value = await fixture(); try {
    await writeFile(value.appDataRoot, "not-a-directory", "utf8");
    await assert.rejects(addProjectToEvidenceLibrary({ ...value, sourceDirectory: value.source, name: "Retryable" }));
    await assert.rejects(lstat(join(value.workspaceRoot, "resume-evidence", "projects", "Retryable")));
    await rm(value.appDataRoot, { force: true });
    const attempts = await Promise.allSettled([addProjectToEvidenceLibrary({ ...value, sourceDirectory: value.source, name: "Concurrent" }), addProjectToEvidenceLibrary({ ...value, sourceDirectory: value.source, name: "Concurrent" })]);
    assert.equal(attempts.filter((attempt) => attempt.status === "fulfilled").length, 1);
  } finally { await rm(value.root, { recursive: true, force: true }); }
});

test("refresh rejects unsafe managed content, bounds candidates, and treats restored bytes as the current single inventory document", async () => {
  const value = await fixture(); try {
    await addProjectToEvidenceLibrary({ ...value, sourceDirectory: value.source, name: "Restore..Name" });
    const managed = join(value.workspaceRoot, "resume-evidence", "projects", "Restore..Name", "resume-project-summary.md");
    const original = await readFile(managed, "utf8");
    await writeFile(managed, "# Changed\n- Changed fact", "utf8"); await refreshEvidenceLibrary(value);
    await writeFile(managed, original, "utf8"); await refreshEvidenceLibrary(value);
    const inventory = await listEvidenceLibrary(value); assert.equal(inventory.filter((item) => item.libraryPath.endsWith("resume-project-summary.md")).length, 1);
    await mkdir(join(value.workspaceRoot, "resume-evidence", "experiences"));
    assert.equal((await refreshEvidenceLibrary(value)).candidatesAdded, 0);
    await writeFile(managed, Array.from({ length: 2001 }, (_, index) => `- fact ${index}`).join("\n"), "utf8");
    await assert.rejects(refreshEvidenceLibrary(value), { code: "EVIDENCE_LIBRARY_INVALID" });
    await writeFile(managed, original, "utf8");
    const link = join(value.workspaceRoot, "resume-evidence", "projects", "Restore..Name", "unsafe.md");
    try { await symlink(managed, link); await assert.rejects(refreshEvidenceLibrary(value), { code: "EVIDENCE_LIBRARY_INVALID" }); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "EPERM") throw error; }
  } finally { await rm(value.root, { recursive: true, force: true }); }
});

test("strict UTF-8 input is required and tilde-fenced text is never made into evidence", async () => {
  const value = await fixture(); try {
    const invalid = join(value.source, "invalid.md"); await writeFile(invalid, new Uint8Array([0xff, 0xfe]));
    await assert.rejects(addProjectToEvidenceLibrary({ ...value, sourceDirectory: value.source, name: "InvalidUtf" }), { code: "EVIDENCE_LIBRARY_INVALID" });
    await rm(invalid);
    await addExperienceToEvidenceLibrary({ ...value, name: "Fenced", markdown: "# Notes\nVisible achievement\n~~~~text\nHidden invented achievement\n```\nStill hidden achievement\n~~~~\nVisible result" });
    const evidence = await (await import("../src/domain/evidence/evidence-commands")).listEvidence({ appDataRoot: value.appDataRoot });
    assert.ok(evidence.some((item) => item.factualText === "Visible achievement")); assert.ok(!evidence.some((item) => item.factualText.includes("hidden achievement")));
    await assert.rejects(addExperienceToEvidenceLibrary({ ...value, name: "Oversized", markdown: "x".repeat(2 * 1024 * 1024 + 1) }), { code: "EVIDENCE_LIBRARY_INVALID" });
  } finally { await rm(value.root, { recursive: true, force: true }); }
});
