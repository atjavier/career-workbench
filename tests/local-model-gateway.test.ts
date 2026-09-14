import assert from "node:assert/strict";
import test from "node:test";

import {
  localModelCapabilityVersion,
  opportunityAssessmentConsentFingerprint,
  requestOpportunityAssessment,
  requestResumeCoach,
  requestResumeCoachReview,
  requestResumeInterviewCoach,
  streamResumeInterviewCoach,
  resumeCoachConsentFingerprint,
  resumeCoachSystemInstruction,
  resumeInterviewCoachConsentFingerprint,
} from "../src/adapters/local-model/local-model-gateway";
import type { ResumeFileReadSession } from "../src/files/evidence-library";
import {
  resumeGeneratorEditorialInstruction,
  resumeGeneratorEvidenceIntelligenceInstruction,
  resumeGeneratorProjectIdentityInstruction,
  resumeGeneratorSystemInstruction,
} from "../src/adapters/local-model/resume-generator-agent";

const connection = {
  configurationRevisionId: "00000000-0000-7000-8000-000000000009",
  configurationDigest: `sha256:${"f".repeat(64)}`,
  modelIdentifier: "qwen/qwen3.5-9b",
};
const baseline = {
  baselineId: "00000000-0000-7000-8000-000000000014",
  baselineDigest: `sha256:${"d".repeat(64)}`,
  sections: [
    {
      heading: "Experience",
      tag: "experience",
      existingDetail: "Software Engineering Intern | Example Co",
    },
    {
      heading: "Education",
      tag: "education",
      existingDetail: "Example University | Computer Science | 2026",
    },
    {
      heading: "Projects",
      tag: "projects",
      existingDetail: "",
    },
    {
      heading: "Technical Skills",
      tag: "technical-skills",
      existingDetail: "Languages: TypeScript",
    },
  ],
};
const requestBase = {
  connection,
  profileRevisionId: "00000000-0000-7000-8000-000000000010",
  profileDigest: `sha256:${"a".repeat(64)}`,
  profileSnapshot: "Adrian Javier, TypeScript developer",
  templateId: "00000000-0000-7000-8000-000000000011",
  templateDigest: `sha256:${"c".repeat(64)}`,
  evidence: [
    {
      id: "00000000-0000-7000-8000-000000000001",
      contentDigest: `sha256:${"b".repeat(64)}`,
      factualText: "Built accessible TypeScript interfaces.",
    },
  ],
  userRequest: "Help me improve my resume.",
  consentNonce: "test-consent-1",
};
function request() {
  return {
    ...requestBase,
    consentFingerprint: resumeCoachConsentFingerprint(requestBase),
  };
}
function native(content: unknown, extra: Record<string, unknown> = {}) {
  return new Response(
    JSON.stringify({
      output: [{ type: "message", content: JSON.stringify(content) }],
      ...extra,
    }),
    { status: 200 },
  );
}

function interviewDecisionContent(
  content: string,
  decision: Record<string, unknown>,
): string {
  return `${content}<resume-interview-decision>${JSON.stringify(decision)}</resume-interview-decision>`;
}

test("Resume Interview Coach sends one bounded, stateless local request and rejects non-exact saved questions", async () => {
  const base = {
    connection,
    workspaceId: "00000000-0000-7000-8000-000000000099",
    taskId: "task-1",
    question: "What was your contribution?",
    context: ["Built the documented workflow."],
    transcript: ["Candidate: Can you explain this?"],
    consentNonce: "interview-consent",
  };
  const value = {
    ...base,
    consentFingerprint: resumeInterviewCoachConsentFingerprint(base),
  };
  const response = await requestResumeInterviewCoach(
    value,
    async (url, init) => {
      assert.equal(url, "http://127.0.0.1:1234/api/v1/chat");
      assert.match(String(init.body), /"store":false/);
      return native({
        schemaVersion: 1,
        question: value.question,
        followUp: "Which part did you own?",
        selectionEcho: value.consentFingerprint,
      });
    },
  );
  assert.equal(response.question, value.question);
  assert.equal(response.followUp, "Which part did you own?");
  const noFollowUp = await requestResumeInterviewCoach(value, async () =>
    native({
      schemaVersion: 1,
      question: value.question,
      selectionEcho: value.consentFingerprint,
    }),
  );
  assert.equal(noFollowUp.followUp, undefined);
  await assert.rejects(
    requestResumeInterviewCoach(value, async () =>
      native({
        schemaVersion: 1,
        question: "Invented question",
        selectionEcho: value.consentFingerprint,
      }),
    ),
    { code: "RESUME_COACH_INVALID" },
  );
});

test("Resume Interview Coach streams a bounded natural reply through native LM Studio SSE", async () => {
  const base = {
    connection,
    workspaceId: "00000000-0000-7000-8000-000000000099",
    taskId: "task-stream",
    question: "What was your contribution?",
    context: ["Built the documented workflow."],
    transcript: ["Candidate: Can you explain this?"],
    consentNonce: "stream-consent",
  };
  const value = {
    ...base,
    consentFingerprint: resumeInterviewCoachConsentFingerprint(base),
  };
  const content =
    "That sounds like a useful contribution. What part did you own?";
  const rawContent = interviewDecisionContent(content, {
    schemaVersion: 1,
    selectionEcho: value.consentFingerprint,
    disposition: "clarify",
    missingDetail: "What part did you own",
  });
  const frames = [
    {
      name: "chat.start",
      data: {
        type: "chat.start",
        model_instance_id: connection.modelIdentifier,
      },
    },
    {
      name: "message.delta",
      data: { type: "message.delta", content: rawContent.slice(0, 30) },
    },
    {
      name: "message.delta",
      data: {
        type: "message.delta",
        content: rawContent.slice(30),
      },
    },
    {
      name: "chat.end",
      data: {
        type: "chat.end",
        result: { output: [{ type: "message", content: rawContent }] },
      },
    },
  ]
    .map(
      (event) =>
        `event: ${event.name}\ndata: ${JSON.stringify(event.data)}\n\n`,
    )
    .join("");
  const response = await (async () => {
    const stream = streamResumeInterviewCoach(
      value,
      undefined,
      async (url, init) => {
        assert.equal(url, "http://127.0.0.1:1234/api/v1/chat");
        assert.match(String(init.body), /"stream":true/);
        assert.match(String(init.body), /"store":false/);
        const payload = JSON.parse(String(init.body)) as { input: string };
        assert.equal(
          JSON.parse(payload.input).latestCandidateMessage,
          "Can you explain this?",
        );
        assert.equal(new Headers(init.headers).get("authorization"), null);
        return new Response(frames, {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        });
      },
    );
    const deltas: string[] = [];
    while (true) {
      const next = await stream.next();
      if (next.done) return { deltas, complete: next.value };
      deltas.push(next.value);
    }
  })();
  assert.equal(response.deltas.join(""), content);
  assert.deepEqual(response.complete, {
    content,
    decision: {
      disposition: "clarify",
      missingDetail: "What part did you own",
    },
  });
  const malformed = streamResumeInterviewCoach(
    value,
    undefined,
    async () =>
      new Response(
        'event: chat.end\ndata: {"type":"chat.end","result":{"output":[]}}\n\n',
        {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        },
      ),
  );
  await assert.rejects(malformed.next(), { code: "RESUME_COACH_INVALID" });
});

test("Resume Interview Coach starts an empty conversation with a brief Coach opening", async () => {
  const base = {
    connection,
    workspaceId: "00000000-0000-7000-8000-000000000099",
    taskId: "task-opening",
    question: "What was your contribution?",
    context: ["Built the documented workflow."],
    transcript: [],
    opening: true,
    consentNonce: "opening-consent",
  };
  const value = {
    ...base,
    consentFingerprint: resumeInterviewCoachConsentFingerprint(base),
  };
  const content = "What was your contribution?";
  const stream = streamResumeInterviewCoach(
    value,
    undefined,
    async (_url, init) => {
      const payload = JSON.parse(String(init.body)) as { input: string };
      assert.deepEqual(JSON.parse(payload.input), {
        savedQuestion: value.question,
        context: value.context,
        transcript: [],
        opening: true,
        latestCandidateMessage: null,
        clarificationUsed: false,
        responseShape:
          "Ask the exact saved question directly. Reply with that question only: no preamble, explanation, labels, tools, or actions.",
      });
      return new Response(
        [
          { name: "message.delta", data: { type: "message.delta", content } },
          {
            name: "chat.end",
            data: {
              type: "chat.end",
              result: { output: [{ type: "message", content }] },
            },
          },
        ]
          .map(
            (event) =>
              `event: ${event.name}\ndata: ${JSON.stringify(event.data)}\n\n`,
          )
          .join(""),
        { status: 200, headers: { "content-type": "text/event-stream" } },
      );
    },
  );
  assert.equal((await stream.next()).value, content);
  assert.deepEqual((await stream.next()).value, { content });
});

test("Resume Interview Coach fails closed when a candidate turn has no validated decision", async () => {
  const base = {
    connection,
    workspaceId: "00000000-0000-7000-8000-000000000099",
    taskId: "task-scope",
    question: "What problem or need was BioEvidence intended to address?",
    context: ["BioEvidence is a documented project."],
    transcript: ["Candidate: what are we doing"],
    consentNonce: "scope-consent",
  };
  const value = {
    ...base,
    consentFingerprint: resumeInterviewCoachConsentFingerprint(base),
  };
  const ungrounded =
    "We are building a Flask application to manage bioinformatics analysis runs.";
  const stream = streamResumeInterviewCoach(
    value,
    undefined,
    async (_url, init) => {
      const payload = JSON.parse(String(init.body)) as {
        system_prompt: string;
      };
      assert.match(payload.system_prompt, /BioEvidence intended to address/);
      assert.match(
        payload.system_prompt,
        /Never act as a general-purpose assistant/,
      );
      return new Response(
        [
          {
            name: "message.delta",
            data: { type: "message.delta", content: ungrounded },
          },
          {
            name: "chat.end",
            data: {
              type: "chat.end",
              result: { output: [{ type: "message", content: ungrounded }] },
            },
          },
        ]
          .map(
            (event) =>
              `event: ${event.name}\ndata: ${JSON.stringify(event.data)}\n\n`,
          )
          .join(""),
        { status: 200, headers: { "content-type": "text/event-stream" } },
      );
    },
  );
  await assert.rejects(stream.next(), { code: "RESUME_COACH_INVALID" });
});

test("Resume Interview Coach accepts a complete decision without a generic additional-details prompt", async () => {
  const base = {
    connection,
    workspaceId: "00000000-0000-7000-8000-000000000099",
    taskId: "task-transition",
    question: "What was your contribution?",
    context: ["Built the documented workflow."],
    transcript: [
      "Coach: What was your contribution?",
      "Candidate: I built the documented workflow.",
    ],
    consentNonce: "transition-consent",
  };
  const value = {
    ...base,
    consentFingerprint: resumeInterviewCoachConsentFingerprint(base),
  };
  const visible = "That is a clear contribution. Thank you.";
  const content = interviewDecisionContent(visible, {
    schemaVersion: 1,
    selectionEcho: value.consentFingerprint,
    disposition: "complete",
    answerSource: "latest",
  });
  const stream = streamResumeInterviewCoach(
    value,
    undefined,
    async () =>
      new Response(
        [
          {
            name: "message.delta",
            data: { type: "message.delta", content },
          },
          {
            name: "chat.end",
            data: {
              type: "chat.end",
              result: { output: [{ type: "message", content }] },
            },
          },
        ]
          .map(
            (event) =>
              `event: ${event.name}\ndata: ${JSON.stringify(event.data)}\n\n`,
          )
          .join(""),
        { status: 200, headers: { "content-type": "text/event-stream" } },
      ),
  );
  assert.equal((await stream.next()).value, visible);
  assert.deepEqual((await stream.next()).value, {
    content: visible,
    decision: { disposition: "complete", answerSource: "latest" },
  });
  assert.doesNotMatch(visible, /add or clarify anything else/i);
});

