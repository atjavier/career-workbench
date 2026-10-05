import assert from "node:assert/strict";
import { lstat, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  createResumeDraftPdfResponse,
  GET as getResumeDraftPdf,
} from "../src/app/api/resume-drafts/[draftId]/pdf/route";
import type { MaterialDraftView } from "../src/application/resume-generation/material-draft-commands";
import {
  clearInFlightCompilations,
  getCachedResumeDraftPdf,
  getOrCompileResumeDraftPdf,
} from "../src/domain/resume-generation/resume-draft-pdf-cache";
import { persistResumeCoachDraft } from "../src/application/resume-generation/resume-coach-commands";
import { createResumeWorkspace } from "../src/domain/resume-generation/resume-workspace-commands";
import { applyMigrations, openDatabase } from "../src/persistence/database";

const hash = (letter: string) => `sha256:${letter.repeat(64)}`;
const syntheticPdf = Buffer.concat([
  Buffer.from("%PDF-1.4\n"),
  Buffer.alloc(100, 0x20),
]);

const sampleDraft: MaterialDraftView = {
  id: "00000000-0000-7000-8000-000000000001",
  profileLabel: "Candidate",
  templateLabel: "Resume.pdf",
  templateId: "00000000-0000-7000-8000-000000000002",
  templateDigest: hash("x"),
  evidenceLabels: [],
  sections: [{ heading: "Summary", text: "Software Engineer" }],
  claims: [],
  unknowns: [],
  handedOff: false,
};

async function createWorkspaceFixture() {
  const root = await mkdtemp(join(tmpdir(), "resume-draft-pdf-test-"));
  const appDataRoot = join(root, "PersonalJobDiscovery");
  const databasePath = join(appDataRoot, "workspace.sqlite");
  const timestamp = "2026-08-26T00:00:00.000Z";

  const workspace = await createResumeWorkspace({
    appDataRoot,
    name: "Draft PDF test",
  });

  const ids = {
    profile: "00000000-0000-7000-8000-000000000011",
    profileRevision: "00000000-0000-7000-8000-000000000012",
    template: "00000000-0000-7000-8000-000000000013",
    evidence: "00000000-0000-7000-8000-000000000014",
    evidenceRevision: "00000000-0000-7000-8000-000000000015",
  };

  const db = openDatabase(databasePath);
  try {
    applyMigrations(db);
    db.prepare(
      "INSERT INTO candidate_profiles (id, created_at) VALUES (?, ?)",
    ).run(ids.profile, timestamp);
    db.prepare(
      "INSERT INTO candidate_profile_revisions (id, profile_id, revision_number, parent_revision_id, first_name, last_name, email, phone, school, program, graduation_year, canonical_content, content_digest, created_at) VALUES (?, ?, 1, NULL, 'A', 'J', 'a@example.test', '+639000000000', 'School', 'Program', 2026, '{}', ?, ?)",
    ).run(ids.profileRevision, ids.profile, hash("a"), timestamp);
    db.prepare(
      "INSERT INTO resume_template_sources (id, origin, state, filename, content_type, content_digest, byte_size, storage_location, legacy_source_id, created_at) VALUES (?, 'bundled', 'verified', 'Resume.pdf', 'application/pdf', ?, 10, 'resume-templates/test/Resume.pdf', NULL, ?)",
    ).run(ids.template, hash("b"), timestamp);
    db.prepare(
      "INSERT INTO evidence_records (id, created_at) VALUES (?, ?)",
    ).run(ids.evidence, timestamp);
    db.prepare(
      "INSERT INTO evidence_revisions (id, evidence_id, revision_number, origin, source_document, source_section, factual_text, review_state, created_at, content_digest) VALUES (?, ?, 1, 'user_entered', 'Portfolio', 'Case study', 'Built TypeScript UI', 'approved', ?, ?)",
    ).run(ids.evidenceRevision, ids.evidence, timestamp, hash("c"));
  } finally {
    db.close();
  }

  const draft = persistResumeCoachDraft({
    databasePath,
    workspaceId: workspace.workspace.id,
    profileRevisionId: ids.profileRevision,
    profileDigest: hash("a"),
    templateId: ids.template,
    templateDigest: hash("b"),
    evidence: [{ id: ids.evidenceRevision, contentDigest: hash("c") }],
    requestText: "Tailor my resume",
    consentFingerprint: hash("d"),
    response: {
      schemaVersion: 1,
      selectionEcho: hash("d"),
      sections: [
        { heading: "Strength", text: "Relevant TypeScript experience." },
      ],
      claims: [{ text: "Built TypeScript UI", evidenceIndexes: [0] }],
      unknowns: [],
    },
  });

  return { root, appDataRoot, databasePath, draftId: draft.id };
}

