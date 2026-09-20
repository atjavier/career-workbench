import { redirect } from "next/navigation";
import { readMaterialDraft } from "@/domain/resume-generation/material-draft-commands";

export const dynamic = "force-dynamic";

export default async function MaterialDraftReviewPage({
  params,
}: {
  params: Promise<{ draftId: string }>;
}) {
  const { draftId } = await params;
  const draft = await readMaterialDraft({
    draftId,
    requireHandoff: true,
  }).catch(() => undefined);
  // The active Resume workflow has one source of truth: its generated PDF.
  // Preserve old review URLs as a safe handoff rather than exposing an
  // orphaned or unavailable Material Draft page after a resume has been regenerated.
  if (!draft) redirect("/resume");
  redirect("/resume");
}
