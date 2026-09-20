"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { InterviewView } from "@/domain/resume-generation/resume-clarification-interview";

const streamPath = "/api/resume-interview/stream";
const maxStreamFrame = 8_192;

type StreamState =
  { kind: "idle" } | { kind: "streaming" } | { kind: "error"; summary: string };

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
  const [streamState, setStreamState] = useState<StreamState>({ kind: "idle" });
  const [partial, setPartial] = useState("");
  const [pendingCandidate, setPendingCandidate] = useState("");
  const [progress, setProgress] = useState("");
  const lastAnnouncement = useRef(0);
  const openingTaskId = useRef<string | null>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const current = interview.current;
  const streaming = streamState.kind === "streaming";

  const sendStream = useCallback(
    async (message: string, opening = false) => {
      if ((!message && !opening) || !current) return;
      const controller = new AbortController();
      if (!opening) setPendingCandidate(message);
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
            opening,
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
        setPendingCandidate("");
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
        if (controller.signal.aborted)
          setStreamState({
            kind: "error",
            summary:
              "Coach Resume generation was stopped. The unfinished response was not saved.",
          });
      }
    },
    [current, router, workspaceId],
  );

  useEffect(() => {
    if (
      !current ||
      interview.turns.some((turn) => turn.taskId === current.id) ||
      openingTaskId.current === current.id
    )
      return;
    openingTaskId.current = current.id;
    void sendStream("", true);
  }, [current, interview.turns, sendStream]);

  const scrollToBottom = useCallback((smooth = true) => {
    const messages = messagesRef.current;
    if (messages) messages.scrollTop = messages.scrollHeight;
    messagesEndRef.current?.scrollIntoView({
      behavior: smooth ? "smooth" : "auto",
      block: "end",
    });
  }, []);

  useEffect(() => {
    const messages = messagesRef.current;
    if (messages) messages.scrollTop = messages.scrollHeight;
    messagesEndRef.current?.scrollIntoView({ block: "end" });
    const frameId = requestAnimationFrame(() => {
      const msgs = messagesRef.current;
      if (msgs) msgs.scrollTop = msgs.scrollHeight;
      messagesEndRef.current?.scrollIntoView({ block: "end" });
    });
    return () => cancelAnimationFrame(frameId);
  }, [interview.turns, partial, pendingCandidate, streaming]);

  return (
    <section
      className="panel coach-card"
      aria-label="Resume clarification interview"
      aria-labelledby="resume-interview-heading"
    >
      <div className="coach-hero sr-only">
        <p className="eyebrow">Coach Resume</p>
        <h2 id="resume-interview-heading">Clarify your experience</h2>
        <span>Chat</span>
        <span>Goals</span>
        <span>Local only</span>
        <span>Optimization goals</span>
      </div>
      <div id="coach-chat-panel" className="coach-chat-view">
        <div className="coach-chat-main">
          <div id="coach-chat-content" className="coach-chat-content">
            {current ? (
              <div className="coach-chat-context">
                <div className="coach-context-header">
                  <span className="coach-context-tag">Current goal</span>
                  <span className="coach-context-item">
                    {current.itemName} ({current.itemCategory})
                  </span>
                </div>
                <p className="coach-context-question">{current.question}</p>
              </div>
            ) : null}
            <div className="coach-messages" ref={messagesRef}>
              <ol
                aria-label="Coach Resume conversation"
                className="coach-transcript"
                aria-busy={streaming}
              >
                {interview.turns.map((turn) => (
                  <li
                    key={turn.id}
                    className={
                      turn.role === "coach"
                        ? "coach-message-row"
                        : "candidate-message-row"
                    }
                  >
                    <div
                      className={`message-avatar ${
                        turn.role === "coach"
                          ? "coach-avatar"
                          : "candidate-avatar"
                      }`}
                      aria-hidden="true"
                    >
                      {turn.role === "coach" ? "✦" : "👤"}
                    </div>
                    <div className="message-bubble-wrapper">
                      <div className="message-header-row">
                        <span className="message-sender-name">
                          {turn.role === "coach" ? "Coach Resume" : "You"}
                        </span>
                      </div>
                      <div className="message-bubble">{turn.content}</div>
                    </div>
                  </li>
                ))}
                {pendingCandidate ? (
                  <li className="candidate-message-row">
                    <div
                      className="message-avatar candidate-avatar"
                      aria-hidden="true"
                    >
                      👤
                    </div>
                    <div className="message-bubble-wrapper">
                      <div className="message-header-row">
                        <span className="message-sender-name">You</span>
                      </div>
                      <div className="message-bubble">{pendingCandidate}</div>
                    </div>
                  </li>
                ) : null}
                {partial ? (
                  <li
                    className="coach-message-row coach-message-streaming"
                    aria-label="Coach Resume is responding"
                  >
                    <div
                      className="message-avatar coach-avatar"
                      aria-hidden="true"
                    >
                      ✦
                    </div>
                    <div className="message-bubble-wrapper">
                      <div className="message-header-row">
                        <span className="message-sender-name">
                          Coach Resume
                        </span>
                        <span className="typing-indicator" aria-hidden="true">
                          <span className="typing-dot" />
                          <span className="typing-dot" />
                          <span className="typing-dot" />
                        </span>
                      </div>
                      <div className="message-bubble coach-bubble-streaming">
                        {partial}
                      </div>
                    </div>
                  </li>
                ) : null}
              </ol>
              <div
                ref={messagesEndRef}
                style={{ height: "1px", width: "100%", pointerEvents: "none" }}
                aria-hidden="true"
              />
            </div>
            {interview.completed.some((task) => task.needsReview) ? (
              <p className="coach-inline-status status status-error">
                Review needed: this answer may conflict with documented
                evidence.
              </p>
            ) : null}
            {current ? (
              <>
                <form
                  aria-busy={streaming}
                  className="coach-composer"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const form = event.currentTarget;
                    const message = String(
                      new FormData(form).get("message") ?? "",
                    ).trim();
                    if (!message) return;
                    form.reset();
                    void sendStream(message);
                    scrollToBottom(true);
                  }}
                >
                  <input type="hidden" name="workspaceId" value={workspaceId} />
                  <input
                    type="hidden"
                    name="consentNonce"
                    value={`${workspaceId}:${current.id}`}
                  />
                  <label className="sr-only" htmlFor="coach-message">
                    Message Coach Resume
                  </label>
                  <div className="coach-input-row">
                    <textarea
                      id="coach-message"
                      name="message"
                      rows={1}
                      maxLength={1200}
                      required
                      disabled={streaming}
                      placeholder="Type your clarification answer..."
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          event.currentTarget.form?.requestSubmit();
                        }
                      }}
                    />
                    <button
                      type="submit"
                      className="coach-send-button"
                      aria-label="Send message"
                      disabled={streaming}
                    >
                      {streaming ? (
                        <span className="send-spinner" aria-hidden="true" />
                      ) : (
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="m22 2-7 20-4-9-9-4Z" />
                          <path d="M22 2 11 13" />
                        </svg>
                      )}
                      <span>Send</span>
                    </button>
                  </div>
                  <p className="coach-composer-note">
                    Local Coach Resume only. It completes a goal when it has an
                    adequate answer, an explicit unknown, or one needed detail
                    to clarify.
                  </p>
                </form>
                {streamState.kind === "error" ? (
                  <div
                    className="coach-inline-status status status-error"
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
                      Try again with this message
                    </button>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="coach-chat-complete">
                <div className="complete-icon-badge">✓</div>
                <h3>All Evidence Clarified</h3>
                <p>
                  All current questions are complete. Your evidence is ready for
                  the next resume step.
                </p>
              </div>
            )}
          </div>
        </div>
        <aside
          className="coach-goals-sidebar coach-insights coach-insight-goals coach-goals-view"
          aria-label="Clarification goals"
        >
          <div className="coach-insights-head">
            <div>
              <p className="eyebrow">Goals &amp; Progress</p>
              <h3 className="coach-insights-title">Clarification Roadmap</h3>
            </div>
            <span className="insights-counter">
              {interview.completed.length}/{interview.total}
            </span>
          </div>
          <div className="coach-progress-bar-track" aria-hidden="true">
            <div
              className="coach-progress-bar-fill"
              style={{
                width: `${
                  interview.total > 0
                    ? Math.round(
                        (interview.completed.length / interview.total) * 100,
                      )
                    : 0
                }%`,
              }}
            />
          </div>
          <p className="coach-insights-intro">
            {interview.completed.length} of {interview.total} questions
            complete.{" "}
            {interview.remaining === 0
              ? "All goals complete! Your evidence is fully clarified."
              : `${interview.remaining} goal${interview.remaining === 1 ? "" : "s"} remaining.`}
          </p>
          <ol className="coach-goals" aria-label="Clarification goals">
            {interview.completed.map((task) => (
              <li key={task.id} className="coach-goal coach-goal-complete">
                <span className="goal-check-icon" aria-hidden="true">
                  ✓
                </span>
                <div className="goal-item-body">
                  <span className="goal-item-badge">
                    {task.itemName || task.itemCategory}
                  </span>
                  <span className="goal-item-question">{task.question}</span>
                </div>
              </li>
            ))}
            {current ? (
              <li className="coach-goal coach-goal-current" aria-current="step">
                <span className="goal-current-icon" aria-hidden="true">
                  •
                </span>
                <div className="goal-item-body">
                  <span className="goal-item-badge active-badge">
                    {current.itemName || current.itemCategory}
                  </span>
                  <span className="goal-item-question">{current.question}</span>
                </div>
              </li>
            ) : null}
          </ol>
        </aside>
        <p
          className="sr-only"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {progress}
        </p>
      </div>
    </section>
  );
}