test("PDF caching layer compiles on first request and serves cached bytes on subsequent requests", async () => {
  const root = await mkdtemp(join(tmpdir(), "pdf-cache-test-"));
  clearInFlightCompilations();
  try {
    let compileCount = 0;
    const mockCompiler = async () => {
      compileCount++;
      return new Uint8Array(syntheticPdf);
    };

    // First call: compiles and caches
    const pdf1 = await getOrCompileResumeDraftPdf(sampleDraft, {
      appDataRoot: root,
      compiler: mockCompiler,
    });
    assert.equal(compileCount, 1);
    assert.deepEqual(Buffer.from(pdf1), syntheticPdf);

    // Verify file written to cache directory on disk
    const cachedFile = join(root, "pdf-cache", `${sampleDraft.id}.pdf`);
    const stat = await lstat(cachedFile);
    assert.ok(stat.isFile());
    assert.equal(stat.size, syntheticPdf.byteLength);

    // Second call: served from disk cache without compiling again
    const pdf2 = await getOrCompileResumeDraftPdf(sampleDraft, {
      appDataRoot: root,
      compiler: mockCompiler,
    });
    assert.equal(compileCount, 1, "Compiler should not be called again");
    assert.deepEqual(Buffer.from(pdf2), syntheticPdf);

    // Verify direct getCachedResumeDraftPdf helper
    const cachedBytes = await getCachedResumeDraftPdf(sampleDraft.id, {
      appDataRoot: root,
    });
    assert.ok(cachedBytes);
    assert.deepEqual(Buffer.from(cachedBytes), syntheticPdf);
  } finally {
    clearInFlightCompilations();
    await rm(root, { recursive: true, force: true });
  }
});

test("PDF caching layer deduplicates concurrent in-flight compilations for the same draft", async () => {
  const root = await mkdtemp(join(tmpdir(), "pdf-cache-concurrent-"));
  clearInFlightCompilations();
  try {
    let compileCount = 0;
    const mockCompiler = async () => {
      compileCount++;
      // Simulate asynchronous compilation delay
      await new Promise((resolve) => setTimeout(resolve, 50));
      return new Uint8Array(syntheticPdf);
    };

    const [result1, result2, result3] = await Promise.all([
      getOrCompileResumeDraftPdf(sampleDraft, {
        appDataRoot: root,
        compiler: mockCompiler,
      }),
      getOrCompileResumeDraftPdf(sampleDraft, {
        appDataRoot: root,
        compiler: mockCompiler,
      }),
      getOrCompileResumeDraftPdf(sampleDraft, {
        appDataRoot: root,
        compiler: mockCompiler,
      }),
    ]);

    assert.equal(compileCount, 1, "Concurrent requests should only invoke compiler once");
    assert.deepEqual(Buffer.from(result1), syntheticPdf);
    assert.deepEqual(Buffer.from(result2), syntheticPdf);
    assert.deepEqual(Buffer.from(result3), syntheticPdf);
  } finally {
    clearInFlightCompilations();
    await rm(root, { recursive: true, force: true });
  }
});