test("Resume Interview Coach rejects a complete decision that visibly asks a follow-up", async () => {
  const base = {
    connection,
    workspaceId: "00000000-0000-7000-8000-000000000099",
    taskId: "task-contradiction",
    question: "What was your contribution?",
    context: ["Built the documented workflow."],
    transcript: ["Candidate: I built the documented workflow."],
    consentNonce: "contradiction-consent",
  };
  const value = {
    ...base,
    consentFingerprint: resumeInterviewCoachConsentFingerprint(base),
  };
  const visible = "That sounds useful. Could you clarify what you owned?";
  const content = interviewDecisionContent(visible, {
    schemaVersion: 1,
    selectionEcho: value.consentFingerprint,
    disposition: "complete",
    answerSource: "latest",
  });
  const stream = streamResumeInterviewCoach(
    value,
    undefined,
    async () =>
      new Response(
        `event: message.delta\ndata: ${JSON.stringify({ type: "message.delta", content })}\n\nevent: chat.end\ndata: ${JSON.stringify({ type: "chat.end", result: { output: [{ type: "message", content }] } })}\n\n`,
        { status: 200, headers: { "content-type": "text/event-stream" } },
      ),
  );
  await assert.rejects(stream.next(), { code: "RESUME_COACH_INVALID" });
});

test("Resume Interview Coach accepts native SSE complete/prior and unknown decisions, including a 2,400-character delta", async () => {
  const base = {
    connection,
    workspaceId: "00000000-0000-7000-8000-000000000099",
    taskId: "task-native-decisions",
    question: "What was your contribution?",
    context: ["Built the documented workflow."],
    transcript: [
      "Candidate: I owned the documented workflow.",
      "Candidate: No need.",
    ],
    consentNonce: "native-decisions-consent",
  };
  const value = {
    ...base,
    consentFingerprint: resumeInterviewCoachConsentFingerprint(base),
  };
  for (const [content, decision] of [
    [
      "Thanks, I will use the answer you already gave.",
      { disposition: "complete", answerSource: "prior" },
    ],
    ["It is okay to leave that unknown.", { disposition: "unknown" }],
  ] as const) {
    const rawContent = interviewDecisionContent(content, {
      schemaVersion: 1,
      selectionEcho: value.consentFingerprint,
      ...decision,
    });
    const stream = streamResumeInterviewCoach(
      value,
      undefined,
      async () =>
        new Response(
          `event: message.delta\ndata: ${JSON.stringify({ type: "message.delta", content: rawContent })}\n\nevent: chat.end\ndata: ${JSON.stringify({ type: "chat.end", result: { output: [{ type: "message", content: rawContent }] } })}\n\n`,
          { status: 200, headers: { "content-type": "text/event-stream" } },
        ),
    );
    assert.equal((await stream.next()).value, content);
    assert.deepEqual((await stream.next()).value, { content, decision });
  }

  const visible = "a".repeat(1_800);
  const decision = {
    schemaVersion: 1,
    selectionEcho: value.consentFingerprint,
    disposition: "complete",
    answerSource: "latest",
  } as const;
  const encodedDecision = JSON.stringify(decision);
  const rawWithoutPadding = interviewDecisionContent(visible, decision);
  const rawContent = `${visible}<resume-interview-decision>${encodedDecision.slice(0, -1)}${" ".repeat(2_400 - rawWithoutPadding.length)}}</resume-interview-decision>`;
  assert.equal(rawContent.length, 2_400);
  const boundary = streamResumeInterviewCoach(
    value,
    undefined,
    async () =>
      new Response(
        `event: message.delta\ndata: ${JSON.stringify({ type: "message.delta", content: rawContent })}\n\nevent: chat.end\ndata: ${JSON.stringify({ type: "chat.end", result: { output: [{ type: "message", content: rawContent }] } })}\n\n`,
        { status: 200, headers: { "content-type": "text/event-stream" } },
      ),
  );
  assert.equal((await boundary.next()).value, visible);
  assert.deepEqual((await boundary.next()).value, {
    content: visible,
    decision: { disposition: "complete", answerSource: "latest" },
  });
});

test("Resume Interview Coach rejects a second clarification decision", async () => {
  const base = {
    connection,
    workspaceId: "00000000-0000-7000-8000-000000000099",
    taskId: "task-second-clarification",
    question: "What was your contribution?",
    context: ["Built the documented workflow."],
    transcript: ["Candidate: I helped."],
    clarificationUsed: true,
    consentNonce: "second-clarification-consent",
  };
  const value = {
    ...base,
    consentFingerprint: resumeInterviewCoachConsentFingerprint(base),
  };
  const content = interviewDecisionContent(
    "Which deployment step did you own?",
    {
      schemaVersion: 1,
      selectionEcho: value.consentFingerprint,
      disposition: "clarify",
      missingDetail: "deployment step",
    },
  );
  const stream = streamResumeInterviewCoach(
    value,
    undefined,
    async () =>
      new Response(
        `event: message.delta\ndata: ${JSON.stringify({ type: "message.delta", content })}\n\nevent: chat.end\ndata: ${JSON.stringify({ type: "chat.end", result: { output: [{ type: "message", content }] } })}\n\n`,
        { status: 200, headers: { "content-type": "text/event-stream" } },
      ),
  );
  await assert.rejects(stream.next(), { code: "RESUME_COACH_INVALID" });
});

test("Resume Interview Coach accepts CRLF frames and rejects duplicate terminals or oversized unfinished frames", async () => {
  const base = {
    connection,
    workspaceId: "00000000-0000-7000-8000-000000000099",
    taskId: "task-stream-boundary",
    question: "What was your contribution?",
    context: ["Built the documented workflow."],
    transcript: ["Candidate: Can you explain this?"],
    consentNonce: "stream-boundary-consent",
  };
  const value = {
    ...base,
    consentFingerprint: resumeInterviewCoachConsentFingerprint(base),
  };
  const visible =
    "I can help you describe the work clearly. What did you personally deliver?";
  const content = interviewDecisionContent(visible, {
    schemaVersion: 1,
    selectionEcho: value.consentFingerprint,
    disposition: "clarify",
    missingDetail: "What did you personally deliver",
  });
  const end = {
    type: "chat.end",
    result: { output: [{ type: "message", content }] },
  };
  const crlf = streamResumeInterviewCoach(
    value,
    undefined,
    async () =>
      new Response(
        [
          { name: "message.delta", data: { type: "message.delta", content } },
          { name: "chat.end", data: end },
        ]
          .map(
            (event) =>
              `event: ${event.name}\r\ndata: ${JSON.stringify(event.data)}\r\n\r\n`,
          )
          .join(""),
        { status: 200, headers: { "content-type": "text/event-stream" } },
      ),
  );
  assert.equal((await crlf.next()).value, visible);
  assert.deepEqual((await crlf.next()).value, {
    content: visible,
    decision: {
      disposition: "clarify",
      missingDetail: "What did you personally deliver",
    },
  });

  const duplicateTerminal = streamResumeInterviewCoach(
    value,
    undefined,
    async () =>
      new Response(
        [
          { name: "message.delta", data: { type: "message.delta", content } },
          { name: "chat.end", data: end },
          { name: "chat.end", data: end },
        ]
          .map(
            (event) =>
              `event: ${event.name}\ndata: ${JSON.stringify(event.data)}\n\n`,
          )
          .join(""),
        { status: 200, headers: { "content-type": "text/event-stream" } },
      ),
  );
  await assert.rejects(duplicateTerminal.next(), {
    code: "RESUME_COACH_INVALID",
  });

  const unterminated = streamResumeInterviewCoach(
    value,
    undefined,
    async () =>
      new Response(`event: message.delta\ndata: ${"x".repeat(8_193)}`, {
        status: 200,
        headers: { "content-type": "text/event-stream" },
      }),
  );
  await assert.rejects(unterminated.next(), { code: "RESUME_COACH_INVALID" });
});

