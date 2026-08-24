import { WorkspaceError } from "@/domain/workspace/types";

const unknown = "Unknown";
const minimumDescriptionLength = 80;
const maximumDescriptionLength = 200_000;
const maximumUrlLength = 2_048;

export type OpportunityCaptureInput = { postingUrl: unknown; copiedDescription: unknown; now?: () => Date };
export type OpportunityCaptureDraft = {
  postingUrl: string;
  copiedDescription: string;
  capturedAt: string;
  title: string;
  company: string;
  location: string;
  workStyle: string;
  requirements: string[];
  postedAt: string;
};

export class OpportunityCaptureValidationError extends WorkspaceError {
  readonly field: "postingUrl" | "copiedDescription";

  constructor(field: OpportunityCaptureValidationError["field"], summary: string, safeNextAction: string) {
    super("OPPORTUNITY_CAPTURE_INVALID", summary, safeNextAction);
    this.field = field;
  }
}

const normalizedLine = (value: string) => value.replace(/\s+/g, " ").trim();
const labelledValue = (text: string, labels: string[]) => {
  const expression = new RegExp(`^(?:${labels.join("|")})\\s*:\\s*(.+)$`, "im");
  const match = text.match(expression);
  return match ? normalizedLine(match[1]) || unknown : unknown;
};

function normalizePostingUrl(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) throw new OpportunityCaptureValidationError("postingUrl", "Enter the posting URL.", "Paste the HTTPS link from the page you found.");
  const raw = value.trim();
  if (raw.length > maximumUrlLength) throw new OpportunityCaptureValidationError("postingUrl", "The posting URL is too long.", "Use the direct HTTPS link, up to 2,048 characters.");
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.toString().length > maximumUrlLength) throw new Error("unsafe URL");
    return parsed.toString();
  } catch {
    throw new OpportunityCaptureValidationError("postingUrl", "Enter a valid HTTPS posting URL without embedded credentials.", "Correct the URL and try again.");
  }
}

function normalizeDescription(value: unknown): string {
  if (typeof value !== "string") throw new OpportunityCaptureValidationError("copiedDescription", "Paste the copied job description.", "Copy the role details from the page, then try again.");
  const text = value.trim();
  if (text.length < minimumDescriptionLength) throw new OpportunityCaptureValidationError("copiedDescription", "Paste a fuller job description before review.", "Include at least 80 characters of copied role details.");
  if (text.length > maximumDescriptionLength) throw new OpportunityCaptureValidationError("copiedDescription", "The copied job description is too long.", "Shorten the copied text to 200,000 characters or fewer.");
  return text;
}

function requirementsFrom(text: string): string[] {
  const section = text.match(/(?:^|\n)\s*(?:requirements?|qualifications?|what you(?:'|’)ll need)\s*:?\s*\n([\s\S]*?)(?=\n\s*\n|\n\s*(?:benefits?|about|responsibilities|equal opportunity)\b|$)/i)?.[1];
  const entries = section?.split("\n").map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "")).map(normalizedLine).filter(Boolean) ?? [];
  return entries.length > 0 ? entries.slice(0, 20) : [unknown];
}

function titleFrom(text: string): string {
  const labelledTitle = labelledValue(text, ["job title", "title", "position", "role"]);
  if (labelledTitle !== unknown) return labelledTitle;
  const firstLine = text.split("\n").map(normalizedLine).find(Boolean) ?? unknown;
  return /^(?:about(?: the role| us)?|job description|overview|responsibilities|requirements?|qualifications?|benefits?|company|employer|location|work style|work arrangement|posted(?: date| on)?|date posted)\s*:?$/i.test(firstLine) ? unknown : firstLine;
}

function postedDateFrom(text: string): string {
  const value = labelledValue(text, ["posted(?: date| on)?", "date posted"]);
  if (value === unknown || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return unknown;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date.toISOString() : unknown;
}

export function captureOpportunityDraft(input: OpportunityCaptureInput): OpportunityCaptureDraft {
  const postingUrl = normalizePostingUrl(input.postingUrl);
  const copiedDescription = normalizeDescription(input.copiedDescription);
  return {
    postingUrl,
    copiedDescription,
    capturedAt: (input.now ?? (() => new Date()))().toISOString(),
    title: titleFrom(copiedDescription),
    company: labelledValue(copiedDescription, ["company", "employer"]),
    location: labelledValue(copiedDescription, ["location", "job location"]),
    workStyle: labelledValue(copiedDescription, ["work style", "work arrangement"]),
    requirements: requirementsFrom(copiedDescription),
    postedAt: postedDateFrom(copiedDescription),
  };
}
