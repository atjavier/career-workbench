import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { maximumCurrentResumeBytes, parseResumePdf, structureResumeText, validateResumeDraftContent } from "../src/adapters/resume-parser/pdf-text-parser";
import { approveCurrentBaseResumeVersion, generateCurrentBaseResumeProposals, importCurrentBaseResume, listCurrentBaseResume, readCurrentBaseResumePdf, resolveCurrentBaseResumeProposal, saveCurrentBaseResumeDraft } from "../src/domain/current-base-resume/current-base-resume-commands";
import { addManualEvidence, approveEvidence } from "../src/domain/evidence/evidence-commands";
import { openDatabase } from "../src/persistence/database";
import { stageCurrentBaseResume } from "../src/files/current-base-resume";
import { GET as getCurrentBaseResumePdf } from "../src/app/api/current-base-resume/[sourceId]/pdf/route";

function textPdf(text = "Adrian Javier Resume") {
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>", `<< /Length ${text.length + 32} >>\nstream\nBT /F1 12 Tf 72 720 Td (${text}) Tj ET\nendstream`, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"];
  let output = "%PDF-1.4\n"; const offsets = [0];
  for (let index = 0; index < objects.length; index += 1) { offsets.push(Buffer.byteLength(output)); output += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`; }
  const start = Buffer.byteLength(output); output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(output));
}

test("PDF parser accepts embedded text only and safely rejects non-PDF, empty and oversized inputs", async () => {
  const parsed = await parseResumePdf(textPdf("Adrian Javier built local systems"));
  assert.ok(Object.values(parsed).flat().join(" ").includes("Adrian Javier"));
  await assert.rejects(parseResumePdf(new Uint8Array([1, 2, 3])), { code: "CURRENT_BASE_RESUME_INVALID" });
  await assert.rejects(parseResumePdf(new Uint8Array(await readFile(new URL("./fixtures/current-base-resume/invalid.pdf", import.meta.url)))), { code: "CURRENT_BASE_RESUME_INVALID" });
  await assert.rejects(parseResumePdf(new Uint8Array(await readFile(new URL("./fixtures/current-base-resume/scanned.pdf", import.meta.url)))), { code: "CURRENT_BASE_RESUME_INVALID" });
  await assert.rejects(parseResumePdf(new Uint8Array(maximumCurrentResumeBytes + 1)), { code: "CURRENT_BASE_RESUME_INVALID" });
});

test("structured PDF text preserves headings and draft persistence only accepts bounded valid sections", () => {
  const structured = structureResumeText("Adrian Javier\nSummary\nLocal developer\nExperience\nBuilt accessible systems\nSkills\nTypeScript");
  assert.deepEqual(structured.summary, ["Local developer"]);
  assert.deepEqual(structured.experience, ["Built accessible systems"]);
  assert.deepEqual(structured.skills, ["TypeScript"]);
  assert.throws(() => validateResumeDraftContent({ summary: ["only one section"] }), { code: "CURRENT_BASE_RESUME_INVALID" });
  assert.throws(() => validateResumeDraftContent({ contact: [], summary: ["x".repeat(100_001)], experience: [], projects: [], education: [], skills: [], other: [] }), { code: "CURRENT_BASE_RESUME_INVALID" });
});

test("failed imports audit metadata only and staging failures remove copied PDF bytes", async () => {
  const root = await mkdtemp(join(tmpdir(), "current-resume-failure-")); const appDataRoot = join(root, "private");
  try {
    await assert.rejects(importCurrentBaseResume({ appDataRoot, filename: "Resume.pdf", bytes: new Uint8Array([1, 2, 3]) }), { code: "CURRENT_BASE_RESUME_INVALID" });
    const db = openDatabase(join(appDataRoot, "workspace.sqlite"));
    try { assert.equal((db.prepare("SELECT COUNT(*) AS count FROM audit_events WHERE action = 'current_base_resume.import_failed' AND outcome = 'failure'").get() as { count: number }).count, 1); } finally { db.close(); }
    await mkdir(join(appDataRoot, "current-base-resumes", "test-id"), { recursive: true });
    await assert.rejects(stageCurrentBaseResume(appDataRoot, "test-id", "Resume.pdf", textPdf()), /EPERM|EEXIST|exist/i);
    await assert.rejects(readFile(join(appDataRoot, ".import-staging", "test-id", "Resume.pdf")));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("Current Base Resume import, append-only editing, eligible-evidence proposals and version provenance are immutable", async () => {
  const root = await mkdtemp(join(tmpdir(), "current-resume-")); const appDataRoot = join(root, "private");
  try {
    const imported = await importCurrentBaseResume({ appDataRoot, filename: "Resume.pdf", bytes: textPdf() });
    await assert.rejects(importCurrentBaseResume({ appDataRoot, filename: "Resume.pdf", bytes: textPdf() }), { code: "CURRENT_BASE_RESUME_DUPLICATE" });
    const saved = await saveCurrentBaseResumeDraft({ appDataRoot, draftId: imported.draft.id, content: { ...imported.draft.content, summary: ["Edited curated summary"] } });
    assert.equal(saved.parentDraftId, imported.draft.id);
    await assert.rejects(saveCurrentBaseResumeDraft({ appDataRoot, draftId: imported.draft.id, content: imported.draft.content }), { code: "CURRENT_BASE_RESUME_STALE" });
    const evidence = await addManualEvidence({ appDataRoot, factualText: "Built an accessible local dashboard.", sourceDocument: "resume-evidence/projects/a.md", sourceSection: "Results" });
    const noEligible = await generateCurrentBaseResumeProposals({ appDataRoot, draftId: saved.id }); assert.equal(noEligible.length, 0);
    const approved = await approveEvidence({ appDataRoot, evidenceId: evidence.evidenceId, expectedRevisionId: evidence.id });
    const proposals = await generateCurrentBaseResumeProposals({ appDataRoot, draftId: saved.id }); assert.equal(proposals.length, 1); assert.equal(proposals[0].evidenceRevisionId, approved.id);
    await assert.rejects(approveCurrentBaseResumeVersion({ appDataRoot, draftId: saved.id, explicitApproval: true }), { code: "CURRENT_BASE_RESUME_UNRESOLVED" });
    await resolveCurrentBaseResumeProposal({ appDataRoot, proposalId: proposals[0].id, expectedDecisionRevisionId: proposals[0].decisionRevisionId, decision: "approved" });
    await assert.rejects(resolveCurrentBaseResumeProposal({ appDataRoot, proposalId: proposals[0].id, expectedDecisionRevisionId: proposals[0].decisionRevisionId, decision: "rejected" }), { code: "CURRENT_BASE_RESUME_STALE" });
    const version = await approveCurrentBaseResumeVersion({ appDataRoot, draftId: saved.id, explicitApproval: true });
    assert.deepEqual(version.evidenceRevisionIds, [approved.id]);
    const state = await listCurrentBaseResume({ appDataRoot }); assert.equal(state.versions.length, 1); assert.equal(state.sources.length, 1);
    const db = openDatabase(join(appDataRoot, "workspace.sqlite")); try { assert.throws(() => db.exec("DELETE FROM current_base_resume_sources"), /immutable/i); assert.throws(() => db.exec("UPDATE current_base_resume_drafts SET revision_number = 2"), /immutable/i); } finally { db.close(); }
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("Current Base Resume PDF reads only the current, retained source with verified immutable bytes", async () => {
  const root = await mkdtemp(join(tmpdir(), "current-resume-preview-")); const appDataRoot = join(root, "private"); const original = textPdf("Faithful original PDF");
  try {
    const imported = await importCurrentBaseResume({ appDataRoot, filename: "Resume.pdf", bytes: original });
    assert.deepEqual(await readCurrentBaseResumePdf({ appDataRoot, sourceId: imported.source.id }), original);
    assert.equal(await readCurrentBaseResumePdf({ appDataRoot, sourceId: "00000000-0000-7000-8000-000000000000" }), undefined);
    await writeFile(join(appDataRoot, imported.source.storageLocation), textPdf("Modified retained bytes"));
    assert.equal(await readCurrentBaseResumePdf({ appDataRoot, sourceId: imported.source.id }), undefined);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("Current Base Resume PDF route returns verified inline bytes and normalizes unavailable sources", async () => {
  const root = await mkdtemp(join(tmpdir(), "current-resume-route-")); const priorLocalAppData = process.env.LOCALAPPDATA;
  process.env.LOCALAPPDATA = root;
  const appDataRoot = join(root, "PersonalJobDiscovery"); const original = textPdf("Route PDF bytes");
  try {
    const imported = await importCurrentBaseResume({ appDataRoot, filename: "Resume.pdf", bytes: original });
    const response = await getCurrentBaseResumePdf(new Request("http://localhost/api/current-base-resume/preview"), { params: Promise.resolve({ sourceId: imported.source.id }) });
    assert.equal(response.status, 200); assert.equal(response.headers.get("content-type"), "application/pdf"); assert.equal(response.headers.get("content-disposition"), "inline"); assert.equal(response.headers.get("content-length"), String(original.byteLength)); assert.equal(response.headers.get("cache-control"), "private, no-store"); assert.equal(response.headers.get("x-content-type-options"), "nosniff"); assert.equal(response.headers.get("cross-origin-resource-policy"), "same-origin"); assert.deepEqual(new Uint8Array(await response.arrayBuffer()), original);
    for (const sourceId of ["../../outside.pdf", "00000000-0000-7000-8000-000000000000"]) {
      const unavailable = await getCurrentBaseResumePdf(new Request("http://localhost/api/current-base-resume/preview"), { params: Promise.resolve({ sourceId }) });
      assert.equal(unavailable.status, 404); assert.doesNotMatch(await unavailable.text(), /current-base-resumes|sha256|[A-Z]:\\/i);
    }
    await writeFile(join(appDataRoot, imported.source.storageLocation), textPdf("Modified route bytes"));
    const tampered = await getCurrentBaseResumePdf(new Request("http://localhost/api/current-base-resume/preview"), { params: Promise.resolve({ sourceId: imported.source.id }) });
    assert.equal(tampered.status, 404);
  } finally {
    if (priorLocalAppData === undefined) delete process.env.LOCALAPPDATA; else process.env.LOCALAPPDATA = priorLocalAppData;
    await rm(root, { recursive: true, force: true });
  }
});

test("Current Base Resume UI uses labeled PDF-only controls, native decisions and safe status feedback", async () => {
  const ui = await readFile(new URL("../src/app/current-base-resume.tsx", import.meta.url), "utf8");
  const page = await readFile(new URL("../src/app/resume-workspace.tsx", import.meta.url), "utf8");
  assert.match(ui, /htmlFor="current-resume-pdf"/); assert.match(ui, /accept="application\/pdf,.pdf"/); assert.match(ui, /role="status"/); assert.match(ui, /aria-live="polite"/); assert.match(ui, /value="approved"/); assert.match(ui, /value="rejected"/);
  assert.doesNotMatch(ui, /storageLocation|contentDigest|absolute path|parser diagnostics/i);
  assert.match(ui, /Evidence support:/); assert.match(ui, /retained evidence reference that is no longer available/);
  assert.match(ui, /Review this evidence/); assert.match(ui, /Save the displayed edits before approving this revision/);
  assert.match(ui, /Manual resume review/); assert.match(ui, /Coach not available/);
  assert.match(ui, /Resume Coach is not available/);
  assert.match(ui, /retained PDF source/); assert.match(ui, /The original stays read-only/);
  assert.match(ui, /View retained Current Base Resume versions/);
  assert.match(page, /sourceCount: value\.sources\.length/); assert.match(page, /sourceId,/); assert.doesNotMatch(page, /\(\{ \.\.\.value, error: undefined \}\)/);
});

test("faithful original-PDF preview keeps source storage private and route responses security-bound", async () => {
  const [ui, route, commands, files] = await Promise.all([
    readFile(new URL("../src/app/current-base-resume.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/api/current-base-resume/[sourceId]/pdf/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/domain/current-base-resume/current-base-resume-commands.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/files/current-base-resume.ts", import.meta.url), "utf8"),
  ]);
  assert.match(ui, /Original, read-only Resume PDF/); assert.match(ui, /Open original PDF/);
  assert.match(ui, /unchanged by saved or unsaved working-draft edits/); assert.doesNotMatch(ui, /storageLocation|contentDigest|absolute path|parser diagnostics/i);
  for (const header of ["application/pdf", "inline", "content-length", "private, no-store", "nosniff", "same-origin"]) assert.match(route, new RegExp(header));
  assert.match(route, /The original resume PDF is unavailable/); assert.doesNotMatch(route, /storageLocation|contentDigest|absolute path/i);
  assert.match(commands, /readCurrentBaseResumePdf/); assert.match(commands, /digest\(bytes\) !== source\.contentDigest/);
  assert.match(files, /isSymbolicLink/); assert.match(files, /sourceStorageSegments/); assert.match(files, /relative\(root, path\)/);
});
