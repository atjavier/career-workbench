import assert from "node:assert/strict";
import test from "node:test";

import {
  editableTexRevisionConsentFingerprint,
  validateEditableTexRevisionResponse,
  editableTexRequestBudget,
  editableTexMaximumResponseBytes,
  requestEditableTexRevision,
} from "../src/adapters/local-model/local-model-gateway";
import { validateRawTexDocument } from "../src/domain/resume-generation/resume-tex-compiler";

const connection = {
  configurationRevisionId: "00000000-0000-7000-8000-000000000009",
  configurationDigest: `sha256:${"f".repeat(64)}`,
  modelIdentifier: "qwen/qwen3.5-9b",
};
const baseline =
  "\\documentclass{article}\n\\begin{document}\n\\section{Experience}\nOriginal\n\\end{document}\n";
function request() {
  const unsigned = {
    connection,
    workspaceId: "00000000-0000-7000-8000-000000000010",
    displayName: "Target role",
    baseline: {
      id: "00000000-0000-7000-8000-000000000011",
      contentDigest: `sha256:${"a".repeat(64)}`,
      tex: baseline,
    },
    artifacts: [
      {
        documentId: "00000000-0000-7000-8000-000000000012",
        path: "resume-evidence/workspaces/w/projects/p/resume-evidence.md",
        contentDigest: `sha256:${"b".repeat(64)}`,
        text: "# Approved evidence\nBuilt a safe workflow.",
      },
    ],
    consentNonce: "consent-1",
    contextLimitTokens: 30_000,
  };
  return {
    ...unsigned,
    consentFingerprint: editableTexRevisionConsentFingerprint(unsigned),
  };
}

test("editable TeX response requires the complete artifact snapshot", () => {
  const input = request();
  const response = {
    schemaVersion: 1,
    selectionEcho: input.consentFingerprint,
    tex: baseline,
    artifactCitations: [],
  };
  assert.throws(() => validateEditableTexRevisionResponse(response, input), {
    code: "RESUME_COACH_INVALID",
  });
  const accepted = validateEditableTexRevisionResponse(
    {
      ...response,
      artifactCitations: [
        {
          path: input.artifacts[0]!.path,
          contentDigest: input.artifacts[0]!.contentDigest,
        },
      ],
    },
    input,
  );
  assert.equal(accepted.tex, baseline);
});

test("editable TeX budget uses the serialized complete citation envelope", () => {
  const input = request();
  const one = editableTexRequestBudget(input);
  const expanded = {
    ...input,
    artifacts: [
      ...input.artifacts,
      {
        ...input.artifacts[0]!,
        documentId: "00000000-0000-7000-8000-000000000013",
        path: "resume-evidence/workspaces/w/projects/p/extra.md",
      },
    ],
  };
  assert.ok(
    editableTexRequestBudget(expanded).serializedRequestBytes >
      one.serializedRequestBytes,
  );
  assert.equal(one.inputTokenUpperBound, one.serializedRequestBytes);
  assert.equal(
    one.totalContextTokenUpperBound,
    one.inputTokenUpperBound + one.responseTokenReserve,
  );
});

test("oversized complete TeX packet is rejected before local-model transport", async () => {
  const input = request();
  const unsigned = {
    ...input,
    contextLimitTokens: 12_001,
    artifacts: [{ ...input.artifacts[0]!, text: "x".repeat(20_000) }],
  };
  const oversized = {
    ...unsigned,
    consentFingerprint: editableTexRevisionConsentFingerprint(unsigned),
  };
  let called = false;
  await assert.rejects(
    requestEditableTexRevision(oversized, async () => {
      called = true;
      return new Response("{}");
    }),
    { code: "RESUME_COACH_INVALID" },
  );
  assert.equal(called, false);
});

test("editable TeX transport rejects UTF-8 bytes over its limit even when character count fits", async () => {
  const input = request();
  const envelope = {
    schemaVersion: 1,
    selectionEcho: input.consentFingerprint,
    tex: baseline,
    artifactCitations: input.artifacts.map(({ path, contentDigest }) => ({
      path,
      contentDigest,
    })),
  };
  const transportLimit = editableTexMaximumResponseBytes * 2;
  const transport = (character: string) =>
    JSON.stringify({
      output: [
        { type: "reasoning", content: character.repeat(33_000) },
        { type: "message", content: JSON.stringify(envelope) },
      ],
    });
  // Both envelopes are valid and have identical UTF-16 lengths; only UTF-8
  // transport bytes discriminate them. The actual TeX stays well below its limit.
  const ascii = transport("a");
  const multibyte = transport("界");
  assert.equal(ascii.length, multibyte.length);
  assert.ok(multibyte.length < transportLimit);
  assert.ok(Buffer.byteLength(ascii, "utf8") < transportLimit);
  assert.ok(Buffer.byteLength(multibyte, "utf8") > transportLimit);
  assert.deepEqual(
    await requestEditableTexRevision(input, async () => new Response(ascii)),
    envelope,
  );
  let calls = 0;
  await assert.rejects(
    requestEditableTexRevision(input, async () => {
      calls += 1;
      const response = new Response(multibyte);
      assert.equal(response.headers.get("content-length"), null);
      return response;
    }),
    {
      code: "RESUME_COACH_UNAVAILABLE",
      message: "The local model returned an oversized response.",
    },
  );
  assert.equal(calls, 1);
});

test("raw TeX preserves the immutable preamble and rejects external input", () => {
  const revised = baseline.replace(
    "Original",
    "\\textbf{Built a safe workflow.}",
  );
  assert.doesNotThrow(() => validateRawTexDocument(revised, baseline));
  assert.throws(() =>
    validateRawTexDocument(
      revised.replace(
        "\\begin{document}",
        "\\usepackage{evil}\n\\begin{document}",
      ),
      baseline,
    ),
  );
  assert.throws(() =>
    validateRawTexDocument(
      revised.replace("\\textbf{Built a safe workflow.}", "\\input{secret}"),
      baseline,
    ),
  );
  assert.throws(() =>
    validateRawTexDocument(
      revised.replace("Built a safe workflow.", "^^5cinput{secret}"),
      baseline,
    ),
  );
});
