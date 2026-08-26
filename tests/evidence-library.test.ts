import assert from "node:assert/strict";
import { lstat, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { approveEvidence, listClaimEligibleEvidence } from "../src/domain/evidence/evidence-commands";
import { importDocumentedEvidenceArtifacts, listExperienceProjectCollection, resolveCollectionReviewHandle, summaryFromProjectOverview } from "../src/domain/evidence/evidence-library";
import { readUploadedResumeDocumentationSource } from "../src/files/evidence-library";

const unknowns = "ownership, metrics, users, dates, deployment status, outcomes, and skills are unknown unless directly evidenced.";
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "documented-evidence-test-")); const output = join(root, "generated-review-docs"); await mkdir(output);
  await writeFile(join(output, "project-overview.md"), "# Project Overview (Proposed / Unreviewed)\n\n## Purpose\n\n- Built a local accessibility report for review. More detail is not needed.\n\n## Limitations and Unknowns\n\n- Unknown: " + unknowns, "utf8");
  await writeFile(join(output, "resume-evidence.md"), "# Resume Evidence (Proposed / Unreviewed)\n\n> Explicit import and individual approval are required.\n\n## Evidence Items\n\n### E-001\n\n- Fact: Built a local accessibility report for review.\n- Provenance: [README.md, Overview, line 3]\n- Explicit unknowns: " + unknowns + "\n- Status: Proposed / unreviewed\n", "utf8");
  await writeFile(join(output, "resume-bullet-candidates.md"), "# Resume Bullet Candidates (Proposed / Unreviewed)\n\n> Explicit import and individual approval are required.\n\n## Candidate Bullets\n\n### B-001\n\n- Candidate: Built a local accessibility report for review.\n- Supporting evidence: E-001\n- Explicit unknowns: " + unknowns + "\n- Status: Proposed / unreviewed; not claim-eligible\n", "utf8");
  return { root, output, appDataRoot: join(root, "private"), workspaceRoot: join(root, "workspace") };
}

test("imports exactly the three generated review artifacts, leaves their output unchanged, and keeps evidence unreviewed", async () => {
  const value = await fixture(); try {
    const before = await readFile(join(value.output, "resume-evidence.md"));
    const result = await importDocumentedEvidenceArtifacts({ ...value, outputDirectory: value.output, name: "Accessibility Report", category: "project" });
    assert.equal(result.documentsAdded, 3); assert.equal(result.candidatesAdded, 1);
    assert.deepEqual(await readFile(join(value.output, "resume-evidence.md")), before);
    assert.equal((await lstat(join(value.workspaceRoot, "resume-evidence", "projects", "Accessibility-Report", "project-overview.md"))).isFile(), true);
    const collection = await listExperienceProjectCollection(value); assert.equal(collection.length, 1); assert.equal(collection[0].category, "project"); assert.equal(collection[0].artifactNames.length, 3); assert.equal(collection[0].summary, "Built a local accessibility report for review."); assert.equal(collection[0].evidence[0].reviewState, "unreviewed");
    assert.equal((await listClaimEligibleEvidence({ appDataRoot: value.appDataRoot })).length, 0);
    const review = await resolveCollectionReviewHandle(collection[0].evidence[0].reviewHandle, value); await approveEvidence({ appDataRoot: value.appDataRoot, ...review });
    assert.equal((await listClaimEligibleEvidence({ appDataRoot: value.appDataRoot })).length, 1);
  } finally { await rm(value.root, { recursive: true, force: true }); }
});

test("refuses malformed, extra, linked, duplicate, and managed-folder documentation imports without copying external content", async () => {
  const value = await fixture(); try {
    await writeFile(join(value.output, "extra.md"), "not allowed", "utf8");
    await assert.rejects(importDocumentedEvidenceArtifacts({ ...value, outputDirectory: value.output, name: "Extra", category: "project" }), { code: "EVIDENCE_LIBRARY_INVALID" });
    await rm(join(value.output, "extra.md"));
    await writeFile(join(value.output, "resume-evidence.md"), "# Resume Evidence (Proposed / Unreviewed)\n### E-001\n- Fact: Ambiguous\n- Provenance: [C:\\secret, document, line 1]\n- Explicit unknowns: " + unknowns + "\n- Status: Proposed / unreviewed", "utf8");
    await assert.rejects(importDocumentedEvidenceArtifacts({ ...value, outputDirectory: value.output, name: "Unsafe", category: "experience" }), { code: "EVIDENCE_LIBRARY_INVALID" });
    await rm(value.output, { recursive: true }); await mkdir(value.output); await writeFile(join(value.output, "project-overview.md"), "# Project Overview (Proposed / Unreviewed)\n\nA visible overview.", "utf8"); await writeFile(join(value.output, "resume-evidence.md"), "# Resume Evidence (Proposed / Unreviewed)\n\n### E-001\n\n- Fact: Visible fact.\n- Provenance: [README.md, document, line 1]\n- Explicit unknowns: " + unknowns + "\n- Status: Proposed / unreviewed", "utf8"); await writeFile(join(value.output, "resume-bullet-candidates.md"), "# Resume Bullet Candidates (Proposed / Unreviewed)\n\n### B-001\n\n- Candidate: Visible fact.\n- Supporting evidence: E-001\n- Explicit unknowns: " + unknowns + "\n- Status: Proposed / unreviewed; not claim-eligible", "utf8");
    await importDocumentedEvidenceArtifacts({ ...value, outputDirectory: value.output, name: "Safe", category: "experience" });
    await assert.rejects(importDocumentedEvidenceArtifacts({ ...value, outputDirectory: value.output, name: "Safe", category: "experience" }), { code: "EVIDENCE_LIBRARY_DUPLICATE" });
    const link = join(value.output, "project-overview.md"); try { await rm(link); await symlink(join(value.output, "resume-evidence.md"), link); await assert.rejects(importDocumentedEvidenceArtifacts({ ...value, outputDirectory: value.output, name: "Linked", category: "project" }), { code: "EVIDENCE_LIBRARY_INVALID" }); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "EPERM") throw error; }
  } finally { await rm(value.root, { recursive: true, force: true }); }
});

