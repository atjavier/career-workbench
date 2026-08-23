import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { importBaseResume } from "../src/domain/base-resume/import-base-resume";
import { openDatabase } from "../src/persistence/database";

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "base-resume-import-"));
  const source = join(root, "source-resume.tex");
  await writeFile(source, "\\documentclass{article}\\begin{document}Adrian\\end{document}", "utf8");
  return { root, source };
}

test("imports an immutable copied Base Resume with relative metadata and a metadata-only audit event", async () => {
  const { root, source } = await fixture();
  try {
    const before = await readFile(source, "utf8");
    const result = await importBaseResume({
      appDataRoot: join(root, "private"),
      files: [
        { name: "resume.tex", bytes: await readFile(source) },
        { name: "resume.pdf", bytes: new Uint8Array([1, 2, 3]) },
      ],
    });

    assert.match(result.baseResume.id, /^[0-9a-f-]{36}$/i);
    assert.equal(result.baseResume.primaryFilename, "resume.tex");
    assert.match(result.baseResume.primaryDigest, /^sha256:[0-9a-f]{64}$/);
    assert.doesNotMatch(result.baseResume.storageLocation, /^[A-Z]:|^\//i);
    assert.equal(await readFile(source, "utf8"), before);
    assert.deepEqual(await readFile(join(root, "private", result.files[0].storageLocation)), await readFile(source));

    const database = openDatabase(join(root, "private", "workspace.sqlite"));
    try {
      const audit = database.prepare("SELECT action, outcome, entity_id, content_hash FROM audit_events WHERE action = 'base_resume.imported'").get() as Record<string, string>;
      assert.deepEqual({ ...audit }, { action: "base_resume.imported", outcome: "success", entity_id: result.baseResume.id, content_hash: result.baseResume.primaryDigest });
      assert.throws(() => database.exec("DELETE FROM base_resumes"), /immutable/i);
    } finally {
      database.close();
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("rejects invalid and duplicate imports without changing existing Base Resumes", async () => {
  const { root, source } = await fixture();
  try {
    const request = { appDataRoot: join(root, "private"), files: [{ name: "resume.tex", bytes: await readFile(source) }] };
    await importBaseResume(request);
    await assert.rejects(importBaseResume(request), { code: "BASE_RESUME_DUPLICATE" });
    await assert.rejects(importBaseResume({ appDataRoot: request.appDataRoot, files: [{ name: "notes.txt", bytes: new Uint8Array([1]) }] }), (error: unknown) => error instanceof Error && error.message.includes("notes.txt"));
    await assert.rejects(importBaseResume({ appDataRoot: request.appDataRoot, files: [{ name: "resume.tex", bytes: new Uint8Array() }] }), { code: "BASE_RESUME_INVALID" });

    const database = openDatabase(join(root, "private", "workspace.sqlite"));
    try {
      const count = database.prepare("SELECT COUNT(*) AS count FROM base_resumes").get() as { count: number };
      assert.equal(count.count, 1);
      const failedAuditCount = database.prepare("SELECT COUNT(*) AS count FROM audit_events WHERE action = 'base_resume.import_failed' AND outcome = 'failure'").get() as { count: number };
      assert.equal(failedAuditCount.count, 3);
    } finally {
      database.close();
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("schema rejects invalid metadata and seals the imported companion manifest", async () => {
  const { root, source } = await fixture();
  try {
    const result = await importBaseResume({ appDataRoot: join(root, "private"), files: [{ name: "resume.tex", bytes: await readFile(source) }] });
    const database = openDatabase(join(root, "private", "workspace.sqlite"));
    try {
      assert.throws(() => database.prepare("INSERT INTO base_resumes (id, primary_filename, primary_digest, imported_at, storage_location) VALUES (?, ?, ?, ?, ?)").run("018f6a60-7c00-7000-8000-000000000099", "other.tex", "sha256:a", new Date().toISOString(), "base-resumes/other/other.tex"));
      assert.throws(() => database.prepare("INSERT INTO base_resume_files (id, base_resume_id, filename, content_digest, byte_size, storage_location) VALUES (?, ?, ?, ?, ?, ?)").run("018f6a60-7c00-7000-8000-000000000098", result.baseResume.id, "extra.pdf", result.baseResume.primaryDigest, 1, "base-resumes/../extra.pdf"));
      assert.throws(() => database.prepare("INSERT INTO base_resume_files (id, base_resume_id, filename, content_digest, byte_size, storage_location) VALUES (?, ?, ?, ?, ?, ?)").run("018f6a60-7c00-7000-8000-000000000097", result.baseResume.id, "extra.pdf", result.baseResume.primaryDigest, 1, "base-resumes/extra/extra.pdf"), /sealed/i);
    } finally {
      database.close();
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("concurrent matching imports report a duplicate rather than a generic failure", async () => {
  const { root, source } = await fixture();
  try {
    const request = { appDataRoot: join(root, "private"), files: [{ name: "resume.tex", bytes: await readFile(source) }] };
    const results = await Promise.allSettled([importBaseResume(request), importBaseResume(request)]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    const rejected = results.find((result): result is PromiseRejectedResult => result.status === "rejected");
    assert.equal((rejected?.reason as { code?: string }).code, "BASE_RESUME_DUPLICATE");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("cleans newly staged data when copying fails and preserves existing imports", async () => {
  const { root, source } = await fixture();
  try {
    const appDataRoot = join(root, "private");
    const request = { appDataRoot, files: [{ name: "resume.tex", bytes: await readFile(source) }] };
    await assert.rejects(importBaseResume(request, { stageFile: async () => { throw new Error("copy failed"); } }), { message: "copy failed" });
    const database = openDatabase(join(appDataRoot, "workspace.sqlite"));
    try {
      const count = database.prepare("SELECT COUNT(*) AS count FROM base_resumes").get() as { count: number };
      assert.equal(count.count, 0);
    } finally {
      database.close();
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
