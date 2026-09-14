import test from "node:test";
import assert from "node:assert/strict";

import {
  cleanDateString,
  cleanOrganization,
  compactProjectHeader,
} from "../src/domain/resume-generation/resume-pdf";
import { renderResumeDraftTex } from "../src/domain/resume-generation/resume-tex";

test("TeX export uses the canonical template and the same semantic sections as the PDF renderer", () => {
  const draft = {
    id: "00000000-0000-7000-8000-000000000001",
    profileLabel: "Saved Candidate Profile",
    templateLabel: "Resume.pdf",
    templateId: "00000000-0000-7000-8000-000000000002",
    templateDigest: `sha256:${"a".repeat(64)}`,
    evidenceLabels: ["Project notes"],
    sections: [
      { heading: "Professional Summary", text: "Candidate with documented API work." },
      { heading: "Contact", text: "Ada Lovelace\nada@example.com | 555-0100" },
      { heading: "Experience", text: "Software Engineering Intern | Example Co\n2024 - 2025\n- Built an API with 100% test coverage." },
      { heading: "Education", text: "University | Computer Science | 2026 | Magna Cum Laude" },
      { heading: "Projects", text: "Safe API | TypeScript project\n- Implemented escaping for 100% of inputs." },
      { heading: "Technical Skills", text: "Languages: TypeScript, C# & SQL\nFrameworks: React\nData & APIs: SQLite\nTools: Git, C:\\tools" },
    ],
    claims: [{ text: "Built an API with 100% test coverage.", evidence: ["Project notes"] }],
    unknowns: [],
    handedOff: false,
  };

  const tex = renderResumeDraftTex(draft);
  assert.match(tex, /\\documentclass\[10pt,letterpaper\]\{article\}/);
  assert.match(tex, /left=54pt,right=44pt/);
  assert.match(tex, /\\section\*\{Experience\}/);
  assert.match(tex, /\\section\*\{Projects\}/);
  assert.match(tex, /\\resumeproject\{Safe API\}\{TypeScript project\}/);
  assert.match(tex, /\\resumeskill\{Languages\}\{TypeScript, C\\# \\& SQL\}/);
  assert.match(tex, /\\resumeskill\{Frameworks\}\{React\}/);
  assert.match(tex, /\\textbackslash\{\}/, "literal backslash escaping remains available");
  assert.match(tex, /C\\# \\& SQL/);
  assert.doesNotMatch(tex, /\{\{(?:HEADER|SUMMARY_SECTION|EXPERIENCE_SECTION|EDUCATION_SECTION|PROJECTS_SECTION|SKILLS_SECTION)\}\}/);
});

test("TeX omits an empty Experience block and keeps education and skill rows structured", () => {
  const draft = {
    id: "00000000-0000-7000-8000-000000000001", profileLabel: "Saved Candidate Profile", templateLabel: "Resume.pdf", templateId: "00000000-0000-7000-8000-000000000002", templateDigest: `sha256:${"a".repeat(64)}`, evidenceLabels: ["Project notes"],
    sections: [
      { heading: "Contact", text: "Ada Lovelace\nada@example.com" },
      { heading: "Education", text: "University of the Philippines | BS Computer Science | 2026 | GWA 1.44 | Magna Cum Laude" },
      { heading: "Projects", text: "BioEvidence | Validation workflow\n- Built a durable workflow." },
      { heading: "Technical Skills", text: "Languages: Python\nFrameworks: Flask\nData & APIs: SQLite\nTools: Git" },
    ], claims: [], unknowns: [], handedOff: false,
  };
  const tex = renderResumeDraftTex(draft);
  assert.doesNotMatch(tex, /No experience entries were documented|\\section\*\{Experience\}/);
  assert.match(tex, /\\resumeeducation\{University of the Philippines\}\{BS Computer Science\}\{2026\}/);
  assert.match(tex, /\\resumeskill\{Tools\}\{Git\}/);
});

test("compactProjectHeader preserves concise 2-part headers and strips multi-clause marketing slogans", () => {
  // Multi-part header with marketing slogan and tech stack
  const multiPart =
    "Personal-Job-Discovery-Workplace | AI-Powered Resume Tailoring & Job Discovery Platform | Next.js, React, TypeScript, SQLite";
  assert.equal(
    compactProjectHeader(multiPart),
    "Personal-Job-Discovery-Workplace | Next.js, React, TypeScript, SQLite",
  );

  // Normal 2-part concise header remains untouched
  const concise = "BioEvidence | Python, Docker, Next.js, FastAPI";
  assert.equal(compactProjectHeader(concise), concise);

  // Bullets remain untouched
  const bullet = "- Developed full-stack workflow with Next.js and SQLite.";
  assert.equal(compactProjectHeader(bullet), bullet);
});

test("TeX export formats 3-part project headers with subtitle description line and propagates interview dates", () => {
  const draft = {
    id: "00000000-0000-7000-8000-000000000001",
    profileLabel: "Saved Candidate Profile",
    templateLabel: "Resume.pdf",
    templateId: "00000000-0000-7000-8000-000000000002",
    templateDigest: `sha256:${"a".repeat(64)}`,
    evidenceLabels: ["Project notes"],
    sections: [
      { heading: "Contact", text: "Adrian Javier\nadrian@example.com" },
      {
        heading: "Projects",
        text: "Personal-Job-Discovery-Workplace | AI-Powered Resume Tailoring & Job Discovery Platform | Next.js, React, TypeScript, SQLite\n- Built end-to-end resume tailoring workflow.",
      },
    ],
    claims: [],
    candidateClarifications: [
      {
        itemName: "Personal-Job-Discovery-Workplace",
        itemCategory: "project" as const,
        category: "dates",
        text: "2024 - Present",
        provenance: "candidate_interview_answer" as const,
      },
    ],
    unknowns: [],
    handedOff: false,
  };
  const tex = renderResumeDraftTex(draft);
  assert.match(
    tex,
    /\\resumeproject\{Personal-Job-Discovery-Workplace\}\{Next\.js, React, TypeScript, SQLite\}\{2024 - Present\}/,
  );
  assert.match(
    tex,
    /\\noindent\\hspace\*\{16pt\}\\textit\{AI-Powered Resume Tailoring \\& Job Discovery Platform\}\\par\\vspace\{2pt\}/,
  );
});

test("TeX export preserves company name in Experience section", () => {
  const draft = {
    id: "00000000-0000-7000-8000-000000000001",
    profileLabel: "Saved Candidate Profile",
    templateLabel: "Resume.pdf",
    templateId: "00000000-0000-7000-8000-000000000002",
    templateDigest: `sha256:${"a".repeat(64)}`,
    evidenceLabels: ["Work notes"],
    sections: [
      { heading: "Contact", text: "Adrian Javier\nadrian@example.com" },
      {
        heading: "Experience",
        text: "Software Engineering Intern | Department of Science and Technology | 2024\n- Built an automated data pipeline.",
      },
    ],
    claims: [],
    unknowns: [],
    handedOff: false,
  };
  const tex = renderResumeDraftTex(draft);
  assert.match(tex, /\\resumeexperience\{Software Engineering Intern\}\{2024\}\{Department of Science and Technology\}/);
});

test("cleanOrganization strips (Company/Org), (Company), (Org), and bracketed equivalents", () => {
  assert.equal(cleanOrganization("MetaWatt (Company/Org)"), "MetaWatt");
  assert.equal(cleanOrganization("MetaWatt (Company / Organization)"), "MetaWatt");
  assert.equal(cleanOrganization("MetaWatt (Company)"), "MetaWatt");
  assert.equal(cleanOrganization("MetaWatt (Org)"), "MetaWatt");
  assert.equal(cleanOrganization("MetaWatt (Organization)"), "MetaWatt");
  assert.equal(cleanOrganization("MetaWatt [Company]"), "MetaWatt");
  assert.equal(cleanOrganization("MetaWatt"), "MetaWatt");
});

test("cleanDateString normalizes conversational interview dates into clean ranges", () => {
  assert.equal(
    cleanDateString("I worked on it from March 2026 to June 2026"),
    "March 2026 – June 2026",
  );
  assert.equal(
    cleanDateString("from March 2026 to June 2026"),
    "March 2026 – June 2026",
  );
  assert.equal(
    cleanDateString("March 2026 - June 2026"),
    "March 2026 – June 2026",
  );
  assert.equal(
    cleanDateString("March 2026 to Present"),
    "March 2026 – Present",
  );
  assert.equal(cleanDateString("Summer 2025"), "Summer 2025");
  assert.equal(cleanDateString("2024 - Present"), "2024 – Present");
});

test("TeX export sanitizes (Company/Org) in Experience and conversational interview dates in Projects", () => {
  const draft = {
    id: "00000000-0000-7000-8000-000000000001",
    profileLabel: "Saved Candidate Profile",
    templateLabel: "Resume.pdf",
    templateId: "00000000-0000-7000-8000-000000000002",
    templateDigest: `sha256:${"a".repeat(64)}`,
    evidenceLabels: ["Evidence"],
    sections: [
      { heading: "Contact", text: "Adrian Javier\nadrian@example.com" },
      {
        heading: "Experience",
        text: "Software Engineer Intern | MetaWatt (Company/Org) | June 2025 - August 2025\n- Built solar monitoring APIs.",
      },
      {
        heading: "Projects",
        text: "BioEvidence | Python, Flask, Docker\n- Built genomic analysis pipelines.",
      },
    ],
    claims: [],
    candidateClarifications: [
      {
        itemName: "BioEvidence",
        itemCategory: "project" as const,
        category: "dates",
        text: "I worked on it from March 2026 to June 2026",
        provenance: "candidate_interview_answer" as const,
      },
    ],
    unknowns: [],
    handedOff: false,
  };
  const tex = renderResumeDraftTex(draft);
  // Verify (Company/Org) is stripped from Experience
  assert.match(
    tex,
    /\\resumeexperience\{Software Engineer Intern\}\{June 2025 - August 2025\}\{MetaWatt\}/,
  );
  // Verify conversational date is sanitized into a clean date range in Projects
  assert.match(
    tex,
    /\\resumeproject\{BioEvidence\}\{Python, Flask, Docker\}\{March 2026 - June 2026\}/,
  );
});

