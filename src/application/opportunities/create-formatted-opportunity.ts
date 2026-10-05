import { confirmCapturedOpportunity } from "@/domain/opportunities/captured-opportunities";
import { readJobOpportunity } from "@/application/opportunities/read-job-opportunity";
import { validateOpportunitySource, type OpportunitySource } from "@/domain/opportunities/opportunity-source";
export async function createFormattedOpportunity(input: OpportunitySource & { appDataRoot?: string }, options: { generate?: typeof readJobOpportunity } = {}) {
  validateOpportunitySource(input);
  const fields = await (options.generate ?? readJobOpportunity)(input, { appDataRoot: input.appDataRoot });
  return confirmCapturedOpportunity({ ...input, ...fields, title: fields.title || "Unknown", company: fields.company || "Unknown", location: fields.location || "Unknown", workStyle: fields.workStyle || "Unknown", requirements: fields.requirements || "Unknown", postedAt: fields.postedAt || "Unknown", capturedAt: new Date().toISOString() });
}
