import type { LocalModelConnection } from "./local-model-contracts";

export const endpoint = "http://127.0.0.1:1234/api/v1/chat";

export const maxRequest = 350_000;

export const maxResponse = 12_000;

export const maxFileAgentElapsedMs = 900_000;

export const maxStreamFrame = 8_192;

export // The documentation skill can produce many atomic findings for a real source
// tree. Keep the application contract aligned with its 2,000-candidate import
// ceiling; the request-size guard below still prevents oversized loopback
// payloads and switches to the local deterministic composer when necessary.
const maxResumeCoachEvidence = 2_000;

export const plain = (value: unknown, maximum: number) =>
  typeof value === "string" &&
  value.length > 0 &&
  value.length <= maximum &&
  !/[\u0000-\u001f\u007f-\u009f]/.test(value);

export const boundedText = (value: unknown, maximum: number) =>
  typeof value === "string" &&
  value.length > 0 &&
  value.length <= maximum &&
  !/[\u0000\u007f-\u009f]/.test(value);

export const uuid = (value: unknown) =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );

export const sha = (value: unknown) =>
  typeof value === "string" && /^sha256:[0-9a-f]{64}$/.test(value);

export const exactKeys = (value: Record<string, unknown>, keys: string[]) =>
  Object.keys(value).every((key) => keys.includes(key)) &&
  keys.every((key) => key in value);

export const allowedKeys = (
  value: Record<string, unknown>,
  required: string[],
  optional: string[] = [],
) =>
  required.every((key) => key in value) &&
  Object.keys(value).every(
    (key) => required.includes(key) || optional.includes(key),
  );

export const supports = (claim: string, evidence: string[]) => {
  const words = (value: string) =>
    new Set(value.toLocaleLowerCase().match(/[a-z0-9]{3,}/g) ?? []);
  const claimWords = words(claim);
  return evidence.some(
    (item) =>
      [...claimWords].filter((word) => words(item).has(word)).length >= 2,
  );
};

export const validConnection = (item: LocalModelConnection) =>
  uuid(item.configurationRevisionId) &&
  sha(item.configurationDigest) &&
  plain(item.modelIdentifier, 240);

export const publicConnection = (item: LocalModelConnection) => ({
  revisionId: item.configurationRevisionId,
  contentDigest: item.configurationDigest,
  modelIdentifier: item.modelIdentifier,
});

