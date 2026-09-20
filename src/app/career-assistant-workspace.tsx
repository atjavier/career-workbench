import { CareerAssistant } from "@/app/career-assistant";
import { listDocumenterProposals } from "@/domain/evidence/evidence-documenter";

const safeError = (error: unknown) =>
  error instanceof Error && "summary" in error && "safeNextAction" in error
    ? {
        summary: String(error.summary),
        safeNextAction: String(error.safeNextAction),
      }
    : {
        summary: "Career Assistant proposals are unavailable.",
        safeNextAction: "Check local workspace storage, then refresh the page.",
      };

export async function CareerAssistantWorkspace() {
  const proposalState = await listDocumenterProposals()
    .then((proposals) => ({ proposals, error: undefined }))
    .catch((error) => ({ proposals: [], error: safeError(error) }));
  return (
    <div className="workspace-shell career-assistant-workspace">
      <header className="workspace-header">
        <p className="eyebrow">Career Assistant</p>
        <h1>Turn project work into reviewable resume evidence</h1>
        <p>
          Choose a project folder when you are ready. This guide helps you
          create local evidence proposals; you stay in control of every
          decision.
        </p>
      </header>
      <CareerAssistant
        proposals={proposalState.proposals}
        error={proposalState.error}
      />
    </div>
  );
}
