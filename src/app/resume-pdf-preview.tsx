"use client";

import { useState } from "react";

export function ResumePdfPreview({ draftId }: { draftId: string }) {
  const [iframeLoading, setIframeLoading] = useState(true);
  const url = `/api/resume-drafts/${encodeURIComponent(draftId)}/pdf`;
  const texUrl = `/api/resume-drafts/${encodeURIComponent(draftId)}/tex`;

  return (
    <div className="resume-generated-pdf-frame">
      <div className="resume-pdf-toolbar">
        <div className="resume-pdf-title-block">
          <svg
            className="pdf-doc-icon"
            viewBox="0 0 20 20"
            fill="currentColor"
            width="15"
            height="15"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"
              clipRule="evenodd"
            />
          </svg>
          <span className="pdf-doc-name">base-resume.pdf</span>
        </div>
        <div className="resume-preview-links">
          <a
            className="resume-generated-pdf-fallback"
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            title="Open in new window"
          >
            Open in new tab ↗
          </a>
          <a
            className="resume-generated-tex-link"
            href={texUrl}
            download="base-resume.tex"
            title="Download TeX source file"
          >
            Download .tex ↓
          </a>
        </div>
      </div>
      <div className="resume-pdf-viewport-container">
        {iframeLoading ? (
          <div
            className="resume-pdf-loading-overlay"
            aria-label="Loading PDF document"
          >
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
    </div>
  );
}
