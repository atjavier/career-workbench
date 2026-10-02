import {
  getDocument,
  type PDFDocumentLoadingTask,
  type PDFDocumentProxy,
} from "pdfjs-dist/legacy/build/pdf.mjs";
import { WorkspaceError } from "@/domain/workspace/types";

/** Extracts plain text from a readable PDF byte array using pdf.js. */
export async function extractPdfText(
  bytes: Uint8Array,
  options?: { maxPages?: number; maxText?: number },
): Promise<string> {
  const maxPages = options?.maxPages ?? 50;
  const maxText = options?.maxText ?? 500_000;
  if (
    bytes.byteLength === 0 ||
    bytes.byteLength > 20 * 1024 * 1024 ||
    bytes[0] !== 0x25 ||
    bytes[1] !== 0x50 ||
    bytes[2] !== 0x44 ||
    bytes[3] !== 0x46
  ) {
    throw new WorkspaceError(
      "EVIDENCE_DOCUMENTER_INVALID",
      "The selected file is not a readable PDF document.",
      "Choose a text-readable PDF and try again.",
    );
  }
  let loadingTask: PDFDocumentLoadingTask | undefined;
  let document: PDFDocumentProxy | undefined;
  try {
    loadingTask = getDocument({ data: new Uint8Array(bytes) });
    document = await loadingTask.promise;
    if (document.numPages < 1) {
      throw new WorkspaceError(
        "EVIDENCE_DOCUMENTER_INVALID",
        "The selected PDF has no pages.",
        "Choose a valid PDF document and try again.",
      );
    }
    const pagesToRead = Math.min(document.numPages, maxPages);
    const lines: string[] = [];
    let used = 0;
    for (let pageNumber = 1; pageNumber <= pagesToRead; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      try {
        const content = await page.getTextContent();
        const pageLines: string[] = [];
        let currentLine = "";
        let previousY: number | undefined;
        for (const item of content.items) {
          if (!("str" in item) || !item.str.trim()) continue;
          const y = Array.isArray(item.transform)
            ? Number(item.transform[5])
            : 0;
          if (
            previousY !== undefined &&
            Math.abs(previousY - y) > 2 &&
            currentLine
          ) {
            pageLines.push(currentLine);
            currentLine = "";
          }
          currentLine = `${currentLine}${currentLine ? " " : ""}${item.str}`;
          previousY = y;
        }
        if (currentLine) pageLines.push(currentLine);
        const line = pageLines
          .map((value) => value.replace(/\s+/g, " ").trim())
          .filter(Boolean)
          .join("\n");
        used += line.length;
        if (used > maxText) break;
        if (line) lines.push(line);
      } finally {
        page.cleanup();
      }
    }
    return lines.join("\n\n").trim();
  } catch (error) {
    if (error instanceof WorkspaceError) throw error;
    throw new WorkspaceError(
      "EVIDENCE_DOCUMENTER_INVALID",
      "The selected PDF could not be read locally.",
      "Choose a text-readable, unprotected PDF and try again.",
    );
  } finally {
    document?.cleanup();
    await loadingTask?.destroy();
  }
}
