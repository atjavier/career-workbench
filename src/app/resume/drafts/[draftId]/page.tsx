import { ApplicationShell } from "@/app/application-shell";
import { MaterialDraftReview } from "@/app/material-draft-review";
import { readMaterialDraft } from "@/domain/resume-generation/material-draft-commands";

export const dynamic = "force-dynamic";

export default async function MaterialDraftReviewPage({ params }: { params: Promise<{ draftId: string }> }) {
  const { draftId } = await params;
  const draft = await readMaterialDraft({ draftId, requireHandoff: true }).catch(() => undefined);
  if (!draft) return <ApplicationShell active="Resume"><div className="workspace-shell material-draft-unavailable"><h1>Local draft unavailable</h1><p>This local review draft is unavailable. Return to Resume and generate local guidance again.</p></div></ApplicationShell>;
  return <ApplicationShell active="Resume"><MaterialDraftReview draft={draft} /></ApplicationShell>;
}
