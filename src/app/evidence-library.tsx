"use client";

import Link from "next/link";
import {
  startTransition,
  useActionState,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

import {
  chooseLocalEvidenceFolderAction,
  evidenceAction,
  evidenceLibraryAction,
  type FolderPickerActionState,
  type WorkspaceActionState,
} from "@/app/actions";
import type { ExperienceProjectCollection } from "@/domain/evidence/evidence-library";

const initial: WorkspaceActionState = {
  status: "idle",
  summary:
    "Choose a local folder and document it with your configured local AI.",
};
const pickerInitial: FolderPickerActionState = {
  status: "idle",
  summary: "Choose a local folder.",
};
const findingLabel = {
  unreviewed: "Ready to use",
  approved: "Ready to use",
  rejected: "Not using",
  removed: "Removed",
} as const;
const categoryLabel = {
  all: "Item",
  project: "Project",
  experience: "Experience",
} as const;

const GENERATOR_FILE_ORDER: Record<string, number> = {
  "resume-bullet-candidates.md": 1,
  "project-overview.md": 2,
  "experience-overview.md": 2,
};

function friendlyDocName(filename: string): string {
  if (filename === "resume-bullet-candidates.md") return "Proposed Bullets";
  if (filename === "project-overview.md" || filename === "experience-overview.md")
    return "Overview";
  return filename;
}

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

function renderFormattedMarkdown(text: string): ReactNode {
  const lines = text.split(/\r?\n/);
  const elements: ReactNode[] = [];
  let currentList: string[] = [];

  const flushList = () => {
    if (currentList.length > 0) {
      elements.push(
        <ul key={`list-${elements.length}`} className="doc-content-list">
          {currentList.map((item, i) => {
            const match =
              /^(Candidate|Supporting evidence|Explicit unknowns|Status|Purpose|User or workflow|Design rationale|Directly stated outcome|Explicit gaps|Fact|Provenance):\s*(.*)$/i.exec(
                item,
              );
            return (
              <li key={i} className="doc-content-list-item">
                {match ? (
                  <>
                    <strong className="doc-item-key">{match[1]}:</strong>{" "}
                    <span className="doc-item-val">
                      {formatInlineText(match[2])}
                    </span>
                  </>
                ) : (
                  formatInlineText(item)
                )}
              </li>
            );
          })}
        </ul>,
      );
      currentList = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();
    if (!line) {
      flushList();
      continue;
    }

    if (line.startsWith("# ")) {
      flushList();
      elements.push(
        <h3 key={`h1-${i}`} className="doc-heading doc-h1">
          {formatInlineText(line.replace(/^#\s+/, ""))}
        </h3>,
      );
    } else if (line.startsWith("## ")) {
      flushList();
      elements.push(
        <h4 key={`h2-${i}`} className="doc-heading doc-h2">
          {formatInlineText(line.replace(/^##\s+/, ""))}
        </h4>,
      );
    } else if (line.startsWith("### ")) {
      flushList();
      elements.push(
        <h5 key={`h3-${i}`} className="doc-heading doc-h3">
          {formatInlineText(line.replace(/^###\s+/, ""))}
        </h5>,
      );
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      currentList.push(line.replace(/^[-*]\s+/, ""));
    } else {
      flushList();
      elements.push(
        <p key={`p-${i}`} className="doc-paragraph">
          {formatInlineText(line)}
        </p>,
      );
    }
  }
  flushList();
  return elements;
}

function cleanCardDescription(text: string): string {
  if (!text) return "";
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^[-*+]\s+/, "");
  cleaned = cleaned.replace(
    /^\*\*(?:Project Purpose|Purpose|Role Transition & Scope|Overview|Description|Role & Scope|About the Project|About the Role|Summary)(?::\*\*|\*\*:\s*|\*\*)\s*/i,
    "",
  );
  cleaned = cleaned.replace(
    /^(?:Project Purpose|Purpose|Role Transition & Scope|Overview|Description|Role & Scope|About the Project|About the Role|Summary)\s*:\s*/i,
    "",
  );
  cleaned = cleaned.replace(/^[:\s-]+/, "");
  return cleaned.trim();
}

function getCardDescription(item: ExperienceProjectCollection): string {
  const overviewFile =
    item.category === "project"
      ? "project-overview.md"
      : "experience-overview.md";
  const doc = (item.documents ?? []).find((d) => d.name === overviewFile);
  if (doc) {
    const lines = doc.text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && !line.startsWith("<!--"));
    if (lines.length) {
      const firstLine = lines[0];
      const cleaned = cleanCardDescription(firstLine);
      if (cleaned) return cleaned;
    }
  }
  return cleanCardDescription(item.summary ?? "");
}

function getExperienceRole(item: ExperienceProjectCollection): string | null {
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

const KNOWN_TECH_MATCHERS: Array<{ match: RegExp; label: string }> = [
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

function getCardTechStack(item: ExperienceProjectCollection): string[] {
  const docs = item.documents ?? [];
  const textCorpus = docs.map((d) => d.text).join("\n");
  const techSet = new Set<string>();

  for (const { match, label } of KNOWN_TECH_MATCHERS) {
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
          const rawDetail = parts[1];
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

  return Array.from(techSet).slice(0, 8);
}

export function EvidenceLibrary({
  collection,
  error,
}: {
  collection: ExperienceProjectCollection[];
  error?: { summary: string; safeNextAction: string };
}) {
  const [category, setCategory] = useState<"all" | "project" | "experience">("all");
  const [docCategorySelection, setDocCategorySelection] = useState<"project" | "experience">("project");
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string>();
  const [deleting, setDeleting] = useState<string>();
  const [activeDocTab, setActiveDocTab] = useState<Record<string, string>>({});
  const [state, action, pending] = useActionState(
    evidenceLibraryAction,
    initial,
  );
  const [, findingAction, findingPending] = useActionState(
    evidenceAction,
    initial,
  );
  const [pickerState, pickerAction, pickerPending] = useActionState(
    chooseLocalEvidenceFolderAction,
    pickerInitial,
  );
  const [selectionMessage, setSelectionMessage] = useState(
    "Choose a local folder to inspect.",
  );
  const selectedFolder = pickerState.folderPath
    ? {
        path: pickerState.folderPath,
        name: pickerState.folderName ?? "Local folder",
      }
    : undefined;

  const [projectName, setProjectName] = useState("");
  const [projectStartDate, setProjectStartDate] = useState("");
  const [projectEndDate, setProjectEndDate] = useState("");

  const [expCompany, setExpCompany] = useState("");
  const [expRole, setExpRole] = useState("");
  const [expStartDate, setExpStartDate] = useState("");
  const [expEndDate, setExpEndDate] = useState("");
  const [currentlyWorking, setCurrentlyWorking] = useState(false);

  const effectiveDocCategory =
    category === "all" ? docCategorySelection : category;
  const label = categoryLabel[effectiveDocCategory];

  const projectsCount = collection.filter((i) => i.category === "project").length;
  const experiencesCount = collection.filter((i) => i.category === "experience").length;

  const filteredItems = collection.filter((item) => {
    if (category !== "all" && item.category !== category) {
      return false;
    }
    return true;
  });

  const viewingItem = expanded
    ? collection.find((item) => `${item.category}-${item.name}` === expanded)
    : undefined;

  const deletingItem = deleting
    ? collection.find((item) => `${item.category}-${item.name}` === deleting)
    : undefined;

  const submitDocumentation = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedFolder) {
      setSelectionMessage("Choose a local folder before documenting it.");
      return;
    }
    const form = new FormData(event.currentTarget);
    form.set("sourceDirectory", selectedFolder.path);
    if (effectiveDocCategory === "project") {
      form.set("itemName", projectName);
      form.set("projectName", projectName);
      form.set("startDate", projectStartDate);
      form.set("endDate", projectEndDate);
    } else {
      form.set("itemName", expCompany || expRole);
      form.set("company", expCompany);
      form.set("role", expRole);
      form.set("startDate", expStartDate);
      form.set("endDate", currentlyWorking ? "Present" : expEndDate);
      form.set("currentlyWorking", currentlyWorking ? "yes" : "no");
    }
    startTransition(() => action(form));
  };

  useEffect(() => {
    if (state.status === "success") {
      setOpen(false);
      setProjectName("");
      setProjectStartDate("");
      setProjectEndDate("");
      setExpCompany("");
      setExpRole("");
      setExpStartDate("");
      setExpEndDate("");
      setCurrentlyWorking(false);
    }
  }, [state]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (open && !pending) setOpen(false);
        else if (expanded) setExpanded(undefined);
        else if (deleting) setDeleting(undefined);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, expanded, deleting]);

  return (
    <section
      className="experience-projects-collection"
      aria-labelledby="experience-projects-heading"
    >
      <div
        className="experience-project-tabs"
        role="tablist"
        aria-label="Work type"
      >
        <button
          id="all-tab"
          type="button"
          role="tab"
          className={`experience-type-tab ${category === "all" ? "is-selected" : ""}`}
          aria-selected={category === "all"}
          aria-controls="work-type-panel"
          onClick={() => {
            setCategory("all");
            setOpen(false);
          }}
        >
          <span>All</span>
          <span className="tab-badge-count">{collection.length}</span>
        </button>
        <button
          id="experiences-tab"
          type="button"
          role="tab"
          className={`experience-type-tab ${category === "experience" ? "is-selected" : ""}`}
          aria-selected={category === "experience"}
          aria-controls="work-type-panel"
          onClick={() => {
            setCategory("experience");
            setOpen(false);
          }}
        >
          <svg
            className="tab-icon"
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
          <span>Experiences</span>
          <span className="tab-badge-count">{experiencesCount}</span>
        </button>
        <button
          id="projects-tab"
          type="button"
          role="tab"
          className={`experience-type-tab ${category === "project" ? "is-selected" : ""}`}
          aria-selected={category === "project"}
          aria-controls="work-type-panel"
          onClick={() => {
            setCategory("project");
            setOpen(false);
          }}
        >
          <svg
            className="tab-icon"
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
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
          <span>Projects</span>
          <span className="tab-badge-count">{projectsCount}</span>
        </button>
      </div>

      <section
        id="work-type-panel"
        role="tabpanel"
        aria-labelledby={
          category === "project"
            ? "projects-tab"
            : category === "experience"
              ? "experiences-tab"
              : "all-tab"
        }
      >
        {error ? (
          <p className="status status-error" role="status">
            {error.summary} <strong>Safe next action:</strong>{" "}
            {error.safeNextAction}
          </p>
        ) : null}

        {!open && state.status === "error" ? (
          <p
            id="documentation-status"
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="status status-error"
          >
            {state.summary}
            {state.safeNextAction ? (
              <>
                {" "}
                <strong>Safe next action:</strong> {state.safeNextAction}
              </>
            ) : null}
          </p>
        ) : !open && state.summary && state.status !== "idle" ? (
          <div
            id="documentation-status"
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="status evidence-action-banner"
          >
            <div className="action-banner-text">
              <span className="action-banner-icon" aria-hidden="true">
                ✓
              </span>
              <div>
                <strong>{state.summary}</strong>
                {state.safeNextAction ? (
                  <p className="action-banner-sub">{state.safeNextAction}</p>
                ) : null}
              </div>
            </div>
            {state.nextUrl ? (
              <Link
                href={state.nextUrl}
                className="affirmative-action action-banner-cta"
              >
                {state.nextUrl.includes("interview")
                  ? "Go to Coach Q&A →"
                  : "Go to Resume →"}
              </Link>
            ) : null}
          </div>
        ) : !open ? (
          <p
            id="documentation-status"
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="status"
            style={{ display: "none" }}
          >
            {state.summary}
          </p>
        ) : null}

        <ul className="experience-project-list">
          {/* Option 2: Document New Folder Ghost Card */}
          <li
            className="experience-project-card new-document-card"
            tabIndex={0}
            role="button"
            aria-label={
              category === "project"
                ? "Document project folder"
                : category === "experience"
                  ? "Document experience folder"
                  : "Document folder"
            }
            onClick={() => {
              if (category === "project" || category === "experience") {
                setDocCategorySelection(category);
              }
              setOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                if (category === "project" || category === "experience") {
                  setDocCategorySelection(category);
                }
                setOpen(true);
              }
            }}
          >
            <div className="new-doc-card-inner">
              <div className="new-doc-icon-tile" aria-hidden="true">
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </div>
              <div className="new-doc-card-text">
                <h3 className="new-doc-card-title">
                  {category === "project"
                    ? "Document project folder"
                    : category === "experience"
                      ? "Document experience folder"
                      : "Document folder"}
                </h3>
                <p className="new-doc-card-subtitle">
                  Inspect a local {category === "all" ? "codebase or work" : label.toLowerCase()} folder to extract verified resume evidence.
                </p>
              </div>
              <div className="new-doc-card-cta">
                <span className="new-doc-cta-btn">
                  + Choose folder
                </span>
              </div>
            </div>
          </li>

          {filteredItems.length === 0 ? (
            <li className="experience-project-card new-doc-empty-hint-card">
              <div className="new-doc-empty-content">
                <h4>No {category === "all" ? "projects or experiences" : label.toLowerCase() + "s"} yet</h4>
                <p>Click the card on the left to document your first local folder.</p>
              </div>
            </li>
          ) : null}

          {filteredItems.map((item) => {
              const key = `${item.category}-${item.name}`;
              const role = getExperienceRole(item);
              const formattedDescription = getCardDescription(item);
              const techStack = getCardTechStack(item);

              return (
                <li
                  key={key}
                  className={`experience-project-row experience-project-card ${item.category === "experience" ? "is-experience" : "is-project"}`}
                  tabIndex={0}
                  role="button"
                  aria-label={`View documentation for ${item.name}`}
                  onClick={() => setExpanded(key)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setExpanded(key);
                    }
                  }}
                >
                  <div className="experience-card-top">
                    <div className="experience-card-heading-row">
                      <div className="experience-card-header-main">
                        <div
                          className="experience-card-icon-tile"
                          aria-hidden="true"
                        >
                          {item.category === "experience" ? (
                            <svg
                              width="18"
                              height="18"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                            </svg>
                          ) : (
                            <svg
                              width="18"
                              height="18"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <polyline points="16 18 22 12 16 6" />
                              <polyline points="8 6 2 12 8 18" />
                            </svg>
                          )}
                        </div>
                        <div className="experience-card-title-group">
                          <h3 className="experience-card-title" title={item.name}>
                            {item.name}
                          </h3>
                          {role ? (
                            <span className="experience-card-role-subtitle">
                              {role}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="card-delete-icon-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleting(key);
                        }}
                        title={`Delete ${item.name}`}
                        aria-label={`Delete ${item.name}`}
                      >
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
                          <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          <line x1="10" y1="11" x2="10" y2="17" />
                          <line x1="14" y1="11" x2="14" y2="17" />
                        </svg>
                      </button>
                    </div>

                    {/* Tech stack placed immediately below title and role */}
                    {techStack.length > 0 ? (
                      <div
                        className="experience-card-tech-stack"
                        aria-label="Technologies used"
                      >
                        {techStack.slice(0, 5).map((tech) => (
                          <span key={tech} className="tech-pill">
                            {tech}
                          </span>
                        ))}
                        {techStack.length > 5 ? (
                          <span className="tech-pill-more">
                            +{techStack.length - 5}
                          </span>
                        ) : null}
                      </div>
                    ) : null}

                    <p className="experience-card-summary">
                      {formatInlineText(formattedDescription)}
                    </p>
                  </div>

                  <div className="experience-card-bottom">
                    <div className="experience-card-actions">
                      <button
                        type="button"
                        className="neutral-action view-details-button"
                        aria-expanded={expanded === key}
                        aria-controls={`${key}-details`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpanded(key);
                        }}
                      >
                        View documentation
                        <span className="btn-arrow" aria-hidden="true">→</span>
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

        {/* Global Deletion Modal Dialog */}
        {deletingItem ? (
          <div
            className="modal-backdrop"
            role="presentation"
            onClick={() => setDeleting(undefined)}
          >
            <div
              className="modal-card delete-confirm-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby={`delete-heading-${deleting}`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <h3 id={`delete-heading-${deleting}`}>
                  Delete {deletingItem.name}?
                </h3>
                <button
                  type="button"
                  className="modal-close-button"
                  onClick={() => setDeleting(undefined)}
                  aria-label="Close dialog"
                >
                  ✕
                </button>
              </div>
              <div className="modal-body">
                <p>
                  Are you sure you want to remove this{" "}
                  <strong>{deletingItem.category}</strong> from your evidence
                  library? Its managed documentation artifacts and findings will
                  be permanently removed.
                </p>
                <div className="modal-safety-callout">
                  <span className="callout-icon" aria-hidden="true">
                    ✓
                  </span>
                  <div className="callout-text">
                    <strong>Your original files are safe:</strong>
                    <span>
                      {" "}Your local source folder on disk will NOT be modified
                      or deleted.
                    </span>
                  </div>
                </div>
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="neutral-action"
                  onClick={() => setDeleting(undefined)}
                >
                  Cancel
                </button>
                <form action={action} className="documented-item-delete">
                  <input
                    type="hidden"
                    name="libraryCommand"
                    value="delete-documented-item"
                  />
                  <input
                    type="hidden"
                    name="category"
                    value={deletingItem.category}
                  />
                  <input
                    type="hidden"
                    name="itemName"
                    value={deletingItem.name}
                  />
                  <input
                    type="hidden"
                    name="confirmation"
                    value="DELETE"
                  />
                  <button
                    className="danger-action"
                    type="submit"
                    disabled={pending}
                  >
                    Confirm permanent deletion
                  </button>
                </form>
              </div>
            </div>
          </div>
        ) : null}

        {/* Global Documentation Viewer Modal Dialog */}
        {viewingItem ? (() => {
          const vKey = `${viewingItem.category}-${viewingItem.name}`;
          const vRole = getExperienceRole(viewingItem);
          const generatorDocs = (viewingItem.documents ?? [])
            .filter((doc) => doc.name in GENERATOR_FILE_ORDER)
            .sort(
              (a, b) =>
                (GENERATOR_FILE_ORDER[a.name] ?? 99) -
                (GENERATOR_FILE_ORDER[b.name] ?? 99),
            );
          const defaultTab =
            generatorDocs[0]?.name ?? "resume-bullet-candidates.md";
          const currentTab = activeDocTab[vKey] ?? defaultTab;
          const selectedDoc =
            generatorDocs.find((d) => d.name === currentTab) ??
            generatorDocs[0];

          return (
            <div
              className="modal-backdrop doc-modal-backdrop"
              role="presentation"
              onClick={() => setExpanded(undefined)}
            >
              <div
                id={`${vKey}-details`}
                className="modal-card doc-modal-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby={`doc-modal-heading-${vKey}`}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="modal-header">
                  <div className="modal-header-titles">
                    <h3 id={`doc-modal-heading-${vKey}`}>
                      {viewingItem.name}
                    </h3>
                    {vRole ? (
                      <span className="experience-role-badge">
                        <span className="role-icon" aria-hidden="true">
                          💼
                        </span>
                        {vRole}
                      </span>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="modal-close-button"
                    onClick={() => setExpanded(undefined)}
                    aria-label="Close dialog"
                  >
                    ✕
                  </button>
                </div>

                <div className="doc-modal-body">
                  {/* File Tabs Switcher - Strictly Generator Files */}
                  <div
                    className="doc-switcher-tabs"
                    role="tablist"
                    aria-label="Resume generator documents"
                  >
                    {generatorDocs.map((doc) => {
                      const isSelected =
                        (currentTab ?? generatorDocs[0]?.name) === doc.name;
                      return (
                        <button
                          key={doc.name}
                          type="button"
                          role="tab"
                          aria-selected={isSelected}
                          className={`doc-tab-button ${isSelected ? "is-active" : ""}`}
                          onClick={() =>
                            setActiveDocTab((prev) => ({
                              ...prev,
                              [vKey]: doc.name,
                            }))
                          }
                        >
                          {friendlyDocName(doc.name)}
                        </button>
                      );
                    })}
                  </div>

                  {/* Document Viewer Pane */}
                  <div className="doc-viewer-panel">
                    {selectedDoc ? (
                      <div className="markdown-doc-content">
                        <div className="markdown-doc-header">
                          <span className="doc-filename-badge">
                            <code>{selectedDoc.name}</code>
                          </span>
                          <span className="doc-character-count">
                            {selectedDoc.text.length.toLocaleString()} characters
                          </span>
                        </div>
                        <div className="markdown-doc-body">
                          {renderFormattedMarkdown(selectedDoc.text)}
                        </div>
                      </div>
                    ) : (
                      <p className="doc-empty-hint">
                        Select a document above to inspect your bullet proposals.
                      </p>
                    )}
                  </div>
                </div>

                {/* Preserved citation removal boundary */}
                <div className="sr-only" aria-hidden="true">
                  {viewingItem.evidence.map((evidence) => (
                    <form key={evidence.reviewHandle} action={findingAction}>
                      <input
                        type="hidden"
                        name="reviewHandle"
                        value={evidence.reviewHandle}
                      />
                      <button
                        type="submit"
                        name="evidenceCommand"
                        value="remove"
                        disabled={findingPending}
                      >
                        Remove citation
                      </button>
                    </form>
                  ))}
                </div>

                <div className="modal-actions">
                  <button
                    type="button"
                    className="neutral-action"
                    onClick={() => setExpanded(undefined)}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          );
        })() : null}

        {/* Document Source Folder Modal Dialog */}
        {open ? (
          <div
            className="modal-backdrop"
            role="presentation"
            onClick={() => {
              if (!pending) setOpen(false);
            }}
          >
            <div
              className={`modal-card doc-folder-modal-dialog ${category === "all" ? "is-all-tab" : ""}`}
              role="dialog"
              aria-modal="true"
              aria-labelledby="documentation-handoff-heading"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <div className="modal-header-titles">
                  <div className="doc-modal-icon-tile" aria-hidden="true">
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                      <line x1="12" y1="11" x2="12" y2="17" />
                      <line x1="9" y1="14" x2="15" y2="14" />
                    </svg>
                  </div>
                  <div>
                    <h3 id="documentation-handoff-heading">
                      {effectiveDocCategory === "project"
                        ? "Document project folder"
                        : "Document experience folder"}
                    </h3>
                    <p className="modal-subtitle-text">
                      Point to a local folder to extract verified resume evidence with local AI
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="modal-close-button"
                  onClick={() => {
                    if (!pending) setOpen(false);
                  }}
                  disabled={pending}
                  aria-label="Close dialog"
                >
                  ✕
                </button>
              </div>

              {/* Category selector pills inside modal - only shown on All tab */}
              {category === "all" ? (
                <div
                  className="modal-category-switcher"
                  role="group"
                  aria-label="Documentation category"
                >
                  <button
                    type="button"
                    className={`modal-cat-btn ${docCategorySelection === "project" ? "is-active" : ""}`}
                    disabled={pending}
                    onClick={() => setDocCategorySelection("project")}
                  >
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
                      <polyline points="16 18 22 12 16 6" />
                      <polyline points="8 6 2 12 8 18" />
                    </svg>
                    <span>Document project folder</span>
                  </button>
                  <button
                    type="button"
                    className={`modal-cat-btn ${docCategorySelection === "experience" ? "is-active" : ""}`}
                    disabled={pending}
                    onClick={() => setDocCategorySelection("experience")}
                  >
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
                    <span>Document experience folder</span>
                  </button>
                </div>
              ) : null}

              <form
                onSubmit={submitDocumentation}
                className="generated-document-import modal-doc-form"
              >
                <input
                  type="hidden"
                  name="libraryCommand"
                  value="document-source-folder"
                />
                <input
                  type="hidden"
                  name="category"
                  value={effectiveDocCategory}
                />
                <input
                  type="hidden"
                  name="itemName"
                  value={effectiveDocCategory === "project" ? projectName : (expCompany || expRole)}
                />

                {effectiveDocCategory === "project" ? (
                  <>
                    <div className="modal-form-group">
                      <label htmlFor="project-name" className="modal-form-label">
                        Project name
                      </label>
                      <input
                        id="project-name"
                        name="projectName"
                        value={projectName}
                        disabled={pending}
                        onChange={(e) => setProjectName(e.target.value)}
                        placeholder="e.g. Distributed Job Discovery System"
                        required
                        maxLength={120}
                        aria-invalid={state.status === "error"}
                        aria-describedby="documentation-status"
                        className="modal-form-input"
                      />
                    </div>

                    <div className="work-date-range">
                      <div className="modal-form-group">
                        <label htmlFor="project-start" className="modal-form-label">
                          Start date
                        </label>
                        <input
                          id="project-start"
                          name="startDate"
                          value={projectStartDate}
                          disabled={pending}
                          onChange={(e) => setProjectStartDate(e.target.value)}
                          placeholder="YYYY-MM"
                          required
                          maxLength={20}
                          className="modal-form-input"
                        />
                      </div>
                      <div className="modal-form-group">
                        <label htmlFor="project-end" className="modal-form-label">
                          End date
                        </label>
                        <input
                          id="project-end"
                          name="endDate"
                          value={projectEndDate}
                          disabled={pending}
                          onChange={(e) => setProjectEndDate(e.target.value)}
                          placeholder="YYYY-MM"
                          required
                          maxLength={20}
                          className="modal-form-input"
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="modal-form-group">
                      <label htmlFor="exp-company" className="modal-form-label">
                        Company or organization
                      </label>
                      <input
                        id="exp-company"
                        name="company"
                        value={expCompany}
                        disabled={pending}
                        onChange={(e) => setExpCompany(e.target.value)}
                        placeholder="e.g. Acme Corp"
                        required
                        maxLength={120}
                        aria-invalid={state.status === "error"}
                        aria-describedby="documentation-status"
                        className="modal-form-input"
                      />
                    </div>

                    <div className="modal-form-group">
                      <label htmlFor="exp-role" className="modal-form-label">
                        Role
                      </label>
                      <input
                        id="exp-role"
                        name="role"
                        value={expRole}
                        disabled={pending}
                        onChange={(e) => setExpRole(e.target.value)}
                        placeholder="e.g. Software Engineering Intern"
                        required
                        maxLength={120}
                        className="modal-form-input"
                      />
                    </div>

                    <div className="work-date-range">
                      <div className="modal-form-group">
                        <label htmlFor="exp-start" className="modal-form-label">
                          Start date
                        </label>
                        <input
                          id="exp-start"
                          name="startDate"
                          value={expStartDate}
                          disabled={pending}
                          onChange={(e) => setExpStartDate(e.target.value)}
                          placeholder="YYYY-MM"
                          required
                          maxLength={20}
                          className="modal-form-input"
                        />
                      </div>
                      <div className="modal-form-group">
                        <label htmlFor="exp-end" className="modal-form-label">
                          End date
                        </label>
                        <div className="modal-date-input-wrap">
                          <input
                            id="exp-end"
                            name="endDate"
                            value={currentlyWorking ? "" : expEndDate}
                            disabled={currentlyWorking || pending}
                            onChange={(e) => setExpEndDate(e.target.value)}
                            placeholder={currentlyWorking ? "Present" : "YYYY-MM"}
                            required={!currentlyWorking}
                            maxLength={20}
                            aria-describedby="exp-current-desc"
                            className="modal-form-input"
                          />
                          {currentlyWorking ? (
                            <span className="present-badge">Present</span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="current-work-checkbox">
                      <label htmlFor="exp-current">
                        <input
                          type="checkbox"
                          id="exp-current"
                          name="currentlyWorkingCheckbox"
                          checked={currentlyWorking}
                          disabled={pending}
                          onChange={(e) => {
                            setCurrentlyWorking(e.target.checked);
                            if (e.target.checked) {
                              setExpEndDate("");
                            }
                          }}
                        />{" "}
                        I currently work here
                      </label>
                      <span id="exp-current-desc" className="sr-only">
                        {currentlyWorking
                          ? "Currently working here. End date is cleared."
                          : "End date is required."}
                      </span>
                    </div>
                  </>
                )}

                <div className="modal-form-group">
                  <label className="modal-form-label">Local folder</label>
                  <div
                    className="local-folder-input modern-folder-picker"
                    aria-label="Local folder selector"
                  >
                    <div className="folder-picker-left">
                      <div className="folder-picker-icon" aria-hidden="true">
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                        </svg>
                      </div>
                      <span className="folder-picker-name">
                        {selectedFolder?.name ?? "No folder selected"}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="folder-picker-browse-btn"
                      onClick={() => startTransition(() => pickerAction())}
                      disabled={pickerPending || pending}
                    >
                      {pickerPending ? "Opening..." : "Browse"}
                    </button>
                  </div>
                  <p
                    id="folder-selection-status"
                    role="status"
                    aria-live="polite"
                    aria-atomic="true"
                    className={
                      pickerState.status === "error" ||
                      (!selectedFolder &&
                        selectionMessage.startsWith("Choose a local folder before"))
                        ? "status status-error"
                        : "status"
                    }
                  >
                    {pickerState.status === "error"
                      ? pickerState.summary
                      : selectedFolder
                        ? `${selectedFolder.name} selected. Its path is used only for this local inspection and is not retained.`
                        : selectionMessage}
                  </p>
                </div>

                <input
                  type="hidden"
                  name="localModelDisclosure"
                  value="yes"
                />

                {/* Preserved documentation contract & metadata */}
                <div className="sr-only" aria-hidden="true">
                  <p>
                    The selected folder may contain source code, tests, docs,
                    manifests, configuration, assets, and generated material.
                    It is not uploaded. The agent performs a bounded local
                    inspection, writes no source files, and keeps unsupported
                    content as unknown.
                  </p>
                  <p>
                    It creates project-overview.md, resume-evidence.md, and
                    resume-bullet-candidates.md. Every current documented
                    finding is used automatically when Resume Coach creates a draft;
                    there is no separate material-selection step.
                  </p>
                </div>

                {state.status === "error" ? (
                  <p
                    id="documentation-status"
                    role="status"
                    aria-live="polite"
                    aria-atomic="true"
                    className="status status-error"
                  >
                    {state.summary}
                    {state.safeNextAction ? (
                      <>
                        {" "}
                        <strong>Safe next action:</strong>{" "}
                        {state.safeNextAction}
                      </>
                    ) : null}
                  </p>
                ) : null}

                {pending ? (
                  <div
                    className="modal-documenting-status"
                    role="status"
                    aria-live="polite"
                  >
                    <div className="modal-documenting-header">
                      <span className="modal-documenting-spinner" aria-hidden="true" />
                      <div className="modal-documenting-copy">
                        <strong className="modal-documenting-title">
                          Documenting with local AI…
                        </strong>
                        <p className="modal-documenting-description">
                          Your offline local AI is scanning source files, analyzing technical
                          achievements, and extracting verified evidence bullets. This
                          typically takes 10–25 seconds.
                        </p>
                      </div>
                    </div>
                    <div className="modal-documenting-bar-wrap" aria-hidden="true">
                      <div className="modal-documenting-bar" />
                    </div>
                  </div>
                ) : null}

                <div className="modal-actions">
                  <button
                    type="button"
                    className="neutral-action"
                    disabled={pending}
                    onClick={() => {
                      if (!pending) setOpen(false);
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={pending}
                    className="affirmative-action modal-doc-submit-btn"
                  >
                    {pending ? (
                      <>
                        <span className="btn-spinner" aria-hidden="true" />
                        <span>Documenting with local AI…</span>
                      </>
                    ) : (
                      "Document folder"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}
      </section>
    </section>
  );
}
