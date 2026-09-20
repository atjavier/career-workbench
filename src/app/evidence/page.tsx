import { ApplicationShell } from "@/app/application-shell";
import { EvidenceLibraryWorkspace } from "@/app/evidence-library-workspace";

export const dynamic = "force-dynamic";

export default function EvidencePage() {
  return (
    <ApplicationShell active="Resume">
      <EvidenceLibraryWorkspace />
    </ApplicationShell>
  );
}
