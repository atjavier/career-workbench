import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { MaterialDraftView } from "@/domain/resume-generation/material-draft-commands";
import {
  cleanDateString,
  cleanOrganization,
  compactProjectHeader,
  resumeDocumentModel,
  type ResumeDocumentModel,
  type ResumeEntry,
} from "@/domain/resume-generation/resume-pdf";

const templatePath = join(process.cwd(), "resume-template.tex");
const requiredTokens = [
  "{{HEADER}}",
  "{{EXPERIENCE_SECTION}}",
  "{{EDUCATION_SECTION}}",
  "{{PROJECTS_SECTION}}",
  "{{SKILLS_SECTION}}",
] as const;

function fallbackTemplate(): string {
  return String.raw`\documentclass[10pt,letterpaper]{article}
\usepackage[letterpaper,left=54pt,right=44pt,top=34pt,bottom=38pt]{geometry}
\usepackage{times}
\usepackage[hidelinks]{hyperref}
\usepackage{titlesec}
\setlength{\parindent}{0pt}
\setlength{\parskip}{0pt}
\pagenumbering{gobble}
\titleformat{\section}{\normalfont\fontsize{12}{14}\selectfont\uppercase}{ }{0pt}{}[\vspace{-4pt}\titlerule]
\titlespacing*{\section}{0pt}{10pt}{9pt}
\newenvironment{tightitemize}{\begin{list}{\textbullet}{\setlength{\leftmargin}{28pt}\setlength{\labelsep}{5pt}\setlength{\labelwidth}{7pt}\setlength{\itemsep}{0pt}\setlength{\topsep}{0pt}\setlength{\partopsep}{0pt}\setlength{\parsep}{0pt}\setlength{\parskip}{0pt}}}{\end{list}}
\newcommand{\resumeexperience}[3]{\noindent\hspace*{16pt}\textbf{#1}\hfill\textit{#2}\\[-1pt]\hspace*{16pt}\textit{#3}\par\vspace{2pt}}
\newcommand{\resumeproject}[3]{\noindent\hspace*{16pt}\textbf{#1}\if\relax\detokenize{#2}\relax\else\ \textit{| #2}\fi\hfill\textit{#3}\par\vspace{2pt}}
\newcommand{\resumeeducation}[3]{\noindent\hspace*{16pt}\textbf{#1}\\[-1pt]\hspace*{16pt}\textit{#2}\hfill\textit{#3}\par\vspace{2pt}}
\newcommand{\resumeskill}[2]{\noindent\hspace*{16pt}\textbf{#1:}\ #2\par}
\begin{document}
\fontsize{9.25}{11.6}\selectfont
\begin{center}
{{HEADER}}
\end{center}
\vspace{-2pt}
{{EXPERIENCE_SECTION}}
{{EDUCATION_SECTION}}
{{PROJECTS_SECTION}}
{{SKILLS_SECTION}}
\end{document}`;
}

function template(): string {
  try {
    const source = readFileSync(templatePath, "utf8");
    if (requiredTokens.every((token) => source.includes(token))) return source;
  } catch {
    // The app can still produce a deterministic source if a packaged build
    // omits the optional authoring file. Resume.pdf remains the PDF contract.
  }
  return fallbackTemplate();
}

