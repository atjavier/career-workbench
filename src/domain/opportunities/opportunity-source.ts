import { OpportunityCaptureValidationError } from "./capture-draft";
export type OpportunitySource = { postingUrl: string; copiedDescription: string };
export function validateOpportunitySource(input: OpportunitySource): OpportunitySource {
  if (typeof input.postingUrl !== "string" || input.postingUrl.length > 2048) throw new OpportunityCaptureValidationError("postingUrl", "Enter a valid posting URL.", "Use its HTTPS link as a reference.");
  try {
    const url = new URL(input.postingUrl);
    if (url.protocol !== "https:" || url.username || url.password) throw Error();
  } catch { throw new OpportunityCaptureValidationError("postingUrl", "Enter a valid HTTPS posting URL.", "The link is kept as a reference; it is not retrieved."); }
  if (typeof input.copiedDescription !== "string" || input.copiedDescription.trim().length < 80 || input.copiedDescription.length > 200_000 || /[\u0000\u007f-\u009f]/.test(input.copiedDescription)) throw new OpportunityCaptureValidationError("copiedDescription", "Enter a job description between 80 and 200,000 characters.", "Paste the role details from the posting.");
  return input;
}
/** Multipart form transport normalizes textarea line endings; preserve the submitted original. */
export function reviewedOpportunitySource(serialized: unknown, submitted: OpportunitySource): OpportunitySource | undefined {
  if (typeof serialized !== "string" || serialized.length > 1_250_000) return undefined;
  try {
    const reviewed = JSON.parse(serialized);
    if (!reviewed || typeof reviewed !== "object" || Array.isArray(reviewed) || Object.keys(reviewed).length !== 2 || typeof reviewed.postingUrl !== "string" || typeof reviewed.copiedDescription !== "string") return undefined;
    if (reviewed.postingUrl !== submitted.postingUrl || reviewed.copiedDescription.replace(/\r\n?/g, "\n") !== submitted.copiedDescription.replace(/\r\n?/g, "\n")) return undefined;
    return { postingUrl: reviewed.postingUrl, copiedDescription: reviewed.copiedDescription };
  } catch { return undefined; }
}
