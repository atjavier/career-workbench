import { WorkspaceError } from "@/domain/workspace/types";

/** Application data contract, not a prompt or a job-description interpreter. */
export const jobOpportunityReaderDefinition = Object.freeze({
  agentId: "jobs.opportunity-reader",
  name: "Job Opportunity Reader",
  contractVersion: 1,
  stateless: true,
  tools: [] as readonly string[],
  maxSourceCharacters: 200_000,
  maxCalls: 2,
  identityFields: ["title", "company"] as const,
  outputFields: ["title", "company", "location", "workStyle", "postedAt", "descriptionSections"] as const,
});
export type OpportunityReaderRetry = { unresolvedFields: readonly ("title" | "company")[] };
export type OpportunityReaderFields = Record<"title" | "company" | "location" | "workStyle" | "postedAt" | "requirements", string>;
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const invalid = (): never => { throw new WorkspaceError("OPPORTUNITY_DRAFT_INVALID", "Local AI could not read the job description.", "Try adding the opportunity again."); };
const normalize = (text: string) => text.replace(/\s+/g, " ").trim().toLocaleLowerCase();
const safeText = (text: string) => !/[\u0000\u007f-\u009f]/.test(text);
function sourceFact(item: unknown, source: string, maximum: number): { value: string; excerpt: string } | undefined {
  if (item === null || item === undefined) return undefined;
  const value = typeof item === "string" ? item : record(item) ? item.value : invalid();
  const excerpt = record(item) ? item.excerpt : undefined;
  if (record(item) && Object.keys(item).some(key => !["value", "excerpt", "name"].includes(key))) return invalid();
  if (value === null) return undefined;
  if (typeof value !== "string" || value.length > maximum || !safeText(value) || (excerpt !== undefined && excerpt !== null && (typeof excerpt !== "string" || excerpt.length > 4000 || !safeText(excerpt)))) return invalid();
  if (!value.trim() || /^(?:unknown|not stated|n\/a)$/i.test(value.trim())) return undefined;
  // Legacy scalar responses can cite their literal value. No field meaning is
  // inferred here: semantic attribution belongs to the named AI reader.
  const quote = typeof excerpt === "string" ? excerpt.trim() : value.trim();
  if (!quote || !normalize(source).includes(normalize(quote))) return undefined;
  return { value: value.trim(), excerpt: quote };
}
function dateValue(fact: {value: string; excerpt: string}): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fact.value) || Number.isNaN(Date.parse(fact.value)) || new Date(fact.value).toISOString().slice(0, 10) !== fact.value) return "";
  if (fact.excerpt.includes(fact.value)) return fact.value;
  const months = ["january","february","march","april","may","june","july","august","september","october","november","december"];
  const dates = [...fact.excerpt.matchAll(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})\b/gi)].map(match => `${match[3]}-${String(months.indexOf(match[1].toLowerCase()) + 1).padStart(2,"0")}-${match[2].padStart(2,"0")}`);
  return new Set(dates).size === 1 && dates[0] === fact.value ? fact.value : "";
}
export function validateJobOpportunityReaderOutput(output: unknown, source: string): OpportunityReaderFields {
  if (!record(output) || Object.keys(output).length === 0 || Object.keys(output).some(key => ![...jobOpportunityReaderDefinition.outputFields, "requirements"].includes(key))) return invalid();
  const result: OpportunityReaderFields = { title:"", company:"", location:"", workStyle:"", postedAt:"", requirements:"" };
  for (const field of ["title", "company", "location", "workStyle", "postedAt"] as const) {
    const fact = sourceFact(output[field], source, field === "workStyle" ? 120 : 300);
    if (!fact) continue;
    if (field === "postedAt") result[field] = dateValue(fact);
    else if (normalize(fact.excerpt).includes(normalize(fact.value))) result[field] = fact.value;
  }
  // Accept earlier model response shapes without making this the visible UI.
  const requirements = output.requirements ?? [];
  if (!Array.isArray(requirements) || requirements.length > 20) return invalid();
  result.requirements = [...new Set(requirements.map(item => sourceFact(item, source, 1000)).filter(fact => fact && normalize(fact.excerpt).includes(normalize(fact.value))).map(fact => fact!.value))].join("\n");
  return result;
}
