import { resumeArchitectSystemInstruction } from "@/adapters/local-model/resume-architect-agent";
import { resumeCoachContract } from "@/domain/resume-agent/resume-agent-contracts";

export const resumeCoachSystemInstruction = `${resumeArchitectSystemInstruction} ${resumeCoachContract}`;