test("overview summaries are deterministic, bounded, and never use fenced or heading text", () => {
  assert.equal(summaryFromProjectOverview("---\ntitle: ignored\n---\n<!-- ignore -->\n# Heading\n\n- First supported summary. A second sentence.\n\n```ts\nInvented summary.\n```"), "First supported summary.");
  assert.equal(summaryFromProjectOverview("# Heading\n\n```text\nNo summary.\n```"), "No summary found yet.");
  assert.ok(summaryFromProjectOverview("A ".repeat(200)).length <= 240);
});

test("a valid no-supported-evidence document set remains reviewable without manufacturing an evidence item", async () => {
  const value = await fixture(); try {
    await writeFile(join(value.output, "resume-evidence.md"), "# Resume Evidence (Proposed / Unreviewed)\n\n> Explicit import and individual approval are required.\n\n## Evidence Items\n\n- No supported evidence items found.\n", "utf8"); await writeFile(join(value.output, "resume-bullet-candidates.md"), "# Resume Bullet Candidates (Proposed / Unreviewed)\n\n## Candidate Bullets\n\n- No supported bullet candidates found.\n", "utf8");
    const result = await importDocumentedEvidenceArtifacts({ ...value, outputDirectory: value.output, name: "No Evidence", category: "experience" });
    assert.equal(result.documentsAdded, 3); assert.equal(result.candidatesAdded, 0); assert.equal((await listExperienceProjectCollection(value))[0].evidence.length, 0);
  } finally { await rm(value.root, { recursive: true, force: true }); }
});

test("browser folder snapshots accept only paired, bounded, safe relative source files", async () => {
  const file = new File(["# Overview\nBuilt safely."], "README.md", { type: "text/markdown" });
  const manifest = (path: string, name = "README.md", size = file.size) => JSON.stringify({ root: "project", files: [{ path, name, size }] });
  const source = await readUploadedResumeDocumentationSource({ files: [file], manifest: manifest("project/README.md") });
  assert.equal(source.files[0]?.path, "README.md"); assert.match(source.sourceDigest, /^sha256:/);
  await assert.rejects(readUploadedResumeDocumentationSource({ files: [file], manifest: manifest("../secret.md") }), { code: "EVIDENCE_DOCUMENTER_INVALID" });
  await assert.rejects(readUploadedResumeDocumentationSource({ files: [file], manifest: manifest("project/README.md", "other.md") }), { code: "EVIDENCE_DOCUMENTER_INVALID" });
  const generated = new File(["x"], "bundle.min.js");
  await assert.rejects(readUploadedResumeDocumentationSource({ files: [generated], manifest: JSON.stringify({ root: "project", files: [{ path: "project/bundle.min.js", name: "bundle.min.js", size: generated.size }] }) }), { code: "EVIDENCE_DOCUMENTER_INVALID" });
  await assert.rejects(readUploadedResumeDocumentationSource({ files: [file], manifest: JSON.stringify({ root: "project", files: [{ path: "other/README.md", name: "README.md", size: file.size }] }) }), { code: "EVIDENCE_DOCUMENTER_INVALID" });
  const second = new File(["# Notes"], "notes.md");
  await assert.rejects(readUploadedResumeDocumentationSource({ files: [file, second], manifest: JSON.stringify({ root: "project", files: [{ path: "project/README.md", name: "README.md", size: file.size }, { path: "other/notes.md", name: "notes.md", size: second.size }] }) }), { code: "EVIDENCE_DOCUMENTER_INVALID" });
  const nul = new File([new Uint8Array([65, 0, 66])], "notes.md");
  await assert.rejects(readUploadedResumeDocumentationSource({ files: [nul], manifest: JSON.stringify({ root: "project", files: [{ path: "project/notes.md", name: "notes.md", size: nul.size }] }) }), { code: "EVIDENCE_DOCUMENTER_INVALID" });
});
