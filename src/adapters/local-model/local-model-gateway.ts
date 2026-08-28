import { createHash } from "node:crypto";
import { WorkspaceError } from "@/domain/workspace/types";
import { folderDocumenterArtifactInstruction, folderDocumenterSystemInstruction } from "@/adapters/local-model/folder-documenter-agent";
import { containsUnsafeResumeContent, resumeGeneratorEditorialInstruction, resumeGeneratorEvidenceIntelligenceInstruction, resumeGeneratorProjectIdentityInstruction, resumeGeneratorSystemInstruction } from "@/adapters/local-model/resume-generator-agent";
import { resumeCoachSystemInstruction as resumeCoachReviewSystemInstruction } from "@/adapters/local-model/resume-coach-agent";

const endpoint = "http://127.0.0.1:1234/api/v1/chat";
const maxRequest = 72_000; const maxResponse = 12_000;
// The documentation skill can produce many atomic findings for a real source
// tree. Keep the application contract aligned with its 2,000-candidate import
// ceiling; the request-size guard below still prevents oversized loopback
// payloads and switches to the local deterministic composer when necessary.
const maxResumeCoachEvidence = 2_000;
const resumeGeneratorEvidenceCitationInstruction = "Each supplied evidence item includes evidenceIndex. For every visible Experience or Projects bullet, claims.evidenceIndexes must contain only directly supporting supplied evidenceIndex values; never invent positions or use a digest as an index.";
const plain = (value: unknown, maximum: number) => typeof value === "string" && value.length > 0 && value.length <= maximum && !/[\u0000-\u001f\u007f-\u009f]/.test(value);
const boundedText = (value: unknown, maximum: number) => typeof value === "string" && value.length > 0 && value.length <= maximum && !/[\u0000\u007f-\u009f]/.test(value);
const uuid = (value: unknown) => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const sha = (value: unknown) => typeof value === "string" && /^sha256:[0-9a-f]{64}$/.test(value);
const exactKeys = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).every((key) => keys.includes(key)) && keys.every((key) => key in value);
const supports = (claim: string, evidence: string[]) => { const words = (value: string) => new Set(value.toLocaleLowerCase().match(/[a-z0-9]{3,}/g) ?? []); const claimWords = words(claim); return evidence.some((item) => [...claimWords].filter((word) => words(item).has(word)).length >= 2); };
const resumeBulletMarker = /^\s*[-*\u2022]\s+/;
const comparableResumeText = (value: string) => value.trim().replace(resumeBulletMarker, "").replace(/\s+/g, " ").replace(/[.]+$/, "").toLocaleLowerCase();
function resumeRelevantModelEvidence(evidence: ResumeCoachRequest["evidence"]): Array<{ index: number; factualText: string; contentDigest: string }> {
  const score = (value: string) => (value.match(/\b(?:workflow|validate|validation|sqlite|durable|cancel|evidence|predictor|classification|variant|vcf|result|upload)\b/gi) ?? []).length;
  return evidence.flatMap((item, index) => {
    const source = item.factualText.trim();
    if (/`|(?:^|\s)(?:docs|src|tests|node_modules)\/|\b(?:get|post|put|patch|delete)\s+\/|\b(?:insert into|logger=|command:|story key|setup\.md)\b/i.test(source)) return [];
    const factualText = /create a durable run record in sqlite/i.test(source)
      ? "Created durable SQLite-backed run records for the documented analysis workflow."
      : /allow canceling a run with a durable, guarded state transition/i.test(source)
        ? "Implemented guarded run cancellation with durable workflow state."
        : /validate it immediately.*before any pipeline execution/i.test(source)
          ? "Added immediate VCF validation feedback before analysis processing."
          : source;
    return [{ index, factualText, contentDigest: item.contentDigest }];
  }).sort((left, right) => score(right.factualText) - score(left.factualText) || left.index - right.index).slice(0, 20);
}
function resumeGenerationDocumentation(documentation: ResumeCoachDocumentation[] | undefined): ResumeCoachDocumentation[] {
  return (documentation ?? []).map((group) => {
    const context = group.documents.find((document) => /resume-bullet-candidates\.md$/i.test(document.path));
    const evidence = group.documents.find((document) => /resume-evidence\.md$/i.test(document.path));
    const contextOnly = context?.text
      .replace(/^[\s\S]*?^\s*## Resume Context\s*$/mi, "")
      .replace(/^\s*## Candidate Bullets\s*$(?:[\s\S]*)$/mi, "")
      .trim();
    const document = context && contextOnly ? { ...context, text: `# Resume Bullet Candidates (Proposed / Unreviewed)\n\n## Resume Context\n\n${contextOnly.slice(0, 6_000)}` } : evidence ? { ...evidence, text: evidence.text.slice(0, 3_000) } : undefined;
    return document ? { ...group, documents: [document] } : { ...group, documents: [] };
  }).filter((group) => group.documents.length > 0);
}
function restoreOriginalEvidenceIndexes(value: unknown, selected: Array<{ index: number; factualText: string; contentDigest: string }>, evidence: ResumeCoachRequest["evidence"]): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const item = value as Record<string, unknown>;
  if (!Array.isArray(item.claims)) return value;
  return { ...item, claims: item.claims.map((claim) => {
    if (!claim || typeof claim !== "object") return claim;
    const claimRecord = claim as Record<string, unknown>;
    const indexes = claimRecord.evidenceIndexes;
    if (!Array.isArray(indexes)) return claim;
    const referenced = indexes.flatMap((index) => {
      // A digest is an unambiguous reference to a model-visible fact.
      if (typeof index === "string") return selected.find((item) => item.contentDigest === index || item.contentDigest === `sha256:${index}`)?.index;
      if (!Number.isInteger(index) || (index as number) < 0) return [];
      // Older responses used a model-packet position. Newer Qwen responses
      // invent numeric values despite never receiving positions. Consider
      // both possible meanings, but validate them against the claim below.
      const numeric = index as number;
      return [...new Set([selected[numeric]?.index, numeric].filter((candidate): candidate is number => candidate !== undefined && candidate < evidence.length))];
    });
    const text = typeof claimRecord.text === "string" ? claimRecord.text : "";
    const directlySupported = (index: number) => supports(text, [evidence[index]?.factualText ?? ""]);
    const resolved = [...new Set(referenced.filter((index): index is number => typeof index === "number" && directlySupported(index)))];
    // Do not let an arbitrary number from the model invalidate an otherwise
    // grounded bullet. This uses the same conservative lexical-support rule
    // as the normal claim inference path, over evidence the user supplied.
    const inferred = resolved.length ? resolved : evidence.flatMap((item, index) => directlySupported(index) ? [index] : []).slice(0, 4);
    return { ...claimRecord, evidenceIndexes: inferred };
  }) };
}
function normalizeGeneratedResume(value: unknown, documentedProjectNames: string[] = []): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const item = value as Record<string, unknown>;
  const sections: unknown[] = Array.isArray(item.sections) ? item.sections.map((section) => {
    if (!section || typeof section !== "object") return section;
    const record = section as Record<string, unknown>;
    const heading = String(record.heading ?? "").trim();
    if (!/^projects?$/i.test(heading) || typeof record.text !== "string") return { ...record, heading };
    const lines = record.text.split(/\r?\n/).filter(Boolean);
    const title = lines.shift()?.replace(resumeBulletMarker, "").trim();
    const documentedName = documentedProjectNames.length === 1 ? documentedProjectNames[0] : documentedProjectNames.find((name) => new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*(?:\\||$)`, "i").test(title ?? ""));
    const descriptorWords = title?.includes("|") ? title.split("|").slice(1).join("|").trim().split(/\s+/).slice(0, 12) : [];
    while (descriptorWords.length && /^(?:and|or|for|to|with|of|in|into|on|at|by)$/i.test(descriptorWords.at(-1) ?? "") || /ing[.,;:]?$/i.test(descriptorWords.at(-1) ?? "")) descriptorWords.pop();
    const descriptor = descriptorWords.join(" ");
    const normalizedTitle = documentedName ? `${documentedName}${descriptor ? ` | ${descriptor}` : ""}` : title;
    const bullets = lines.filter((line) => resumeBulletMarker.test(line) && !containsUnsafeResumeContent(line.replace(resumeBulletMarker, ""))).slice(0, 4);
    return normalizedTitle ? { ...record, heading: "Projects", text: [normalizedTitle, ...bullets].join("\n") } : { ...record, heading };
  }) : [];
  const visibleProjectBullets = (sections ?? []).filter((section) => section && typeof section === "object" && /^projects?$/i.test(String((section as Record<string, unknown>).heading ?? "").trim())).flatMap((section) => String((section as Record<string, unknown>).text ?? "").split(/\r?\n/).filter((line) => resumeBulletMarker.test(line)).map((line) => line.replace(resumeBulletMarker, "").trim()));
  const normalizedClaims = Array.isArray(item.claims) ? item.claims.map((claim) => claim && typeof claim === "object" ? { ...(claim as Record<string, unknown>), text: typeof (claim as Record<string, unknown>).text === "string" ? String((claim as Record<string, unknown>).text).replace(resumeBulletMarker, "").trim() : (claim as Record<string, unknown>).text } : claim) : item.claims;
  const claims = Array.isArray(normalizedClaims) && visibleProjectBullets.length ? visibleProjectBullets.flatMap((bullet) => {
    const comparableBullet = comparableResumeText(bullet);
    const matching = normalizedClaims.find((claim) => claim && typeof claim === "object" && typeof (claim as Record<string, unknown>).text === "string" && (() => { const comparableClaim = comparableResumeText(String((claim as Record<string, unknown>).text)); return comparableBullet.startsWith(comparableClaim) || comparableClaim.startsWith(comparableBullet); })() && Array.isArray((claim as Record<string, unknown>).evidenceIndexes) && (claim as { evidenceIndexes: unknown[] }).evidenceIndexes.length > 0);
    return matching ? [{ ...(matching as Record<string, unknown>), text: bullet }] : [];
  }) : normalizedClaims;
  const hasClaimEntries = Array.isArray(normalizedClaims) && normalizedClaims.length > 0;
  const claimedProjectBullets = new Set(Array.isArray(claims) ? claims.filter((claim) => claim && typeof claim === "object").map((claim) => String((claim as Record<string, unknown>).text ?? "")) : []);
  const claimedSections = hasClaimEntries ? sections.map((section) => {
    if (!section || typeof section !== "object" || !/^projects?$/i.test(String((section as Record<string, unknown>).heading ?? "").trim())) return section;
    const lines = String((section as Record<string, unknown>).text ?? "").split(/\r?\n/);
    return { ...(section as Record<string, unknown>), text: lines.filter((line, index) => index === 0 || !resumeBulletMarker.test(line) || claimedProjectBullets.has(line.replace(resumeBulletMarker, "").trim())).join("\n") };
  }) : sections;
  return { ...item, sections: claimedSections, claims };
}
function parseModelJson(content: string): unknown { const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(content.trim()); const source = fenced?.[1] ?? content.trim(); try { return JSON.parse(source); } catch (firstError) { let repaired = ""; let inString = false; let escaped = false; for (const character of source) { if (inString && /[\u0000-\u001f]/.test(character)) { repaired += JSON.stringify(character).slice(1, -1); escaped = false; continue; } repaired += character; if (escaped) { escaped = false; continue; } if (character === "\\") { escaped = true; continue; } if (character === "\"") inString = !inString; }
  // Qwen occasionally emits its supplied SHA references as bare hexadecimal
  // tokens. Repair only those tokens within evidenceIndexes arrays; never
  // relax the envelope or accept arbitrary JavaScript syntax.
  repaired = repaired.replace(/("evidenceIndexes"\s*:\s*\[)([^\]]*)(\])/g, (_match, opening, indexes, closing) => `${opening}${indexes.replace(/(^|,)(\s*)([a-f0-9]{64})(\s*)(?=,|$)/gi, '$1$2"$3"$4')}${closing}`);
  try { return JSON.parse(repaired); } catch { throw firstError; } }
}

export type LocalModelConnection = { configurationRevisionId: string; configurationDigest: string; modelIdentifier: string };
export type ResumeCoachOpportunity = { revisionId: string; contentDigest: string; title: string; company: string; requirements: string[]; copiedDescription: string };
export type ResumeCoachEvidence = { id: string; contentDigest: string; factualText: string; sourceDocument?: string; sourceSection?: string };
export type ResumeCoachDocumentation = { name: string; category: "project" | "experience"; documents: Array<{ path: string; text: string; contentDigest: string }> };
export type ResumeCoachRequest = { connection: LocalModelConnection; profileRevisionId: string; profileDigest: string; profileSnapshot: string; templateId: string; templateDigest: string; evidence: ResumeCoachEvidence[]; documentation?: ResumeCoachDocumentation[]; opportunity?: ResumeCoachOpportunity; currentResumeSections?: Array<{ heading: string; text: string }>; userRequest: string; consentNonce: string; consentFingerprint: string };
export type ResumeCoachResponse = { schemaVersion: 1; sections: Array<{ heading: string; text: string }>; claims: Array<{ text: string; evidenceIndexes: number[] }>; unknowns: string[]; selectionEcho: string };
export type OpportunityAssessmentRequest = { connection: LocalModelConnection; profileDigest: string; templateDigest: string; profileSummary: string; opportunity: { id: string; contentDigest: string; title: string; company: string; requirements: string[]; copiedDescription: string }; evidence: Array<{ id: string; contentDigest: string; factualText: string }>; consentFingerprint: string };
export type OpportunityAssessmentResponse = { schemaVersion: 1; strengths: Array<{ text: string; evidenceIndexes: number[]; excerpt: { start: number; end: number } }>; gaps: Array<{ text: string; excerpt: { start: number; end: number } }>; unknowns: string[]; selectionEcho: string };
export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;
// Compatibility export: base-resume generation used to be incorrectly named
// "Resume Coach". The active generator now has its own persona and contract.
// Backward-compatible public name for callers that still use this export for
// the base-resume request. The separate review capability below uses its own
// Resume Coach prompt directly.
export const resumeCoachSystemInstruction = resumeGeneratorSystemInstruction;

export function localModelCapabilityVersion(capability: string): string { if (capability === "resume-coach" || capability === "resume-generator") return "resume-coach-v6"; if (capability === "opportunity-assessment") return "opportunity-assessment-v1"; if (capability === "resume-evidence-documenter" || capability === "folder-documenter") return "resume-evidence-documenter-v1"; invalid("That local AI capability is unavailable."); }
const validConnection = (item: LocalModelConnection) => uuid(item.configurationRevisionId) && sha(item.configurationDigest) && plain(item.modelIdentifier, 240);
const publicConnection = (item: LocalModelConnection) => ({ revisionId: item.configurationRevisionId, contentDigest: item.configurationDigest, modelIdentifier: item.modelIdentifier });
export function resumeCoachConsentFingerprint(input: Omit<ResumeCoachRequest, "consentFingerprint">): string { return `sha256:${createHash("sha256").update(JSON.stringify({ capability: localModelCapabilityVersion("resume-coach"), connection: publicConnection(input.connection), profile: { revisionId: input.profileRevisionId, contentDigest: input.profileDigest, snapshot: input.profileSnapshot }, template: { id: input.templateId, contentDigest: input.templateDigest }, evidence: input.evidence.map(({ id, contentDigest, sourceDocument, sourceSection }) => ({ id, contentDigest, sourceDocument, sourceSection })).sort((a, b) => a.id.localeCompare(b.id)), documentation: input.documentation?.map((group) => ({ name: group.name, category: group.category, documents: group.documents.map(({ path, contentDigest }) => ({ path, contentDigest })).sort((a, b) => a.path.localeCompare(b.path)) })).sort((a, b) => `${a.category}/${a.name}`.localeCompare(`${b.category}/${b.name}`)) ?? null, opportunity: input.opportunity ? { revisionId: input.opportunity.revisionId, contentDigest: input.opportunity.contentDigest } : null, currentResumeSections: input.currentResumeSections ?? null, request: input.userRequest, consentNonce: input.consentNonce })).digest("hex")}`; }
export function opportunityAssessmentConsentFingerprint(input: Omit<OpportunityAssessmentRequest, "consentFingerprint">): string { return `sha256:${createHash("sha256").update(JSON.stringify({ capability: localModelCapabilityVersion("opportunity-assessment"), connection: publicConnection(input.connection), profile: input.profileDigest, template: input.templateDigest, opportunity: input.opportunity.contentDigest, evidence: input.evidence.map((item) => item.contentDigest).sort() })).digest("hex")}`; }
function invalid(message: string, next = "Review the selected material and try the local request again."): never { throw new WorkspaceError("RESUME_COACH_INVALID", message, next); }

function validCoach(request: ResumeCoachRequest) {
  const opportunity = request.opportunity; const validOpportunity = !opportunity || (uuid(opportunity.revisionId) && sha(opportunity.contentDigest) && plain(opportunity.title, 300) && plain(opportunity.company, 300) && plain(opportunity.copiedDescription, 20_000) && Array.isArray(opportunity.requirements) && opportunity.requirements.length > 0 && opportunity.requirements.length <= 20 && opportunity.requirements.every((item) => plain(item, 1_000)));
  const documentation = request.documentation ?? [];
  if (!validConnection(request.connection) || !plain(request.userRequest, 2_000) || !plain(request.profileSnapshot, 4_000) || !plain(request.consentNonce, 128) || !uuid(request.profileRevisionId) || !sha(request.profileDigest) || !uuid(request.templateId) || !sha(request.templateDigest) || !sha(request.consentFingerprint) || !request.evidence.length || request.evidence.length > maxResumeCoachEvidence || request.evidence.some((item) => !uuid(item.id) || !plain(item.factualText, 4_000) || !sha(item.contentDigest) || (item.sourceDocument !== undefined && !plain(item.sourceDocument, 600)) || (item.sourceSection !== undefined && !plain(item.sourceSection, 600))) || documentation.length > 24 || documentation.some((group) => !plain(group.name, 240) || (group.category !== "project" && group.category !== "experience") || !group.documents.length || group.documents.length > 24 || group.documents.some((document) => !plain(document.path, 600) || document.path.includes("..") || document.path.includes("\\") || !boundedText(document.text, 12_000) || !sha(document.contentDigest))) || (request.currentResumeSections !== undefined && (!request.currentResumeSections.length || request.currentResumeSections.length > 8 || request.currentResumeSections.some((section) => !plain(section.heading, 120) || !boundedText(section.text, 2_000)))) || !validOpportunity) invalid("The selected local material cannot be sent safely.");
  if (request.consentFingerprint !== resumeCoachConsentFingerprint(request)) invalid("The local-model consent is no longer current.", "Review the disclosure and submit the request again.");
}
function visibleWorkBullets(sections: Array<{ heading: string; text: string }>): string[] {
  return sections.filter((section) => /^(?:experience|employment|work history|projects?)$/i.test(section.heading.trim())).flatMap((section) => section.text.split("\n").map((line) => /^\s*(?:[-*•])\s+(.+?)\s*$/.exec(line)?.[1]).filter((line): line is string => Boolean(line)));
}
const comparableClaim = (value: string) => value.trim().replace(/\s+/g, " ").replace(/[.]+$/, "").toLocaleLowerCase();
function everyVisibleWorkBulletIsClaimed(sections: Array<{ heading: string; text: string }>, claims: Array<{ text: string }>): boolean {
  return visibleWorkBullets(sections).every((bullet) => claims.some((claim) => comparableClaim(claim.text) === comparableClaim(bullet)));
}
function inferVisibleWorkClaims(sections: Array<{ heading: string; text: string }>, evidence: ResumeCoachRequest["evidence"]): Array<{ text: string; evidenceIndexes: number[] }> {
  return visibleWorkBullets(sections).map((text) => ({ text, evidenceIndexes: evidence.flatMap((item, index) => supports(text, [item.factualText]) ? [index] : []).slice(0, 4) }));
}
function coachResponse(value: unknown, evidence: ResumeCoachRequest["evidence"], fingerprint: string): ResumeCoachResponse {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid("The local model returned an unusable response."); const item = value as Record<string, unknown>; const sections = item.sections; const claims = item.claims; const unknowns = item.unknowns;
  // Some LM Studio Qwen builds omit the constant schemaVersion even when the
  // rest of the envelope is complete. Once the exact remaining envelope and
  // every field below validate, normalizing that omitted constant to version 1
  // is safe and prevents a good resume from degrading to the low-level fallback.
  const exactEnvelope = exactKeys(item, ["schemaVersion", "selectionEcho", "sections", "claims", "unknowns"]);
  const omittedVersionEnvelope = item.schemaVersion === undefined && exactKeys(item, ["selectionEcho", "sections", "claims", "unknowns"]);
  if ((!exactEnvelope && !omittedVersionEnvelope) || (item.schemaVersion !== undefined && item.schemaVersion !== 1) || item.selectionEcho !== fingerprint || !Array.isArray(sections) || !sections.length || sections.length > 8 || !Array.isArray(claims) || claims.length > 20 || !Array.isArray(unknowns) || unknowns.length > 12) invalid("The local model returned an unsafe or incomplete response.");
  // A project-only workspace has no employment entry. Accept an intentionally
  // blank Experience section as an omitted section instead of discarding an
  // otherwise useful employer-facing project description.
  const populatedSections = sections.filter((section) => !(section && typeof section === "object" && /^experience$/i.test(String((section as Record<string, unknown>).heading ?? "").trim()) && typeof (section as Record<string, unknown>).text === "string" && !String((section as Record<string, unknown>).text).trim()));
  // Section text is intentionally multiline: the renderer turns its entry
  // title and bullets into the Resume.pdf-derived layout. `plain` rejects
  // newlines, which previously discarded well-formed model resumes and
  // forced the raw-fact fallback instead.
  if (!populatedSections.length || populatedSections.some((section) => !section || typeof section !== "object" || !exactKeys(section as Record<string, unknown>, ["heading", "text"]) || !plain((section as Record<string, unknown>).heading, 120) || !boundedText((section as Record<string, unknown>).text, 2_000)) || claims.some((claim) => !claim || typeof claim !== "object" || !exactKeys(claim as Record<string, unknown>, ["text", "evidenceIndexes"]) || !plain((claim as Record<string, unknown>).text, 1_000) || !Array.isArray((claim as Record<string, unknown>).evidenceIndexes) || !(claim as { evidenceIndexes: unknown[] }).evidenceIndexes.length || new Set((claim as { evidenceIndexes: unknown[] }).evidenceIndexes).size !== (claim as { evidenceIndexes: unknown[] }).evidenceIndexes.length || (claim as { evidenceIndexes: unknown[] }).evidenceIndexes.some((index) => !Number.isInteger(index) || (index as number) < 0 || (index as number) >= evidence.length) || !(claim as { text: string; evidenceIndexes: number[] }).evidenceIndexes.every((index) => supports((claim as { text: string }).text, [evidence[index]!.factualText]))) || unknowns.some((unknown) => !plain(unknown, 500))) invalid("The local model returned unsupported guidance.");
  const inferredClaims = claims.length ? claims as ResumeCoachResponse["claims"] : inferVisibleWorkClaims(populatedSections as ResumeCoachResponse["sections"], evidence);
  const result = { schemaVersion: 1 as const, sections: populatedSections as ResumeCoachResponse["sections"], claims: inferredClaims, unknowns: unknowns as string[], selectionEcho: fingerprint }; if (!inferredClaims.every((claim) => claim.evidenceIndexes.length) || !everyVisibleWorkBulletIsClaimed(result.sections, result.claims)) invalid("The local model returned a work bullet without direct evidence support."); if (JSON.stringify(result).length > maxResponse) invalid("The local model response is too large to review safely."); return result;
}
async function nativeText(connection: LocalModelConnection, systemPrompt: string, input: unknown, maximumTokens: number, fetcher: FetchLike, code: "RESUME_COACH_UNAVAILABLE" | "OPPORTUNITY_ASSESSMENT_UNAVAILABLE" | "EVIDENCE_DOCUMENTER_INVALID", responseLimit = maxResponse): Promise<string> {
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), Math.max(30_000, Math.min(300_000, 30_000 + maximumTokens * 200)));
  try { const body = JSON.stringify({ model: connection.modelIdentifier, input: JSON.stringify(input), system_prompt: systemPrompt, stream: false, store: false, reasoning: "off", temperature: 0.2, max_output_tokens: maximumTokens }); if (body.length > maxRequest) throw new WorkspaceError(code, "The selected local material cannot be sent safely.", "Review the selected local material and try again."); const result = await fetcher(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body, signal: controller.signal }); if (!result.ok || Number(result.headers.get("content-length") ?? 0) > responseLimit * 2) throw new Error("unavailable"); const raw = await result.text(); if (raw.length > responseLimit * 2) throw new WorkspaceError(code, "The local model returned an oversized response.", "Try the local request again after the model is ready."); const parsed = JSON.parse(raw) as { response_id?: unknown; output?: unknown; stats?: { model_load_time_seconds?: unknown } }; if (parsed.response_id !== undefined || parsed.stats?.model_load_time_seconds !== undefined || !Array.isArray(parsed.output)) throw new WorkspaceError(code, "The local model returned an unsafe stateful response.", "Try the local request again after the model is ready."); const output = parsed.output as Array<{ type?: unknown; content?: unknown }>; const messages = output.filter((item) => item && item.type === "message"); if (messages.length !== 1 || output.some((item) => !item || (item.type !== "message" && item.type !== "reasoning"))) throw new WorkspaceError(code, "The local model returned an unusable response.", "Try the local request again after the model is ready."); const message = messages[0]; if (!message || !boundedText(message.content, responseLimit)) throw new WorkspaceError(code, "The local model returned an unusable response.", "Try the local request again after the model is ready."); return String(message.content); } catch (error) { if (error instanceof WorkspaceError) throw error; if (error instanceof SyntaxError) throw new WorkspaceError(code, "LM Studio returned a malformed service response.", "Restart the local server, then try again."); throw new WorkspaceError(code, "Local AI is unavailable right now.", "Confirm LM Studio is running locally with the configured model, then try again."); } finally { clearTimeout(timeout); }
}
async function native(connection: LocalModelConnection, systemPrompt: string, input: unknown, maximumTokens: number, fetcher: FetchLike, code: "RESUME_COACH_UNAVAILABLE" | "OPPORTUNITY_ASSESSMENT_UNAVAILABLE" | "EVIDENCE_DOCUMENTER_INVALID", responseLimit = maxResponse): Promise<unknown> {
  const content = await nativeText(connection, systemPrompt, input, maximumTokens, fetcher, code, responseLimit);
  try { return parseModelJson(content); } catch { throw new WorkspaceError(code, "The local model completed a response, but its JSON envelope was malformed.", "Try again; this request needs JSON matching the required response shape."); }
}
type ResumeProfileSnapshot = { firstName?: unknown; middleName?: unknown; lastName?: unknown; email?: unknown; phone?: unknown; school?: unknown; program?: unknown; graduationYear?: unknown; gwa?: unknown; latinHonors?: unknown; linkedInUrl?: unknown; githubUrl?: unknown };
function profileValue(value: unknown): string | undefined { return typeof value === "string" && plain(value, 240) ? value : undefined; }
function resumeProjectName(sourceDocument?: string): string {
  const match = sourceDocument?.match(/resume-evidence\/(?:projects|experiences)\/([^/]+)\//i);
  return match?.[1]?.replace(/[-_]+/g, " ").trim() || "Documented work";
}
function readableEvidenceFact(factualText: string): string | undefined {
  const text = factualText.trim();
  const sourceLine = text.replace(/^[\s>*-]+/, "").trim();
  if (!text || isBoilerplateEvidence(text)) return undefined;
  // Folder documentation is useful source material, but never resume copy.
  // Keep only candidate-facing prose in the deterministic fallback.
  if (/(?:^|\s)(?:docs|src|tests|node_modules|scripts|config)[\\/]\S+/i.test(sourceLine) || sourceLine.startsWith("id: SPEC-") || sourceLine.endsWith(".md") || /^\**status\s*:/i.test(sourceLine) || /^expected weekly fields|^daily report supplies|^use this template|^these are concise walkthrough docs|^primary code|^story key/i.test(sourceLine)) return undefined;
  if (/^(?:user selects|user clicks|how-it-works docs|files inspected|project classification|source tree|entry point|story key|documentation set)\b/i.test(sourceLine)) return undefined;
  if (/^(?:[\w.-]+[\\/])+[\w.-]+\.[a-z0-9]+$/i.test(sourceLine)) return undefined;
  if (/^(?:name|description|repository shape|workflow version)\s*:/i.test(sourceLine) || /^(?:[A-Z][A-Z0-9_]{2,})\s*(?:\(|=|:)/.test(sourceLine) || /\b(?:GET|POST|PUT|PATCH|DELETE)\s+\/[\w/<>{}:.-]+/i.test(sourceLine)) return undefined;
  if (/^(?:raw |ui calls\b|client calls\b|server renders\b|route handler\b|schema is initialized\b|flask app factory\b|provide a minimal\b|allow canceling\b|upload \(|run the same\b)/i.test(sourceLine)) return undefined;
  if (/^(?:waitress|gunicorn|uvicorn)\b/i.test(sourceLine) || /^(?:create|return)\s+(?:a\s+)?durable\s+run\s+record\b/i.test(sourceLine) || /\b(?:no raw \w+ storage|via a JSON API|for development and runtime instructions)\b/i.test(sourceLine)) return undefined;
  if (/^\*\*(?:backend|frontend):/i.test(text)) return text.replaceAll("**", "");
  if (/^(?:["'][^"']+["']\s*:|[a-z][\w.-]*\s*:\s*(?:SPEC-|<)|insert\s+into\b|logger\s*=|command\s*:|primary\s+code\s*:|story\s+key|expected\s+weekly\s+fields|daily\s+report\s+supplies|use this template|these are concise walkthrough docs|docs\/)/i.test(text) || /\.\.\//.test(text) || /<[^>]+>/.test(text)) return undefined;
  if (/^\*\*(?:period evidenced|documented effort|organization|role):/i.test(text)) return undefined;
  const route = /\b(?:router|app)\.(get|post|put|patch|delete|use)\s*\(\s*["']([^"']+)["']/i.exec(text);
  if (route) return route[1].toUpperCase() === "USE" ? `Configured Express middleware or route mounting for ${route[2]}.` : `Implemented a ${route[1].toUpperCase()} ${route[2]} endpoint.`;
  if (/mongoose\.connect/i.test(text)) return "Connected the application to MongoDB through Mongoose.";
  if (/bcrypt\.(?:hash|compare)/i.test(text)) return "Applied bcrypt password hashing or comparison in the authentication flow.";
  if (/\b(?:existingEmail|findOne\s*\(\s*\{\s*email)/i.test(text)) return "Checked for an existing account email before registration.";
  if (/\b(?:const|let)\s+app\s*=\s*express\s*\(/i.test(text)) return "Initialized an Express application.";
  if (/app\.use\s*\(\s*express\.json\s*\(/i.test(text)) return "Configured JSON request parsing middleware.";
  if (/tokens remain out of the sqlite database/i.test(text)) return "Kept integration tokens out of SQLite and assigned them to the OS credential vault.";
  const model = /(?:new\s+mongoose\.Schema|mongoose\.model\s*\(\s*["']([^"']+))/i.exec(text);
  if (model) return model[1] ? `Defined and registered a Mongoose ${model[1]} data model.` : "Defined a Mongoose data schema.";
  const dependency = /^['"]?([@a-z0-9][@a-z0-9._/-]*)['"]?\s*:\s*["']?([^,'"\s]+|\^[^,'"\s]+)["']?,?$/i.exec(text);
  if (dependency && /^(?:express|mongoose|mongodb|bcrypt|cors|react|react-dom|vite|typescript|flask|waitress|supabase|sendgrid|swagger|bruno|concurrently|docker|sqlite|node)$/i.test(dependency[1])) return `Configured the ${dependency[1]} dependency (${dependency[2]}).`;
  if (/\b(?:npm|yarn|pnpm)\s+(?:run\s+)?(?:dev|start|build|test)\b/i.test(text)) return "Configured project development, build, test, or start workflow scripts.";
  if (/^test\s*\(/i.test(text) || /\b(?:describe|it|expect|assert)\s*\(/i.test(text)) return "Added automated test coverage for a documented workflow.";
  // Raw assignments, imports, links, and object literals are useful source
  // evidence, but they are not readable resume bullets.
  if (/^(?:import|export|const|let|var|function|class)\b/i.test(text) || /=>|[{};]/.test(text) || /https?:\/\//i.test(text) || /\b(?:docs|src|tests|node_modules|scripts|config)\/[\w./-]+/i.test(text)) return undefined;
  const cleaned = text.replace(/^[`*_]+|[`*_]+$/g, "").replace(/\s+/g, " ").trim();
  if (/^[A-Z][a-z]+(?:\s+[A-Z][a-z.]+){1,3}$/.test(cleaned)) return undefined;
  if (cleaned.length < 24 || /^(?:raw|ui|client|server|schema|route|configuration|environment|command)\b/i.test(cleaned)) return undefined;
  return cleaned.length > 500 ? `${cleaned.slice(0, 497).replace(/\s+\S*$/, "")}...` : cleaned;
}
function documentationSummary(documentation: ResumeCoachDocumentation[] | undefined, name: string): string | undefined {
  const group = documentation?.find((item) => item.name === name);
  const source = group?.documents.find((item) => /resume-summary\.md$/i.test(item.path)) ?? group?.documents.find((item) => /(?:project|experience)-overview\.md$/i.test(item.path));
  if (!source) return undefined;
  const paragraphs = source.text
    .replace(/^#.*$/gm, "")
    .replace(/\*\*Explicit unknowns:\*\*[\s\S]*$/i, "")
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/^[\s>*-]+/gm, "").replace(/[`*_]/g, "").replace(/[\uFFFD]|â€“|â€”|â€˜|â€™|â€œ|â€/g, "-").replace(/\s+/g, " ").trim())
    .filter((paragraph) => paragraph.length >= 80 && !/^(?:unknowns|open questions)\b/i.test(paragraph));
  const text = paragraphs[0] ?? "";
  return text.length > 520 ? `${text.slice(0, 517).replace(/\s+\S*$/, "")}...` : text || undefined;
}
function deterministicResumeCoachResponse(request: ResumeCoachRequest): ResumeCoachResponse {
  let profile: ResumeProfileSnapshot = {};
  try { const parsed = JSON.parse(request.profileSnapshot); if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) profile = parsed as ResumeProfileSnapshot; } catch { /* A legacy profile snapshot can still produce a work-focused draft. */ }
  const name = [profileValue(profile.firstName), profileValue(profile.middleName), profileValue(profile.lastName)].filter(Boolean).join(" ");
  const contact = [profileValue(profile.email), profileValue(profile.phone), profileValue(profile.linkedInUrl), profileValue(profile.githubUrl)].filter(Boolean).join(" | ");
  const education = [profileValue(profile.program), profileValue(profile.school), profile.graduationYear !== undefined ? String(profile.graduationYear) : undefined, profileValue(profile.gwa) ? `GWA ${profileValue(profile.gwa)}` : undefined, profileValue(profile.latinHonors)].filter(Boolean).join(" | ");
  const grouped = new Map<string, { category: "project" | "experience"; facts: Array<{ text: string; index: number }> }>();
  request.evidence.forEach((item, index) => {
    const fact = readableEvidenceFact(item.factualText); if (!fact) return;
    const key = resumeProjectName(item.sourceDocument); const category = /resume-evidence\/experiences\//i.test(item.sourceDocument ?? "") ? "experience" : "project";
    const group = grouped.get(key) ?? { category, facts: [] }; if (!group.facts.some((entry) => entry.text === fact) && [...grouped.values()].flatMap((entry) => entry.facts).length < 20) group.facts.push({ text: fact, index }); grouped.set(key, group);
  });
  const entriesFor = (category: "project" | "experience") => [...grouped.entries()].filter(([, group]) => group.category === category).map(([name, group]) => {
    // Overview and summary documents are generator handoffs, not resume
    // content. Rendering either one verbatim is how source-tree and config
    // material leaked into the PDF after a model fallback.
    const facts = group.facts.slice(0, category === "experience" ? 5 : 4).map((fact) => `- ${fact.text}`).join("\n");
    return `${name}${facts ? `\n${facts}` : ""}`;
  });
  const experienceEntries = entriesFor("experience");
  const projectEntries = entriesFor("project");
  const supported = [...grouped.values()].flatMap((group) => group.facts);
  const claims = supported.slice(0, 20).map((item) => ({ text: item.text, evidenceIndexes: [item.index] }));
  const projectText = experienceEntries.join("\n\n");
  const projectsText = projectEntries.join("\n\n");
  const skillCorpus = `${request.evidence.map((item) => item.factualText).join(" ")} ${(request.documentation ?? []).flatMap((group) => group.documents.map((document) => document.text)).join(" ")}`;
  const skillGroups = [
    ["Languages", ["TypeScript", "JavaScript", "Go", "Python", "C"]],
    ["Frameworks", ["React", "React Router", "Node.js", "Express", "Flask", "Vite", "Tailwind CSS"]],
    ["Data & APIs", ["MongoDB", "Mongoose", "SQLite", "Supabase", "REST APIs", "Server-Sent Events", "Swagger"]],
    ["Tools", ["Git", "GitHub", "Docker Compose", "Bruno", "SendGrid", "n8n", "Trello", "ClickUp"]],
  ].map(([label, names]) => `${label}: ${(names as string[]).filter((item) => new RegExp(`\\b${item.replace(/[.+]/g, "\\$&")}\\b`, "i").test(skillCorpus)).join(", ")}`).filter((line) => !line.endsWith(": "));
  const sections = [
    ...(contact ? [{ heading: "Contact", text: `${name}\n${contact}` }] : name ? [{ heading: "Contact", text: name }] : []),
    ...(education ? [{ heading: "Education", text: education }] : []),
    ...(experienceEntries.length ? [{ heading: "Experience", text: projectText.slice(0, 2_000) }] : []),
    ...(projectEntries.length ? [{ heading: "Projects", text: projectsText.slice(0, 2_000) }] : []),
    ...(skillGroups.length ? [{ heading: "Technical Skills", text: skillGroups.join("\n") }] : []),
    ...(request.documentation?.length ? [] : [{ heading: "Selected Experience & Projects", text: claims.map((claim) => `- ${claim.text}`).join("\n") || "No documented work was supplied." }]),
  ];
  return { schemaVersion: 1, selectionEcho: request.consentFingerprint, sections, claims, unknowns: ["Personal ownership, metrics, users, dates, outcomes, deployment status, and skills are included only where directly documented."] };
}
function containsResumeSourceLeak(response: ResumeCoachResponse, request: ResumeCoachRequest): boolean {
  const text = `${response.sections.map((section) => section.text).join("\n")}\n${response.claims.map((claim) => claim.text).join("\n")}`;
  const categories = new Set((request.documentation ?? []).map((group) => group.category));
  const projectEvidence = request.evidence.some((item) => /resume-evidence\/projects\//i.test(item.sourceDocument ?? ""));
  const experienceEvidence = request.evidence.some((item) => /resume-evidence\/experiences\//i.test(item.sourceDocument ?? ""));
  const headings = response.sections.map((section) => section.heading.trim());
  // Keep the same clear hierarchy as the reference resume: projects and
  // employment work are separate sections, never a blended project summary.
  const hasProjectSection = headings.some((heading) => /^projects?$/i.test(heading));
  const hasExperienceSection = headings.some((heading) => /^(?:experience|employment|work history)$/i.test(heading));
  const missingProjectSection = (categories.has("project") || projectEvidence) && !hasProjectSection;
  const missingExperienceSection = (categories.has("experience") || experienceEvidence) && !hasExperienceSection;
  return missingProjectSection || missingExperienceSection || containsUnsafeResumeContent(text) || /(?:^|\n)\s*(?:[-•]\s*)?(?:SP[A-Z0-9_]*|[A-Z][A-Z0-9_]*_[A-Z0-9_]+)\s*(?:\(|=|:)|(?:^|\n)[^\n]*(?:for development and runtime instructions|see (?:the )?(?:code\/)?setup\.md|no raw [a-z ]+ storage|return it via a JSON API|create a durable run record)\b/im.test(text);
}
export async function requestBaseResumeGeneration(request: ResumeCoachRequest, fetcher: FetchLike = fetch): Promise<ResumeCoachResponse> {
  validCoach(request);
  // Every current documented finding remains attached to the resulting draft.
  // A very large collection must not be sent to the loopback model, however:
  // use the same provenance-linked local composer rather than silently dropping
  // findings or surfacing a generic model-input error.
  if (JSON.stringify(request).length > maxRequest) return deterministicResumeCoachResponse(request);
  try {
    const modelEvidence = resumeRelevantModelEvidence(request.evidence);
    if (!modelEvidence.length) return deterministicResumeCoachResponse(request);
    const packetEvidence = modelEvidence.map(({ index, factualText, contentDigest }) => ({ evidenceIndex: index, factualText, contentDigest }));
    const packetDocumentation = resumeGenerationDocumentation(request.documentation);
    const projectIdentities = (request.documentation ?? []).filter((group) => group.category === "project").map((group) => group.name);
    const generated = await native(request.connection, `${resumeGeneratorSystemInstruction} ${resumeGeneratorEditorialInstruction} ${resumeGeneratorEvidenceIntelligenceInstruction} ${resumeGeneratorProjectIdentityInstruction} ${resumeGeneratorEvidenceCitationInstruction}`, { schemaVersion: 1, selectionEcho: request.consentFingerprint, profile: request.profileSnapshot, templateDigest: request.templateDigest, projectIdentities, documentation: packetDocumentation, evidence: packetEvidence, opportunity: request.opportunity ? { title: request.opportunity.title, company: request.opportunity.company, requirements: request.opportunity.requirements, copiedDescription: request.opportunity.copiedDescription, contentDigest: request.opportunity.contentDigest } : null, request: request.userRequest, responseShape: { schemaVersion: 1, sections: [{ heading: "string", text: "string" }], claims: [{ text: "string", evidenceIndexes: [0] }], unknowns: ["string"], selectionEcho: request.consentFingerprint } }, 1_400, fetcher, "RESUME_COACH_UNAVAILABLE");
    const response = coachResponse(normalizeGeneratedResume(restoreOriginalEvidenceIndexes(generated, modelEvidence, request.evidence), projectIdentities), request.evidence, request.consentFingerprint);
    return containsResumeSourceLeak(response, request) ? deterministicResumeCoachResponse(request) : response;
  } catch (error) {
    if (error instanceof WorkspaceError && (error.code === "RESUME_COACH_UNAVAILABLE" || error.code === "RESUME_COACH_INVALID")) return deterministicResumeCoachResponse(request);
    throw error;
  }
}
// Existing callers and persisted tests can migrate gradually. This is a base
// resume generator alias, not the interactive Resume Coach.
export const requestResumeCoach = requestBaseResumeGeneration;

export type ResumeCoachReviewResponse = { schemaVersion: 1; ratings: Array<{ area: "clarity" | "relevance" | "credibility" | "specificity" | "atsReadability"; score: number; rationale: string }>; strengths: string[]; concerns: string[]; recommendations: string[]; selectionEcho: string };
function coachReviewResponse(value: unknown, request: ResumeCoachRequest): ResumeCoachReviewResponse {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid("The Resume Coach returned an unusable response.");
  const item = value as Record<string, unknown>; const ratings = item.ratings; const strengths = item.strengths; const concerns = item.concerns; const recommendations = item.recommendations;
  const allowedAreas = new Set(["clarity", "relevance", "credibility", "specificity", "atsReadability"]);
  if (!exactKeys(item, ["schemaVersion", "selectionEcho", "ratings", "strengths", "concerns", "recommendations"]) || item.schemaVersion !== 1 || item.selectionEcho !== request.consentFingerprint || !Array.isArray(ratings) || ratings.length !== 5 || new Set(ratings.map((entry) => String((entry as { area?: unknown }).area))).size !== 5 || ratings.some((entry) => !entry || typeof entry !== "object" || !allowedAreas.has(String((entry as { area?: unknown }).area)) || !Number.isInteger((entry as { score?: unknown }).score) || (entry as { score: number }).score < 1 || (entry as { score: number }).score > 5 || !plain((entry as { rationale?: unknown }).rationale, 600)) || !Array.isArray(strengths) || strengths.length > 8 || !Array.isArray(concerns) || concerns.length > 8 || !Array.isArray(recommendations) || recommendations.length > 8 || [...strengths, ...concerns, ...recommendations].some((entry) => !plain(entry, 700))) invalid("The Resume Coach returned malformed or ambiguous feedback.");
  return { schemaVersion: 1, ratings: ratings as ResumeCoachReviewResponse["ratings"], strengths: strengths as string[], concerns: concerns as string[], recommendations: recommendations as string[], selectionEcho: request.consentFingerprint };
}
export async function requestResumeCoachReview(request: ResumeCoachRequest, fetcher: FetchLike = fetch): Promise<ResumeCoachReviewResponse> {
  validCoach(request);
  const input = { schemaVersion: 1, selectionEcho: request.consentFingerprint, focus: request.userRequest, currentResumeSections: request.currentResumeSections ?? [], profile: request.profileSnapshot, documentation: request.documentation ?? [], evidence: resumeRelevantModelEvidence(request.evidence), responseShape: { schemaVersion: 1, ratings: [{ area: "clarity", score: 1, rationale: "string" }, { area: "relevance", score: 1, rationale: "string" }, { area: "credibility", score: 1, rationale: "string" }, { area: "specificity", score: 1, rationale: "string" }, { area: "atsReadability", score: 1, rationale: "string" }], strengths: ["string"], concerns: ["string"], recommendations: ["string"], selectionEcho: request.consentFingerprint } };
  if (JSON.stringify(input).length > maxRequest) return { schemaVersion: 1, selectionEcho: request.consentFingerprint, ratings: ["clarity", "relevance", "credibility", "specificity", "atsReadability"].map((area) => ({ area: area as ResumeCoachReviewResponse["ratings"][number]["area"], score: 3, rationale: "The bounded local review packet is too large for a model call; review the saved evidence in smaller workspace groups." })), strengths: [], concerns: ["The documented work is too large for one local-model review packet."], recommendations: ["Review one project or experience collection at a time before requesting another coach review."] };
  return coachReviewResponse(await native(request.connection, resumeCoachReviewSystemInstruction, input, 1_200, fetcher, "RESUME_COACH_UNAVAILABLE"), request);
}

export type ResumeEvidenceSourceFile = { path: string; text: string; contentDigest: string };
export type ResumeEvidenceDocumenterRequest = { connection: LocalModelConnection; category: "project" | "experience"; sourceDigest: string; files: ResumeEvidenceSourceFile[]; consentFingerprint: string };
export type ResumeEvidenceDocumenterResponse = { schemaVersion: 1; selectionEcho: string; artifacts: { "project-overview.md": string; "resume-evidence.md": string; "resume-bullet-candidates.md": string; "resume-summary.md": string } };
const documenterSystemInstruction = "The specific Folder Documenter procedure is supplied for the selected category.";
function documenterInvalid(message: string, next = "Review the selected folder and try the local documentation action again."): never { throw new WorkspaceError("EVIDENCE_DOCUMENTER_INVALID", message, next); }
function documenterFingerprint(request: Omit<ResumeEvidenceDocumenterRequest, "consentFingerprint">): string { return `sha256:${createHash("sha256").update(JSON.stringify({ capability: localModelCapabilityVersion("resume-evidence-documenter"), connection: publicConnection(request.connection), category: request.category, sourceDigest: request.sourceDigest, files: request.files.map(({ path, contentDigest }) => ({ path, contentDigest })).sort((a, b) => a.path.localeCompare(b.path)) })).digest("hex")}`; }
export const resumeEvidenceDocumenterConsentFingerprint = documenterFingerprint;
function validateDocumenterRequest(request: ResumeEvidenceDocumenterRequest): void { if (!validConnection(request.connection) || !sha(request.sourceDigest) || !sha(request.consentFingerprint) || (request.category !== "project" && request.category !== "experience") || !request.files.length || request.files.length > 200 || request.files.some((file) => !plain(file.path, 500) || file.path.includes("\\") || file.path.includes("..") || /^(?:[a-z]:|\/|\\\\|[a-z][a-z0-9+.-]*:)/i.test(file.path) || !boundedText(file.text, 8_000) || !sha(file.contentDigest)) || JSON.stringify(request).length > 56_000 || request.consentFingerprint !== documenterFingerprint(request)) documenterInvalid("The selected folder cannot be sent safely."); }
 const containsAbsolutePath = (value: string) => /(?:\b[a-z]:[\\/]|\\\\|\bfile:(?:\/\/+|\/?[a-z]:)|(?:^|[\s[(])\/(?:Users?|home|var|tmp|etc|opt|mnt|private|root)(?:\/|\b))/im.test(value);
function validateDocumenterResponse(value: unknown, request: ResumeEvidenceDocumenterRequest): ResumeEvidenceDocumenterResponse { if (!value || typeof value !== "object" || Array.isArray(value)) documenterInvalid("The local documentation skill returned an unusable result."); const item = value as Record<string, unknown>; const artifacts = item.artifacts; if (item.schemaVersion !== 1 || item.selectionEcho !== request.consentFingerprint || !artifacts || typeof artifacts !== "object" || Array.isArray(artifacts) || !exactKeys(artifacts as Record<string, unknown>, ["project-overview.md", "resume-evidence.md", "resume-bullet-candidates.md", "resume-summary.md"])) documenterInvalid("The local documentation skill returned an incomplete result."); const output = artifacts as Record<string, unknown>; if (Object.values(output).some((text) => !boundedText(text, 48_000) || !/Proposed \/ Unreviewed/i.test(text as string) || containsAbsolutePath(text as string))) documenterInvalid("The local documentation skill returned unsafe review artifacts."); return { schemaVersion: 1, selectionEcho: request.consentFingerprint, artifacts: output as ResumeEvidenceDocumenterResponse["artifacts"] }; }
const artifactInstructions: Record<keyof ResumeEvidenceDocumenterResponse["artifacts"], string> = {
  "project-overview.md": "Write the requested category overview only. Do not create, summarize, or mention any other artifact.",
  "resume-evidence.md": "Write only resume-evidence.md. Begin exactly with '# Resume Evidence (Proposed / Unreviewed)'. For each supported fact use exactly: '### E-001', '- Fact: <verbatim or direct source fact>', '- Provenance: <relative source path>, <nearest heading>, line <one-based number>', '- Explicit unknowns: <unknowns>', '- Status: Proposed / unreviewed'. Use consecutive E identifiers. If there are no supported facts, write only '- No supported evidence items found.' after the heading. Do not create, summarize, or mention any other artifact.",
  "resume-bullet-candidates.md": "Write only resume-bullet-candidates.md. Begin exactly with '# Resume Bullet Candidates (Proposed / Unreviewed)'. Immediately add a '## Resume Context' section with concise research notes headed Purpose, User or workflow, Design rationale, Directly stated outcome, and Explicit gaps. Synthesize those notes from the supplied factual handoff and provenance-backed evidence; keep technical mechanisms subordinate to why they matter. State 'Not directly evidenced' rather than inventing purpose, users, rationale, or outcomes. This context is research for a later resume writer, never a candidate claim: do not include source paths, filenames, configuration values, commands, routes, API syntax, or setup instructions. Then add '## Candidate Bullets'. Do not impose an arbitrary candidate count; include every distinct, directly supported candidate that materially helps describe the project. For every candidate use exactly: '### B-001', '- Candidate: <conservative candidate>', '- Supporting evidence: E-001', '- Explicit unknowns: <unknowns>', '- Status: Proposed / unreviewed; not claim-eligible'. Use consecutive B identifiers and only E identifiers in the supplied resume-evidence.md. If no candidates are supported, write only '- No supported bullet candidates found.' after the Candidate Bullets heading. Do not create, summarize, or mention any other artifact.",
  "resume-summary.md": "Write the requested category resume handoff only. Do not create, summarize, or mention any other artifact."
};
const artifactMaximumTokens: Record<keyof ResumeEvidenceDocumenterResponse["artifacts"], number> = { "project-overview.md": 1_800, "resume-evidence.md": 0, "resume-bullet-candidates.md": 3_000, "resume-summary.md": 3_000 };
function sourceHeading(value: string): string { return value.replace(/[\u0000-\u001f]/g, " ").replace(/\.\./g, "…").replace(/\s+/g, " ").trim().slice(0, 300) || "document"; }
function sourcePriority(path: string): number {
  const normalized = path.toLowerCase();
  if (/^(readme|overview|architecture|design|requirements?|documentation)\.(md|txt)$/.test(normalized)) return 0;
  if (/(^|\/)(package|composer|pyproject|cargo)\.(json|toml)$/.test(normalized)) return 1;
  if (/(^|\/)(src|server|api|routes?|controllers?|models?|services?|components?)\//.test(normalized)) return 2;
  if (/(^|\/)(docs?|documentation)\//.test(normalized)) return 3;
  if (/(^|\/)(tests?|__tests__)\//.test(normalized)) return 4;
  if (/(^|\/)(eslint|vite|webpack|babel|tsconfig|prettier)\b/.test(normalized)) return 9;
  return 4;
}
function isBoilerplateEvidence(text: string): boolean {
  return /^(?:import\s|export\s*\{|import\s+type\b|["'](?:react|react-dom|vite|@vitejs|eslint|globals|swc|babel)|const \[count, setCount\]|this template provides|currently, two official plugins|.*fast refresh|.*minimal setup|.*eslint rules|.*vite preview|.*vite build|.*react logo|.*standard vite example|.*bootstrapped with vite)/i.test(text);
}
function isSourceFact(text: string, path: string): boolean {
  if (containsAbsolutePath(text)) return false;
  if (isBoilerplateEvidence(text)) return false;
  // A bounded source scan may see README setup notes and environment defaults.
  // They are useful to the technical documentation set, never resume evidence.
  if (/^`?[A-Z][A-Z0-9_]*_[A-Z0-9_]+`?\s*(?:\(|=|:)/.test(text) || /\b(?:for development and runtime instructions|see (?:the )?(?:code\/)?setup\.md|default host|default port)\b/i.test(text)) return false;
  if (/^\[?\d+\s*,\s*(?:AY|academic year)\b/i.test(text) || /\benrolled\s+(?:in\s+)?[A-Z]{2,}\s*\d{2,}/i.test(text)) return false;
  if (/(?:^|\/)package\.json$/i.test(path)) return /"(?:name|private|type)"\s*:|"(?:dev|start|build|test|lint|preview)"\s*:|"(?:express|mongoose|mongodb|bcrypt|jsonwebtoken|cors|react|next|vite|prisma|sequelize|typeorm)"\s*:/.test(text);
  if (/\.(?:js|jsx|ts|tsx)$/i.test(path)) return /\b(?:app|router)\.(?:get|post|put|patch|delete|use)\b|\b(?:mongoose\.(?:model|connect)|bcrypt\.(?:hash|compare)|jwt\.(?:sign|verify)|express\(|createSchema|new Schema|Schema\(|async function|function [A-Z]|fetch\(|axios\.|use(?:State|Effect|Context)\(|createContext\(|describe\(|it\(|test\(|expect\()|\b(?:module\.)?exports\b|\bclass\s+[A-Z]|\b(?:User|Product|Order)\.(?:find|findOne|create|save)\b/.test(text);
  if (/\.(?:py|go|rs|java|kt|cs|rb|php|sql)$/i.test(path)) return /\b(?:route|router|app|api|model|schema|migration|create table|select |insert |update |delete |test|describe|assert|auth|login|register|password|token)\b/i.test(text);
  if (/\.(?:ya?ml|toml|ini|cfg|xml|sh|ps1)$/i.test(path)) return /\b(?:services?:|image:|command:|depends_on:|workflow|jobs:|steps:|test|build|deploy|docker|node|python)\b/i.test(text);
  return true;
}
function anchoredEvidenceArtifact(request: ResumeEvidenceDocumenterRequest): string {
  const entries: Array<{ fact: string; path: string; heading: string; line: number }> = [];
  for (const file of [...request.files].sort((left, right) => sourcePriority(left.path) - sourcePriority(right.path) || left.path.localeCompare(right.path))) {
    let heading = "document"; let fence: { marker: string; length: number } | undefined; let taken = 0; const fileLimit = sourcePriority(file.path) <= 2 ? 8 : 5;
    for (const [index, raw] of file.text.split(/\r?\n/).entries()) {
      const text = raw.trim(); const fenceMatch = /^(`{3,}|~{3,})(.*)$/.exec(text);
      if (fence) { if (fenceMatch && fenceMatch[1][0] === fence.marker && fenceMatch[1].length >= fence.length && !fenceMatch[2].trim()) fence = undefined; continue; }
      if (fenceMatch) { fence = { marker: fenceMatch[1][0], length: fenceMatch[1].length }; continue; }
      const headingMatch = /^(#{1,6})\s+(.+)$/.exec(text); if (headingMatch) { heading = sourceHeading(headingMatch[2]); continue; }
      const fact = text.replace(/^[-*+]\s+/, "").replace(/^\d+[.)]\s+/, "").trim();
      if (!fact || fact.length < 20 || fact.length > 1_000 || fact.startsWith("|") || /^[-:| ]+$/.test(fact) || !/[a-z]{3}/i.test(fact) || !isSourceFact(fact, file.path)) continue;
      entries.push({ fact, path: file.path, heading, line: index + 1 }); taken += 1;
      if (taken >= fileLimit || entries.length >= 60) break;
    }
    if (entries.length >= 60) break;
  }
  if (!entries.length) return "# Resume Evidence (Proposed / Unreviewed)\n\n- No supported evidence items found.";
  return `# Resume Evidence (Proposed / Unreviewed)\n\n${entries.map((entry, index) => `### E-${String(index + 1).padStart(3, "0")}\n- Fact: ${entry.fact}\n- Provenance: ${entry.path}, ${entry.heading}, line ${entry.line}\n- Explicit unknowns: Ownership, metrics, users, dates, and outcomes are not established by this source line.\n- Status: Proposed / unreviewed`).join("\n\n")}`;
}
function fallbackProjectOverviewArtifact(request: ResumeEvidenceDocumenterRequest): string {
  const facts = [...anchoredEvidenceArtifact(request).matchAll(/^- Fact:\s*(.+)$/gm)].map((match) => match[1]).slice(0, 5);
  const overview = request.category === "experience" ? "Experience" : "Project";
  return `# ${overview} Overview (Proposed / Unreviewed)\n\n## Directly supported implementation facts\n\n${facts.length ? facts.map((fact) => `- ${fact}`).join("\n") : "- No supported implementation facts were found in the bounded scan."}\n\n## Explicit unknowns\n\n- Ownership, metrics, users, dates, deployment status, outcomes, and skills are not established by the selected source.`;
}
function fallbackBulletCandidatesArtifact(): string {
  return "# Resume Bullet Candidates (Proposed / Unreviewed)\n\n- No supported bullet candidates found.";
}
function anchoredBulletCandidatesArtifact(request: ResumeEvidenceDocumenterRequest): string {
  const entries = [...anchoredEvidenceArtifact(request).matchAll(/^### (E-\d{3})\n- Fact:\s*(.+)$/gm)];
  if (!entries.length) return fallbackBulletCandidatesArtifact();
  return `# Resume Bullet Candidates (Proposed / Unreviewed)\n\n${entries.map((entry, index) => `### B-${String(index + 1).padStart(3, "0")}\n- Candidate: ${entry[2]}\n- Supporting evidence: ${entry[1]}\n- Explicit unknowns: Ownership, metrics, users, dates, deployment status, outcomes, and skills are not established by this source line.\n- Status: Proposed / unreviewed; not claim-eligible`).join("\n\n")}`;
}
function fallbackResumeSummaryArtifact(request: ResumeEvidenceDocumenterRequest): string {
  const facts = [...anchoredEvidenceArtifact(request).matchAll(/^- Fact:\s*(.+)$/gm)].map((match) => match[1]);
  return `# Resume Summary (Proposed / Unreviewed)\n\n${facts.length ? facts.map((fact) => `- ${fact}`).join("\n") : "- No supported project description was found in the bounded scan."}\n\n## Explicit unknowns\n\n- Personal ownership, metrics, users, dates, deployment status, outcomes, and skills are not established by the selected source.`;
}
function bmadProjectScanContext(files: ResumeEvidenceDocumenterRequest["files"]): Record<string, unknown> {
  const grouped = { manifests: [] as string[], documentation: [] as string[], entryPoints: [] as string[], apiAndServices: [] as string[], dataModels: [] as string[], clientAndUi: [] as string[], operations: [] as string[], tests: [] as string[] };
  for (const { path } of files) {
    const normalized = path.toLowerCase();
    if (/(?:^|\/)(?:package\.json|pyproject\.toml|cargo\.toml|composer\.json|go\.mod|pom\.xml|requirements(?:\.txt)?|dockerfile|docker-compose(?:\.ya?ml)?)$/.test(normalized)) grouped.manifests.push(path);
    if (/(?:^|\/)(?:readme|overview|architecture|design|requirements?|documentation)\.(?:md|txt)$|(?:^|\/)(?:docs?|documentation)\//.test(normalized)) grouped.documentation.push(path);
    if (/(?:^|\/)(?:main|index|app|server|application)\.(?:[cm]?[jt]sx?|py|go|rs|java|kt|cs|rb|php)$/.test(normalized)) grouped.entryPoints.push(path);
    if (/(?:^|\/)(?:routes?|controllers?|handlers?|api|services?)(?:\/|\.)/.test(normalized)) grouped.apiAndServices.push(path);
    if (/(?:^|\/)(?:models?|schemas?|entities|migrations?|prisma|database|db)(?:\/|\.)/.test(normalized)) grouped.dataModels.push(path);
    if (/(?:^|\/)(?:components?|pages?|views?|client|frontend|ui)(?:\/|\.)/.test(normalized)) grouped.clientAndUi.push(path);
    if (/(?:^|\/)(?:\.github\/workflows|scripts?|infra|terraform|k8s|helm)(?:\/|\.)/.test(normalized) || /(?:^|\/)(?:dockerfile|docker-compose(?:\.ya?ml)?)$/.test(normalized)) grouped.operations.push(path);
    if (/(?:^|\/)(?:tests?|__tests__|spec)(?:\/|\.)/.test(normalized)) grouped.tests.push(path);
  }
  const trim = (items: string[]) => items.sort((left, right) => left.localeCompare(right)).slice(0, 20);
  const parts = new Set(files.map(({ path }) => path.split("/")[0]).filter((part) => /^(?:client|frontend|web|server|backend|api|app|mobile)$/i.test(part)));
  return { scanLevel: "bounded-deep", repositoryShape: parts.size >= 2 ? "multi-part candidate" : "single-part candidate", categories: Object.fromEntries(Object.entries(grouped).map(([name, paths]) => [name, trim(paths)])), filesInspected: files.length };
}
function directMarkdownArtifact(content: string, name: keyof ResumeEvidenceDocumenterResponse["artifacts"]): string {
  const expectedHeading: Record<keyof ResumeEvidenceDocumenterResponse["artifacts"], string> = { "project-overview.md": "# Project Overview (Proposed / Unreviewed)", "resume-evidence.md": "# Resume Evidence (Proposed / Unreviewed)", "resume-bullet-candidates.md": "# Resume Bullet Candidates (Proposed / Unreviewed)", "resume-summary.md": "# Resume Summary (Proposed / Unreviewed)" };
  const trimmed = content.trim(); const fenced = /^```(?:(?:markdown|md)\s*\n|\s*\n)([\s\S]*?)\s*```$/i.exec(trimmed); const candidate = (fenced?.[1] ?? trimmed).trim();
  try { const parsed = parseModelJson(candidate); if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && exactKeys(parsed as Record<string, unknown>, ["artifact"]) && boundedText((parsed as Record<string, unknown>).artifact, 48_000)) return directMarkdownArtifact(String((parsed as Record<string, unknown>).artifact), name); } catch { /* Direct Markdown is intentionally allowed for this artifact-only endpoint. */ }
  const expected = name === "project-overview.md" ? /# (?:Project|Experience) Overview \(Proposed \/ Unreviewed\)/.test(candidate) : candidate.startsWith(expectedHeading[name]);
  if (!boundedText(candidate, 48_000) || !expected) documenterInvalid("The local documentation skill returned an incomplete result.");
  return candidate;
}
async function documentArtifact(request: ResumeEvidenceDocumenterRequest, name: keyof ResumeEvidenceDocumenterResponse["artifacts"], fetcher: FetchLike, curatedHandoff?: { evidence: string; summary: string }): Promise<string> {
  const fallback = () => name === "project-overview.md" ? fallbackProjectOverviewArtifact(request) : name === "resume-summary.md" ? fallbackResumeSummaryArtifact(request) : fallbackBulletCandidatesArtifact();
  try {
    const categorySpecific = name === "project-overview.md" || name === "resume-summary.md" ? folderDocumenterArtifactInstruction(request.category, name) : artifactInstructions[name];
    const input = curatedHandoff
      ? { category: request.category, sourceDigest: request.sourceDigest, resumeEvidence: curatedHandoff.evidence, resumeSummary: curatedHandoff.summary }
      : { category: request.category, sourceDigest: request.sourceDigest, projectScan: bmadProjectScanContext(request.files), files: request.files.map(({ path, text }) => ({ path, text })) };
    const content = await nativeText(request.connection, `${folderDocumenterSystemInstruction(request.category)} ${documenterSystemInstruction} ${categorySpecific} Return only the requested Markdown artifact: no JSON envelope, no code fence, and no explanation before or after it.`, input, artifactMaximumTokens[name], fetcher, "EVIDENCE_DOCUMENTER_INVALID", 50_000);
    const artifact = directMarkdownArtifact(content, name);
    return containsAbsolutePath(artifact) ? fallback() : artifact;
  } catch (error) {
    if (error instanceof WorkspaceError && error.code === "EVIDENCE_DOCUMENTER_INVALID") return fallback();
    throw error;
  }
}
export async function requestResumeEvidenceDocumentation(request: ResumeEvidenceDocumenterRequest, fetcher: FetchLike = fetch): Promise<ResumeEvidenceDocumenterResponse> {
  validateDocumenterRequest(request);
  const evidence = anchoredEvidenceArtifact(request);
  const summary = await documentArtifact(request, "resume-summary.md", fetcher);
  const artifacts = { "project-overview.md": await documentArtifact(request, "project-overview.md", fetcher), "resume-evidence.md": evidence, "resume-bullet-candidates.md": await documentArtifact(request, "resume-bullet-candidates.md", fetcher, { evidence, summary }), "resume-summary.md": summary };
  return validateDocumenterResponse({ schemaVersion: 1, selectionEcho: request.consentFingerprint, artifacts }, request);
}
export function buildResumeDocumentationSet(request: ResumeEvidenceDocumenterRequest): Record<string, string> {
  const paths = [...request.files].map((file) => file.path).sort((left, right) => left.localeCompare(right));
  const by = (pattern: RegExp) => request.files.filter((file) => pattern.test(file.path));
  const sourceMap = (files: ResumeEvidenceSourceFile[], maximum = 36) => files.flatMap((file) => file.text.split(/\r?\n/).map((raw, index) => ({ text: raw.trim(), line: index + 1, path: file.path })).filter((item) => item.text.length >= 20 && item.text.length <= 800 && isSourceFact(item.text, item.path)).slice(0, 5)).slice(0, maximum).map((item) => `- ${item.text}\n  - Source: \`${item.path}\`, document, line ${item.line}`).join("\n");
  const list = (items: string[]) => items.length ? items.map((path) => `- \`${path}\``).join("\n") : "- No matching files were found in the bounded scan.";
  const api = by(/(?:^|\/)(?:routes?|controllers?|handlers?|api|services?)(?:\/|\.)/i);
  const data = by(/(?:^|\/)(?:models?|schemas?|entities|migrations?|prisma|database|db)(?:\/|\.)/i);
  const ui = by(/(?:^|\/)(?:components?|pages?|views?|client|frontend|ui)(?:\/|\.)/i);
  const operations = by(/(?:^|\/)(?:\.github\/workflows|scripts?|infra|terraform|k8s|helm)(?:\/|\.)/i).concat(by(/(?:^|\/)(?:dockerfile|docker-compose(?:\.ya?ml)?)$/i));
  const entry = by(/(?:^|\/)(?:main|index|app|server|application)\.(?:[cm]?[jt]sx?|py|go|rs|java|kt|cs|rb|php)$/i);
  const manifests = by(/(?:^|\/)(?:package\.json|pyproject\.toml|cargo\.toml|composer\.json|go\.mod|pom\.xml|requirements(?:\.txt)?|dockerfile|docker-compose(?:\.ya?ml)?)$/i);
  const documentation = by(/(?:^|\/)(?:readme|overview|architecture|design|requirements?|documentation|contributing|deployment)\.(?:md|txt)$/i).concat(by(/(?:^|\/)(?:docs?|documentation)\//i));
  const tests = by(/(?:^|\/)(?:tests?|__tests__|spec)(?:\/|\.)/i);
  const contribution = by(/(?:^|\/)(?:contributing|code_of_conduct)\.(?:md|txt)$/i);
  const topLevelParts = [...new Set(paths.map((path) => path.split("/")[0]).filter((part) => /^(?:client|frontend|web|server|backend|api|app|mobile)$/i.test(part)))].sort((left, right) => left.localeCompare(right));
  const multiPart = topLevelParts.length >= 2;
  const projectScan = bmadProjectScanContext(request.files);
  const technologyCategory = (name: string, development = false) => {
    if (development) return "Development tooling";
    if (/(?:flask|django|fastapi|express|nestjs|react|next|vue|nuxt|angular|svelte|spring|rails|laravel)/i.test(name)) return "Framework";
    if (/(?:postgres|mysql|mariadb|mongo|mongoose|sqlite|prisma|sequelize|typeorm|redis)/i.test(name)) return "Data store or data tooling";
    if (/(?:docker|kubernetes|terraform|helm)/i.test(name)) return "Operational tooling";
    if (/(?:pytest|jest|vitest|playwright|cypress)/i.test(name)) return "Test tooling";
    return "Application dependency";
  };
  const stackFacts = (() => {
    const facts: Array<{ category: string; detail: string; path: string; line: number }> = [];
    const push = (category: string, detail: string, path: string, line: number) => { if (detail && !containsAbsolutePath(detail) && facts.length < 40) facts.push({ category, detail: detail.replaceAll("|", "\\|"), path, line }); };
    for (const file of manifests) {
      const normalized = file.path.toLowerCase(); let packageSection: "dependencies" | "devDependencies" | "" = "";
      for (const [index, raw] of file.text.split(/\r?\n/).entries()) {
        const text = raw.trim(); const line = index + 1;
        if (!text || text.startsWith("#") || text.startsWith("//")) continue;
        if (/requirements(?:\.txt)?$/i.test(normalized) && /^[a-z][a-z0-9_.-]*(?:\[[^\]]+\])?(?:[<>=!~].*)?$/i.test(text)) { push(technologyCategory(text), text, file.path, line); continue; }
        if (/package\.json$/i.test(normalized)) {
          const section = /^"(dependencies|devDependencies)"\s*:\s*\{/.exec(text); if (section) { packageSection = section[1] as "dependencies" | "devDependencies"; continue; }
          if (packageSection && /^},?$/.test(text)) { packageSection = ""; continue; }
          const dependency = /^"([^"\s]+)"\s*:\s*"([^"\s]+)"[,]?$/.exec(text); if (packageSection && dependency) push(technologyCategory(dependency[1], packageSection === "devDependencies"), `\`${dependency[1]}\` ${dependency[2]}`, file.path, line);
          continue;
        }
        if (/dockerfile$/i.test(normalized) && /^FROM\s+.+/i.test(text)) { push("Container runtime image", text, file.path, line); continue; }
        if (/docker-compose(?:\.ya?ml)?$/i.test(normalized) && /^(?:image|build):\s*.+/i.test(text)) { push("Container orchestration", text, file.path, line); continue; }
        if (/pyproject\.toml$/i.test(normalized) && /^(?:requires-python|python)\s*=\s*.+/i.test(text)) { push("Language runtime", text, file.path, line); continue; }
        if (/go\.mod$/i.test(normalized) && /^go\s+\d/.test(text)) { push("Language runtime", text, file.path, line); continue; }
        if (/cargo\.toml$/i.test(normalized) && /^(?:edition|rust-version)\s*=\s*.+/i.test(text)) { push("Language runtime", text, file.path, line); }
      }
    }
    return facts;
  })();
  const stackTable = stackFacts.length ? `| Category | Directly supported detail | Source |\n| --- | --- | --- |\n${stackFacts.map((fact) => `| ${fact.category} | ${fact.detail} | \`${fact.path}\`, line ${fact.line} |`).join("\n")}` : "No framework, dependency, runtime, or tooling entries were directly identified in the inspected manifest lines.";
  const heading = (title: string) => `# ${title}\n\n> Generated from a bounded, read-only local project scan. Paths are relative to the selected folder.\n`;
  const documents: Record<string, string> = {
    "source-tree-analysis.md": `${heading("Source Tree Analysis")}## Inspected paths\n\n${list(paths)}\n\n## Critical areas\n\n${list([...entry, ...api, ...data, ...ui, ...operations, ...tests].map((file) => file.path))}\n\n## Entry points\n\n${list(entry.map((file) => file.path))}`,
    "technology-stack.md": `${heading("Technology Stack")}## Manifests and configuration\n\n${list(manifests.map((file) => file.path))}\n\n## Technology inventory\n\n${stackTable}\n\n## Classification notes\n\n- Runtime commands, service commands, and deployment steps are intentionally documented in \`development-guide.md\` or \`deployment-guide.md\`, not treated as stack entries.\n- This inventory lists only directly supported manifest or container-runtime details; it does not infer deployed services, ownership, scale, or outcomes.`,
    "architecture.md": `${heading("Architecture")}## Project shape\n\n- ${String(projectScan.repositoryShape)}\n\n## Existing documentation\n\n${list(documentation.map((file) => file.path))}\n\n## Entry points\n\n${list(entry.map((file) => file.path))}\n\n## Architecture evidence\n\n${sourceMap([...entry, ...api, ...data, ...ui], 45) || "- No supported architecture facts were found."}\n\n## Testing strategy material\n\n${list(tests.map((file) => file.path))}`,
    "development-guide.md": `${heading("Development Guide")}## Development and test material\n\n${list([...manifests, ...tests].map((file) => file.path))}\n\n## Directly supported commands and workflow details\n\n${sourceMap([...manifests, ...tests], 36) || "- No supported development workflow details were found."}`,
  };
  if (api.length) documents["api-contracts.md"] = `${heading("API Contracts")}## API and service files\n\n${list(api.map((file) => file.path))}\n\n## Directly supported contracts\n\n${sourceMap(api, 48) || "- No supported API contracts were found."}`;
  if (data.length) documents["data-models.md"] = `${heading("Data Models")}## Model and schema files\n\n${list(data.map((file) => file.path))}\n\n## Directly supported model details\n\n${sourceMap(data, 48) || "- No supported data-model details were found."}`;
  if (ui.length) documents["component-inventory.md"] = `${heading("Component Inventory")}## Client and UI files\n\n${list(ui.map((file) => file.path))}\n\n## Directly supported component details\n\n${sourceMap(ui, 48) || "- No supported UI details were found."}`;
  if (operations.length) documents["deployment-guide.md"] = `${heading("Operations and Deployment")}## Operational files\n\n${list(operations.map((file) => file.path))}\n\n## Directly supported operational details\n\n${sourceMap(operations, 36) || "- No supported operational details were found."}`;
  if (contribution.length) documents["contribution-guide.md"] = `${heading("Contribution Guide")}## Contribution material\n\n${list(contribution.map((file) => file.path))}\n\n## Directly supported contribution practices\n\n${sourceMap(contribution, 30) || "- No supported contribution details were found."}`;
  if (multiPart) {
    documents["project-parts.md"] = `${heading("Project Parts")}## Detected parts\n\n${topLevelParts.map((part) => `- \`${part}/\``).join("\n")}\n\n## Part-specific files\n\n${list(request.files.filter((file) => topLevelParts.includes(file.path.split("/")[0]!)).map((file) => file.path))}`;
    documents["integration-architecture.md"] = `${heading("Integration Architecture")}## Detected parts\n\n${topLevelParts.map((part) => `- \`${part}/\``).join("\n")}\n\n## Interface and integration material\n\n${list([...api, ...ui, ...entry].map((file) => file.path))}\n\n## Directly supported integration details\n\n${sourceMap([...api, ...ui], 40) || "- No supported cross-part interface details were found."}`;
  }
  if (request.category === "experience") {
    documents["experience-context.md"] = `${heading("Experience Context")}## Documented role context\n\n${sourceMap([...documentation, ...manifests], 36) || "- No documented role, organization, or period was found in the bounded scan."}\n\n## Explicit gaps\n\n- Treat role title, organization, period, personal attribution, and employment status as unknown unless the selected material states them directly.`;
    documents["work-deliverables.md"] = `${heading("Work Deliverables")}## Directly supported work outputs\n\n${sourceMap([...entry, ...api, ...data, ...ui, ...documentation], 54) || "- No direct work-output facts were found."}\n\n## Interpretation boundary\n\n- Source code or a file's presence is context only; it does not establish that the candidate owned or delivered the work.`;
    documents["collaboration-and-process.md"] = `${heading("Collaboration and Process")}## Process and collaboration material\n\n${sourceMap([...documentation, ...tests, ...operations], 40) || "- No direct collaboration, review, or process facts were found."}\n\n## Explicit gaps\n\n- Team size, review role, stakeholder interaction, and delivery impact remain unknown unless directly documented.`;
  }
  const overviewArtifact = request.category === "experience" ? "experience-overview.md" : "project-overview.md";
  const documentationLinks = [overviewArtifact, "resume-evidence.md", "resume-bullet-candidates.md", "resume-summary.md", ...Object.keys(documents).sort((left, right) => left.localeCompare(right))].map((name) => `- [${name}](./${name})`).join("\n");
  const indexTitle = request.category === "experience" ? "Experience Documentation Index" : "Project Documentation Index";
  const handoff = request.category === "experience" ? "Use this documentation set to understand the documented work context before creating a base-resume description. Resume claims must be summarized from the provenance-locked facts in `resume-evidence.md`; source files do not prove personal ownership, employment terms, or impact on their own." : "Use this documentation set to understand the project before creating a base-resume description. Resume claims must be summarized from the provenance-locked facts in `resume-evidence.md`; the surrounding documentation provides architecture and implementation context, not unsupported ownership, impact, or metric claims.";
  documents["index.md"] = `${heading(indexTitle)}## ${request.category === "experience" ? "Experience" : "Project"} overview\n\n- Classification: ${String(projectScan.repositoryShape)}\n- Files inspected: ${request.files.length}\n\n## Documentation set\n\n${documentationLinks}\n\n## Resume-description handoff\n\n${handoff}`;
  return documents;
}

function assessmentInvalid(message: string, next = "Review the selected opportunity material and try the assessment again."): never { throw new WorkspaceError("OPPORTUNITY_ASSESSMENT_INVALID", message, next); }
export function validateOpportunityAssessmentResponse(value: unknown, request: OpportunityAssessmentRequest): OpportunityAssessmentResponse { if (!value || typeof value !== "object" || Array.isArray(value)) assessmentInvalid("The local model returned an unusable assessment."); const item = value as Record<string, unknown>; const strengths = item.strengths; const gaps = item.gaps; const unknowns = item.unknowns; const excerpt = (value: unknown) => { if (!value || typeof value !== "object") return false; const range = value as { start?: unknown; end?: unknown }; return Number.isInteger(range.start) && Number.isInteger(range.end) && (range.start as number) >= 0 && (range.end as number) > (range.start as number) && (range.end as number) <= request.opportunity.copiedDescription.length && (range.end as number) - (range.start as number) <= 500; }; const predicts = (text: unknown) => typeof text === "string" && /\b(hired|hire|interview|offer|employer intent|will get)\b/i.test(text); if (item.schemaVersion !== 1 || item.selectionEcho !== request.consentFingerprint || !Array.isArray(strengths) || strengths.length > 12 || !Array.isArray(gaps) || gaps.length > 12 || !Array.isArray(unknowns) || unknowns.length > 12 || strengths.some((entry) => !entry || typeof entry !== "object" || !plain((entry as { text?: unknown }).text, 900) || predicts((entry as { text?: unknown }).text) || !excerpt((entry as { excerpt?: unknown }).excerpt) || !Array.isArray((entry as { evidenceIndexes?: unknown }).evidenceIndexes) || !(entry as { evidenceIndexes: unknown[] }).evidenceIndexes.length || (entry as { evidenceIndexes: unknown[] }).evidenceIndexes.some((index) => !Number.isInteger(index) || (index as number) < 0 || (index as number) >= request.evidence.length)) || gaps.some((entry) => !entry || typeof entry !== "object" || !plain((entry as { text?: unknown }).text, 900) || predicts((entry as { text?: unknown }).text) || !excerpt((entry as { excerpt?: unknown }).excerpt)) || unknowns.some((entry) => !plain(entry, 500) || predicts(entry))) assessmentInvalid("The local model returned unsafe assessment guidance."); const result = { schemaVersion: 1 as const, strengths: strengths as OpportunityAssessmentResponse["strengths"], gaps: gaps as OpportunityAssessmentResponse["gaps"], unknowns: unknowns as string[], selectionEcho: request.consentFingerprint }; if (JSON.stringify(result).length > maxResponse) assessmentInvalid("The local model assessment is too large to review safely."); return result; }
export async function requestOpportunityAssessment(request: OpportunityAssessmentRequest, fetcher: FetchLike = fetch): Promise<OpportunityAssessmentResponse> { if (!validConnection(request.connection) || !plain(request.profileSummary, 4_000) || !sha(request.profileDigest) || !sha(request.templateDigest) || !plain(request.opportunity.id, 64) || !sha(request.opportunity.contentDigest) || !plain(request.opportunity.copiedDescription, 20_000) || !request.opportunity.requirements.length || request.opportunity.requirements.length > 20 || request.opportunity.requirements.some((item) => !plain(item, 1_000)) || !request.evidence.length || request.evidence.length > 50 || request.evidence.some((item) => !plain(item.id, 64) || !plain(item.factualText, 4_000) || !sha(item.contentDigest)) || request.consentFingerprint !== opportunityAssessmentConsentFingerprint(request)) assessmentInvalid("The selected local assessment material cannot be sent safely."); return validateOpportunityAssessmentResponse(await native(request.connection, "Return only JSON. Assess semantic resume-to-opportunity fit using supplied evidence. Never predict hiring, interviews, offers, or employer intent.", { schemaVersion: 1, selectionEcho: request.consentFingerprint, profile: request.profileSummary, opportunity: { title: request.opportunity.title, company: request.opportunity.company, requirements: request.opportunity.requirements, copiedDescription: request.opportunity.copiedDescription }, evidence: request.evidence.map(({ factualText, contentDigest }) => ({ factualText, contentDigest })), responseShape: { strengths: [{ text: "string", evidenceIndexes: [0], excerpt: { start: 0, end: 1 } }], gaps: [{ text: "string", excerpt: { start: 0, end: 1 } }], unknowns: ["string"], selectionEcho: request.consentFingerprint } }, 1100, fetcher, "OPPORTUNITY_ASSESSMENT_UNAVAILABLE"), request); }
