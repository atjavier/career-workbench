export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(): Promise<Response> { return Response.json({ status: "error", summary: "Resume generation begins after the Coach Resume interview is complete.", safeNextAction: "Return to Resume and finish evidence intake." }, { status: 409, headers: { "Cache-Control": "no-store" } }); }