function latex(value: string): string {
  return (
    value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201c\u201d]/g, '"')
      .replace(/[\u2013\u2014]/g, "-")
      .replace(/\u2026/g, "...")
      .replace(/[^\x20-\x7e]/g, "?")
      // Protect literal backslashes with a sentinel before escaping TeX
      // punctuation; otherwise the braces in \textbackslash{} would be
      // escaped a second time.
      .replace(/\\/g, "\u0000")
      .replace(/([&%$#_{}])/g, "\\$1")
      .replace(/~/g, String.raw`\textasciitilde{}`)
      .replace(/\^/g, String.raw`\textasciicircum{}`)
      .replace(/\u0000/g, String.raw`\textbackslash{}`)
  );
}

function section(name: string, body: string): string {
  return `\\section*{${latex(name)}}\n${body.trim()}\n`;
}

function bullets(item: ResumeEntry): string {
  return item.bullets.length
    ? `\n\\begin{tightitemize}\n${item.bullets.map((bullet) => `  \\item ${latex(bullet)}`).join("\n")}\n\\end{tightitemize}`
    : "";
}

function experienceEntry(item: ResumeEntry): string {
  let organization = "";
  const detail = cleanOrganization(item.detail ?? "");
  const meta = cleanOrganization(item.meta ?? "");
  if (detail && meta) {
    organization = `${latex(detail)}\\hfill ${latex(meta)}`;
  } else {
    const raw = detail || meta;
    if (raw.includes(" | ")) {
      const parts = raw.split(" | ").map((p) => p.trim()).filter(Boolean);
      if (parts.length >= 2) {
        organization = `${latex(parts[0]!)}\\hfill ${latex(parts.slice(1).join(" | "))}`;
      } else {
        organization = latex(raw);
      }
    } else {
      organization = latex(raw);
    }
  }
  const date = cleanDateString(item.date ?? "");
  return `\\resumeexperience{${latex(item.title)}}{${latex(date)}}{${organization}}${bullets(item)}`;
}

function projectEntry(item: ResumeEntry): string {
  const tech = item.detail ?? (item.meta && !item.detail ? item.meta : "");
  const descText = item.detail && item.meta ? item.meta : undefined;
  const desc = descText
    ? `\n\\noindent\\hspace*{16pt}\\textit{${latex(descText)}}\\par\\vspace{2pt}`
    : "";
  const date = cleanDateString(item.date ?? "");
  return `\\resumeproject{${latex(item.title)}}{${latex(tech)}}{${latex(date)}}${desc}${bullets(item)}`;
}

function entriesBody(
  entries: ResumeEntry[],
  kind: "experience" | "project",
): string {
  return entries
    .map((item) =>
      kind === "experience" ? experienceEntry(item) : projectEntry(item),
    )
    .join("\n\n");
}

function educationBody(value: string | undefined): string {
  if (!value) return "Education details were not supplied.";
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const rawHeader = lines.shift() ?? "";
  const parts = rawHeader.includes("|")
    ? rawHeader.split("|").map((part) => part.trim()).filter(Boolean)
    : rawHeader
        .split(
          /\s*[-–—]\s*|\s*,\s*(?=(?:BS|MS|BA|Master|Bachelor|Doctor|Degree|Computer Science|\d{4})\b)/i,
        )
        .map((part) => part.trim())
        .filter(Boolean);

  let school = "";
  let program = "";
  let date = "";
  const remainingParts: string[] = [];

  const schoolRegex =
    /\b(?:university|college|institute|school|polytechnic|academy)\b/i;
  const programRegex =
    /\b(?:b\.?s\.?|b\.?a\.?|m\.?s\.?|bachelor|master|degree|computer science|engineering)\b/i;
  const dateRegex =
    /\b(?:19|20)\d{2}(?:\s*[-–—]\s*(?:(?:19|20)\d{2}|present))?\b/i;

  for (const part of parts) {
    if (!school && schoolRegex.test(part)) {
      school = part;
    } else if (!program && programRegex.test(part)) {
      program = part;
    } else if (!date && dateRegex.test(part)) {
      date = part;
    } else {
      remainingParts.push(part);
    }
  }

  if (!school && parts.length > 0) {
    school = parts[0]!;
  }
  if (!program && remainingParts.length > 0) {
    program = remainingParts.shift()!;
  }
  if (
    !date &&
    remainingParts.length > 0 &&
    /\b(?:19|20)\d{2}\b/.test(remainingParts[0]!)
  ) {
    date = remainingParts.shift()!;
  }

  const rawHonours = [
    ...remainingParts,
    ...lines.map((line) => line.replace(/^[-*•]\s*/, "").trim()),
  ].filter(Boolean);
  const honours = rawHonours.join(" | ");
  return `\\resumeeducation{${latex(school)}}{${latex(program)}}{${latex(date)}}${honours ? `\n\\begin{tightitemize}\n  \\item ${latex(honours)}\n\\end{tightitemize}` : ""}`;
}

function skillsBody(value: string | undefined): string {
  if (!value)
    return "Skills are listed only when directly supported by documented work.";
  const lines = value
    .split(
      /\r?\n|(?=\b(?:Languages|Frameworks|Data(?:\s*&|\s+and)?\s*APIs|Tools):)/i,
    )
    .map((line) => line.trim())
    .filter(Boolean);
  const rows = lines
    .map((line) => /^(.+?):\s*(.+)$/.exec(line))
    .filter((row): row is RegExpExecArray => Boolean(row));
  return rows.length
    ? rows
        .map(
          (row) =>
            `\\resumeskill{${latex(row[1]!.trim())}}{${latex(row[2]!.trim())}}`,
        )
        .join("\n")
    : latex(value);
}

function renderHeader(model: ResumeDocumentModel): string {
  const lines = [
    `{\\fontsize{22}{25}\\selectfont\\textbf{${latex(model.name)}}}\\\\[-2pt]`,
  ];
  if (model.contact) lines.push(`${latex(model.contact)}\\\\`);
  return lines.join("\n");
}

function genericSectionBody(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const bullet = /^(?:[-*•])\s+(.+)$/.exec(line);
      return bullet
        ? `\\begin{tightitemize}\n  \\item ${latex(bullet[1] ?? line)}\n\\end{tightitemize}`
        : `${latex(line)}\\par`;
    })
    .join("\n");
}

