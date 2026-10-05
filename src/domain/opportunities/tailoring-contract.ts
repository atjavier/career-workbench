import type { MaterialDraftView } from "@/domain/resume-generation/material-draft-types";
import { WorkspaceError } from "@/domain/workspace/types";

export type TailoringStage = "analyst" | "writer" | "reviewer";
export type TailoringBullet = { index: number; text: string; section: string };
const work = /^(?:work\s+)?experience$|^projects?$|^professional experience$/i;
const bullet = /^\s*[-*•]\s+(.+)$/;
export function tailoringInvalid(): never {
  throw new WorkspaceError("TAILORED_RESUME_INVALID", "The tailored resume could not be validated against your base resume.", "Review your base resume and try tailoring again.");
}
export function baseBullets(base: MaterialDraftView): TailoringBullet[] {
  const results: TailoringBullet[] = [];
  for (const section of base.sections) {
    if (!work.test(section.heading.trim())) continue;
    for (const line of section.text.split("\n")) {
      const match = line.match(bullet);
      if (match) results.push({ index: results.length, text: match[1], section: section.heading });
    }
  }
  if (!results.length || results.length > 200) return tailoringInvalid();
  return results;
}
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return tailoringInvalid();
  return value as Record<string, unknown>;
};
const indexes = (value: unknown, maximum: number): number[] => {
  if (!Array.isArray(value) || value.length > maximum || value.some(i => !Number.isInteger(i) || i < 0 || i >= maximum) || new Set(value).size !== value.length) return tailoringInvalid();
  return value;
};
export function validateAnalysis(value: unknown, description: string, count: number) {
  const result = object(value);
  if (!Array.isArray(result.requirements) || !result.requirements.length || result.requirements.length > 20 || !Array.isArray(result.unknowns) || result.unknowns.length > 20) return tailoringInvalid();
  const requirements = result.requirements.map(item => {
    const row = object(item);
    if (typeof row.excerpt !== "string" || !row.excerpt.trim() || row.excerpt.length > 1000 || !description.includes(row.excerpt)) return tailoringInvalid();
    return { excerpt: row.excerpt, bulletIndexes: indexes(row.bulletIndexes, count) };
  });
  if (result.unknowns.some(x => typeof x !== "string" || x.length > 500 || /[\u0000-\u001f]/.test(x))) return tailoringInvalid();
  return { requirements, unknowns: result.unknowns as string[] };
}
export function validateBulletOrder(value: unknown, count: number) {
  const order = indexes(object(value).bulletOrder, count);
  if (!order.length) return tailoringInvalid();
  return order;
}
export function validateVerdict(value: unknown) {
  const verdict = object(value);
  if (verdict.verdict !== "accept" || !Array.isArray(verdict.reasons) || verdict.reasons.length !== 0) return tailoringInvalid();
}
/** Change only verified bullet selection/order; retain all baseline metadata verbatim. */
export function curateBaseResume(base: MaterialDraftView, order: number[]): MaterialDraftView {
  const all = baseBullets(base);
  if (!order.length || order.some(i => !all[i]) || new Set(order).size !== order.length) return tailoringInvalid();
  let index = 0;
  const sections = base.sections.map(section => {
    if (!work.test(section.heading.trim())) return { ...section };
    const lines = section.text.split("\n");
    const output: string[] = [];
    for (let i = 0; i < lines.length;) {
      if (!bullet.test(lines[i])) { output.push(lines[i++]); continue; }
      const group: Array<{ index: number; line: string }> = [];
      while (i < lines.length && bullet.test(lines[i])) group.push({ index: index++, line: lines[i++] });
      const retained = order.flatMap(position => group.filter(item => item.index === position));
      // Keep each work entry's metadata anchored to at least one supported bullet.
      if (!retained.length) return tailoringInvalid();
      output.push(...retained.map(item => item.line));
    }
    return { ...section, text: output.join("\n") };
  });
  return { ...base, sections };
}
/** Edits can reorder/trim verified bullets; identity, dates and metadata stay host-owned. */
export function validateTailoredEdit(base: MaterialDraftView, texts: string[]): MaterialDraftView {
  if (texts.length !== base.sections.length) return tailoringInvalid();
  const available = baseBullets(base);
  const order: number[] = [];
  base.sections.forEach((section, i) => {
    if (typeof texts[i] !== "string" || texts[i].length > 30000) return tailoringInvalid();
    if (!work.test(section.heading.trim())) {
      if (texts[i] !== section.text) return tailoringInvalid();
      return;
    }
    for (const line of texts[i].split("\n")) {
      const match = line.match(bullet);
      if (!match) continue;
      const found = available.find(item => item.section === section.heading && item.text === match[1] && !order.includes(item.index));
      if (!found) return tailoringInvalid();
      order.push(found.index);
    }
  });
  const result = curateBaseResume(base, order);
  if (result.sections.some((section, i) => section.text !== texts[i])) return tailoringInvalid();
  return result;
}
