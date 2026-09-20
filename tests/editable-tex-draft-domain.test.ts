import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  access,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { createUuidV7 } from "../src/audit/audit-event";
import { GET as getTexDownload } from "../src/app/api/tex-drafts/[revisionId]/tex/route";
import { GET as getPdfDownload } from "../src/app/api/tex-drafts/[revisionId]/pdf/route";
import { configureLocalModel } from "../src/domain/resume-generation/local-model-configuration-commands";
import {
  generateEditableTexDraft,
  readEditableTexDraftRevision,
} from "../src/domain/resume-generation/editable-tex-drafts";
import {
  createResumeWorkspace,
  permanentlyDeleteResumeWorkspace,
  readResumeWorkspaceState,
} from "../src/domain/resume-generation/resume-workspace-commands";
import { ResumeTexCompilationError } from "../src/domain/resume-generation/resume-tex-compiler";
import { importBaseResume } from "../src/domain/base-resume/import-base-resume";
import { initializeWorkspace } from "../src/domain/workspace/initialize-workspace";
import { openDatabase } from "../src/persistence/database";

const sha = (value: string | Uint8Array) =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;
const baseline =
  "\\documentclass{article}\n\\begin{document}\nOriginal\n\\end{document}\n";
const revised = baseline.replace(
  "Original",
  "\\textbf{Built a durable evidence workflow.}",
);
const pdf = new Uint8Array(Buffer.from("%PDF-1.4\nmock draft\n"));

async function fixture(root?: string) {
  root ??= await mkdtemp(join(tmpdir(), "editable-tex-domain-"));
  await initializeWorkspace({ appDataRoot: root });
  const workspace = await createResumeWorkspace({
    appDataRoot: root,
    name: "Editable TeX",
  });
  const imported = await importBaseResume({
    appDataRoot: root,
    files: [{ name: "resume.tex", bytes: new TextEncoder().encode(baseline) }],
  });
  await configureLocalModel({
    appDataRoot: root,
    modelIdentifier: "qwen/qwen3.5-9b",
    fetcher: async () =>
      new Response(
        JSON.stringify({
          models: [
            {
              type: "llm",
              key: "qwen/qwen3.5-9b",
              display_name: "Qwen3.5-9B",
              params_string: "9B",
              loaded_instances: [{ context_length: 30000 }],
            },
          ],
        }),
      ),
  });
  const artifactRoot = join(
    root,
    "resume-evidence",
    "workspaces",
    workspace.workspace.id,
    "projects",
    "sample-project",
  );
  const documents = [
    "project-overview.md",
    "resume-evidence.md",
    "resume-bullet-candidates.md",
  ];
  const contents = documents.map(
    (name) => `# ${name}\n\nApproved project evidence.`,
  );
  for (let index = 0; index < documents.length; index += 1) {
    await writeFile(join(artifactRoot, documents[index]!), contents[index]!, {
      encoding: "utf8",
      flag: "w",
    }).catch(async (error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
      const { mkdir } = await import("node:fs/promises");
      await mkdir(artifactRoot, { recursive: true });
      await writeFile(join(artifactRoot, documents[index]!), contents[index]!, {
        encoding: "utf8",
        flag: "w",
      });
    });
  }
  const database = openDatabase(join(root, "workspace.sqlite"));
  try {
    const now = new Date().toISOString();
    const importId = createUuidV7();
    const evidenceId = createUuidV7();
    const evidenceRevisionId = createUuidV7();
    database
      .prepare(
        "INSERT INTO evidence_library_imports (id, category, source_identity, source_digest, library_root, created_at) VALUES (?, 'project', 'sample-project', ?, 'resume-evidence', ?)",
      )
      .run(importId, sha("source"), now);
    database
      .prepare(
        "INSERT INTO resume_workspace_imports (workspace_id, import_id) VALUES (?, ?)",
      )
      .run(workspace.workspace.id, importId);
    database
      .prepare("INSERT INTO evidence_records (id, created_at) VALUES (?, ?)")
      .run(evidenceId, now);
    database
      .prepare(
        "INSERT INTO evidence_revisions (id, evidence_id, revision_number, origin, source_document, source_section, factual_text, review_state, created_at, content_digest) VALUES (?, ?, 1, 'user_entered', 'sample-project', 'Evidence', 'Built a durable evidence workflow.', 'approved', ?, ?)",
      )
      .run(evidenceRevisionId, evidenceId, now, sha("approved"));
    for (let index = 0; index < documents.length; index += 1) {
      const id = createUuidV7();
      const path = `resume-evidence/workspaces/${workspace.workspace.id}/projects/sample-project/${documents[index]!}`;
      const contentDigest = sha(contents[index]!);
      database
        .prepare(
          "INSERT INTO evidence_library_documents (id, import_id, category, library_path, content_digest, imported_at) VALUES (?, ?, 'project', ?, ?, ?)",
        )
        .run(id, importId, path, contentDigest, now);
      if (index === 0)
        database
          .prepare(
            "INSERT INTO evidence_library_candidates (document_id, source_section, line_number, content_digest, evidence_revision_id) VALUES (?, 'Evidence', 1, ?, ?)",
          )
          .run(id, sha("candidate"), evidenceRevisionId);
    }
  } finally {
    database.close();
  }
  return { root, workspace: workspace.workspace, imported, artifactRoot };
}

