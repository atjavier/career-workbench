import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createCanvas } from "@napi-rs/canvas";

const outputPath = resolve("output/pdf/adrian-javier-oboda-resume-v22.pdf");
const pageWidth = 612;
const pageHeight = 792;
const left = 54;
const right = 568;
const content = [];
const measureContext = createCanvas(1, 1).getContext("2d");
measureContext.font = "9.25px Times New Roman";

function escapePdf(value) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}
function text(font, size, x, y, value) {
  content.push(`BT /${font} ${size} Tf 0 g 1 0 0 1 ${x} ${y} Tm (${escapePdf(value)}) Tj ET`);
}
function bulletMark(x, y) {
  content.push(`BT /F4 9 Tf 0 g 1 0 0 1 ${x} ${y} Tm (\\267) Tj ET`);
}
function section(y, label) {
  text("F2", 12, left, y, label.toUpperCase());
  content.push(`0.25 G 0.45 w ${left} ${y - 4} m ${right} ${y - 4} l S`);
  return y - 20;
}
function rightText(y, value, font = "F3", size = 9.7) {
  const factor = font === "F1" ? 0.51 : 0.48;
  text(font, size, right - value.length * size * factor, y, value);
}
function wrap(value) {
  const lines = [];
  let line = "";
  for (const word of value.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (measureContext.measureText(next).width > right - 82 && line) { lines.push(line); line = word; } else { line = next; }
  }
  if (line) lines.push(line);
  return lines;
}
function bullets(y, entries) {
  for (const entry of entries) {
    const lines = wrap(entry);
    bulletMark(70, y + 0.5);
    lines.forEach((line, index) => text("F2", 9.25, 82, y - index * 11.6, line));
    y -= lines.length * 11.6 + 1.75;
  }
  return y;
}
function experience(y, title, company, date, location, entries) {
  text("F1", 10.5, 70, y, title);
  rightText(y, date);
  y -= 14;
  text("F3", 9.7, 70, y, company);
  rightText(y, location);
  return bullets(y - 14, entries) - 4;
}
function project(y, title, detail, date, entries) {
  text("F1", 10.25, 70, y, title);
  text("F3", 9.65, 70 + title.length * 5.5 + 10, y, `| ${detail}`);
  if (date) rightText(y, date);
  return bullets(y - 15, entries) - 3;
}
function skill(y, label, value) {
  text("F1", 9.5, 70, y, `${label}:`);
  text("F2", 9.5, 70 + label.length * 4.85 + 7, y, value);
  return y - 12;
}

text("F2", 22, 212, 752, "Adrian Jericho Javier");
text("F2", 9.6, 66, 734, "Baguio City, Philippines | 09761708402 | adrianjerichojavier@gmail.com | github.com/atjavier | linkedin.com/in/atjavier");

let y = section(704, "Experience");
y = experience(y, "Software Engineering Intern (MatchVA)", "MetaWatt LLC", "June 2025 - July 2025", "Remote", [
  "Built Go and Supabase APIs for 3 applicant asset types - resumes, videos, and profile photos - so the platform can collect and maintain complete application portfolios.",
  "Built an admin review workflow for 3 application outcomes - approve, reject, or waitlist - to move pending candidates through a validated decision process with actionable errors.",
  "Refactored 5 dashboard and VA-profile workflows - AI onboarding, SOP upload, interview video, availability, and portfolios - into reusable React and TypeScript components that support consistent updates.",
  "Implemented 3 SendGrid communication flows - welcome, application status, and course certificates - to support timely candidate updates; documented and tested the backend behavior.",
]);
y = experience(y, "Student Assistant", "BIOMECH Department", "November 2025 - December 2025", "University Department", [
  "Automated document organization and form autofill to remove manual steps from routine BIOMECH administration.",
]);

y = section(y, "Education");
text("F1", 10.5, 70, y, "University of the Philippines Los Banos");
y -= 14;
text("F3", 9.7, 70, y, "BS Computer Science");
rightText(y, "2022 - 2026");
y = bullets(y - 14, ["Magna Cum Laude; GWA 1.4434; College Scholar; University Scholar."]) - 4;

