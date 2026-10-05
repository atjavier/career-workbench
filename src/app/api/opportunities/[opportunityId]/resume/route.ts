import { readTailoredResume } from "@/application/opportunities/tailored-resume";

export const dynamic = "force-dynamic";
export async function GET(request: Request, { params }: { params: Promise<{ opportunityId: string }> }) {
  const url = new URL(request.url);
  if (request.headers.get("sec-fetch-site") === "cross-site") return new Response("Forbidden", { status: 403 });
  if (url.searchParams.get("reviewed") !== "yes") return new Response("Review the resume before downloading.", { status: 400 });
  const { opportunityId } = await params;
  const result = await readTailoredResume(opportunityId);
  if (!result) return new Response("Resume unavailable", { status: 404 });
  if (url.searchParams.get("generation") !== result.view.generationId) return new Response("Resume changed. Refresh and review it again.", { status: 409 });
  return new Response(new Uint8Array(result.pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": 'attachment; filename="tailored-resume.pdf"', "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}
