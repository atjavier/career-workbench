"use client";

import Link from "next/link";
import { useState, useMemo, type ReactNode } from "react";
import type { ExperienceProjectCollection } from "@/domain/evidence/evidence-library";
import { SegmentedTabs } from "@/app/segmented-tabs";

type ParsedBullet = {
  id: string;
  text: string;
  category: string;
};

type TechCategory = {
  category: string;
  items: string[];
};

const BULLETS_PER_PAGE = 5;

function formatInlineText(text: string): ReactNode {
  const parts: ReactNode[] = [];
  const regex = /(\*\*.*?\*\*|`.*?`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    const chunk = match[0];
    if (chunk.startsWith("**") && chunk.endsWith("**")) {
      parts.push(<strong key={match.index}>{chunk.slice(2, -2)}</strong>);
    } else if (chunk.startsWith("`") && chunk.endsWith("`")) {
      parts.push(
        <code key={match.index} className="inline-code">
          {chunk.slice(1, -1)}
        </code>,
      );
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }
  return parts.length > 0 ? parts : text;
}

function isUnhelpfulValue(text?: string | null): boolean {
  if (!text) return true;
  const clean = text.trim().toLowerCase();
  return (
    clean === "" ||
    clean.includes("not directly evidenced") ||
    clean.includes("not evidenced") ||
    clean.includes("no supported") ||
    clean.includes("not specified") ||
    clean.includes("none found") ||
    clean.includes("conservative wording based only") ||
    clean.includes("atomic, verified capability") ||
    clean.startsWith("placeholder:") ||
    clean.startsWith("unknown:")
  );
}

function sanitizeFilePathsAndCode(text: string): string {
  return text
    .replace(/\s*\(`?(?:GET|POST|PUT|PATCH|DELETE)\s+[^)]+`?\)/gi, "")
    .replace(/`?(?:GET|POST|PUT|PATCH|DELETE)\s+\/[a-zA-Z0-9_./<-]+`?/gi, "")
    .replace(/(?:under|in|from|at|into)\s+`?[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_./-]+`?(?:\s+(?:with|and)\s+(?:API\s+routes|routes|entry points|files)\s+(?:in|under)\s+`?[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_./-]+`?)?/gi, "")
    .replace(/entry points are [^;.]+[;.]?/gi, "")
    .replace(/\s*\(`?[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_./-]+`?\)/gi, "")
    .replace(/`[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_./-]+`/g, "")
    .replace(/\b(?:src|app|api|components|instance|tests?|lib|utils|pages)\/[a-zA-Z0-9_./-]+\b/gi, "")
    .replace(/\b[a-zA-Z0-9_-]+\.(?:db|sqlite|md|tex|json|ts|tsx|js|mjs|py|go|html|css)\b/gi, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/;\s*;/g, ";")
    .trim();
}

function cleanContentLine(line: string): string {
  const base = line
    .replace(/^[-*+]\s+/, "")
    .replace(/\s*—\s*Source:.*$/i, "")
    .replace(/\s*Source:.*$/i, "")
    .replace(/Placeholder:\s*file:\{[^}]+\}/gi, "")
    .replace(/\r?\n\s*/g, " ")
    .trim();
  return sanitizeFilePathsAndCode(base);
}

function classifyBullet(text: string): string {
  const lower = text.toLowerCase();
  if (/\b(test suite|testing|tests?\b|qa)\b/.test(lower)) {
    return "Testing & Quality";
  }
  if (
    /\b(domain logic|persistence repositories|architect|monolith|modular|local-first|privacy|security|encryption|resume management|versioned|policy-driven|model gateway)\b/.test(
      lower,
    )
  ) {
    return "Architecture & Systems";
  }
  if (
    /\b(backend|api|endpoint|endpoints|go\b|golang|supabase|sendgrid|swagger|bruno|validator|database|storage|file management|email)\b/.test(
      lower,
    )
  ) {
    return "Backend & APIs";
  }
  if (
    /\b(ui|dashboard|modals?|components?|react|frontend|layout|router 7|onboarding)\b/.test(
      lower,
    )
  ) {
    return "Frontend & UI";
  }
  if (
    /\b(automation|n8n|tooling|neovim|workflow|ci|cd|pipeline|git|pull request|pr|rebase|collaborat)\b/.test(
      lower,
    )
  ) {
    return "DevOps & Workflow";
  }
  return "Engineering";
}