test("Resume Coach sends one bounded tokenless native loopback request and validates grounded JSON", async () => {
  let calls = 0;
  let target = "";
  let body = "";
  let authorization = "";
  let headerNames: string[] = [];
  let hasSignal = false;
  const base = { ...requestBase, baseline };
  const value = {
    ...base,
    consentFingerprint: resumeCoachConsentFingerprint(base),
  };
  const result = await requestResumeCoach(value, async (url, init) => {
    calls += 1;
    target = String(url);
    body = String(init.body);
    authorization = new Headers(init.headers).get("authorization") ?? "";
    headerNames = [...new Headers(init.headers).keys()].sort();
    hasSignal = init.signal instanceof AbortSignal;
    if (calls === 1)
      return native({
        findings: [
          {
            evidenceIndexes: [0],
            clarificationIndexes: [],
            fact: "Built accessible TypeScript interfaces.",
          },
        ],
        unknowns: [],
      });
    if (calls === 2)
      return native({
        slots: [{ sectionIndex: 2, findingIndexes: [0] }],
        unknowns: [],
      });
    if (calls === 3)
      return native({
        edits: [
          {
            sectionIndex: 2,
            text: "Portfolio | Accessible interface\n- Built accessible TypeScript interfaces.",
            claims: [
              {
                text: "Built accessible TypeScript interfaces.",
                evidenceIndexes: [0],
                clarificationIndexes: [],
              },
            ],
          },
        ],
        unknowns: [],
      });
    return native({ verdict: "accept", reasons: [] });
  });
  assert.equal(calls, 4);
  assert.equal(target, "http://127.0.0.1:1234/api/v1/chat");
  assert.equal(authorization, "");
  assert.match(body, /"store":false/);
  assert.match(body, /"reasoning":"off"/);
  assert.match(body, /"system_prompt"/);
  assert.match(
    resumeCoachSystemInstruction,
    /Never extrapolate or calculate a benefit/,
  );
  assert.doesNotMatch(body, /integrations|previous_response_id|https:\/\//);
  assert.equal(result.claims[0]?.evidenceIndexes[0], 0);
  assert.deepEqual(headerNames, ["content-type"]);
  assert.equal(hasSignal, true);
  assert.deepEqual(Object.keys(JSON.parse(body)).sort(), [
    "input",
    "max_output_tokens",
    "model",
    "reasoning",
    "store",
    "stream",
    "system_prompt",
    "temperature",
  ]);
});

test("Resume Architect reads host-authorized files and maps citations without model-facing evidence indexes", async () => {
  const citation = {
    citationId: "citation-1",
    path: "README.md",
    startLine: 1,
    endLine: 2,
    contentDigest: `sha256:${"e".repeat(64)}`,
  };
  const session: ResumeFileReadSession = {
    roots: [
      { rootId: "root-1", label: "application" },
      { rootId: "root-2", label: "managed-work" },
    ],
    execute: async (action) => {
      assert.deepEqual(action, {
        action: "read",
        rootId: "root-2",
        path: "README.md",
        startLine: 1,
        endLine: 2,
      });
      return {
        ok: true,
        type: "read",
        rootId: "root-2",
        path: "README.md",
        citation,
        text: "Built accessible TypeScript interfaces.\nCandidate-facing workflow.",
      };
    },
    validateCitation: (value) =>
      JSON.stringify(value) === JSON.stringify(citation),
  };
  const base = { ...requestBase, baseline, fileReadSession: session };
  const value = {
    ...base,
    consentFingerprint: resumeCoachConsentFingerprint(base),
  };
  let calls = 0;
  const result = await requestResumeCoach(value, async (_url, init) => {
    calls += 1;
    const packet = JSON.parse(JSON.parse(String(init.body)).input);
    if (calls === 1) {
      assert.deepEqual(packet.roots, session.roots);
      assert.match(JSON.stringify(packet.slots), /projects/);
      assert.doesNotMatch(JSON.stringify(packet), /evidenceIndexes/);
      return native({
        kind: "tool",
        action: {
          action: "read",
          rootId: "root-2",
          path: "README.md",
          startLine: 1,
          endLine: 2,
        },
      });
    }
    assert.match(JSON.stringify(packet.observations), /citation-1/);
    return native({
      kind: "final",
      edits: [
        {
          slotId: "projects",
          text: "Portfolio | Accessible interface\n- Built accessible TypeScript interfaces.",
          claims: [
            {
              text: "Built accessible TypeScript interfaces.",
              citations: [citation],
            },
          ],
        },
      ],
      unknowns: [],
    });
  });
  assert.equal(calls, 2);
  assert.match(
    result.sections.find((section) => section.heading === "Projects")?.text ??
      "",
    /Built accessible TypeScript interfaces/,
  );
  assert.deepEqual(result.claims[0]?.evidenceIndexes, [0]);
});

test("Resume Architect accepts file agent final response with heading and trailing unknowns array", async () => {
  const citation: ResumeFileCitation = {
    citationId: "citation-1",
    path: "README.md",
    startLine: 1,
    endLine: 2,
    contentDigest: `sha256:${"a".repeat(64)}`,
  };
  const session: ResumeFileReadSession = {
    roots: [
      { rootId: "root-1", label: "application" },
      { rootId: "root-2", label: "managed-work" },
    ],
    execute: async () => ({
      ok: true,
      type: "read",
      rootId: "root-2",
      path: "README.md",
      citation,
      text: "Built accessible TypeScript interfaces.\nCandidate-facing workflow.",
    }),
    validateCitation: (value) =>
      JSON.stringify(value) === JSON.stringify(citation),
  };
  const base = { ...requestBase, baseline, fileReadSession: session };
  const value = {
    ...base,
    consentFingerprint: resumeCoachConsentFingerprint(base),
  };
  let calls = 0;
  const result = await requestResumeCoach(value, async (_url, init) => {
    calls += 1;
    if (calls === 1) {
      return native({
        kind: "tool",
        action: {
          action: "read",
          rootId: "root-2",
          path: "README.md",
          startLine: 1,
          endLine: 2,
        },
      });
    }
    const rawMalformation = JSON.stringify({
      output: [
        {
          type: "message",
          content: `{"kind":"final","edits":[{"slotId":"projects","heading":"Projects","text":"Portfolio | Accessible interface\\n- Built accessible TypeScript interfaces.","claims":[{"text":"Built accessible TypeScript interfaces.","citations":[${JSON.stringify(citation)}]}]},{"unknowns":["Ownership of project components","Specific metrics"]]`,
        },
      ],
    });
    return new Response(rawMalformation, {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
  assert.equal(calls, 2);
  assert.match(
    result.sections.find((section) => section.heading === "Projects")?.text ??
      "",
    /Built accessible TypeScript interfaces/,
  );
  assert.deepEqual(result.unknowns, [
    "Ownership of project components",
    "Specific metrics",
  ]);
});

test("Resume Architect repairs premature root close before unknowns and resolves selected-projects slot alias", async () => {
  const citation: ResumeFileCitation = {
    citationId: "citation-1",
    path: "resume-evidence.md",
    startLine: 1,
    endLine: 289,
    contentDigest: `sha256:${"b".repeat(64)}`,
  };
  const session: ResumeFileReadSession = {
    roots: [{ rootId: "root-1", label: "managed-work" }],
    execute: async () => ({
      ok: true,
      type: "read",
      rootId: "root-1",
      path: "resume-evidence.md",
      citation,
      text: "Implemented VCF file upload validation and run lifecycle management.\nCreated SQLite-backed run records with cancel functionality via guarded state transitions.",
    }),
    validateCitation: (value) =>
      JSON.stringify(value) === JSON.stringify(citation),
  };
  const base = { ...requestBase, baseline, fileReadSession: session };
  const value = {
    ...base,
    consentFingerprint: resumeCoachConsentFingerprint(base),
  };
  let calls = 0;
  const result = await requestResumeCoach(value, async () => {
    calls += 1;
    if (calls === 1) {
      return native({
        kind: "tool",
        action: {
          action: "read",
          rootId: "root-1",
          path: "resume-evidence.md",
        },
      });
    }
    const malformed = JSON.stringify({
      output: [
        {
          type: "message",
          content: `{"kind":"final","edits":[{"slotId":"selected-projects","text":"Implemented VCF file upload validation and run lifecycle management with API endpoints.\\n- Created SQLite-backed run records with cancel functionality via guarded state transitions.","claims":[{"text":"Implemented VCF file upload validation and run lifecycle management with API endpoints.","citations":[${JSON.stringify(citation)}]},{"text":"Created SQLite-backed run records with cancel functionality via guarded state transitions.","citations":[${JSON.stringify(citation)}]}]}]},"unknowns":["Project ownership and team composition","User adoption metrics"]}`,
        },
      ],
    });
    return new Response(malformed, {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
  assert.equal(calls, 2);
  assert.match(
    result.sections.find((section) => section.heading === "Projects")?.text ??
      "",
    /Created SQLite-backed run records/,
  );
  assert.deepEqual(result.unknowns, [
    "Project ownership and team composition",
    "User adoption metrics",
  ]);
});

test("Resume Architect repairs missing edits close bracket before unknowns array", async () => {
  const citation: ResumeFileCitation = {
    citationId: "citation-1",
    path: "resume-evidence.md",
    startLine: 1,
    endLine: 289,
    contentDigest: `sha256:${"d".repeat(64)}`,
  };
  const session: ResumeFileReadSession = {
    roots: [{ rootId: "root-1", label: "managed-work" }],
    execute: async () => ({
      ok: true,
      type: "read",
      rootId: "root-1",
      path: "resume-evidence.md",
      citation,
      text: "Built Flask web application with SQLite backend for run record management and VCF file validation.",
    }),
    validateCitation: (value) =>
      JSON.stringify(value) === JSON.stringify(citation),
  };
  const base = { ...requestBase, baseline, fileReadSession: session };
  const value = {
    ...base,
    consentFingerprint: resumeCoachConsentFingerprint(base),
  };
  let calls = 0;
  const result = await requestResumeCoach(value, async () => {
    calls += 1;
    if (calls === 1) {
      return native({
        kind: "tool",
        action: {
          action: "read",
          rootId: "root-1",
          path: "resume-evidence.md",
        },
      });
    }
    // Notice edits array is NOT closed before ,"unknowns": (ends with }] instead of }]])
    const modelOutput = JSON.stringify({
      output: [
        {
          type: "message",
          content: `{"kind":"final","edits":[{"slotId":"selected-projects","text":"Flask Pipeline | SQLite\\n- Built Flask web application with SQLite backend for run record management and VCF file validation.","claims":[{"text":"Built Flask web application with SQLite backend for run record management and VCF file validation.","citations":[${JSON.stringify(citation)}]}]},"unknowns":["Ownership of code and project"]}`,
        },
      ],
    });
    return new Response(modelOutput, {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
  assert.equal(calls, 2);
  assert.match(
    result.sections.find((section) => section.heading === "Projects")?.text ??
      "",
    /Built Flask web application/,
  );
  assert.deepEqual(result.unknowns, ["Ownership of code and project"]);
});

test("Resume Architect resolves model citation with customized citationId against matching executed read file", async () => {
  const executedCitation: ResumeFileCitation = {
    citationId: "citation-1",
    path: "resume-evidence.md",
    startLine: 1,
    endLine: 289,
    contentDigest: `sha256:${"e".repeat(64)}`,
  };
  const session: ResumeFileReadSession = {
    roots: [{ rootId: "root-1", label: "managed-work" }],
    execute: async () => ({
      ok: true,
      type: "read",
      rootId: "root-1",
      path: "resume-evidence.md",
      citation: executedCitation,
      text: "Developed Flask-based web application with SQLite backend for run record management and VCF file validation.",
    }),
    validateCitation: (value) =>
      JSON.stringify(value) === JSON.stringify(executedCitation),
  };
  const base = { ...requestBase, baseline, fileReadSession: session };
  const value = {
    ...base,
    consentFingerprint: resumeCoachConsentFingerprint(base),
  };
  let calls = 0;
  const result = await requestResumeCoach(value, async () => {
    calls += 1;
    if (calls === 1) {
      return native({
        kind: "tool",
        action: {
          action: "read",
          rootId: "root-1",
          path: "resume-evidence.md",
        },
      });
    }
    // Model emitted "citation-5" with sub-line range 10-12, but same path and hash
    const modelCustomCitation = {
      citationId: "citation-5",
      path: "resume-evidence.md",
      startLine: 10,
      endLine: 12,
      contentDigest: `sha256:${"e".repeat(64)}`,
    };
    const modelOutput = JSON.stringify({
      output: [
        {
          type: "message",
          content: JSON.stringify({
            kind: "final",
            edits: [
              {
                slotId: "projects",
                text: "Flask Pipeline | SQLite\n- Developed Flask-based web application with SQLite backend for run record management and VCF file validation.",
                claims: [
                  {
                    text: "Developed Flask-based web application with SQLite backend for run record management and VCF file validation.",
                    citations: [modelCustomCitation],
                  },
                ],
              },
            ],
            unknowns: ["Ownership not established"],
          }),
        },
      ],
    });
    return new Response(modelOutput, {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
  assert.equal(calls, 2);
  assert.match(
    result.sections.find((section) => section.heading === "Projects")?.text ??
      "",
    /Developed Flask-based web application/,
  );
  assert.deepEqual(result.unknowns, ["Ownership not established"]);
});

test("Resume Architect filters out unrequested non-work sections like education and skills from file agent output", async () => {
  const citation: ResumeFileCitation = {
    citationId: "citation-1",
    path: "resume-evidence.md",
    startLine: 1,
    endLine: 289,
    contentDigest: `sha256:${"c".repeat(64)}`,
  };
  const session: ResumeFileReadSession = {
    roots: [{ rootId: "root-1", label: "managed-work" }],
    execute: async () => ({
      ok: true,
      type: "read",
      rootId: "root-1",
      path: "resume-evidence.md",
      citation,
      text: "Built Flask web application for genomic variant analysis workflows.\nValidated VCF pipeline.",
    }),
    validateCitation: (value) =>
      JSON.stringify(value) === JSON.stringify(citation),
  };
  const base = { ...requestBase, baseline, fileReadSession: session };
  const value = {
    ...base,
    consentFingerprint: resumeCoachConsentFingerprint(base),
  };
  let calls = 0;
  const result = await requestResumeCoach(value, async () => {
    calls += 1;
    if (calls === 1) {
      return native({
        kind: "tool",
        action: {
          action: "read",
          rootId: "root-1",
          path: "resume-evidence.md",
        },
      });
    }
    const modelOutput = JSON.stringify({
      output: [
        {
          type: "message",
          content: JSON.stringify({
            kind: "final",
            edits: [
              {
                slotId: "selected-projects",
                text: "Genomic Variant Analysis Platform | Flask pipeline\n- Built Flask web application for genomic variant analysis workflows.",
                claims: [
                  {
                    text: "Built Flask web application for genomic variant analysis workflows.",
                    citations: [citation],
                  },
                ],
              },
              {
                slotId: "education",
                text: "University of the Philippines - BS Computer Science",
                claims: [
                  {
                    text: "University of the Philippines - BS Computer Science",
                    citations: [citation],
                  },
                ],
              },
              {
                slotId: "skills",
                text: "Python, Flask, SQLite",
                claims: [
                  {
                    text: "Python, Flask, SQLite",
                    citations: [citation],
                  },
                ],
              },
              {
                slotId: "contact",
                text: "email@example.com",
                claims: [
                  {
                    text: "email@example.com",
                    citations: [citation],
                  },
                ],
              },
            ],
            unknowns: ["Specific production metrics"],
          }),
        },
      ],
    });
    return new Response(modelOutput, {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
  assert.equal(calls, 2);
  assert.match(
    result.sections.find((section) => section.heading === "Projects")?.text ??
      "",
    /Built Flask web application/,
  );
  assert.deepEqual(result.unknowns, ["Specific production metrics"]);
});

test("Resume Architect fails closed on repeated actions without retaining tool data", async () => {
  const session: ResumeFileReadSession = {
    roots: [{ rootId: "root-1", label: "managed-work" }],
    execute: async () => ({
      ok: true,
      type: "list",
      rootId: "root-1",
      path: "",
      entries: [{ path: "README.md", kind: "file" }],
    }),
    validateCitation: () => false,
  };
  const base = { ...requestBase, baseline, fileReadSession: session };
  const value = {
    ...base,
    consentFingerprint: resumeCoachConsentFingerprint(base),
  };
  let calls = 0;
  const result = await requestResumeCoach(value, async () => {
    calls += 1;
    return native({
      kind: "tool",
      action: { action: "list", rootId: "root-1", path: "" },
    });
  });
  assert.equal(calls, 2);
  assert.match(
    result.claims[0]?.text ?? "",
    /accessible TypeScript interfaces/i,
  );
  assert.doesNotMatch(JSON.stringify(result), /README\.md|root-1/);
});

test("Resume Architect accepts list tool actions with extra line bounds and read actions with optional bounds", async () => {
  const citation = {
    citationId: "citation-bounds-1",
    path: "README.md",
    startLine: 1,
    endLine: 2,
    contentDigest: `sha256:${"e".repeat(64)}`,
  };
  const session: ResumeFileReadSession = {
    roots: [{ rootId: "root-1", label: "managed-work" }],
    execute: async (action) => {
      if (action.action === "list") {
        return {
          ok: true,
          type: "list",
          rootId: action.rootId,
          path: action.path ?? "",
          entries: [{ path: "README.md", kind: "file" }],
        };
      }
      return {
        ok: true,
        type: "read",
        rootId: action.rootId,
        path: action.path,
        citation,
        text: "Built accessible TypeScript interfaces.\nCandidate-facing workflow.",
      };
    },
    validateCitation: (value) =>
      JSON.stringify(value) === JSON.stringify(citation),
  };
  const base = { ...requestBase, baseline, fileReadSession: session };
  const value = {
    ...base,
    consentFingerprint: resumeCoachConsentFingerprint(base),
  };
  let calls = 0;
  const result = await requestResumeCoach(value, async () => {
    calls += 1;
    if (calls === 1) {
      return native({
        kind: "tool",
        action: {
          action: "list",
          rootId: "root-1",
          path: "",
          startLine: 1,
          endLine: 80,
        },
      });
    }
    if (calls === 2) {
      return native({
        kind: "tool",
        action: {
          action: "read",
          rootId: "root-1",
          path: "README.md",
        },
      });
    }
    return native({
      kind: "final",
      edits: [
        {
          slotId: "projects",
          text: "Portfolio | Accessible interface\n- Built accessible TypeScript interfaces.",
          claims: [
            {
              text: "Built accessible TypeScript interfaces.",
              citations: [citation],
            },
          ],
        },
      ],
      unknowns: [],
    });
  });
  assert.equal(calls, 3);
  assert.match(
    result.sections.find((section) => section.heading === "Projects")?.text ?? "",
    /Built accessible TypeScript interfaces/,
  );
});

test("Resume Architect normalizes evidence parentheticals from bullet text to match claims", async () => {
  const citation = {
    citationId: "citation-1",
    path: "resume-evidence.md",
    startLine: 1,
    endLine: 289,
    contentDigest: `sha256:${"b".repeat(64)}`,
  };
  const session: ResumeFileReadSession = {
    roots: [{ rootId: "root-1", label: "managed-work" }],
    execute: async (action) => ({
      ok: true,
      type: "read",
      rootId: action.rootId,
      path: action.path,
      citation,
      text: "Built accessible TypeScript interfaces.\nCandidate-facing workflow.",
    }),
    validateCitation: (value) =>
      JSON.stringify(value) === JSON.stringify(citation),
  };
  const base = { ...requestBase, baseline, fileReadSession: session };
  const value = {
    ...base,
    consentFingerprint: resumeCoachConsentFingerprint(base),
  };
  let calls = 0;
  const result = await requestResumeCoach(value, async () => {
    calls += 1;
    if (calls === 1) {
      return native({
        kind: "tool",
        action: {
          action: "read",
          rootId: "root-1",
          path: "resume-evidence.md",
        },
      });
    }
    return native({
      kind: "final",
      edits: [
        {
          slotId: "projects",
          text: "Portfolio\n- Built accessible TypeScript interfaces (E-003, E-008)",
          claims: [
            {
              text: "Built accessible TypeScript interfaces",
              citations: [citation],
            },
          ],
        },
      ],
      unknowns: [],
    });
  });
  assert.equal(calls, 2);
  const projectSection = result.sections.find((s) => s.heading === "Projects");
  assert.match(projectSection?.text ?? "", /- Built accessible TypeScript interfaces$/m);
});


test("Resume Architect falls back when LM Studio emits an unsupported native tool response", async () => {
  const session: ResumeFileReadSession = {
    roots: [{ rootId: "root-1", label: "managed-work" }],
    execute: async () => {
      throw new Error("native tools must not execute");
    },
    validateCitation: () => false,
  };
  const base = { ...requestBase, baseline, fileReadSession: session };
  const value = {
    ...base,
    consentFingerprint: resumeCoachConsentFingerprint(base),
  };
  const result = await requestResumeCoach(
    value,
    async () =>
      new Response(
        JSON.stringify({ output: [{ type: "tool_call", content: "{}" }] }),
        { status: 200 },
      ),
  );
  assert.match(
    result.claims[0]?.text ?? "",
    /accessible TypeScript interfaces/i,
  );
});

test("Resume Architect treats Work Experience as an editable staged slot", async () => {
  const workBaseline = {
    ...baseline,
    sections: baseline.sections.map((section, index) =>
      index === 0
        ? { ...section, heading: "Work Experience", tag: "work-experience" }
        : section,
    ),
  };
  const base = { ...requestBase, baseline: workBaseline };
  const value = {
    ...base,
    consentFingerprint: resumeCoachConsentFingerprint(base),
  };
  let calls = 0;
  const result = await requestResumeCoach(value, async (_url, init) => {
    calls += 1;
    if (calls === 1)
      return native({
        findings: [
          {
            evidenceIndexes: [0],
            clarificationIndexes: [],
            fact: "Built accessible TypeScript interfaces.",
          },
        ],
        unknowns: [],
      });
    if (calls === 2) {
      const packet = JSON.parse(JSON.parse(String(init.body)).input);
      assert.deepEqual(packet.editableSlots[0], {
        sectionIndex: 0,
        heading: "Work Experience",
        maximumCharacters: 2_000,
      });
      return native({
        slots: [{ sectionIndex: 0, findingIndexes: [0] }],
        unknowns: [],
      });
    }
    if (calls === 3)
      return native({
        edits: [
          {
            sectionIndex: 0,
            text: "Software Engineer\n- Built accessible TypeScript interfaces.",
            claims: [
              {
                text: "Built accessible TypeScript interfaces.",
                evidenceIndexes: [0],
                clarificationIndexes: [],
              },
            ],
          },
        ],
        unknowns: [],
      });
    return native({ verdict: "accept", reasons: [] });
  });
  assert.equal(calls, 4);
  assert.match(
    result.sections[0]?.text ?? "",
    /Built accessible TypeScript interfaces/,
  );
});

test("Resume Architect falls back when the Integrity Reviewer rejects a staged draft", async () => {
  const base = { ...requestBase, baseline };
  const value = {
    ...base,
    consentFingerprint: resumeCoachConsentFingerprint(base),
  };
  let calls = 0;
  const result = await requestResumeCoach(value, async () => {
    calls += 1;
    if (calls === 1)
      return native({
        findings: [
          {
            evidenceIndexes: [0],
            clarificationIndexes: [],
            fact: "Built accessible TypeScript interfaces.",
          },
        ],
        unknowns: [],
      });
    if (calls === 2)
      return native({
        slots: [{ sectionIndex: 2, findingIndexes: [0] }],
        unknowns: [],
      });
    if (calls === 3)
      return native({
        edits: [
          {
            sectionIndex: 2,
            text: "Portfolio | Accessible interface\n- Built accessible TypeScript interfaces.",
            claims: [
              {
                text: "Built accessible TypeScript interfaces.",
                evidenceIndexes: [0],
                clarificationIndexes: [],
              },
            ],
          },
        ],
        unknowns: [],
      });
    return native({ verdict: "reject", reasons: ["uncertain-provenance"] });
  });
  assert.equal(calls, 4);
  assert.doesNotMatch(
    result.sections.find((section) => section.heading === "Projects")?.text ??
      "",
    /Portfolio \| Accessible interface/,
  );
});

test("Resume Coach rejects stale consent but creates an evidence-first draft when the local response is unusable", async () => {
  await assert.rejects(
    requestResumeCoach(
      { ...request(), consentFingerprint: `sha256:${"d".repeat(64)}` },
      async () => {
        throw new Error("must not call");
      },
    ),
    { code: "RESUME_COACH_INVALID" },
  );
  const value = request();
  for (const response of [
    native(
      {
        schemaVersion: 1,
        selectionEcho: value.consentFingerprint,
        sections: [{ heading: "Strength", text: "Relevant evidence." }],
        claims: [
          { text: "Built TypeScript interfaces.", evidenceIndexes: [0] },
        ],
        unknowns: [],
      },
      { response_id: "resp_unsafe" },
    ),
    new Response(
      JSON.stringify({ output: [{ type: "tool_call", content: "{}" }] }),
      { status: 200 },
    ),
    native(
      {
        schemaVersion: 1,
        selectionEcho: value.consentFingerprint,
        sections: [],
        claims: [],
        unknowns: [],
      },
      { stats: { model_load_time_seconds: 1 } },
    ),
    new Response("x".repeat(24_001), { status: 200 }),
  ]) {
    const fallback = await requestResumeCoach(value, async () => response);
    assert.equal(
      fallback.claims[0]?.text,
      "Built accessible TypeScript interfaces.",
    );
    assert.equal(fallback.claims[0]?.evidenceIndexes[0], 0);
  }
});

test("base-resume fallback never renders folder-documentation summaries, paths, or configuration", async () => {
  const base = {
    ...requestBase,
    evidence: [
      {
        ...requestBase.evidence[0],
        sourceDocument:
          "resume-evidence/projects/BioEvidence/resume-evidence.md",
      },
    ],
    documentation: [
      {
        name: "BioEvidence",
        category: "project" as const,
        documents: [
          {
            path: "resume-summary.md",
            contentDigest: `sha256:${"d".repeat(64)}`,
            text: "# Resume Summary (Proposed / Unreviewed)\n\nName: BioEvidence Description: A local system. Repository Shape: Single-part candidate.\n\n- docs/stories/internal-work.md\n- SPHOST (default 127.0.0.1)\n- POST /api/v1/runs",
          },
        ],
      },
    ],
  };
  const value = {
    ...base,
    consentFingerprint: resumeCoachConsentFingerprint(base),
  };
  const fallback = await requestResumeCoach(
    value,
    async () =>
      new Response(
        JSON.stringify({ output: [{ type: "tool_call", content: "{}" }] }),
        { status: 200 },
      ),
  );
  const rendered = `${fallback.sections.map((section) => section.text).join("\n")}\n${fallback.claims.map((claim) => claim.text).join("\n")}`;
  assert.match(rendered, /Built accessible TypeScript interfaces/);
  assert.doesNotMatch(
    rendered,
    /Name:|Repository Shape|docs\/stories|SPHOST|POST \/api/i,
  );
});

test("base-resume fallback rewrites a documented durable run record as candidate-facing work", async () => {
  const base = {
    ...requestBase,
    baseline,
    evidence: [
      {
        ...requestBase.evidence[0],
        factualText:
          "Created durable run records for the documented analysis workflow to preserve state without raw VCF retention by default.",
        sourceDocument:
          "resume-evidence/projects/BioEvidence/resume-evidence.md",
      },
    ],
  };
  const value = {
    ...base,
    consentFingerprint: resumeCoachConsentFingerprint(base),
  };
  const fallback = await requestResumeCoach(
    value,
    async () =>
      new Response(
        JSON.stringify({ output: [{ type: "tool_call", content: "{}" }] }),
        { status: 200 },
      ),
  );
  assert.deepEqual(fallback.claims, [
    {
      text: "Implemented durable run-state management for the documented analysis workflow",
      evidenceIndexes: [0],
    },
  ]);
});

test("Resume Architect preserves an intentionally empty immutable baseline section", async () => {
  const base = {
    ...requestBase,
    baseline: {
      ...baseline,
      sections: baseline.sections.map((section) =>
        section.heading === "Education"
          ? { ...section, existingDetail: "" }
          : section,
      ),
    },
    evidence: [
      {
        ...requestBase.evidence[0],
        factualText:
          "Built a one-click VCF upload and validation workflow for researchers.",
        sourceDocument:
          "resume-evidence/projects/BioEvidence/resume-evidence.md",
      },
    ],
  };
  const value = {
    ...base,
    consentFingerprint: resumeCoachConsentFingerprint(base),
  };
  const fallback = await requestResumeCoach(
    value,
    async () =>
      new Response(
        JSON.stringify({ output: [{ type: "tool_call", content: "{}" }] }),
        { status: 200 },
      ),
  );
  assert.equal(
    fallback.sections.find((section) => section.heading === "Education")?.text,
    "",
  );
});

test("base-resume fallback excludes security, model workflow, architecture, and product-manifest prose", async () => {
  const implementationFact =
    "The application provides immediate VCF validation feedback before analysis processing.";
  const base = {
    ...requestBase,
    evidence: [
      "For the personal-device local-only MVP, the application relies on the Windows OS-account boundary and device/full-disk encryption. It does not add application-level encryption for the SQLite database or local files.",
      "Tokens remain out of the SQLite database and belong in the OS credential vault when later integrations require them.",
      "The local model has no authority to access a folder, skill file, shell, network, or arbitrary tool.",
      "The architecture follows a modular monolith pattern organized by responsibility.",
      "Resume writing follows: information → evidence → positioning → relevance → content → optimization → validation.",
      "**Purpose:** Career Workbench is a local-first workspace for compliant job discovery, evidence-backed resume development, and application preparation.",
      implementationFact,
    ].map((factualText, index) => ({
      id: `00000000-0000-7000-8000-${String(index + 20).padStart(12, "0")}`,
      contentDigest: `sha256:${String(index + 1).repeat(64)}`,
      factualText,
      sourceDocument:
        "resume-evidence/projects/CareerWorkbench/resume-evidence.md",
    })),
  };
  const value = {
    ...base,
    consentFingerprint: resumeCoachConsentFingerprint(base),
  };
  const fallback = await requestResumeCoach(
    value,
    async () =>
      new Response(
        JSON.stringify({ output: [{ type: "tool_call", content: "{}" }] }),
        { status: 200 },
      ),
  );
  assert.deepEqual(fallback.claims, [
    { text: implementationFact, evidenceIndexes: [6] },
  ]);
  const rendered = fallback.sections.map((section) => section.text).join("\n");
  assert.match(rendered, /immediate VCF validation feedback/);
  assert.doesNotMatch(
    rendered,
    /OS-account|full-disk encryption|credential vault|authority to access|modular monolith|Resume writing follows|Career Workbench/i,
  );
});

test("base-resume generation retains a grounded Projects section instead of falling back to source facts", async () => {
  const base = {
    ...requestBase,
    evidence: [
      {
        ...requestBase.evidence[0],
        sourceDocument:
          "resume-evidence/projects/BioEvidence/resume-evidence.md",
      },
    ],
    documentation: [
      {
        name: "BioEvidence",
        category: "project" as const,
        documents: [
          {
            path: "resume-evidence.md",
            contentDigest: `sha256:${"e".repeat(64)}`,
            text: "# Resume Evidence (Proposed / Unreviewed)\n\n### E-001\n- Fact: Built accessible TypeScript interfaces.",
          },
        ],
      },
    ],
  };
  const value = {
    ...base,
    consentFingerprint: resumeCoachConsentFingerprint(base),
  };
  const result = await requestResumeCoach(value, async () =>
    native({
      schemaVersion: 1,
      selectionEcho: value.consentFingerprint,
      sections: [
        {
          heading: "Projects",
          text: "BioEvidence | Accessible interface work\n- Built accessible TypeScript interfaces.",
        },
      ],
      claims: [
        {
          text: "Built accessible TypeScript interfaces.",
          evidenceIndexes: [0],
        },
      ],
      unknowns: [],
    }),
  );
  assert.equal(result.sections[0]?.heading, "Projects");
});

test("base-resume generation sends compact purpose context instead of every candidate bullet", async () => {
  const base = {
    ...requestBase,
    evidence: Array.from({ length: 25 }, (_, index) => ({
      id: `00000000-0000-7000-8000-${String(index + 1).padStart(12, "0")}`,
      contentDigest: `sha256:${String(index).padStart(64, "a")}`,
      factualText:
        index === 0
          ? "Built accessible TypeScript interfaces."
          : `Implemented validation workflow detail ${index}.`,
      sourceDocument: "resume-evidence/projects/BioEvidence/resume-evidence.md",
    })),
    documentation: [
      {
        name: "BioEvidence",
        category: "project" as const,
        documents: [
          {
            path: "resume-evidence.md",
            contentDigest: `sha256:${"d".repeat(64)}`,
            text: "# Resume Evidence\n\n- Fact: Built accessible TypeScript interfaces.",
          },
          {
            path: "resume-bullet-candidates.md",
            contentDigest: `sha256:${"e".repeat(64)}`,
            text: "# Resume Bullet Candidates (Proposed / Unreviewed)\n\n## Resume Context\n\nPurpose: Help users review workflows locally.\n\n## Candidate Bullets\n\n### B-001\n- Candidate: This must not be sent to resume generation.",
          },
        ],
      },
    ],
  };
  const value = {
    ...base,
    consentFingerprint: resumeCoachConsentFingerprint(base),
  };
  const result = await requestResumeCoach(value, async (_url, init) => {
    const input = JSON.parse(JSON.parse(String(init.body)).input);
    assert.equal(input.evidence.length, 20);
    assert.deepEqual(input.projectIdentities, ["BioEvidence"]);
    assert.equal(input.documentation[0].documents.length, 1);
    assert.match(
      input.documentation[0].documents[0].text,
      /Help users review workflows locally/,
    );
    assert.doesNotMatch(
      input.documentation[0].documents[0].text,
      /This must not be sent/,
    );
    assert.equal("path" in input.documentation[0].documents[0], false);
    return native({
      schemaVersion: 1,
      selectionEcho: value.consentFingerprint,
      sections: [
        {
          heading: "Projects",
          text: "BioEvidence | Accessible interface work\n- Built accessible TypeScript interfaces.",
        },
      ],
      claims: [
        {
          text: "Built accessible TypeScript interfaces.",
          evidenceIndexes: [0],
        },
      ],
      unknowns: [],
    });
  });
  assert.match(
    result.sections.find((section) => section.heading === "Projects")?.text ??
      "",
    /BioEvidence/,
  );
});

test("base-resume generation retains the documented project identity when Qwen renames it", async () => {
  const base = {
    ...requestBase,
    evidence: [
      {
        ...requestBase.evidence[0],
        sourceDocument:
          "resume-evidence/projects/BioEvidence/resume-evidence.md",
      },
    ],
    documentation: [
      {
        name: "BioEvidence",
        category: "project" as const,
        documents: [
          {
            path: "resume-evidence.md",
            contentDigest: `sha256:${"e".repeat(64)}`,
            text: "# Resume Evidence\n\n- Fact: Built accessible TypeScript interfaces.",
          },
        ],
      },
    ],
  };
  const value = {
    ...base,
    consentFingerprint: resumeCoachConsentFingerprint(base),
  };
  const result = await requestResumeCoach(value, async () =>
    native({
      schemaVersion: 1,
      selectionEcho: value.consentFingerprint,
      sections: [
        {
          heading: "Projects",
          text: "SNV Analysis System | Validation workflow\n- Built accessible TypeScript interfaces.",
        },
      ],
      claims: [
        {
          text: "Built accessible TypeScript interfaces.",
          evidenceIndexes: [0],
        },
      ],
      unknowns: [],
    }),
  );
  assert.match(
    result.sections.find((section) => section.heading === "Projects")?.text ??
      "",
    /^BioEvidence\n- Built accessible TypeScript interfaces\./,
  );
});

test("base-resume generation preserves grounded purpose-led BioEvidence prose instead of the raw-fact fallback", async () => {
  const base = {
    ...requestBase,
    evidence: [
      {
        ...requestBase.evidence[0],
        factualText:
          "Built a local-first workflow for single-nucleotide variant interpretation that validates VCF input and coordinates evidence review.",
        sourceDocument:
          "resume-evidence/projects/BioEvidence/resume-evidence.md",
      },
      {
        id: "00000000-0000-7000-8000-000000000012",
        contentDigest: `sha256:${"f".repeat(64)}`,
        factualText:
          "Implemented durable SQLite-backed run state for staged analysis and safe cancellation.",
        sourceDocument:
          "resume-evidence/projects/BioEvidence/resume-evidence.md",
      },
      {
        id: "00000000-0000-7000-8000-000000000013",
        contentDigest: `sha256:${"e".repeat(64)}`,
        factualText:
          "Integrated clinical and population evidence sources for variant review.",
        sourceDocument:
          "resume-evidence/projects/BioEvidence/resume-evidence.md",
      },
    ],
    documentation: [
      {
        name: "BioEvidence",
        category: "project" as const,
        documents: [
          {
            path: "resume-bullet-candidates.md",
            contentDigest: `sha256:${"d".repeat(64)}`,
            text: "# Resume Bullet Candidates (Proposed / Unreviewed)\n\n## Resume Context\n\nPurpose: Support staged analysis and interpretation of single-nucleotide variants.\nUser or workflow: A researcher validates VCF input, tracks analysis, and reviews evidence.\nDesign rationale: Durable state preserves stage completeness.\nDirectly stated outcome: Not directly evidenced.\nExplicit gaps: Adoption is not established.",
          },
        ],
      },
    ],
  };
  const value = {
    ...base,
    consentFingerprint: resumeCoachConsentFingerprint(base),
  };
  const result = await requestResumeCoach(value, async () =>
    native({
      schemaVersion: 1,
      selectionEcho: value.consentFingerprint,
      sections: [
        {
          heading: "Projects",
          text: "BioEvidence | Variant-interpretation workflow\n- Developed a local-first variant-interpretation workflow that brings VCF validation and evidence review into one system.\n- Designed durable run-state management to preserve staged analysis and support safe cancellation.\n- Integrated clinical and population evidence sources to support informed variant review.",
        },
      ],
      claims: [
        {
          text: "Developed a local-first variant-interpretation workflow that brings VCF validation and evidence review into one system.",
          evidenceIndexes: [0],
        },
        {
          text: "Designed durable run-state management to preserve staged analysis and support safe cancellation.",
          evidenceIndexes: [1],
        },
        {
          text: "Integrated clinical and population evidence sources to support informed variant review.",
          evidenceIndexes: [2],
        },
      ],
      unknowns: ["Adoption is not established."],
    }),
  );
  const projects =
    result.sections.find((section) => section.heading === "Projects")?.text ??
    "";
  assert.match(projects, /validates VCF input and coordinates evidence review/);
  assert.match(projects, /Built a local-first workflow/);
});

test("base-resume generation retains Qwen's grounded explanatory bullet clauses and compacts its project descriptor", async () => {
  const base = {
    ...requestBase,
    evidence: [
      {
        ...requestBase.evidence[0],
        factualText:
          "Created durable SQLite-backed run records for the documented analysis workflow to support state persistence without raw VCF retention by default.",
        sourceDocument:
          "resume-evidence/projects/BioEvidence/resume-evidence.md",
      },
    ],
    documentation: [
      {
        name: "BioEvidence",
        category: "project" as const,
        documents: [
          {
            path: "resume-evidence.md",
            contentDigest: `sha256:${"e".repeat(64)}`,
            text: "# Resume Evidence\n\n- Fact: Created durable SQLite-backed run records for the documented analysis workflow.",
          },
        ],
      },
    ],
  };
  const value = {
    ...base,
    consentFingerprint: resumeCoachConsentFingerprint(base),
  };
  const result = await requestResumeCoach(value, async () =>
    native({
      schemaVersion: 1,
      selectionEcho: value.consentFingerprint,
      sections: [
        {
          heading: "Projects",
          text: "BioEvidence | Local-first web system for staged analysis and interpretation of single-nucleotide variants coordinating multiple bioinformatics tools into one reliable workflow\n\u2022 Created durable SQLite-backed run records for the documented analysis workflow to support state persistence without raw VCF retention by default.",
        },
      ],
      claims: [
        {
          text: "Created durable SQLite-backed run records for the documented analysis workflow.",
          evidenceIndexes: [0],
        },
      ],
      unknowns: [],
    }),
  );
  const projects =
    result.sections.find((section) => section.heading === "Projects")?.text ??
    "";
  assert.match(projects, /^BioEvidence\n- Created durable SQLite-backed/);
  assert.match(
    projects,
    /to support state persistence without raw VCF retention by default/,
  );
});

test("base-resume generation resolves Qwen SHA evidence references before validating Projects", async () => {
  const base = {
    ...requestBase,
    evidence: [
      {
        ...requestBase.evidence[0],
        sourceDocument:
          "resume-evidence/projects/BioEvidence/resume-evidence.md",
      },
    ],
    documentation: [
      {
        name: "BioEvidence",
        category: "project" as const,
        documents: [
          {
            path: "resume-evidence.md",
            contentDigest: `sha256:${"e".repeat(64)}`,
            text: "# Resume Evidence\n\n- Fact: Built accessible TypeScript interfaces.",
          },
        ],
      },
    ],
  };
  const value = {
    ...base,
    consentFingerprint: resumeCoachConsentFingerprint(base),
  };
  const digestReference = requestBase.evidence[0].contentDigest.replace(
    "sha256:",
    "",
  );
  const result = await requestResumeCoach(value, async () =>
    native({
      schemaVersion: 1,
      selectionEcho: value.consentFingerprint,
      sections: [
        {
          heading: "Projects",
          text: "BioEvidence | Accessible interface work\n- Built accessible TypeScript interfaces.",
        },
      ],
      claims: [
        {
          text: "Built accessible TypeScript interfaces.",
          evidenceIndexes: [digestReference],
        },
      ],
      unknowns: [],
    }),
  );
  assert.match(
    result.sections.find((section) => section.heading === "Projects")?.text ??
      "",
    /BioEvidence/,
  );
  assert.equal(result.claims[0]?.evidenceIndexes[0], 0);
});

test("base-resume generation repairs Qwen's unquoted SHA evidence references", async () => {
  const base = {
    ...requestBase,
    evidence: [
      {
        ...requestBase.evidence[0],
        sourceDocument:
          "resume-evidence/projects/BioEvidence/resume-evidence.md",
      },
    ],
    documentation: [
      {
        name: "BioEvidence",
        category: "project" as const,
        documents: [
          {
            path: "resume-evidence.md",
            contentDigest: `sha256:${"e".repeat(64)}`,
            text: "# Resume Evidence\n\n- Fact: Built accessible TypeScript interfaces.",
          },
        ],
      },
    ],
  };
  const value = {
    ...base,
    consentFingerprint: resumeCoachConsentFingerprint(base),
  };
  const digestReference = requestBase.evidence[0].contentDigest.replace(
    "sha256:",
    "",
  );
  const modelContent = `\`\`\`json\n{"schemaVersion":1,"selectionEcho":"${value.consentFingerprint}","sections":[{"heading":"Projects","text":"BioEvidence | Accessible interface work\\n- Built accessible TypeScript interfaces."}],"claims":[{"text":"Built accessible TypeScript interfaces.","evidenceIndexes":[${digestReference}]}],"unknowns":[]}\n\`\`\``;
  const result = await requestResumeCoach(
    value,
    async () =>
      new Response(
        JSON.stringify({
          output: [{ type: "message", content: modelContent }],
        }),
        { status: 200 },
      ),
  );
  assert.match(
    result.sections.find((section) => section.heading === "Projects")?.text ??
      "",
    /BioEvidence/,
  );
  assert.equal(result.claims[0]?.evidenceIndexes[0], 0);
});

test("base-resume generation grounds a Qwen numeric hint that is not a supplied evidence position", async () => {
  const base = {
    ...requestBase,
    evidence: [
      {
        ...requestBase.evidence[0],
        factualText:
          "Built durable run-record management to support validation workflow state.",
        sourceDocument:
          "resume-evidence/projects/BioEvidence/resume-evidence.md",
      },
      {
        id: "00000000-0000-7000-8000-000000000012",
        contentDigest: `sha256:${"f".repeat(64)}`,
        factualText:
          "Added immediate validation feedback before analysis processing.",
        sourceDocument:
          "resume-evidence/projects/BioEvidence/resume-evidence.md",
      },
    ],
    documentation: [
      {
        name: "BioEvidence",
        category: "project" as const,
        documents: [
          {
            path: "resume-evidence.md",
            contentDigest: `sha256:${"e".repeat(64)}`,
            text: "# Resume Evidence\n\n- Fact: Built durable run-record management to support validation workflow state.",
          },
        ],
      },
    ],
  };
  const value = {
    ...base,
    consentFingerprint: resumeCoachConsentFingerprint(base),
  };
  const result = await requestResumeCoach(value, async () =>
    native({
      schemaVersion: 1,
      selectionEcho: value.consentFingerprint,
      sections: [
        {
          heading: "Projects",
          text: "BioEvidence | Validation workflow\n- Built durable run-record management to support validation workflow state.",
        },
      ],
      claims: [
        {
          text: "Built durable run-record management to support validation workflow state.",
          evidenceIndexes: [38],
        },
      ],
      unknowns: [],
    }),
  );
  assert.match(
    result.sections.find((section) => section.heading === "Projects")?.text ??
      "",
    /BioEvidence/,
  );
  assert.deepEqual(result.claims[0]?.evidenceIndexes, [0]);
});

test("base-resume generation accepts a project-only response and preserves GWA education", async () => {
  const base = {
    ...requestBase,
    profileSnapshot: JSON.stringify({
      firstName: "Adrian",
      school: "University of the Philippines",
      program: "BS Computer Science",
      graduationYear: 2026,
      gwa: "1.44",
      latinHonors: "Magna Cum Laude",
    }),
    evidence: [
      {
        ...requestBase.evidence[0],
        factualText:
          "Built durable run-record management to support validation workflow state.",
        sourceDocument:
          "resume-evidence/projects/BioEvidence/resume-evidence.md",
      },
      {
        id: "00000000-0000-7000-8000-000000000012",
        contentDigest: `sha256:${"f".repeat(64)}`,
        factualText:
          "Designed an API-driven workflow for creating and reviewing run records.",
        sourceDocument:
          "resume-evidence/projects/BioEvidence/resume-evidence.md",
      },
    ],
    documentation: [
      {
        name: "BioEvidence",
        category: "project" as const,
        documents: [
          {
            path: "resume-bullet-candidates.md",
            contentDigest: `sha256:${"e".repeat(64)}`,
            text: "# Resume Bullet Candidates (Proposed / Unreviewed)\n\n## Resume Context\n\n- Purpose: Help users manage genomic variant validation workflows.\n- User or workflow: Users create and review run records.\n- Design rationale: Durable records preserve workflow state.\n- Directly stated outcome: Not directly evidenced.\n- Explicit gaps: Metrics are not established.\n\n## Candidate Bullets\n\n### B-001\n- Candidate: Built workflow support.\n- Supporting evidence: E-001\n- Explicit unknowns: Metrics are not established.\n- Status: Proposed / unreviewed; not claim-eligible",
          },
        ],
      },
    ],
  };
  const value = {
    ...base,
    consentFingerprint: resumeCoachConsentFingerprint(base),
  };
  const result = await requestResumeCoach(value, async () =>
    native({
      schemaVersion: 1,
      selectionEcho: value.consentFingerprint,
      sections: [
        { heading: "Experience", text: "" },
        {
          heading: "Education",
          text: "University of the Philippines | BS Computer Science | Expected Graduation: 2026\nGWA: 1.44 (Magna Cum Laude)",
        },
        {
          heading: "Projects",
          text: "BioEvidence | Genomic-variant validation workflow application\n- Built durable run-record management to support validation workflow state.\n- Designed an API-driven workflow for creating and reviewing run records.",
        },
        {
          heading: "Technical Skills",
          text: "Languages: Python\nFrameworks: Flask\nData & APIs: SQLite, JSON APIs",
        },
      ],
      claims: [
        {
          text: "Built durable run-record management to support validation workflow state.",
          evidenceIndexes: [0],
        },
        {
          text: "Designed an API-driven workflow for creating and reviewing run records.",
          evidenceIndexes: [1],
        },
      ],
      unknowns: [
        "Project metrics are not established by the documented material.",
      ],
    }),
  );
  assert.equal(
    result.sections.some((section) => section.heading === "Experience"),
    false,
  );
  assert.match(
    result.sections.find((section) => section.heading === "Education")?.text ??
      "",
    /GWA 1\.44/,
  );
  assert.match(
    result.sections.find((section) => section.heading === "Projects")?.text ??
      "",
    /Built durable run-record management/,
  );
});

test("Resume Architect rejects visible work bullets without matching evidence-linked claims", async () => {
  const base = {
    ...requestBase,
    evidence: [
      {
        ...requestBase.evidence[0],
        sourceDocument:
          "resume-evidence/projects/BioEvidence/resume-evidence.md",
      },
    ],
    documentation: [
      {
        name: "BioEvidence",
        category: "project" as const,
        documents: [
          {
            path: "resume-bullet-candidates.md",
            contentDigest: `sha256:${"e".repeat(64)}`,
            text: "# Resume Bullet Candidates (Proposed / Unreviewed)\n\n## Resume Context\n\n- Purpose: Help users manage review workflows.",
          },
        ],
      },
    ],
  };
  const value = {
    ...base,
    consentFingerprint: resumeCoachConsentFingerprint(base),
  };
  const result = await requestResumeCoach(value, async () =>
    native({
      schemaVersion: 1,
      selectionEcho: value.consentFingerprint,
      sections: [
        {
          heading: "Projects",
          text: "BioEvidence | Workflow support\n- Built accessible TypeScript interfaces.",
        },
      ],
      claims: [],
      unknowns: [],
    }),
  );
  assert.equal(
    result.claims[0]?.text,
    "Built accessible TypeScript interfaces.",
  );
  assert.match(
    result.sections.find((section) => section.heading === "Projects")?.text ??
      "",
    /Built accessible TypeScript interfaces/,
  );
});

test("Resume Architect accepts eligible direct-less clarification support, excludes needs-review answers, and rejects out-of-contract responses", async () => {
  const base = {
    ...requestBase,
    baseline,
    clarifications: [
      {
        itemName: "BioEvidence",
        itemCategory: "project" as const,
        category: "users_workflow",
        text: "I built the one-click VCF upload and validation workflow.",
        provenance: "candidate_interview_answer" as const,
      },
    ],
    evidence: [
      {
        ...requestBase.evidence[0],
        factualText: "Built a VCF upload workflow for researchers.",
        sourceDocument:
          "resume-evidence/projects/BioEvidence/resume-evidence.md",
      },
    ],
  };
  const value = {
    ...base,
    consentFingerprint: resumeCoachConsentFingerprint(base),
  };
  const result = await requestResumeCoach(value, async (_url, init) => {
    const input = JSON.parse(JSON.parse(String(init.body)).input);
    assert.deepEqual(input.generationContract, {
      requiredSectionSequence: [
        "Experience",
        "Education",
        "Projects",
        "Technical Skills",
      ],
      immutableSections: [
        {
          heading: "Education",
          text: "Example University | Computer Science | 2026",
        },
        { heading: "Technical Skills", text: "Languages: TypeScript" },
      ],
      editableWorkHeadings: ["Experience", "Projects"],
      projectEntryLimits: {
        maximumEntries: 4,
        descriptorMaximumWords: 12,
        maximumBulletsPerEntry: 3,
        maximumWordsPerBullet: 30,
      },
      citationRules: [
        "Every visible Experience or Projects bullet needs an exactly matching claims.text entry.",
        "Each claim needs one or more directly supporting evidenceIndexes and/or eligible clarificationIndexes.",
        "clarificationIndexes are candidate-provided provenance, never direct documented facts.",
      ],
      forbiddenGenericHeadings: [
        "Summary",
        "Professional Summary",
        "Career Summary",
        "Skills",
        "Core Competencies",
        "Selected Projects",
        "Project Experience",
        "Work Experience",
        "Employment History",
      ],
    });
    assert.deepEqual(input.responseShape.sections, [
      {
        heading: "Experience",
        text: "Resume entry text or an empty string when the baseline work section is empty",
      },
      {
        heading: "Education",
        text: "Example University | Computer Science | 2026",
      },
      {
        heading: "Projects",
        text: "Resume entry text or an empty string when the baseline work section is empty",
      },
      { heading: "Technical Skills", text: "Languages: TypeScript" },
    ]);
    assert.match(
      String(JSON.parse(String(init.body)).system_prompt),
      /HARD OUTPUT CONSTRAINT: The sections array must contain exactly these headings in this order: \["Experience","Education","Projects","Technical Skills"\]/,
    );
    assert.deepEqual(input.candidateClarifications, [
      {
        clarificationIndex: 0,
        itemName: "BioEvidence",
        itemCategory: "project",
        category: "users_workflow",
        text: "I built the one-click VCF upload and validation workflow.",
        provenance: "candidate_interview_answer",
      },
    ]);
    assert.doesNotMatch(
      JSON.stringify(input),
      /\\\\section|resume\.tex|resume-evidence\/projects/i,
    );
    return native({
      schemaVersion: 1,
      selectionEcho: value.consentFingerprint,
      sections: [
        baseline.sections[0],
        baseline.sections[1],
        {
          heading: "Projects",
          text: "BioEvidence | Researcher VCF validation workflow\n- Developed a one-click VCF upload and validation workflow for researchers.",
        },
        baseline.sections[3],
      ].map((section) => ({
        heading: section.heading,
        text:
          "existingDetail" in section ? section.existingDetail : section.text,
      })),
      claims: [
        {
          text: "Developed a one-click VCF upload and validation workflow for researchers.",
          evidenceIndexes: [],
          clarificationIndexes: [0],
        },
      ],
      unknowns: [],
    });
  });
  assert.deepEqual(result.claims[0]?.evidenceIndexes, [0]);
  assert.equal(result.claims[0]?.clarificationIndexes?.length ?? 0, 0);
  assert.equal(
    result.candidateClarifications?.[0]?.provenance,
    "candidate_interview_answer",
  );
  assert.deepEqual(
    result.sections.map((section) => section.heading),
    baseline.sections.map((section) => section.heading),
  );
  const projectDescription =
    result.sections.find((section) => section.heading === "Projects")?.text ??
    "";
  assert.match(projectDescription, /one-click VCF upload and validation/i);
  assert.match(projectDescription, /for researchers/i);
  assert.doesNotMatch(projectDescription, /TypeScript|SQLite|Kubernetes/i);

  const unrelatedClarification = await requestResumeCoach(value, async () =>
    native({
      schemaVersion: 1,
      selectionEcho: value.consentFingerprint,
      sections: [
        baseline.sections[0],
        baseline.sections[1],
        {
          heading: "Projects",
          text: "BioEvidence | Deployment\n- Developed Kubernetes deployment automation.",
        },
        baseline.sections[3],
      ].map((section) => ({
        heading: section.heading,
        text:
          "existingDetail" in section ? section.existingDetail : section.text,
      })),
      claims: [
        {
          text: "Developed Kubernetes deployment automation.",
          evidenceIndexes: [],
          clarificationIndexes: [0],
        },
      ],
      unknowns: [],
    }),
  );
  assert.doesNotMatch(
    unrelatedClarification.sections.map((section) => section.text).join("\n"),
    /Kubernetes deployment automation/i,
  );

  const fallback = await requestResumeCoach(value, async () =>
    native({
      schemaVersion: 1,
      selectionEcho: value.consentFingerprint,
      sections: [
        { heading: "Architecture", text: "The system uses a VCF pipeline." },
      ],
      claims: [],
      unknowns: [],
    }),
  );
  assert.deepEqual(
    fallback.sections.map((section) => section.heading),
    baseline.sections.map((section) => section.heading),
  );
  assert.doesNotMatch(
    fallback.sections.map((section) => section.text).join("\n"),
    /architecture|pipeline/i,
  );
  assert.match(
    fallback.sections.find((section) => section.heading === "Projects")?.text ??
      "",
    /Candidate-provided workflow/,
  );
  assert.equal(
    fallback.claims.some(
      (claim) => claim.clarificationIndexes?.includes(0) === true,
    ),
    true,
  );
  await assert.rejects(
    requestResumeCoach(
      {
        ...value,
        clarifications: [{ ...value.clarifications[0]!, needsReview: true }],
      } as unknown as typeof value,
      async () => {
        throw new Error("conflicted clarification must not reach the model");
      },
    ),
    { code: "RESUME_COACH_INVALID" },
  );
  const insufficientBase = {
    ...base,
    clarifications: [],
    evidence: [
      {
        ...base.evidence[0],
        factualText: "The application provides a VCF workflow.",
      },
    ],
  };
  await assert.rejects(
    requestResumeCoach(
      {
        ...insufficientBase,
        consentFingerprint: resumeCoachConsentFingerprint(insufficientBase),
      },
      async () => {
        throw new Error("insufficient fallback input must not reach the model");
      },
    ),
    { code: "RESUME_COACH_INVALID" },
  );
});

test("Resume Architect rejects a generic reordered response and preserves only its validated fallback", async () => {
  const base = {
    ...requestBase,
    baseline,
    evidence: [
      {
        ...requestBase.evidence[0],
        factualText:
          "Built a one-click VCF upload and validation workflow for researchers.",
        sourceDocument:
          "resume-evidence/projects/BioEvidence/resume-evidence.md",
      },
    ],
  };
  const value = {
    ...base,
    consentFingerprint: resumeCoachConsentFingerprint(base),
  };
  const result = await requestResumeCoach(value, async () =>
    native({
      schemaVersion: 1,
      selectionEcho: value.consentFingerprint,
      sections: [
        { heading: "Summary", text: "Invented generic profile." },
        { heading: "Skills", text: "Invented skills inventory." },
        {
          heading: "Selected Projects",
          text: "Generic Project | Generic descriptor\n- Built generic work.",
        },
        { heading: "Education", text: "Rewritten non-work education." },
      ],
      claims: [{ text: "Built generic work.", evidenceIndexes: [0] }],
      unknowns: [],
    }),
  );
  assert.deepEqual(
    result.sections.map((section) => section.heading),
    baseline.sections.map((section) => section.heading),
  );
  assert.equal(
    result.sections.find((section) => section.heading === "Education")?.text,
    baseline.sections[1]?.existingDetail,
  );
  assert.equal(
    result.sections.find((section) => section.heading === "Technical Skills")
      ?.text,
    baseline.sections[3]?.existingDetail,
  );
  assert.doesNotMatch(
    result.sections.map((section) => section.text).join("\n"),
    /Invented generic|Invented skills|Generic Project|Rewritten non-work/i,
  );
});

test("Resume Architect contract instructs explicit candidate-clarification provenance", () => {
  assert.match(
    resumeGeneratorSystemInstruction,
    /direct evidence and\/or eligible candidate-clarification indexes/i,
  );
  assert.match(
    resumeGeneratorSystemInstruction,
    /eligible candidate-clarification indexes/i,
  );
});

test("Resume Architect contract requires the imported baseline hierarchy and evidence-linked work bullets", () => {
  assert.match(resumeGeneratorSystemInstruction, /Resume Architect/);
  assert.match(
    resumeGeneratorSystemInstruction,
    /generationContract\.requiredSectionSequence/,
  );
  assert.match(
    resumeGeneratorSystemInstruction,
    /Never add, rename, merge, omit, or reorder/i,
  );
  assert.match(resumeGeneratorSystemInstruction, /exactly matching claim/);
  assert.match(resumeGeneratorEditorialInstruction, /technology inventory/);
  assert.match(resumeGeneratorEditorialInstruction, /at most 30 words/);
  assert.match(
    resumeGeneratorEvidenceIntelligenceInstruction,
    /four layers separate/,
  );
  assert.match(
    resumeGeneratorEvidenceIntelligenceInstruction,
    /not a changelog/,
  );
  assert.match(
    resumeGeneratorProjectIdentityInstruction,
    /exact supplied project name/,
  );
});

test("Resume Coach receives structured sections and curated handoffs only", async () => {
  const base = {
    ...requestBase,
    currentResumeSections: [
      { heading: "Education", text: "BS Computer Science | University" },
      {
        heading: "Projects",
        text: "BioEvidence | Validation workflow\n- Built accessible TypeScript interfaces.",
      },
    ],
    documentation: [
      {
        name: "BioEvidence",
        category: "project" as const,
        documents: [
          {
            path: "resume-evidence.md",
            contentDigest: `sha256:${"d".repeat(64)}`,
            text: "# Resume Evidence\n\nBuilt accessible TypeScript interfaces.",
          },
          {
            path: "resume-bullet-candidates.md",
            contentDigest: `sha256:${"e".repeat(64)}`,
            text: "# Resume Bullet Candidates\n\n## Resume Context\n\n- Purpose: Help reviewers manage validation workflows.",
          },
        ],
      },
    ],
    userRequest: "Review the current base resume. Focus: credibility.",
  };
  const value = {
    ...base,
    consentFingerprint: resumeCoachConsentFingerprint(base),
  };
  await requestResumeCoachReview(value, async (_url, init) => {
    const input = JSON.parse(JSON.parse(String(init.body)).input) as {
      currentResumeSections: Array<{ heading: string }>;
      documentation: Array<{ documents: Array<{ path: string }> }>;
    };
    assert.deepEqual(
      input.currentResumeSections.map((section) => section.heading),
      ["Education", "Projects"],
    );
    assert.deepEqual(
      input.documentation[0]?.documents.map((document) => document.path),
      ["resume-evidence.md", "resume-bullet-candidates.md"],
    );
    return native({
      schemaVersion: 1,
      selectionEcho: value.consentFingerprint,
      ratings: [
        "clarity",
        "relevance",
        "credibility",
        "specificity",
        "atsReadability",
      ].map((area) => ({
        area,
        score: 4,
        rationale: "Supported by the reviewed evidence.",
      })),
      strengths: ["Project purpose is clear."],
      concerns: [],
      recommendations: [],
    });
  });
});

test("Resume Coach ignores an optional reasoning block and requires one final message", async () => {
  const value = request();
  const response = {
    schemaVersion: 1,
    selectionEcho: value.consentFingerprint,
    sections: [
      { heading: "Strength", text: "Your TypeScript work is relevant." },
    ],
    claims: [
      { text: "You built TypeScript interfaces.", evidenceIndexes: [0] },
    ],
    unknowns: ["Production scope is not established."],
  };
  const result = await requestResumeCoach(
    value,
    async () =>
      new Response(
        JSON.stringify({
          output: [
            { type: "reasoning", content: "Private model reasoning." },
            { type: "message", content: JSON.stringify(response) },
          ],
        }),
        { status: 200 },
      ),
  );
  assert.equal(result.sections[0]?.heading, "Projects");
  const fallback = await requestResumeCoach(
    value,
    async () =>
      new Response(
        JSON.stringify({
          output: [{ type: "reasoning", content: "No final result." }],
        }),
        { status: 200 },
      ),
  );
  assert.equal(
    fallback.sections.at(-1)?.heading,
    "Selected Experience & Projects",
  );
});

test("Resume Coach keeps all documented findings attached when their full model payload exceeds the safe boundary", async () => {
  const oversizedBase = {
    ...requestBase,
    evidence: Array.from({ length: 20 }, (_, index) => ({
      id: `00000000-0000-7000-8000-${String(index + 20).padStart(12, "0")}`,
      contentDigest: `sha256:${String(index % 10).repeat(64)}`,
      factualText: `Documented implementation statement ${index + 1}: ${"evidence-backed work ".repeat(180)}`,
    })),
  };
  const oversized = {
    ...oversizedBase,
    consentFingerprint: resumeCoachConsentFingerprint(oversizedBase),
  };
  let called = false;
  const result = await requestResumeCoach(oversized, async () => {
    called = true;
    throw new Error(
      "the oversized evidence payload must not be sent to the local model",
    );
  });
  assert.equal(called, false);
  assert.equal(result.claims.length, 20);
  assert.equal(result.claims[19]?.evidenceIndexes[0], 19);
});

test("Resume Coach accepts every bounded documented finding instead of rejecting a workspace after eighty items", async () => {
  const manyEvidenceBase = {
    ...requestBase,
    evidence: Array.from({ length: 81 }, (_, index) => ({
      id: `00000000-0000-7000-8000-${String(index + 200).padStart(12, "0")}`,
      contentDigest: `sha256:${String(index % 10).repeat(64)}`,
      factualText: `Documented finding ${index + 1} describes a supported local implementation detail.`,
    })),
  };
  const manyEvidence = {
    ...manyEvidenceBase,
    consentFingerprint: resumeCoachConsentFingerprint(manyEvidenceBase),
  };
  const result = await requestResumeCoach(manyEvidence, async () =>
    native({
      schemaVersion: 1,
      selectionEcho: manyEvidence.consentFingerprint,
      sections: [{ heading: "Summary", text: "Documented work is available." }],
      claims: [
        {
          text: "Documented finding 1 describes a supported local implementation detail.",
          evidenceIndexes: [0],
        },
      ],
      unknowns: [],
    }),
  );
  assert.equal(result.claims[0]?.evidenceIndexes[0], 0);
});

test("local-model capabilities isolate configuration fingerprints and assessment schemas", async () => {
  assert.equal(localModelCapabilityVersion("resume-coach"), "resume-coach-v8");
  assert.equal(
    localModelCapabilityVersion("opportunity-assessment"),
    "opportunity-assessment-v1",
  );
  assert.throws(() => localModelCapabilityVersion("unknown"), {
    code: "RESUME_COACH_INVALID",
  });
  const opportunity = {
    id: "00000000-0000-7000-8000-000000000002",
    contentDigest: `sha256:${"d".repeat(64)}`,
    title: "Product Designer",
    company: "Northstar",
    requirements: ["Accessible design"],
    copiedDescription:
      "Product Designer role at Northstar Studio with accessibility responsibilities and collaborative product research work.",
  };
  const base = {
    connection,
    profileDigest: `sha256:${"a".repeat(64)}`,
    templateDigest: `sha256:${"b".repeat(64)}`,
    profileSummary: "Product design graduate",
    opportunity,
    evidence: [
      {
        id: "00000000-0000-7000-8000-000000000001",
        contentDigest: `sha256:${"c".repeat(64)}`,
        factualText: "Built accessible TypeScript interfaces.",
      },
    ],
  };
  const value = {
    ...base,
    consentFingerprint: opportunityAssessmentConsentFingerprint(base),
  };
  const result = await requestOpportunityAssessment(
    value,
    async (url, init) => {
      assert.equal(url, "http://127.0.0.1:1234/api/v1/chat");
      assert.match(String(init.body), /"store":false/);
      assert.match(String(init.body), /"reasoning":"off"/);
      assert.equal(new Headers(init.headers).get("authorization"), null);
      return native({
        schemaVersion: 1,
        selectionEcho: value.consentFingerprint,
        strengths: [
          {
            text: "Accessible interface work relates to the role.",
            evidenceIndexes: [0],
            excerpt: { start: 0, end: 24 },
          },
        ],
        gaps: [],
        unknowns: [],
      });
    },
  );
  assert.equal(result.strengths.length, 1);
  assert.notEqual(
    opportunityAssessmentConsentFingerprint({
      ...base,
      connection: {
        ...connection,
        configurationDigest: `sha256:${"e".repeat(64)}`,
      },
    }),
    value.consentFingerprint,
  );
});

test("Resume Coach source leak guard recognizes Selected Projects and Work Experience headings", async () => {
  const customBaseline = {
    baselineId: "00000000-0000-7000-8000-000000000099",
    baselineDigest: `sha256:${"9".repeat(64)}`,
    sections: [
      {
        heading: "Work Experience",
        tag: "experience",
        existingDetail: "Software Engineer",
      },
      {
        heading: "Selected Projects",
        tag: "selected-projects",
        existingDetail: "Personal projects",
      },
    ],
  };
  const base = {
    ...requestBase,
    baseline: customBaseline,
    documentation: [
      {
        name: "BioEvidence",
        category: "project",
        documents: [
          {
            path: "resume-evidence.md",
            text: "Built accessible TypeScript interfaces.",
            contentDigest: `sha256:${"b".repeat(64)}`,
          },
        ],
      },
    ],
  };
  const value = {
    ...base,
    consentFingerprint: resumeCoachConsentFingerprint(base),
  };
  const response = {
    schemaVersion: 1,
    selectionEcho: value.consentFingerprint,
    sections: [
      {
        heading: "Work Experience",
        text: "- Implemented accessible web features with TypeScript and React.",
      },
      {
        heading: "Selected Projects",
        text: "- Built accessible TypeScript interfaces.",
      },
    ],
    claims: [
      {
        text: "Built accessible TypeScript interfaces.",
        evidenceIndexes: [0],
      },
    ],
    unknowns: [],
  };
  const result = await requestResumeCoach(value, async () =>
    native(response),
  );
  assert.match(
    result.sections.find((s) => s.heading === "Selected Projects")?.text ?? "",
    /accessible TypeScript interfaces/,
  );
});

test("Resume Coach accepts unedited baseline work sections without requiring unprovided claims", async () => {
  const customBaseline = {
    baselineId: "00000000-0000-7000-8000-000000000099",
    baselineDigest: `sha256:${"9".repeat(64)}`,
    sections: [
      {
        heading: "Experience",
        tag: "experience",
        existingDetail:
          "- Refactored React/TypeScript company dashboard into reusable components.",
      },
      {
        heading: "Selected Projects",
        tag: "selected-projects",
        existingDetail: "- Built baseline project.",
      },
    ],
  };
  const base = {
    ...requestBase,
    baseline: customBaseline,
    documentation: [
      {
        name: "BioEvidence",
        category: "project",
        documents: [
          {
            path: "resume-evidence.md",
            text: "Built Flask WSGI app with Waitress.",
            contentDigest: `sha256:${"b".repeat(64)}`,
          },
        ],
      },
    ],
  };
  const value = {
    ...base,
    consentFingerprint: resumeCoachConsentFingerprint(base),
  };
  const response = {
    schemaVersion: 1,
    selectionEcho: value.consentFingerprint,
    sections: [
      {
        heading: "Experience",
        text: "- Refactored React/TypeScript company dashboard into reusable components.",
      },
      {
        heading: "Selected Projects",
        text: "BioEvidence | Python & Flask\n- Built Flask WSGI app with Waitress for reliable Windows demo mode.",
      },
    ],
    claims: [
      {
        text: "Built Flask WSGI app with Waitress for reliable Windows demo mode.",
        evidenceIndexes: [0],
      },
    ],
    unknowns: [],
  };
  const result = await requestResumeCoach(value, async () => native(response));
  assert.equal(
    result.sections.find((s) => s.heading === "Experience")?.text,
    "- Refactored React/TypeScript company dashboard into reusable components.",
  );
  assert.match(
    result.sections.find((s) => s.heading === "Selected Projects")?.text ?? "",
    /accessible TypeScript interfaces/,
  );
});


