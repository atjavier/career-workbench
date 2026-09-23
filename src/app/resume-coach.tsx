"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";

import {
  generateBaseResumeAction,
  materialDraftHandoffAction,
  resumeCoachReviewAction,
  type MaterialDraftHandoffActionState,
  type ResumeCoachActionState,
  type ResumeCoachReviewActionState,
} from "@/app/actions";
import type { MaterialDraftView } from "@/domain/resume-generation/material-draft-commands";
import { ResumePdfPreview } from "@/app/resume-pdf-preview";

const initialHandoff: MaterialDraftHandoffActionState = {
  status: "idle",
  summary: "",
};
const initialGeneration: ResumeCoachActionState = {
  status: "idle",
  summary: "",
};
const initialReview: ResumeCoachReviewActionState = {
  status: "idle",
  summary: "",
};

export function ResumeCoach({
  available,
  unavailableReason,
  showSetupLink = false,
  initialDraft,
  generationNeeded = false,
  hasPendingInterview = false,
  generationMessage,
  workspaceId,
  latestTexRevisionId,
}: {
  available: boolean;
  unavailableReason?: string;
  showSetupLink?: boolean;
  initialDraft?: MaterialDraftView;
  generationNeeded?: boolean;
  hasPendingInterview?: boolean;
  generationMessage?: string;
  workspaceId?: string;
  latestTexRevisionId?: string;
}) {
  const router = useRouter();
  const [handoffState, handoffAction, handoffPending] = useActionState(
    materialDraftHandoffAction,
    initialHandoff,
  );
  const [revisionState, revisionAction, revisionPending] = useActionState(
    generateBaseResumeAction,
    initialGeneration,
  );
  const [reviewState, reviewAction, reviewPending] = useActionState(
    resumeCoachReviewAction,
    initialReview,
  );
  const [dismissedDraftId, setDismissedDraftId] = useState<
    string | undefined
  >();
  const effectiveTexRevisionId =
    revisionState.texRevisionId ?? latestTexRevisionId;

  useEffect(() => {
    if (!generationMessage) return;
    const timer = window.setInterval(() => router.refresh(), 3_000);
    return () => window.clearInterval(timer);
  }, [generationMessage, router]);

  useEffect(() => {
    if (revisionState.status === "success") router.refresh();
  }, [revisionState.status, router]);

  if (!available) {
    return (
      <div className="resume-coach-preview-layout">
        <section
          className="resume-coach-unavailable"
          aria-labelledby="resume-coach-heading"
        >
          <div className="resume-pane-head">
            <div>
              <p className="eyebrow">Resume Coach</p>
              <h2 id="resume-coach-heading">Resume Coach</h2>
            </div>
          </div>
          <div className="coach-notice-card">
            <p className="coach-notice-text">
              {unavailableReason ?? "Resume Coach is unavailable right now."}
            </p>
            {showSetupLink ? (
              <Link
                className="resume-coach-setup-link affirmative-action"
                href="/settings"
              >
                Set up local AI
              </Link>
            ) : null}
          </div>
        </section>
        <section
          className="resume-generated-preview"
          aria-labelledby="resume-generated-preview-heading"
        >
          <div className="resume-pane-head">
            <div>
              <p className="eyebrow">Reviewable preview</p>
              <h2 id="resume-generated-preview-heading">Resume</h2>
            </div>
          </div>
          <div className="resume-preview-empty-state">
            <p className="resume-preview-empty" role="status">
              Your base resume appears here automatically once onboarding has
              saved your profile and documented work.
            </p>
          </div>
        </section>
      </div>
    );
  }

  const activeDraftId = revisionState.draftId ?? initialDraft?.id;
  const proposalVisible = Boolean(
    activeDraftId && activeDraftId !== dismissedDraftId,
  );
  const isGenerating =
    revisionPending ||
    (Boolean(generationMessage) &&
      !generationMessage?.startsWith("Your resume has not been generated"));

  return (
    <div className="resume-coach-preview-layout">
      <section
        className="resume-coach-unavailable"
        aria-labelledby="resume-coach-heading"
      >
        <div className="resume-pane-head">
          <div>
            <p className="eyebrow">AI Advisor</p>
            <h2 id="resume-coach-heading">Resume Coach</h2>
          </div>
        </div>
        <div className="coach-intro-content">
          <span className="sr-only">
            Your local employer-side reviewer and Resume Coach independently
            reviews the generated resume against every documented Experience
            &amp; Project. It identifies strengths, missing proof, weak wording,
            and the highest-value revisions; it does not rebuild the resume on
            every visit.
          </span>
          <p className="coach-lead-text">
            Evidence-backed critique, ATS readability audit, and strategic guidance
            for your base resume.
          </p>
        </div>

        {initialDraft ? (
          <>
            <form
              action={reviewAction}
              className="resume-coach-request"
              aria-busy={reviewPending}
            >
              <input type="hidden" name="draftId" value={initialDraft.id} />
              <div className="coach-form-group">
                <label htmlFor="coach-focus" className="coach-form-label">
                  Review focus
                </label>
                <textarea
                  id="coach-focus"
                  name="coachFocus"
                  rows={3}
                  maxLength={900}
                  defaultValue="General review: clarity, relevance, credibility, specificity, and ATS readability."
                  className="coach-textarea"
                />
              </div>
              <button
                type="submit"
                disabled={reviewPending}
                className="coach-submit-button coach-start-button affirmative-action"
              >
                <span className="coach-start-button-label">
                  {reviewPending ? "Reviewing resume…" : "Start Resume Coach"}
                </span>
                <span className="coach-start-button-arrow" aria-hidden="true">
                  →
                </span>
              </button>
            </form>

            {hasPendingInterview ? (
              <div className="coach-interview-callout">
                <div className="coach-interview-callout-copy">
                  <span className="coach-interview-badge">Interview Active</span>
                  <p>
                    Answer coach clarification questions to verify your achievements.
                  </p>
                </div>
                <Link
                  href="/resume/interview"
                  className="coach-interview-callout-link secondary-action"
                >
                  Go to Coach Q&amp;A →
                </Link>
              </div>
            ) : null}

            {reviewState.status !== "idle" ? (
              <div
                className={
                  reviewState.status === "error"
                    ? "status status-error review-results-card"
                    : "status review-results-card"
                }
                role="status"
                aria-live="polite"
              >
                <p className="review-summary-headline">{reviewState.summary}</p>
                {reviewState.review ? (
                  <div className="review-detailed-breakdown">
                    <p className="review-group-title">
                      <strong>Objective ratings</strong>
                    </p>
                    <ul className="review-ratings-list">
                      {reviewState.review.ratings.map((rating) => (
                        <li key={rating.area} className="review-rating-item">
                          <span className="rating-pill">{rating.score}/5</span>
                          <div className="rating-copy">
                            <strong>{rating.area}</strong> — {rating.rationale}
                          </div>
                        </li>
                      ))}
                    </ul>
                    {reviewState.review.concerns.length ? (
                      <div className="review-concerns-block">
                        <p className="review-group-title">
                          <strong>Concerns</strong>
                        </p>
                        <ul className="review-bullet-list concerns-list">
                          {reviewState.review.concerns.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {reviewState.review.recommendations.length ? (
                      <div className="review-recommendations-block">
                        <p className="review-group-title">
                          <strong>Recommended next changes</strong>
                        </p>
                        <ul className="review-bullet-list recommendations-list">
                          {reviewState.review.recommendations.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </>
        ) : null}
      </section>

      <section
        className="resume-generated-preview"
        aria-labelledby="resume-generated-preview-heading"
      >
        <div className="resume-pane-head">
          <div>
            <p className="eyebrow">Reviewable preview</p>
            <h2 id="resume-generated-preview-heading">Resume</h2>
          </div>
          {generationNeeded ? (
            <span
              className="preview-status-pill preview-status-stale"
              aria-label="Status: Updates available — Needs regeneration"
            >
              Out of date — Changes detected
            </span>
          ) : proposalVisible ? (
            <span
              className="preview-status-pill"
              aria-label="Status: Document compiled"
            >
              Document compiled
            </span>
          ) : null}
        </div>

        {proposalVisible ? (
          <>
            {generationNeeded ? (
              <div
                className="resume-update-alert"
                role="status"
                aria-live="polite"
              >
                <div className="update-alert-content">
                  <div className="update-alert-copy">
                    <strong>Resume update available</strong>
                    <p>
                      Documented work has been updated or removed from your experiences and
                      projects. Click <em>Regenerate resume</em> below to compile
                      these updates into your base resume.
                      {hasPendingInterview ? (
                        <>
                          {" "}
                          You can also answer pending questions in{" "}
                          <Link href="/resume/interview" className="interview-link">
                            Coach Q&A
                          </Link>
                          .
                        </>
                      ) : null}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
            <ResumePdfPreview draftId={activeDraftId!} />
            <div className="material-draft-actions">
              <p className="draft-origin-note">
                Generated from your saved profile and all documented work
                findings. The Resume template is unchanged.
              </p>
              {/* Preserved contract boundary */}
              <div className="sr-only" aria-hidden="true">
                {handoffState.status === "success" &&
                handoffState.draftId === activeDraftId ? (
                  <Link
                    className="affirmative-action review-draft-link"
                    href={`/resume/drafts/${activeDraftId}`}
                  >
                    Review base resume
                  </Link>
                ) : (
                  <form action={handoffAction} aria-busy={handoffPending}>
                    <input type="hidden" name="draftId" value={activeDraftId} />
                    <button
                      className="affirmative-action"
                      type="submit"
                      disabled={handoffPending}
                    >
                      {handoffPending
                        ? "Opening base resume..."
                        : "Review base resume"}
                    </button>
                  </form>
                )}
                <button
                  type="button"
                  className="neutral-action keep-current-btn"
                  onClick={() => setDismissedDraftId(activeDraftId!)}
                >
                  Keep current
                </button>
              </div>
              {effectiveTexRevisionId ? (
                <div className="tex-draft-ready-links">
                  <Link
                    href={`/api/tex-drafts/${effectiveTexRevisionId}/pdf`}
                    target="_blank"
                    className="affirmative-action"
                  >
                    Review PDF
                  </Link>
                  <a
                    href={`/api/tex-drafts/${effectiveTexRevisionId}/tex`}
                    className="affirmative-action"
                  >
                    Download TeX
                  </a>
                </div>
              ) : null}
              <form
                action={revisionAction}
                aria-busy={revisionPending}
                className="revision-request-form"
              >
                <input
                  type="hidden"
                  name="generationCommand"
                  value="revision"
                />
                <input
                  type="hidden"
                  name="workspaceId"
                  value={workspaceId ?? ""}
                />
                <button
                  type="submit"
                  disabled={revisionPending}
                  className="revision-submit-button"
                >
                  {revisionPending
                    ? "Regenerating resume…"
                    : "Regenerate resume"}
                </button>
              </form>
              {revisionState.status !== "idle" ? (
                <p
                  role="status"
                  aria-live="polite"
                  className={
                    revisionState.status === "error"
                      ? "status status-error"
                      : "status"
                  }
                >
                  {revisionState.summary}
                </p>
              ) : null}
              {handoffState.status !== "idle" ? (
                <p
                  role="status"
                  aria-live="polite"
                  aria-atomic="true"
                  className={
                    handoffState.status === "error"
                      ? "status status-error"
                      : "status"
                  }
                >
                  {handoffState.summary}
                </p>
              ) : null}
            </div>
          </>
        ) : isGenerating ? (
          <div
            className="resume-preview-loading-card"
            role="status"
            aria-live="polite"
          >
            <div className="loading-spinner-wrap">
              <div className="loading-spinner" />
            </div>
            <div className="loading-copy-block">
              <h3 className="loading-heading">Compiling base resume…</h3>
              <p className="resume-preview-empty loading-active-message">
                {generationMessage ||
                  "Synthesizing your documented experience and compiling LaTeX preview..."}
              </p>
            </div>
            <div className="loading-progress-bar-container">
              <div className="loading-progress-shimmer" />
            </div>
            <span className="loading-privacy-tag">
              Running privately on local AI engine
            </span>
          </div>
        ) : (
          <div className="resume-preview-empty-card">
            <p
              className={
                generationMessage?.startsWith("Your resume")
                  ? "resume-preview-empty status status-error"
                  : "resume-preview-empty"
              }
              role="status"
              aria-live="polite"
            >
              {generationMessage ??
                (generationNeeded
                  ? "Changes detected — your resume needs to be regenerated from the updated documented work."
                  : "Your base resume has not been generated yet.")}
            </p>
            {generationNeeded ? (
              <form
                action={revisionAction}
                aria-busy={revisionPending}
                className="empty-generate-form"
              >
                <input type="hidden" name="generationCommand" value="initial" />
                <input
                  type="hidden"
                  name="workspaceId"
                  value={workspaceId ?? ""}
                />
                <button
                  className="affirmative-action"
                  type="submit"
                  disabled={revisionPending}
                >
                  {revisionPending ? "Generating resume…" : "Generate resume"}
                </button>
                {revisionState.status !== "idle" ? (
                  <p
                    role="status"
                    aria-live="polite"
                    className={
                      revisionState.status === "error"
                        ? "status status-error"
                        : "status"
                    }
                  >
                    {revisionState.summary}
                  </p>
                ) : null}
              </form>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
