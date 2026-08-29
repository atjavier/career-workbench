"use client";

import { useActionState, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  resumeClarificationAction,
  type ResumeInterviewActionState,
} from "@/app/actions";
import type { InterviewView } from "@/domain/resume-generation/resume-clarification-interview";

const initial: ResumeInterviewActionState = { status: "idle", summary: "" };
const streamPath = "/api/resume-interview/stream";
const maxStreamFrame = 8_192;

type StreamState =
  | { kind: "idle" }
  | { kind: "streaming" }
  | { kind: "error"; summary: string };

function randomId(): string {
  return crypto.randomUUID();
}

export function ResumeInterview({
  workspaceId,
  interview,
}: {
  workspaceId: string;
  interview: InterviewView;
}) {
  const router = useRouter();
  const [answerState, answerAction, answerPending] = useActionState(
    resumeClarificationAction,
    initial,
  );
  const [streamState, setStreamState] = useState<StreamState>({ kind: "idle" });
  const [partial, setPartial] = useState("");
  const [progress, setProgress] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const lastAnnouncement = useRef(0);
  const current = interview.current;
  const streaming = streamState.kind === "streaming";

  function discardUnfinished() {
    abortRef.current?.abort();
    setPartial("");
  }

  async function sendStream(form: HTMLFormElement) {
    const message = String(new FormData(form).get("message") ?? "").trim();
    if (!message || !current) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setPartial("");
    setProgress("Coach Resume is responding.");
    setStreamState({ kind: "streaming" });
    lastAnnouncement.current = Date.now();
    try {
      const response = await fetch(streamPath, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          taskId: current.id,
          message,
          consentNonce: randomId(),
          streamRequestId: randomId(),
        }),
        signal: controller.signal,
      });
      if (!response.ok || !response.body) throw new Error("unavailable");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffered = "";
      let complete = false;
      while (true) {
        const next = await reader.read();
        buffered += decoder.decode(next.value, { stream: !next.done });
        let boundary: RegExpExecArray | null;
        while ((boundary = /\r?\n\r?\n/.exec(buffered))) {
          const frame = buffered.slice(0, boundary.index);
          buffered = buffered.slice(boundary.index + boundary[0].length);
          if (!frame.startsWith("data: ")) throw new Error("malformed");
          const event: unknown = JSON.parse(frame.slice(6));
          if (!event || typeof event !== "object" || Array.isArray(event))
            throw new Error("malformed");
          const value = event as Record<string, unknown>;
          if (complete) throw new Error("malformed");
          if (value.type === "delta" && typeof value.text === "string") {
            setPartial((text) => text + value.text);
            if (Date.now() - lastAnnouncement.current >= 1_500) {
              lastAnnouncement.current = Date.now();
              setProgress("Coach Resume is still responding.");
            }
          } else if (value.type === "complete") {
            complete = true;
          } else if (
            value.type === "error" &&
            typeof value.summary === "string"
          ) {
            throw new Error(value.summary);
          } else throw new Error("malformed");
        }
        if (buffered.length > maxStreamFrame) throw new Error("malformed");
        if (next.done) break;
      }
      if (!complete || buffered) throw new Error("incomplete");
      setPartial("");
      setProgress("Coach Resume response complete.");
      setStreamState({ kind: "idle" });
      router.refresh();
    } catch (error) {
      if (controller.signal.aborted) {
        setProgress(
          "Coach Resume generation stopped. The unfinished response was not saved.",
        );
      } else {
        const summary =
          error instanceof Error &&
          error.message !== "unavailable" &&
          error.message !== "malformed" &&
          error.message !== "incomplete"
            ? error.message
            : "Streaming local Coach Resume is unavailable right now.";
        setStreamState({ kind: "error", summary });
        setProgress(
          "Coach Resume did not finish. The unfinished response was not saved.",
        );
      }
    } finally {
      abortRef.current = null;
      if (controller.signal.aborted)
        setStreamState({
          kind: "error",
          summary:
            "Coach Resume generation was stopped. The unfinished response was not saved.",
        });
    }
  }

  function stopStream() {
    abortRef.current?.abort();
  }

  return (
    <section className="panel" aria-labelledby="resume-interview-heading">
      <p className="eyebrow">Coach Resume</p>
      <h2 id="resume-interview-heading">Clarify your experience</h2>
      <p role="status" aria-live="polite" aria-atomic="true">
        {interview.total
          ? `${interview.completed.length} of ${interview.total} questions complete. ${interview.remaining} remaining.`
          : "Coach Resume is ready when documented questions are available."}
      </p>
      <ol
        aria-label="Coach Resume conversation"
        className="coach-transcript"
        aria-busy={streaming}
      >
        {interview.turns.map((turn) => (
          <li
            key={turn.id}
            className={
              turn.role === "coach" ? "coach-message" : "candidate-message"
            }
          >
            <strong>{turn.role === "coach" ? "Coach Resume" : "You"}:</strong>{" "}
            {turn.content}
          </li>
        ))}
        {partial ? (
          <li
            className="coach-message coach-message-unfinished"
            aria-label="Unfinished Coach Resume response"
          >
            <strong>Coach Resume (unfinished):</strong> {partial}
          </li>
        ) : null}
      </ol>
      <p
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {progress}
      </p>
      {interview.completed.some((task) => task.needsReview) ? (
        <p className="status status-error">
          Review needed: this answer may conflict with documented evidence.
        </p>
      ) : null}
      {current ? (
        <>
          <p>
            <strong>Saved question:</strong> {current.question}
          </p>
          <form
            aria-busy={streaming}
            className="coach-composer"
            onSubmit={(event) => {
              event.preventDefault();
              void sendStream(event.currentTarget);
            }}
          >
            <input type="hidden" name="workspaceId" value={workspaceId} />
            <input
              type="hidden"
              name="consentNonce"
              value={`${workspaceId}:${current.id}`}
            />
            <label htmlFor="coach-message">Message to Coach Resume</label>
            <textarea
              id="coach-message"
              name="message"
              rows={3}
              maxLength={1200}
              required
              disabled={streaming}
              placeholder="Ask Coach Resume to help you understand the saved question."
            />
            <p>
              Only this message, the saved question, and bounded evidence from
              this resume are sent to LM Studio on this device. Sending a chat
              message does not save an answer.
            </p>
            <div className="coach-stream-actions">
              <button type="submit" disabled={streaming}>
                {interview.turns.length ? "Send" : "Start conversation"}
              </button>
              {streaming ? (
                <button
                  type="button"
                  className="secondary-action"
                  onClick={stopStream}
                >
                  Stop generating
                </button>
              ) : null}
            </div>
          </form>
          {streaming ? (
            <p role="status" aria-live="polite" aria-atomic="true">
              Coach Resume is responding. You can stop generating at any time.
            </p>
          ) : null}
          {streamState.kind === "error" ? (
            <div
              className="status status-error"
              role="status"
              aria-live="polite"
            >
              <p>{streamState.summary}</p>
              <button
                type="button"
                className="secondary-action"
                onClick={() => {
                  setPartial("");
                  setProgress("");
                  setStreamState({ kind: "idle" });
                }}
              >
                Try again
              </button>
            </div>
          ) : null}
          <p>
            To complete this saved question, choose one of your messages below
            as your final answer, or mark it unknown.
          </p>
          {interview.turns
            .filter(
              (turn) => turn.role === "candidate" && turn.taskId === current.id,
            )
            .map((turn) => (
              <form
                key={`final-answer-${turn.id}`}
                action={answerAction}
                aria-busy={answerPending}
                onSubmit={discardUnfinished}
              >
                <input type="hidden" name="workspaceId" value={workspaceId} />
                <input type="hidden" name="taskId" value={current.id} />
                <input type="hidden" name="answer" value={turn.content} />
                <button
                  type="submit"
                  name="command"
                  value="answer"
                  disabled={answerPending}
                >
                  Use this message as my final answer
                </button>
              </form>
            ))}
          <form
            action={answerAction}
            aria-busy={answerPending}
            onSubmit={discardUnfinished}
          >
            <input type="hidden" name="workspaceId" value={workspaceId} />
            <input type="hidden" name="taskId" value={current.id} />
            <button
              type="submit"
              name="command"
              value="skip"
              disabled={answerPending}
            >
              I don&apos;t know
            </button>
          </form>
        </>
      ) : (
        <p>
          All current questions are complete. Your evidence is ready for the
          next resume step.
        </p>
      )}
      {answerState.status !== "idle" ? (
        <p
          className={
            answerState.status === "error" ? "status status-error" : "status"
          }
          role="status"
          aria-live="polite"
        >
          {answerState.summary} {answerState.safeNextAction ?? ""}
        </p>
      ) : null}
    </section>
  );
}
