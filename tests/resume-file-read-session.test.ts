import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
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