function renderedDraftSections(
  draft: MaterialDraftView,
  model: ResumeDocumentModel,
): string {
  return draft.sections
    .filter((item) => item.text.trim())
    .map(({ heading, text }) => {
      if (/contact/i.test(heading)) return "";
      if (/(?:experience|employment|\bwork\b)/i.test(heading)) {
        if (
          !model.experienceEntries.length ||
          /^no (?:experience|employment|work) entries/i.test(text.trim())
        ) {
          return "";
        }
        return section(
          heading,
          entriesBody(model.experienceEntries, "experience"),
        );
      }
      if (/education/i.test(heading))
        return section(heading, educationBody(model.education));
      if (/project/i.test(heading)) {
        if (
          !model.projectEntries.length ||
          /^no project entries/i.test(text.trim())
        ) {
          return "";
        }
        return section(
          /selected/i.test(heading) ? "Projects" : heading,
          entriesBody(model.projectEntries, "project"),
        );
      }
      if (/(?:technical skills|skills|technologies)/i.test(heading))
        return section("Technical Skills", skillsBody(model.skills));
      return section(heading, genericSectionBody(text));
    })
    .filter(Boolean)
    .join("\n");
}

/**
 * Produce the canonical TeX representation of a generated base resume.
 * The approved canonical Resume.pdf layout is the immutable visual contract; this source
 * is intentionally an authoring/export representation and is safe to compile
 * only with a fixed local TeX toolchain chosen by the host application.
 */
export function renderResumeDraftTex(draft: MaterialDraftView): string {
  const model = resumeDocumentModel(draft);
  const renderedSections = renderedDraftSections(draft, model);
  const replacements = {
    "{{HEADER}}": renderHeader(model),
    "{{EXPERIENCE_SECTION}}": renderedSections,
    "{{EDUCATION_SECTION}}": "",
    "{{PROJECTS_SECTION}}": "",
    "{{SKILLS_SECTION}}": "",
  } satisfies Record<(typeof requiredTokens)[number], string>;
  return requiredTokens.reduce(
    (source, token) => source.replaceAll(token, replacements[token]),
    template(),
  );
}
