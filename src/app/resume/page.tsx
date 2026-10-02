import { ApplicationShell } from "@/components/common/application-shell";
import { ResumeWorkspace } from "@/components/resume/resume-workspace";

export const dynamic = "force-dynamic";

export default function ResumePage() {
  return (
    <ApplicationShell active="Resume" activeSubItem="Resume Preview">
      <ResumeWorkspace />
    </ApplicationShell>
  );
}
