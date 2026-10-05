import { WorkspaceError } from "@/domain/workspace/types";
import type { FetchLike, ResumeInterviewCoachRequest, ResumeInterviewCoachResponse, ResumeInterviewCoachStreamResponse, ResumeInterviewTurnDecision } from "./local-model-contracts";
import { boundedText, endpoint, exactKeys, maxRequest, maxStreamFrame, plain, uuid, validConnection } from "./model-boundaries";
import { invalid, resumeInterviewCoachConsentFingerprint } from "./model-consent";
import { native } from "./native-transport";

function validResumeInterviewCoachRequest(
  request: ResumeInterviewCoachRequest,
): void {
  if (
    !validConnection(request.connection) ||
    !uuid(request.workspaceId) ||
    !plain(request.taskId, 80) ||
    !plain(request.question, 1_200) ||
    request.context.length > 30 ||
    request.context.some((item) => !plain(item, 1_200)) ||
    request.transcript.length > 20 ||
    request.transcript.some((item) => !plain(item, 1_200)) ||
    (request.opening !== undefined && typeof request.opening !== "boolean") ||
    (request.clarificationUsed !== undefined &&
      typeof request.clarificationUsed !== "boolean") ||
    request.consentFingerprint !==
      resumeInterviewCoachConsentFingerprint(request)
  )
    invalid("The selected interview context cannot be sent safely.");
}

const interviewDecisionStart = "<resume-interview-decision>";

const interviewDecisionEnd = "</resume-interview-decision>";

const maxInterviewRawResponse = 2_400;

function interviewDecision(
  value: unknown,
  fingerprint: string,
  content: string,
): ResumeInterviewTurnDecision {
  if (!value || typeof value !== "object" || Array.isArray(value))
    invalid("The local model returned an unsupported interview decision.");
  const decision = value as Record<string, unknown>;
  if (
    decision.schemaVersion !== 1 ||
    decision.selectionEcho !== fingerprint ||
    typeof decision.disposition !== "string"
  )
    invalid("The local model returned an unsupported interview decision.");
  if (
    decision.disposition === "complete" &&
    exactKeys(decision, [
      "schemaVersion",
      "selectionEcho",
      "disposition",
      "answerSource",
    ]) &&
    (decision.answerSource === "latest" || decision.answerSource === "prior")
  ) {
    if (content.includes("?"))
      invalid(
        "The local model asked a follow-up while marking the answer complete.",
      );
    return { disposition: "complete", answerSource: decision.answerSource };
  }
  if (
    decision.disposition === "unknown" &&
    exactKeys(decision, ["schemaVersion", "selectionEcho", "disposition"])
  ) {
    if (content.includes("?"))
      invalid(
        "The local model asked a follow-up while marking the answer unknown.",
      );
    return { disposition: "unknown" };
  }
  const missingDetail = decision.missingDetail;
  if (
    decision.disposition === "clarify" &&
    exactKeys(decision, [
      "schemaVersion",
      "selectionEcho",
      "disposition",
      "missingDetail",
    ]) &&
    typeof missingDetail === "string" &&
    plain(missingDetail, 240) &&
    plain(content, 240) &&
    /^\s*[^?]*\?\s*$/.test(content) &&
    content.toLocaleLowerCase().includes(missingDetail.toLocaleLowerCase())
  )
    return { disposition: "clarify", missingDetail };
  invalid("The local model returned an unsupported interview decision.");
}

