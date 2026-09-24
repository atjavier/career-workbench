import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  try {
    const workerPath = resolve(
      process.cwd(),
      "node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs",
    );
    const code = await readFile(workerPath);
    return new Response(code, {
      headers: {
        "content-type": "application/javascript; charset=utf-8",
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("/* PDF worker unavailable */", {
      status: 500,
      headers: { "content-type": "application/javascript" },
    });
  }
}
