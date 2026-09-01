"use client";

import { useState } from "react";

export function ResumePdfPreview({ draftId }: { draftId: string }) {
  const [iframeLoading, setIframeLoading] = useState(true);
  const url = `/api/resume-drafts/${encodeURIComponent(draftId)}/pdf`;
  const texUrl = `/api/resume-drafts/${encodeURIComponent(draftId)}/tex`;

  return (
    <div className="resume-generated-pdf-frame">
      <div className="resume-pdf-viewport-container">
        {iframeLoading ? (
          <div className="resume-pdf-loading-overlay" aria-label="Loading PDF document">
            <div className="pdf-mini-spinner" />
            <span className="pdf-loading-text">Rendering base-resume.pdf…</span>
          </div>
        ) : null}
        <iframe
          className={`resume-generated-pdf-viewer ${iframeLoading ? "is-rendering" : "is-ready"}`}
          src={url}
          title="Generated base resume PDF preview"
          onLoad={() => setIframeLoading(false)}
        />
      </div>
      <div className="resume-preview-links">
        <a className="resume-generated-pdf-fallback" href={url} target="_blank" rel="noopener noreferrer">
          Open the generated resume PDF ↗
        </a>
        <a className="resume-generated-tex-link" href={texUrl} download="base-resume.tex">
          Download matching .tex source ↓
        </a>
      </div>
    </div>
  );
}
