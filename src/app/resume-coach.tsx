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

const initialHandoff: MaterialDraftHandoffActionState = { status: "idle", summary: "" };
const initialGeneration: ResumeCoachActionState = { status: "idle", summary: "" };
const initialReview: ResumeCoachReviewActionState = { status: "idle", summary: "" };

export function ResumeCoach({
  available,
  unavailableReason,
  showSetupLink = false,
  initialDraft,
  generationNeeded = false,
  generationMessage,
  workspaceId,
}: {
  available: boolean;
  unavailableReason?: string;
  showSetupLink?: boolean;
  initialDraft?: MaterialDraftView;
  generationNeeded?: boolean;
  generationMessage?: string;
  workspaceId?: string;
}) {
  const router = useRouter();
  const [handoffState, handoffAction, handoffPending] = useActionState(materialDraftHandoffAction, initialHandoff);
  const [revisionState, revisionAction, revisionPending] = useActionState(generateBaseResumeAction, initialGeneration);
  const [reviewState, reviewAction, reviewPending] = useActionState(resumeCoachReviewAction, initialReview);
  const [dismissedDraftId, setDismissedDraftId] = useState<string | undefined>();
  const developmentMode = process.env.NODE_ENV === "development";

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
        <section className="resume-coach-unavailable" aria-labelledby="resume-coach-heading">
          <div className="resume-pane-head">
            <div>
              <p className="eyebrow">Resume Coach</p>
              <h2 id="resume-coach-heading">Resume Coach</h2>
            </div>
          </div>
          <div className="coach-notice-card">
            <p className="coach-notice-text">{unavailableReason ?? "Resume Coach is unavailable right now."}</p>
            {showSetupLink ? (
              <Link className="resume-coach-setup-link affirmative-action" href="/settings">
                Set up local AI
              </Link>
            ) : null}
          </div>
        </section>
        <section className="resume-generated-preview" aria-labelledby="resume-generated-preview-heading">
          <div className="resume-pane-head">
            <div>
              <p className="eyebrow">Reviewable preview</p>
              <h2 id="resume-generated-preview-heading">Resume</h2>
            </div>
          </div>
          <div className="resume-preview-empty-state">
            <p className="resume-preview-empty" role="status">
              Your base resume appears here automatically once onboarding has saved your profile and documented work.
            </p>
          </div>
        </section>
      </div>
    );
  }

  const activeDraftId = initialDraft?.id;
  const proposalVisible = Boolean(activeDraftId && activeDraftId !== dismissedDraftId);
  const isGenerating = revisionPending || (Boolean(generationMessage) && !generationMessage?.startsWith("Your resume has not been generated"));

  return (
    <div className="resume-coach-preview-layout">
      <section className="resume-coach-unavailable" aria-labelledby="resume-coach-heading">
        <div className="resume-pane-head">
          <div>
            <p className="eyebrow">AI Advisor</p>
            <h2 id="resume-coach-heading">Resume Coach</h2>
          </div>
        </div>
        <div className="coach-intro-content">
          <p className="coach-lead-text">
            Your local employer-side reviewer and Resume Coach independently reviews the generated resume against every documented Experience &amp; Project. It identifies strengths, missing proof, weak wording, and the highest-value revisions; it does not rebuild the resume on every visit.
          </p>
          <p className="resume-context">
            The base resume is generated automatically during onboarding, then only again after a material change. Job-specific tailoring will use this same evidence base when you add a job listing.
          </p>
        </div>

        {initialDraft ? (
          <>
            <form action={reviewAction} className="resume-coach-request" aria-busy={reviewPending}>
              <input type="hidden" name="draftId" value={initialDraft.id} />
              <div className="coach-form-group">
                <label htmlFor="coach-focus" className="coach-form-label">
                  What should the coach focus on?
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
              <button type="submit" disabled={reviewPending} className="coach-submit-button">
                {reviewPending ? "Reviewing…" : "Ask Resume Coach"}
              </button>
            </form>

            {reviewState.status !== "idle" ? (
              <div
                className={reviewState.status === "error" ? "status status-error review-results-card" : "status review-results-card"}
                role="status"
                aria-live="polite"
              >
                <p className="review-summary-headline">{reviewState.summary}</p>
                {reviewState.review ? (
                  <div className="review-detailed-breakdown">
                    <p className="review-group-title"><strong>Objective ratings</strong></p>
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
                        <p className="review-group-title"><strong>Concerns</strong></p>
                        <ul className="review-bullet-list concerns-list">
                          {reviewState.review.concerns.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {reviewState.review.recommendations.length ? (
                      <div className="review-recommendations-block">
                        <p className="review-group-title"><strong>Recommended next changes</strong></p>
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

      <section className="resume-generated-preview" aria-labelledby="resume-generated-preview-heading">
        <div className="resume-pane-head">
          <div>
            <p className="eyebrow">Reviewable preview</p>
            <h2 id="resume-generated-preview-heading">Resume</h2>
          </div>
          {proposalVisible ? (
            <span className="preview-status-pill" aria-label="Status: Document compiled">
              ✓ Document compiled
            </span>
          ) : null}
        </div>

        {proposalVisible ? (
          <>
            <ResumePdfPreview draftId={activeDraftId!} />
            <div className="material-draft-actions">
              <p className="draft-origin-note">
                Generated from your saved profile and all documented work findings. The Resume template is unchanged.
              </p>
              {handoffState.status === "success" && handoffState.draftId === activeDraftId ? (
                <Link className="affirmative-action review-draft-link" href={`/resume/drafts/${activeDraftId}`}>
                  Review base resume
                </Link>
              ) : (
                <form action={handoffAction} aria-busy={handoffPending}>
                  <input type="hidden" name="draftId" value={activeDraftId} />
                  <button className="affirmative-action" type="submit" disabled={handoffPending}>
                    {handoffPending ? "Opening base resume..." : "Review base resume"}
                  </button>
                </form>
              )}
              <form action={revisionAction} aria-busy={revisionPending} className="revision-request-form">
                <input type="hidden" name="generationCommand" value="revision" />
                <input type="hidden" name="workspaceId" value={workspaceId ?? ""} />
                <button type="submit" disabled={revisionPending} className="revision-submit-button">
                  {revisionPending ? "Regenerating resume…" : "Regenerate resume"}
                </button>
              </form>
              {revisionState.status !== "idle" ? (
                <p role="status" aria-live="polite" className={revisionState.status === "error" ? "status status-error" : "status"}>
                  {revisionState.summary}
                </p>
              ) : null}
              <button type="button" className="neutral-action keep-current-btn" onClick={() => setDismissedDraftId(activeDraftId!)}>
                Keep current
              </button>
              {handoffState.status !== "idle" ? (
                <p role="status" aria-live="polite" aria-atomic="true" className={handoffState.status === "error" ? "status status-error" : "status"}>
                  {handoffState.summary}
                </p>
              ) : null}
            </div>
          </>
        ) : isGenerating ? (
          <div className="resume-preview-loading-card" role="status" aria-live="polite">
            <div className="loading-spinner-wrap">
              <div className="loading-spinner" />
            </div>
            <div className="loading-copy-block">
              <h3 className="loading-heading">Compiling base resume…</h3>
              <p className="resume-preview-empty loading-active-message">
                {generationMessage || "Synthesizing your documented experience and compiling LaTeX preview..."}
              </p>
            </div>
            <div className="loading-progress-bar-container">
              <div className="loading-progress-shimmer" />
            </div>
            <span className="loading-privacy-tag">
              🔒 Running privately on local AI engine
            </span>
          </div>
        ) : (
          <div className="resume-preview-empty-card">
            <div className="empty-card-icon" aria-hidden="true">📄</div>
            <p
              className={generationMessage?.startsWith("Your resume") ? "resume-preview-empty status status-error" : "resume-preview-empty"}
              role="status"
              aria-live="polite"
            >
              {generationMessage ?? (generationNeeded ? "Your resume needs generation from the documented work." : "Your base resume has not been generated yet.")}
            </p>
            {generationNeeded ? (
              <form action={revisionAction} aria-busy={revisionPending} className="empty-generate-form">
                <input type="hidden" name="generationCommand" value="initial" />
                <input type="hidden" name="workspaceId" value={workspaceId ?? ""} />
                <button className="affirmative-action" type="submit" disabled={revisionPending}>
                  {revisionPending ? "Generating resume…" : "Generate resume"}
                </button>
                {revisionState.status !== "idle" ? (
                  <p role="status" aria-live="polite" className={revisionState.status === "error" ? "status status-error" : "status"}>
                    {revisionState.summary}
                  </p>
                ) : null}
              </form>
            ) : null}
          </div>
        )}

        {developmentMode && proposalVisible ? (
          <form className="material-draft-actions dev-regen-form" action={revisionAction} aria-busy={revisionPending}>
            <input type="hidden" name="generationCommand" value="initial" />
            <input type="hidden" name="workspaceId" value={workspaceId ?? ""} />
            <button type="submit" disabled={revisionPending} className="dev-regen-button">
              {revisionPending ? "Generating resume…" : "Generate resume (development)"}
            </button>
          </form>
        ) : null}
      </section>
    </div>
  );
}
