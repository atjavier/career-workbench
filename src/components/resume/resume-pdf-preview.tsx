"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist/legacy/build/pdf.mjs";

interface ResumePdfPreviewProps {
  draftId: string;
  scale?: number;
}

interface PdfPageCanvasProps {
  pageNum: number;
  pdfDoc: PDFDocumentProxy;
  scale: number;
}

function PdfPageCanvas({
  pageNum,
  pdfDoc,
  scale,
}: PdfPageCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;

    async function renderPage() {
      if (!canvasRef.current || !pdfDoc) return;

      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // ignore previous cancelled task
        }
      }

      try {
        const page = await pdfDoc.getPage(pageNum);
        if (cancelled || !canvasRef.current) return;

        const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
        const viewport = page.getViewport({ scale: scale * dpr });
        const logicalViewport = page.getViewport({ scale });

        const canvas = canvasRef.current;
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = `${Math.floor(logicalViewport.width)}px`;
        canvas.style.height = `${Math.floor(logicalViewport.height)}px`;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const renderTask = page.render({
          canvas,
          canvasContext: ctx,
          viewport,
        });
        renderTaskRef.current = renderTask;

        await renderTask.promise;
      } catch (err: any) {
        if (err?.name !== "RenderingCancelledException") {
          console.error(`Page ${pageNum} render error:`, err);
        }
      }
    }

    renderPage();

    return () => {
      cancelled = true;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // ignore
        }
      }
    };
  }, [pageNum, pdfDoc, scale]);

  return (
    <div
      className="pdf-paper-sheet"
      aria-label={`Resume Page ${pageNum}`}
      style={{
        width: `${Math.floor(612 * scale)}px`,
        height: `${Math.floor(792 * scale)}px`,
      }}
    >
      <canvas ref={canvasRef} className="pdf-page-canvas" />
    </div>
  );
}

export function ResumePdfPreview({
  draftId,
  scale = 1.0,
}: ResumePdfPreviewProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isCancelled = false;
    const abortController = new AbortController();

    async function loadPdf() {
      setLoading(true);
      setError(null);

      try {
        const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
        if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
          pdfjsLib.GlobalWorkerOptions.workerSrc = "/api/pdf-worker";
        }

        const url = `/api/resume-drafts/${encodeURIComponent(draftId)}/pdf`;
        const res = await fetch(url, { signal: abortController.signal });

        if (!res.ok) {
          if (res.status === 409) {
            throw new Error(
              "Resume template has changed. Please click Regenerate resume.",
            );
          }
          throw new Error("Base resume document is unavailable.");
        }

        const arrayBuffer = await res.arrayBuffer();
        if (isCancelled) return;

        const loadingTask = pdfjsLib.getDocument({
          data: new Uint8Array(arrayBuffer),
        });

        const doc = await loadingTask.promise;
        if (isCancelled) return;

        setPdfDoc(doc);
        setLoading(false);
      } catch (err: any) {
        if (isCancelled || err?.name === "AbortError") return;
        setError(err?.message || "Failed to render PDF preview.");
        setLoading(false);
      }
    }

    loadPdf();

    return () => {
      isCancelled = true;
      abortController.abort();
    };
  }, [draftId]);

  const numPages = pdfDoc?.numPages || 1;

  return (
    <div
      className="resume-pdf-viewport-container custom-pdf-preview-container"
      ref={containerRef}
    >
      {loading ? (
        <div
          className="resume-pdf-loading-overlay custom-pdf-loading-overlay"
          aria-label="Loading PDF document"
          style={{
            width: `${Math.floor(612 * scale)}px`,
            height: `${Math.floor(792 * scale)}px`,
          }}
        >
          <div className="pdf-mini-spinner" />
          <span className="pdf-loading-text">Rendering base-resume.pdf…</span>
        </div>
      ) : null}

      {error ? (
        <div className="custom-pdf-error-state" role="alert">
          <p>{error}</p>
          <a
            href={`/api/resume-drafts/${encodeURIComponent(draftId)}/pdf`}
            download="base-resume.pdf"
            className="toolbar-btn toolbar-btn-subtle"
          >
            Download PDF directly
          </a>
        </div>
      ) : null}

      {!loading && !error && pdfDoc ? (
        <div className="custom-pdf-pages-list">
          {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
            <PdfPageCanvas
              key={pageNum}
              pageNum={pageNum}
              pdfDoc={pdfDoc}
              scale={scale}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