function modelResponse() {
  return async (_url: string, init: RequestInit) => {
    const request = JSON.parse(String(init.body)) as { input: string };
    const packet = JSON.parse(request.input) as {
      selectionEcho: string;
      artifacts: Array<{ path: string; contentDigest: string }>;
    };
    const content = JSON.stringify({
      schemaVersion: 1,
      selectionEcho: packet.selectionEcho,
      tex: revised,
      artifactCitations: packet.artifacts.map(({ path, contentDigest }) => ({
        path,
        contentDigest,
      })),
    });
    return new Response(
      JSON.stringify({ output: [{ type: "message", content }] }),
    );
  };
}
const compiler = async () => pdf;
const cleanup = (root: string) =>
  rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });

test("valid draft persists complete provenance while baseline bytes remain immutable", async () => {
  const value = await fixture();
  try {
    const before = await readFile(
      join(value.root, value.imported.baseResume.storageLocation),
    );
    const generated = await generateEditableTexDraft(
      {
        appDataRoot: value.root,
        workspaceRoot: value.root,
        expectedWorkspaceId: value.workspace.id,
        displayName: "Platform role",
        consented: true,
        fetcher: modelResponse(),
      },
      { compile: compiler },
    );
    const stored = await readEditableTexDraftRevision({
      appDataRoot: value.root,
      revisionId: generated.revisionId,
    });
    assert.equal(new TextDecoder().decode(stored.tex), revised);
    assert.deepEqual(
      await readFile(
        join(value.root, value.imported.baseResume.storageLocation),
      ),
      before,
    );
    const db = openDatabase(join(value.root, "workspace.sqlite"));
    try {
      assert.equal(
        (
          db
            .prepare(
              "SELECT COUNT(*) AS count FROM tex_draft_revision_artifacts WHERE revision_id = ?",
            )
            .get(generated.revisionId) as { count: number }
        ).count,
        3,
      );
      assert.equal(
        (
          db
            .prepare(
              "SELECT baseline_digest FROM tex_draft_revisions WHERE id = ?",
            )
            .get(generated.revisionId) as { baseline_digest: string }
        ).baseline_digest,
        value.imported.baseResume.primaryDigest,
      );
    } finally {
      db.close();
    }
  } finally {
    await cleanup(value.root);
  }
});

test("stale active workspace rejects a generated draft", async () => {
  const value = await fixture();
  try {
    const staleWorkspaceFetcher = async (url: string, init: RequestInit) => {
      const state = await readResumeWorkspaceState({ appDataRoot: value.root });
      await createResumeWorkspace({
        appDataRoot: value.root,
        name: "New active",
        expectedRevisionNumber: state.revisionNumber,
      });
      return modelResponse()(url, init);
    };
    await assert.rejects(
      generateEditableTexDraft(
        {
          appDataRoot: value.root,
          workspaceRoot: value.root,
          expectedWorkspaceId: value.workspace.id,
          displayName: "Stale",
          consented: true,
          fetcher: staleWorkspaceFetcher,
        },
        { compile: compiler },
      ),
      { code: "RESUME_WORKSPACE_STALE" },
    );
    const db = openDatabase(join(value.root, "workspace.sqlite"));
    try {
      assert.equal(
        (
          db.prepare("SELECT COUNT(*) AS count FROM tex_drafts").get() as {
            count: number;
          }
        ).count,
        0,
      );
    } finally {
      db.close();
    }
  } finally {
    await cleanup(value.root);
  }
});

