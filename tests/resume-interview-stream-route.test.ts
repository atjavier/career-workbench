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

test("a validated adequate answer completes through the atomic response command", async () => {
  let finalized = 0;
  let responded: Record<string, unknown> | undefined;
  const response = await createResumeInterviewStreamResponse(request(), {
    begin: async () => ({
      question: "What was your contribution?",
      context: [],
      transcript: ["Candidate: Can you explain it?"],
      clarificationUsed: false,
    }),
    configuration: async () => configuration,
    stream: async function* () {
      yield "Thanks, that answers the question.";
      return {
        content: "Thanks, that answers the question.",
        decision: { disposition: "complete", answerSource: "latest" },
      };
    },
    finalize: async () => {
      finalized += 1;
    },
    respond: async (input: Record<string, unknown>) => {
      responded = input;
      return {
        completed: [],
        current: undefined,
        remaining: 0,
        total: 0,
        turns: [],
      };
    },
    revalidate: () => {},
  });
  assert.match(await response.text(), /"complete"/);
  assert.equal(finalized, 0);
  assert.deepEqual(responded, {
    workspaceId,
    taskId: "task-stream",
    answer: "Can you explain it?",
    skip: false,
    coachContent: "Thanks, that answers the question.",
    streamRequestId,
    signal: responded?.signal,
  });
});

test("a decline keeps the previous exact answer after one validated model turn", async () => {
  let modelCalls = 0;
  let responded: Record<string, unknown> | undefined;
  const response = await createResumeInterviewStreamResponse(
    request(undefined, false, "No need."),
    {
      begin: async () => ({
        question: "What was your contribution?",
        context: [],
        transcript: [
          "Candidate: I owned the documented workflow.",
          "Candidate: No need.",
        ],
        clarificationUsed: true,
      }),
      configuration: async () => configuration,
      stream: async function* () {
        modelCalls += 1;
        yield "Thanks, I will use your earlier answer.";
        return {
          content: "Thanks, I will use your earlier answer.",
          decision: { disposition: "complete", answerSource: "prior" },
        };
      },
      readPriorCandidate: async () => "I owned the documented workflow.",
      respond: async (input: Record<string, unknown>) => {
        responded = input;
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
  assert.match(await response.text(), /"complete"/);
  assert.equal(modelCalls, 1);
  assert.equal(responded?.answer, "I owned the documented workflow.");
  assert.equal(responded?.skip, false);
});

test("decline variants select the prior exact answer without a retry", async () => {
  for (const message of ["none", "nope", "no need"]) {
    let calls = 0;
    let answer: unknown;
    const response = await createResumeInterviewStreamResponse(
      request(undefined, false, message),
      {
        begin: async () => ({
          question: "What was your contribution?",
          context: [],
          transcript: ["Candidate: I owned the documented workflow."],
          clarificationUsed: true,
        }),
        configuration: async () => configuration,
        stream: async function* () {
          calls += 1;
          yield "Thanks, I will use the answer you already gave.";
          return {
            content: "Thanks, I will use the answer you already gave.",
            decision: { disposition: "complete", answerSource: "prior" },
          };
        },
        readPriorCandidate: async () => "I owned the documented workflow.",
        respond: async (input: Record<string, unknown>) => {
          answer = input.answer;
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
    assert.match(await response.text(), /"complete"/);
    assert.equal(calls, 1);
    assert.equal(answer, "I owned the documented workflow.");
  }
});

test("validated unknown and clarify decisions use only their allowed domain paths", async () => {
  let unknown: Record<string, unknown> | undefined;
  const unknownResponse = await createResumeInterviewStreamResponse(request(), {
    begin: async () => ({
      question: "What was your contribution?",
      context: [],
      transcript: [],
      clarificationUsed: false,
    }),
    configuration: async () => configuration,
    stream: async function* () {
      yield "It is okay not to know that.";
      return {
        content: "It is okay not to know that.",
        decision: { disposition: "unknown" },
      };
    },
    respond: async (input: Record<string, unknown>) => {
      unknown = input;
      return {
        completed: [],
        current: undefined,
        remaining: 0,
        total: 0,
        turns: [],
      };
    },
    revalidate: () => {},
  });
  assert.match(await unknownResponse.text(), /"complete"/);
  assert.equal(unknown?.skip, true);
  assert.equal(unknown?.answer, undefined);

  let clarified: Record<string, unknown> | undefined;
  let responseCalls = 0;
  const clarifyResponse = await createResumeInterviewStreamResponse(request(), {
    begin: async () => ({
      question: "What was your contribution?",
      context: [],
      transcript: [],
      clarificationUsed: false,
    }),
    configuration: async () => configuration,
    stream: async function* () {
      yield "Which deployment step did you own?";
      return {
        content: "Which deployment step did you own?",
        decision: { disposition: "clarify", missingDetail: "deployment step" },
      };
    },
    finalize: async (input: Record<string, unknown>) => {
      clarified = input;
    },
    respond: async () => {
      responseCalls += 1;
      return {
        completed: [],
        current: undefined,
        remaining: 0,
        total: 0,
        turns: [],
      };
    },
    revalidate: () => {},
  });
  assert.match(await clarifyResponse.text(), /"complete"/);
  assert.equal(responseCalls, 0);
  assert.equal(clarified?.coachContent, "Which deployment step did you own?");
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
