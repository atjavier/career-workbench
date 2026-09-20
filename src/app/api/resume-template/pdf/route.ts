import {
  bootstrapBundledResumeTemplate,
  readDesignatedResumeTemplatePdf,
} from "@/domain/resume-generation/resume-template-commands";

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

export async function GET(): Promise<Response> {
  try {
    await bootstrapBundledResumeTemplate();
  } catch {
    return new Response("The Resume.pdf template is unavailable.", {
      status: 404,
      headers: unavailableHeaders,
    });
  }
  const pdf = await readDesignatedResumeTemplatePdf();
  if (!pdf)
    return new Response("The Resume.pdf template is unavailable.", {
      status: 404,
      headers: unavailableHeaders,
    });
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
