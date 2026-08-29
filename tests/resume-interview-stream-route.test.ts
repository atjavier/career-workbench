import assert from "node:assert/strict";
import test from "node:test";

import { createResumeInterviewStreamResponse } from "../src/app/api/resume-interview/stream/route";

const workspaceId = "00000000-0000-7000-8000-000000000101";
const consentNonce = "00000000-0000-7000-8000-000000000102";
const streamRequestId = "00000000-0000-7000-8000-000000000103";
const configuration = {
  id: "00000000-0000-7000-8000-000000000104",
  configurationDigest: `sha256:${"a".repeat(64)}`,
  modelIdentifier: "qwen/qwen3.5-9b",
};

function request(signal?: AbortSignal): Request {
  return new Request("http://localhost/api/resume-interview/stream", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      workspaceId,
      taskId: "task-stream",
      message: "Can you explain it?",
      consentNonce,
      streamRequestId,
    }),
    signal,
  });
}

test("abandoned interview streams abort the upstream request and never finalize", async () => {
  let finalized = 0;
  let aborted = 0;
  const response = await createResumeInterviewStreamResponse(request(), {
    begin: async () => ({
      question: "What was your contribution?",
      context: [],
      transcript: [],
    }),
    configuration: async () => configuration,
    finalize: async () => {
      finalized += 1;
    },
    stream: async function* (_input, signal) {
      yield "What was your contribution?";
      await new Promise<void>((resolve) => signal?.addEventListener("abort", resolve, { once: true }));
      if (signal?.aborted) aborted += 1;
      return { question: "What was your contribution?" };
    },
  });
  const reader = response.body!.getReader();
  assert.match(new TextDecoder().decode((await reader.read()).value), /"delta"/);
  await reader.cancel();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(aborted, 1);
  assert.equal(finalized, 0);
});

test("request-aborted interview streams abort upstream and never finalize", async () => {
  const controller = new AbortController();
  let finalized = 0;
  let aborted = 0;
  const response = await createResumeInterviewStreamResponse(request(controller.signal), {
    begin: async () => ({
      question: "What was your contribution?",
      context: [],
      transcript: [],
    }),
    configuration: async () => configuration,
    finalize: async () => {
      finalized += 1;
    },
    stream: async function* (_input, signal) {
      yield "What was your contribution?";
      await new Promise<void>((resolve) => signal?.addEventListener("abort", resolve, { once: true }));
      if (signal?.aborted) aborted += 1;
      return { question: "What was your contribution?" };
    },
  });
  const reader = response.body!.getReader();
  await reader.read();
  controller.abort();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(aborted, 1);
  assert.equal(finalized, 0);
  await reader.cancel();
});
