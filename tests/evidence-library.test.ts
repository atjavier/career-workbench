import assert from "node:assert/strict";
import { lstat, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { approveEvidence, listClaimEligibleEvidence } from "../src/domain/evidence/evidence-commands";
import { importDocumentedEvidenceArtifacts, listExperienceProjectCollection, permanentlyDeleteDocumentedEvidenceItem, resolveCollectionReviewHandle, summaryFromProjectOverview } from "../src/domain/evidence/evidence-library";
import { createResumeWorkspace } from "../src/domain/resume-generation/resume-workspace-commands";
import { readUploadedResumeDocumentationSource } from "../src/files/evidence-library";

const unknowns = "ownership, metrics, users, dates, deployment status, outcomes, and skills are unknown unless directly evidenced.";
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "documented-evidence-test-")); const output = join(root, "generated-review-docs"); await mkdir(output);
  await writeFile(join(output, "project-overview.md"), "# Project Overview (Proposed / Unreviewed)\n\n## Purpose\n\n- Built a local accessibility report for review. More detail is not needed.\n\n## Limitations and Unknowns\n\n- Unknown: " + unknowns, "utf8");
  await writeFile(join(output, "resume-evidence.md"), "# Resume Evidence (Proposed / Unreviewed)\n\n> Explicit import and individual approval are required.\n\n## Evidence Items\n\n### E-001\n\n- Fact: Built a local accessibility report for review.\n- Provenance: [README.md, Overview, line 3]\n- Explicit unknowns: " + unknowns + "\n- Status: Proposed / unreviewed\n", "utf8");
  await writeFile(join(output, "resume-bullet-candidates.md"), "# Resume Bullet Candidates (Proposed / Unreviewed)\n\n> Explicit import and individual approval are required.\n\n## Candidate Bullets\n\n### B-001\n\n- Candidate: Built a local accessibility report for review.\n- Supporting evidence: E-001\n- Explicit unknowns: " + unknowns + "\n- Status: Proposed / unreviewed; not claim-eligible\n", "utf8");
  const appDataRoot = join(root, "private");
  const workspace = await createResumeWorkspace({ appDataRoot, name: "Test resume" });
  return { root, output, appDataRoot, workspaceRoot: join(root, "workspace"), workspaceId: workspace.workspace.id };
}

test("imports the generated documentation set, leaves its output unchanged, and keeps evidence unreviewed", async () => {
  const value = await fixture(); try {
    const before = await readFile(join(value.output, "resume-evidence.md"));
    const sourceSnapshot = { sourceDigest: `sha256:${"a".repeat(64)}`, files: [{ path: "README.md", text: "# A heading whose display text changed\n\n- Built a local accessibility report for review.\n", contentDigest: `sha256:${"b".repeat(64)}` }] };
    const result = await importDocumentedEvidenceArtifacts({ ...value, outputDirectory: value.output, name: "Accessibility Report", category: "project", sourceSnapshot });
    assert.equal(result.documentsAdded, 3); assert.equal(result.candidatesAdded, 1);
    assert.deepEqual(await readFile(join(value.output, "resume-evidence.md")), before);
    assert.equal((await lstat(join(value.workspaceRoot, "resume-evidence", "workspaces", value.workspaceId, "projects", "Accessibility-Report", "project-overview.md"))).isFile(), true);
    const collection = await listExperienceProjectCollection(value); assert.equal(collection.length, 1); assert.equal(collection[0].category, "project"); assert.equal(collection[0].artifactNames.length, 3); assert.equal(collection[0].summary, "Built a local accessibility report for review."); assert.equal(collection[0].evidence[0].reviewState, "unreviewed");
    assert.equal((await listClaimEligibleEvidence({ appDataRoot: value.appDataRoot })).length, 0);
    const review = await resolveCollectionReviewHandle(collection[0].evidence[0].reviewHandle, value); await approveEvidence({ appDataRoot: value.appDataRoot, ...review });
    assert.equal((await listClaimEligibleEvidence({ appDataRoot: value.appDataRoot })).length, 1);
  } finally { await rm(value.root, { recursive: true, force: true }); }
});

test("reloads managed clarification packets without exposing them as review artifacts or evidence", async () => {
  const value = await fixture(); try {
    await importDocumentedEvidenceArtifacts({ ...value, outputDirectory: value.output, name: "Packet Project", category: "project" });
    const packet = join(value.workspaceRoot, "resume-evidence", "workspaces", value.workspaceId, "projects", "Packet-Project", "resume-clarifications.md");
    await writeFile(packet, "# Resume Clarifications (Candidate-Provided)\n\n- Candidate-provided answer: I designed the workflow.\n", "utf8");
    const collection = await listExperienceProjectCollection(value);
    assert.equal(collection.length, 1);
    assert.deepEqual(collection[0]?.artifactNames, ["project-overview.md", "resume-bullet-candidates.md", "resume-evidence.md"]);
    assert.equal(collection[0]?.evidence.length, 1);
    assert.equal(collection[0]?.evidence.some((item) => item.factualText.includes("I designed the workflow")), false);
  } finally { await rm(value.root, { recursive: true, force: true }); }
});