function extractRole(item: ExperienceProjectCollection): string | null {
  if (item.category !== "experience") return null;
  const docs = item.documents ?? [];
  const clarDoc = docs.find((d) => d.name === "resume-clarifications.md");
  if (clarDoc) {
    const roleMatch = clarDoc.text.match(
      /##\s*role\s*\n\s*-\s*Candidate-provided answer:\s*([^\r\n]+)/i,
    );
    if (roleMatch && roleMatch[1]?.trim()) {
      return roleMatch[1].trim();
    }
  }
  const overviewDoc = docs.find((d) => d.name === "experience-overview.md");
  if (overviewDoc) {
    const directMatch = overviewDoc.text.match(
      /-\s*\*\*(?:Role|Position|Title)\s*(?::\*\*|\*\*:\s*|:)\s*([^\r\n]+)/i,
    );
    if (directMatch && directMatch[1]?.trim()) {
      return directMatch[1].trim();
    }
    const scopeMatch = overviewDoc.text.match(
      /(?:Role Transition & Scope|Role & Scope|Scope)\s*(?::\*\*|\*\*:\s*|:)\s*(?:Executed\s+(?:a\s+)?)?([^.]+?intern(?:ship)?)/i,
    );
    if (scopeMatch && scopeMatch[1]?.trim()) {
      const matchText = scopeMatch[1].trim();
      if (/full-stack/i.test(matchText)) {
        return "Full-Stack Software Engineering Intern";
      }
      return matchText.charAt(0).toUpperCase() + matchText.slice(1);
    }
  }
  return "Software Engineering Intern";
}

const KNOWN_TECH: Array<{ match: RegExp; label: string }> = [
  { match: /\bPython\b/i, label: "Python" },
  { match: /\bTypeScript\b/i, label: "TypeScript" },
  { match: /\bReact\b/i, label: "React" },
  { match: /\b(?:Next\.js|Nextjs)\b/i, label: "Next.js" },
  { match: /\bGo\b|\bGolang\b/i, label: "Go" },
  { match: /\bFlask\b/i, label: "Flask" },
  { match: /\bFastAPI\b/i, label: "FastAPI" },
  { match: /\bDjango\b/i, label: "Django" },
  { match: /\bSupabase\b/i, label: "Supabase" },
  { match: /\bSQLite\b/i, label: "SQLite" },
  { match: /\bPostgreSQL\b|\bPostgres\b/i, label: "PostgreSQL" },
  { match: /\bDocker(?: Compose)?\b/i, label: "Docker" },
  { match: /\bWaitress\b/i, label: "Waitress" },
  { match: /\bSendGrid\b/i, label: "SendGrid" },
  { match: /\bSwagger\b/i, label: "Swagger" },
  { match: /\bn8n\b/i, label: "n8n" },
  { match: /\bBruno\b/i, label: "Bruno" },
  { match: /\bNode(?:\.js)?\b/i, label: "Node.js" },
  { match: /\bJavaScript\b/i, label: "JavaScript" },
  { match: /\bTailwind(?: CSS)?\b/i, label: "Tailwind CSS" },
  { match: /\bEnsembl VEP\b|\bVEP\b/i, label: "Ensembl VEP" },
  { match: /\bSnpEff\b/i, label: "SnpEff" },
  { match: /\bpdfjs-dist\b|\bPDF\.js\b/i, label: "PDF.js" },
  { match: /\bGraphQL\b/i, label: "GraphQL" },
  { match: /\bRedis\b/i, label: "Redis" },
];

