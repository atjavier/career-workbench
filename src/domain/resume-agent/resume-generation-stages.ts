export type ResumeStageFinding = {
  evidenceIndexes: number[];
  clarificationIndexes: number[];
  fact: string;
};

export type ResumeStageSlot = {
  sectionIndex: number;
  findingIndexes: number[];
};

export type ResumeStageClaim = {
  text: string;
  evidenceIndexes: number[];
  clarificationIndexes: number[];
};

export type ResumeStageEdit = {
  sectionIndex: number;
  text: string;
  claims: ResumeStageClaim[];
};

export type ResumeStageReview = {
  verdict: "accept" | "reject";
  reasons: string[];
};

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

export const hasExactKeys = (value: Record<string, unknown>, keys: string[]) =>
  Object.keys(value).length === keys.length &&
  keys.every((key) => Object.prototype.hasOwnProperty.call(value, key));

export const isBoundedText = (
  value: unknown,
  maximum: number,
): value is string =>
  typeof value === "string" &&
  value.length > 0 &&
  value.length <= maximum &&
  !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/.test(value);

export const isIndexArray = (
  value: unknown,
  maximum: number,
): value is number[] =>
  Array.isArray(value) &&
  value.length <= maximum &&
  value.every((index) => Number.isInteger(index) && index >= 0) &&
  new Set(value).size === value.length;
