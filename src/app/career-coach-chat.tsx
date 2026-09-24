"use client";

import Link from "next/link";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import {
  resumeCoachReviewAction,
  type ResumeCoachReviewActionState,
} from "@/app/actions";
import type { MaterialDraftView } from "@/domain/resume-generation/material-draft-commands";

const initialReview: ResumeCoachReviewActionState = {
  status: "idle",
  summary: "",
};

export function CareerCoachChat({
  available,
  unavailableReason,
  draft,
  workspaceId,
}: {
  available: boolean;
  unavailableReason?: string;
  draft?: MaterialDraftView;
  workspaceId?: string;
}) {
  const [reviewState, reviewAction, reviewPending] = useActionState(
    resumeCoachReviewAction,
    initialReview,
  );

  const [turns, setTurns] = useState<
    Array<{
      id: string;
      role: "coach" | "candidate";
      content: string;
      review?: ResumeCoachReviewActionState["review"];
      timestamp: number;
    }>
  >([
    {
      id: "greeting",
      role: "coach",
      content:
        "Hello! I am your AI Career Coach. I've analyzed your documented work and compiled base resume. Ask me questions about your resume, or select a suggested topic below to begin.",
      timestamp: Date.now(),
    },
  ]);

  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastProcessedReviewRef = useRef<ResumeCoachReviewActionState | null>(null);

  useEffect(() => {
    if (reviewState === lastProcessedReviewRef.current) return;
    lastProcessedReviewRef.current = reviewState;
    if (reviewState.status === "success") {
      setTurns((prev) => [
        ...prev,
        {
          id: `coach-${Date.now()}`,
          role: "coach",
          content: reviewState.summary || "Here is my evaluation of your base resume:",
          review: reviewState.review,
          timestamp: Date.now(),
        },
      ]);
    } else if (reviewState.status === "error") {
      setTurns((prev) => [
        ...prev,
        {
          id: `coach-error-${Date.now()}`,
          role: "coach",
          content: reviewState.summary || "I encountered an error reviewing your resume. Please try again.",
          timestamp: Date.now(),
        },
      ]);
    }
  }, [reviewState]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, reviewPending]);

  const quickPrompts = [
    { label: "Audit ATS Readability", prompt: "Audit ATS readability: check formatting, structure, and machine readability." },
    { label: "Strengthen Project Bullets", prompt: "Evaluate my project bullets: suggest stronger action verbs and quantifiable metrics." },
    { label: "Clarity & Relevance Check", prompt: "Check clarity and relevance: identify any weak wording or missing proof." },
    { label: "Full Objective Rating", prompt: "Provide full objective ratings across clarity, relevance, credibility, and ATS score." },
  ];

  const handleSendPrompt = (promptText: string) => {
    const trimmed = promptText.trim();
    if (!trimmed || reviewPending || !draft) return;
    setTurns((prev) => [
      ...prev,
      {
        id: `candidate-${Date.now()}`,
        role: "candidate",
        content: trimmed,
        timestamp: Date.now(),
      },
    ]);
    setInputValue("");
    const formData = new FormData();
    formData.set("draftId", draft.id);
    formData.set("coachFocus", trimmed);
    startTransition(() => {
      reviewAction(formData);
    });
  };

  if (!available) {
    return (
      <div className="career-coach-chat-view is-unavailable">
        <div className="coach-notice-card">
          <p className="coach-notice-text">
            {unavailableReason ?? "Career Coach is unavailable right now."}
          </p>
          <Link href="/resume" className="secondary-action">
            Go to Base Resume
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="career-coach-standalone-layout">
      <div className="career-coach-main-pane">
        <div className="resume-pane-head">
          <div className="coach-head-title-wrap">
            <h2>Career Coach</h2>
            <span className="pro-badge-pill" aria-label="Pro Feature">Pro</span>
          </div>
          <span className="coach-live-indicator" aria-label="Status: Coach Online">
            <span className="coach-badge-dot" aria-hidden="true" />
            Online
          </span>
        </div>

        <div className="resume-coach-chat-container">
          <div className="resume-coach-messages" role="log" aria-live="polite">
            {turns.map((turn) => (
              <div
                key={turn.id}
                className={`coach-message-item ${
                  turn.role === "coach"
                    ? "coach-message-item-coach"
                    : "coach-message-item-candidate"
                }`}
              >
                <div
                  className={`message-avatar ${
                    turn.role === "coach" ? "coach-avatar" : "candidate-avatar"
                  }`}
                  aria-hidden="true"
                >
                  {turn.role === "coach" ? (
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      width="12"
                      height="12"
                    >
                      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
                    </svg>
                  ) : (
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      width="12"
                      height="12"
                    >
                      <circle cx="12" cy="8" r="4" />
                      <path d="M20 21a8 8 0 0 0-16 0" />
                    </svg>
                  )}
                </div>
                <div className="message-bubble-wrapper">
                  <div className="message-header-row">
                    <span className="message-sender-name">
                      {turn.role === "coach" ? "Career Coach" : "You"}
                    </span>
                  </div>
                  <div className="message-bubble">
                    <p className="turn-content-text">{turn.content}</p>
                    {turn.review ? (
                      <div className="review-detailed-breakdown">
                        <p className="review-group-title">
                          <strong>Objective ratings</strong>
                        </p>
                        <ul className="review-ratings-list">
                          {turn.review.ratings.map((rating) => (
                            <li key={rating.area} className="review-rating-item">
                              <span className="rating-pill">{rating.score}/5</span>
                              <div className="rating-copy">
                                <strong>{rating.area}</strong> — {rating.rationale}
                              </div>
                            </li>
                          ))}
                        </ul>
                        {turn.review.concerns.length ? (
                          <div className="review-concerns-block">
                            <p className="review-group-title">
                              <strong>Concerns</strong>
                            </p>
                            <ul className="review-bullet-list concerns-list">
                              {turn.review.concerns.map((item) => (
                                <li key={item}>{item}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                        {turn.review.recommendations.length ? (
                          <div className="review-recommendations-block">
                            <p className="review-group-title">
                              <strong>Recommended next changes</strong>
                            </p>
                            <ul className="review-bullet-list recommendations-list">
                              {turn.review.recommendations.map((item) => (
                                <li key={item}>{item}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
            {reviewPending ? (
              <div className="coach-message-item coach-message-item-coach">
                <div className="message-avatar coach-avatar" aria-hidden="true">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    width="12"
                    height="12"
                  >
                    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
                  </svg>
                </div>
                <div className="message-bubble-wrapper">
                  <div className="message-header-row">
                    <span className="message-sender-name">Career Coach</span>
                  </div>
                  <div className="message-bubble coach-bubble-thinking">
                    <span className="thinking-dot" />
                    <span className="thinking-dot" />
                    <span className="thinking-dot" />
                    <span className="thinking-text">Reviewing your base resume...</span>
                  </div>
                </div>
              </div>
            ) : null}
            <div ref={messagesEndRef} />
          </div>

          <div className="coach-quick-prompts-bar">
            {quickPrompts.map((item) => (
              <button
                key={item.label}
                type="button"
                className="coach-chip-btn"
                disabled={reviewPending || !draft}
                onClick={() => handleSendPrompt(item.prompt)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <form
            className="resume-coach-composer"
            onSubmit={(e) => {
              e.preventDefault();
              handleSendPrompt(inputValue);
            }}
          >
            <div className="composer-input-row">
              <textarea
                className="composer-textarea"
                aria-label="Message Career Coach"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendPrompt(inputValue);
                  }
                }}
                placeholder="Ask Career Coach about your resume, ATS readability, or interview prep..."
                disabled={reviewPending || !draft}
                rows={3}
              />
              <button
                type="submit"
                className="coach-send-button affirmative-action"
                disabled={reviewPending || !inputValue.trim() || !draft}
                aria-label="Send message"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  width="16"
                  height="16"
                  aria-hidden="true"
                >
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
