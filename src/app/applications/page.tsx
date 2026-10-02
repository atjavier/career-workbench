import { ApplicationsWorkspace } from "@/components/pro/applications";
import { ApplicationShell } from "@/components/common/application-shell";

export default function ApplicationsPage() {
  return (
    <ApplicationShell active="Applications">
      <ApplicationsWorkspace />
    </ApplicationShell>
  );
}