test("PDF route serves preview without Gatekeeper template hash check and caches subsequent responses", async () => {
  const fixture = await createWorkspaceFixture();
  clearInFlightCompilations();
  const priorLocalAppData = process.env.LOCALAPPDATA;
  process.env.LOCALAPPDATA = fixture.root;

  try {
    let compileCalls = 0;
    const mockGetPdf = async (draft: MaterialDraftView) => {
      return getOrCompileResumeDraftPdf(draft, {
        appDataRoot: fixture.appDataRoot,
        compiler: async () => {
          compileCalls++;
          return new Uint8Array(syntheticPdf);
        },
      });
    };

    // Request 1: Should compile and return 200 with PDF content
    const request1 = new Request(
      `http://localhost/api/resume-drafts/${fixture.draftId}/pdf`,
    );
    const response1 = await createResumeDraftPdfResponse(
      request1,
      Promise.resolve({ draftId: fixture.draftId }),
      { getPdf: mockGetPdf, appDataRoot: fixture.appDataRoot },
    );

    assert.equal(response1.status, 200);
    assert.equal(response1.headers.get("content-type"), "application/pdf");
    assert.equal(
      response1.headers.get("content-disposition"),
      "inline; filename=base-resume.pdf",
    );
    assert.equal(
      response1.headers.get("content-length"),
      String(syntheticPdf.byteLength),
    );
    const bytes1 = new Uint8Array(await response1.arrayBuffer());
    assert.deepEqual(Buffer.from(bytes1), syntheticPdf);
    assert.equal(compileCalls, 1);

    // Request 2: Subsequent request for the same draft should hit cache and NOT compile
    const request2 = new Request(
      `http://localhost/api/resume-drafts/${fixture.draftId}/pdf`,
    );
    const response2 = await createResumeDraftPdfResponse(
      request2,
      Promise.resolve({ draftId: fixture.draftId }),
      { getPdf: mockGetPdf, appDataRoot: fixture.appDataRoot },
    );

    assert.equal(response2.status, 200);
    assert.equal(response2.headers.get("content-type"), "application/pdf");
    const bytes2 = new Uint8Array(await response2.arrayBuffer());
    assert.deepEqual(Buffer.from(bytes2), syntheticPdf);
    assert.equal(compileCalls, 1, "Second request should serve from cache without recompiling");

    // Also test GET default handler directly with process.env.LOCALAPPDATA
    const getResponse = await getResumeDraftPdf(request2, {
      params: Promise.resolve({ draftId: fixture.draftId }),
    });
    assert.equal(getResponse.status, 200);
    assert.equal(getResponse.headers.get("content-type"), "application/pdf");
  } finally {
    if (priorLocalAppData === undefined) delete process.env.LOCALAPPDATA;
    else process.env.LOCALAPPDATA = priorLocalAppData;
    clearInFlightCompilations();
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("PDF route returns 404 for nonexistent or invalid draft ID", async () => {
  const fixture = await createWorkspaceFixture();
  const priorLocalAppData = process.env.LOCALAPPDATA;
  process.env.LOCALAPPDATA = fixture.root;

  try {
    const invalidId = "00000000-0000-7000-8000-999999999999";
    const request = new Request(
      `http://localhost/api/resume-drafts/${invalidId}/pdf`,
    );
    const response = await createResumeDraftPdfResponse(
      request,
      Promise.resolve({ draftId: invalidId }),
      { appDataRoot: fixture.appDataRoot },
    );

    assert.equal(response.status, 404);
    assert.equal(
      await response.text(),
      "The generated base resume preview is unavailable.",
    );
  } finally {
    if (priorLocalAppData === undefined) delete process.env.LOCALAPPDATA;
    else process.env.LOCALAPPDATA = priorLocalAppData;
    await rm(fixture.root, { recursive: true, force: true });
  }
});
