import { readActiveWorkspaceMaterialDraft } from "@/application/resume-generation/material-draft-commands";
import { getOrCompileResumeDraftPdf } from "@/domain/resume-generation/resume-draft-pdf-cache";

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

export type ResumeDraftPdfRouteOptions = {
  appDataRoot?: string;
  readDraft?: typeof readActiveWorkspaceMaterialDraft;
  getPdf?: typeof getOrCompileResumeDraftPdf;
};

export async function createResumeDraftPdfResponse(
  _request: Request,
  params: Promise<{ draftId: string }>,
  options?: ResumeDraftPdfRouteOptions,
): Promise<Response> {
  try {
    const { draftId } = await params;
    const readDraft = options?.readDraft ?? readActiveWorkspaceMaterialDraft;
    const getPdf = options?.getPdf ?? getOrCompileResumeDraftPdf;
    const draft = await readDraft({
      draftId,
      appDataRoot: options?.appDataRoot,
    });
    const pdf = await getPdf(draft, { appDataRoot: options?.appDataRoot });
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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ draftId: string }> },
): Promise<Response> {
  return createResumeDraftPdfResponse(request, params);
}
