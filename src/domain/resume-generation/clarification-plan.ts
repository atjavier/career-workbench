import { WorkspaceError } from "@/domain/workspace/types";

export type ClarificationQuestion = { category: string; question: string };
export type ClarificationPlanningInput = {
  name: string;
  category: "project" | "experience";
  facts: string;
};

export function validateClarificationPlan(output: unknown): ClarificationQuestion[] {
  const invalid = (): never => { throw new WorkspaceError("RESUME_COACH_INVALID", "Local AI could not prepare clarification questions.", "Try reading the evidence again after checking local AI settings."); };
  if (!output || typeof output !== "object" || Array.isArray(output)) return invalid();
  const record = output as Record<string, unknown>;
  if (Object.keys(record).length !== 1 || !Array.isArray(record.tasks) || record.tasks.length > 8) return invalid();
  const categories = new Set<string>();
  return record.tasks.map((value: unknown) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return invalid();
    const task = value as Record<string, unknown>;
    if (Object.keys(task).length !== 2 || typeof task.category !== "string" || typeof task.question !== "string") return invalid();
    const category = task.category.trim().replace(/\s+/g, " ");
    const question = task.question.trim();
    if (category.length > 80 || !/^[\p{L}\p{N}]+(?:[-/][\p{L}\p{N}]+)*(?: [\p{L}\p{N}]+(?:[-/][\p{L}\p{N}]+)*){1,2}$/u.test(category) || !question || question.length > 600 || /[\u0000-\u001f\u007f-\u009f]/.test(question) || categories.has(category.toLowerCase())) return invalid();
    categories.add(category.toLowerCase());
    return { category, question };
  });
}
