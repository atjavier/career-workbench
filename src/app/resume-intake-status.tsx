"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { readResumeEvidenceIntakeStatusAction } from "@/app/actions";

export function ResumeIntakeStatus({
  workspaceId,
  initialMessage,
  initialStatus = "running",
}: {
  workspaceId: string;
  initialMessage: string;
  initialStatus?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState(initialMessage);
  const [status, setStatus] = useState(initialStatus);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(2);

  // Timer for elapsed seconds and visual pipeline step progression
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (status === "failed") return;
    if (elapsedSeconds > 3 && activeStep === 1) setActiveStep(2);
    if (elapsedSeconds > 7 && activeStep === 2) setActiveStep(3);
  }, [elapsedSeconds, activeStep, status]);

  // Live Auto-Polling loop
  useEffect(() => {
    if (status === "ready" || status === "failed") return;

    let mounted = true;
    const interval = setInterval(async () => {
      try {
        const result = await readResumeEvidenceIntakeStatusAction(workspaceId);
        if (!mounted) return;
        if (result.message) {
          setMessage(result.message);
        }
        setStatus(result.status);

        if (result.isComplete) {
          setStatus("ready");
          clearInterval(interval);
          startTransition(() => {
            router.refresh();
          });
        } else if (result.failed) {
          setStatus("failed");
          clearInterval(interval);
        }
      } catch {
        // network/storage error fallback, retry on next interval
      }
    }, 1200);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [workspaceId, status, router]);

  const handleManualRefresh = () => {
    startTransition(async () => {
      const result = await readResumeEvidenceIntakeStatusAction(workspaceId);
      if (result.message) setMessage(result.message);
      setStatus(result.status);
      if (result.isComplete) {
        router.refresh();
      }
    });
  };

  const isComplete = status === "ready";
  const isFailed = status === "failed";

  return (
    <section
      className="intake-processing-card card-surface panel"
      aria-labelledby="intake-processing-title"
      aria-busy={!isComplete && !isFailed}
    >
      <div className="intake-card-header">
        <div className="intake-header-main">
          <div className="intake-live-indicator">
            <span
              className={`status-beacon ${
                isComplete
                  ? "beacon-success"
                  : isFailed
                    ? "beacon-error"
                    : "beacon-active"
              }`}
              aria-hidden="true"
            />
            <span className="intake-eyebrow">
              {isComplete
                ? "Analysis Complete"
                : isFailed
                  ? "Processing Issue"
                  : "Local AI Evidence Intake"}
            </span>
          </div>
          <h2 id="intake-processing-title" className="intake-heading">
            {isComplete
              ? "Evidence Processed Successfully"
              : isFailed
                ? "Evidence Intake Needed Attention"
                : "Analyzing Your Project & Experience Folders"}
          </h2>
        </div>
        <div className="intake-time-pill" title="Elapsed processing duration">
          <span className="time-icon" aria-hidden="true">⏱</span>
          <span>{elapsedSeconds}s elapsed</span>
        </div>
      </div>

      <div className="intake-pipeline-grid">
        <div
          className={`pipeline-step ${
            activeStep >= 1 ? "step-active" : "step-pending"
          } ${activeStep > 1 || isComplete ? "step-done" : ""}`}
        >
          <div className="step-icon-bubble">
            {activeStep > 1 || isComplete ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            ) : (
              <span className="step-num">1</span>
            )}
          </div>
          <div className="step-copy">
            <span className="step-title">Folder Snapshot</span>
            <span className="step-detail">Bounded safety check</span>
          </div>
        </div>

        <div
          className={`pipeline-step ${
            activeStep >= 2 ? "step-active" : "step-pending"
          } ${activeStep > 2 || isComplete ? "step-done" : ""}`}
        >
          <div className="step-icon-bubble">
            {activeStep > 2 || isComplete ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            ) : (
              <span className="step-num">2</span>
            )}
          </div>
          <div className="step-copy">
            <span className="step-title">Evidence Extraction</span>
            <span className="step-detail">Parsing verified facts</span>
          </div>
        </div>

        <div
          className={`pipeline-step ${
            activeStep >= 3 || isComplete ? "step-active" : "step-pending"
          } ${isComplete ? "step-done" : ""}`}
        >
          <div className="step-icon-bubble">
            {isComplete ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            ) : (
              <span className="step-num">3</span>
            )}
          </div>
          <div className="step-copy">
            <span className="step-title">Coach Interview</span>
            <span className="step-detail">Synthesizing questions</span>
          </div>
        </div>
      </div>

      <div className="intake-status-body">
        <div className="intake-progress-container" aria-hidden="true">
          <div
            className={`intake-progress-bar ${
              isComplete
                ? "progress-complete"
                : isFailed
                  ? "progress-failed"
                  : "progress-animating"
            }`}
          />
        </div>

        <div className="intake-message-row">
          <div className="intake-message-wrap">
            <p role="status" aria-live="polite" className="intake-live-message">
              {message}
            </p>
            <p className="intake-subtext">
              Your offline local AI is scanning source files directly on this device.
              No raw folder paths or source code leave your machine.
            </p>
          </div>

          <button
            type="button"
            className="secondary-action refresh-status-button"
            onClick={handleManualRefresh}
            disabled={isPending}
            title="Check current intake status"
          >
            <svg
              className={isPending ? "spin-animation" : ""}
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
              <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
              <path d="M16 21h5v-5" />
            </svg>
            <span>{isPending ? "Checking..." : "Refresh status"}</span>
          </button>
        </div>

        {isFailed ? (
          <div className="intake-recovery-box">
            <p className="intake-recovery-text">
              Your saved work is recoverable. Return to this resume when you can restart evidence intake.
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
