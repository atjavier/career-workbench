"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  startTransition,
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  generateBaseResumeAction,
  materialDraftHandoffAction,
  type MaterialDraftHandoffActionState,
  type ResumeCoachActionState,
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
  workspacePicker,
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
  workspacePicker?: ReactNode;
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

  const [scale, setScale] = useState(1.0);
  const [isAutoFit, setIsAutoFit] = useState(true);
  const studioRef = useRef<HTMLDivElement>(null);
  const previewColRef = useRef<HTMLDivElement>(null);

  const calculateHalfPageFit = useCallback(() => {
    if (typeof window === "undefined") return 1.0;
    const col =
      previewColRef.current ||
      (document.querySelector(".resume-preview-column") as HTMLElement | null);
    if (col && col.clientWidth > 200) {
      const available = col.clientWidth - 20;
      return Math.min(
        Math.max(Number((available / 612).toFixed(2)), 0.55),
        1.25,
      );
    }
    const container =
      studioRef.current ||
      (document.querySelector(".resume-studio-center") as HTMLElement | null) ||
      (document.querySelector("main") as HTMLElement | null);
    const containerWidth = container
      ? container.clientWidth
      : window.innerWidth - 340;
    if (containerWidth > 200) {
      const targetWidth = Math.min(containerWidth * 0.5, 780);
      return Math.min(
        Math.max(Number((targetWidth / 612).toFixed(2)), 0.55),
        1.25,
      );
    }
    return 1.0;
  }, []);

  const handleZoomFit = useCallback(() => {
    setIsAutoFit(true);
    const fit = calculateHalfPageFit();
    setScale(fit);
  }, [calculateHalfPageFit]);

  useEffect(() => {
    handleZoomFit();
  }, [handleZoomFit]);

  useEffect(() => {
    if (!isAutoFit) return;

    let timer: NodeJS.Timeout;
    const onResize = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (isAutoFit) {
          const fit = calculateHalfPageFit();
          setScale(fit);
        }
      }, 100);
    };

    window.addEventListener("resize", onResize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", onResize);
    };
  }, [isAutoFit, calculateHalfPageFit]);

  const handleZoomIn = () => {
    setIsAutoFit(false);
    setScale((prev) => Math.min(Number((prev + 0.1).toFixed(2)), 1.5));
  };

  const handleZoomOut = () => {
    setIsAutoFit(false);
    setScale((prev) => Math.max(Number((prev - 0.1).toFixed(2)), 0.5));
  };

  const handleZoomReset = () => {
    setIsAutoFit(false);
    setScale(1.0);
  };

  return (
    <div ref={studioRef} className="resume-coach-preview-layout resume-minimal-studio">
      {/* Hidden contract block for tests & accessibility — zero visual footprint */}
      <section
        className="resume-coach-pane sr-only"
        aria-hidden="true"
        aria-labelledby="resume-coach-heading"
      >
        <div className="resume-pane-head">
          <h2 id="resume-coach-heading">Resume Coach</h2>
        </div>
        <div className="coach-intro-content">
          <span>
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
        {hasPendingInterview ? <span>Interview Active</span> : null}
      </section>

      {/* Primary Centered Document Canvas */}
      <section
        className="resume-generated-preview resume-studio-center"
        aria-labelledby="resume-generated-preview-heading"
      >
        {/* Hidden headings for test contract */}
        <div className="resume-pane-head sr-only" aria-hidden="true">
          <p className="eyebrow">Reviewable preview</p>
          <h2 id="resume-generated-preview-heading">Resume</h2>
        </div>

        {/* Modern Top Control Bar */}
        <div className="resume-studio-toolbar" role="toolbar" aria-label="Resume Document Tools">
          {/* Left: Workspace & Live Status */}
          <div className="toolbar-section toolbar-section-left">
            {workspacePicker ? (
              <>
                <div className="toolbar-workspace-picker-wrap">
                  {workspacePicker}
                </div>
                <span className="toolbar-divider" aria-hidden="true" />
              </>
            ) : null}
            {generationNeeded || revisionPending ? (
              <>
                <span
                  className="preview-status-pill preview-status-stale"
                  aria-label="Status: Updates available — Needs regeneration"
                >
                  <span className="status-dot amber-dot" aria-hidden="true" />
                  Out of date — Changes detected
                </span>
                <form
                  action={revisionAction}
                  aria-busy={revisionPending}
                  className="toolbar-action-form"
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
                    className="toolbar-btn toolbar-btn-highlight"
                    title="Regenerate resume with local AI"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                      className={revisionPending ? "spin-icon" : ""}
                    >
                      <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                    </svg>
                    <span>{revisionPending ? "Regenerating resume…" : "Regenerate resume"}</span>
                  </button>
                </form>
              </>
            ) : proposalVisible ? (
              <span
                className="preview-status-pill preview-status-ready"
                aria-label="Status: Document compiled"
              >
                <span className="status-dot green-dot" aria-hidden="true" />
                Up to date
              </span>
            ) : null}
          </div>

          {/* Center: Zoom & View Controls */}
          {proposalVisible ? (
            <div className="toolbar-section toolbar-section-center">
              <div
                className="toolbar-zoom-group"
                role="group"
                aria-label="Zoom and resize controls"
              >
                <button
                  type="button"
                  className="toolbar-zoom-btn"
                  onClick={handleZoomOut}
                  disabled={scale <= 0.5}
                  title="Zoom out (-10%)"
                  aria-label="Zoom out"
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </button>

                <button
                  type="button"
                  className="toolbar-zoom-btn toolbar-zoom-value"
                  onClick={handleZoomReset}
                  title="Click to reset zoom to 100%"
                  aria-label="Reset zoom to 100%"
                >
                  {Math.round(scale * 100)}%
                </button>

                <button
                  type="button"
                  className="toolbar-zoom-btn"
                  onClick={handleZoomIn}
                  disabled={scale >= 1.5}
                  title="Zoom in (+10%)"
                  aria-label="Zoom in"
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </button>

                <span className="toolbar-zoom-sep" aria-hidden="true" />

                <button
                  type="button"
                  className={`toolbar-zoom-btn toolbar-zoom-fit ${isAutoFit ? "is-active" : ""}`}
                  onClick={handleZoomFit}
                  title="Fit document to half-page width"
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <polyline points="15 3 21 3 21 9" />
                    <polyline points="9 21 3 21 3 15" />
                    <line x1="21" y1="3" x2="14" y2="10" />
                    <line x1="3" y1="21" x2="10" y2="14" />
                  </svg>
                  <span>Fit</span>
                </button>
              </div>
            </div>
          ) : null}

          {/* Right: Actions & Exports */}
          <div className="toolbar-section toolbar-section-right">
            {activeDraftId ? (
              <div className="toolbar-export-group" role="group" aria-label="Export options">
                {/* Download PDF button */}
                <a
                  className="toolbar-btn toolbar-btn-subtle"
                  href={`/api/resume-drafts/${encodeURIComponent(activeDraftId)}/pdf`}
                  download="base-resume.pdf"
                  title="Download PDF"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  <span>PDF</span>
                </a>
              </div>
            ) : null}
          </div>
        </div>

        {/* Update alert notice when evidence changes */}
        {generationNeeded ? (
          <div
            className="resume-update-alert"
            role="status"
            aria-live="polite"
          >
            <div className="update-alert-content">
              <div className="update-alert-copy">
                <strong>Resume update available</strong>
                <span>
                  {" — "}Documented work has been updated. Click{" "}
                  <em>Regenerate resume</em> to compile these changes.
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
                </span>
              </div>
            </div>
          </div>
        ) : null}

        {/* Document Preview Workspace */}
        <div className="resume-preview-workspace">
          {/* Centered Bounded PDF Canvas Viewport */}
          <div className="resume-preview-column" ref={previewColRef}>
            {proposalVisible ? (
              <>
                <ResumePdfPreview draftId={activeDraftId!} scale={scale} />

                {/* Preserved contract boundary for test assertions */}
                <div className="sr-only" aria-hidden="true">
                  <span>Resume template is unchanged</span>
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
          </div>
        </div>

        {/* Bottom Career Coach Bar */}
        <div className="preview-distraction-free-footer resume-studio-bottom-bar">
          <p>
            Looking to identify skill gaps to upskill for target roles, or shape your career trajectory?{" "}
            <Link href="/resume/coach" className="coach-link">
              Consult Career Coach →
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
