import { createHash } from "node:crypto";
import { WorkspaceError } from "@/domain/workspace/types";

export type DocumenterInput = { path: string; text: string };
export type DocumenterProposal = { factualText: string; sourcePaths: string[]; unknowns: string[]; contentDigest: string };
const maximumRequestCharacters = 100_000;
const maximumResponseCharacters = 100_000;
const digest = (value: string) => `sha256:${createHash("sha256").update(value).digest("hex")}`;

function invalid(): never { throw new WorkspaceError("EVIDENCE_LIBRARY_INVALID", "The local model returned no usable resume evidence.", "Review the selected Markdown files and try Document for Resume again."); }
async function readBoundedBody(response: Response): Promise<string> { const declared = Number(response.headers.get("content-length") ?? "0"); if (declared > maximumResponseCharacters) invalid(); if (!response.body) invalid(); const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let length = 0; try { while (true) { const next = await reader.read(); if (next.done) break; length += next.value.byteLength; if (length > maximumResponseCharacters) { await reader.cancel(); invalid(); } chunks.push(next.value); } } finally { reader.releaseLock(); } return new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)); }
function validateProposal(value: unknown, paths: Set<string>): DocumenterProposal {
  if (!value || typeof value !== "object") invalid(); const item = value as Record<string, unknown>;
  const factualText = typeof item.factualText === "string" ? item.factualText.trim() : "";
  if (!Array.isArray(item.sourcePaths) || !item.sourcePaths.length || item.sourcePaths.some((path) => typeof path !== "string" || !paths.has(path))) invalid();
  const sourcePaths = [...new Set(item.sourcePaths as string[])].sort();
  if (!Array.isArray(item.unknowns) || !item.unknowns.length || item.unknowns.some((unknown) => typeof unknown !== "string" || !unknown.trim() || unknown.length > 500)) invalid();
  const unknowns = [...new Set((item.unknowns as string[]).map((unknown) => unknown.trim()))];
  if (!factualText || factualText.length > 5_000 || /[\u0000-\u001f]/.test(factualText) || JSON.stringify(sourcePaths).length > 10_000 || JSON.stringify(unknowns).length > 10_000) invalid();
  return { factualText, sourcePaths, unknowns, contentDigest: digest(factualText) };
}

/** Server-only, loopback-only LM Studio gateway. No retries, fallback, or raw-response persistence. */
export async function documentWithLocalModel(input: DocumenterInput[], fetcher: typeof fetch = fetch): Promise<DocumenterProposal[]> {
  const model = process.env.LM_STUDIO_MODEL?.trim();
  if (!model) throw new WorkspaceError("EVIDENCE_LIBRARY_INVALID", "A local LM Studio model is not configured.", "Set LM_STUDIO_MODEL, start LM Studio on this computer, then try again.");
  const documents = input.map((item) => ({ path: item.path, text: item.text })).filter((item) => item.path && item.text);
  const inputBytes = documents.reduce((total, item) => total + Buffer.byteLength(item.path) + Buffer.byteLength(item.text) + 32, 0);
  if (!documents.length || inputBytes > maximumRequestCharacters) throw new WorkspaceError("EVIDENCE_LIBRARY_INVALID", "The selected Markdown content is unavailable or too large for local documentation.", "Choose a smaller folder of readable Markdown files and try again.");
  const requestText = JSON.stringify(documents);
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const body = JSON.stringify({ model, temperature: 0, response_format: { type: "json_object" }, messages: [{ role: "system", content: "Return JSON only: { proposals: [{ factualText, sourcePaths, unknowns }] }. Use only supplied Markdown. State unknowns explicitly; never invent facts." }, { role: "user", content: requestText }] });
    if (body.length > maximumRequestCharacters) throw new WorkspaceError("EVIDENCE_LIBRARY_INVALID", "The selected Markdown content is unavailable or too large for local documentation.", "Choose a smaller folder of readable Markdown files and try again.");
    const response = await fetcher("http://127.0.0.1:1234/v1/chat/completions", { method: "POST", headers: { "content-type": "application/json", ...(process.env.LM_STUDIO_API_TOKEN ? { authorization: `Bearer ${process.env.LM_STUDIO_API_TOKEN}` } : {}) }, signal: controller.signal, body });
    if (!response.ok) throw new Error("local model unavailable");
    const responseText = await readBoundedBody(response);
    const parsed = JSON.parse(responseText) as { choices?: Array<{ message?: { content?: string } }> }; const content = parsed.choices?.[0]?.message?.content;
    const result = content ? JSON.parse(content) as { proposals?: unknown[] } : undefined;
    if (!result || !Array.isArray(result.proposals) || !result.proposals.length || result.proposals.length > 100) invalid();
    return result.proposals.map((proposal) => validateProposal(proposal, new Set(documents.map((item) => item.path))));
  } catch (error) { if (error instanceof WorkspaceError) throw error; throw new WorkspaceError("EVIDENCE_LIBRARY_INVALID", "The local model could not document this folder.", "Confirm LM Studio is running locally with the configured model, then try again."); }
  finally { clearTimeout(timeout); }
}
