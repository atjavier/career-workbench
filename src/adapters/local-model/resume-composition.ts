import { cleanDateString, isPlaceholderTechStack } from "@/domain/resume-generation/resume-pdf";
import type { ResumeCoachRequest, ResumeProfileSnapshot } from "./local-model-contracts";
import { plain } from "./model-boundaries";

export function synthesizeSkills(request: ResumeCoachRequest): string {
  const skillCorpus = `${request.evidence.map((item) => item.factualText).join(" ")} ${(request.documentation ?? []).flatMap((group) => group.documents.map((document) => document.text)).join(" ")} ${(request.clarifications ?? []).map((c) => c.text).join(" ")}`;
  const skillCategories = [
    [
      "Languages",
      [
        "TypeScript",
        "JavaScript",
        "Go",
        "Python",
        "C",
        "C++",
        "Rust",
        "Java",
        "SQL",
        "HTML",
        "CSS",
      ],
    ],
    [
      "Frameworks",
      [
        "React",
        "Next.js",
        "React Router",
        "Node.js",
        "Express",
        "Flask",
        "FastAPI",
        "Vite",
        "Tailwind CSS",
      ],
    ],
    [
      "Data & APIs",
      [
        "SQLite",
        "PostgreSQL",
        "MySQL",
        "MongoDB",
        "Mongoose",
        "Supabase",
        "REST APIs",
        "Server-Sent Events",
        "Swagger",
      ],
    ],
    [
      "Tools",
      [
        "Git",
        "GitHub",
        "Docker",
        "Docker Compose",
        "Bruno",
        "Postman",
        "SendGrid",
        "n8n",
        "Trello",
        "ClickUp",
        "VS Code",
        "LM Studio",
      ],
    ],
  ];
  return skillCategories
    .map(
      ([label, names]) =>
        `${label}: ${(names as string[]).filter((item) => new RegExp(`\\b${item.replace(/[.+]/g, "\\$&")}\\b`, "i").test(skillCorpus)).join(", ")}`,
    )
    .filter((line) => !line.endsWith(": "))
    .join("\n");
}

export function synthesizeEducation(request: ResumeCoachRequest): string {
  let profile: ResumeProfileSnapshot = {};
  try {
    const parsed = JSON.parse(request.profileSnapshot);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
      profile = parsed as ResumeProfileSnapshot;
  } catch {
    return "";
  }
  const school = profileValue(profile.school);
  const program = profileValue(profile.program);
  if (!school && !program) return "";
  const headerParts = [
    school,
    program,
    profile.graduationYear !== undefined && profile.graduationYear !== null
      ? String(profile.graduationYear)
      : undefined,
  ].filter(Boolean);
  const honorParts = [
    profileValue(profile.latinHonors),
    profileValue(profile.gwa) ? `GWA ${profileValue(profile.gwa)}` : undefined,
  ].filter(Boolean);
  if (honorParts.length > 0) {
    return `${headerParts.join(" | ")}\n- ${honorParts.join(" | ")}`;
  }
  return headerParts.join(" | ");
}

export function extractDateFromDocs(docs: Array<{ text: string }>): string {
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const regex =
    /\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(?:\d{1,2}(?:\s*[\u2013\u2014\-–—]\s*\d{1,2})?,?\s+)?((?:19|20)\d{2})\b/gi;
  const isoRegex = /\b((?:19|20)\d{2})-(\d{2})(?:-\d{2})?\b/g;
  const found: Array<{ monthIdx: number; month: string; year: number; score: number }> = [];
  let hasOngoingIndicator = false;
  for (const doc of docs) {
    if (/(?:still\s+under\s+development|in\s+active\s+development|present|ongoing|underway)/i.test(doc.text)) {
      hasOngoingIndicator = true;
    }
    let match: RegExpExecArray | null;
    while ((match = regex.exec(doc.text)) !== null) {
      const rawMonth = match[1]!;
      const year = parseInt(match[2]!, 10);
      const mIdx = months.findIndex((m) =>
        m.toLowerCase().startsWith(rawMonth.toLowerCase().slice(0, 3)),
      );
      if (mIdx >= 0) {
        found.push({ monthIdx: mIdx, month: months[mIdx]!, year, score: year * 12 + mIdx });
      }
    }
    let isoMatch: RegExpExecArray | null;
    while ((isoMatch = isoRegex.exec(doc.text)) !== null) {
      const year = parseInt(isoMatch[1]!, 10);
      const mIdx = parseInt(isoMatch[2]!, 10) - 1;
      if (mIdx >= 0 && mIdx < 12) {
        found.push({ monthIdx: mIdx, month: months[mIdx]!, year, score: year * 12 + mIdx });
      }
    }
  }
  if (!found.length) return "";
  found.sort((a, b) => a.score - b.score);
  const earliest = found[0]!;
  const latest = found[found.length - 1]!;
  if (hasOngoingIndicator) {
    return `${earliest.month} ${earliest.year} – Present`;
  }
  if (earliest.score === latest.score) {
    return `${earliest.month} ${earliest.year}`;
  }
  return `${earliest.month} ${earliest.year} – ${latest.month} ${latest.year}`;
}