function streamedInterviewResponse(
  request: ResumeInterviewCoachRequest,
  rawContent: string,
): ResumeInterviewCoachStreamResponse {
  if (request.opening) {
    if (rawContent.trim() !== request.question)
      invalid("The local model returned an unsupported interview opening.");
    return { content: request.question };
  }
  const start = rawContent.indexOf(interviewDecisionStart);
  const end = rawContent.indexOf(interviewDecisionEnd);
  if (
    start <= 0 ||
    end < start ||
    rawContent.indexOf(interviewDecisionStart, start + 1) !== -1 ||
    rawContent.indexOf(interviewDecisionEnd, end + 1) !== -1 ||
    end + interviewDecisionEnd.length !== rawContent.length
  )
    invalid("The local model returned an unsupported interview decision.");
  let content = rawContent.slice(0, start).trim();
  if (!boundedText(content, 1_800))
    invalid("The local model returned unsupported interview guidance.");
  const latestCandidate = [...request.transcript]
    .reverse()
    .find((turn) => turn.startsWith("Candidate: "))
    ?.slice("Candidate: ".length)
    .trim();
  if (latestCandidate) {
    const cleanContent = content.toLowerCase().replace(/[^a-z0-9]/g, "");
    const cleanCandidate = latestCandidate
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
    if (
      cleanCandidate.length > 5 &&
      (cleanContent === cleanCandidate ||
        cleanContent.includes(cleanCandidate) ||
        cleanCandidate.includes(cleanContent))
    ) {
      content = "Understood, thanks for clarifying.";
    }
  }
  let decisionValue: unknown;
  try {
    decisionValue = JSON.parse(
      rawContent.slice(start + interviewDecisionStart.length, end),
    );
  } catch {
    invalid("The local model returned an unsupported interview decision.");
  }
  const decision = interviewDecision(
    decisionValue,
    request.consentFingerprint,
    content,
  );
  if (decision.disposition === "clarify" && request.clarificationUsed)
    invalid(
      "The local model requested more clarification than this question allows.",
    );
  return { content, decision };
}

/**
 * Streams native LM Studio `message.delta` / `chat.end` SSE. Candidate-turn
 * decisions are validated server-side and never exposed to the browser.
 */
