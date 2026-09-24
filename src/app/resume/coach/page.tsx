import { ApplicationShell } from "@/app/application-shell";
import { CareerCoachWorkspace } from "@/app/career-coach-workspace";

export const dynamic = "force-dynamic";

export default function CareerCoachPage() {
  return (
    <ApplicationShell active="Resume" activeSubItem="Career Coach">
      <CareerCoachWorkspace />
    </ApplicationShell>
  );
}