test("reloads managed items while the host writer's temporary clarification packet exists", async () => {
  const value = await fixture(); try {
    await importDocumentedEvidenceArtifacts({ ...value, outputDirectory: value.output, name: "Temporary Packet", category: "project" });
    const temporary = join(value.workspaceRoot, "resume-evidence", "workspaces", value.workspaceId, "projects", "Temporary-Packet", ".clarifications-018f4d08-4f04-7000-8000-000000000000.tmp");
    await writeFile(temporary, "", "utf8");
    const collection = await listExperienceProjectCollection(value);
    assert.equal(collection.length, 1);
    assert.deepEqual(collection[0]?.artifactNames, ["project-overview.md", "resume-bullet-candidates.md", "resume-evidence.md"]);
  } finally { await rm(value.root, { recursive: true, force: true }); }
});

test("refuses clarification packets in externally selected output folders without creating a managed copy", async () => {
  const value = await fixture(); try {
    await writeFile(join(value.output, "resume-clarifications.md"), "# Resume Clarifications (Candidate-Provided)\n", "utf8");
    await assert.rejects(importDocumentedEvidenceArtifacts({ ...value, outputDirectory: value.output, name: "External Packet", category: "project" }), { code: "EVIDENCE_LIBRARY_INVALID" });
    await assert.rejects(lstat(join(value.workspaceRoot, "resume-evidence", "workspaces", value.workspaceId, "projects", "External-Packet")), { code: "ENOENT" });
  } finally { await rm(value.root, { recursive: true, force: true }); }
});

test("rejects managed final clarification packets without the candidate-provided heading", async () => {
  const value = await fixture(); try {
    await importDocumentedEvidenceArtifacts({ ...value, outputDirectory: value.output, name: "Malformed Packet", category: "project" });
    const packet = join(value.workspaceRoot, "resume-evidence", "workspaces", value.workspaceId, "projects", "Malformed-Packet", "resume-clarifications.md");
    await writeFile(packet, "# Resume Clarifications (System-Generated)\n", "utf8");
    await assert.rejects(listExperienceProjectCollection(value), { code: "EVIDENCE_LIBRARY_INVALID" });
  } finally { await rm(value.root, { recursive: true, force: true }); }
});

test("fails closed for unrecognized or unsafe files in managed documented folders", async () => {
  const value = await fixture(); try {
    await importDocumentedEvidenceArtifacts({ ...value, outputDirectory: value.output, name: "Managed Safety", category: "project" });
    const managed = join(value.workspaceRoot, "resume-evidence", "workspaces", value.workspaceId, "projects", "Managed-Safety");
    await writeFile(join(managed, "unrecognized.md"), "unexpected", "utf8");
    await assert.rejects(listExperienceProjectCollection(value), { code: "EVIDENCE_LIBRARY_INVALID" });
    await rm(join(managed, "unrecognized.md"));
    const packet = join(managed, "resume-clarifications.md");
    try { await symlink(join(managed, "resume-evidence.md"), packet); await assert.rejects(listExperienceProjectCollection(value), { code: "EVIDENCE_LIBRARY_INVALID" }); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "EPERM") throw error; }
    await rm(packet, { force: true });
    await writeFile(packet, new Uint8Array([0xc3, 0x28]));
    await assert.rejects(listExperienceProjectCollection(value), { code: "EVIDENCE_LIBRARY_INVALID" });
    await writeFile(packet, new Uint8Array(2 * 1024 * 1024 + 1));
    await assert.rejects(listExperienceProjectCollection(value), { code: "EVIDENCE_LIBRARY_INVALID" });
  } finally { await rm(value.root, { recursive: true, force: true }); }
});

test("permanently deleting documented work removes its workspace records and managed folder", async () => {
  const value = await fixture(); try {
    await importDocumentedEvidenceArtifacts({ ...value, outputDirectory: value.output, name: "Accessibility Report", category: "project" });
    const managedDirectory = join(value.workspaceRoot, "resume-evidence", "workspaces", value.workspaceId, "projects", "Accessibility-Report");
    assert.equal((await lstat(managedDirectory)).isDirectory(), true);
    const deleted = await permanentlyDeleteDocumentedEvidenceItem({ ...value, category: "project", name: "Accessibility-Report", confirmation: "DELETE" });
    assert.equal(deleted.artifactCleanupIncomplete, false);
    assert.equal(deleted.findingsDeleted, 1);
    assert.deepEqual(await listExperienceProjectCollection(value), []);
    await assert.rejects(lstat(managedDirectory), { code: "ENOENT" });
  } finally { await rm(value.root, { recursive: true, force: true }); }
});