y = section(y, "Projects");
y = project(y, "Personal Job Discovery Workspace", "Local AI Resume Coach | Next.js, TypeScript, SQLite, local LLM gateway", "", [
  "Built a private local workspace for captured postings, versioned candidate details, and evidence-backed resume materials so a candidate can tailor from one reviewed source of truth.",
  "Designed a consent-bound local Resume Coach that turns selected profile and approved Experience & Projects evidence into immutable draft guidance and explicit unknowns for review.",
  "Built consent-bound in-application workflows for evidence documentation, opportunity assessment, and Resume Coach guidance; defined LLM skill contracts as groundwork for future multi-skill tailoring.",
]);
y = project(y, "BioEvidence", "Full-Stack Bioinformatics Application", "", [
  "Designed a guided Dockerized Flask/SQLite application around a 6-stage VCF/SNV process to lower the CLI setup burden for beginning bioinformaticians, with progress, cancellation, and stage retry.",
  "Integrated 5 annotation and evidence sources - VEP, SnpEff, dbSNP, ClinVar, and gnomAD - into one traceable workflow so variants can move from classification through evidence review without manual cross-tool tracking.",
  "Designed 20+ REST endpoints and live SSE updates to expose runs, logs, results, artifacts, and evidence views; used run-scoped SQLite records and constraints to preserve workflow-level result integrity.",
]);
y = project(y, "ARTEMIS", "Backend Developer - Alumni Engagement Platform", "Mar 2025 - May 2025", [
  "Contributed backend services for 7 alumni-engagement workflows - profiles, events, RSVPs, job posts, announcements, notifications, and uploads - as part of the project team.",
  "Implemented JWT authentication, bcrypt hashing, refresh-token handling, and role-based authorization for 2 user roles to restrict protected React workflows appropriately.",
]);
y = project(y, "AgriMart", "Backend Developer - Course Project", "Mar 2025 - May 2025", [
  "Built the API foundation for an agricultural-goods marketplace with 3 validated domain models and a registration flow using bcrypt, duplicate-email protection, role validation, clear errors, and an explicit contract.",
]);

y = section(y, "Technical Skills");
y = skill(y, "Languages", "TypeScript/JavaScript, Go, Python, C, SQL");
y = skill(y, "Frameworks", "React, React Router, Next.js, Flask, Node.js/Express, Tailwind CSS");
y = skill(y, "Data & APIs", "REST APIs, Supabase (Postgres), SQLite, MongoDB, Mongoose, Server-Sent Events");
y = skill(y, "Tools", "Git/GitHub, Docker Compose, Swagger/Swaggo, Bruno, SendGrid, local LLM workflows, n8n");

if (y < 38) throw new Error(`Resume overflow: final baseline ${y}`);

const stream = content.join("\n");
const objects = [
  "<< /Type /Catalog /Pages 2 0 R >>",
  "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
  `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 5 0 R /F2 6 0 R /F3 7 0 R /F4 8 0 R >> >> /Contents 4 0 R >>`,
  `<< /Length ${Buffer.byteLength(stream, "ascii")} >>\nstream\n${stream}\nendstream`,
  "<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold >>",
  "<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman >>",
  "<< /Type /Font /Subtype /Type1 /BaseFont /Times-Italic >>",
  "<< /Type /Font /Subtype /Type1 /BaseFont /Symbol >>",
];
let pdf = "%PDF-1.4\n% resume\n";
const offsets = [0];
objects.forEach((object, index) => { offsets.push(Buffer.byteLength(pdf, "ascii")); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
const xref = Buffer.byteLength(pdf, "ascii");
pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
offsets.slice(1).forEach((offset) => { pdf += `${String(offset).padStart(10, "0")} 00000 n \n`; });
pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, pdf, "ascii");
console.log(outputPath);
