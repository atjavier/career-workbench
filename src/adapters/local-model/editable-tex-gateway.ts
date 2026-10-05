import { editableTexRevisionSystemInstruction } from "@/adapters/local-model/editable-tex-agent";
import { rawTexDocumentPolicy } from "@/domain/resume-generation/resume-tex-compiler";
import { WorkspaceError } from "@/domain/workspace/types";
import { createHash } from "node:crypto";
import type { EditableTexRevisionRequest, EditableTexRevisionResponse, FetchLike } from "./local-model-contracts";
import { boundedText, exactKeys, plain, publicConnection, sha, uuid, validConnection } from "./model-boundaries";
import { localModelCapabilityVersion } from "./model-consent";
import { parseModelJson } from "./model-json";
import { nativeText } from "./native-transport";

export const editableTexMaximumRequestBytes = 72_000;

export const editableTexMaximumResponseBytes = 48_000;

const editableTexOutputTokens = 12_000;

const safeRelativeArtifactPath = (value: unknown) =>
  typeof value === "string" &&
  value.length > 0 &&
  value.length <= 800 &&
  !/[\\\u0000-\u001f\u007f-\u009f]/.test(value) &&
  !value.split("/").some((segment) => segment === ".." || segment === ".") &&
  !/^(?:[a-z]:|\/|[a-z][a-z0-9+.-]*:)/i.test(value);

export function editableTexRevisionConsentFingerprint(
  input: Omit<EditableTexRevisionRequest, "consentFingerprint">,
): string {
  return `sha256:${createHash("sha256")
    .update(
      JSON.stringify({
        capability: localModelCapabilityVersion("editable-tex-revision"),
        connection: publicConnection(input.connection),
        workspaceId: input.workspaceId,
        displayName: input.displayName,
        baseline: {
          id: input.baseline.id,
          contentDigest: input.baseline.contentDigest,
        },
        artifacts: input.artifacts
          .map(({ documentId, path, contentDigest }) => ({
            documentId,
            path,
            contentDigest,
          }))
          .sort((a, b) => a.path.localeCompare(b.path)),
        contextLimitTokens: input.contextLimitTokens,
        consentNonce: input.consentNonce,
      }),
    )
    .digest("hex")}`;
}

/** Calculates the full packet before inference. Callers must not trim artifacts to fit. */
function editableTexPacket(request: EditableTexRevisionRequest) {
  return {
    schemaVersion: 1,
    selectionEcho: request.consentFingerprint,
    baseline: {
      id: request.baseline.id,
      contentDigest: request.baseline.contentDigest,
      tex: request.baseline.tex,
    },
    artifacts: request.artifacts.map(({ path, contentDigest, text }) => ({
      path,
      contentDigest,
      text,
    })),
    documentPolicy: rawTexDocumentPolicy(request.baseline.tex),
    responseShape: {
      schemaVersion: 1,
      selectionEcho: request.consentFingerprint,
      tex: "complete TeX document",
      artifactCitations: request.artifacts.map(({ path, contentDigest }) => ({
        path,
        contentDigest,
      })),
    },
  };
}

function editableTexTransportBody(request: EditableTexRevisionRequest): string {
  return JSON.stringify({
    model: request.connection.modelIdentifier,
    input: JSON.stringify(editableTexPacket(request)),
    system_prompt: editableTexRevisionSystemInstruction,
    stream: false,
    store: false,
    reasoning: "off",
    temperature: 0.2,
    max_output_tokens: editableTexOutputTokens,
  });
}

/**
 * LM Studio exposes a context-token limit but not a tokenizer/chat-template
 * contract for this endpoint.  The exact UTF-8 request body is therefore used
 * as a tokenizer-independent upper bound for input tokens (a byte tokenizer
 * consumes at most one token per byte).  The output reserve is the exact
 * `max_output_tokens` value sent in that same body.  This deliberately uses
 * upper-bound units, rather than claiming either value is an exact token count.
 */
export function editableTexRequestBudget(request: EditableTexRevisionRequest): {
  serializedRequestBytes: number;
  responseByteLimit: number;
  inputTokenUpperBound: number;
  responseTokenReserve: number;
  totalContextTokenUpperBound: number;
} {
  const serializedRequestBytes = Buffer.byteLength(
    editableTexTransportBody(request),
    "utf8",
  );
  const inputTokenUpperBound = serializedRequestBytes;
  const responseTokenReserve = editableTexOutputTokens;
  return {
    serializedRequestBytes,
    responseByteLimit: editableTexMaximumResponseBytes,
    inputTokenUpperBound,
    responseTokenReserve,
    totalContextTokenUpperBound: inputTokenUpperBound + responseTokenReserve,
  };
}

