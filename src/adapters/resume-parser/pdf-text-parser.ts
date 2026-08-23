import { getDocument, type PDFDocumentLoadingTask, type PDFDocumentProxy } from "pdfjs-dist/legacy/build/pdf.mjs";
import { WorkspaceError } from "@/domain/workspace/types";

export type ResumeDraftContent = {
  contact: string[];
  summary: string[];
  experience: string[];
  projects: string[];
  education: string[];
  skills: string[];
  other: string[];
};

export const maximumCurrentResumeBytes = 10 * 1024 * 1024;
export const maximumCurrentResumePages = 12;
export const maximumCurrentResumeText = 100_000;

const sections: Array<[keyof ResumeDraftContent, RegExp]> = [
  ["summary", /^(summary|profile|objective)$/i],
  ["experience", /^(experience|work experience|employment)$/i],
  ["projects", /^(projects|selected projects)$/i],
  ["education", /^(education|academic background)$/i],
  ["skills", /^(skills|technical skills|competencies)$/i],
];

function emptyDraft(): ResumeDraftContent {
  return { contact: [], summary: [], experience: [], projects: [], education: [], skills: [], other: [] };
}

export function validateResumeDraftContent(value: unknown): ResumeDraftContent {
  if (!value || typeof value !== "object") throw new WorkspaceError("CURRENT_BASE_RESUME_INVALID", "The Current Base Resume draft is unavailable.", "Refresh the Current Base Resume and try again.");
  const candidate = value as Record<string, unknown>;
  const keys: Array<keyof ResumeDraftContent> = ["contact", "summary", "experience", "projects", "education", "skills", "other"];
  if (Object.keys(candidate).length !== keys.length || keys.some((key) => !Array.isArray(candidate[key]))) throw new WorkspaceError("CURRENT_BASE_RESUME_INVALID", "The Current Base Resume draft is unavailable.", "Refresh the Current Base Resume and try again.");
  let length = 0;
  const content = emptyDraft();
  for (const key of keys) {
    const lines = candidate[key];
    if (!Array.isArray(lines) || lines.some((line) => typeof line !== "string" || line.length > 10_000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(line))) throw new WorkspaceError("CURRENT_BASE_RESUME_INVALID", "The Current Base Resume draft contains unsupported text.", "Review the draft text and try again.");
    length += lines.reduce((total, line) => total + line.length, 0);
    if (length > maximumCurrentResumeText) throw new WorkspaceError("CURRENT_BASE_RESUME_INVALID", "The Current Base Resume draft is too large.", "Shorten the draft and try again.");
    content[key] = lines.map((line) => line.trim()).filter(Boolean);
  }
  return content;
}

export function structureResumeText(text: string): ResumeDraftContent {
  const draft = emptyDraft();
  let section: keyof ResumeDraftContent = "contact";
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+/g, " ").trim();
    if (!line) continue;
    const found = sections.find(([, heading]) => heading.test(line.replace(/:$/, "")));
    if (found) { section = found[0]; continue; }
    if (draft.contact.length >= 4 && section === "contact") section = "other";
    draft[section].push(line);
  }
  return draft;
}

/** Server-only PDF.js adapter. It accepts bytes, never a URL or filesystem path. */
export async function parseResumePdf(bytes: Uint8Array): Promise<ResumeDraftContent> {
  if (bytes.byteLength === 0 || bytes.byteLength > maximumCurrentResumeBytes || bytes[0] !== 0x25 || bytes[1] !== 0x50 || bytes[2] !== 0x44 || bytes[3] !== 0x46) {
    throw new WorkspaceError("CURRENT_BASE_RESUME_INVALID", "The selected file is not a readable resume PDF.", "Choose a text-readable PDF up to 10 MB and try again.");
  }
  let loadingTask: PDFDocumentLoadingTask | undefined;
  let document: PDFDocumentProxy | undefined;
  try {
    loadingTask = getDocument({ data: new Uint8Array(bytes) });
    document = await loadingTask.promise;
    if (document.numPages < 1 || document.numPages > maximumCurrentResumePages) throw new WorkspaceError("CURRENT_BASE_RESUME_INVALID", "The selected PDF cannot be used as a resume source.", "Choose a text-readable PDF with no more than 12 pages and try again.");
    const lines: string[] = [];
    let used = 0;
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      try {
        const content = await page.getTextContent();
        const pageLines: string[] = [];
        let currentLine = "";
        let previousY: number | undefined;
        for (const item of content.items) {
          if (!("str" in item) || !item.str.trim()) continue;
          const y = Array.isArray(item.transform) ? Number(item.transform[5]) : 0;
          if (previousY !== undefined && Math.abs(previousY - y) > 2 && currentLine) { pageLines.push(currentLine); currentLine = ""; }
          currentLine = `${currentLine}${currentLine ? " " : ""}${item.str}`;
          previousY = y;
        }
        if (currentLine) pageLines.push(currentLine);
        const line = pageLines.map((value) => value.replace(/\s+/g, " ").trim()).filter(Boolean).join("\n");
        used += line.length;
        if (used > maximumCurrentResumeText) throw new WorkspaceError("CURRENT_BASE_RESUME_INVALID", "The selected PDF contains too much text to import safely.", "Choose a shorter text-readable resume PDF and try again.");
        if (line) lines.push(line);
      } finally { page.cleanup(); }
    }
    const text = lines.join("\n").trim();
    if (!text) throw new WorkspaceError("CURRENT_BASE_RESUME_INVALID", "No readable text was found in that PDF.", "Choose a text-readable PDF; scanned images are not supported yet.");
    return validateResumeDraftContent(structureResumeText(text));
  } catch (error) {
    if (error instanceof WorkspaceError) throw error;
    throw new WorkspaceError("CURRENT_BASE_RESUME_INVALID", "The selected PDF could not be read locally.", "Choose a text-readable, unprotected PDF and try again.");
  } finally {
    document?.cleanup();
    await loadingTask?.destroy();
  }
}
