import assert from "node:assert/strict";
import test from "node:test";

import { localModelCapabilityVersion, opportunityAssessmentConsentFingerprint, requestOpportunityAssessment, requestResumeCoach, resumeCoachConsentFingerprint, resumeCoachSystemInstruction } from "../src/adapters/local-model/local-model-gateway";

const connection = { configurationRevisionId: "00000000-0000-7000-8000-000000000009", configurationDigest: `sha256:${"f".repeat(64)}`, modelIdentifier: "qwen/qwen3.5-9b", token: "vault-token" };
const requestBase = { connection, profileRevisionId: "00000000-0000-7000-8000-000000000010", profileDigest: `sha256:${"a".repeat(64)}`, profileSnapshot: "Adrian Javier, TypeScript developer", templateId: "00000000-0000-7000-8000-000000000011", templateDigest: `sha256:${"c".repeat(64)}`, evidence: [{ id: "00000000-0000-7000-8000-000000000001", contentDigest: `sha256:${"b".repeat(64)}`, factualText: "Built accessible TypeScript interfaces." }], userRequest: "Help me improve my resume.", consentNonce: "test-consent-1" };
function request() { return { ...requestBase, consentFingerprint: resumeCoachConsentFingerprint(requestBase) }; }
function native(content: unknown, extra: Record<string, unknown> = {}) { return new Response(JSON.stringify({ output: [{ type: "message", content: JSON.stringify(content) }], ...extra }), { status: 200 }); }

test("Resume Coach sends one bounded authenticated native loopback request and validates grounded JSON", async () => {
  let calls = 0; let target = ""; let body = ""; let authorization = ""; let headerNames: string[] = []; let hasSignal = false;
  const value = request(); const result = await requestResumeCoach(value, async (url, init) => { calls += 1; target = String(url); body = String(init.body); authorization = new Headers(init.headers).get("authorization") ?? ""; headerNames = [...new Headers(init.headers).keys()].sort(); hasSignal = init.signal instanceof AbortSignal; return native({ schemaVersion: 1, selectionEcho: value.consentFingerprint, sections: [{ heading: "Strength", text: "Your TypeScript work is relevant." }], claims: [{ text: "You built TypeScript interfaces.", evidenceIndexes: [0] }], unknowns: ["Production scope is not established."] }); });
  assert.equal(calls, 1); assert.equal(target, "http://127.0.0.1:1234/api/v1/chat"); assert.equal(authorization, "Bearer vault-token"); assert.match(body, /"store":false/); assert.match(body, /"system_prompt"/); assert.match(resumeCoachSystemInstruction, /Never extrapolate or calculate a benefit/); assert.doesNotMatch(body, /tools|integrations|previous_response_id|https:\/\//); assert.equal(result.claims[0]?.evidenceIndexes[0], 0);
  assert.deepEqual(headerNames, ["authorization", "content-type"]); assert.equal(hasSignal, true); assert.deepEqual(Object.keys(JSON.parse(body)).sort(), ["input", "max_output_tokens", "model", "store", "stream", "system_prompt", "temperature"]);
});

test("Resume Coach rejects stale consent and stateful/native tool-shaped responses", async () => {
  await assert.rejects(requestResumeCoach({ ...request(), consentFingerprint: `sha256:${"d".repeat(64)}` }, async () => { throw new Error("must not call"); }), { code: "RESUME_COACH_INVALID" });
  const value = request();
  await assert.rejects(requestResumeCoach(value, async () => native({ schemaVersion: 1, selectionEcho: value.consentFingerprint, sections: [{ heading: "Strength", text: "Relevant evidence." }], claims: [{ text: "Built TypeScript interfaces.", evidenceIndexes: [0] }], unknowns: [] }, { response_id: "resp_unsafe" })), { code: "RESUME_COACH_UNAVAILABLE" });
  await assert.rejects(requestResumeCoach(value, async () => new Response(JSON.stringify({ output: [{ type: "tool_call", content: "{}" }] }), { status: 200 })), { code: "RESUME_COACH_UNAVAILABLE" });
  await assert.rejects(requestResumeCoach(value, async () => native({ schemaVersion: 1, selectionEcho: value.consentFingerprint, sections: [], claims: [], unknowns: [] }, { stats: { model_load_time_seconds: 1 } })), { code: "RESUME_COACH_UNAVAILABLE" });
  await assert.rejects(requestResumeCoach(value, async () => new Response("x".repeat(24_001), { status: 200 })), { code: "RESUME_COACH_UNAVAILABLE" });
});

test("local-model capabilities isolate configuration fingerprints and assessment schemas", async () => {
  assert.equal(localModelCapabilityVersion("resume-coach"), "resume-coach-v5"); assert.equal(localModelCapabilityVersion("opportunity-assessment"), "opportunity-assessment-v1"); assert.throws(() => localModelCapabilityVersion("unknown"), { code: "RESUME_COACH_INVALID" });
  const opportunity = { id: "00000000-0000-7000-8000-000000000002", contentDigest: `sha256:${"d".repeat(64)}`, title: "Product Designer", company: "Northstar", requirements: ["Accessible design"], copiedDescription: "Product Designer role at Northstar Studio with accessibility responsibilities and collaborative product research work." };
  const base = { connection, profileDigest: `sha256:${"a".repeat(64)}`, templateDigest: `sha256:${"b".repeat(64)}`, profileSummary: "Product design graduate", opportunity, evidence: [{ id: "00000000-0000-7000-8000-000000000001", contentDigest: `sha256:${"c".repeat(64)}`, factualText: "Built accessible TypeScript interfaces." }] };
  const value = { ...base, consentFingerprint: opportunityAssessmentConsentFingerprint(base) };
  const result = await requestOpportunityAssessment(value, async (url, init) => { assert.equal(url, "http://127.0.0.1:1234/api/v1/chat"); assert.match(String(init.body), /"store":false/); assert.equal(new Headers(init.headers).get("authorization"), "Bearer vault-token"); return native({ schemaVersion: 1, selectionEcho: value.consentFingerprint, strengths: [{ text: "Accessible interface work relates to the role.", evidenceIndexes: [0], excerpt: { start: 0, end: 24 } }], gaps: [], unknowns: [] }); });
  assert.equal(result.strengths.length, 1); assert.notEqual(opportunityAssessmentConsentFingerprint({ ...base, connection: { ...connection, configurationDigest: `sha256:${"e".repeat(64)}` } }), value.consentFingerprint);
});
