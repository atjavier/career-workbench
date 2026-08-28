import test from "node:test";
import assert from "node:assert/strict";

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
  assert.match(tex, /\\item GWA 1\.44 \| Magna Cum Laude/);
  assert.match(tex, /\\resumeskill\{Tools\}\{Git\}/);
});
