import { ApplicationsWorkspace } from "@/components/applications/applications-workspace";
import { ApplicationShell } from "@/components/common/application-shell";

export default function ApplicationsPage() {
  return (
    <ApplicationShell active="Jobs" activeSubItem="Applied">
      <ApplicationsWorkspace />
    </ApplicationShell>
  );
}
