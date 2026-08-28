"use client";

export function ResumePdfPreview({ draftId }: { draftId: string }) {
  const url = `/api/resume-drafts/${encodeURIComponent(draftId)}/pdf`;
  const texUrl = `/api/resume-drafts/${encodeURIComponent(draftId)}/tex`;
  return <div className="resume-generated-pdf-frame">
    <iframe className="resume-generated-pdf-viewer" src={url} title="Generated base resume PDF preview" />
    <div className="resume-preview-links">
      <a className="resume-generated-pdf-fallback" href={url} target="_blank" rel="noopener noreferrer">Open the generated resume PDF</a>
      <a className="resume-generated-tex-link" href={texUrl} download="base-resume.tex">Download matching .tex source</a>
    </div>
  </div>;
}