function editableTexInvalid(
  message: string,
  next = "Reduce neither the template nor the approved artifacts; use a model context configured for this complete draft packet.",
): never {
  throw new WorkspaceError("RESUME_COACH_INVALID", message, next);
}

function validateEditableTexRequest(request: EditableTexRevisionRequest): void {
  const budget = editableTexRequestBudget(request);
  if (
    !validConnection(request.connection) ||
    !uuid(request.workspaceId) ||
    !plain(request.displayName, 120) ||
    !uuid(request.baseline.id) ||
    !sha(request.baseline.contentDigest) ||
    !boundedText(request.baseline.tex, editableTexMaximumResponseBytes) ||
    !plain(request.consentNonce, 128) ||
    !sha(request.consentFingerprint) ||
    !Number.isInteger(request.contextLimitTokens) ||
    request.contextLimitTokens < editableTexOutputTokens + 1 ||
    request.contextLimitTokens > 30_000 ||
    !request.artifacts.length ||
    request.artifacts.length > 200 ||
    request.artifacts.some(
      (artifact) =>
        !uuid(artifact.documentId) ||
        !safeRelativeArtifactPath(artifact.path) ||
        !sha(artifact.contentDigest) ||
        !boundedText(artifact.text, 2 * 1024 * 1024),
    ) ||
    new Set(request.artifacts.map((artifact) => artifact.path)).size !==
      request.artifacts.length ||
    request.consentFingerprint !==
      editableTexRevisionConsentFingerprint(request)
  )
    editableTexInvalid(
      "The selected TeX draft material cannot be sent safely.",
    );
  if (
    budget.serializedRequestBytes > editableTexMaximumRequestBytes ||
    budget.totalContextTokenUpperBound > request.contextLimitTokens
  )
    editableTexInvalid(
      "The complete TeX template and approved artifact packet exceed the configured local-model context.",
    );
}

export function validateEditableTexRevisionResponse(
  value: unknown,
  request: EditableTexRevisionRequest,
): EditableTexRevisionResponse {
  if (!value || typeof value !== "object" || Array.isArray(value))
    editableTexInvalid("The local model returned an unusable TeX revision.");
  const item = value as Record<string, unknown>;
  const citations = item.artifactCitations;
  if (
    !exactKeys(item, [
      "schemaVersion",
      "selectionEcho",
      "tex",
      "artifactCitations",
    ]) ||
    item.schemaVersion !== 1 ||
    item.selectionEcho !== request.consentFingerprint ||
    !boundedText(item.tex, editableTexMaximumResponseBytes) ||
    (typeof item.tex === "string" &&
      Buffer.byteLength(item.tex, "utf8") > editableTexMaximumResponseBytes) ||
    !Array.isArray(citations) ||
    citations.length !== request.artifacts.length
  )
    editableTexInvalid("The local model returned an incomplete TeX revision.");
  const expected = new Map(
    request.artifacts.map((artifact) => [
      artifact.path,
      artifact.contentDigest,
    ]),
  );
  if (
    citations.some(
      (citation) =>
        !citation ||
        typeof citation !== "object" ||
        Array.isArray(citation) ||
        !exactKeys(citation as Record<string, unknown>, [
          "path",
          "contentDigest",
        ]) ||
        !safeRelativeArtifactPath((citation as { path?: unknown }).path) ||
        !sha((citation as { contentDigest?: unknown }).contentDigest) ||
        expected.get((citation as { path: string }).path) !==
          (citation as { contentDigest: string }).contentDigest,
    ) ||
    new Set(citations.map((citation) => (citation as { path: string }).path))
      .size !== citations.length
  )
    editableTexInvalid(
      "The local model did not cite the complete approved artifact snapshot.",
    );
  return {
    schemaVersion: 1,
    selectionEcho: request.consentFingerprint,
    tex: String(item.tex),
    artifactCitations:
      citations as EditableTexRevisionResponse["artifactCitations"],
  };
}

export async function requestEditableTexRevision(
  request: EditableTexRevisionRequest,
  fetcher: FetchLike = fetch,
): Promise<EditableTexRevisionResponse> {
  validateEditableTexRequest(request);
  // validateEditableTexRequest budgets this exact serialization before any transport.
  const content = await nativeText(
    request.connection,
    editableTexRevisionSystemInstruction,
    editableTexPacket(request),
    editableTexOutputTokens,
    fetcher,
    "RESUME_COACH_UNAVAILABLE",
    editableTexMaximumResponseBytes,
  );
  let parsed: unknown;
  try {
    parsed = parseModelJson(content);
  } catch {
    editableTexInvalid(
      "The local model returned a malformed TeX response envelope.",
    );
  }
  return validateEditableTexRevisionResponse(parsed, request);
}

