import { resumeArchitectSystemInstruction } from "@/adapters/local-model/resume-architect-agent";
import { resumeCoachContract } from "@/adapters/local-model/resume-agent-shared-instructions";

export const resumeCoachSystemInstruction = `${resumeArchitectSystemInstruction} ${resumeCoachContract}`;
