import { WorkspaceError } from "@/domain/workspace/types";

export type EvidenceItemContext = { role?: string; startDate?: string; endDate?: string };

/** Already-supplied form facts are context, not synthetic interview answers. */
export function candidateContextSection(context: EvidenceItemContext = {}): string {
  const values = Object.fromEntries(Object.entries(context).map(([key, value]) => {
    const text = value?.trim() ?? "";
    if (text.length > (key === "role" ? 300 : 40) || /[\u0000-\u001f\u007f-\u009f]/.test(text)) throw new WorkspaceError("EVIDENCE_LIBRARY_INVALID", "The supplied work details are invalid.", "Review the role and dates, then try again.");
    return [key, text];
  }));
  const lines = [values.role && `Candidate-provided role: ${values.role}`, values.startDate && `Candidate-provided start date: ${values.startDate}`, values.endDate && `Candidate-provided end date: ${values.endDate}`].filter(Boolean);
  return lines.length ? `## Candidate-provided context\n\n${lines.join("\n")}\n\n` : "";
}
