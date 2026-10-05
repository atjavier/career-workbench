import { ApplicationShell } from "@/components/common/application-shell";
import { CareerAssistantWorkspace } from "@/components/career-assistant/career-assistant-workspace";

export const dynamic = "force-dynamic";

export default function CareerAssistantPage() {
  return (
    <ApplicationShell active="Career Assistant">
      <CareerAssistantWorkspace />
    </ApplicationShell>
  );
}