export async function* streamResumeInterviewCoach(
  request: ResumeInterviewCoachRequest,
  signal?: AbortSignal,
  fetcher: FetchLike = fetch,
): AsyncGenerator<string, ResumeInterviewCoachStreamResponse> {
  validResumeInterviewCoachRequest(request);
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(() => controller.abort(), 240_000);
  let response: Response;
  try {
    const opening = request.opening === true;
    const latestCandidateMessage = [...request.transcript]
      .reverse()
      .find((turn) => turn.startsWith("Candidate: "))
      ?.slice("Candidate: ".length)
      .trim();
    if (!opening && !latestCandidateMessage)
      invalid("The selected interview context cannot be sent safely.");
    const acknowledgementRule = `ACKNOWLEDGEMENT RULE: In exactly one short sentence, acknowledge the candidate's latest message by tying back to one specific detail they actually gave (a feature, workflow, role, tool, problem, outcome, or constraint they named), rephrased in your own words. Vary the opening word and sentence shape between turns (Got it / Understood / That helps / Thanks / Perfect / Good context) and never reuse the same acknowledgement phrasing twice in the conversation. NEVER echo, repeat, or mirror the candidate's full answer back to them, and never invent details they did not state. If the candidate declines to add more, briefly accept that in one varied sentence (for example 'Understood — I will keep your earlier answer.').`;
    const body = JSON.stringify({
      model: request.connection.modelIdentifier,
      input: JSON.stringify({
        savedQuestion: request.question,
        context: request.context,
        transcript: request.transcript,
        opening,
        latestCandidateMessage: latestCandidateMessage ?? null,
        clarificationUsed: request.clarificationUsed === true,
        responseShape: opening
          ? "Ask the exact saved question directly. Reply with that question only: no preamble, explanation, labels, tools, or actions."
          : `Respond with exactly 1 brief, natural acknowledgement sentence grounded in the candidate's latest message: reference one specific detail they actually gave (a feature, workflow, role, tool, problem, outcome, or constraint they named), rephrased in your own words. Vary the opening word and sentence shape between turns (Got it / Understood / That helps / Thanks / Perfect / Good context) and never reuse the same acknowledgement phrasing twice in this conversation.
CRITICAL: NEVER repeat, echo, or parrot the candidate's answer back to them, and never invent details they did not state.
Then append exactly one machine-only decision tag with no text after it: ${interviewDecisionStart}{"schemaVersion":1,"selectionEcho":"${request.consentFingerprint}","disposition":"complete","answerSource":"latest"}${interviewDecisionEnd}.
The visible reply comes before the tag and must not mention the tag or decision.
Decision options:
- For complete with latest answer (adequate, broad, or substantive answer, e.g. 'I built it end to end', 'all of it', 'I did everything', or any direct answer): ${interviewDecisionStart}{"schemaVersion":1,"selectionEcho":"${request.consentFingerprint}","disposition":"complete","answerSource":"latest"}${interviewDecisionEnd}
- For complete with prior answer (candidate declines to add more after a prior substantive answer): ${interviewDecisionStart}{"schemaVersion":1,"selectionEcho":"${request.consentFingerprint}","disposition":"complete","answerSource":"prior"}${interviewDecisionEnd}
- For unknown (candidate cannot answer, says they do not know, or declines): ${interviewDecisionStart}{"schemaVersion":1,"selectionEcho":"${request.consentFingerprint}","disposition":"unknown"}${interviewDecisionEnd}
- For clarify (one critical detail is missing, or candidate message is off-topic and needs redirecting to the question): ${interviewDecisionStart}{"schemaVersion":1,"selectionEcho":"${request.consentFingerprint}","disposition":"clarify","missingDetail":"<exact phrase>"}${interviewDecisionEnd} (visible reply must be 1 question <= 240 chars containing the missingDetail phrase). ${request.clarificationUsed ? "A clarification has already been used, so do not choose clarify." : ""}
For complete or unknown, the visible reply is exactly the one acknowledgement sentence described above, with no question. Never repeat the candidate's message and never ask a generic question about anything else.`,
      }),
      system_prompt: [
        "You are Coach Resume in a live, evidence-grounded resume clarification conversation.",
        `The only task is this exact saved resume question: ${request.question}`,
        "DECISION GUIDANCE: If the candidate answered the question (even broadly or simply, such as 'I built it end to end' or naming a general tool/layer), accept it immediately as complete/latest. If they decline to add more after previously answering, choose complete/prior. Choose unknown if they cannot answer. Choose clarify only if a critical piece of information directly asked in the question is absent. If the candidate's message is off-topic or unrelated, do not switch into general assistant mode; instead redirect them back to the question using clarify (or unknown if a clarification was already used).",
        ...(acknowledgementRule && !opening ? [acknowledgementRule] : []),
        "Never act as a general-purpose assistant or discuss another project. Do not mention an application, framework, API, database, file, technology, or plan unless it is supplied in the saved question, documented context, or the candidate's own message.",
        "Use supplied evidence only as context; do not invent claims. Never create tasks, claims, evidence, drafts, PDFs, tools, filesystem, or network actions.",
        opening
          ? "Ask the exact saved question directly and nothing else."
          : "Make only the bounded complete, unknown, or clarify decision requested in the response shape. Do not infer facts from a candidate message; the host alone decides how an accepted answer is persisted.",
      ].join("\n"),
      stream: true,
      store: false,
      reasoning: "off",
      temperature: 0.2,
      max_output_tokens: 4_000,
    });
    if (body.length > maxRequest)
      throw new WorkspaceError(
        "RESUME_COACH_UNAVAILABLE",
        "The selected interview context cannot be sent safely.",
        "Review the saved question and try the local Coach again.",
      );
    response = await fetcher(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "text/event-stream",
      },
      body,
      signal: controller.signal,
    });
    if (
      !response.ok ||
      !response.body ||
      !/^text\/event-stream(?:;|$)/i.test(
        response.headers.get("content-type") ?? "",
      )
    )
      throw new Error("unavailable");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffered = "";
    let content = "";
    let terminal = false;
    const processFrame = (
      frame: string,
    ): { delta?: string; complete?: true } => {
      const lines = frame.replaceAll("\r\n", "\n").split("\n");
      const eventName = lines
        .find((line) => line.startsWith("event: "))
        ?.slice(7);
      const data = lines.filter((line) => line.startsWith("data: "));
      if (!eventName || data.length !== 1)
        invalid("The local model returned malformed streaming guidance.");
      let event: unknown;
      try {
        event = JSON.parse(data[0]!.slice(6));
      } catch {
        invalid("The local model returned malformed streaming guidance.");
      }
      if (!event || typeof event !== "object" || Array.isArray(event))
        invalid("The local model returned malformed streaming guidance.");
      const value = event as Record<string, unknown>;
      if (value.type !== eventName)
        invalid("The local model returned malformed streaming guidance.");
      if (eventName === "message.delta") {
        if (value.content === "") return {};
        if (
          terminal ||
          typeof value.content !== "string" ||
          value.content.length > maxInterviewRawResponse ||
          /[\u0000\u007f-\u009f]/.test(value.content)
        )
          invalid("The local model returned malformed streaming guidance.");
        content += value.content;
        if (content.length > maxInterviewRawResponse)
          invalid("The local model response is too large to review safely.");
        return { delta: value.content };
      }
      if (eventName === "chat.end") {
        const result = value.result;
        if (
          terminal ||
          !result ||
          typeof result !== "object" ||
          Array.isArray(result)
        )
          invalid("The local model returned malformed streaming guidance.");
        const output = (result as Record<string, unknown>).output;
        const message = Array.isArray(output)
          ? (output.find(
              (item) =>
                item &&
                typeof item === "object" &&
                (item as Record<string, unknown>).type === "message",
            ) as Record<string, unknown> | undefined)
          : undefined;
        if (
          !message ||
          typeof message.content !== "string" ||
          message.content !== content
        )
          invalid("The local model returned malformed streaming guidance.");
        terminal = true;
        return { complete: true };
      }
      if (eventName === "error" || terminal)
        invalid("The local model returned malformed streaming guidance.");
      return {};
    };
    while (true) {
      const next = await reader.read();
      buffered += decoder.decode(next.value, { stream: !next.done });
      let boundary: RegExpExecArray | null;
      while ((boundary = /\r?\n\r?\n/.exec(buffered))) {
        const frame = buffered.slice(0, boundary.index);
        buffered = buffered.slice(boundary.index + boundary[0].length);
        if (!frame) continue;
        processFrame(frame);
      }
      if (buffered.length > maxStreamFrame)
        invalid("The local model returned malformed streaming guidance.");
      if (next.done) break;
    }
    if (buffered || !terminal)
      invalid("The local model ended before its Coach response was complete.");
    const completed = streamedInterviewResponse(request, content);
    yield completed.content;
    return completed;
  } catch (error) {
    if (error instanceof WorkspaceError) throw error;
    throw new WorkspaceError(
      "RESUME_COACH_UNAVAILABLE",
      "Streaming local Coach Resume is unavailable right now.",
      "Use the non-streaming Coach option or confirm LM Studio is running locally.",
    );
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}

