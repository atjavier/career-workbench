import assert from "node:assert/strict";
import test from "node:test";

import { createResumeInterviewStreamResponse } from "../src/app/api/resume-interview/stream/route";
import type { ResumeInterviewCoachRequest } from "../src/adapters/local-model/local-model-gateway";

const workspaceId = "00000000-0000-7000-8000-000000000101";
const consentNonce = "00000000-0000-4000-8000-000000000102";
const streamRequestId = "00000000-0000-4000-8000-000000000103";
const configuration = {
  id: "00000000-0000-7000-8000-000000000104",
  configurationDigest: `sha256:${"a".repeat(64)}`,
  modelIdentifier: "qwen/qwen3.5-9b",
};

function request(
  signal?: AbortSignal,
  opening = false,
  message = opening ? "" : "Can you explain it?",
): Request {
  return new Request("http://localhost/api/resume-interview/stream", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      workspaceId,
      taskId: "task-stream",
      message,
      opening,
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
    stream: async function* (
      _input: ResumeInterviewCoachRequest,
      signal?: AbortSignal,
    ) {
      yield "What was your contribution?";
      await new Promise<void>((resolve) =>
        signal?.addEventListener("abort", resolve, { once: true }),
      );
      if (signal?.aborted) aborted += 1;
      return { content: "What was your contribution?" };
    },
  });
  const reader = response.body!.getReader();
  assert.match(
    new TextDecoder().decode((await reader.read()).value),
    /"delta"/,
  );
  await reader.cancel();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(aborted, 1);
  assert.equal(finalized, 0);
});

test("opening interview streams request a Coach greeting without a candidate turn", async () => {
  let began: { candidateContent?: string; opening?: boolean } | undefined;
  let finalized: { opening?: boolean } | undefined;
  const response = await createResumeInterviewStreamResponse(
    request(undefined, true),
    {
      begin: async (input: {
        candidateContent?: string;
        opening?: boolean;
      }) => {
        began = input;
        return {
          question: "What was your contribution?",
          context: [],
          transcript: [],
        };
      },
      configuration: async () => configuration,
      revalidate: () => {},
      finalize: async (input: { opening?: boolean }) => {
        finalized = input;
      },
      stream: async function* (
        input: Pick<ResumeInterviewCoachRequest, "opening" | "transcript">,
      ) {
        assert.equal(input.opening, true);
        assert.deepEqual(input.transcript, []);
        yield "I will help you clarify your documented experience.";
        return {
          content: "I will help you clarify your documented experience.",
        };
      },
    },
  );
  const content = await response.text();
  assert.match(content, /"complete"/);
  assert.equal(began?.candidateContent, "");
  assert.equal(began?.opening, true);
  assert.equal(finalized?.opening, true);
});

test("a natural completion reply advances without asking the model again", async () => {
  let finalized: { coachContent?: string } | undefined;
  let answered: { answer?: string } | undefined;
  const response = await createResumeInterviewStreamResponse(
    request(undefined, false, "No more."),
    {
      begin: async () => ({
        question: "What was your contribution?",
        context: [],
        transcript: [
          "Coach: Would you like to add or clarify anything else?",
          "Candidate: No more.",
        ],
      }),
      configuration: async () => {
        assert.fail("completion should not call the local model");
      },
      stream: async function* () {
        assert.fail("completion should not stream a model response");
        return { content: "" };
      },
      finalize: async (input: { coachContent?: string }) => {
        finalized = input;
      },
      readPriorCandidate: async () => "I owned the documented workflow.",
      respond: async (input: { answer?: string }) => {
        answered = input;
        return {
          completed: [],
          current: undefined,
          remaining: 0,
          total: 0,
          turns: [],
        };
      },
      revalidate: () => {},
    },
  );
  const content = await response.text();
  assert.match(content, /I will move us to the next question/);
  assert.equal(
    finalized?.coachContent,
    "Thanks, that completes this clarification. I will move us to the next question.",
  );
  assert.equal(answered?.answer, "I owned the documented workflow.");
});

test("request-aborted interview streams abort upstream and never finalize", async () => {
  const controller = new AbortController();
  let finalized = 0;
  let aborted = 0;
  const response = await createResumeInterviewStreamResponse(
    request(controller.signal),
    {
      begin: async () => ({
        question: "What was your contribution?",
        context: [],
        transcript: [],
      }),
      configuration: async () => configuration,
      finalize: async () => {
        finalized += 1;
      },
      stream: async function* (
        _input: ResumeInterviewCoachRequest,
        signal?: AbortSignal,
      ) {
        yield "What was your contribution?";
        await new Promise<void>((resolve) =>
          signal?.addEventListener("abort", resolve, { once: true }),
        );
        if (signal?.aborted) aborted += 1;
        return { content: "What was your contribution?" };
      },
    },
  );
  const reader = response.body!.getReader();
  await reader.read();
  controller.abort();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(aborted, 1);
  assert.equal(finalized, 0);
  await reader.cancel();
});
