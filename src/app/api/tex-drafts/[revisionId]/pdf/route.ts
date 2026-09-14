import { readEditableTexDraftRevision } from "@/domain/resume-generation/editable-tex-drafts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const unavailableHeaders = { "cache-control": "private, no-store", "content-type": "text/plain; charset=utf-8", "cross-origin-resource-policy": "same-origin", "x-content-type-options": "nosniff" };
function responseBody(bytes: Uint8Array): ArrayBuffer { const body = new ArrayBuffer(bytes.byteLength); new Uint8Array(body).set(bytes); return body; }

export async function GET(_request: Request, { params }: { params: Promise<{ revisionId: string }> }): Promise<Response> {
  try {
    const { revisionId } = await params;
    const draft = await readEditableTexDraftRevision({ revisionId });
    return new Response(responseBody(draft.pdf), { headers: { "cache-control": "private, no-store", "content-disposition": "inline; filename=editable-resume.pdf", "content-length": String(draft.pdf.byteLength), "content-type": "application/pdf", "cross-origin-resource-policy": "same-origin", "x-content-type-options": "nosniff" } });
  } catch { return new Response("The editable TeX preview is unavailable.", { status: 404, headers: unavailableHeaders }); }
}
