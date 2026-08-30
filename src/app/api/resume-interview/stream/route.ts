import { revalidatePath } from "next/cache";

import {
  resumeInterviewCoachConsentFingerprint,
  streamResumeInterviewCoach,
} from "@/adapters/local-model/local-model-gateway";
import { toSafeWorkspaceError, WorkspaceError } from "@/domain/workspace/types";
import { readLocalModelGatewayConfiguration } from "@/domain/resume-generation/local-model-configuration-commands";
import {
  beginResumeInterviewCoachStream,
  finalizeResumeInterviewCoachStream,
  readPriorResumeInterviewCandidateContent,
  respondToResumeClarification,
} from "@/domain/resume-generation/resume-clarification-interview";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const uuid = (value: unknown) =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
const requestUuid = (value: unknown) =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[47][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
const plain = (value: unknown, maximum: number) =>
  typeof value === "string" &&
  value.length > 0 &&
  value.length <= maximum &&
  !/[\u0000-\u001f\u007f-\u009f]/.test(value);
const streamHeaders = {
  "Cache-Control": "no-store",
  Connection: "keep-alive",
  "Content-Type": "text/event-stream; charset=utf-8",
  "X-Accel-Buffering": "no",
} as const;

type StreamRequest = {
  workspaceId: string;
  taskId: string;
  message: string;
  opening: boolean;
  consentNonce: string;
  streamRequestId: string;
};

type StreamDependencies = {
  begin: typeof beginResumeInterviewCoachStream;
  finalize: typeof finalizeResumeInterviewCoachStream;
  configuration: typeof readLocalModelGatewayConfiguration;
  stream: typeof streamResumeInterviewCoach;
  readPriorCandidate: typeof readPriorResumeInterviewCandidateContent;
  respond: typeof respondToResumeClarification;
  revalidate: typeof revalidatePath;
};

const streamDependencies: StreamDependencies = {
  begin: beginResumeInterviewCoachStream,
  finalize: finalizeResumeInterviewCoachStream,
  configuration: readLocalModelGatewayConfiguration,
  stream: streamResumeInterviewCoach,
  readPriorCandidate: readPriorResumeInterviewCandidateContent,
  respond: respondToResumeClarification,
  revalidate: revalidatePath,
};

async function inputFor(request: Request): Promise<StreamRequest> {
  if (
    !/^application\/json(?:;|$)/i.test(
      request.headers.get("content-type") ?? "",
    )
  )
    throw new WorkspaceError(
      "RESUME_COACH_INVALID",
      "Coach Resume needs a valid local conversation request.",
      "Refresh the interview and explicitly send your message again.",
    );
  const value: unknown = await request.json();
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new WorkspaceError(
      "RESUME_COACH_INVALID",
      "Coach Resume needs a valid local conversation request.",
      "Refresh the interview and explicitly send your message again.",
    );
  const data = value as Record<string, unknown>;
  const opening = data.opening === true;
  if (
    Object.keys(data).length !== 6 ||
    ![
      "workspaceId",
      "taskId",
      "message",
      "opening",
      "consentNonce",
      "streamRequestId",
    ].every((key) => key in data) ||
    !uuid(data.workspaceId) ||
    !plain(data.taskId, 80) ||
    typeof data.opening !== "boolean" ||
    typeof data.message !== "string" ||
    data.message.length > 1_200 ||
    (opening ? data.message !== "" : !plain(data.message, 1_200)) ||
    !requestUuid(data.consentNonce) ||
    !requestUuid(data.streamRequestId)
  )
    throw new WorkspaceError(
      "RESUME_COACH_INVALID",
      "Coach Resume needs a valid local conversation request.",
      "Refresh the interview and explicitly send your message again.",
    );
  return {
    workspaceId: String(data.workspaceId),
    taskId: String(data.taskId),
    message: String(data.message),
    opening,
    consentNonce: String(data.consentNonce),
    streamRequestId: String(data.streamRequestId),
  };
}

const event = (value: Record<string, unknown>) =>
  `data: ${JSON.stringify(value)}\n\n`;

function coachAskedForMore(transcript: string[]): boolean {
  const latestCoach = [...transcript]
    .reverse()
    .find((turn) => turn.startsWith("Coach: "))
    ?.slice("Coach: ".length);
  return /\b(?:add|clarify)\b.*\b(?:anything|more|else)\b/i.test(
    latestCoach ?? "",
  );
}

function candidateIsReadyToContinue(message: string): boolean {
  const value = message.trim().toLocaleLowerCase();
  return /^(?:no(?: more)?\b|nope\b|nothing (?:more|else)|that(?:'s| is) all|i(?:'m| am) done|i (?:won't|wont|will not) add|go on|next)/.test(
    value,
  );
}

const transitionReply =
  "Thanks, that completes this clarification. I will move us to the next question.";

export async function createResumeInterviewStreamResponse(
  request: Request,
  overrides: Partial<StreamDependencies> = {},
): Promise<Response> {
  let input: StreamRequest;
  try {
    input = await inputFor(request);
  } catch (error) {
    const safe = toSafeWorkspaceError(error);
    return new Response(event({ type: "error", summary: safe.summary }), {
      status: 400,
      headers: streamHeaders,
    });
  }
  const dependencies = { ...streamDependencies, ...overrides };
  const encoder = new TextEncoder();
  const upstream = new AbortController();
  let abandoned = false;
  const abandon = () => {
    abandoned = true;
    upstream.abort();
  };
  const interrupted = () =>
    abandoned || request.signal.aborted || upstream.signal.aborted;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      request.signal.addEventListener("abort", abandon, { once: true });
      try {
        if (interrupted()) return;
        const started = await dependencies.begin({
          workspaceId: input.workspaceId,
          taskId: input.taskId,
          candidateContent: input.message,
          opening: input.opening,
          streamRequestId: input.streamRequestId,
        });
        if (interrupted()) return;
        let coachContent = "";
        if (
          !input.opening &&
          coachAskedForMore(started.transcript) &&
          candidateIsReadyToContinue(input.message)
        ) {
          coachContent = transitionReply;
          controller.enqueue(
            encoder.encode(event({ type: "delta", text: coachContent })),
          );
        } else {
          const configuration = await dependencies.configuration();
          if (interrupted()) return;
          const connection = {
            configurationRevisionId: configuration.id,
            configurationDigest: configuration.configurationDigest,
            modelIdentifier: configuration.modelIdentifier,
          };
          const coachInput = {
            connection,
            workspaceId: input.workspaceId,
            taskId: input.taskId,
            question: started.question,
            context: started.context,
            transcript: started.transcript,
            opening: input.opening,
            consentNonce: input.consentNonce,
          };
          const coach = dependencies.stream(
            {
              ...coachInput,
              consentFingerprint:
                resumeInterviewCoachConsentFingerprint(coachInput),
            },
            upstream.signal,
          );
          for await (const delta of coach) {
            if (interrupted()) return;
            coachContent += delta;
            controller.enqueue(
              encoder.encode(event({ type: "delta", text: delta })),
            );
          }
          if (interrupted()) return;
        }
        await dependencies.finalize({
          workspaceId: input.workspaceId,
          taskId: input.taskId,
          streamRequestId: input.streamRequestId,
          coachContent,
          opening: input.opening,
          signal: upstream.signal,
        });
        if (interrupted()) return;
        if (
          !input.opening &&
          coachContent.trim().endsWith("I will move us to the next question.")
        ) {
          const answer = await dependencies.readPriorCandidate({
            workspaceId: input.workspaceId,
            taskId: input.taskId,
            streamRequestId: input.streamRequestId,
          });
          if (answer)
            await dependencies.respond({
              workspaceId: input.workspaceId,
              taskId: input.taskId,
              answer,
            });
        }
        if (interrupted()) return;
        dependencies.revalidate("/resume/interview");
        dependencies.revalidate("/resume");
        controller.enqueue(encoder.encode(event({ type: "complete" })));
      } catch (error) {
        if (!interrupted()) {
          const safe = toSafeWorkspaceError(error);
          controller.enqueue(
            encoder.encode(event({ type: "error", summary: safe.summary })),
          );
        }
      } finally {
        request.signal.removeEventListener("abort", abandon);
        controller.close();
      }
    },
    cancel() {
      abandon();
    },
  });
  return new Response(stream, { headers: streamHeaders });
}

export async function POST(request: Request): Promise<Response> {
  return createResumeInterviewStreamResponse(request);
}