function extractTechStack(item: ExperienceProjectCollection): string[] {
  const docs = item.documents ?? [];
  const textCorpus = docs.map((d) => d.text).join("\n");
  const techSet = new Set<string>();

  for (const { match, label } of KNOWN_TECH) {
    if (match.test(textCorpus)) {
      techSet.add(label);
    }
  }

  const techStackDoc = docs.find((d) => d.name === "technology-stack.md");
  if (techStackDoc) {
    const lines = techStackDoc.text.split(/\r?\n/);
    for (const line of lines) {
      if (line.startsWith("|") && !line.includes("---") && !line.includes("Category")) {
        const parts = line.split("|").map((p) => p.trim()).filter(Boolean);
        if (parts.length >= 2) {
          const categoryCol = parts[0].toLowerCase();
          const rawDetail = parts[1];

          // If container orchestration or an image reference, map to Docker and skip container name
          if (categoryCol.includes("container") || /image:/i.test(rawDetail)) {
            techSet.add("Docker");
            continue;
          }

          const cleanName = rawDetail
            .replace(/^`([^`]+)`.*$/, "$1")
            .replace(/^[a-z]+:\s*/i, "")
            .replace(/[<>=^~].*$/, "")
            .trim();
          if (
            cleanName &&
            cleanName.length <= 25 &&
            !cleanName.includes("/") &&
            !cleanName.includes(" ") &&
            !cleanName.includes(":") &&
            !/latest|nightly/i.test(cleanName) &&
            !/^(@types|eslint)/i.test(cleanName) &&
            !/^(react-dom|next|pdfjs-dist|tsx|ts-node|vitest|jest|nodemon)$/i.test(cleanName)
          ) {
            const capitalized =
              cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
            if (!Array.from(techSet).some((existing) => existing.toLowerCase() === cleanName.toLowerCase())) {
              techSet.add(capitalized);
            }
          }
        }
      }
    }
  }

  return Array.from(techSet);
}

function categorizeTech(techList: string[]): TechCategory[] {
  const buckets: Record<string, string[]> = {
    "Languages": [],
    "Frontend": [],
    "Backend & Cloud": [],
    "Tools & Workflow": [],
  };

  const languageSet = new Set(["Python", "TypeScript", "JavaScript", "Go", "Golang", "HTML", "CSS", "SQL"]);
  const frontendSet = new Set(["React", "Next.js", "Tailwind CSS", "React Router 7", "PDF.js", "Vue", "Svelte"]);
  const backendSet = new Set(["FastAPI", "Flask", "Django", "Node.js", "Supabase", "SQLite", "PostgreSQL", "Postgres", "Redis", "GraphQL", "Swagger", "Bruno", "Waitress", "SendGrid"]);
  const toolsSet = new Set(["Docker", "n8n", "Neovim", "Git", "Ensembl VEP", "SnpEff"]);

  const otherItems: string[] = [];

  for (const tech of techList) {
    if (languageSet.has(tech)) {
      buckets["Languages"].push(tech);
    } else if (frontendSet.has(tech)) {
      buckets["Frontend"].push(tech);
    } else if (backendSet.has(tech)) {
      buckets["Backend & Cloud"].push(tech);
    } else if (toolsSet.has(tech)) {
      buckets["Tools & Workflow"].push(tech);
    } else {
      otherItems.push(tech);
    }
  }

  const result: TechCategory[] = [];
  for (const [category, items] of Object.entries(buckets)) {
    if (items.length > 0) {
      result.push({ category, items });
    }
  }
  if (otherItems.length > 0) {
    result.push({ category: "Other", items: otherItems });
  }
  return result;
}

function extractNarrativeSummary(item: ExperienceProjectCollection): string {
  const docs = item.documents ?? [];
  const overviewDoc = docs.find(
    (d) => d.name === "project-overview.md" || d.name === "experience-overview.md",
  );
  const bulletDoc = docs.find((d) => d.name === "resume-bullet-candidates.md");

  // Strategy 1: Extract from resume-bullet-candidates.md if structured context is rich
  if (bulletDoc) {
    const userWorkflowMatch = bulletDoc.text.match(
      /(?:\*\*User or workflow\*\*|User or workflow):\s*([^\r\n]+(?:\r?\n(?![-*#]|\*\*)[^\r\n]+)*)/i,
    );
    const outcomeMatch = bulletDoc.text.match(
      /(?:\*\*Directly stated outcome\*\*|Directly stated outcome):\s*([^\r\n]+(?:\r?\n(?![-*#]|\*\*)[^\r\n]+)*)/i,
    );
    const purposeMatch = bulletDoc.text.match(
      /(?:\*\*Purpose\*\*|Purpose):\s*([^\r\n]+(?:\r?\n(?![-*#]|\*\*)[^\r\n]+)*)/i,
    );

    const parts: string[] = [];
    if (userWorkflowMatch && !isUnhelpfulValue(userWorkflowMatch[1])) {
      parts.push(cleanContentLine(userWorkflowMatch[1]));
    } else if (purposeMatch && !isUnhelpfulValue(purposeMatch[1])) {
      parts.push(cleanContentLine(purposeMatch[1]));
    }

    if (outcomeMatch && !isUnhelpfulValue(outcomeMatch[1])) {
      parts.push(cleanContentLine(outcomeMatch[1]));
    }

    if (parts.length > 0) {
      const combined = parts.join(" ");
      const words = combined.split(/\s+/).length;
      if (words >= 40) {
        return combined;
      }
    }
  }

  // Strategy 2: Extract from project-overview.md or experience-overview.md
  if (overviewDoc) {
    const lines = overviewDoc.text.split(/\r?\n/);
    const sections: Array<{ label: string; text: string }> = [];

    for (const line of lines) {
      const match = line.match(/^[-*]\s*\*\*([^*:]+)(?:\*\*:\s*|:\*\*\s*)(.*)$/);
      if (!match) continue;
      const label = match[1].trim();
      const content = cleanContentLine(match[2].trim());
      if (
        !isUnhelpfulValue(content) &&
        !/direct evidence gaps|limitations|unknowns|attribution gaps|repository shape|repo shape/i.test(label)
      ) {
        sections.push({ label, text: content });
      }
    }

    if (sections.length > 0) {
      const mainSection = sections.find((s) =>
        /^project purpose$|^purpose$|^role transition & scope$|^role & scope$|^scope$/i.test(
          s.label,
        ),
      );

      const otherSections = sections.filter((s) => s !== mainSection);
      const narrativeParagraphs: string[] = [];

      if (mainSection) {
        narrativeParagraphs.push(mainSection.text);
      }

      let currentWordCount = mainSection ? mainSection.text.split(/\s+/).length : 0;
      const supportingSentences: string[] = [];

      for (const section of otherSections) {
        const sectionWords = section.text.split(/\s+/).length;
        if (currentWordCount + sectionWords <= 250) {
          supportingSentences.push(section.text);
          currentWordCount += sectionWords;
        } else if (currentWordCount < 100) {
          const firstSentence = section.text.split(/\.\s+/)[0] + ".";
          supportingSentences.push(firstSentence);
          currentWordCount += firstSentence.split(/\s+/).length;
        }
      }

      if (supportingSentences.length > 0) {
        narrativeParagraphs.push(supportingSentences.join(" "));
      }

      const fullNarrative = narrativeParagraphs.join("\n\n");
      if (fullNarrative.trim().length > 0) {
        return fullNarrative;
      }
    }
  }

  // Fallback: item.summary
  if (item.summary && !isUnhelpfulValue(item.summary)) {
    return cleanContentLine(item.summary);
  }

  return "No description documented yet for this item.";
}

function parseBulletCandidates(docText: string): ParsedBullet[] {
  const bullets: ParsedBullet[] = [];
  const blocks = docText.split(/###\s+(B-\d+)/i);

  for (let i = 1; i < blocks.length; i += 2) {
    const id = blocks[i].trim();
    const content = blocks[i + 1] ?? "";

    const candidateMatch = content.match(
      /-\s*(?:Candidate:)?\s*([^\r\n]+(?:\r?\n(?!-\s*(?:Supporting evidence|Explicit unknowns|Status):)[^\r\n]+)*)/i,
    );

    if (candidateMatch && candidateMatch[1]?.trim()) {
      const text = cleanContentLine(candidateMatch[1]);
      if (!isUnhelpfulValue(text)) {
        bullets.push({ id, text, category: classifyBullet(text) });
      }
    }
  }

  if (bullets.length === 0) {
    const lines = docText.split(/\r?\n/);
    let index = 1;
    for (const line of lines) {
      const match = line.match(/^[-*]\s*(?:Candidate:)?\s*(.*)$/i);
      if (match && match[1]?.trim()) {
        const text = cleanContentLine(match[1]);
        if (!isUnhelpfulValue(text)) {
          bullets.push({
            id: `B-${String(index).padStart(3, "0")}`,
            text,
            category: classifyBullet(text),
          });
          index++;
        }
      }
    }
  }

  return bullets;
}

export function EvidenceDetailsWorkspace({
  item,
  requestedName,
}: {
  item?: ExperienceProjectCollection;
  requestedName?: string;
}) {
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [currentPage, setCurrentPage] = useState<number>(1);

  const docs = item?.documents ?? [];
  const bulletDoc = docs.find((d) => d.name === "resume-bullet-candidates.md");
  const bullets = useMemo(
    () => (bulletDoc ? parseBulletCandidates(bulletDoc.text) : []),
    [bulletDoc],
  );

  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    bullets.forEach((b) => cats.add(b.category));
    return ["All", ...Array.from(cats).sort()];
  }, [bullets]);

  const filteredBullets = useMemo(() => {
    if (selectedCategory === "All") return bullets;
    return bullets.filter((b) => b.category === selectedCategory);
  }, [bullets, selectedCategory]);

  const totalPages = Math.ceil(filteredBullets.length / BULLETS_PER_PAGE) || 1;
  const startIndex = (currentPage - 1) * BULLETS_PER_PAGE;
  const paginatedBullets = useMemo(() => {
    return filteredBullets.slice(startIndex, startIndex + BULLETS_PER_PAGE);
  }, [filteredBullets, startIndex]);

  const handleCategoryChange = (cat: string) => {
    setSelectedCategory(cat);
    setCurrentPage(1);
  };

  if (!item) {
    return (
      <div className="workspace-shell evidence-details-workspace">
        <nav className="evidence-details-nav" aria-label="Breadcrumb">
          <Link href="/evidence" className="evidence-back-link">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            <span>Back to Experience &amp; Projects</span>
          </Link>
        </nav>
        <div className="details-not-found-card">
          <h2>Documented item not found</h2>
          <p>
            We could not find evidence records for{" "}
            <strong>{requestedName || "this selection"}</strong>. It may have been
            removed or not yet documented.
          </p>
          <Link href="/evidence" className="neutral-action">
            Return to Experience &amp; Projects
          </Link>
        </div>
      </div>
    );
  }

  const role = extractRole(item);
  const techStack = extractTechStack(item);
  const categorizedTech = useMemo(() => categorizeTech(techStack), [techStack]);
  const storyDescription = useMemo(() => extractNarrativeSummary(item), [item]);

  return (
    <div className="workspace-shell evidence-details-workspace">
      {/* Top Breadcrumb Navigation */}
      <nav className="evidence-details-nav" aria-label="Evidence navigation">
        <Link href="/evidence" className="evidence-back-link">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          <span>Back to Experience &amp; Projects</span>
        </Link>
        <span className="details-nav-separator" aria-hidden="true">
          /
        </span>
        <span className="details-nav-current">{item.name}</span>
      </nav>

      {/* Main Content Flow */}
      <main className="details-main-flow">
        {/* Header & Narrative Story Section */}
        <header className="details-hero-section">
          <div className="details-hero-meta-row">
            <span
              className={`details-category-pill ${item.category === "experience" ? "is-experience" : "is-project"}`}
            >
              {item.category === "experience" ? "Work Experience" : "Project"}
            </span>
            {role ? (
              <span className="details-role-pill">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                  <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                </svg>
                <span>{role}</span>
              </span>
            ) : null}
          </div>

          <h1 className="details-title">{item.name}</h1>

          {/* Compact Architectural Tech Strip (Below Title) */}
          {categorizedTech.length > 0 ? (
            <div
              className="details-header-tech-strip"
              aria-label="Technologies used"
            >
              {categorizedTech.map((group) => (
                <div key={group.category} className="header-tech-group">
                  <span className="header-tech-category">{group.category}</span>
                  <div className="header-tech-chips">
                    {group.items.map((tech) => (
                      <span key={tech} className="header-tech-chip">
                        {tech}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {/* Narrative Story Description (~100–250 words) */}
          <div className="details-story-block">
            {storyDescription.split("\n\n").map((para, idx) => (
              <p key={idx} className="details-story-paragraph">
                {formatInlineText(para)}
              </p>
            ))}
          </div>
        </header>

        {/* Candidate Bullets Section */}
        <section
          className="details-section details-bullets-section"
          aria-labelledby="bullets-heading"
        >
          <div className="details-section-header">
            <h2 id="bullets-heading" className="details-section-heading">
              Candidate Bullets
            </h2>
            {bullets.length > 0 ? (
              <span className="section-count-badge">
                {bullets.length}
              </span>
            ) : null}
          </div>

          {/* SegmentedTabs */}
          {bullets.length > 0 && availableCategories.length > 2 ? (
            <SegmentedTabs
              ariaLabel="Filter candidate bullets by category"
              tabs={availableCategories.map((cat) => ({
                id: cat,
                label: cat,
                count:
                  cat === "All"
                    ? bullets.length
                    : bullets.filter((b) => b.category === cat).length,
              }))}
              activeTab={selectedCategory}
              onChange={handleCategoryChange}
              idPrefix="bullet-tab"
              className="bullet-category-tabs"
            />
          ) : null}

          {paginatedBullets.length > 0 ? (
            <div className="details-bullet-cards">
              {paginatedBullets.map((b) => (
                <article key={b.id} className="details-bullet-card">
                  <span className="bullet-card-dot" aria-hidden="true">
                    •
                  </span>
                  <p className="bullet-text">{formatInlineText(b.text)}</p>
                </article>
              ))}
            </div>
          ) : (
            <div className="details-empty-box">
              <p>No bullet candidates found for this category.</p>
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 ? (
            <nav
              className="details-pagination"
              aria-label="Candidate bullets pagination"
            >
              <span className="pagination-info">
                Showing {startIndex + 1}–
                {Math.min(startIndex + BULLETS_PER_PAGE, filteredBullets.length)}{" "}
                of {filteredBullets.length} bullets
              </span>
              <div className="pagination-controls">
                <button
                  type="button"
                  className="pagination-btn"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  aria-label="Previous page"
                >
                  Previous
                </button>
                <div className="pagination-pages">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                    (page) => (
                      <button
                        key={page}
                        type="button"
                        className={`pagination-page-btn ${currentPage === page ? "is-active" : ""}`}
                        onClick={() => setCurrentPage(page)}
                        aria-label={`Page ${page}`}
                        aria-current={currentPage === page ? "page" : undefined}
                      >
                        {page}
                      </button>
                    ),
                  )}
                </div>
                <button
                  type="button"
                  className="pagination-btn"
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={currentPage === totalPages}
                  aria-label="Next page"
                >
                  Next
                </button>
              </div>
            </nav>
          ) : null}
        </section>
      </main>
    </div>
  );
}
