import { WorkspaceError } from "@/domain/workspace/types";
import type { LocalModelConnection, FetchLike } from "./local-model-contracts";
import { maxResponse, maxRequest, endpoint, boundedText } from "./model-boundaries";
import { parseModelJson } from "./model-json";

async function readBoundedResponseText(
  response: Response,
  byteLimit: number,
  code:
    | "RESUME_COACH_UNAVAILABLE"
    | "OPPORTUNITY_ASSESSMENT_UNAVAILABLE"
    | "EVIDENCE_DOCUMENTER_INVALID",
): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      bytes += next.value.byteLength;
      if (bytes > byteLimit) {
        await reader.cancel().catch(() => undefined);
        throw new WorkspaceError(
          code,
          "The local model returned an oversized response.",
          "Try the local request again after the model is ready.",
        );
      }
      chunks.push(next.value);
    }
  } finally {
    reader.releaseLock();
  }
  const joined = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(joined);
}

export async function nativeText(
  connection: LocalModelConnection,
  systemPrompt: string,
  input: unknown,
  maximumTokens: number,
  fetcher: FetchLike,
  code:
    | "RESUME_COACH_UNAVAILABLE"
    | "OPPORTUNITY_ASSESSMENT_UNAVAILABLE"
    | "EVIDENCE_DOCUMENTER_INVALID",
  responseLimit = maxResponse,
  reasoning: "off" | "on" = "off",
  timeoutMs?: number,
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    Math.max(
      1_000,
      Math.min(
        900_000,
        timeoutMs ?? Math.max(30_000, 30_000 + maximumTokens * 200),
      ),
    ),
  );
  try {
    const body = JSON.stringify({
      model: connection.modelIdentifier,
      input: JSON.stringify(input),
      system_prompt: systemPrompt,
      stream: false,
      store: false,
      reasoning,
      temperature: 0.2,
      max_output_tokens: maximumTokens,
    });
    if (body.length > maxRequest)
      throw new WorkspaceError(
        code,
        "The selected local material cannot be sent safely.",
        "Review the selected local material and try again.",
      );
    const result = await fetcher(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      signal: controller.signal,
    });
    if (
      !result.ok ||
      Number(result.headers.get("content-length") ?? 0) > responseLimit * 2
    )
      throw new Error("unavailable");
    const raw = await readBoundedResponseText(result, responseLimit * 2, code);
    const parsed = JSON.parse(raw) as {
      response_id?: unknown;
      output?: unknown;
      stats?: { model_load_time_seconds?: unknown };
    };
    if (
      parsed.response_id !== undefined ||
      parsed.stats?.model_load_time_seconds !== undefined ||
      !Array.isArray(parsed.output)
    )
      throw new WorkspaceError(
        code,
        "The local model returned an unsafe stateful response.",
        "Try the local request again after the model is ready.",
      );
    const output = parsed.output as Array<{
      type?: unknown;
      content?: unknown;
    }>;
    const messages = output.filter((item) => item && item.type === "message");
    if (
      messages.length < 1 ||
      output.some(
        (item) =>
          !item || (item.type !== "message" && item.type !== "reasoning"),
      )
    )
      throw new WorkspaceError(
        code,
        "The local model returned an unusable response.",
        "Try the local request again after the model is ready.",
      );
    const rawContent = messages.map((m) => String(m.content ?? "")).join("");
    const content = rawContent.replace(/^[\s\S]*?<\/think>\s*/i, "").trim();
    if (!boundedText(content, responseLimit))
      throw new WorkspaceError(
        code,
        "The local model returned an unusable response.",
        "Try the local request again after the model is ready.",
      );
    return content;
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[nativeText error]:", error);
    }
    if (error instanceof WorkspaceError) throw error;
    if (error instanceof SyntaxError)
      throw new WorkspaceError(
        code,
        "LM Studio returned a malformed service response.",
        "Restart the local server, then try again.",
      );
    throw new WorkspaceError(
      code,
      "Local AI is unavailable right now.",
      "Confirm LM Studio is running locally with the configured model, then try again.",
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function native(
  connection: LocalModelConnection,
  systemPrompt: string,
  input: unknown,
  maximumTokens: number,
  fetcher: FetchLike,
  code:
    | "RESUME_COACH_UNAVAILABLE"
    | "OPPORTUNITY_ASSESSMENT_UNAVAILABLE"
    | "EVIDENCE_DOCUMENTER_INVALID",
  responseLimit = maxResponse,
  reasoning: "off" | "on" = "off",
  timeoutMs?: number,
): Promise<Record<string, unknown>> {
  const content = await nativeText(
    connection,
    systemPrompt,
    input,
    maximumTokens,
    fetcher,
    code,
    responseLimit,
    reasoning,
    timeoutMs,
  );
  try {
    return parseModelJson(content);
  } catch {
    throw new WorkspaceError(
      code,
      "The local model completed a response, but its JSON envelope was malformed.",
      "Try again; this request needs JSON matching the required response shape.",
    );
  }
}

