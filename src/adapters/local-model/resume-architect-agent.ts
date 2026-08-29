import { resumeArchitectContract } from "@/domain/resume-agent/resume-agent-contracts";

/** Shared doctrine for bounded local-model resume stages. The application
 * supplies the evidence packet; this instruction never grants file or tool access. */
export const resumeArchitectSystemInstruction = resumeArchitectContract;
