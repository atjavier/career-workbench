import { ApplicationsWorkspace } from "@/app/applications";
import { ApplicationShell } from "@/app/application-shell";

export default function ApplicationsPage() {
  return <ApplicationShell active="Applications"><ApplicationsWorkspace /></ApplicationShell>;
}
