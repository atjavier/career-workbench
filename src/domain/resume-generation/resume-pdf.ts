import type { MaterialDraftView } from "@/domain/resume-generation/material-draft-commands";

// Resume.pdf is the visual contract for generated base resumes. The renderer
// keeps its A4 geometry, Times typography, ruled headings, and compact entry
// layout while replacing the template placeholders with grounded draft text.
const defaultPage = { width: 595.2756, height: 841.8898 };
const leftMargin = 38;
const rightMargin = 38;
const bodyLeft = 54;
const textLeft = 80;
const topMargin = 43;
const bottomMargin = 38;
const sectionSize = 11.2;
const bodySize = 9.2;
const entryTitleSize = 10;
const entryMetaSize = 9.6;
const contactSize = 9.5;
const lineHeight = 11.8;

type PageSize = { width: number; height: number };
type FlowLine = {
  text: string;
  font: "regular" | "bold" | "italic";
  size: number;
  x?: number;
  right?: boolean;
  gapBefore?: number;
  bullet?: boolean;
};
export type ResumeEntry = {
  title: string;
  detail?: string;
  meta?: string;
  date?: string;
  bullets: string[];
};
export type ResumeDocumentModel = {
  name: string;
  contact: string;
  summary?: string;
  education?: string;
  experienceEntries: ResumeEntry[];
  projectEntries: ResumeEntry[];
  skills?: string;
};