export async function requestResumeInterviewCoach(
  request: ResumeInterviewCoachRequest,
  fetcher: FetchLike = fetch,
): Promise<ResumeInterviewCoachResponse> {
  validResumeInterviewCoachRequest(request);
  const value = (await native(
    request.connection,
    "Return only JSON. Conversationally introduce the exact saved question. You may ask zero or one short follow-up. Never create tasks, claims, evidence, drafts, PDFs, tools, filesystem, or network actions.",
    {
      schemaVersion: 1,
      selectionEcho: request.consentFingerprint,
      savedQuestion: request.question,
      context: request.context,
      transcript: request.transcript,
      responseShape: {
        question: request.question,
        followUp: "optional string",
        selectionEcho: request.consentFingerprint,
      },
    },
    4_000,
    fetcher,
    "RESUME_COACH_UNAVAILABLE",
  )) as Record<string, unknown>;
  if (
    (!exactKeys(value, [
      "schemaVersion",
      "question",
      "followUp",
      "selectionEcho",
    ]) &&
      !exactKeys(value, ["schemaVersion", "question", "selectionEcho"])) ||
    value.schemaVersion !== 1 ||
    value.selectionEcho !== request.consentFingerprint ||
    value.question !== request.question ||
    (value.followUp !== undefined && !plain(value.followUp, 500))
  )
    invalid("The local model returned unsupported interview guidance.");
  return {
    schemaVersion: 1,
    question: request.question,
    followUp: value.followUp as string | undefined,
    selectionEcho: request.consentFingerprint,
  };
}

