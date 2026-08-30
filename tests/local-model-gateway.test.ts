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
      data: { type: "message.delta", content: "That sounds like a useful " },
    },
    {
      name: "message.delta",
      data: {
        type: "message.delta",
        content: "contribution. What part did you own?",
      },
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
  assert.deepEqual(response.complete, { content });
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
  const content =
    "I will help clarify your documented experience without inventing claims. What was your contribution?";
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
        responseShape:
          "Initiate the conversation yourself. In two or three concise sentences, briefly explain that you will clarify documented experience for an accurate resume without inventing claims, introduce the exact saved question, and invite a natural answer. Reply with no JSON, labels, tools, or actions.",
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

test("Resume Interview Coach replaces an ungrounded scope reply with the saved question", async () => {
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
  const expected =
    "We are clarifying your documented experience for your resume. The current question is: What problem or need was BioEvidence intended to address? Please answer from your experience, or tell me what you would like to clarify.";
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
  assert.equal((await stream.next()).value, expected);
  assert.deepEqual((await stream.next()).value, { content: expected });
});

test("Resume Interview Coach asks for additions before permitting a question transition", async () => {
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
  const premature =
    "That is a clear contribution. I will move us to the next question.";
  const expected =
    "That is a clear contribution. Would you like to add or clarify anything else?";
  const stream = streamResumeInterviewCoach(
    value,
    undefined,
    async () =>
      new Response(
        [
          {
            name: "message.delta",
            data: { type: "message.delta", content: premature },
          },
          {
            name: "chat.end",
            data: {
              type: "chat.end",
              result: { output: [{ type: "message", content: premature }] },
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
  assert.equal((await stream.next()).value, expected);
  assert.deepEqual((await stream.next()).value, { content: expected });
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
  const content =
    "I can help you describe the work clearly. What did you personally deliver?";
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
  assert.equal((await crlf.next()).value, content);
  assert.deepEqual((await crlf.next()).value, { content });

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
  const value = request();
  const result = await requestResumeCoach(value, async (url, init) => {
    calls += 1;
    target = String(url);
    body = String(init.body);
    authorization = new Headers(init.headers).get("authorization") ?? "";
    headerNames = [...new Headers(init.headers).keys()].sort();
    hasSignal = init.signal instanceof AbortSignal;
    return native({
      schemaVersion: 1,
      selectionEcho: value.consentFingerprint,
      sections: [
        { heading: "Strength", text: "Your TypeScript work is relevant." },
      ],
      claims: [
        { text: "You built TypeScript interfaces.", evidenceIndexes: [0] },
      ],
      unknowns: ["Production scope is not established."],
    });
  });
  assert.equal(calls, 1);
  assert.equal(target, "http://127.0.0.1:1234/api/v1/chat");
  assert.equal(authorization, "");
  assert.match(body, /"store":false/);
  assert.match(body, /"reasoning":"off"/);
  assert.match(body, /"system_prompt"/);
  assert.match(
    resumeCoachSystemInstruction,
    /Never extrapolate or calculate a benefit/,
  );
  assert.doesNotMatch(
    body,
    /tools|integrations|previous_response_id|https:\/\//,
  );
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
    /^BioEvidence \| Validation workflow/,
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
  assert.match(
    projects,
    /brings VCF validation and evidence review into one system/,
  );
  assert.doesNotMatch(projects, /Created durable SQLite-backed run records/);
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
  assert.match(
    projects,
    /^BioEvidence \| Local-first web system for staged analysis and interpretation of single-nucleotide variants\n\u2022 Created durable SQLite-backed/,
  );
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
    /GWA: 1\.44/,
  );
  assert.match(
    result.sections.find((section) => section.heading === "Projects")?.text ??
      "",
    /Genomic-variant validation workflow/,
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
    /Workflow support/,
  );
});

test("Resume Architect contract keeps Oboda v22 hierarchy and requires evidence-linked work bullets", () => {
  assert.match(resumeGeneratorSystemInstruction, /Resume Architect/);
  assert.match(
    resumeGeneratorSystemInstruction,
    /Experience.*Education.*Projects.*Technical Skills/,
  );
  assert.match(
    resumeGeneratorSystemInstruction,
    /Do not add Professional Summary/,
  );
  assert.match(resumeGeneratorSystemInstruction, /claims entry/);
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
  assert.equal(result.sections[0]?.heading, "Strength");
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
  assert.equal(localModelCapabilityVersion("resume-coach"), "resume-coach-v6");
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