function printable(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u2022\u00b7]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/[^\x20-\x7e]/g, "?")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function plainText(value: string): string {
  return value
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_`~]/g, "")
    .replace(/^[\u2022\u00b7\-]\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalized(value: string): string {
  return value
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function wrap(value: string, maximumCharacters = 92): string[] {
  const result: string[] = [];
  for (const paragraph of value.split(/\r?\n/)) {
    const text = plainText(paragraph);
    if (!text) {
      if (result.length && result.at(-1) !== "") result.push("");
      continue;
    }
    let current = "";
    for (const word of text.split(/\s+/)) {
      if (!current) current = word;
      else if (`${current} ${word}`.length <= maximumCharacters)
        current += ` ${word}`;
      else {
        result.push(current);
        current = word;
      }
    }
    if (current) result.push(current);
  }
  while (result.at(-1) === "") result.pop();
  return result;
}

function templatePageSize(templateBytes?: Uint8Array): PageSize {
  if (!templateBytes) return defaultPage;
  if (Buffer.from(templateBytes.subarray(0, 5)).toString("ascii") !== "%PDF-")
    throw new Error("The Resume.pdf template is invalid.");
  const source = Buffer.from(templateBytes).toString("latin1");
  const match = /\/MediaBox\s*\[\s*0\s+0\s+([0-9.]+)\s+([0-9.]+)\s*\]/.exec(
    source,
  );
  if (!match)
    throw new Error("The Resume.pdf template page geometry is unavailable.");
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width < 300 ||
    height < 400 ||
    width > 2_000 ||
    height > 2_000
  )
    throw new Error("The Resume.pdf template page geometry is invalid.");
  return { width, height };
}

function findSection(
  draft: MaterialDraftView,
  pattern: RegExp,
): { heading: string; text: string } | undefined {
  return draft.sections.find((section) => pattern.test(section.heading));
}
function sectionParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function contactAndName(draft: MaterialDraftView): {
  name: string;
  contact: string;
} {
  const contact = findSection(draft, /contact/i);
  const lines =
    contact?.text
      .split(/\r?\n/)
      .map((item) => plainText(item))
      .filter(Boolean) ?? [];
  const summary = findSection(draft, /summary|profile|objective/i)?.text ?? "";
  const name =
    lines.length > 1
      ? lines[0]!
      : plainText(summary).split(/\s+(?:is|has|with)\s+/i)[0] || "Candidate";
  return {
    name,
    contact: (lines.length > 1 ? lines.slice(1) : lines).join(" | "),
  };
}

function entriesFromSection(
  section: { heading: string; text: string } | undefined,
): ResumeEntry[] {
  if (!section) return [];
  if (
    /^no (?:experience|project) entries were documented\.?$/i.test(
      section.text.trim(),
    )
  )
    return [];
  return sectionParagraphs(section.text)
    .map((paragraph) => {
      const lines = paragraph
        .split(/\r?\n/)
        .map((item) => item.trim())
        .filter(Boolean);
      const titleSource = plainText(lines.shift() ?? "");
      const separator = titleSource.indexOf("|");
      const title =
        separator >= 0 ? titleSource.slice(0, separator).trim() : titleSource;
      const detail =
        separator >= 0
          ? titleSource.slice(separator + 1).trim() || undefined
          : undefined;
      const bulletStart = lines.findIndex((line) => /^[•*\-]\s+/.test(line));
      // New model output marks every accomplishment as a bullet. Keeping that
      // boundary prevents the first achievement from becoming italic metadata.
      // Legacy drafts without markers retain their prior first-metadata-line
      // interpretation so old material stays readable.
      const metadata =
        bulletStart >= 0 ? lines.slice(0, bulletStart) : lines.slice(0, 1);
      const bulletLines =
        bulletStart >= 0 ? lines.slice(bulletStart) : lines.slice(1);
      const dateIndex = metadata.findIndex((line) =>
        /\b(?:19|20)\d{2}\b|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b.*\b(?:19|20)\d{2}\b/i.test(
          line,
        ),
      );
      const date =
        dateIndex >= 0 ? plainText(metadata[dateIndex] ?? "") : undefined;
      const meta =
        metadata
          .filter((_, index) => index !== dateIndex)
          .map(plainText)
          .filter(Boolean)
          .join(" | ") || undefined;
      const bullets = bulletLines
        .flatMap((line) => wrap(line, 87))
        .filter(Boolean);
      if (!bullets.length && title.includes(" - "))
        bullets.push(...wrap(title, 87).slice(1));
      return { title: title || "Documented work", detail, meta, date, bullets };
    })
    .filter((entry) => entry.title || entry.bullets.length);
}

function claimsNotAlreadyWritten(
  draft: MaterialDraftView,
  written: string,
): string[] {
  const haystack = normalized(written);
  return draft.claims.flatMap((claim) =>
    haystack.includes(normalized(claim.text)) ? [] : wrap(claim.text, 87),
  );
}

/**
 * Convert the grounded draft into the semantic document model shared by the
 * PDF renderer and the optional TeX export. Keeping this projection in one
 * place prevents the two template paths from drifting in section order or
 * accidentally showing raw source snippets.
 */
export function resumeDocumentModel(
  draft: MaterialDraftView,
): ResumeDocumentModel {
  const { name, contact } = contactAndName(draft);
  const summary = findSection(draft, /summary|profile|objective/i);
  const education = findSection(draft, /education/i);
  const experience = findSection(draft, /experience|employment|work history/i);
  const projects = findSection(draft, /projects?/i);
  const skills = findSection(draft, /technical skills|skills|technologies/i);
  const selected = findSection(draft, /selected experience|documented work/i);
  const written = draft.sections.map((section) => section.text).join("\n");
  const experienceEntries = entriesFromSection(experience);
  const projectEntries = entriesFromSection(projects);
  if (!experienceEntries.length && selected)
    experienceEntries.push(...entriesFromSection(selected).slice(0, 2));
  const remainingClaims = claimsNotAlreadyWritten(draft, written);
  if (!projectEntries.length && remainingClaims.length)
    projectEntries.push({
      title: "Documented projects and contributions",
      bullets: remainingClaims,
    });
  else if (projectEntries.length && remainingClaims.length)
    projectEntries[projectEntries.length - 1]!.bullets.push(...remainingClaims);
  if (
    !experienceEntries.length &&
    !projectEntries.length &&
    draft.claims.length
  )
    experienceEntries.push({
      title: "Documented experience and projects",
      bullets: draft.claims.flatMap((claim) => wrap(claim.text, 87)),
    });

  return {
    name,
    contact,
    summary: summary ? wrap(summary.text, 94).join(" ") : undefined,
    education: education ? wrap(education.text, 94).join(" ") : undefined,
    experienceEntries,
    projectEntries,
    skills: skills ? wrap(skills.text, 94).join(" ") : undefined,
  };
}

function flowFor(draft: MaterialDraftView): {
  name: string;
  contact: string;
  lines: FlowLine[];
} {
  const { name, contact } = contactAndName(draft);
  const lines: FlowLine[] = [];
  const section = (heading: string) => {
    lines.push({
      text: heading.toUpperCase(),
      font: "regular",
      size: sectionSize,
      x: leftMargin,
      gapBefore: 5,
    });
    lines.push({ text: "", font: "regular", size: 1, x: leftMargin });
  };
  for (const item of draft.sections) {
    if (!item.text.trim()) continue;
    section(item.heading);
    for (const rawLine of item.text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line) continue;
      const bullet = /^(?:[-*•])\s+(.+)$/.exec(line);
      for (const wrapped of wrap(bullet?.[1] ?? line, bullet ? 87 : 94))
        lines.push({
          text: wrapped,
          font: "regular",
          size: bodySize,
          x: bullet ? textLeft : bodyLeft,
          bullet: Boolean(bullet),
        });
    }
  }
  return { name, contact, lines };
}

function pageStreams(
  draft: MaterialDraftView,
  page: PageSize,
): { streams: string[] } {
  const flow = flowFor(draft);
  const streams: string[] = [];
  let stream = "";
  let y = page.height - topMargin;
  let firstPage = true;
  const finish = () => {
    streams.push(stream);
    stream = "";
  };
  const start = () => {
    y = page.height - topMargin;
    if (firstPage) {
      const nameWidth = Math.max(1, flow.name.length * 11.5);
      const nameX = (page.width - nameWidth) / 2;
      stream += `BT /F2 21 Tf 1 0 0 1 ${Math.max(leftMargin, nameX)} ${y} Tm (${printable(flow.name)}) Tj ET\n`;
      if (flow.contact)
        stream += `BT /F1 ${contactSize} Tf 1 0 0 1 ${leftMargin + 44} ${y - 16} Tm (${printable(flow.contact)}) Tj ET\n`;
      y -= 37;
      firstPage = false;
    } else {
      stream += `BT /F2 12 Tf 1 0 0 1 ${leftMargin} ${y} Tm (${printable(flow.name)} - continued) Tj ET\n`;
      y -= 22;
    }
  };
  const ensure = (height: number) => {
    if (y - height < bottomMargin) {
      finish();
      start();
    }
  };
  const draw = (line: FlowLine) => {
    const gap = line.gapBefore ?? 0;
    ensure(lineHeight + gap + (line.text ? 0 : 4));
    y -= gap;
    if (!line.text) {
      // The source template places its rule four points below the heading
      // baseline, with the first body row fifteen points below that rule.
      // `y` is already one text leading below the heading at this point.
      stream += `.45 w\nn ${leftMargin} ${y + 7.8} m ${page.width - rightMargin} ${y + 7.8} l S\n`;
      y -= 7;
      return;
    }
    const x = line.right
      ? page.width - rightMargin - Math.min(220, line.text.length * 5.1)
      : (line.x ?? bodyLeft);
    const text = line.bullet ? `- ${line.text}` : line.text;
    const font =
      line.font === "bold" ? "F2" : line.font === "italic" ? "F3" : "F1";
    stream += `BT /${font} ${line.size} Tf 1 0 0 1 ${x} ${y} Tm (${printable(text)}) Tj ET\n`;
    y -= lineHeight;
  };
  start();
  for (const line of flow.lines) draw(line);
  finish();
  return { streams };
}

function pdfBytes(objects: string[]): Uint8Array {
  let output = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
  const offsets: number[] = [];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(output, "binary"));
    output += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const startxref = Buffer.byteLength(output, "binary");
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${startxref}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(output, "binary"));
}

/** Render a draft using the immutable Resume.pdf geometry and visual system. */
export function renderResumeDraftPdf(
  draft: MaterialDraftView,
  templateBytes?: Uint8Array,
): Uint8Array {
  const page = templatePageSize(templateBytes);
  const streams = pageStreams(draft, page).streams;
  const firstPageObject = 5;
  const firstContentObject = firstPageObject + streams.length;
  const firstFontObject = firstContentObject + streams.length;
  const pageObjects = streams.map(
    (_, index) =>
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${page.width} ${page.height}] /Resources << /Font << /F1 ${firstFontObject} 0 R /F2 ${firstFontObject + 1} 0 R /F3 ${firstFontObject + 2} 0 R >> >> /Contents ${firstContentObject + index} 0 R >>`,
  );
  const contentObjects = streams.map(
    (stream) =>
      `<< /Length ${Buffer.byteLength(stream, "binary")} >>\nstream\n${stream}endstream`,
  );
  const kids = pageObjects
    .map((_, index) => `${firstPageObject + index} 0 R`)
    .join(" ");
  return pdfBytes([
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${kids}] /Count ${pageObjects.length} >>`,
    "<< /Producer (Career Workbench Resume Coach) /Title (Generated Base Resume from Resume.pdf template) >>",
    "<< /Type /Metadata /Subtype /XML /Length 0 >>\nstream\n\nendstream",
    ...pageObjects,
    ...contentObjects,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Times-Italic /Encoding /WinAnsiEncoding >>",
  ]);
}