test("stale approved artifact bytes reject a generated draft", async () => {
  const value = await fixture();
  try {
    const staleArtifactFetcher = async (url: string, init: RequestInit) => {
      await writeFile(
        join(value.artifactRoot, "resume-evidence.md"),
        "# changed after inference began\n",
      );
      return modelResponse()(url, init);
    };
    await assert.rejects(
      generateEditableTexDraft(
        {
          appDataRoot: value.root,
          workspaceRoot: value.root,
          expectedWorkspaceId: value.workspace.id,
          displayName: "Stale artifact",
          consented: true,
          fetcher: staleArtifactFetcher,
        },
        { compile: compiler },
      ),
      { code: "RESUME_COACH_INVALID" },
    );
    const db = openDatabase(join(value.root, "workspace.sqlite"));
    try {
      assert.equal(
        (
          db.prepare("SELECT COUNT(*) AS count FROM tex_drafts").get() as {
            count: number;
          }
        ).count,
        0,
      );
    } finally {
      db.close();
    }
  } finally {
    await cleanup(value.root);
  }
});

test("linked TeX staging ancestors reject before model inference", async () => {
  const value = await fixture();
  try {
    const outside = await mkdtemp(join(tmpdir(), "editable-tex-outside-"));
    await symlink(outside, join(value.root, ".tex-draft-staging"), "junction");
    let called = false;
    await assert.rejects(
      generateEditableTexDraft(
        {
          appDataRoot: value.root,
          workspaceRoot: value.root,
          expectedWorkspaceId: value.workspace.id,
          displayName: "Unsafe",
          consented: true,
          fetcher: async () => {
            called = true;
            return new Response("{}");
          },
        },
        { compile: compiler },
      ),
      { code: "RESUME_COACH_INVALID" },
    );
    assert.equal(called, false);
    await cleanup(outside);
  } finally {
    await cleanup(value.root);
  }
});

test("compile failures clean scratch and never persist a revision", async () => {
  const value = await fixture();
  try {
    await assert.rejects(
      generateEditableTexDraft(
        {
          appDataRoot: value.root,
          workspaceRoot: value.root,
          expectedWorkspaceId: value.workspace.id,
          displayName: "Broken compile",
          consented: true,
          fetcher: modelResponse(),
        },
        {
          compile: async () => {
            throw new ResumeTexCompilationError("mock compile failure");
          },
        },
      ),
    );
    await assert.rejects(access(join(value.root, ".tex-draft-compile")));
    await assert.rejects(access(join(value.root, "tex-drafts")));
  } finally {
    await cleanup(value.root);
  }
});

test("cross-workspace reads are denied and workspace deletion cleans TeX drafts", async () => {
  const value = await fixture();
  try {
    const generated = await generateEditableTexDraft(
      {
        appDataRoot: value.root,
        workspaceRoot: value.root,
        expectedWorkspaceId: value.workspace.id,
        displayName: "Private",
        consented: true,
        fetcher: modelResponse(),
      },
      { compile: compiler },
    );
    const state = await readResumeWorkspaceState({ appDataRoot: value.root });
    const other = await createResumeWorkspace({
      appDataRoot: value.root,
      name: "Other",
      expectedRevisionNumber: state.revisionNumber,
    });
    await assert.rejects(
      readEditableTexDraftRevision({
        appDataRoot: value.root,
        revisionId: generated.revisionId,
      }),
      { code: "RESUME_COACH_INVALID" },
    );
    const otherState = await readResumeWorkspaceState({
      appDataRoot: value.root,
    });
    await permanentlyDeleteResumeWorkspace({
      appDataRoot: value.root,
      workspaceId: value.workspace.id,
      expectedRevisionNumber: otherState.revisionNumber,
      confirmation: "DELETE",
    });
    await assert.rejects(
      access(join(value.root, "tex-drafts", generated.draftId)),
    );
    assert.equal(other.workspace.name, "Other");
  } finally {
    await cleanup(value.root);
  }
});

