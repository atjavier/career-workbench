import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { documentWithLocalModel } from "../src/adapters/evidence-documenter/lm-studio-documenter";

const originalModel = process.env.LM_STUDIO_MODEL;
function response(content: unknown, headers?: HeadersInit) { return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] }), { status: 200, headers }); }

test("LM Studio adapter is loopback-only, bounded, validates model JSON, and never retries", async () => {
  process.env.LM_STUDIO_MODEL = "local-test";
  try {
    let calls = 0; let url = "";
    const output = await documentWithLocalModel([{ path: "notes.md", text: "# Results\nBuilt safely." }], async (input) => { calls += 1; url = String(input); return response({ proposals: [{ factualText: "Built safely.", sourcePaths: ["notes.md"], unknowns: ["Metric unavailable"] }] }); });
    assert.equal(calls, 1); assert.equal(url, "http://127.0.0.1:1234/v1/chat/completions"); assert.equal(output[0].sourcePaths[0], "notes.md");
    await assert.rejects(documentWithLocalModel([{ path: "notes.md", text: "x" }], async () => response({ proposals: [{ factualText: "x", sourcePaths: ["notes.md"], unknowns: [] }] }, { "content-length": "100001" })), { code: "EVIDENCE_LIBRARY_INVALID" });
    await assert.rejects(documentWithLocalModel([{ path: "notes.md", text: "x" }], async () => response({ proposals: [{ factualText: "x", sourcePaths: ["other.md"], unknowns: [] }] })), { code: "EVIDENCE_LIBRARY_INVALID" });
    await assert.rejects(documentWithLocalModel([{ path: "notes.md", text: "x" }], async () => response({ proposals: [{ factualText: "x", sourcePaths: ["notes.md", "../other.md"], unknowns: ["None identified"] }] })), { code: "EVIDENCE_LIBRARY_INVALID" });
    await assert.rejects(documentWithLocalModel([{ path: "notes.md", text: "x" }], async () => response({ proposals: [] })), { code: "EVIDENCE_LIBRARY_INVALID" });
  } finally { if (originalModel === undefined) delete process.env.LM_STUDIO_MODEL; else process.env.LM_STUDIO_MODEL = originalModel; }
});

test("documenter UI avoids paths, prompts, model output diagnostics, credentials, and audit payloads", async () => {
  const ui = await readFile(new URL("../src/app/evidence-library.tsx", import.meta.url), "utf8");
  assert.match(ui, /Document for Resume/); assert.match(ui, /localModelDisclosure/); assert.match(ui, /Documentation cancelled before it started/); assert.match(ui, /formNoValidate/); assert.match(ui, /expectedRevisionId/); assert.match(ui, /role="status"/);
  assert.doesNotMatch(ui, /LM_STUDIO_API_TOKEN|absolutePath|prompt|raw response|token|audit payload/i);
});