test("reclaims an unregistered managed folder before importing the same documented project", async () => {
  const value = await fixture(); try {
    const orphan = join(value.workspaceRoot, "resume-evidence", "workspaces", value.workspaceId, "projects", "Accessibility-Report");
    await mkdir(orphan, { recursive: true });
    await writeFile(join(orphan, "resume-evidence.md"), "orphaned generated content", "utf8");
    const result = await importDocumentedEvidenceArtifacts({ ...value, outputDirectory: value.output, name: "Accessibility-Report", category: "project" });
    assert.equal(result.candidatesAdded, 1);
    assert.equal((await lstat(join(orphan, "project-overview.md"))).isFile(), true);
    assert.equal(await readFile(join(orphan, "resume-evidence.md"), "utf8").then((text) => text.includes("orphaned generated content")), false);
  } finally { await rm(value.root, { recursive: true, force: true }); }
});

test("refuses to attach a completed documentation import after the active resume changes", async () => {
  const value = await fixture(); try {
    const first = await createResumeWorkspace({ appDataRoot: value.appDataRoot, name: "Original resume" });
    await createResumeWorkspace({ appDataRoot: value.appDataRoot, name: "Different resume", expectedRevisionNumber: first.revisionNumber });
    await assert.rejects(importDocumentedEvidenceArtifacts({ ...value, outputDirectory: value.output, name: "Stale documentation", category: "project", expectedWorkspaceId: first.workspace.id }), { code: "RESUME_WORKSPACE_STALE" });
    await assert.rejects(lstat(join(value.workspaceRoot, "resume-evidence", "projects", "Stale-documentation")), { code: "ENOENT" });
    assert.deepEqual(await listExperienceProjectCollection(value), []);
  } finally { await rm(value.root, { recursive: true, force: true }); }
});

test("documented work retains a BMad-style supporting documentation set beside the resume artifacts", async () => {
  const value = await fixture(); try {
    await writeFile(join(value.output, "architecture.md"), "# Architecture\n\n> Generated from a bounded local scan.\n\n## Entry points\n\n- `src/server.js`\n", "utf8");
    await writeFile(join(value.output, "source-tree-analysis.md"), "# Source Tree Analysis\n\n- `src/server.js`\n", "utf8");
    await writeFile(join(value.output, "resume-summary.md"), "# Resume Summary (Proposed / Unreviewed)\n\nBuilt a local accessibility report for review.\n", "utf8");
    const result = await importDocumentedEvidenceArtifacts({ ...value, outputDirectory: value.output, name: "Documented Set", category: "project" });
    assert.equal(result.documentsAdded, 6);
    const collection = await listExperienceProjectCollection(value);
    assert.deepEqual(collection[0]?.artifactNames, ["architecture.md", "project-overview.md", "resume-bullet-candidates.md", "resume-evidence.md", "resume-summary.md", "source-tree-analysis.md"]);
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
    await writeFile(join(value.workspaceRoot, "resume-evidence", "workspaces", value.workspaceId, "experiences", "No-Evidence", "resume-clarifications.md"), "# Resume Clarifications (Candidate-Provided)\n\n- Explicit unknown: Candidate skipped this clarification.\n", "utf8");
    const collection = await listExperienceProjectCollection(value);
    assert.equal(result.documentsAdded, 3); assert.equal(result.candidatesAdded, 0); assert.equal(collection[0].evidence.length, 0); assert.equal(collection[0].artifactNames.includes("resume-clarifications.md"), false);
  } finally { await rm(value.root, { recursive: true, force: true }); }
});

test("imports provenance from Next.js bracketed route paths without mistaking the route segment for a provenance wrapper", async () => {
  const value = await fixture(); try {
    const fact = "export default async function PlaceholderPage({ params }: { params: Promise<{ section: string }> }) {";
    await writeFile(join(value.output, "resume-evidence.md"), `# Resume Evidence (Proposed / Unreviewed)\n\n### E-001\n- Fact: ${fact}\n- Provenance: src/app/[section]/page.tsx, document, line 2\n- Explicit unknowns: ${unknowns}\n- Status: Proposed / unreviewed\n`, "utf8");
    await writeFile(join(value.output, "resume-bullet-candidates.md"), `# Resume Bullet Candidates (Proposed / Unreviewed)\n\n### B-001\n- Candidate: ${fact}\n- Supporting evidence: E-001\n- Explicit unknowns: ${unknowns}\n- Status: Proposed / unreviewed; not claim-eligible\n`, "utf8");
    const result = await importDocumentedEvidenceArtifacts({ ...value, outputDirectory: value.output, name: "Bracketed route", category: "project", sourceSnapshot: { sourceDigest: `sha256:${"a".repeat(64)}`, files: [{ path: "src/app/[section]/page.tsx", text: "// route\n" + fact + "\n", contentDigest: `sha256:${"b".repeat(64)}` }] } });
    assert.equal(result.candidatesAdded, 1);
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
