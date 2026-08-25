import { readCurrentBaseResumePdf } from "@/domain/current-base-resume/current-base-resume-commands";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const unavailableHeaders = {
  "cache-control": "private, no-store",
  "content-type": "text/plain; charset=utf-8",
  "cross-origin-resource-policy": "same-origin",
  "x-content-type-options": "nosniff",
};

function unavailablePdfResponse(): Response {
  return new Response("The original resume PDF is unavailable.", { status: 404, headers: unavailableHeaders });
}

function responseBody(bytes: Uint8Array): ArrayBuffer {
  const body = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(body).set(bytes);
  return body;
}

export async function GET(_request: Request, context: { params: Promise<{ sourceId: string }> }): Promise<Response> {
  const { sourceId } = await context.params;
  const pdf = await readCurrentBaseResumePdf({ sourceId });
  if (!pdf) return unavailablePdfResponse();

  return new Response(responseBody(pdf), {
    headers: {
      "cache-control": "private, no-store",
      "content-disposition": "inline",
      "content-length": String(pdf.byteLength),
      "content-type": "application/pdf",
      "cross-origin-resource-policy": "same-origin",
      "x-content-type-options": "nosniff",
    },
  });
}