export function extractTechStackFromDocs(
  docs: Array<{ path?: string; text: string }>,
): string {
  for (const doc of docs) {
    const match = /##\s*Core Technologies\s*\r?\n+([^\r\n#]+)/i.exec(doc.text);
    if (match && match[1]?.trim()) {
      const candidate = match[1].trim().replace(/^[-*•]\s*/, "");
      if (candidate && !isPlaceholderTechStack(candidate)) {
        return candidate;
      }
    }
  }

  return "";
}

const STOP_WORDS = new Set([
  "the", "and", "with", "for", "from", "that", "this", "into", "using", "used",
  "have", "has", "had", "are", "were", "been", "their", "which", "about", "across",
  "through", "during", "before", "after", "above", "below", "between", "under",
  "again", "further", "then", "once", "here", "there", "when", "where", "why",
  "how", "all", "any", "both", "each", "few", "more", "most", "other", "some",
  "such", "no", "nor", "not", "only", "own", "same", "so", "than", "too", "very",
  "can", "will", "just", "should", "now", "also", "its", "our", "per"
]);

export function contentTokens(text: string): Set<string> {
  const words = text.toLowerCase().match(/[a-z0-9_-]{3,}/g) || [];
  return new Set(words.filter((w) => !STOP_WORDS.has(w)));
}

export function tokenSimilarity(textA: string, textB: string): number {
  const setA = contentTokens(textA);
  const setB = contentTokens(textB);
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const t of setA) {
    if (setB.has(t)) intersection++;
  }
  return intersection / Math.min(setA.size, setB.size);
}

