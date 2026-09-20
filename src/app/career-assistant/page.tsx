import { ApplicationShell } from "@/app/application-shell";
import { CareerAssistantWorkspace } from "@/app/career-assistant-workspace";

export const dynamic = "force-dynamic";

export default function CareerAssistantPage() {
  return (
    <ApplicationShell active="Career Assistant">
      <CareerAssistantWorkspace />
    </ApplicationShell>
  );
}
