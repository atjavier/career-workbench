import { readActiveWorkspaceMaterialDraft } from "@/domain/resume-generation/material-draft-commands";
import { renderResumeDraftTex } from "@/domain/resume-generation/resume-tex";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const unavailableHeaders = {
  "cache-control": "private, no-store",
  "content-type": "text/plain; charset=utf-8",
  "cross-origin-resource-policy": "same-origin",
  "x-content-type-options": "nosniff",
};

export async function GET(_request: Request, { params }: { params: Promise<{ draftId: string }> }): Promise<Response> {
  try {
    const { draftId } = await params;
    const draft = await readActiveWorkspaceMaterialDraft({ draftId });
    const source = renderResumeDraftTex(draft);
    return new Response(source, {
      headers: {
        "cache-control": "private, no-store",
        "content-disposition": "attachment; filename=base-resume.tex",
        "content-type": "application/x-tex; charset=utf-8",
        "content-length": String(new TextEncoder().encode(source).byteLength),
        "cross-origin-resource-policy": "same-origin",
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return new Response("The generated base resume source is unavailable.", { status: 404, headers: unavailableHeaders });
  }
}