for (const [extension, handler, contentType, disposition, unavailable] of [
  [
    "tex",
    getTexDownload,
    "application/x-tex; charset=utf-8",
    "attachment",
    "The editable TeX draft is unavailable.",
  ],
  [
    "pdf",
    getPdfDownload,
    "application/pdf",
    "inline",
    "The editable TeX preview is unavailable.",
  ],
] as const) {
  test(`/api/tex-drafts/[revisionId]/${extension} returns exact bytes and private headers, then inaccessible 404s`, async () => {
    const parent = await mkdtemp(join(tmpdir(), "editable-tex-download-"));
    const originalLocalAppData = process.env.LOCALAPPDATA;
    // Real route and repository reads resolve only this test-owned default root.
    process.env.LOCALAPPDATA = parent;
    try {
      const value = await fixture(join(parent, "PersonalJobDiscovery"));
      const routeTex = revised.replace("workflow.", "workflow. Résumé 工程");
      const routePdf = new Uint8Array(
        Buffer.concat([
          Buffer.from("%PDF-1.4\n"),
          Buffer.from([0, 128, 255, 10]),
        ]),
      );
      const generated = await generateEditableTexDraft(
        {
          appDataRoot: value.root,
          workspaceRoot: value.root,
          expectedWorkspaceId: value.workspace.id,
          displayName: "Synthetic download",
          consented: true,
          fetcher: async (_url, init) => {
            const packet = JSON.parse(JSON.parse(String(init.body)).input);
            return new Response(
              JSON.stringify({
                output: [
                  {
                    type: "message",
                    content: JSON.stringify({
                      schemaVersion: 1,
                      selectionEcho: packet.selectionEcho,
                      tex: routeTex,
                      artifactCitations: packet.artifacts.map(
                        ({
                          path,
                          contentDigest,
                        }: {
                          path: string;
                          contentDigest: string;
                        }) => ({ path, contentDigest }),
                      ),
                    }),
                  },
                ],
              }),
            );
          },
        },
        { compile: async () => routePdf },
      );
      const download = (revisionId: string) =>
        handler(
          new Request(
            `http://localhost/api/tex-drafts/${revisionId}/${extension}`,
          ),
          { params: Promise.resolve({ revisionId }) },
        );
      const expected =
        extension === "tex" ? new TextEncoder().encode(routeTex) : routePdf;
      const response = await download(generated.revisionId);
      assert.equal(response.status, 200);
      assert.deepEqual(new Uint8Array(await response.arrayBuffer()), expected);
      assert.deepEqual(Object.fromEntries(response.headers), {
        "cache-control": "private, no-store",
        "content-disposition": `${disposition}; filename=editable-resume.${extension}`,
        "content-length": String(expected.byteLength),
        "content-type": contentType,
        "cross-origin-resource-policy": "same-origin",
        "x-content-type-options": "nosniff",
      });
      const assertUnavailable = async (revisionId: string) => {
        const denied = await download(revisionId);
        assert.equal(denied.status, 404);
        assert.equal(await denied.text(), unavailable);
        assert.deepEqual(Object.fromEntries(denied.headers), {
          "cache-control": "private, no-store",
          "content-type": "text/plain; charset=utf-8",
          "cross-origin-resource-policy": "same-origin",
          "x-content-type-options": "nosniff",
        });
      };
      await assertUnavailable(createUuidV7());
      await assertUnavailable("invalid-revision-id");
      const state = await readResumeWorkspaceState({ appDataRoot: value.root });
      await createResumeWorkspace({
        appDataRoot: value.root,
        name: "Other workspace",
        expectedRevisionNumber: state.revisionNumber,
      });
      await assertUnavailable(generated.revisionId);
    } finally {
      if (originalLocalAppData === undefined) delete process.env.LOCALAPPDATA;
      else process.env.LOCALAPPDATA = originalLocalAppData;
      await cleanup(parent);
    }
  });
}
