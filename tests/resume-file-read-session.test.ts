import assert from "node:assert/strict";
import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { createResumeFileReadSession } from "../src/files/evidence-library";

test("local resume file session permits bounded reads and rejects escaping or unsupported paths", async () => {
  const root = await mkdtemp(join(tmpdir(), "resume-file-session-"));
  try {
    await writeFile(
      join(root, "README.md"),
      "# Portfolio\nBuilt accessible TypeScript interfaces.\n",
    );
    await writeFile(join(root, "secret.env"), "TOKEN=private\n");
    const session = await createResumeFileReadSession({
      applicationRoot: root,
      managedRoots: [],
    });
    const rootId = session.roots[0]?.rootId;
    assert.ok(rootId);

    const listed = await session.execute({ action: "list", rootId, path: "" });
    assert.deepEqual(listed, {
      ok: true,
      type: "list",
      rootId,
      path: "",
      entries: [{ path: "README.md", kind: "file" }],
    });

    const read = await session.execute({
      action: "read",
      rootId,
      path: "README.md",
      startLine: 2,
      endLine: 2,
    });
    assert.equal(read.ok, true);
    if (!read.ok || read.type !== "read") throw new Error("expected file read");
    assert.equal(read.text, "Built accessible TypeScript interfaces.");
    assert.equal(session.validateCitation(read.citation), true);
    assert.equal(
      await session.validateCitationStability?.(read.citation),
      true,
    );
    await writeFile(join(root, "README.md"), "# Portfolio\nChanged source.\n");
    assert.equal(
      await session.validateCitationStability?.(read.citation),
      false,
    );

    assert.deepEqual(
      await session.execute({ action: "read", rootId, path: "../secret.env" }),
      { ok: false, error: "unsafe_path" },
    );
    assert.deepEqual(
      await session.execute({ action: "read", rootId, path: "secret.env" }),
      { ok: false, error: "unsupported_file" },
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("local resume file session refuses linked components and invalid line spans", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "resume-file-session-"));
  const outside = await mkdtemp(join(tmpdir(), "resume-file-outside-"));
  try {
    await writeFile(
      join(root, "README.md"),
      "# Portfolio\nBuilt a workflow.\n",
    );
    await writeFile(join(outside, "secret.md"), "Do not disclose.\n");
    try {
      await symlink(
        outside,
        join(root, "linked"),
        process.platform === "win32" ? "junction" : "dir",
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EPERM") {
        t.skip("The current Windows account cannot create a test junction.");
        return;
      }
      throw error;
    }
    const session = await createResumeFileReadSession({
      applicationRoot: root,
      managedRoots: [],
    });
    const rootId = session.roots[0]?.rootId;
    assert.ok(rootId);

    assert.deepEqual(
      await session.execute({
        action: "read",
        rootId,
        path: "linked/secret.md",
      }),
      { ok: false, error: "unsafe_path" },
    );
    assert.deepEqual(
      await session.execute({
        action: "read",
        rootId,
        path: "README.md",
        startLine: 1,
        endLine: 99,
      }),
      { ok: false, error: "invalid_request" },
    );
  } finally {
    await Promise.all([
      rm(root, { recursive: true, force: true }),
      rm(outside, { recursive: true, force: true }),
    ]);
  }
});

test("local resume file session reports a bounded budget exhaustion", async () => {
  const root = await mkdtemp(join(tmpdir(), "resume-file-session-"));
  try {
    await writeFile(join(root, "README.md"), "# Portfolio\n");
    const session = await createResumeFileReadSession({
      applicationRoot: root,
      managedRoots: [],
    });
    const rootId = session.roots[0]?.rootId;
    assert.ok(rootId);
    for (let call = 0; call < 24; call += 1) {
      const result = await session.execute({
        action: "list",
        rootId,
        path: "",
      });
      assert.equal(result.ok, true);
    }
    assert.deepEqual(
      await session.execute({ action: "list", rootId, path: "" }),
      { ok: false, error: "budget_exhausted" },
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
