import { readActiveWorkspaceMaterialDraft } from "@/domain/resume-generation/material-draft-commands";
import { compileResumeDraftPdf } from "@/domain/resume-generation/resume-tex-compiler";
import { readBundledResumeTemplate } from "@/files/resume-template";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const unavailableHeaders = {
  "cache-control": "private, no-store",
  "content-type": "text/plain; charset=utf-8",
  "cross-origin-resource-policy": "same-origin",
  "x-content-type-options": "nosniff",
};

function responseBody(bytes: Uint8Array): ArrayBuffer {
  const body = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(body).set(bytes);
  return body;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ draftId: string }> },
): Promise<Response> {
  try {
    const { draftId } = await params;
    const draft = await readActiveWorkspaceMaterialDraft({ draftId });
    const template = await readBundledResumeTemplate();
    if (template.contentDigest !== draft.templateDigest)
      return new Response(
        "The Resume.pdf template changed. Generate a fresh resume preview.",
        { status: 409, headers: unavailableHeaders },
      );
    const pdf = await compileResumeDraftPdf(draft);
    return new Response(responseBody(pdf), {
      headers: {
        "cache-control": "private, no-store",
        "content-disposition": "inline; filename=base-resume.pdf",
        "content-length": String(pdf.byteLength),
        "content-type": "application/pdf",
        "cross-origin-resource-policy": "same-origin",
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return new Response("The generated base resume preview is unavailable.", {
      status: 404,
      headers: unavailableHeaders,
    });
  }
}