export function sanitizeBulletText(bullet: string): string {
  const cleaned = bullet
    .replace(/^[-•*]\s*/, "")
    .replace(/[`]/g, "")
    .replace(/[\u2192\u2794\u2799\u279c\u27a1]/g, "->")
    .replace(/[\u2190\u2b05]/g, "<-")
    .replace(/[\u2194\u2b0c]/g, "<->")
    .replace(/[\u21d2]/g, "=>")
    .replace(/[\u2013\u2014\u2212]/g, "-")
    .replace(/\s*\?\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned;
}

export function matchesDocGroupName(docGroupName: string, targetName: string): boolean {
  if (!docGroupName || !targetName) return false;
  const cleanDoc = docGroupName.toLowerCase().replace(/[^a-z0-9]/g, "");
  const cleanTarget = targetName.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!cleanDoc || !cleanTarget) return false;
  return (
    cleanDoc.includes(cleanTarget) ||
    cleanTarget.includes(cleanDoc) ||
    (cleanDoc.length >= 10 && cleanTarget.length >= 10 && cleanDoc.slice(0, 15) === cleanTarget.slice(0, 15))
  );
}

export function extractCandidateBulletsFromDocs(
  docs: Array<{ path?: string; libraryPath?: string; absolutePath?: string; text: string }>
): string[] {
  const bullets: string[] = [];
  const candidateDoc = docs.find((d) =>
    /resume-bullet-candidates/i.test(
      d.path ?? (d as any).libraryPath ?? (d as any).absolutePath ?? ""
    )
  );
  if (!candidateDoc) return bullets;
  const bRegex = /###\s+B-\d+[\s\S]*?(?:^|\n)\s*-\s*(?:Candidate:\s*)?([^\n]+)/g;
  let match: RegExpExecArray | null;
  while ((match = bRegex.exec(candidateDoc.text)) !== null) {
    const b = sanitizeBulletText(match[1]!);
    if (b && !bullets.includes(b)) {
      bullets.push(b);
    }
  }
  if (!bullets.length) {
    const fallbackRegex = /^\s*-\s*(?:Candidate:\s*)?([^\n]+)/gm;
    while ((match = fallbackRegex.exec(candidateDoc.text)) !== null) {
      const b = sanitizeBulletText(match[1]!);
      if (b && !bullets.includes(b)) {
        bullets.push(b);
      }
    }
  }
  return bullets;
}

export function classifyCapabilityPillar(bullet: string): 1 | 2 | 3 {
  const lower = bullet.toLowerCase();
  // Pillar 3: Integration / Pipeline / Tooling / Runtime / Security / Gateway
  if (
    /\b(docker|wsl2|ensembl|vep|snpeff|swagger|bruno|sendgrid|api|endpoints|middleware|rest|restful|pipeline|sse|gateway|runtime|tools|tooling|waitress)\b/i.test(
      lower
    )
  ) {
    return 3;
  }
  // Pillar 2: Architecture / Data Integrity
  if (
    /\b(architecture|architected|backend|go\b|golang|sqlite|database|persistence|transaction|atomic|guarded|referential|constraints|supabase|schema|storage|versioned|immutable)\b/i.test(
      lower
    )
  ) {
    return 2;
  }
  // Pillar 1: Feature Scope / User Workflow / Frontend
  return 1;
}

export function hasTechnicalSubstance(bullet: string): boolean {
  return /\b(go|golang|react|typescript|javascript|python|flask|sqlite|supabase|postgres|docker|wsl2|ensembl|vep|snpeff|swagger|bruno|sendgrid|next\.js|api|apis|rest|restful|sse|graphql|waitress|jwt|bcrypt|oauth|transactions?|schema|schemas|atomic|guarded|local model|workspace|subsystem|pipeline|monolith|audit|metadata|templates?|components?|workflows?|endpoints?|services?)\b/i.test(
    bullet
  );
}

export function enrichAndCompleteBullets(
  modelBullets: string[],
  candidateBullets: string[],
  maxBullets = 3
): string[] {
  const result: string[] = [];
  const used = new Set<string>();

  for (const raw of modelBullets) {
    const cleaned = sanitizeBulletText(raw);
    if (cleaned && !used.has(cleaned.toLowerCase())) {
      result.push(cleaned);
      used.add(cleaned.toLowerCase());
      if (result.length >= maxBullets) break;
    }
  }

  // If the model returned fewer than maxBullets, supplement with candidate bullets
  if (result.length < maxBullets && candidateBullets.length > 0) {
    for (const raw of candidateBullets) {
      const cleaned = sanitizeBulletText(raw);
      if (cleaned && !used.has(cleaned.toLowerCase())) {
        result.push(cleaned);
        used.add(cleaned.toLowerCase());
        if (result.length >= maxBullets) break;
      }
    }
  }

  return result.slice(0, maxBullets);
}

export function convertFlatEntriesToEdits(
  entries: unknown[],
  sessionRoots: Array<{ rootId: string; label: string; name?: string; category?: string }> = [],
  clarifications: ResumeCoachRequest["clarifications"] = [],
  documentation: ResumeCoachRequest["documentation"] = [],
): Array<Record<string, unknown>> {
  const edits: Array<Record<string, unknown>> = [];

  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const item = entry as Record<string, unknown>;
    const rawSection = String(
      item.section || item.slot || item.slotId || (item.organization ? "experience" : "projects"),
    ).toLowerCase();
    const isExperience = /(?:experience|employment|work)/i.test(rawSection);
    const slotId = isExperience ? "experience" : "projects";

    const rawBullets = Array.isArray(item.bullets)
      ? item.bullets
      : typeof item.bullet === "string"
        ? [item.bullet]
        : typeof item.text === "string"
          ? String(item.text).split(/\r?\n/).filter((l: string) => /^\s*[-*•]/.test(l))
          : [];

    const bullets: string[] = rawBullets
      .map((b: unknown) => sanitizeBulletText(String(b ?? "").trim()))
      .filter(Boolean);
    if (!bullets.length) continue;

    const isPlaceholderDate = (d: string) =>
      !d ||
      /^(?:\[?\s*(?:unknown|not\s+(?:provided|specified|available)|dates?\s+not\s+(?:provided|specified|available)|n\/?a|none)\s*\]?)$/i.test(d.trim());

    let headerLine = "";
    if (isExperience) {
      let rawCompany = String(
        item.organization || item.company || item.name || "",
      ).trim().replace(/\s*\((?:Company\/Org|Company|Org|Organization)\)\s*$/i, "");
      let company = rawCompany;
      let title = String(item.title || item.role || "Software Engineer").trim();
      let dates = String(item.dates || item.date || "").trim();

      if (rawCompany.includes("|")) {
        const parts = rawCompany.split("|").map((p) => p.trim()).filter(Boolean);
        if (parts.length >= 2) {
          title = parts[0]!;
          company = parts[1]!;
          if (parts[2] && (!dates || isPlaceholderDate(dates))) dates = parts[2];
        }
      }

      if (!company) {
        const expRoot = sessionRoots.find((r) => r.category === "experience");
        company = expRoot?.name || "Company";
      }
      const validDateRegex =
        /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?|\d{4}-\d{2})\b/i;
      if (isPlaceholderDate(dates) || (dates && !validDateRegex.test(dates))) {
        dates = "";
        const matchingClarification = clarifications?.find(
          (c) =>
            (matchesDocGroupName(c.itemName ?? "", company) ||
              (c.itemName && (company.toLowerCase().includes(c.itemName.toLowerCase()) || c.itemName.toLowerCase().includes(company.toLowerCase())))) &&
            validDateRegex.test(c.text),
        );
        if (matchingClarification) {
          const dateMatch =
            /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{4}\b(?:\s*[\u2013\u2014\-–—]\s*(?:(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{4}|Present|Current))?/i.exec(
              matchingClarification.text,
            );
          if (dateMatch) dates = dateMatch[0];
          
        }
        if (!dates && documentation?.length) {
          const matchingDocGroup = documentation.find(
            (g) =>
              (company && matchesDocGroupName(g.name, company)) ||
              (g.category === "experience" &&
                documentation.filter((d) => d.category === "experience").length === 1),
          );
          if (matchingDocGroup?.documents.length) {
            dates = extractDateFromDocs(matchingDocGroup.documents);
          }
        }
      }
      if (dates) dates = cleanDateString(dates);
      headerLine = dates ? `${title} | ${company} | ${dates}` : `${title} | ${company}`;

      if (documentation?.length) {
        const matchingDocGroup = documentation.find(
          (g) =>
            (company && matchesDocGroupName(g.name, company)) ||
            (g.category === "experience" &&
              documentation.filter((d) => d.category === "experience").length === 1),
        );
        if (matchingDocGroup?.documents.length) {
          const candidateBullets = extractCandidateBulletsFromDocs(
            matchingDocGroup.documents,
          );
          const enriched = enrichAndCompleteBullets(bullets, candidateBullets, 3);
          bullets.splice(0, bullets.length, ...enriched);
        }
      }
    } else {
      let rawName = String(item.name || item.title || "").trim();
      let name = rawName;
      let descriptor = String(item.descriptor || item.subtitle || "").trim();
      let techStack = String(item.techStack || item.technologies || item.tech || "").trim();
      let dates = String(item.dates || item.date || "").trim();

      if (rawName.includes("|")) {
        const parts = rawName.split("|").map((p) => p.trim()).filter(Boolean);
        name = parts[0] || name;
        if (!descriptor && parts[1]) descriptor = parts[1];
        if (!techStack && parts[2]) techStack = parts[2];
        if (!dates && parts[3]) dates = parts[3];
      }

      if (!name) {
        const projRoot = sessionRoots.find((r) => r.category === "project" || !r.category);
        name = projRoot?.name || "Project";
      }
      if (!descriptor || descriptor.toLowerCase() === "full-stack application") {
        if (!descriptor) {
          descriptor = "Full-Stack Application";
        }
      }
      if (!techStack || isPlaceholderTechStack(techStack)) {
        techStack = "";
        if (documentation?.length) {
          const matchingDocGroup = documentation.find(
            (g) =>
              name &&
              (matchesDocGroupName(g.name, name) ||
                g.name.toLowerCase().includes(name.toLowerCase()) ||
                name.toLowerCase().includes(g.name.toLowerCase())),
          );
          if (matchingDocGroup?.documents.length) {
            techStack = extractTechStackFromDocs(matchingDocGroup.documents);
          }
        }
        if (!techStack && sessionRoots.length) {
          const matchingRoot = sessionRoots.find(
            (r) =>
              name &&
              r.name &&
              (matchesDocGroupName(r.name, name) ||
                r.name.toLowerCase().includes(name.toLowerCase()) ||
                name.toLowerCase().includes(r.name.toLowerCase())),
          );
          if (matchingRoot && (matchingRoot as Record<string, unknown>).techStack) {
            techStack = String((matchingRoot as Record<string, unknown>).techStack);
          }
        }
      }
      const validDateRegex =
        /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?|\d{4}-\d{2})\b/i;
      if (isPlaceholderDate(dates) || (dates && !validDateRegex.test(dates))) {
        dates = "";
        const matchingClarification = clarifications?.find(
          (c) =>
            name &&
            (matchesDocGroupName(c.itemName ?? "", name) ||
              (c.itemName && (name.toLowerCase().includes(c.itemName.toLowerCase()) || c.itemName.toLowerCase().includes(name.toLowerCase())))) &&
            validDateRegex.test(c.text),
        );
        if (matchingClarification) {
          const dateMatch =
            /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{4}\b(?:\s*[\u2013\u2014\-–—]\s*(?:(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{4}|Present|Current))?/i.exec(
              matchingClarification.text,
            );
          if (dateMatch) {
            dates = dateMatch[0];
          }
        }
        if (!dates && documentation?.length) {
          const matchingDocGroup = documentation.find(
            (g) =>
              name &&
              (matchesDocGroupName(g.name, name) ||
                g.name.toLowerCase().includes(name.toLowerCase()) ||
                name.toLowerCase().includes(g.name.toLowerCase())),
          );
          if (matchingDocGroup?.documents.length) {
            dates = extractDateFromDocs(matchingDocGroup.documents);
          }
        }
      }
      if (dates) dates = cleanDateString(dates);

      if (documentation?.length) {
        const matchingDocGroup = documentation.find(
          (g) =>
            name &&
            (matchesDocGroupName(g.name, name) ||
              g.name.toLowerCase().includes(name.toLowerCase()) ||
              name.toLowerCase().includes(g.name.toLowerCase())),
        );
        if (matchingDocGroup?.documents.length) {
          const candidateBullets = extractCandidateBulletsFromDocs(
            matchingDocGroup.documents,
          );
          const enriched = enrichAndCompleteBullets(bullets, candidateBullets, 3);
          bullets.splice(0, bullets.length, ...enriched);
        }
      }

      if (dates && techStack) {
        headerLine = `${name} | ${descriptor} | ${techStack} | ${dates}`;
      } else if (techStack) {
        headerLine = `${name} | ${descriptor} | ${techStack}`;
      } else if (dates) {
        headerLine = `${name} | ${descriptor} | ${dates}`;
      } else {
        headerLine = `${name} | ${descriptor}`;
      }
    }

    const bulletLines = bullets.map((b) => (b.startsWith("- ") ? b : `- ${b}`));
    const text = `${headerLine}\n${bulletLines.join("\n")}`;

    const claims = bullets.map((b) => {
      const cleanBullet = b.replace(/^[-•*]\s*/, "").trim();
      return {
        text: cleanBullet,
        citations: [{ path: "resume-evidence.md" }],
      };
    });

    edits.push({
      slotId,
      text,
      claims,
    });
  }

  return edits;
}




export const resumeBulletMarker = /^\s*[-*\u2022]\s+/;


export function profileValue(value: unknown): string | undefined {
  return typeof value === "string" && plain(value, 240) ? value : undefined;
}


export function resumeProjectName(sourceDocument?: string): string {
  const match = sourceDocument?.match(/(?:projects|experiences)\/([^/]+)\//i);
  return match?.[1]?.replace(/[-_]+/g, " ").trim() || "Documented Project";
}
